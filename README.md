# AI 人生火锅 · Life Hotpot

> 你以为自己在配火锅，其实你正在构建人生。

一个把"人生选择"隐喻成"配火锅"的互动 Web 体验：选锅底、下食材、调蘸料，AI 观察你的一连串选择，解读你的价值观与人生倾向，生成一份专属的「人生火锅报告」。

🌐 **在线体验**：<https://ai-life-hotpot.guanhongli1921.workers.dev>

面向「抖音 AI 创变者黑客松」的现场互动装置 / Web Demo。完整产品文档见 [`doc/PRD.md`](doc/PRD.md)。

---

## 玩法（核心流程）

1. **择锅底** — 选一个或多个锅底，映射人生底色（热烈 / 稳定 / 清醒 / 冒险 / 治愈 / 自由）。
2. **配食材** — 荤素自便，映射你愿意投入的人生资源，换算进"100 金币人生分配"。
3. **调蘸料** — 想加几味加几味，映射你的行为风格（直接 / 谨慎 / 浪漫 / 强势 / 随性 …）。
4. **火锅沸腾** — AI「观察」你的选择过程，整合成人生叙事。
5. **人生火锅报告** — 命运口味、金币分配（财富 / 爱情 / 自由 / 家庭 / 梦想）、人生故事 + 可扫码保存的分享卡片。

> **设计取向**：三个环节都**不限数量、允许一个都不选**——「不选」本身也是一种选择。

报告地址（`/report/<编码>`）是公网可访问链接，可截图、扫码、转发分享。

## 技术栈

- **框架**：TanStack Start（SSR）+ React 19 + TanStack Router
- **构建**：Vite 8 + Nitro（`cloudflare-module` preset）
- **样式**：Tailwind CSS v4（宣纸朱红 / 太极鸳鸯锅视觉）
- **语言**：TypeScript
- **分享**：报告摘要 base64 编码进 URL + `qrcode` 生成二维码

## 本地开发

前置：Node 20+（推荐 22）。

```bash
npm install
npm run dev        # 开发服务器 http://localhost:8080
```

常用脚本：

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 本地开发 |
| `npm run build` | 生产构建（产出 `dist/`） |
| `npm run preview` | Vite 本地预览构建产物 |
| `npm run preview:cf` | 用 wrangler 本地跑 Cloudflare 构建产物 |
| `npm run deploy` | 构建 + 部署到 Cloudflare |
| `npm run lint` / `format` | 代码检查 / 格式化 |

## 部署（Cloudflare Workers）

本项目部署为 **Cloudflare Workers + 静态资源**，通过 GitHub 连接 `main` 分支自动部署：每次 `git push origin main`，Cloudflare 自动构建上线。

- Worker 名：`ai-life-hotpot`
- 构建命令（控制台）：`npm run build`
- 部署命令（控制台）：`npx wrangler deploy`
- Nitro 在构建期生成 `dist/server/wrangler.json`（worker 入口 + 静态资源绑定 `env.ASSETS`）；根目录 [`wrangler.jsonc`](wrangler.jsonc) 只设 Worker 名称与兼容日期，`main` / `assets` / `nodejs_compat` 由 Nitro 接管生成，无需手填。

### ⚠️ 关于 lockfile 的一个坑

Cloudflare 构建环境用 **node 22 / npm 10.9** 跑 `npm ci`（严格校验 lockfile 同步）。若你本地默认是 node 24 / npm 11，直接提交的 `package-lock.json` 可能让 CF 报 `package.json 与 lockfile 不同步 / Missing ...`。**改了依赖后，请用 node 22 重生 lockfile 再提交**：

```bash
nvm use 22
rm -rf node_modules package-lock.json && npm install
```

## 项目结构

```
src/
├─ routes/            # 文件路由
│  ├─ index.tsx       # 首页
│  ├─ play.tsx        # 配火锅主流程（锅底 → 食材 → 蘸料 → 沸腾）
│  └─ report.$id.tsx  # 人生火锅报告页（$id 为 base64 编码的选择摘要）
├─ components/        # Stage、hotpot-art（鸳鸯锅 / 食材绘制）等
├─ lib/
│  ├─ scoring.ts      # 100 金币人生分配算法 + URL 编解码
│  ├─ mockReport.ts   # 报告生成（当前为确定性模板，待接真实 AI）
│  └─ session.ts      # 本地会话存储
├─ data/hotpot.ts     # 锅底 / 食材 / 蘸料数据 + 五维权重
└─ styles.css         # Tailwind v4 + 自定义主题
doc/PRD.md            # 产品需求文档
```

## 状态与待办

- ✅ 完整体验闭环：选锅底 / 食材 / 蘸料 → 沸腾 → 报告 → 扫码分享。
- ✅ Cloudflare Workers 部署 + GitHub `main` 自动部署。
- 🚧 **AI 报告**：当前 [`src/lib/mockReport.ts`](src/lib/mockReport.ts) 是**确定性模板**（按金币分配拼接叙事），尚未接入真实大模型。PRD 要求最终接入真实 AI（见 `doc/PRD.md` §12.3），生成接口已抽好，便于替换。
- 🚧 开场拍照 / 人物特征提取、隔空手势识别属于线下装置形态目标；Web Demo 当前以点击 / 触摸交互为主（PRD §7.1 中的鼠标兜底模式）。
