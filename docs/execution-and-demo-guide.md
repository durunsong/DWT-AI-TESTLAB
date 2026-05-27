# 自动化测试执行与参赛演示说明

本文档面向参赛演示和日常回归，说明如何准备、执行、展示和排障 DWT Testing。

## 演示目标

建议演示一条短链路和一条长链路：

- 短链路：`login_user` 或 `login_admin`，展示 YAML DSL、预检、执行和报告。
- 长链路：`kyc_submit_and_approve`，展示 user/admin 多 session、提交后后台审核、状态回查和失败产物。

## 启动控制台

```bash
pnpm install
pnpm dev
```

默认地址：

- API: `http://localhost:4300`
- Web: `http://localhost:4301`

如只做 CLI 演示，可不启动 Web 控制台。

## CLI 执行流程

```bash
pnpm dwt doctor
pnpm dwt validate
pnpm dwt preflight login_user --env=local
pnpm dwt run login_user --env=local --headed
```

KYC 长链路示例：

```bash
pnpm dwt preflight kyc_submit_and_approve --env=local
pnpm dwt run kyc_submit_and_approve --env=local --headed
```

CI 或共享机器建议使用：

```bash
pnpm ci:check
pnpm dwt preflight login_user --env=sit --no-env-file
```

## Web 控制台演示路径

1. 打开 `http://localhost:4301`。
2. 进入“用例列表”，展示 `cases/scenario/` 的 YAML 用例。
3. 打开 `login_user`，展示步骤、定位文件、环境变量引用和预检。
4. 点击“执行”，进入运行详情页查看步骤状态和日志。
5. 打开报告页，展示 HTML/JSON 报告、截图、trace 和失败摘要。
6. 进入“设置”，展示环境配置、上下文资料、AI 资料导入入口。

## 演示讲解重点

- 测试逻辑沉淀在 YAML DSL，而不是临时 Playwright 脚本。
- 支持 user/admin 多 session，适合提交与后台审核组合流程。
- 支持页面断言、接口等待、业务码判断和只读 DB 校验。
- 失败时自动沉淀日志、截图、trace、视频、HTML/JSON 报告。
- AI 用于业务流程梳理、用例草稿生成、截图分析和失败分析，生成结果需要人工审阅。

## 排障速查

| 问题 | 检查方式 | 处理建议 |
| --- | --- | --- |
| 端口占用 | `pnpm dev:stop` | 停止本地 API/Web 端口后重启。 |
| YAML 校验失败 | `pnpm dwt validate <caseId>` | 按错误字段修正 YAML。 |
| 环境变量缺失 | `pnpm dwt preflight <caseId> --env=local` | 在 `.env` 或 Secret 中补齐。 |
| 元素找不到 | 查看 trace 和截图 | 优先补 `data-testid`，再更新 `cases/location/`。 |
| 接口成功但页面未更新 | 查看 `wait_for_api` 与页面断言 | 增加状态文本、URL 或列表刷新断言。 |
| 上传失败 | 运行 preflight | 确认附件存在且路径为项目相对路径。 |

## 交付前脱敏

对外提交或演示前检查：

- `.env*` 不提交、不展示。
- 报告、截图、trace、视频中不出现真实账号、手机号、邮箱、证件号、客户名称、token。
- 上传附件使用虚拟素材。
- 不面向生产环境执行自动化回归。
