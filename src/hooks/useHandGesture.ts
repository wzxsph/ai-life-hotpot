/**
 * Hand Gesture Recognition Hook
 *
 * Uses MediaPipe Tasks Vision for hand detection and custom gesture recognition.
 *
 * Gesture Detection Logic (from hotpot_demo.py):
 * - 4 non-thumb fingertips y < PIP y → finger extended
 * - Thumb: |TIP.x - INDEX_MCP.x| > 0.08 → thumb extended
 * - n_open >= 4 → "open" (五指张开)
 * - n_open <= 1 → "fist" (握拳)
 * - otherwise → "trans" (过渡状态)
 *
 * Gameplay:
 * - 五指张开 → 移动光标到食材处
 * - 握拳 → 抓取光标处的食材（食材变高亮，跟随光标）
 * - 握拳移动 → 带着食材到火锅
 * - 五指张开（在火锅处）→ 投放！+1 分，食材重新生成
 * - 中途松手（不在火锅处）→ 食材放回原位
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  HandLandmarker,
  type HandLandmarkerResult,
  FilesetResolver,
} from "@mediapipe/tasks-vision";

// MediaPipe model path - use CDN for web compatibility
const MODEL_BASE_URL = "https://storage.googleapis.com/mediapipe-models";

// Gesture detection parameters (from Python demo)
const GESTURE_BUF = 5; // Majority voting window size
const GRAB_R = 55; // Grab distance (cursor center to food center)
const DROP_R = 105; // Drop distance (cursor center to hotpot center) = HOTPOT_R(95) + 10

// Gesture state
export type GestureState = "open" | "fist" | "trans" | "none";

// Hand landmark indices for gesture detection
const FINGER_TIPS = [8, 12, 16, 20]; // Index, Middle, Ring, Little finger tips
const FINGER_PIPS = [6, 10, 14, 18]; // Corresponding PIP joints
const THUMB_TIP = 4;
const INDEX_MCP = 5;

export interface HandPosition {
  x: number; // Normalized 0-1
  y: number; // Normalized 0-1
}

export interface HandGestureResult {
  gesture: GestureState;
  rawGesture: GestureState;
  handPosition: HandPosition | null;
  handedness: "Left" | "Right" | null;
  landmarks: HandLandmarkerResult["landmarks"][0] | null;
}

// Detect gesture from hand landmarks
function detectGesture(landmarks: HandLandmarkerResult["landmarks"][0]): {
  gesture: GestureState;
  rawGesture: GestureState;
} {
  // Check if 4 non-thumb fingers are extended
  const fingerStates = FINGER_TIPS.map((tip, i) => {
    const pip = FINGER_PIPS[i];
    // Finger is extended if tip y < pip y - threshold (y decreases upward)
    return landmarks[tip].y < landmarks[pip].y - 0.02;
  });

  // Check thumb (extended if tip x is far from index MCP x)
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

    // Count occurrences
    const cnt: Record<string, number> = {};
    for (const x of this.buf) {
      cnt[x] = (cnt[x] || 0) + 1;
    }

    // Majority vote with priority for "open" and "fist"
    for (const key of ["open", "fist"] as const) {
      if ((cnt[key] || 0) >= 3) {
        return key;
      }
    }

    // Return most common
    return this.buf[this.buf.length - 1];
  }

  reset() {
    this.buf = [];
  }
}

export interface UseHandGestureOptions {
  /** Camera element to use for hand detection */
  videoRef?: React.RefObject<HTMLVideoElement | null>;
  /** Callback when gesture state changes */
  onGestureChange?: (result: HandGestureResult) => void;
  /** Running state */
  running: boolean;
  /** Camera facing mode */
  facingMode?: "user" | "environment";
  /** Enable/disable gesture detection */
  enabled?: boolean;
}

export interface UseHandGestureReturn {
  /** Current gesture result */
  result: HandGestureResult;
  /** Hand detector instance */
  detector: HandLandmarker | null;
  /** Loading state */
  isLoading: boolean;
  /** Error if any */
  error: Error | null;
  /** Camera has been requested */
  hasPermission: boolean;
  /** Request camera permission */
  requestCamera: () => Promise<boolean>;
  /** Stop detection */
  stop: () => void;
  /** Start detection */
  start: () => void;
  /** Reset gesture filter */
  resetFilter: () => void;
}

