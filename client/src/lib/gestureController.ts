import {
  FilesetResolver,
  HandLandmarker,
  type HandLandmarkerResult,
} from "@mediapipe/tasks-vision";

// Landmark indices from the MediaPipe hand model (21 points per hand).
const WRIST = 0;
const THUMB_TIP = 4;
const INDEX_TIP = 8;
const MIDDLE_MCP = 9;
const MIDDLE_TIP = 12;
const RING_TIP = 16;
const PINKY_TIP = 20;

// Tunable heuristics. Pinch/fist/open are ratios against handSize (wrist ->
// middle-MCP distance) so they hold roughly steady regardless of how close
// the hand is to the camera. Expect to retune these against a real webcam —
// they were picked by eye, not measured against recorded footage.
const PINCH_RATIO = 0.45;
const FIST_RATIO = 1.15;
const OPEN_RATIO = 1.55;
const SMOOTHING = 0.5; // exponential moving average factor, higher = snappier
// Frames the hand must hold a fist pose before reset fires. Without this,
// a quick pinch -> open -> pinch transition can pass through a fist-like
// curl for a frame or two and trigger an accidental reset.
const FIST_HOLD_FRAMES = 10;

export type HandPose = "open" | "pinch" | "fist" | "unknown";

export interface Point {
  x: number;
  y: number;
}

export interface HandState {
  handedness: "Left" | "Right";
  pose: HandPose;
  palm: Point; // smoothed, normalized 0..1 (mirrored to feel natural to the user)
  pinchPoint?: Point;
  landmarks: Point[]; // all 21, normalized 0..1, mirrored
}

export type GestureAction =
  | { type: "pan"; dx: number; dy: number }
  | { type: "zoom"; scale: number; cx: number; cy: number }
  | { type: "grab"; x: number; y: number }
  | { type: "drag"; x: number; y: number }
  | { type: "release" }
  | { type: "reset" };

export interface GestureFrame {
  hands: HandState[];
  action: GestureAction | null;
}

function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function classifyPose(landmarks: Point[]): HandPose {
  const wrist = landmarks[WRIST];
  const handSize = dist(wrist, landmarks[MIDDLE_MCP]) || 1e-6;

  const pinchRatio = dist(landmarks[THUMB_TIP], landmarks[INDEX_TIP]) / handSize;
  if (pinchRatio < PINCH_RATIO) return "pinch";

  const avgTipToWrist =
    (dist(landmarks[INDEX_TIP], wrist) +
      dist(landmarks[MIDDLE_TIP], wrist) +
      dist(landmarks[RING_TIP], wrist) +
      dist(landmarks[PINKY_TIP], wrist)) /
    (4 * handSize);

  if (avgTipToWrist < FIST_RATIO) return "fist";
  if (avgTipToWrist > OPEN_RATIO) return "open";
  return "unknown";
}

interface TrackedHand {
  palm: Point;
  pinchPoint: Point;
  wasPinching: boolean;
  fistFrames: number;
  fistFired: boolean;
}

export class GestureController {
  private landmarker: HandLandmarker | null = null;
  private video: HTMLVideoElement;
  private raf = 0;
  private lastVideoTime = -1;
  private tracked = new Map<string, TrackedHand>();
  private zoomAnchorDist: number | null = null;
  private onFrame: (frame: GestureFrame) => void;
  private stream: MediaStream | null = null;

  constructor(video: HTMLVideoElement, onFrame: (frame: GestureFrame) => void) {
    this.video = video;
    this.onFrame = onFrame;
  }

