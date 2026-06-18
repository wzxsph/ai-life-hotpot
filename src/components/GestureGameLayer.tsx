/**
 * Gesture Game Layer
 *
 * Adds hand gesture interaction to the ingredient selection step.
 * Features:
 * - Virtual cursor following hand position
 * - Food grabbing with fist gesture
 * - Food dropping in hotpot with open gesture
 * - Score tracking
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { CameraPreview, VirtualCursor, GestureGuide } from "./CameraPreview";
import type { GestureState } from "@/hooks/useHandGesture";

// Game constants
const GAME_WIDTH = 1280;
const GAME_HEIGHT = 720;
const HOTPOT_CENTER_X = 640;
const HOTPOT_CENTER_Y = 412;
const HOTPOT_RADIUS = 95;
const CURSOR_SIZE = 40;
const GRAB_RADIUS = 55;
const DROP_RADIUS = HOTPOT_RADIUS + 10;

// Gesture detection parameters
const GESTURE_BUF = 5;

// Import MediaPipe types
interface NormalizedLandmark {
  x: number;
  y: number;
  z: number;
}

interface HandLandmarkerResult {
  landmarks: NormalizedLandmark[][];
  worldLandmarks: NormalizedLandmark[][];
  handedness: { displayName: string; index: number }[][];
}

// Gesture filter with majority voting
class GestureFilter {
  private buf: GestureState[] = [];
  private readonly size: number;

  constructor(size: number = GESTURE_BUF) {
    this.size = size;
  }

  push(g: GestureState): GestureState {
    this.buf.push(g);
    if (this.buf.length > this.size) {
      this.buf.shift();
    }

    const cnt: Record<string, number> = {};
    for (const x of this.buf) {
      cnt[x] = (cnt[x] || 0) + 1;
    }

    for (const key of ["open", "fist"] as const) {
      if ((cnt[key] || 0) >= 3) {
        return key;
      }
    }

    return this.buf[this.buf.length - 1] || "none";
  }

  reset() {
    this.buf = [];
  }
}

// Detect gesture from landmarks
function detectGesture(landmarks: NormalizedLandmark): {
  gesture: GestureState;
  rawGesture: GestureState;
} {
  // Simplified gesture detection
  const FINGER_TIPS = [8, 12, 16, 20];
  const FINGER_PIPS = [6, 10, 14, 18];
  const THUMB_TIP = 4;
  const INDEX_MCP = 5;

  const fingerStates = FINGER_TIPS.map((tip, i) => {
    const pip = FINGER_PIPS[i];
    return landmarks[FINGER_TIPS.indexOf(tip)]?.y < landmarks[FINGER_PIPS.indexOf(pip)]?.y - 0.02;
  });

  const thumbExtended = Math.abs(landmarks[THUMB_TIP].x - landmarks[INDEX_MCP].x) > 0.08;

  const nOpen = fingerStates.filter(Boolean).length + (thumbExtended ? 1 : 0);

  let rawGesture: GestureState;
  if (nOpen >= 4) {
    rawGesture = "open";
  } else if (nOpen <= 1) {
    rawGesture = "fist";
  } else {
    rawGesture = "trans";
  }

  return { gesture: rawGesture, rawGesture };
}

interface FoodPosition {
  id: string;
  x: number;
  y: number;
  originX: number;
  originY: number;
}

interface GestureGameLayerProps {
  /** Enable gesture mode */
  enabled: boolean;
  /** Food positions from the game */
  foodPositions: FoodPosition[];
  /** Grabbed food ID (if any) */
  grabbedFoodId: string | null;
  /** Callback when food is grabbed */
  onFoodGrabbed: (foodId: string) => void;
  /** Callback when food is dropped */
  onFoodDropped: (foodId: string, success: boolean) => void;
  /** Show guide */
  showGuide: boolean;
  /** On close guide */
  onCloseGuide: () => void;
}

