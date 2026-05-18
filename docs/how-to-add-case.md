# 如何新增用例

1. 在 `cases/location/` 新增页面定位文件，优先使用业务页面的 `data-testid`。
2. 在 `cases/scenario/` 新增流程文件，填写 `case_id`、`case_name`、`sessions`、`locations.file` 和 `steps`。
3. 不要在 YAML 中写死账号、密码、token，必须引用 `.env` 中的环境变量。
4. 启动服务后访问控制台，新增用例会自动出现在按钮列表。
5. 如果 DSL 校验失败，平台会拒绝执行并返回清晰错误。