  async start(): Promise<void> {
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.17/wasm"
    );
    this.landmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
        delegate: "GPU",
      },
      runningMode: "VIDEO",
      numHands: 2,
    });

    this.stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480, facingMode: "user" },
      audio: false,
    });
    this.video.srcObject = this.stream;
    await this.video.play();

    this.loop();
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
    this.stream?.getTracks().forEach((t) => t.stop());
    this.landmarker?.close();
    this.landmarker = null;
  }

  private loop = (): void => {
    if (!this.landmarker) return;
    if (this.video.currentTime !== this.lastVideoTime) {
      this.lastVideoTime = this.video.currentTime;
      const result = this.landmarker.detectForVideo(this.video, performance.now());
      this.processResult(result);
    }
    this.raf = requestAnimationFrame(this.loop);
  };

  private processResult(result: HandLandmarkerResult): void {
    const hands: HandState[] = [];
    const seenKeys = new Set<string>();
    const openHandDeltas: Point[] = [];
    const pinchPoints: Point[] = [];
    let action: GestureAction | null = null;

    for (let i = 0; i < result.landmarks.length; i++) {
      const raw = result.landmarks[i];
      // Mirror x so moving your hand right moves things right on screen,
      // matching what you see in a normal front-facing camera preview.
      const landmarks: Point[] = raw.map((p) => ({ x: 1 - p.x, y: p.y }));
      const handedness = result.handednesses[i]?.[0]?.categoryName === "Left" ? "Right" : "Left";
      const key = handedness;
      seenKeys.add(key);

      const pose = classifyPose(landmarks);
      const rawPalm = {
        x: (landmarks[WRIST].x + landmarks[MIDDLE_MCP].x) / 2,
        y: (landmarks[WRIST].y + landmarks[MIDDLE_MCP].y) / 2,
      };
      const rawPinch = {
        x: (landmarks[THUMB_TIP].x + landmarks[INDEX_TIP].x) / 2,
        y: (landmarks[THUMB_TIP].y + landmarks[INDEX_TIP].y) / 2,
      };

      let tracked = this.tracked.get(key);
      if (!tracked) {
        tracked = { palm: rawPalm, pinchPoint: rawPinch, wasPinching: false, fistFrames: 0, fistFired: false };
        this.tracked.set(key, tracked);
      }
      const prevPalm = { ...tracked.palm };
      tracked.palm.x += (rawPalm.x - tracked.palm.x) * SMOOTHING;
      tracked.palm.y += (rawPalm.y - tracked.palm.y) * SMOOTHING;
      tracked.pinchPoint.x += (rawPinch.x - tracked.pinchPoint.x) * SMOOTHING;
      tracked.pinchPoint.y += (rawPinch.y - tracked.pinchPoint.y) * SMOOTHING;

      hands.push({
        handedness: key,
        pose,
        palm: { ...tracked.palm },
        pinchPoint: pose === "pinch" ? { ...tracked.pinchPoint } : undefined,
        landmarks,
      });

      if (pose === "pinch") pinchPoints.push({ ...tracked.pinchPoint });
      if (pose === "open") {
        openHandDeltas.push({ x: tracked.palm.x - prevPalm.x, y: tracked.palm.y - prevPalm.y });
      }

      if (pose === "fist") tracked.fistFrames += 1;
      else tracked.fistFrames = 0;
    }

    for (const key of Array.from(this.tracked.keys())) {
      if (!seenKeys.has(key)) this.tracked.delete(key);
    }

    // Reset requires BOTH hands fisted at once, held — a single hand's
    // fingers curling as it exits the frame, or right after a pinch
    // releases, kept getting misread as an accidental fist and firing
    // reset. Needing two simultaneous, independently-tracked hands is far
    // harder to trigger by accident than a single ambiguous hand.
    const leftFist = this.tracked.get("Left");
    const rightFist = this.tracked.get("Right");
    const bothFisted =
      !!leftFist && !!rightFist && leftFist.fistFrames >= FIST_HOLD_FRAMES && rightFist.fistFrames >= FIST_HOLD_FRAMES;
    if (bothFisted) {
      if (!leftFist.fistFired) action = { type: "reset" };
      leftFist.fistFired = true;
      rightFist.fistFired = true;
    } else {
      if (leftFist && leftFist.fistFrames === 0) leftFist.fistFired = false;
      if (rightFist && rightFist.fistFrames === 0) rightFist.fistFired = false;
    }

    // Two-hand pinch = zoom (classic Minority Report spread/pinch).
    if (pinchPoints.length === 2) {
      const d = dist(pinchPoints[0], pinchPoints[1]);
      if (this.zoomAnchorDist == null) {
        this.zoomAnchorDist = d;
      } else if (this.zoomAnchorDist > 1e-4) {
        const scale = d / this.zoomAnchorDist;
        const cx = (pinchPoints[0].x + pinchPoints[1].x) / 2;
        const cy = (pinchPoints[0].y + pinchPoints[1].y) / 2;
        if (Math.abs(scale - 1) > 0.003) action = { type: "zoom", scale, cx, cy };
        this.zoomAnchorDist = d;
      }
    } else {
      this.zoomAnchorDist = null;

      if (pinchPoints.length === 1) {
        const p = pinchPoints[0];
        const anyHand = hands.find((h) => h.pose === "pinch");
        const key = anyHand?.handedness ?? "Left";
        const tracked = this.tracked.get(key);
        if (tracked && !tracked.wasPinching) action = { type: "grab", x: p.x, y: p.y };
        else action = { type: "drag", x: p.x, y: p.y };
        if (tracked) tracked.wasPinching = true;
      } else {
        for (const tracked of this.tracked.values()) {
          if (tracked.wasPinching) action = { type: "release" };
          tracked.wasPinching = false;
        }
        if (!action && openHandDeltas.length > 0) {
          const dx = openHandDeltas.reduce((s, d) => s + d.x, 0) / openHandDeltas.length;
          const dy = openHandDeltas.reduce((s, d) => s + d.y, 0) / openHandDeltas.length;
          if (Math.abs(dx) > 0.0008 || Math.abs(dy) > 0.0008) action = { type: "pan", dx, dy };
        }
      }
    }

    this.onFrame({ hands, action });
  }
}
