import { forwardRef, useEffect, useRef } from "react";
import type { GestureFrame } from "../lib/gestureController";

// Finger chains for the 21-point hand model, drawn as connected segments.
const FINGER_CHAINS = [
  [0, 1, 2, 3, 4],
  [0, 5, 6, 7, 8],
  [0, 9, 10, 11, 12],
  [0, 13, 14, 15, 16],
  [0, 17, 18, 19, 20],
  [5, 9, 13, 17],
];

interface HandOverlayProps {
  frame: GestureFrame | null;
}

export const HandOverlay = forwardRef<HTMLVideoElement, HandOverlayProps>(function HandOverlay(
  { frame },
  videoRef
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    if (frame) {
      for (const hand of frame.hands) {
        const color = hand.pose === "pinch" ? "#facc15" : hand.pose === "fist" ? "#f87171" : "#38bdf8";
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.shadowColor = color;
        ctx.shadowBlur = 8;

        for (const chain of FINGER_CHAINS) {
          ctx.beginPath();
          chain.forEach((idx, i) => {
            const p = hand.landmarks[idx];
            const x = p.x * w;
            const y = p.y * h;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          });
          ctx.stroke();
        }

        for (const p of hand.landmarks) {
          ctx.beginPath();
          ctx.arc(p.x * w, p.y * h, 2.5, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.fill();
        }

        ctx.shadowBlur = 0;
        ctx.font = "600 11px 'JetBrains Mono', monospace";
        ctx.fillStyle = color;
        ctx.fillText(`${hand.handedness.toUpperCase()} · ${hand.pose.toUpperCase()}`, hand.palm.x * w + 16, hand.palm.y * h);
      }
    }
    ctx.restore();
  }, [frame]);

  return (
    <div className="hand-overlay">
      <video ref={videoRef} className="hand-overlay-video" autoPlay playsInline muted />
      <canvas ref={canvasRef} className="hand-overlay-canvas" />
    </div>
  );
});