export function useHandGesture({
  videoRef,
  onGestureChange,
  running = false,
  facingMode = "user",
  enabled = true,
}: UseHandGestureOptions): UseHandGestureReturn {
  const [result, setResult] = useState<HandGestureResult>({
    gesture: "none",
    rawGesture: "none",
    handPosition: null,
    handedness: null,
    landmarks: null,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [hasPermission, setHasPermission] = useState(false);

  const detectorRef = useRef<HandLandmarker | null>(null);
  const gFilterRef = useRef<GestureFilter>(new GestureFilter(GESTURE_BUF));
  const animationFrameRef = useRef<number>(0);
  const videoRef_current = useRef<HTMLVideoElement | null>(null);

  // Initialize detector
  const initDetector = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm",
      );

      const detector = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numHands: 1, // Track only one hand for simplicity
      });

      detectorRef.current = detector;
      setIsLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to initialize hand detector"));
      setIsLoading(false);
    }
  }, []);

  // Process frame and detect hand
  const processFrame = useCallback(() => {
    if (!detectorRef.current || !videoRef_current.current || !enabled) {
      if (enabled) {
        animationFrameRef.current = requestAnimationFrame(processFrame);
      }
      return;
    }

    const video = videoRef_current.current;
    if (video.readyState < 2) {
      animationFrameRef.current = requestAnimationFrame(processFrame);
      return;
    }

    const detector = detectorRef.current;
    const timestamp = performance.now();

    try {
      const result = detector.detectForVideo(video, timestamp);

      if (
        result.landmarks &&
        result.landmarks.length > 0 &&
        result.handedness &&
        result.handedness.length > 0
      ) {
        // Use right hand if available, otherwise first detected hand
        let handIndex = 0;
        const handedness = result.handedness;

        for (let i = 0; i < handedness.length; i++) {
          if (handedness[i][0]?.displayName === "Right") {
            handIndex = i;
            break;
          }
        }

        const landmarks = result.landmarks[handIndex];
        const handInfo = handedness[handIndex][0];
        const { gesture, rawGesture } = detectGesture(landmarks);

        // Apply filter
        const filteredGesture = gFilterRef.current.push(gesture);

        // Mirror x coordinate for user-facing camera (1 - x)
        const mirroredX = handInfo.displayName === "Right" ? 1 - landmarks[0].x : landmarks[0].x;

        const handResult: HandGestureResult = {
          gesture: filteredGesture,
          rawGesture,
          handPosition: { x: mirroredX, y: landmarks[0].y },
          handedness: handInfo.displayName as "Left" | "Right",
          landmarks,
        };

        setResult(handResult);
        onGestureChange?.(handResult);
      } else {
        // No hand detected
        const handResult: HandGestureResult = {
          gesture: "none",
          rawGesture: "none",
          handPosition: null,
          handedness: null,
          landmarks: null,
        };

        setResult(handResult);
        onGestureChange?.(handResult);
      }
    } catch {
      // Silently handle detection errors
    }

    if (enabled && running) {
      animationFrameRef.current = requestAnimationFrame(processFrame);
    }
  }, [enabled, running, onGestureChange]);

  // Request camera permission
  const requestCamera = useCallback(async (): Promise<boolean> => {
    try {
      // Get video element
      const video = videoRef?.current || document.createElement("video");
      if (videoRef?.current) {
        videoRef_current.current = videoRef.current;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      });

      video.srcObject = stream;
      video.playsInline = true;
      video.muted = true;

      await new Promise<void>((resolve, reject) => {
        if (!videoRef_current.current) {
          videoRef_current.current = video as HTMLVideoElement;
        }
        videoRef_current.current!.onloadedmetadata = () => {
          videoRef_current.current!.play().then(resolve).catch(reject);
        };
        videoRef_current.current!.onerror = reject;
      });

      setHasPermission(true);
      return true;
    } catch {
      setHasPermission(false);
      return false;
    }
  }, [videoRef, facingMode]);

  // Start detection
  const start = useCallback(() => {
    if (detectorRef.current && hasPermission) {
      gFilterRef.current.reset();
      processFrame();
    }
  }, [hasPermission, processFrame]);

  // Stop detection
  const stop = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
  }, []);

  // Reset filter
  const resetFilter = useCallback(() => {
    gFilterRef.current.reset();
  }, []);

  // Initialize detector on mount
  useEffect(() => {
    initDetector();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (detectorRef.current) {
        detectorRef.current.close();
      }
    };
  }, [initDetector]);

  // Auto-start when running and has permission
  useEffect(() => {
    if (running && hasPermission && !isLoading) {
      start();
    } else if (!running) {
      stop();
    }

    return () => {
      if (!running) {
        stop();
      }
    };
  }, [running, hasPermission, isLoading, start, stop]);

  // Update video ref
  useEffect(() => {
    if (videoRef?.current) {
      videoRef_current.current = videoRef.current;
    }
  }, [videoRef]);

  return {
    result,
    detector: detectorRef.current,
    isLoading,
    error,
    hasPermission,
    requestCamera,
    stop,
    start,
    resetFilter,
  };
}

