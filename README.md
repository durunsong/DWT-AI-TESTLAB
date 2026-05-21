# AI 自动化测试平台

这是一个 `Node.js + TypeScript + Playwright + YAML DSL + Fastify + React + Electron` 的自动化测试平台，用于通过标准 YAML DSL 承载 `user/admin` 双端业务流程，支持 PC 网页版和 Windows / Linux / macOS 桌面端交付。

## 模块

- `packages/shared`：类型、常量、Zod Schema、变量解析和脱敏工具。
- `packages/runner`：YAML 加载、运行上下文、Playwright 会话、Web/Visual 执行器、编排器和报告生成。
- `packages/ai-generator`：AI 生成 DSL 的 prompt、截图分析、用例草稿和校验能力。
- `apps/server`：Fastify API，提供用例管理、运行触发、运行状态、SSE、报告、日志、设置和上下文接口。
- `apps/web`：React PC 测试运行工作台。
- `apps/desktop`：Electron 桌面端，内嵌启动 Fastify API，并加载 `apps/web` 构建产物。
- `cases`：YAML 用例、定位文件和模板。

## 本地开发

安装依赖：

```bash
pnpm install
```

同时启动 API 和 Web：

```bash
pnpm dev
```

单独启动：

```bash
pnpm --filter @ai-e2e/server dev
pnpm --filter @ai-e2e/web dev
```

默认服务：

- API: `http://localhost:4300`
- Web: `http://localhost:4301`

桌面端开发模式：

```bash
pnpm desktop:dev
```

## PC 网页版打包

PC 网页版会输出静态资源到 `apps/web/dist`：

```bash
pnpm web:build
```

按环境打包：

```bash
pnpm web:build:local
pnpm web:build:dev
pnpm web:build:sit
pnpm web:build:prod
```

PC 网页版只包含前端静态资源，后端 API 需要单独启动或部署：

```bash
pnpm --filter @ai-e2e/server start
```

推荐部署方式：

- Nginx 或静态资源服务托管 `apps/web/dist`。
- 将 `/api`、`/reports`、`/screenshots`、`/traces` 反向代理到 Fastify API。
- 如果前后端不同域名，在对应 `.env*` 中配置 `VITE_API_BASE_URL=http://后端地址/api` 后重新打包。

## 桌面端打包

桌面端基于 Electron：

- 主进程启动本地 Fastify API。
- 渲染进程加载 `apps/web/dist`。
- 首次启动会把安装包内的 `cases` 和 `.env.example` 初始化到 Electron `userData/workspace`。
- 不会打包或写入本地 `.env`、`.env.local` 等敏感配置文件。

通用构建：

```bash
pnpm desktop:build
```

当前平台未压缩包：

```bash
pnpm desktop:pack
```

Windows 安装包：

```bash
pnpm desktop:dist:win
```

也可以按格式单独构建：

```bash
pnpm desktop:dist:win:exe
pnpm desktop:dist:win:msi
pnpm desktop:dist:win:portable
```

配置目标：

```text
dist/desktop/DWT Testing-1.0.1-win-x64-setup.exe
dist/desktop/DWT Testing-1.0.1-win-x64-installer.msi
dist/desktop/DWT Testing-1.0.1-win-x64-portable.exe
dist/desktop/win-unpacked/DWT Testing.exe
```

说明：

- `.exe` 安装包由 NSIS 生成。
- `.msi` 面向 Windows Installer 分发场景。
- `portable.exe` 为免安装便携版。

Linux 安装包：

```bash
pnpm desktop:dist:linux
```

也可以按格式单独构建：

```bash
pnpm desktop:dist:linux:appimage
pnpm desktop:dist:linux:deb
pnpm desktop:dist:linux:rpm
pnpm desktop:dist:linux:tar
```

配置目标：

```text
dist/desktop/DWT Testing-1.0.1-linux-x86_64.AppImage
dist/desktop/DWT Testing-1.0.1-linux-x64.tar.gz
dist/desktop/DWT Testing-1.0.1-linux-amd64.deb
dist/desktop/DWT Testing-1.0.1-linux-x86_64.rpm
```

说明：

