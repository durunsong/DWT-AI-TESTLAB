# dwt-testing 与 antiwork/shortest 能力对照

对照版本：`antiwork/shortest` main 分支 `620da61`。

## 已具备的能力

- 基于 Playwright 的端到端浏览器执行。
- AI 辅助生成测试用例草稿，并落到项目自定义 YAML DSL。
- Web 控制台、桌面端、运行历史、日志、截图、trace、JSON/HTML 报告。
- 多 session 场景编排，适配 user/admin 或其他自定义业务端。
- DB 只读查询与断言，支持把查询结果写入变量。

## 当前 Shortest 风格能力

- API 测试步骤真正可执行：`api_request` / `api_assert` 不再是占位能力。
- API 步骤支持 `url`、`method`、`headers`、`query`、`body`、`expected_status`、`business_code_path`、`success_codes`、`failure_codes`、`expected`、`body_path`、`save_as`。
- 相对 API URL 支持通过 `API_BASE_URL`、`APP_API_BASE_URL`、`DWT_API_BASE_URL`、`TEST_API_BASE_URL` 解析；如果步骤指定了 `session`，也可以复用该 session 的 `login_url` 域名。
- API 响应会进入报告数据，并对密码、token、cookie、authorization 等敏感字段脱敏。
- 混合用例中 API 步骤指定 `session` 时，会复用同名浏览器 session 的 cookie，支持 Web 登录后继续做接口断言。
- API-only / DB-only 用例不再强制启动浏览器。
- 新增 CLI 入口：
  - `pnpm dwt list`
  - `pnpm dwt validate [caseId|file]`
  - `pnpm dwt preflight <caseId|file> [--env=local|dev|sit] [--no-env-file]`
  - `pnpm dwt plan <caseId|file> [--env=local|dev|sit] [--no-env-file]`
  - `pnpm dwt run <caseId|file> [--env=local|dev|sit] [--headless|--headed] [--no-env-file]`
- 新增运行前预检能力：在真正启动浏览器或请求接口前检查 DSL、环境变量、定位文件、定位 key、API baseUrl、DB 开关和上传文件。
- 用例编辑页已接入预检按钮，执行前也会自动预检；预检失败时不会启动运行。
- 新增服务端预检接口：
  - `GET /api/cases/:caseId/preflight?env=sit`
  - `POST /api/cases/preflight`

## API DSL 示例

```yaml
steps:
  - step_id: query_user_detail
    name: 查询用户详情接口
    type: api_assert
    url: /api/users/detail
    method: GET
    query:
      userId: "${var.user_id}"
    expected_status: 200
    business_code_path: code
    success_codes: ["0000"]
    expected:
      data.status: ENABLED
    body_path: data.id
    save_as: api_user_id
```

## 与 shortest 仍存在的产品差异

- `shortest()` TypeScript 测试 API、链式测试、生命周期 hooks、after callback 尚未引入；当前项目仍以 YAML DSL 为主入口。
- GitHub 2FA、Mailosaur 邮件集成属于第三方专用集成，暂未内置到平台。
- Shortest 的测试计划生成、源码分析、缓存命令可以作为后续增强方向；当前平台已有 AI YAML 助手和失败分析，优先服务业务用例落地。
