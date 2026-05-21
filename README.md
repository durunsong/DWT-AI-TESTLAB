# DWT Testing

DWT Testing 是一个可定制的 AI 辅助端到端测试平台模板，使用 `Node.js + TypeScript + Playwright + YAML DSL + Fastify + React + Electron` 构建。它的目标不是把测试写死在某个业务系统里，而是让团队能快速搭建自己的测试平台，用 YAML 描述业务流程，通过统一运行器执行 Web、API、DB 只读断言，并在 Web 控制台或桌面端查看报告、日志、截图和 trace。

## 适合场景

- 把登录、审批、KYC、后台操作等长链路流程沉淀成可维护用例。
- 让业务人员和测试人员能读懂 YAML，而不是直接维护 Playwright spec。
- 同一套用例支持本地调试、CI 预检、真实浏览器回归和桌面端交付。
- 接入 OpenAI 兼容模型，根据需求文档、页面资料或失败截图辅助生成和修复用例。

## 能力概览

- YAML DSL：统一描述 session、页面定位、变量、Web 步骤、API 步骤和 DB 只读断言。
- Playwright Runner：支持多 session、截图、trace、慢放、无头/有头模式和可视化辅助执行。
- API 测试：支持状态码、业务码、响应字段断言、变量提取和复用浏览器 session cookie。
- DB 校验：只允许只读 SQL，用于关键流程后的落库核验。
- Web 控制台：用例管理、运行工作台、历史记录、报告查看、运行设置。
- 桌面端：Electron 封装，复用同一套 Web 控制台和 Fastify API。
- AI 辅助：基于 OpenAI 兼容接口生成 DSL 草稿、定位建议和失败分析。

## 项目结构

```text
apps/
  server/       Fastify API
  web/          React 控制台
  desktop/      Electron 桌面端
packages/
  shared/       公共类型、常量、Zod Schema、变量解析、脱敏工具
  runner/       YAML 加载、预检、执行器、编排器、报告生成
  ai-generator/ AI 提示词、OpenAI 兼容客户端、截图分析和 DSL 生成
cases/
  scenario/     示例 scenario YAML
  location/     页面定位 YAML
  templates/    用例模板
docs/           DSL、CI、预检、定制和扩展说明
```

## 快速开始

环境要求：

- Node.js 20+
- pnpm 9+
- Playwright 支持的浏览器环境

安装依赖：

```bash
pnpm install
```

准备本地配置：

```bash
cp .env.example .env
```

只填写你要运行的能力所需变量。真实账号、密码、token、DB 密码和 AI Key 只放在本地 `.env` 或 CI Secret 中，不要提交。平台名称、端口、桌面端窗口、上传限制、上下文来源、运行产物目录和路由关键词等非敏感定制项统一放在 `platform.config.json`。

也可以用初始化脚本生成自己的平台配置：

```bash
pnpm setup:platform --brand="你的团队" --product="你的测试平台" --user-login-url="https://example.com/user/login" --admin-login-url="https://example.com/admin/login"
```

启动 API 和 Web 控制台：

```bash
pnpm dev
```

默认地址：

- API: `http://localhost:4300`
- Web: `http://localhost:4301`

桌面端开发模式：

```bash
pnpm desktop:dev
```

## CLI 用法

```bash
pnpm dwt list
pnpm dwt validate [caseId|file]
pnpm dwt preflight <caseId|file> [--env=local|dev|test|sit] [--no-env-file]
pnpm dwt run <caseId> [--env=local|dev|test|sit] [--headless|--headed] [--no-env-file]
```

常用质量检查：

```bash
pnpm typecheck
pnpm test
pnpm dwt validate
pnpm ci:check
```

## 配置中心

`platform.config.json` 用于保存可提交的非敏感配置：

- `app`：品牌名和产品名。
- `server`：API 监听地址、端口和 CORS 来源。
- `web`：Web dev server 地址、端口、代理目标、请求超时、本地存储 key。
- `desktop`：桌面端应用 ID、产品名、维护者、安装包命名、内置 API 端口和窗口尺寸。
- `workspace.directories`：桌面端首次启动需要创建的工作目录。
- `artifacts`：日志、报告、截图、trace 的本地目录。
- `browser.defaultViewport`：Playwright 默认视口，仍可被 `BROWSER_VIEWPORT_WIDTH/HEIGHT` 覆盖。
- `context`：设置页默认上下文来源和路由分组关键词。
- `uploads`：上下文导入、AI 资料文件和文本截断限制。

敏感配置仍然放在 `.env`，例如账号、密码、API token、DB 连接和 AI Key。

## 示例用例

```yaml
case_id: login_user
case_name: 用户登录
mode: web
sessions:
  - name: user
    login_url: "${env.USER_LOGIN_URL}"
    username: "${env.USER_USERNAME}"
    password: "${env.USER_PASSWORD}"
locations:
  file: cases/location/login.user.yaml
steps:
  - step_id: open_login
    name: 打开登录页
    type: web_open
    session: user
    url: "${session.login_url}"
  - step_id: login
    name: 登录
    type: flow_login
    session: user
    username: "${session.username}"
    password: "${session.password}"
```

更多 DSL 说明见 [docs/dsl-design.md](docs/dsl-design.md)，新增用例流程见 [docs/how-to-add-case.md](docs/how-to-add-case.md)。

## 业务上下文

平台支持在设置页导入路由、菜单或登录返回结构，用于辅助生成 YAML 和定位建议。接口为：

```text
GET    /api/app/context
GET    /api/app/context/sources/:source
PUT    /api/app/context/sources/:source
DELETE /api/app/context/sources/:source
POST   /api/app/context/parse
GET    /api/db/health
```

上下文数据默认写入 `uploads/app-context/`，用于本地调试和 AI 辅助生成，不应进入交付包。默认来源和路由分组关键词可在 `platform.config.json` 的 `context.defaultSources`、`context.routeGroups` 中调整。

## 构建

Web 静态构建：

```bash
pnpm web:build
```

桌面端构建：

```bash
pnpm desktop:build
pnpm desktop:pack
pnpm desktop:dist:win
pnpm desktop:dist:linux
pnpm desktop:dist:mac
```

Linux 和 macOS 安装包建议在对应系统的 CI runner 中构建和验证。当前默认未配置代码签名、公证或浏览器资源内置策略。

## 定制入口

- 平台定制说明与检查清单见 [docs/customization.md](docs/customization.md)。
- 贡献流程见 [CONTRIBUTING.md](CONTRIBUTING.md)。
- 安全问题报告见 [SECURITY.md](SECURITY.md)。
- 项目使用 [MIT License](LICENSE)。

## 当前边界

- 示例用例是模板，不包含任何真实业务账号或生产地址。
- AI 生成结果需要人工审阅，尤其是资金、审批、状态流转和 DB 断言。
- 桌面端不默认打包本机 Playwright 浏览器缓存，目标机器需要可用浏览器环境，或后续引入内置浏览器策略。
