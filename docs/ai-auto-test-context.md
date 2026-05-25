# AI 自动化测试平台上下文

本平台使用 React 控制台或 CLI 触发 Fastify API，由 runner 读取 YAML DSL，并使用 Playwright、fetch 和 mysql2 执行业务流程。

AI 能力用于生成 DSL 草稿、补充定位建议、分析失败截图和整理资料。AI 输出必须先经过人工审阅、DSL 校验和运行前预检，不能直接绕过校验执行。

## 平台能力边界

- Web 流程：支持多 session、页面操作、上传、等待、断言、截图和 trace。
- API 流程：支持请求、状态码、业务码、响应字段断言、变量保存，并可复用浏览器 session cookie。
- DB 流程：支持只读查询和断言，必须配置 `DB_ENABLED=true`，且只能执行 `select/show/desc/describe/explain`。
- 预检：在执行前检查 DSL、环境变量、定位文件、API baseUrl、DB 开关和上传文件。
- 生产保护：`prod/production` 和疑似生产域名会被运行守卫拦截。

## 业务上下文

当前平台在设置页维护业务路由来源，默认保留 `user` / `admin` 两个来源，也支持新增其他来源标识。

导入或编辑后，上下文默认保存到本地 `uploads/app-context/`。这些内容只用于本地调试和 AI 辅助生成，不应进入交付包或提交记录。

解析器支持常见结构：

- 登录返回里的 `data.auths`。
- 直接路由数组。
- JS/TS 路由模块。
- `routes`、`auths`、`menus`、`menuList` 等菜单字段。

平台会提取脱敏后的用户摘要、路由数量、企业/认证相关 user 路由、审批/审核相关 admin 路由。`token`、密码、cookie 等敏感字段不应进入上下文摘要、日志或报告。

## DB 配置策略

真实数据库连接只写入本地 `.env*` 或 CI Secret，不写入 `.env.example`、源码或文档。

DB 执行器只允许只读语句，并拦截 `drop/truncate/alter/create/insert/replace/update/delete/grant/revoke` 等危险语句。`db_clean` 当前不开放，执行时会直接报错。
