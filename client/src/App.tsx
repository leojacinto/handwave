import { useEffect, useRef, useState, type MouseEvent, type WheelEvent } from "react";
import { GraphCanvas, type GraphCanvasHandle } from "./components/GraphCanvas";
import { HandOverlay } from "./components/HandOverlay";
import { Hud, type CameraStatus } from "./components/Hud";
import { fetchAictGraph, fetchAictGraphForSystem } from "./data/aictKgClient";
import type { KgGraph, KgNode } from "./data/kgTypes";
import { askJevRetire } from "./data/jevClient";
import { GestureController, type GestureFrame } from "./lib/gestureController";

export default function App() {
  const [graph, setGraph] = useState<KgGraph | null>(null);
  const [graphError, setGraphError] = useState<string>();
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string>();
  const [hoveredNode, setHoveredNode] = useState<KgNode | null>(null);
  const [frame, setFrame] = useState<GestureFrame | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<GraphCanvasHandle>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const controllerRef = useRef<GestureController | null>(null);
  const panState = useRef<{ active: boolean; x: number; y: number }>({ active: false, x: 0, y: 0 });

  // Jev's retire decision is rendered by the parent AIUX page (right panel,
  // under the record list), so this only asks and posts the result up.
  useEffect(() => {
    if (!graph) return;
    let stale = false;
    window.parent.postMessage({ type: "handwave:jev-decision", status: "loading" }, "*");
    askJevRetire(graph)
      .then((decision) => {
        if (!stale) window.parent.postMessage({ type: "handwave:jev-decision", status: "done", decision }, "*");
      })
      .catch((err) => {
        if (!stale)
          window.parent.postMessage(
            { type: "handwave:jev-decision", status: "error", error: err instanceof Error ? err.message : String(err) },
            "*"
          );
      });
    return () => {
      stale = true;
    };
  }, [graph]);

  useEffect(() => {
    fetchAictGraph()
      .then(setGraph)
      .catch((err) => setGraphError(err instanceof Error ? err.message : String(err)));
    return () => controllerRef.current?.stop();
  }, []);

  // The parent AIUX page owns the real record list (right panel); clicking a
  // row there posts this message down into this iframe. The graph loaded on
  // mount is only ever one hardcoded system's neighborhood (see
  // aictKgClient's DEFAULT_CYPHER), so showing the CLICKED record's own graph
  // means re-querying for it, not just panning the camera within the graph
  // already on screen.
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      // Only the embedding AIUX page can drive this — e.data.sysId is
      // concatenated straight into a Cypher query string (no parameter
      // binding in safeCypherExecute), so an unchecked sender is a Cypher
      // injection vector.
      if (e.source !== window.parent) return;
      if (e.data?.type === "handwave:focus-record" && typeof e.data.sysId === "string") {
        fetchAictGraphForSystem(e.data.sysId)
          .then((next) => {
            setGraph(next);
            setGraphError(undefined);
          })
          .catch((err) => setGraphError(err instanceof Error ? err.message : String(err)));
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const size = () => {
    const rect = containerRef.current?.getBoundingClientRect();
    return { w: rect?.width ?? 1, h: rect?.height ?? 1 };
  };

  async function handleStart() {
    setCameraStatus("starting");
    setErrorMessage(undefined);
    try {
      if (!videoRef.current) throw new Error("Video element not ready");
      const controller = new GestureController(videoRef.current, handleGestureFrame);
      await controller.start();
      controllerRef.current = controller;
      setCameraStatus("active");
    } catch (err) {
      setCameraStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Camera failed to start.");
    }
  }

  function handleGestureFrame(next: GestureFrame) {
    setFrame(next);
    const canvas = graphRef.current;
    if (!canvas) return;
    const { w, h } = size();
    const action = next.action;
    if (!action) return;

    switch (action.type) {
      case "pan":
        canvas.pan(action.dx * w, action.dy * h);
        break;
      case "zoom":
        canvas.zoomAt(action.scale, action.cx * w, action.cy * h);
        break;
      case "grab":
        canvas.beginDragAt(action.x * w, action.y * h);
        break;
      case "drag":
        canvas.dragTo(action.x * w, action.y * h);
        break;
      case "release":
        canvas.endDrag();
        break;
      case "reset":
        canvas.endDrag();
        canvas.reset();
        break;
    }
  }

  // Mouse fallback so the graph is fully explorable without a webcam too.
  function onMouseDown(e: MouseEvent) {
    const rect = containerRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const grabbed = graphRef.current?.beginDragAt(x, y);
    if (!grabbed) panState.current = { active: true, x: e.clientX, y: e.clientY };
  }
  function onMouseMove(e: MouseEvent) {
    const rect = containerRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (panState.current.active) {
      graphRef.current?.pan(e.clientX - panState.current.x, e.clientY - panState.current.y);
      panState.current.x = e.clientX;
      panState.current.y = e.clientY;
    } else {
      graphRef.current?.dragTo(x, y);
    }
  }
  function onMouseUp() {
    panState.current.active = false;
    graphRef.current?.endDrag();
  }
  // Pinching a node with a real backing record tells the parent AIUX page
  // (outside this iframe) to open it — this document has no access to AIUX's
  // own components/services, so it can only ask via postMessage.
  function handleGrab(node: KgNode | null) {
    if (!node?.recordTable || !node.recordSysId) return;
    window.parent.postMessage(
      { type: "handwave:open-record", table: node.recordTable, sysId: node.recordSysId },
      "*"
    );
  }

  function onWheel(e: WheelEvent) {
    const rect = containerRef.current!.getBoundingClientRect();
    const scale = e.deltaY > 0 ? 0.9 : 1.1;
    graphRef.current?.zoomAt(scale, e.clientX - rect.left, e.clientY - rect.top);
  }

  return (
    <div
      ref={containerRef}
      className="app-stage"
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      onWheel={onWheel}
    >
      <HandOverlay ref={videoRef} frame={frame} />
      {graph && <GraphCanvas ref={graphRef} graph={graph} onHover={setHoveredNode} onGrab={handleGrab} />}
      <Hud
        graphError={graphError}
        cameraStatus={cameraStatus}
        errorMessage={errorMessage}
        hoveredNode={hoveredNode}
        onStart={handleStart}
        onReset={() => graphRef.current?.reset()}
      />
    </div>
  );
}
