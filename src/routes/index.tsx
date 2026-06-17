import { createFileRoute, Link } from "@tanstack/react-router";
import { HotpotStage } from "@/components/HotpotStage";

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

function Index() {
  return (
    <div className="bg-noise relative min-h-screen overflow-hidden">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center px-6 py-16 text-center">
        <p className="mb-3 text-xs tracking-[0.4em] text-amber-200/70">AI · LIFE HOTPOT</p>
        <h1 className="text-glow-gold text-5xl font-black leading-tight text-amber-100 sm:text-7xl">
          AI 人生<span className="text-primary">火锅</span>
        </h1>
        <p className="mt-6 max-w-xl text-lg text-amber-100/80">
          你以为自己在配火锅。<br />
          其实你正在构建人生。
        </p>

        <div className="my-10 w-full max-w-sm">
          <HotpotStage baseId="mala" dropped={["beef", "tofu", "lotus"]} boiling />
        </div>

        <Link
          to="/capture"
          className="inline-flex items-center justify-center rounded-full bg-primary px-10 py-4 text-lg font-bold text-primary-foreground shadow-[0_10px_40px_-10px] shadow-primary transition hover:scale-[1.03]"
          style={{ animation: "hp-pulse 2.4s ease-out infinite" }}
        >
          开始煮一锅人生 →
        </Link>

        <p className="mt-10 max-w-md text-sm text-amber-100/50">
          选 1 个锅底 · 3 荤 2 素 · 1–2 种蘸料。AI 会观察你的每一次犹豫。
        </p>
      </div>
    </div>
  );
}
