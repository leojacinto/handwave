import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import type { KgGraph, KgNode, KgNodeType } from "../data/kgTypes";

const RADIUS: Record<KgNodeType, number> = { system: 22, model: 13, prompt: 13, flag: 10, detail: 9 };
const COLOR: Record<KgNodeType, string> = {
  system: "#f5a623",
  model: "#22d3ee",
  prompt: "#e879f9",
  flag: "#f87171",
  detail: "#64748b",
};
const STATUS_COLOR: Record<string, string> = {
  active: "#4ade80",
  pending_review: "#facc15",
  deprecated: "#94a3b8",
  retired: "#7f1d1d",
};

interface LayoutNode extends KgNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface GraphCanvasHandle {
  pan(dxPx: number, dyPx: number): void;
  zoomAt(scale: number, cxPx: number, cyPx: number): void;
  beginDragAt(xPx: number, yPx: number): boolean;
  dragTo(xPx: number, yPx: number): void;
  endDrag(): void;
  reset(): void;
  /** Centers the view on the node with this recordSysId. Returns false if not found. */
  focusRecord(recordSysId: string): boolean;
}

interface GraphCanvasProps {
  graph: KgGraph;
  onHover?: (node: KgNode | null) => void;
  onGrab?: (node: KgNode | null) => void;
}

const LINK_DISTANCE = 130;

