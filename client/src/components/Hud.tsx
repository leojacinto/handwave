import type { KgNode } from "../data/kgTypes";

export type CameraStatus = "idle" | "starting" | "active" | "error";

interface HudProps {
  graphError?: string;
  cameraStatus: CameraStatus;
  errorMessage?: string;
  hoveredNode: KgNode | null;
  onStart: () => void;
  onReset: () => void;
}

export function Hud({ graphError, cameraStatus, errorMessage, hoveredNode, onStart, onReset }: HudProps) {
  return (
    <>
      <header className="hud-header">
        <div className="hud-title">
          HANDWAVE <span className="hud-title-dim">/ AICT KNOWLEDGE GRAPH</span>
        </div>
        <div className={`hud-source hud-source-${graphError ? "error" : "live"}`}>
          {graphError ? "GRAPH ERROR" : "LIVE"}
        </div>
      </header>

      {graphError && (
        <div className="hud-gate">
          <div className="hud-gate-card">
            <p className="hud-error">Knowledge Graph query failed: {graphError}</p>
          </div>
        </div>
      )}

      {!graphError && cameraStatus !== "active" && (
        <div className="hud-gate">
          <div className="hud-gate-card">
            <p>Handwave reads your webcam locally to track hand gestures. Nothing leaves this browser tab.</p>
            {cameraStatus === "error" && <p className="hud-error">{errorMessage ?? "Camera failed to start."}</p>}
            <button className="hud-button" onClick={onStart} disabled={cameraStatus === "starting"}>
              {cameraStatus === "starting" ? "Starting camera…" : "Enable camera"}
            </button>
          </div>
        </div>
      )}

      <aside className="hud-legend">
        <div className="hud-legend-title">Gestures</div>
        <ul>
          <li><span className="tag pinch">pinch + move</span> drag a node</li>
          <li><span className="tag open">open hand + move</span> pan the graph</li>
          <li><span className="tag zoom">two-hand pinch, spread/close</span> zoom</li>
          <li><span className="tag fist">both hands, fist + hold</span> reset view</li>
        </ul>
        <button className="hud-reset-button" onClick={onReset} style={{ pointerEvents: "auto" }}>
          Reset view
        </button>
      </aside>

      {hoveredNode && (
        <aside className="hud-inspector">
          <div className="hud-inspector-type">{hoveredNode.type.toUpperCase()}</div>
          <div className="hud-inspector-label">{hoveredNode.label}</div>
          {hoveredNode.status && (
            <div className="hud-inspector-row">
              <span>state</span>
              <span>{hoveredNode.status}</span>
            </div>
          )}
          {hoveredNode.riskRating && (
            <div className="hud-inspector-row">
              <span>risk rating</span>
              <span>{hoveredNode.riskRating}</span>
            </div>
          )}
          {hoveredNode.complianceScore && (
            <div className="hud-inspector-row">
              <span>compliance score</span>
              <span>{hoveredNode.complianceScore}</span>
            </div>
          )}
          {hoveredNode.relatedAiSystem && (
            <div className="hud-inspector-row">
              <span>system</span>
              <span>{hoveredNode.relatedAiSystem}</span>
            </div>
          )}
        </aside>
      )}
    </>
  );
}