// Game state machine for hotpot gesture interaction
export interface GameFood {
  id: string;
  x: number;
  y: number;
  originX: number;
  originY: number;
  name: string;
  food: string;
  kind: "meat" | "veg";
}

export type GameState = "IDLE" | "GRABBED";

export interface GestureGameState {
  state: GameState;
  score: number;
  grabbedFoodIndex: number | null;
  cursorX: number;
  cursorY: number;
  feedback: string;
  feedbackTime: number;
}

export interface GestureGameActions {
  onGesture: (gesture: GestureState, cursorX: number, cursorY: number) => void;
  updateCursor: (targetX: number, targetY: number) => void;
  getFoods: () => GameFood[];
  getState: () => GestureGameState;
  reset: () => void;
}

interface UseGestureGameOptions {
  /** Game area width */
  gameWidth: number;
  /** Game area height */
  gameHeight: number;
  /** Hotpot center X */
  hotpotX: number;
  /** Hotpot center Y */
  hotpotY: number;
  /** Hotpot radius */
  hotpotRadius: number;
  /** Initial foods */
  initialFoods: GameFood[];
  /** Callback when score changes */
  onScoreChange?: (score: number) => void;
  /** Callback when food is grabbed */
  onFoodGrabbed?: (food: GameFood) => void;
  /** Callback when food is dropped */
  onFoodDropped?: (food: GameFood, success: boolean) => void;
}

