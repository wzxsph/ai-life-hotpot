/**
 * Camera Preview Component
 *
 * Displays webcam feed with hand gesture visualization overlay.
 */

import { useRef, useEffect } from "react";
import type { HandLandmarkerResult, NormalizedLandmark } from "@mediapipe/tasks-vision";

// Hand landmark connections for drawing
const HAND_CONNECTIONS: [number, number][] = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4], // Thumb
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8], // Index
  [5, 9],
  [9, 10],
  [10, 11],
  [11, 12], // Middle
  [9, 13],
  [13, 14],
  [14, 15],
  [15, 16], // Ring
  [13, 17],
  [17, 18],
  [18, 19],
  [19, 20], // Pinky
  [0, 17], // Palm
];

interface CameraPreviewProps {
  /** Video element ref */
  videoRef: React.RefObject<HTMLVideoElement | null>;
  /** Hand landmarks to draw */
  landmarks?: NormalizedLandmark[] | null;
  /** Show hand visualization */
  showHand?: boolean;
  /** Class name */
  className?: string;
  /** Mirror the video (for selfie mode) */
  mirrored?: boolean;
  /** Current gesture to display */
  gesture?: "open" | "fist" | "trans" | "none";
  /** Width */
  width?: number;
  /** Height */
  height?: number;
}

export function CameraPreview({
  videoRef,
  landmarks,
  showHand = true,
  className = "",
  mirrored = true,
  gesture = "none",
  width = 320,
  height = 240,
}: CameraPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Draw hand visualization on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size
    canvas.width = width;
    canvas.height = height;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw video frame
    if (video.readyState >= 2) {
      ctx.save();
      if (mirrored) {
        ctx.scale(-1, 1);
        ctx.drawImage(video, -width, 0, width, height);
      } else {
        ctx.drawImage(video, 0, 0, width, height);
      }
      ctx.restore();
    }

    // Draw hand skeleton
    if (showHand && landmarks && landmarks.length > 0) {
      const lm = mirrored ? landmarks.map((l) => ({ ...l, x: 1 - l.x })) : landmarks;

      // Draw connections
      ctx.strokeStyle = "rgba(0, 255, 0, 0.8)";
      ctx.lineWidth = 2;

      for (const [start, end] of HAND_CONNECTIONS) {
        ctx.beginPath();
        ctx.moveTo(lm[start].x * width, lm[start].y * height);
        ctx.lineTo(lm[end].x * width, lm[end].y * height);
        ctx.stroke();
      }

      // Draw landmarks
      const tipIndices = [4, 8, 12, 16, 20]; // Thumb tip, index tip, etc.
      for (let i = 0; i < lm.length; i++) {
        const x = lm[i].x * width;
        const y = lm[i].y * height;

        ctx.beginPath();
        ctx.arc(x, y, tipIndices.includes(i) ? 5 : 3, 0, Math.PI * 2);
        ctx.fillStyle = tipIndices.includes(i) ? "#ff4444" : "#ffffff";
        ctx.fill();
      }
    }

    // Draw gesture indicator
    if (gesture !== "none") {
      const gestureColor =
        gesture === "open" ? "#00ff00" : gesture === "fist" ? "#ff8800" : "#888888";
      const gestureText = gesture === "open" ? "张开" : gesture === "fist" ? "握拳" : "过渡";

      ctx.font = "bold 16px sans-serif";
      ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
      ctx.fillRect(8, 8, 80, 28);
      ctx.fillStyle = gestureColor;
      ctx.fillText(gestureText, 14, 28);
    }
  }, [videoRef, landmarks, showHand, mirrored, gesture, width, height]);

  return (
    <div
      className={className}
      style={{
        position: "relative",
        width,
        height,
        borderRadius: 8,
        overflow: "hidden",
        background: "#1a1a1a",
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: "100%",
          height: "100%",
          display: "block",
        }}
      />
    </div>
  );
}

interface VirtualCursorProps {
  x: number;
  y: number;
  gesture: "open" | "fist" | "trans" | "none";
  size?: number;
}

export function VirtualCursor({ x, y, gesture, size = 40 }: VirtualCursorProps) {
  const color = gesture === "open" ? "#00ff00" : gesture === "fist" ? "#ff8800" : "#cccccc";

  return (
    <div
      style={{
        position: "absolute",
        left: x - size / 2,
        top: y - size / 2,
        width: size,
        height: size,
        pointerEvents: "none",
        zIndex: 100,
      }}
    >
      <svg viewBox="0 0 40 40" style={{ width: "100%", height: "100%" }}>
        {/* Crosshair */}
        <circle cx="20" cy="20" r="16" fill="none" stroke={color} strokeWidth="2" opacity="0.8" />
        <line x1="20" y1="2" x2="20" y2="10" stroke={color} strokeWidth="2" />
        <line x1="20" y1="30" x2="20" y2="38" stroke={color} strokeWidth="2" />
        <line x1="2" y1="20" x2="10" y2="20" stroke={color} strokeWidth="2" />
        <line x1="30" y1="20" x2="38" y2="20" stroke={color} strokeWidth="2" />
        {/* Center dot */}
        <circle cx="20" cy="20" r="3" fill={color} />
      </svg>
    </div>
  );
}

interface GestureGuideProps {
  visible: boolean;
  onClose?: () => void;
}

export function GestureGuide({ visible, onClose }: GestureGuideProps) {
  if (!visible) return null;

  return (
    <div
      style={{
        position: "absolute",
        top: 16,
        left: "50%",
        transform: "translateX(-50%)",
        background: "rgba(0, 0, 0, 0.85)",
        borderRadius: 12,
        padding: "16px 24px",
        color: "#fff",
        fontSize: 14,
        zIndex: 200,
        maxWidth: 400,
        boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
          borderBottom: "1px solid rgba(255,255,255,0.2)",
          paddingBottom: 8,
        }}
      >
        <span style={{ fontWeight: "bold", fontSize: 16 }}>手势操作指南</span>
        {onClose && (
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "#aaa",
              cursor: "pointer",
              fontSize: 18,
            }}
          >
            ×
          </button>
        )}
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span
            style={{
              background: "#00aa00",
              padding: "2px 8px",
              borderRadius: 4,
              fontSize: 12,
            }}
          >
            张开
          </span>
          <span>移动光标到食材处</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span
            style={{
              background: "#ff8800",
              padding: "2px 8px",
              borderRadius: 4,
              fontSize: 12,
            }}
          >
            握拳
          </span>
          <span>抓取光标处的食材</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span
            style={{
              background: "#ff8800",
              padding: "2px 8px",
              borderRadius: 4,
              fontSize: 12,
            }}
          >
            握拳移动
          </span>
          <span>带着食材到火锅</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span
            style={{
              background: "#00aa00",
              padding: "2px 8px",
              borderRadius: 4,
              fontSize: 12,
            }}
          >
            张开
          </span>
          <span>在火锅处松开 → 投放食材 +1 分</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span
            style={{
              background: "#00aa00",
              padding: "2px 8px",
              borderRadius: 4,
              fontSize: 12,
            }}
          >
            松手
          </span>
          <span>中途松开 → 食材放回原位</span>
        </div>
      </div>
    </div>
  );
}
