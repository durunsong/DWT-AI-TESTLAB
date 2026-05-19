# AI 自动化测试平台上下文

本平台使用 React 控制台触发 Fastify API，由 runner 读取 YAML DSL 并使用 Playwright 执行业务页面流程。AI 后续只能生成 DSL 草稿和公共配置，生成结果必须先经过 Zod 校验，校验失败禁止执行。

P0 只覆盖页面流程和页面断言，不依赖数据库。API 校验和 DB 校验保留在执行器接口中，后续作为 P1 扩展。

## `${APP_BRAND_NAME}` 业务上下文

当前平台默认读取：

- user 登录返回和路由表：`../front-end/dowalet-dev/ccc.json`
- admin 登录返回和路由表：`../front-end/dowalet-dev/ddd.json`

读取后只保留脱敏后的用户摘要、路由数量、企业/认证相关 user 路由、审批/审核相关 admin 路由。`token`、密码、cookie 等敏感字段不会进入接口响应、日志或报告。

## DB 配置策略

真实数据库连接只写入本地 `.env`，不写入 `.env.example`、源码或文档。DB 执行器只允许 `select/show/desc/describe/explain` 只读语句，并继续拦截 `drop/truncate/alter/create/insert/update/delete/grant/revoke` 等危险语句。