export const GraphCanvas = forwardRef<GraphCanvasHandle, GraphCanvasProps>(function GraphCanvas(
  { graph, onHover, onGrab },
  ref
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const transformRef = useRef({ x: 0, y: 0, k: 1 });
  const nodesRef = useRef<LayoutNode[]>([]);
  const alphaRef = useRef(1);
  const dragNodeRef = useRef<LayoutNode | null>(null);

  useImperativeHandle(ref, () => ({
    pan(dxPx, dyPx) {
      transformRef.current.x += dxPx;
      transformRef.current.y += dyPx;
      wake();
    },
    zoomAt(scale, cxPx, cyPx) {
      const t = transformRef.current;
      const newK = Math.min(Math.max(t.k * scale, 0.25), 4);
      t.x = cxPx - (cxPx - t.x) * (newK / t.k);
      t.y = cyPx - (cyPx - t.y) * (newK / t.k);
      t.k = newK;
      wake();
    },
    beginDragAt(xPx, yPx) {
      const world = toWorld(xPx, yPx);
      const hit = hitTest(world.x, world.y);
      dragNodeRef.current = hit;
      onGrab?.(hit);
      return hit !== null;
    },
    dragTo(xPx, yPx) {
      const n = dragNodeRef.current;
      if (!n) return;
      const world = toWorld(xPx, yPx);
      n.x = world.x;
      n.y = world.y;
      n.vx = 0;
      n.vy = 0;
      wake();
    },
    endDrag() {
      dragNodeRef.current = null;
      // dragTo() keeps calling wake() every frame while dragging, so alpha
      // is still elevated (>=0.25) the instant a node re-enters the force
      // calculation on release — full-strength repulsion/gravity then hits
      // it in one step, which reads as a violent snap ("reset"). Taper
      // alpha down first so it eases back instead of jumping.
      alphaRef.current = Math.min(alphaRef.current, 0.04);
    },
    reset() {
      transformRef.current = { x: 0, y: 0, k: 1 };
      const canvas = canvasRef.current;
      if (canvas) {
        for (const n of nodesRef.current) {
          n.x = canvas.clientWidth / 2 + (Math.random() - 0.5) * 200;
          n.y = canvas.clientHeight / 2 + (Math.random() - 0.5) * 200;
        }
      }
      wake();
    },
    focusRecord(recordSysId) {
      const node = nodesRef.current.find((n) => n.recordSysId === recordSysId);
      const canvas = canvasRef.current;
      if (!node || !canvas) return false;
      const t = transformRef.current;
      t.k = Math.max(t.k, 1.3);
      t.x = canvas.clientWidth / 2 - node.x * t.k;
      t.y = canvas.clientHeight / 2 - node.y * t.k;
      wake();
      return true;
    },
  }));

  function toWorld(xPx: number, yPx: number) {
    const t = transformRef.current;
    return { x: (xPx - t.x) / t.k, y: (yPx - t.y) / t.k };
  }

  function hitTest(worldX: number, worldY: number): LayoutNode | null {
    let best: LayoutNode | null = null;
    let bestDist = Infinity;
    for (const n of nodesRef.current) {
      const d = Math.hypot(n.x - worldX, n.y - worldY);
      const r = RADIUS[n.type] + 14;
      if (d < r && d < bestDist) {
        best = n;
        bestDist = d;
      }
    }
    return best;
  }

  function wake() {
    if (alphaRef.current < 0.25) alphaRef.current = 0.25;
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
    };
    resize();
    window.addEventListener("resize", resize);

    const width = () => canvas.clientWidth;
    const height = () => canvas.clientHeight;

    const nodeById = new Map<string, LayoutNode>();
    nodesRef.current = graph.nodes.map((n) => {
      const ln: LayoutNode = {
        ...n,
        x: width() / 2 + (Math.random() - 0.5) * 300,
        y: height() / 2 + (Math.random() - 0.5) * 300,
        vx: 0,
        vy: 0,
      };
      nodeById.set(n.id, ln);
      return ln;
    });
    const nodes = nodesRef.current;
    const links = graph.links.filter((l) => nodeById.has(l.source) && nodeById.has(l.target));

    // Small graphs (a single focused record) settle into a tight cluster —
    // zoom in proportionally so they aren't a speck in a full-viewport
    // canvas. Large graphs keep close to the original zoom=1. Nodes start
    // scattered around (width/2, height/2) in world space, so re-anchor the
    // pan to keep that same point centered on screen at the new zoom.
    const k = Math.min(2.5, Math.max(1, 8 / Math.sqrt(Math.max(nodes.length, 1))));
    transformRef.current.k = k;
    transformRef.current.x = width() / 2 - (width() / 2) * k;
    transformRef.current.y = height() / 2 - (height() / 2) * k;

    let raf = 0;
    let lastHover: KgNode | null = null;

    const simulate = () => {
      const alpha = (alphaRef.current = Math.max(0.003, alphaRef.current - 0.012));
      const repulsion = (2200 + nodes.length * 35) * alpha;
      const attraction = 0.03 * alpha;
      const centerForce = 0.008 * alpha;
      const damping = 0.9;
      const maxSpeed = 6;

      for (let a = 0; a < nodes.length; a++) {
        for (let b = a + 1; b < nodes.length; b++) {
          const n1 = nodes[a];
          const n2 = nodes[b];
          const dx = n1.x - n2.x;
          const dy = n1.y - n2.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = repulsion / (dist * dist);
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          n1.vx += fx;
          n1.vy += fy;
          n2.vx -= fx;
          n2.vy -= fy;
        }
      }

      for (const link of links) {
        const s = nodeById.get(link.source)!;
        const t = nodeById.get(link.target)!;
        const dx = t.x - s.x;
        const dy = t.y - s.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = (dist - LINK_DISTANCE) * attraction;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        s.vx += fx;
        s.vy += fy;
        t.vx -= fx;
        t.vy -= fy;
      }

      for (const n of nodes) {
        if (n === dragNodeRef.current) continue;
        n.vx += (width() / 2 - n.x) * centerForce;
        n.vy += (height() / 2 - n.y) * centerForce;
        n.vx = Math.max(-maxSpeed, Math.min(maxSpeed, n.vx * damping));
        n.vy = Math.max(-maxSpeed, Math.min(maxSpeed, n.vy * damping));
        n.x += n.vx;
        n.y += n.vy;
      }

      draw();
      raf = requestAnimationFrame(simulate);
    };

    const draw = () => {
      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width(), height());

      const t = transformRef.current;
      ctx.translate(t.x, t.y);
      ctx.scale(t.k, t.k);

      ctx.lineWidth = 1.2;
      for (const link of links) {
        const s = nodeById.get(link.source)!;
        const target = nodeById.get(link.target)!;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(target.x, target.y);
        if (link.kind === "flagged_by") {
          ctx.strokeStyle = "rgba(248, 113, 113, 0.45)";
          ctx.setLineDash([4, 4]);
        } else {
          ctx.strokeStyle = "rgba(56, 189, 248, 0.35)";
          ctx.setLineDash([]);
        }
        ctx.stroke();
      }
      ctx.setLineDash([]);

      const now = performance.now();
      for (const n of nodes) {
        const r = RADIUS[n.type];
        const pulse = n.type === "flag" ? 1 + 0.15 * Math.sin(now / 260 + n.x) : 1;

        ctx.save();
        ctx.shadowColor = COLOR[n.type];
        ctx.shadowBlur = 18 * pulse;
        ctx.beginPath();
        ctx.arc(n.x, n.y, r * pulse, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(10, 16, 28, 0.85)";
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = COLOR[n.type];
        ctx.stroke();
        ctx.restore();

        if (n.status) {
          ctx.beginPath();
          ctx.arc(n.x + r * 0.65, n.y - r * 0.65, 3.5, 0, Math.PI * 2);
          ctx.fillStyle = STATUS_COLOR[n.status] ?? "#94a3b8";
          ctx.fill();
        }

        if (n.type === "system" || t.k > 0.75) {
          ctx.font = n.type === "system" ? "600 12px 'JetBrains Mono', monospace" : "11px 'JetBrains Mono', monospace";
          ctx.fillStyle = "rgba(226, 240, 255, 0.9)";
          ctx.textAlign = "center";
          ctx.fillText(n.label, n.x, n.y + r + 14);
        }
      }
      ctx.restore();

      if (onHover) {
        const hovered = dragNodeRef.current ?? null;
        if (hovered !== lastHover) {
          lastHover = hovered;
          onHover(hovered);
        }
      }
    };

    raf = requestAnimationFrame(simulate);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph]);

  return <canvas ref={canvasRef} className="graph-canvas" />;
});
