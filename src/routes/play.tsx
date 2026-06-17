import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { BASES, CONDIMENTS, INGREDIENTS } from "@/data/hotpot";
import { Stage } from "@/components/Stage";
import { FoodGlyph, YuanyangPot } from "@/components/hotpot-art";
import { encodeSummary, type Pick, type SelectionSummary } from "@/lib/scoring";
import { loadSession, saveSession } from "@/lib/session";

type Step = "base" | "ingredients" | "sauce" | "boiling";

export const Route = createFileRoute("/play")({
  head: () => ({
    meta: [
      { title: "煮一锅 · AI 人生火锅" },
      { name: "description", content: "选锅底，下食材，加蘸料。AI 正在观察你。" },
    ],
  }),
  component: Play,
});

const serif = "'Noto Serif SC',serif";
const BOIL_LINES = ["我们已经观察你三分钟。", "你以为自己在配火锅。", "其实，你正在构建人生。"];
const TIMER_SECONDS = 120;
const C = { cx: 640, cy: 412 };

const btnPrimary: CSSProperties = {
  border: "none",
  cursor: "pointer",
  padding: "13px 46px",
  borderRadius: 6,
  background: "#b4382b",
  color: "#f4eddd",
  fontFamily: serif,
  fontWeight: 700,
  fontSize: 18,
  letterSpacing: ".18em",
  boxShadow: "0 8px 20px rgba(150,40,30,.3)",
};
const btnPrimaryOff: CSSProperties = {
  ...btnPrimary,
  background: "#c4b696",
  boxShadow: "none",
  cursor: "not-allowed",
};
const btnOutline: CSSProperties = {
  border: "1.5px solid #b09a6a",
  cursor: "pointer",
  padding: "12px 40px",
  borderRadius: 6,
  background: "transparent",
  color: "#b09a6a",
  fontFamily: serif,
  fontWeight: 700,
  fontSize: 18,
  letterSpacing: ".16em",
};

const baseById = (id: string) => BASES.find((b) => b.id === id);

