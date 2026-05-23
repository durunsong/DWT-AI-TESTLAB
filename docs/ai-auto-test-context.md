# AI 自动化测试平台上下文

本平台使用 React 控制台触发 Fastify API，由 runner 读取 YAML DSL 并使用 Playwright 执行业务页面流程。AI 后续只能生成 DSL 草稿和公共配置，生成结果必须先经过 Zod 校验，校验失败禁止执行。

P0 只覆盖页面流程和页面断言，不依赖数据库。API 校验和 DB 校验保留在执行器接口中，后续作为 P1 扩展。

## `${APP_BRAND_NAME}` 业务上下文

当前平台在设置页维护业务路由来源，默认保留 user/admin 两个来源，也支持新增其他来源标识。导入或编辑后会保存到本地 `uploads/app-context/`，刷新页面后继续生效；工作台首页只展示只读摘要。

路由来源不限定为某个业务项目的登录返回。解析器支持登录返回里的 `data.auths`，也支持直接路由数组、JS/TS 路由模块、`routes`、`auths`、`menus`、`menuList` 等常见路由/菜单结构。读取后只保留脱敏后的用户摘要、路由数量、企业/认证相关 user 路由、审批/审核相关 admin 路由。`token`、密码、cookie 等敏感字段不会进入上下文摘要、日志或报告；原始上传内容仅用于本地查看和修改。

## DB 配置策略

真实数据库连接只写入本地 `.env`，不写入 `.env.example`、源码或文档。DB 执行器只允许 `select/show/desc/describe/explain` 只读语句，并继续拦截 `drop/truncate/alter/create/insert/update/delete/grant/revoke` 等危险语句。
