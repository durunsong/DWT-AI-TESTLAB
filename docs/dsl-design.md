# YAML DSL 设计

DSL 分为 `cases/scenario/*.yaml`、`cases/location/*.yaml` 和可选的 `cases/shared/*.yaml`。

`scenario` 描述业务流程，包括用例基础信息、会话、变量和步骤。步骤既可以写在统一的 `steps` 中，也可以按 `beforeActions`、`mainSteps`、`assertions`、`afterActions` 分阶段组织；运行时会统一展开为 `steps`，其中 `afterActions` 会在前序步骤失败后继续尽量执行。`location` 描述页面元素定位，定位优先级为 `data-testid -> role -> label -> placeholder -> text -> name -> css -> xpath`，其中 `xpath` 只作为最后兜底。

共享步骤可放在 `cases/shared/` 下，并在阶段中通过 `use` 和 `with` 引用。示例：

```yaml
mainSteps:
  - use: common/web_login
    with:
      session: user
      url: "${session.login_url}"
```

Web 控制台的新增用例弹窗会读取 `cases/shared/**/*.yaml` 作为“复用能力”。AI 资料生成时可以勾选这些能力，生成结果会优先输出 `use` / `with` 引用，而不是重复展开登录、KYC 提交、后台审核等通用步骤。共享能力文件建议包含：

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

P0 支持页面流程步骤：`web_open`、`web_reload`、`web_input`、`web_select`、`web_click`、`web_upload`、`web_wait_text`、`web_wait_element`、`web_assert_text`、`web_assert_visible`、`web_assert_url`、`web_extract`、`web_screenshot`、`flow_login`、`flow_submit_kyc`、`flow_admin_approve_kyc`。

变量支持 `${env.KEY}`、`${session.login_url}`、`${session.username}`、`${session.password}`、`${var.name}`、`${timestamp}` 和 `${runId}`。缺失变量会直接报错并阻止执行。

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

运行前预检会解析 `file` 中的变量，并检查文件是否存在、是否为文件、是否仍位于项目根目录内。`uploads/` 默认是本地运行资料目录，不会提交到仓库；需要团队共享的固定样例文件，可以放到未忽略的项目目录后使用同样的相对路径引用。