function Play() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("base");
  // 鸳鸯锅:选两个锅底,第一个进左鱼,第二个进右鱼
  const [bases, setBases] = useState<string[]>([]);
  const [ings, setIngs] = useState<string[]>([]);
  const [conds, setConds] = useState<string[]>([]);
  const [secs, setSecs] = useState(TIMER_SECONDS);
  const [boilStep, setBoilStep] = useState(0);
  const picksRef = useRef<Pick[]>([]);
  const stepStartRef = useRef(Date.now());
  const orderRef = useRef(0);

  useEffect(() => {
    stepStartRef.current = Date.now();
  }, [step]);

  // 食材倒计时
  useEffect(() => {
    if (step !== "ingredients") return;
    setSecs(TIMER_SECONDS);
    const id = setInterval(() => setSecs((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [step]);

  // 沸腾逐行显现
  useEffect(() => {
    if (step !== "boiling") return;
    setBoilStep(0);
    const id = setInterval(() => setBoilStep((s) => s + 1), 1500);
    return () => clearInterval(id);
  }, [step]);

  const recordPick = (id: string) => {
    const now = Date.now();
    picksRef.current.push({
      id,
      order: orderRef.current++,
      hesitateMs: now - stepStartRef.current,
    });
    stepStartRef.current = now;
  };

  const toggleBase = (id: string) => {
    if (bases.includes(id)) {
      setBases(bases.filter((x) => x !== id));
      return;
    }
    if (bases.length >= 2) return;
    recordPick(id);
    setBases([...bases, id]);
  };
  const meatPicked = ings.filter(
    (id) => INGREDIENTS.find((i) => i.id === id)?.kind === "meat",
  ).length;
  const vegPicked = ings.length - meatPicked;

  const toggleIng = (id: string) => {
    if (ings.includes(id)) {
      setIngs(ings.filter((x) => x !== id));
      return;
    }
    const it = INGREDIENTS.find((i) => i.id === id)!;
    if (it.kind === "meat" && meatPicked >= 3) return;
    if (it.kind === "veg" && vegPicked >= 2) return;
    recordPick(id);
    setIngs([...ings, id]);
  };
  const toggleCond = (id: string) => {
    if (conds.includes(id)) {
      setConds(conds.filter((x) => x !== id));
      return;
    }
    if (conds.length >= 4) return;
    recordPick(id);
    setConds([...conds, id]);
  };

  const ingsReady = meatPicked === 3 && vegPicked === 2;
  const boilReady = boilStep >= BOIL_LINES.length + 1;
  const usedLife = ings.reduce((s, id) => s + (INGREDIENTS.find((i) => i.id === id)?.cost ?? 0), 0);
  const lifeLeft = Math.max(0, 100 - usedLife);

  const leftColor = bases[0] ? baseById(bases[0])?.color : undefined;
  const rightColor = bases[1] ? baseById(bases[1])?.color : undefined;
  const basesReady = bases.length === 2;

  const goReport = () => {
    if (!basesReady) return;
    const summary: SelectionSummary = {
      base: bases,
      ingredients: ings,
      condiments: conds,
      picks: picksRef.current,
    };
    saveSession({ ...loadSession(), ...summary });
    navigate({ to: "/report/$id", params: { id: encodeSummary(summary) } });
  };

  return (
    <Stage dark={step === "boiling"}>
      {step === "base" && (
        <BaseStep
          bases={bases}
          leftColor={leftColor}
          rightColor={rightColor}
          onPick={toggleBase}
          onNext={() => setStep("ingredients")}
        />
      )}
      {step === "ingredients" && (
        <IngStep
          ings={ings}
          meatPicked={meatPicked}
          vegPicked={vegPicked}
          leftColor={leftColor}
          rightColor={rightColor}
          secs={secs}
          lifeLeft={lifeLeft}
          ingsReady={ingsReady}
          onToggle={toggleIng}
          onNext={() => setStep("sauce")}
        />
      )}
      {step === "sauce" && (
        <SauceStep conds={conds} onToggle={toggleCond} onConfirm={() => setStep("boiling")} />
      )}
      {step === "boiling" && (
        <BoilStep
          boilStep={boilStep}
          boilReady={boilReady}
          leftColor={leftColor}
          rightColor={rightColor}
          onReport={goReport}
        />
      )}
    </Stage>
  );
}

/* ============ 锅底(选两个 → 太极双鱼) ============ */
function BaseStep({
  bases,
  leftColor,
  rightColor,
  onPick,
  onNext,
}: {
  bases: string[];
  leftColor?: string;
  rightColor?: string;
  onPick: (id: string) => void;
  onNext: () => void;
}) {
  const ring = BASES.map((b, i) => {
    const a = -Math.PI / 2 + i * ((2 * Math.PI) / 6);
    return { b, x: C.cx + 389 * Math.cos(a), y: C.cy + 190 * Math.sin(a) };
  });
  return (
    <>
      <ScreenHead
        step="第一步"
        title="择 锅 底 · 阴 阳 成 锅"
        sub={`鸳鸯各选一个 · 已选 ${bases.length}/2`}
      />
      <CenterPot size={340} left={leftColor} right={rightColor} />
      {ring.map(({ b, x, y }) => {
        const idx = bases.indexOf(b.id);
        const sel = idx >= 0;
        return (
          <div
            key={b.id}
            onClick={() => onPick(b.id)}
            style={{
              position: "absolute",
              left: x,
              top: y,
              transform: "translate(-50%,-50%)",
              width: 172,
              cursor: "pointer",
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: 96,
                height: 96,
                margin: "0 auto",
                borderRadius: "50%",
                background: "radial-gradient(circle at 50% 34%,#f6efe0,#d6c6a0 78%)",
                border: "1.5px solid rgba(90,68,42,.4)",
                boxShadow: "0 10px 22px rgba(90,70,40,.22), inset 0 2px 6px rgba(255,255,255,.55)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: "50%",
                  background: b.color,
                  boxShadow:
                    "inset 0 -6px 12px rgba(0,0,0,.25), inset 0 4px 8px rgba(255,255,255,.25)",
                }}
              />
              {sel && (
                <>
                  <div
                    style={{
                      position: "absolute",
                      inset: -6,
                      borderRadius: "50%",
                      border: "2.5px solid #b4382b",
                      boxShadow: "0 0 0 4px rgba(180,56,43,.15)",
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      right: -4,
                      top: -6,
                      width: 26,
                      height: 26,
                      borderRadius: "50%",
                      background: "#b4382b",
                      color: "#f4eddd",
                      fontSize: 14,
                      fontWeight: 700,
                      lineHeight: "26px",
                    }}
                  >
                    {idx + 1}
                  </div>
                </>
              )}
            </div>
            <div
              style={{
                marginTop: 9,
                fontFamily: serif,
                fontWeight: 700,
                fontSize: 18,
                color: "#2c2418",
                letterSpacing: ".08em",
              }}
            >
              {b.tone}
            </div>
            <div style={{ fontSize: 11, color: "#8a6a44", marginTop: 2 }}>{b.name}</div>
            <div style={{ fontSize: 11, color: "#a98f63", marginTop: 2, lineHeight: 1.4 }}>
              {b.tagline}
            </div>
          </div>
        );
      })}
      <BottomBar>
        <button
          onClick={onNext}
          disabled={bases.length < 2}
          style={bases.length === 2 ? btnPrimary : btnPrimaryOff}
        >
          下 一 步 · 配 食 材
        </button>
      </BottomBar>
    </>
  );
}

/* ============ 食材 ============ */
function IngStep({
  ings,
  meatPicked,
  vegPicked,
  leftColor,
  rightColor,
  secs,
  lifeLeft,
  ingsReady,
  onToggle,
  onNext,
}: {
  ings: string[];
  meatPicked: number;
  vegPicked: number;
  leftColor?: string;
  rightColor?: string;
  secs: number;
  lifeLeft: number;
  ingsReady: boolean;
  onToggle: (id: string) => void;
  onNext: () => void;
}) {
  const ring = INGREDIENTS.map((it, i) => {
    const a = -Math.PI / 2 + (i + 0.5) * ((2 * Math.PI) / 12);
    return { it, x: C.cx + 452 * Math.cos(a), y: C.cy + 216 * Math.sin(a) };
  });
  const mm = Math.floor(secs / 60);
  const ss = String(secs % 60).padStart(2, "0");
  return (
    <>
      <div
        style={{
          position: "absolute",
          top: 26,
          left: 0,
          right: 0,
          textAlign: "center",
          animation: "lhFade .5s ease both",
        }}
      >
        <div style={{ fontSize: 12, letterSpacing: ".5em", color: "#9a6b3a" }}>第二步</div>
        <div
          style={{
            fontFamily: serif,
            fontWeight: 700,
            fontSize: 30,
            letterSpacing: ".14em",
            color: "#2c2418",
            marginTop: 2,
          }}
        >
          配 食 材 · 涮 一 锅 人 生
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          top: 92,
          left: "50%",
          transform: "translateX(-50%)",
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontFamily: serif,
            fontWeight: 700,
            fontSize: 22,
            letterSpacing: ".12em",
            color: "#7a3228",
          }}
        >
          两分 · {mm}:{ss}
        </div>
        <div style={{ fontSize: 12, color: "#8a6a44", marginTop: 3, letterSpacing: ".1em" }}>
          三荤两素 · 荤 {meatPicked}/3 · 素 {vegPicked}/2
        </div>
      </div>

      <CenterPot size={340} left={leftColor} right={rightColor} bits={ings} />

      {ring.map(({ it, x, y }) => {
        const sel = ings.includes(it.id);
        const full =
          (it.kind === "meat" && meatPicked >= 3 && !sel) ||
          (it.kind === "veg" && vegPicked >= 2 && !sel);
        return (
          <div
            key={it.id}
            onClick={() => onToggle(it.id)}
            style={{
              position: "absolute",
              left: x,
              top: y,
              transform: "translate(-50%,-50%)",
              width: 150,
              cursor: "pointer",
              textAlign: "center",
              opacity: full ? 0.4 : 1,
              transition: "opacity .3s",
            }}
          >
            <div
              style={{
                position: "relative",
                width: 130,
                height: 92,
                margin: "0 auto",
                borderRadius: "50%",
                background: "radial-gradient(circle at 50% 34%,#f6efe0,#d6c6a0 78%)",
                border: "1.5px solid rgba(90,68,42,.4)",
                boxShadow: "0 12px 22px rgba(90,70,40,.24), inset 0 2px 6px rgba(255,255,255,.55)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div style={{ width: 58, height: 58 }}>
                <FoodGlyph name={it.food} />
              </div>
              {sel && (
                <>
                  <div
                    style={{
                      position: "absolute",
                      inset: -5,
                      borderRadius: "50%",
                      border: "2.5px solid #b4382b",
                      boxShadow: "0 0 0 4px rgba(180,56,43,.14)",
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      right: -4,
                      top: -6,
                      width: 24,
                      height: 24,
                      borderRadius: "50%",
                      background: "#b4382b",
                      color: "#f4eddd",
                      fontSize: 13,
                      lineHeight: "24px",
                    }}
                  >
                    ✓
                  </div>
                </>
              )}
            </div>
            <div
              style={{
                marginTop: 6,
                fontFamily: serif,
                fontWeight: 700,
                fontSize: 15,
                color: "#2c2418",
                letterSpacing: ".06em",
              }}
            >
              {it.name}
            </div>
            <div
              style={{
                fontSize: 10,
                color: it.kind === "meat" ? "#9a3a2c" : "#5f7a3a",
                letterSpacing: ".04em",
              }}
            >
              {it.kind === "meat" ? "荤" : "素"} · −{it.cost}人生值
            </div>
          </div>
        );
      })}

      {/* 人生值 */}
      <div style={{ position: "absolute", left: 34, bottom: 30 }}>
        <div style={{ fontSize: 11, letterSpacing: ".3em", color: "#9a6b3a" }}>人生值</div>
        <div
          style={{
            fontFamily: serif,
            fontWeight: 900,
            fontSize: 38,
            color: "#2c2418",
            lineHeight: 1,
          }}
        >
          {lifeLeft}
          <span style={{ fontSize: 15, color: "#9a6b3a" }}> /100</span>
        </div>
        <div
          style={{
            width: 170,
            height: 6,
            marginTop: 7,
            borderRadius: 3,
            background: "#cdbf9f",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${lifeLeft}%`,
              height: "100%",
              background: "#b4382b",
              transition: "width .4s ease",
            }}
          />
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: 640,
          bottom: 30,
          transform: "translateX(-50%)",
          textAlign: "center",
        }}
      >
        <button onClick={onNext} disabled={!ingsReady} style={ingsReady ? btnPrimary : btnOutline}>
          开 始 涮 人 生
        </button>
      </div>
    </>
  );
}

/* ============ 蘸料 ============ */
function SauceStep({
  conds,
  onToggle,
  onConfirm,
}: {
  conds: string[];
  onToggle: (id: string) => void;
  onConfirm: () => void;
}) {
  const bits = conds.flatMap((id, i) => {
    const s = CONDIMENTS.find((c) => c.id === id);
    if (!s) return [];
    return [0, 1, 2, 3].map((j) => {
      const a = i * 1.7 + j * 1.25;
      const r = 22 + j * 11;
      return {
        color: s.color,
        size: 7 + (j % 3) * 2,
        x: 115 + r * Math.cos(a),
        y: 115 + r * Math.sin(a),
      };
    });
  });
  return (
    <>
      <ScreenHead
        step="第三步"
        title="调 蘸 料 · 定 行 为 风 格"
        sub={`挑出你顺手的味道 · 已选 ${conds.length} 味（最多 4）`}
      />

      {/* 蘸料网格 */}
      <div
        style={{
          position: "absolute",
          left: 96,
          top: 188,
          width: 700,
          display: "grid",
          gridTemplateColumns: "repeat(5,1fr)",
          gap: "22px 18px",
        }}
      >
        {CONDIMENTS.map((s) => {
          const sel = conds.includes(s.id);
          return (
            <div
              key={s.id}
              onClick={() => onToggle(s.id)}
              style={{ cursor: "pointer", textAlign: "center" }}
            >
              <div
                style={{
                  position: "relative",
                  width: 96,
                  height: 96,
                  margin: "0 auto",
                  borderRadius: "50%",
                  background: "radial-gradient(circle at 50% 30%,#33271a,#15100a)",
                  boxShadow: "0 10px 20px rgba(0,0,0,.3), inset 0 3px 7px rgba(255,255,255,.08)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <div
                  style={{
                    width: 62,
                    height: 62,
                    borderRadius: "50%",
                    background: s.color,
                    boxShadow: "inset 0 -5px 10px rgba(0,0,0,.3)",
                  }}
                />
                {sel && (
                  <>
                    <div
                      style={{
                        position: "absolute",
                        inset: -4,
                        borderRadius: "50%",
                        border: "2.5px solid #b4382b",
                        boxShadow: "0 0 0 4px rgba(180,56,43,.14)",
                      }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        right: -2,
                        top: -4,
                        width: 24,
                        height: 24,
                        borderRadius: "50%",
                        background: "#b4382b",
                        color: "#f4eddd",
                        fontSize: 13,
                        lineHeight: "24px",
                      }}
                    >
                      ✓
                    </div>
                  </>
                )}
              </div>
              <div
                style={{
                  marginTop: 7,
                  fontFamily: serif,
                  fontWeight: 700,
                  fontSize: 15,
                  color: "#2c2418",
                }}
              >
                {s.name}
              </div>
              <div style={{ fontSize: 11, color: "#9a3a2c" }}>{s.style}</div>
            </div>
          );
        })}
      </div>

      {/* 味碟 */}
      <div style={{ position: "absolute", right: 96, top: 210, textAlign: "center" }}>
        <div
          style={{
            fontFamily: serif,
            fontSize: 15,
            color: "#5a4630",
            letterSpacing: ".2em",
            marginBottom: 16,
          }}
        >
          你 的 味 碟
        </div>
        <div
          style={{
            position: "relative",
            width: 230,
            height: 230,
            borderRadius: "50%",
            background: "radial-gradient(circle at 50% 36%,#f6efe0,#cdbb92 80%)",
            boxShadow:
              "0 18px 36px rgba(90,70,40,.3), inset 0 4px 10px rgba(255,255,255,.5), inset 0 -10px 22px rgba(120,95,55,.3)",
            margin: "0 auto",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "52%",
              transform: "translate(-50%,-50%)",
              width: 150,
              height: 150,
              borderRadius: "50%",
              background: "rgba(120,95,55,.12)",
            }}
          />
          {bits.map((d, i) => (
            <span
              key={i}
              style={{
                position: "absolute",
                left: d.x,
                top: d.y,
                width: d.size,
                height: d.size,
                borderRadius: "50%",
                background: d.color,
                boxShadow: "0 1px 3px rgba(0,0,0,.25)",
                animation: "lhDrop .5s ease both",
              }}
            />
          ))}
        </div>
        <div style={{ fontSize: 12, color: "#a98f63", marginTop: 14, minHeight: 16 }}>
          {conds.length
            ? CONDIMENTS.filter((c) => conds.includes(c.id))
                .map((c) => c.style)
                .join(" · ")
            : "至少选一味"}
        </div>
      </div>

      <BottomBar>
        <button
          onClick={onConfirm}
          disabled={conds.length < 1}
          style={conds.length ? btnPrimary : btnPrimaryOff}
        >
          选 好 了
        </button>
      </BottomBar>
    </>
  );
}

/* ============ 沸腾 ============ */
function BoilStep({
  boilStep,
  boilReady,
  leftColor,
  rightColor,
  onReport,
}: {
  boilStep: number;
  boilReady: boolean;
  leftColor?: string;
  rightColor?: string;
  onReport: () => void;
}) {
  return (
    <>
      {/* 大锅 */}
      <div
        style={{
          position: "absolute",
          left: 640,
          top: 330,
          transform: "translate(-50%,-50%)",
          width: 400,
          height: 400,
        }}
      >
        <YuanyangPot left={leftColor} right={rightColor} />
        {/* 气泡 */}
        {[
          { l: "34%", b: "30%", s: 14, d: "0s", dur: "2.2s" },
          { l: "48%", b: "26%", s: 18, d: ".4s", dur: "2.6s" },
          { l: "60%", b: "30%", s: 12, d: ".8s", dur: "2s" },
          { l: "42%", b: "34%", s: 10, d: "1.1s", dur: "2.4s" },
        ].map((b, i) => (
          <span
            key={i}
            style={{
              position: "absolute",
              left: b.l,
              bottom: b.b,
              width: b.s,
              height: b.s,
              borderRadius: "50%",
              background: "rgba(255,240,210,.6)",
              animation: `lhBub ${b.dur} ease-in ${b.d} infinite`,
            }}
          />
        ))}
        {/* 蒸汽 */}
        {[0, 1].map((i) => (
          <span
            key={i}
            style={{
              position: "absolute",
              left: i === 0 ? "42%" : "50%",
              top: "6%",
              width: i === 0 ? 120 : 170,
              height: 60,
              background:
                "radial-gradient(ellipse at 50% 100%,rgba(255,250,235,.6),transparent 70%)",
              filter: "blur(7px)",
              animation: `lhSteam ${3 + i * 0.6}s ease-in-out ${i * 0.6}s infinite`,
            }}
          />
        ))}
      </div>

      {/* AI 观察文案 */}
      <div style={{ position: "absolute", left: 0, right: 0, top: 560, textAlign: "center" }}>
        {BOIL_LINES.map((t, i) => (
          <div
            key={i}
            style={{
              fontFamily: serif,
              fontWeight: 600,
              fontSize: 27,
              letterSpacing: ".14em",
              color: "#f3e6c4",
              opacity: i < boilStep ? 1 : 0,
              transform: `translateY(${i < boilStep ? 0 : 14}px)`,
              transition: "all .8s ease",
              margin: "7px 0",
            }}
          >
            {t}
          </div>
        ))}
      </div>

      {/* 状态 / 按钮 */}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 44, textAlign: "center" }}>
        {!boilReady ? (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 12,
              color: "#caa05a",
              fontSize: 14,
              letterSpacing: ".2em",
            }}
          >
            <span
              style={{
                width: 18,
                height: 18,
                border: "2px solid rgba(202,160,90,.3)",
                borderTopColor: "#caa05a",
                borderRadius: "50%",
                animation: "lhSpin .8s linear infinite",
                display: "inline-block",
              }}
            />
            AI 正在整合你的选择…
          </div>
        ) : (
          <button
            onClick={onReport}
            style={{
              ...btnPrimary,
              border: "1.5px solid #caa05a",
              fontSize: 19,
              letterSpacing: ".18em",
              boxShadow: "0 0 26px rgba(202,160,90,.3)",
              animation: "lhFade .6s ease both",
            }}
          >
            查 看 人 生 火 锅 报 告
          </button>
        )}
      </div>
    </>
  );
}

/* ============ 共用小件 ============ */
function ScreenHead({ step, title, sub }: { step: string; title: string; sub?: string }) {
  return (
    <div
      style={{
        position: "absolute",
        top: 40,
        left: 0,
        right: 0,
        textAlign: "center",
        animation: "lhFade .5s ease both",
      }}
    >
      <div style={{ fontSize: 13, letterSpacing: ".5em", color: "#9a6b3a" }}>{step}</div>
      <div
        style={{
          fontFamily: serif,
          fontWeight: 700,
          fontSize: 34,
          letterSpacing: ".16em",
          color: "#2c2418",
          marginTop: 4,
        }}
      >
        {title}
      </div>
      <div
        style={{
          width: 90,
          height: 2,
          margin: "14px auto 0",
          background: "linear-gradient(90deg,transparent,#b4382b,transparent)",
        }}
      />
      {sub && (
        <div style={{ fontSize: 13, color: "#8a6a44", marginTop: 10, letterSpacing: ".08em" }}>
          {sub}
        </div>
      )}
    </div>
  );
}

function BottomBar({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 34, textAlign: "center" }}>
      {children}
    </div>
  );
}

function CenterPot({
  size,
  left,
  right,
  bits,
}: {
  size: number;
  left?: string;
  right?: string;
  bits?: string[];
}) {
  return (
    <>
      <div
        style={{
          position: "absolute",
          left: C.cx,
          top: 400,
          transform: "translate(-50%,-50%)",
          width: size,
          height: size,
        }}
      >
        <YuanyangPot left={left} right={right} />
        {bits && bits.length > 0 && (
          <>
            {bits.map((id, i) => {
              const it = INGREDIENTS.find((x) => x.id === id);
              if (!it) return null;
              const a = i * 1.3;
              const r = 40 + (i % 3) * 14;
              return (
                <span
                  key={id}
                  style={{
                    position: "absolute",
                    left: `calc(50% + ${r * Math.cos(a)}px)`,
                    top: `calc(48% + ${r * Math.sin(a)}px)`,
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    background: it.tint,
                    boxShadow: "0 2px 4px rgba(0,0,0,.3)",
                    transform: "translate(-50%,-50%)",
                    animation: "lhDrop .6s ease both",
                  }}
                />
              );
            })}
          </>
        )}
      </div>
      {/* 蒸汽 */}
      <div
        style={{
          position: "absolute",
          left: 640,
          top: 235,
          transform: "translateX(-50%)",
          width: 120,
          height: 46,
          background: "radial-gradient(ellipse at 50% 100%,rgba(255,255,255,.6),transparent 70%)",
          filter: "blur(5px)",
          animation: "lhSteam 3.4s ease-in-out infinite",
          pointerEvents: "none",
        }}
      />
    </>
  );
}
