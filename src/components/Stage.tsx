// 固定 1280×720 画布,等比缩放铺满视口(大屏/kiosk 视角,1:1 还原设计稿)。
// 移植自 LifeHotpot.dc.html 的 fit() 缩放逻辑 + 米黄宣纸板。

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";

const BOARD_W = 1280;
const BOARD_H = 720;

export function Stage({ children, dark = false }: { children: ReactNode; dark?: boolean }) {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / BOARD_W, window.innerHeight / BOARD_H));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  const outerBg = dark
    ? "radial-gradient(circle at 50% 42%,#241a10,#100b06)"
    : "radial-gradient(circle at 50% 40%,#241a10,#120c06)";
  const boardBg = dark
    ? "radial-gradient(circle at 50% 42%,#241a10,#100b06)"
    : "radial-gradient(125% 105% at 50% 12%,#f4eddd 0%,#ece1c9 52%,#ddd0b1 100%)";

  const outer: CSSProperties = {
    position: "fixed",
    inset: 0,
    background: outerBg,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    fontFamily: "'Noto Sans SC',system-ui,sans-serif",
  };
  const board: CSSProperties = {
    width: BOARD_W,
    height: BOARD_H,
    transform: `scale(${scale})`,
    transformOrigin: "center center",
    position: "relative",
    flex: "none",
    background: boardBg,
    boxShadow: "0 30px 90px rgba(0,0,0,.6)",
    overflow: "hidden",
    color: "#2c2418",
  };

  return (
    <div style={outer}>
      <div style={board}>
        {!dark && (
          <>
            {/* 纸点纹理 */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                backgroundImage: "radial-gradient(rgba(120,95,60,.05) 1px,transparent 1.5px)",
                backgroundSize: "7px 7px",
                pointerEvents: "none",
              }}
            />
            {/* 底部墨韵 */}
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 0,
                height: 200,
                background:
                  "radial-gradient(130% 130% at 50% 140%,rgba(58,42,26,.16),transparent 70%)",
                pointerEvents: "none",
              }}
            />
          </>
        )}
        {children}
      </div>
    </div>
  );
}
