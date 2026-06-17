import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { decodeSummary } from "@/lib/scoring";
import { buildReport } from "@/lib/mockReport";
import { DIM_LABEL } from "@/data/hotpot";
import { loadSession } from "@/lib/session";

export const Route = createFileRoute("/report/$id")({
  head: ({ params }) => ({
    meta: [
      { title: "我的人生火锅 · AI Life Hotpot" },
      { name: "description", content: `这是一份由 AI 解读的人生火锅报告 (${params.id.slice(0, 8)})。` },
      { property: "og:title", content: "我的人生火锅报告" },
      { property: "og:description", content: "你以为自己在配火锅，其实你正在构建人生。" },
    ],
  }),
  component: Report,
  notFoundComponent: () => <ReportError />,
});

function ReportError() {
  return (
    <div className="bg-noise grid min-h-screen place-items-center px-6 text-center text-amber-100">
      <div>
        <h1 className="text-2xl font-bold">这锅没找到</h1>
        <p className="mt-2 text-amber-100/60">链接可能不完整。</p>
        <Link to="/" className="mt-6 inline-block rounded-full bg-primary px-6 py-2 font-bold text-primary-foreground">重新开始</Link>
      </div>
    </div>
  );
}

function Report() {
  const { id } = Route.useParams();
  const summary = useMemo(() => decodeSummary(id), [id]);
  const [qr, setQr] = useState<string | null>(null);
  const [photo, setPhoto] = useState<string | undefined>();

  useEffect(() => {
    const s = loadSession();
    setPhoto(s.photo);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = window.location.href;
    QRCode.toDataURL(url, { width: 320, margin: 1, color: { dark: "#2a1810", light: "#f5e6c8" } })
      .then(setQr)
      .catch(() => setQr(null));
  }, [id]);

  if (!summary || !summary.base) return <ReportError />;
  const report = useMemo(() => buildReport(summary), [summary]);

  return (
    <div className="bg-noise min-h-screen px-4 py-10 sm:px-8">
      <div className="mx-auto max-w-3xl">
        <header className="mb-6 text-center">
          <p className="text-xs tracking-[0.4em] text-amber-200/70">AI 人生火锅 · REPORT</p>
          <h1 className="text-glow-gold mt-3 text-4xl font-black text-amber-100 sm:text-5xl">
            {report.flavor}
          </h1>
          <p className="mt-3 text-amber-100/70">— 这是属于你的命运口味 —</p>
        </header>

        <article className="overflow-hidden rounded-3xl border-2 border-amber-200/30 bg-gradient-to-b from-black/40 to-black/70 p-6 shadow-[0_30px_80px_-30px] shadow-primary sm:p-10">
          {photo && (
            <div className="mx-auto mb-6 h-24 w-24 overflow-hidden rounded-full border-2 border-secondary shadow-lg">
              <img src={photo} alt="you" className="h-full w-full object-cover" />
            </div>
          )}

          <Block label="人生锅底" value={`${report.baseName} · ${report.baseTone}`} note={report.values} />
          <Block label="核心食材" value={report.ingredientNames.join(" · ")} note={report.resources} />
          <Block label="灵魂蘸料" value={report.condimentStyles.join(" · ") || "—"} note={report.behavior} />

          <div className="mt-6">
            <p className="text-xs tracking-[0.3em] text-amber-200/60">100 金币人生分配</p>
            <div className="mt-3 space-y-2">
              {(Object.keys(report.coins) as (keyof typeof report.coins)[]).map((d) => (
                <div key={d} className="flex items-center gap-3">
                  <span className="w-10 text-sm text-amber-100/80">{DIM_LABEL[d]}</span>
                  <div className="relative h-3 flex-1 overflow-hidden rounded-full bg-black/40">
                    <div
                      className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-primary to-secondary"
                      style={{ width: `${report.coins[d]}%` }}
                    />
                  </div>
                  <span className="w-10 text-right font-mono text-sm text-amber-100">{report.coins[d]}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8 rounded-xl border border-amber-200/20 bg-black/30 p-5">
            <p className="text-xs tracking-[0.3em] text-amber-200/60">人生故事</p>
            <p className="mt-3 leading-relaxed text-amber-50">{report.story}</p>
          </div>

          <div className="mt-8 flex flex-col items-center gap-3 border-t border-amber-200/15 pt-6 sm:flex-row sm:justify-between">
            <div className="text-center sm:text-left">
              <p className="text-xs tracking-[0.3em] text-amber-200/60">扫码带走这锅</p>
              <p className="mt-1 text-sm text-amber-100/70">公网链接，分享给朋友</p>
            </div>
            {qr && <img src={qr} alt="二维码" className="h-32 w-32 rounded-md" />}
          </div>
        </article>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link to="/" className="rounded-full border border-amber-200/30 px-6 py-2 text-amber-100">再煮一锅</Link>
          <button
            onClick={() => {
              if (navigator.share) navigator.share({ title: "我的人生火锅", url: window.location.href }).catch(() => {});
              else navigator.clipboard?.writeText(window.location.href);
            }}
            className="rounded-full bg-primary px-8 py-2 font-bold text-primary-foreground"
          >分享 / 复制链接</button>
        </div>
      </div>
    </div>
  );
}

function Block({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="mb-5 border-l-2 border-secondary/70 pl-4">
      <p className="text-xs tracking-[0.3em] text-amber-200/60">{label}</p>
      <p className="mt-1 text-xl font-bold text-amber-100">{value}</p>
      <p className="mt-1 text-sm text-amber-100/70">{note}</p>
    </div>
  );
}