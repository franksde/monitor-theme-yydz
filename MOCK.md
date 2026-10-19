# 带假数据的本地预览

主题源码来自 kiusnax/monitor-theme-yydz v1.0.5（MIT）。`mock/hub.js` 是 monitor-probe/themes 预览站的假 hub：在浏览器里接管 `/api` 的 fetch、XHR 和 WebSocket，生成 30 个节点（含离线、过期、超长名字、分组等边界情况），每 2 秒推一次实时数据，不发任何网络请求。

```bash
npm install
npm run dev:mock      # 开发服务器，改代码即时刷新
npm run build:mock    # 构建到 dist-mock/，任意静态服务器根目录即可打开
```

构建后用 `npx vite preview --outDir dist-mock` 打开 http://localhost:4173/ 。
不带 MOCK 的 `npm run dev` / `npm run build` 和原主题行为一致（连真实 hub）。

UI 代码在 `src/components/`，样式在 `src/index.css`（Tailwind 4）。要保持的契约：只读 `/api/me`、`/api/nodes`、`/api/nodes/{id}/metrics`、`/api/themes/{short}/config`、`/api/ws` 这几个公开接口，字段形状见 `src/lib/api.ts` 和 `mock/hub.js`。