- 建议在 Linux runner 上执行并做运行验证。
- Windows 交叉构建 Linux 包会受到符号链接权限和 `fpm` 工具链限制。
- `deb` / `rpm` 通常依赖 Linux 打包工具链，建议在 Linux CI 中产出。
- `.AppImage` 建议在 Linux runner 上构建，避免 Windows 符号链接权限问题。

macOS 安装包：

```bash
pnpm desktop:dist:mac
```

也可以按格式单独构建：

```bash
pnpm desktop:dist:mac:dmg
pnpm desktop:dist:mac:pkg
pnpm desktop:dist:mac:zip
```

配置目标：

```text
dist/desktop/DWT Testing-1.0.1-mac-*.dmg
dist/desktop/DWT Testing-1.0.1-mac-*-installer.pkg
dist/desktop/DWT Testing-1.0.1-mac-*.zip
```

说明：

- macOS 安装包需要在 macOS runner 上构建和验证。
- 当前配置未接入 Apple Developer 签名、公证和自定义图标。

## 桌面端运行数据

桌面端运行数据位于 Electron `userData/workspace` 下，常见路径如下：

```text
workspace/cases
workspace/logs
workspace/reports
workspace/screenshots
workspace/traces
workspace/uploads
workspace/.env.example
```

平台会补齐缺失的种子用例和定位文件，但不会覆盖用户已有 YAML。

## 环境变量

复制 `.env.example` 为 `.env` 后填写真实测试环境账号、密码、页面地址、AI 服务和 DB 信息。

```bash
cp .env.example .env
```

注意：

- `.env`、`.env.local`、`.env.*` 不应提交。
- 平台不会在日志和报告中明文输出敏感字段。
- `TEST_ENV` 只允许 `local`、`dev`、`test`、`sit`，`prod` 和 `production` 会被拦截。

## `${APP_BRAND_NAME}` 适配

平台默认通过 `DOWALET_USER_AUTH_FILE` 和 `DOWALET_ADMIN_AUTH_FILE` 读取 `dowalet-dev` 登录后返回数据，提取企业认证、审批审核相关路由，用于辅助完善 YAML DSL 和页面定位。

接口：

```text
GET /api/dowalet/context
GET /api/db/health
```

DB 连接信息仅放在本地 `.env`。DB 执行器只允许只读查询，并会拦截危险 SQL。

## 验证建议

基础检查：

```bash
pnpm typecheck
pnpm web:build
pnpm desktop:build
```

Windows 桌面端已验证项：

- `pnpm desktop:dist:win` 可生成 NSIS `.exe`、MSI `.msi` 和 portable `.exe`。
- `dist/desktop/win-unpacked/DWT Testing.exe` 可正常启动。
- 页面可渲染，内嵌 API `/api/cases` 返回 `200`。
- Windows runner 已验证 `pnpm --filter @ai-e2e/desktop typecheck`。

Linux / macOS 需要在对应 runner 上补充：

- Linux: `.AppImage`、`.deb`、`.rpm`、`.tar.gz` 安装包构建。
- macOS: `.dmg`、`.pkg`、`.zip` 安装包构建。
- 首次启动种子数据初始化。
- 页面渲染。
- `/api/cases`、`/api/settings/env-files`、`/api/test-runs/history` 等核心接口。
- Playwright 浏览器环境是否可用。

## 常见问题

### 桌面端空白页

通常是 Web 资源路径不兼容 `file://`。当前已通过 `base: "./"` 和桌面端 hash router 适配。

### 桌面端接口返回 400

通常是运行目录缺少 `cases/scenario` 等种子目录。当前桌面端启动时会递归补齐缺失文件，不覆盖已有用例。

### Playwright 浏览器不可用

桌面端不会默认把本机 Playwright 浏览器缓存打进安装包。目标机器需要可用的 Playwright 浏览器环境，或在后续发布流程中增加内置浏览器资源策略。

## 当前缺失的真实业务信息

- user/admin 测试账号、密码。
- 是否存在验证码或二次验证。
- KYC 页面真实入口、字段、上传文件要求。
- 审核成功后的真实文案和列表查询条件。

这些信息缺失不会影响平台骨架启动，但会影响真实 Playwright 流程跑通。
