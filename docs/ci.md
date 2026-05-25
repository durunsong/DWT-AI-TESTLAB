# CI 检查建议

当前项目已经具备 CLI 化的基础检查，可以在任意 CI runner 中执行。

## 基础质量门禁

```bash
pnpm install --frozen-lockfile
pnpm ci:check
```

`pnpm ci:check` 会执行：

- `pnpm typecheck`
- `pnpm test`
- `pnpm dwt validate`

如果 CI runner 没有预装 Playwright 浏览器，执行真实浏览器回归前需要安装：

```bash
pnpm exec playwright install --with-deps
```

## 环境级预检

如果 CI 中配置了测试环境变量，可以追加：

```bash
pnpm dwt preflight login_user --env=sit --no-env-file
pnpm dwt preflight login_admin --env=sit --no-env-file
```

`--no-env-file` 表示只读取 CI 注入的环境变量，不读取本地 `.env*` 文件。

## Headless 回归

确认目标 runner 已安装 Playwright 浏览器后，可以执行：

```bash
pnpm dwt run login_user --env=sit --headless --no-env-file
```

建议先将 `validate` 和 `preflight` 作为必过门禁，再逐步加入真实浏览器回归。

不要在 CI 中对 `prod/production` 环境执行自动化流程。生产环境相关配置只用于构建或人工核对，不作为回归目标。
