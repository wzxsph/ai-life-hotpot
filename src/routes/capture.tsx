import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { loadSession, saveSession } from "@/lib/session";

export const Route = createFileRoute("/capture")({
  head: () => ({
    meta: [
      { title: "拍一张 · AI 人生火锅" },
      { name: "description", content: "开场拍照，AI 会从你身上读取气质与状态。" },
    ],
  }),
  component: Capture,
});

function Capture() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const navigate = useNavigate();
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: "user", width: 640, height: 480 }, audio: false })
      .then((s) => {
        if (!active) { s.getTracks().forEach((t) => t.stop()); return; }
        setStream(s);
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          videoRef.current.play().catch(() => {});
        }
      })
      .catch((e) => setError(e?.message ?? "无法打开摄像头"));
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => () => stream?.getTracks().forEach((t) => t.stop()), [stream]);

  const snap = () => {
    const v = videoRef.current;
    if (!v) return;
    const c = document.createElement("canvas");
    c.width = v.videoWidth || 640;
    c.height = v.videoHeight || 480;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.translate(c.width, 0);
    ctx.scale(-1, 1); // mirror
    ctx.drawImage(v, 0, 0, c.width, c.height);
    const url = c.toDataURL("image/jpeg", 0.7);
    setPhoto(url);
  };

  const confirm = () => {
    saveSession({ ...loadSession(), photo: photo ?? undefined });
    navigate({ to: "/play" });
  };

  const skip = () => {
    saveSession({ ...loadSession(), photo: undefined });
    navigate({ to: "/play" });
  };

  return (
    <div className="bg-noise min-h-screen px-6 py-12">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-xs tracking-[0.4em] text-amber-200/70">STEP 0 · 拍一张</p>
        <h1 className="mt-2 text-3xl font-bold text-amber-100">先让 AI 看你一眼</h1>
        <p className="mt-2 text-sm text-amber-100/60">
          AI 只读取气质、服饰与色彩印象，不识别身份。照片不会上传保存。
        </p>

        <div className="mx-auto mt-8 aspect-[4/3] w-full max-w-md overflow-hidden rounded-2xl border-2 border-amber-200/30 bg-black shadow-2xl">
          {photo ? (
            <img src={photo} alt="snap" className="h-full w-full object-cover" />
          ) : error ? (
            <div className="flex h-full items-center justify-center px-6 text-center text-sm text-amber-100/70">
              {error}。你也可以直接跳过这一步。
            </div>
          ) : (
            <video ref={videoRef} className="h-full w-full -scale-x-100 object-cover" muted playsInline />
          )}
        </div>

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {photo ? (
            <>
              <button onClick={() => setPhoto(null)} className="rounded-full border border-amber-200/40 px-6 py-2 text-amber-100">
                重拍
              </button>
              <button onClick={confirm} className="rounded-full bg-primary px-8 py-2 font-bold text-primary-foreground">
                就用这张 →
              </button>
            </>
          ) : (
            <>
              <button onClick={skip} className="rounded-full border border-amber-200/30 px-6 py-2 text-amber-100/80">
                跳过
              </button>
              <button
                onClick={snap}
                disabled={!stream}
                className="rounded-full bg-secondary px-8 py-2 font-bold text-secondary-foreground disabled:opacity-50"
              >
                📸 咔嚓
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}