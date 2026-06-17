import { createFileRoute, Link } from "@tanstack/react-router";
import type { CSSProperties } from "react";
import { Stage } from "@/components/Stage";
import { YuanyangPot } from "@/components/hotpot-art";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AI 人生火锅 · Life Hotpot" },
      { name: "description", content: "你以为自己在配火锅，其实你正在构建人生。" },
      { property: "og:title", content: "AI 人生火锅" },
      { property: "og:description", content: "你以为自己在配火锅，其实你正在构建人生。" },
    ],
  }),
  component: Index,
});

const serif = "'Noto Serif SC',serif";

const cta: CSSProperties = {
  display: "inline-block",
  border: "none",
  cursor: "pointer",
  padding: "16px 56px",
  borderRadius: 6,
  background: "#b4382b",
  color: "#f4eddd",
  fontFamily: serif,
  fontWeight: 700,
  fontSize: 22,
  letterSpacing: ".2em",
  boxShadow: "0 10px 24px rgba(150,40,30,.4)",
  textDecoration: "none",
};

function Steam() {
  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: -28,
        transform: "translateX(-50%)",
        display: "flex",
        gap: 12,
        pointerEvents: "none",
      }}
    >
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          style={{
            display: "block",
            width: 12,
            height: 90,
            borderRadius: 8,
            background: "rgba(255,255,255,.5)",
            filter: "blur(6px)",
            animation: `lhSteam ${2.6 + i * 0.3}s ease-out ${i * 0.4}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

function Index() {
  return (
    <Stage>
      {/* 顶部标题 */}
      <div
        style={{
          position: "absolute",
          top: 96,
          left: 0,
          right: 0,
          textAlign: "center",
          animation: "lhFade .6s ease both",
        }}
      >
        <div
          style={{
            fontFamily: serif,
            fontWeight: 900,
            fontSize: 66,
            letterSpacing: ".1em",
            color: "#2c2418",
          }}
        >
          AI 人生火锅
        </div>
        <div style={{ fontSize: 15, letterSpacing: ".5em", color: "#9a6b3a", marginTop: 10 }}>
          你 的 人 生 · 由 你 来 涮
        </div>
        <div
          style={{
            width: 90,
            height: 2,
            margin: "18px auto 0",
            background: "linear-gradient(90deg,transparent,#b4382b,transparent)",
          }}
        />
      </div>

      {/* 居中鸳鸯锅 */}
      <div
        style={{
          position: "absolute",
          left: 640,
          top: 410,
          transform: "translate(-50%,-50%)",
          width: 300,
          height: 300,
          animation: "lhFade .8s ease both",
        }}
      >
        <Steam />
        <YuanyangPot />
      </div>

      {/* tagline */}
      <div
        style={{
          position: "absolute",
          top: 600,
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: serif,
          fontSize: 22,
          letterSpacing: ".12em",
          color: "#5a4630",
        }}
      >
        你以为在配火锅，其实，你正在构建人生。
      </div>

      {/* CTA */}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 64, textAlign: "center" }}>
        <Link to="/capture" style={cta}>
          开 始 · 煮 一 锅 人 生
        </Link>
        <div style={{ marginTop: 16, fontSize: 12, letterSpacing: ".15em", color: "#a98f63" }}>
          选 1 个锅底 · 三荤两素 · 1–4 种蘸料 · AI 会观察你的每一次犹豫
        </div>
      </div>
    </Stage>
  );
}
