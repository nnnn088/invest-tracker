# 投资资产统计 · Invest Tracker

[中文](#中文) · [English](#english)

---

## 中文

个人自用的投资资产统计应用（PWA）。定期手动录入各平台、各币种的资产净值，应用按汇率统一折算，保存历史快照，计算收益与收益率，并用折线图展示变化。

**所有数据只保存在你自己设备的浏览器里（IndexedDB），不上传任何服务器，没有账号，没有后端。**

### 功能

- **录入**：按“平台 + 币种”录入金额，默认预填上一次的数值；输入时实时显示各币种合计、折算总资产和累计收益。
- **汇率**：按录入日期从欧洲央行数据（[Frankfurter API](https://frankfurter.dev)）获取，周末和节假日自动取最近一个工作日；已获取的汇率缓存在本机。离线或接口异常时，可使用最近一次缓存，或手动输入汇率。
- **本金流水**：记录转入、转出；每笔流水按发生当天的汇率折算，汇率变动带来的盈亏计入收益。
- **历史回放**：按日期查看每次快照的明细、当时汇率、各币种占比；可编辑、删除。
- **收益统计**：本月、近 3 个月、今年、近一年、全部，或自定义区间；分币种与折算口径分别计算。
- **折线图**：总资产（可叠加本金曲线）、分币种资产、收益与收益率；图上最多 31 个点，间隔随所选区间自动调整，没有记录的日期沿用前一次记录。
- **分享图片**：生成汇报长图（3 倍像素比），可选择包含的内容，支持“隐藏金额”模式（只显示收益率、占比和走势）；全部在本地渲染。
- **备份**：导出/导入完整 JSON 备份；导出快照汇总、本金流水的 CSV（UTF-8 带 BOM，Excel / Numbers 直接打开）。
- **其他**：中文 / English、深色模式、涨跌配色可切换（红涨绿跌 / 绿涨红跌）、支持添加到主屏幕并离线打开。

支持的币种：RMB、USD、GBP、HKD、EUR、JPY、KRW。

### 收益怎么算

- **期间净收益** = 期末资产 − 期初资产 − 期间净投入本金
- **期间收益率** = 期间净收益 ÷ 期间加权平均本金（每天的累计净投入本金按天取平均；平均本金 ≤ 0 时显示“—”）
- **累计收益** = 当前资产 − 累计净投入本金；**累计收益率** = 累计收益 ÷ 累计净投入本金
- 折算口径下，资产按各快照保存的汇率折算，本金按每笔流水当天的汇率折算。

### 本地运行

需要 Node.js 22.12 及以上（或 20.19 及以上）。

```bash
npm install
npm run dev
```

然后访问 <http://localhost:5173/invest-tracker/>（应用部署在 `/invest-tracker/` 子路径下）。

| 命令 | 作用 |
|---|---|
| `npm run dev` | 开发服务器 |
| `npm run build` | 类型检查并构建到 `dist/` |
| `npm run preview` | 预览构建结果 |

**演示数据**：开发模式下，某个浏览器第一次打开且没有数据时，会自动载入一套演示数据（只载入一次）。任何版本都可以在“设置 → 数据管理”里手动“载入演示数据”或“清除全部数据”。上线版本不会自动载入演示数据。

> Service Worker（离线能力、添加到主屏幕）需要 HTTPS 或 localhost；通过局域网 HTTP 地址访问时不可用。

### 部署到 GitHub Pages

仓库已包含 `.github/workflows/deploy.yml`，推送到 `main` 分支会自动构建并部署。

1. 把代码推送到 GitHub 仓库，仓库名需为 `invest-tracker`（`vite.config.ts` 中 `base` 为 `/invest-tracker/`）。
2. 仓库 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。
3. 等待 Actions 运行完成，访问 `https://<你的用户名>.github.io/invest-tracker/`。

如需改仓库名，同步修改 `vite.config.ts` 里的 `base`。

### 技术栈

Vite · React · TypeScript · Tailwind CSS · shadcn/ui（Radix UI）· Dexie（IndexedDB）· Chart.js · date-fns · html-to-image · vite-plugin-pwa

### 目录结构

```
src/
  data/        数据层：Dexie 数据库、统一的读写模块、汇率获取与缓存、备份、演示数据
  lib/         纯计算函数：收益、图表序列、CSV、分享图数据
  pages/       录入、历史、统计、本金、设置
  components/  通用组件、分享图版面、shadcn/ui 组件
  i18n/        中英文字典
public/icons/  应用图标和平台图标
```

### 说明

- 数据存在浏览器里，清除浏览器数据或更换设备会丢失，也不会在设备之间同步。请定期在“设置 → 数据管理”导出备份。
- `public/icons/platforms/` 中的平台图标取自各平台官网，商标归各自所有者，仅用于在界面中标识对应平台。
- 本应用只是对你手动录入的数据做统计，不构成任何投资建议。

---

## English

A personal investment asset tracker (PWA). You record the net value of each platform and currency from time to time; the app converts everything with exchange rates, keeps historical snapshots, calculates gains and returns, and shows the trend in charts.

**All data stays in your own device's browser (IndexedDB). Nothing is uploaded — there is no account and no backend.**

### Features

- **Entry**: enter amounts per "platform + currency", pre-filled with the previous values; totals per currency, the converted total and the cumulative gain update live as you type.
- **Exchange rates**: fetched per date from European Central Bank data ([Frankfurter API](https://frankfurter.dev)); weekends and holidays use the latest working day. Fetched rates are cached locally. When offline or the API fails, use the latest cached rates or enter rates manually.
- **Capital flows**: record money in and out; each flow is converted at the rate of its own day, so currency moves are included in gains.
- **History**: browse each snapshot with its amounts, the rates at the time and the share of each currency; edit or delete.
- **Return statistics**: this month, last 3 months, this year, last 12 months, all time, or a custom range — per currency and in the converted view.
- **Charts**: total assets (optionally with the net capital line), assets per currency, and gains / returns. At most 31 points per chart; the spacing adapts to the selected period, and dates without a record reuse the previous record.
- **Share image**: a long report image (3× pixel ratio) with selectable sections and a "hide amounts" mode (returns, shares and trend only), rendered entirely on your device.
- **Backup**: export / import a full JSON backup; export CSVs of snapshots and capital flows (UTF-8 with BOM, opens correctly in Excel / Numbers).
- **More**: Chinese / English, dark mode, switchable gain/loss colors (red-up or green-up), installable to the home screen with offline support.

Supported currencies: RMB, USD, GBP, HKD, EUR, JPY, KRW.

### How returns are calculated

- **Period gain** = closing assets − opening assets − net capital added in the period
- **Period return** = period gain ÷ time-weighted average capital (the cumulative net capital of each day, averaged by day; shown as "—" when the average is ≤ 0)
- **Total gain** = current assets − net capital invested; **total return** = total gain ÷ net capital invested
- In the converted view, assets use the rates saved with each snapshot and capital uses the rate of each flow's own day.

### Run locally

Requires Node.js 22.12+ (or 20.19+).

```bash
npm install
npm run dev
```

Then open <http://localhost:5173/invest-tracker/> (the app is served under the `/invest-tracker/` sub-path).

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Type-check and build into `dist/` |
| `npm run preview` | Preview the production build |

**Demo data**: in development mode, the first time a browser opens the app with no data, a demo data set is loaded automatically (once). In any build you can use "Load demo data" or "Clear all data" under Settings → Data. The production build never loads demo data automatically.

> Service workers (offline support, install to home screen) require HTTPS or localhost; they are not available over a plain-HTTP LAN address.

### Deploy to GitHub Pages

The repository includes `.github/workflows/deploy.yml`; pushing to `main` builds and deploys automatically.

1. Push the code to a GitHub repository named `invest-tracker` (`base` in `vite.config.ts` is `/invest-tracker/`).
2. In the repository, go to **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**.
3. Wait for the Actions run to finish, then open `https://<your-username>.github.io/invest-tracker/`.

If you rename the repository, update `base` in `vite.config.ts` accordingly.

### Tech stack

Vite · React · TypeScript · Tailwind CSS · shadcn/ui (Radix UI) · Dexie (IndexedDB) · Chart.js · date-fns · html-to-image · vite-plugin-pwa

### Project structure

```
src/
  data/        Data layer: Dexie database, the single read/write module, exchange rates and cache, backup, demo data
  lib/         Pure calculations: returns, chart series, CSV, share-image data
  pages/       Entry, History, Stats, Capital, Settings
  components/  Shared components, share-report layout, shadcn/ui components
  i18n/        Chinese and English dictionaries
public/icons/  App icons and platform icons
```

### Notes

- Data lives in the browser: clearing browser data or switching devices loses it, and it is not synced between devices. Please export a backup regularly under Settings → Data.
- The platform icons in `public/icons/platforms/` come from each platform's official website. The trademarks belong to their respective owners and are used only to identify the platforms in the UI.
- The app only summarizes the numbers you enter manually and is not investment advice.
