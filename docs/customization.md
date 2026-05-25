# 平台定制说明

本项目按“拿到即可搭建自己的测试平台”的方向组织。默认配置保持中性，业务团队只需要替换品牌、环境变量、示例用例和页面定位，就可以落到自己的系统。

## 10 分钟定制

1. 初始化本地配置：

```bash
pnpm setup:platform --brand="你的团队" --product="你的测试平台" --user-login-url="https://example.com/user/login" --admin-login-url="https://example.com/admin/login"
```

2. 修改本地 `.env*` 中的账号、密码、接口地址、AI 服务和 DB 只读账号。
3. 修改 `platform.config.json` 中的端口、桌面端信息、上下文来源、上传限制、产物目录、浏览器视口和路由关键词。
4. 在 `cases/location/` 中维护页面定位。
5. 在 `cases/scenario/` 中新增或改造 YAML 用例。
6. 执行预检：

```bash
pnpm dwt validate
pnpm dwt preflight login_user --env=local
```

7. 启动控制台：

```bash
pnpm dev
```

## 推荐替换项

### platform.config.json

- `app.brandName` / `app.productName`：页面、报告和桌面端使用的展示名称。
- `server.host` / `server.port` / `server.corsOrigins`：API 监听地址、端口和允许访问来源。
- `web.host` / `web.port` / `web.devApiProxyTarget`：Web dev server 监听地址、端口和本地代理目标。
- `web.requestTimeoutMs`：Web 控制台请求 API 的超时时间。
- `web.storageKey`：Web 控制台本地设置的 localStorage key。
- `desktop.appId` / `desktop.productName` / `desktop.maintainer`：桌面端打包标识和安装包展示信息。
- `desktop.window`：桌面端窗口标题、默认尺寸和最小尺寸。
- `workspace.directories`：桌面端首次启动需要创建的工作目录。
- `artifacts.logsDir` / `artifacts.reportsDir` / `artifacts.screenshotsDir` / `artifacts.tracesDir` / `artifacts.videosDir`：运行产物目录。
- `browser.defaultViewport`：Playwright 默认视口。
- `context.defaultSources`：设置页默认展示和维护的路由来源，例如 `user/admin/operator`。
- `context.routeGroups`：从路由菜单里提取业务分组的关键词。
- `uploads.contextBodyLimitMb`：路由上下文导入接口的请求体大小限制。
- `uploads.materialFileMaxMb`：AI 资料导入的单文件大小限制。
- `uploads.caseAttachmentMaxMb`：用例编辑页上传测试附件的单文件大小限制。
- `uploads.caseAttachmentBaseDir`：用例测试附件保存目录，必须位于项目根目录内，默认 `uploads/cases`。
- `uploads.materialSourceMaxChars` / `uploads.materialLinkMaxChars`：AI 资料文本截断长度。

### .env

- `USER_LOGIN_URL` / `ADMIN_LOGIN_URL`：被测系统入口。
- `API_BASE_URL` 或 `APP_API_BASE_URL`：接口测试基础地址。
- `AI_BASE_URL` / `AI_MODEL` / `AI_API_KEY`：OpenAI 兼容模型服务。
- `DB_*`：只读数据库连接，仅在需要 DB 断言时配置。
- `HEADLESS` / `SLOW_MO` / `VISUAL_MODE`：浏览器运行体验。
- `BROWSER_VIEWPORT_WIDTH` / `BROWSER_VIEWPORT_HEIGHT`：临时覆盖默认视口。

`prod` 可用于配置和构建场景，但自动化运行会拦截 `prod/production` 环境和疑似生产域名。

## 用例迁移建议

- 先保留 `user` 和 `admin` 两个 session 名，等主流程稳定后再扩展更多业务端。
- 先跑通登录、核心查询、提交、审核这类主路径，再补异常路径。
- 页面元素优先维护到 `cases/location/*.yaml`，减少 YAML 用例里散落 CSS/XPath。
- 涉及保存、提交、审核的步骤，优先配置 `wait_for_api` 或后置 `api_assert` / `db_assert`。
- 业务码字段不同的系统，直接改 `.env` 中的 `API_BUSINESS_CODE_PATHS` 和 `API_BUSINESS_SUCCESS_CODES`。

## 数据和目录

- 本地运行产物默认在 `logs/`、`reports/`、`screenshots/`、`traces/`、`videos/`。
- 产物目录可通过 `platform.config.json` 的 `artifacts` 改为其他项目根目录内的相对路径。
- 上传资料、用例附件和路由上下文默认在 `uploads/`。
- 业务上下文默认写入 `uploads/app-context/`。

## 交付前检查

- `.env.example` 只保留占位值。
- `.env*`、报告、截图、trace、视频、上传资料不进入交付包。
- `pnpm ci:check` 通过。
- README 中的平台名称、截图、用例示例符合当前团队语境。
- 桌面端如需分发，确认图标、应用 ID、签名和安装包名称已经替换。
