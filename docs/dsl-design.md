# YAML DSL 设计

DSL 分为三类文件：

- `cases/scenario/*.yaml`：业务流程、会话、变量、步骤和断言。
- `cases/location/*.yaml`：页面元素定位。
- `cases/shared/*.yaml`：可复用流程能力，可选。

## Scenario

`scenario` 描述一次可执行流程。步骤既可以写在统一的 `steps` 中，也可以按 `beforeActions`、`mainSteps`、`assertions`、`afterActions` 分阶段组织。运行时会统一展开为步骤列表，其中 `afterActions` 会在前序步骤失败后继续尽量执行。

常见字段：

```yaml
case_id: login_user
case_name: 用户登录
case_type: uncategorized
mode: web
defaults:
  step_timeout_ms: 20000
  wait_for_network: true
sessions:
  - name: user
    login_url: "${env.USER_LOGIN_URL}"
    username: "${env.USER_USERNAME}"
    password: "${env.USER_PASSWORD}"
variables:
  order_no: "${timestamp}"
locations:
  file: cases/location/login.user.yaml
steps:
  - step_id: open_login
    name: 打开登录页
    type: web_open
    session: user
    url: "${session.login_url}"
```

变量支持 `${env.KEY}`、`${session.login_url}`、`${session.username}`、`${session.password}`、`${var.name}`、`${timestamp}` 和 `${runId}`。缺失变量会在校验、预检或运行时阻止执行。

## Location

`location` 描述页面元素定位。定位优先级为：

```text
data-testid -> role -> label -> placeholder -> text -> name -> css -> xpath
```

`xpath` 只作为最后兜底。业务系统可优先补充稳定的 `data-testid`，减少页面结构变更带来的维护成本。

## 共享能力

共享步骤放在 `cases/shared/` 下，并在场景阶段中通过 `use` 和 `with` 引用。

```yaml
mainSteps:
  - use: common/web_login
    with:
      session: user
      url: "${session.login_url}"
```

共享能力文件示例：

```yaml
shared_id: common/web_login
name: 登录复用流程
description: 打开登录页并执行登录
tags: [login]
params:
  session:
    required: true
steps:
  - step_id: open_login
    name: 打开登录页
    type: web_open
    session: "${session}"
    url: "${session.login_url}"
```

Web 控制台的新增用例弹窗会读取 `cases/shared/**/*.yaml` 作为“复用能力”。AI 资料生成时可以勾选这些能力，生成结果会优先输出 `use` / `with` 引用。

## 步骤类型

Web 步骤：

- `web_open`
- `web_reload`
- `web_input`
- `web_select`
- `web_click`
- `web_upload`
- `web_wait_text`
- `web_wait_element`
- `web_assert_text`
- `web_assert_visible`
- `web_assert_url`
- `web_extract`
- `web_screenshot`

内置业务 flow：

- `flow_login`
- `flow_submit_kyc`
- `flow_admin_approve_kyc`

API 步骤：

- `api_request`
- `api_assert`

DB 步骤：

- `db_query`
- `db_assert`
- `db_clean` 是预留类型，当前执行器会拒绝，默认只开放只读查询和断言。

## API 示例

```yaml
steps:
  - step_id: query_user_detail
    name: 查询用户详情
    type: api_assert
    session: user
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

相对 URL 会优先使用 `API_BASE_URL` / `APP_API_BASE_URL` / `DWT_API_BASE_URL` / `TEST_API_BASE_URL`。如果步骤指定了 `session`，也可以复用该 session 的 `login_url` 域名，并携带同名浏览器 session 的 cookie。

## DB 示例

```yaml
steps:
  - step_id: assert_user_created
    name: 校验用户已落库
    type: db_assert
    sql: "select status from users where id = ?"
    params: ["${var.user_id}"]
    expected:
      status: ENABLED
```

DB 能力必须设置 `DB_ENABLED=true`，并使用只读数据库账号。执行器只允许 `select/show/desc/describe/explain`。

## 等待接口

Web 步骤可配置 `wait_for_api`，用于点击或提交后等待目标接口返回：

```yaml
wait_for_api:
  url: /api/kyc/submit
  method: POST
  expected_status: 200
  business_code_path: code
  success_codes: ["0000"]
```

## 上传附件

`web_upload` 用于给页面上的 `<input type="file">` 上传本地测试附件。`file` 建议使用项目相对路径，默认可在用例编辑页上传到 `uploads/cases/<caseId>/` 后引用返回路径：

```yaml
variables:
  license_file: uploads/cases/kyc_submit/business-license.png
steps:
  - step_id: upload_license
    name: 上传营业执照
    type: web_upload
    session: user
    target: kyc_license_upload
    file: "${var.license_file}"
```

运行前预检会解析 `file` 中的变量，并检查文件是否存在、是否为文件、是否仍位于项目根目录内。`uploads/` 默认是本地运行资料目录，不会提交到仓库。
