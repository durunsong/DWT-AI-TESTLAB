# 如何新增用例

## 1. 准备环境变量

不要在 YAML 中写死账号、密码、token、接口地址或 DB 密码。敏感值放在本地 `.env*` 或 CI Secret 中，并在 YAML 中通过 `${env.KEY}` 引用。

示例：

```yaml
sessions:
  - name: user
    login_url: "${env.USER_LOGIN_URL}"
    username: "${env.USER_USERNAME}"
    password: "${env.USER_PASSWORD}"
```

## 2. 维护页面定位

在 `cases/location/` 新增或修改定位文件，优先使用业务页面的 `data-testid`。

建议先补齐登录入口、菜单、表单项、提交按钮、审核按钮、状态文本等关键元素。

## 3. 编写 scenario

在 `cases/scenario/` 新增流程文件，至少填写：

- `case_id`
- `case_name`
- `sessions`
- `locations.file`
- `steps`

如果流程中有登录、上传、审核等通用步骤，优先复用 `cases/shared/` 中的共享能力。

## 4. 上传附件

涉及 `web_upload` 时，可以在 Web 控制台的用例编辑页上传附件。附件默认保存到：

```text
uploads/cases/<caseId>/
```

YAML 中使用返回的项目相对路径，不使用本机绝对路径。

## 5. 校验和预检

保存后先执行 DSL 校验：

```bash
pnpm dwt validate <caseId|file>
```

再执行运行前预检：

```bash
pnpm dwt preflight <caseId|file> --env=local
```

预检会检查环境变量、定位文件、API baseUrl、DB 开关和上传文件。存在 error 级问题时，平台会拒绝执行。

## 6. 执行用例

CLI 执行：

```bash
pnpm dwt run <caseId|file> --env=local --headed
```

Web 控制台执行：

1. 启动服务：`pnpm dev`。
2. 打开 `http://localhost:4301`。
3. 进入“用例列表”或“用例编辑”。
4. 点击“预检”确认可运行。
5. 点击“执行”并查看运行详情、报告、日志、截图和 trace。

## 7. 提交前检查

- 不提交 `.env*`、运行报告、截图、trace、上传资料。
- 确认新增 YAML 没有真实账号、密码、token。
- 确认 `pnpm dwt validate` 通过。
- 涉及 DB 的用例确认只读 SQL 和只读账号。
