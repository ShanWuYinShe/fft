# fft · 镇澜（wave-warden）

单页塔防小游戏，Vite + TypeScript，无框架；仓库只有一个包 `wave-warden/`。

## 目录

- `wave-warden/` —— 游戏源码（`src/`）、`index.html`、`package.json`、`tsconfig.json`
- `.github/workflows/ci.yml` —— CI 流水线

## 开发与运行

```bash
cd wave-warden
npm ci
npm run dev       # 开发服务器
npm run build     # tsc --noEmit + vite build 到 dist/
npm run preview   # 预览构建产物
```

## CI 门禁与本地验证分工

重活（依赖安装、全量构建）一律交给 GitHub Actions，本地只跑秒级检查。
完整流程见全局 skill `github-ci-flow`：开发分支推送 → `gh pr create` → `gh pr checks --watch`
全绿 → `gh pr merge --rebase --delete-branch` → 本地 `git pull --ff-only` 并清理 worktree。

- 本地（提交前，秒级）：`cd wave-warden && npx tsc --noEmit`（全量类型检查，实测约 1s）
- CI 覆盖（`.github/workflows/ci.yml`，job `wave-warden (Vite build)`）：`npm ci` + `npm run build`（`tsc --noEmit` 类型检查 + `vite build` 构建），push main 与 PR 均触发
- CI 覆盖不到、必须本地/真机验证的：无
- 发版/发布门禁不变：部署到 `game.chaoset.com/wave-warden/` 前需本地按子路径构建
  `npm run build -- --base=/wave-warden/` 并 rsync 到 `workwork-server`（见 `wave-warden/README.md`），发布前照旧执行
