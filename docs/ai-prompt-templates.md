# AI 辅助生成测试用例与脚本提示词模板

本文档提供可复用提示词，用于让 AI 根据页面源码、需求文档、接口说明和已有 YAML 生成可审阅的自动化测试草稿。

## 生成业务用例矩阵

```text
你是 Dowalet 前端自动化测试负责人。
请根据以下需求/页面资料，输出核心回归用例矩阵。

要求：
1. 按 P0/P1/P2 标记优先级。
2. 每条用例包含流程名称、前置数据、关键步骤、页面断言、接口断言、失败产物。
3. 明确哪些信息需要人工确认，不要猜测资金口径、状态机和历史数据处理。
4. 输出 Markdown 表格。

资料：
<粘贴需求文档、路由、接口说明或页面截图分析结果>
```

## 生成 YAML DSL 草稿

```text
你是 DWT Testing 的 YAML DSL 生成助手。
请把以下测试流程转成 cases/scenario/*.yaml 草稿。

约束：
1. 不写死账号、密码、token、生产地址或本机绝对路径。
2. 登录地址、账号、密码必须使用 ${env.KEY} 或 ${session.*}。
3. 页面元素通过 target 引用 cases/location/*.yaml，不直接写 css/xpath。
4. 提交、保存、审核类步骤要补 wait_for_api，包含 expected_status、business_code_path、success_codes。
5. 每条用例至少包含一个页面断言或 api_assert。
6. 只输出 YAML，不输出解释。

已有步骤类型：
web_open、web_reload、web_input、web_select、web_click、web_upload、web_wait_text、web_wait_element、
web_assert_text、web_assert_visible、web_assert_url、web_extract、web_screenshot、
flow_login、flow_submit_kyc、flow_admin_approve_kyc、api_request、api_assert、db_query、db_assert。

测试流程：
<粘贴流程说明>
```

## 生成定位文件

```text
你是 Playwright 页面定位顾问。
请根据以下页面 HTML/截图说明，为 DWT Testing 生成 cases/location/*.yaml。

要求：
1. 优先建议 data-testid 名称。
2. fallback 按 placeholder、role、label、text、name、css、xpath 的稳定性排序。
3. xpath 只能作为最后兜底。
4. 输出 YAML，key 使用业务含义清晰的英文下划线命名。

页面资料：
<粘贴 HTML 片段、组件源码或截图描述>
```

## 修复失败用例

```text
你是 DWT Testing 失败分析助手。
请根据运行日志、失败截图、trace 摘要和 YAML，判断失败原因并给出最小修复建议。

要求：
1. 先给结论，再列依据。
2. 区分环境问题、数据问题、定位问题、业务变更和脚本缺陷。
3. 如果需要改 YAML，给出完整 patch 建议。
4. 如果需要人工确认，明确问题和影响，不猜业务规则。

YAML：
<粘贴用例>

日志：
<粘贴关键日志>

截图/trace 摘要：
<粘贴截图分析或 trace 关键步骤>
```

## 生成只读 API/DB 断言

```text
你是 Dowalet 测试断言设计助手。
请根据以下接口文档和业务流程，为 DWT Testing 设计 API 或只读 DB 断言。

安全边界：
1. 不生成写库、删库、更新状态的 SQL。
2. DB 只允许 select/show/desc/describe/explain。
3. 涉及资金、状态流转、审批和历史数据时，列出需要业务确认的问题。
4. 输出适合放入 YAML steps 的片段。

接口/表结构资料：
<粘贴接口文档或只读表结构>
```