export function GestureGameLayer({
  enabled,
  foodPositions,
  grabbedFoodId,
  onFoodGrabbed,
  onFoodDropped,
  showGuide,
  onCloseGuide,
}: GestureGameLayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gesture, setGesture] = useState<GestureState>("none");
  const [rawGesture, setRawGesture] = useState<GestureState>("none");
  const [handPosition, setHandPosition] = useState<{ x: number; y: number } | null>(null);
  const [landmarks, setLandmarks] = useState<NormalizedLandmark[] | null>(null);
  const [cursorPos, setCursorPos] = useState({ x: GAME_WIDTH / 2, y: GAME_HEIGHT / 2 });
  const [showCamera, setShowCamera] = useState(true);

  const detectorRef = useRef<any>(null);
  const filterRef = useRef(new GestureFilter(GESTURE_BUF));
  const animationRef = useRef<number>(0);
  const lastGestureRef = useRef<GestureState>("none");
  const grabbedFoodIdRef = useRef<string | null>(null);

  // Keep ref in sync
  useEffect(() => {
    grabbedFoodIdRef.current = grabbedFoodId;
  }, [grabbedFoodId]);

  // Initialize MediaPipe
  useEffect(() => {
    if (!enabled) return;

    let mounted = true;

    async function init() {
      try {
        setLoading(true);
        setError(null);

        // Dynamically import MediaPipe
        const vision = await import("@mediapipe/tasks-vision");
        const FilesetResolver = vision.FilesetResolver;
        const HandLandmarker = vision.HandLandmarker;

        const filesetResolver = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm",
        );

        const detector = await HandLandmarker.createFromOptions(filesetResolver, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numHands: 1,
        });

        if (mounted) {
          detectorRef.current = detector;
          setLoading(false);
        }
      } catch (err) {
        if (mounted) {
          setError("无法初始化手势检测，请刷新页面重试");
          setLoading(false);
        }
      }
    }

    init();

    return () => {
      mounted = false;
      if (detectorRef.current) {
        detectorRef.current.close();
        detectorRef.current = null;
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [enabled]);

  // Request camera
  const requestCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.playsInline = true;
        videoRef.current.muted = true;
        await videoRef.current.play();
        setCameraReady(true);
      }
    } catch {
      setError("无法访问摄像头，请检查权限设置");
    }
  }, []);

  // Start camera on mount if enabled
  useEffect(() => {
    if (enabled && !cameraReady) {
      requestCamera();
    }
  }, [enabled, cameraReady, requestCamera]);

  // Detection loop
  useEffect(() => {
    if (!enabled || !cameraReady || !detectorRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const CAM_WIDTH = 320;
    const CAM_HEIGHT = 240;

    function detect() {
      // Check if video is ready
      if (!detectorRef.current || video.readyState < 2) {
        animationRef.current = requestAnimationFrame(detect);
        return;
      }

      try {
        const result = detectorRef.current.detectForVideo(video, performance.now());

        // Set canvas size before drawing
        if (canvas.width !== CAM_WIDTH) canvas.width = CAM_WIDTH;
        if (canvas.height !== CAM_HEIGHT) canvas.height = CAM_HEIGHT;

        // Always draw camera feed first
        ctx.clearRect(0, 0, CAM_WIDTH, CAM_HEIGHT);
        ctx.save();
        ctx.scale(-1, 1);
        ctx.drawImage(video, -CAM_WIDTH, 0, CAM_WIDTH, CAM_HEIGHT);
        ctx.restore();

        if (result.landmarks && result.landmarks.length > 0) {
          const lm = result.landmarks[0];
          setLandmarks(lm);

          // Draw hand skeleton (mirrored)
          const HAND_CONNECTIONS: [number, number][] = [
            [0, 1],
            [1, 2],
            [2, 3],
            [3, 4],
            [0, 5],
            [5, 6],
            [6, 7],
            [7, 8],
            [5, 9],
            [9, 10],
            [10, 11],
            [11, 12],
            [9, 13],
            [13, 14],
            [14, 15],
            [15, 16],
            [13, 17],
            [17, 18],
            [18, 19],
            [19, 20],
            [0, 17],
          ];

          const mirroredLm = lm.map((l) => ({ ...l, x: 1 - l.x }));

          ctx.strokeStyle = "rgba(0, 255, 0, 0.8)";
          ctx.lineWidth = 2;

          for (const [start, end] of HAND_CONNECTIONS) {
            ctx.beginPath();
            ctx.moveTo(mirroredLm[start].x * CAM_WIDTH, mirroredLm[start].y * CAM_HEIGHT);
            ctx.lineTo(mirroredLm[end].x * CAM_WIDTH, mirroredLm[end].y * CAM_HEIGHT);
            ctx.stroke();
          }

          const tipIndices = [4, 8, 12, 16, 20];
          for (let i = 0; i < mirroredLm.length; i++) {
            const x = mirroredLm[i].x * CAM_WIDTH;
            const y = mirroredLm[i].y * CAM_HEIGHT;
            ctx.beginPath();
            ctx.arc(x, y, tipIndices.includes(i) ? 5 : 3, 0, Math.PI * 2);
            ctx.fillStyle = tipIndices.includes(i) ? "#ff4444" : "#ffffff";
            ctx.fill();
          }

          // Detect gesture
          const fingerTips = [8, 12, 16, 20];
          const fingerPips = [6, 10, 14, 18];
          const fingerStates = fingerTips.map((tip, i) => lm[tip].y < lm[fingerPips[i]].y - 0.02);
          const thumbExtended = Math.abs(lm[4].x - lm[5].x) > 0.08;
          const nOpen = fingerStates.filter(Boolean).length + (thumbExtended ? 1 : 0);

          let raw: GestureState = "trans";
          if (nOpen >= 4) raw = "open";
          else if (nOpen <= 1) raw = "fist";

          const filtered = filterRef.current.push(raw);
          setRawGesture(raw);
          setGesture(filtered);

          // Calculate hand position (mirrored for user perspective)
          const handX = (1 - lm[0].x) * GAME_WIDTH;
          const handY = lm[0].y * GAME_HEIGHT;

          // Smooth cursor movement
          const alpha = 0.45;
          const newX = Math.round(cursorPos.x * (1 - alpha) + handX * alpha);
          const newY = Math.round(cursorPos.y * (1 - alpha) + handY * alpha);

          // Clamp to game bounds
          const clampedX = Math.max(CURSOR_SIZE / 2, Math.min(GAME_WIDTH - CURSOR_SIZE / 2, newX));
          const clampedY = Math.max(CURSOR_SIZE / 2, Math.min(GAME_HEIGHT - CURSOR_SIZE / 2, newY));

          setHandPosition({ x: handX, y: handY });
          setCursorPos({ x: clampedX, y: clampedY });

          // Draw gesture indicator
          const gestureColor =
            filtered === "open" ? "#00ff00" : filtered === "fist" ? "#ff8800" : "#888888";
          const gestureText = filtered === "open" ? "张开" : filtered === "fist" ? "握拳" : "过渡";

          ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
          ctx.fillRect(8, 8, 70, 24);
          ctx.font = "bold 14px sans-serif";
          ctx.fillStyle = gestureColor;
          ctx.fillText(gestureText, 14, 26);
        } else {
          setLandmarks(null);
          // Still update cursor position even without hand detection (use last known position)
          // Draw waiting message
          ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
          ctx.fillRect(8, 8, 100, 24);
          ctx.font = "bold 14px sans-serif";
          ctx.fillStyle = "#ffaa00";
          ctx.fillText("请伸出手", 14, 26);
        }
      } catch (err) {
        console.error("Detection error:", err);
      }

      animationRef.current = requestAnimationFrame(detect);
    }

    detect();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [enabled, cameraReady, cursorPos]);

  // Handle gesture changes
  useEffect(() => {
    if (!enabled) return;

    if (gesture === "fist" && lastGestureRef.current !== "fist" && !grabbedFoodIdRef.current) {
      // Try to grab food
      const grabRadius = GRAB_RADIUS;
      let grabbedId: string | null = null;
      let closestDist = Infinity;

      for (const food of foodPositions) {
        const dist = Math.hypot(cursorPos.x - food.x, cursorPos.y - food.y);
        if (dist < grabRadius && dist < closestDist) {
          grabbedId = food.id;
          closestDist = dist;
        }
      }

      if (grabbedId) {
        onFoodGrabbed(grabbedId);
      }
    }

    if (gesture === "open" && lastGestureRef.current === "fist" && grabbedFoodIdRef.current) {
      // Drop food
      const distToHotpot = Math.hypot(cursorPos.x - HOTPOT_CENTER_X, cursorPos.y - HOTPOT_CENTER_Y);
      const success = distToHotpot < DROP_RADIUS;

      onFoodDropped(grabbedFoodIdRef.current, success);
    }

    lastGestureRef.current = gesture;
  }, [enabled, gesture, cursorPos, foodPositions, onFoodGrabbed, onFoodDropped]);

  if (!enabled) return null;

  return (
    <>
      {/* Camera preview - bottom right corner */}
      <div
        style={{
          position: "absolute",
          right: 20,
          bottom: 20,
          zIndex: 150,
        }}
      >
        <div
          style={{
            background: "rgba(0, 0, 0, 0.75)",
            borderRadius: 12,
            padding: 12,
            boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
          }}
        >
          {loading && (
            <div
              style={{
                width: 320,
                height: 240,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#1a1a1a",
                borderRadius: 8,
                color: "#aaa",
              }}
            >
              加载手势检测中...
            </div>
          )}
          {error && (
            <div
              style={{
                width: 320,
                height: 240,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#1a1a1a",
                borderRadius: 8,
                color: "#ff6666",
                textAlign: "center",
                padding: 20,
              }}
            >
              {error}
            </div>
          )}
          {!loading && !error && (
            <>
              <canvas
                ref={canvasRef}
                style={{
                  width: 320,
                  height: 240,
                  borderRadius: 8,
                  display: "block",
                }}
              />
              <video
                ref={videoRef}
                style={{
                  display: "none",
                }}
              />
            </>
          )}
          <div
            style={{
              marginTop: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              color: "#aaa",
              fontSize: 12,
            }}
          >
            <span>手势模式</span>
            <button
              onClick={() => setShowCamera(!showCamera)}
              style={{
                background: "rgba(255,255,255,0.1)",
                border: "none",
                color: "#aaa",
                cursor: "pointer",
                padding: "4px 8px",
                borderRadius: 4,
                fontSize: 11,
              }}
            >
              {showCamera ? "隐藏" : "显示"}
            </button>
          </div>
        </div>
      </div>

      {/* Virtual cursor - always show when hand is detected */}
      {landmarks && (
        <VirtualCursor
          x={cursorPos.x}
          y={cursorPos.y}
          gesture={gesture as "open" | "fist" | "trans"}
          size={CURSOR_SIZE}
        />
      )}

      {/* Hotpot drop zone indicator when grabbing */}
      {grabbedFoodId && (
        <div
          style={{
            position: "absolute",
            left: HOTPOT_CENTER_X - HOTPOT_RADIUS - 20,
            top: HOTPOT_CENTER_Y - HOTPOT_RADIUS - 20,
            width: (HOTPOT_RADIUS + 20) * 2,
            height: (HOTPOT_RADIUS + 20) * 2,
            borderRadius: "50%",
            border: "3px dashed rgba(0, 255, 0, 0.4)",
            background: "radial-gradient(circle, rgba(0, 255, 0, 0.05) 0%, transparent 70%)",
            pointerEvents: "none",
            animation: "pulse 1.5s ease-in-out infinite",
          }}
        />
      )}

      {/* Gesture guide */}
      <GestureGuide visible={showGuide} onClose={onCloseGuide} />

      {/* Help button */}
      <button
        onClick={onCloseGuide}
        style={{
          position: "absolute",
          left: 20,
          bottom: 20,
          background: "rgba(0, 0, 0, 0.75)",
          border: "none",
          borderRadius: 20,
          width: 40,
          height: 40,
          color: "#fff",
          fontSize: 20,
          cursor: "pointer",
          zIndex: 150,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
        title="手势操作指南"
      >
        ?
      </button>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.02); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translate(-50%, -50%) scale(0.9); }
          to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
      `}</style>
    </>
  );
}
