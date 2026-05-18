# YAML DSL 设计

DSL 分为 `cases/scenario/*.yaml` 和 `cases/location/*.yaml`。

`scenario` 描述业务流程，包括用例基础信息、会话、变量和步骤。`location` 描述页面元素定位，定位优先级为 `data-testid -> role -> label -> placeholder -> text -> name -> css -> xpath`，其中 `xpath` 只作为最后兜底。

P0 支持页面流程步骤：`web_open`、`web_reload`、`web_input`、`web_click`、`web_upload`、`web_wait_text`、`web_wait_element`、`web_assert_text`、`web_assert_visible`、`web_assert_url`、`web_extract`、`web_screenshot`、`flow_login`、`flow_submit_kyc`、`flow_admin_approve_kyc`。

变量支持 `${env.KEY}`、`${session.login_url}`、`${session.username}`、`${session.password}`、`${var.name}`、`${timestamp}` 和 `${runId}`。缺失变量会直接报错并阻止执行。
