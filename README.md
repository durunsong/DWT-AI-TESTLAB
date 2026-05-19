# AI 自动化测试平台

这是一个 `Node.js + TypeScript + Playwright + YAML DSL + Fastify + React` 的自动化测试平台骨架，用于通过标准 YAML DSL 承载 `user/admin` 双服务业务流程。

## 模块

- `packages/shared`：类型、常量、Zod Schema、变量解析和脱敏工具。
- `packages/runner`：YAML 加载、运行上下文、Playwright 会话、Web/Visual 执行器、编排器和报告生成。
- `packages/ai-generator`：AI 生成 DSL 的 prompt 与校验占位能力。
- `apps/server`：Fastify API，提供用例列表、运行触发、运行状态、SSE、报告和日志接口。
- `apps/web`：React 测试运行工作台。
- `front-end/dowalet-dev/ccc.json`、`front-end/dowalet-dev/ddd.json`：作为 `${APP_BRAND_NAME}` user/admin 登录返回与路由表上下文来源，平台只读取脱敏摘要。

## 启动

```bash
pnpm install
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

## 环境变量

复制 `.env.example` 为 `.env` 后填写真实测试环境账号、密码和页面地址。平台不会提交 `.env`，也不会在日志和报告中明文输出敏感字段。

`TEST_ENV` 只允许 `local`、`dev`、`test`、`sit`。`prod` 和 `production` 会被拦截。

## `${APP_BRAND_NAME}` 适配

平台默认通过 `DOWALET_USER_AUTH_FILE` 和 `DOWALET_ADMIN_AUTH_FILE` 读取 `dowalet-dev` 登录后返回数据，提取企业认证、审批审核相关路由，用于辅助完善 YAML DSL 和页面定位。接口为：

```text
GET /api/dowalet/context
GET /api/db/health
```

DB 连接信息仅放在本地 `.env`。DB 执行器只允许只读查询，并会拦截危险 SQL。

## 当前缺失的真实业务信息

- user/admin 测试账号、密码。
- 是否存在验证码或二次验证。
- KYC 页面真实入口、字段、上传文件要求。
- 审核成功后的真实文案和列表查询条件。

这些信息缺失不会影响平台骨架启动，但会影响真实 Playwright 流程跑通。