export function useGestureGame({
  gameWidth,
  gameHeight,
  hotpotX,
  hotpotY,
  hotpotRadius,
  initialFoods,
  onScoreChange,
  onFoodGrabbed,
  onFoodDropped,
}: UseGestureGameOptions): GestureGameActions {
  const [gameState, setGameState] = useState<GestureGameState>({
    state: "IDLE",
    score: 0,
    grabbedFoodIndex: null,
    cursorX: gameWidth / 2,
    cursorY: gameHeight / 2,
    feedback: "",
    feedbackTime: 0,
  });

  const foodsRef = useRef<GameFood[]>(initialFoods.map((f) => ({ ...f })));
  const stateRef = useRef<GameGameState>({
    state: "IDLE" as GameState,
    score: 0,
    grabbedFoodIndex: null,
    cursorX: gameWidth / 2,
    cursorY: gameHeight / 2,
    feedback: "",
    feedbackTime: 0,
  });

  // Keep ref in sync
  useEffect(() => {
    stateRef.current = gameState;
  }, [gameState]);

  // Update cursor with smoothing
  const updateCursor = useCallback(
    (targetX: number, targetY: number) => {
      const alpha = 0.45; // Smoothing factor from Python demo
      const newX = Math.round(stateRef.current.cursorX * (1 - alpha) + targetX * alpha);
      const newY = Math.round(stateRef.current.cursorY * (1 - alpha) + targetY * alpha);

      // Clamp to game bounds
      const clampedX = Math.max(20, Math.min(gameWidth - 20, newX));
      const clampedY = Math.max(20, Math.min(gameHeight - 20, newY));

      setGameState((prev) => ({
        ...prev,
        cursorX: clampedX,
        cursorY: clampedY,
      }));
    },
    [gameWidth, gameHeight],
  );

  // Handle gesture event
  const onGesture = useCallback(
    (gesture: GestureState, cursorX: number, cursorY: number) => {
      setGameState((prev) => {
        const newState = { ...prev };

        if (prev.state === "IDLE") {
          // Try to grab food on fist gesture
          if (gesture === "fist") {
            // Find food within grab radius
            const grabRadius = GRAB_R;
            let grabbedIndex = -1;
            let closestDist = Infinity;

            foodsRef.current.forEach((food, i) => {
              const dist = Math.hypot(cursorX - food.x, cursorY - food.y);
              if (dist < grabRadius && dist < closestDist) {
                grabbedIndex = i;
                closestDist = dist;
              }
            });

            if (grabbedIndex >= 0) {
              newState.state = "GRABBED";
              newState.grabbedFoodIndex = grabbedIndex;
              // Move food to cursor
              foodsRef.current[grabbedIndex] = {
                ...foodsRef.current[grabbedIndex],
                x: cursorX,
                y: cursorY,
              };
              onFoodGrabbed?.(foodsRef.current[grabbedIndex]);
            }
          }
        } else if (prev.state === "GRABBED") {
          // Handle grabbed state
          if (gesture === "open") {
            // Check if cursor is over hotpot
            const distToHotpot = Math.hypot(cursorX - hotpotX, cursorY - hotpotY);
            const dropRadius = hotpotRadius + 10;

            const grabbedFood = foodsRef.current[prev.grabbedFoodIndex!];
            onFoodDropped?.(grabbedFood, distToHotpot < dropRadius);

            if (distToHotpot < dropRadius) {
              // Successful drop - score!
              newState.score = prev.score + 1;
              newState.feedback = `+1 入锅！得分 ${newState.score}`;
              newState.feedbackTime = Date.now();
              onScoreChange?.(newState.score);

              // Respawn food at new random position
              const newPos = spawnFoodPosition();
              foodsRef.current[prev.grabbedFoodIndex!] = {
                ...grabbedFood,
                x: newPos.x,
                y: newPos.y,
                originX: newPos.x,
                originY: newPos.y,
              };
            } else {
              // Release food back to origin
              newState.feedback = "松开 → 返回原位";
              newState.feedbackTime = Date.now();
              foodsRef.current[prev.grabbedFoodIndex!] = {
                ...grabbedFood,
                x: grabbedFood.originX,
                y: grabbedFood.originY,
              };
            }

            newState.state = "IDLE";
            newState.grabbedFoodIndex = null;
          } else {
            // Keep food following cursor
            const grabbedFood = foodsRef.current[prev.grabbedFoodIndex!];
            foodsRef.current[prev.grabbedFoodIndex!] = {
              ...grabbedFood,
              x: cursorX,
              y: cursorY,
            };
          }
        }

        return newState;
      });
    },
    [hotpotX, hotpotY, hotpotRadius, onScoreChange, onFoodGrabbed, onFoodDropped],
  );

  // Spawn food at random position (avoiding hotpot area)
  const spawnFoodPosition = useCallback(() => {
    const margin = 80;
    const minDistFromHotpot = hotpotRadius + 60;

    for (let attempt = 0; attempt < 60; attempt++) {
      const x = margin + Math.random() * (gameWidth / 2 - margin - 60);
      const y = margin + Math.random() * (gameHeight - margin * 2);
      const dist = Math.hypot(x - hotpotX, y - hotpotY);

      if (dist > minDistFromHotpot) {
        return { x, y };
      }
    }

    return { x: 100, y: 100 };
  }, [gameWidth, gameHeight, hotpotX, hotpotY, hotpotRadius]);

  // Get current foods
  const getFoods = useCallback(() => foodsRef.current, []);

  // Get current state
  const getState = useCallback(() => stateRef.current, []);

  // Reset game
  const reset = useCallback(() => {
    foodsRef.current = initialFoods.map((f) => ({ ...f }));
    setGameState({
      state: "IDLE",
      score: 0,
      grabbedFoodIndex: null,
      cursorX: gameWidth / 2,
      cursorY: gameHeight / 2,
      feedback: "",
      feedbackTime: 0,
    });
    onScoreChange?.(0);
  }, [initialFoods, gameWidth, gameHeight, onScoreChange]);

  return {
    onGesture,
    updateCursor,
    getFoods,
    getState,
    reset,
  };
}

// Fix: rename state type to avoid conflict
type GameGameState = GestureGameState;
