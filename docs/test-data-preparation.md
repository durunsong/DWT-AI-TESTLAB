# Dowalet 前端测试数据准备说明

本文档用于说明执行核心自动化用例前需要准备的本地环境变量、测试账号、附件和数据边界。真实账号、密码、token、DB 密码只允许放在本地 `.env*` 或 CI Secret 中。

## 环境文件

本地建议从 `.env.example` 复制生成 `.env`，按目标环境补齐：

```bash
cp .env.example .env
```

执行 CI 或共享演示时，优先使用 Secret 注入，并在命令中追加 `--no-env-file`，避免读取本机私有配置。

## 基础账号

| 数据项 | 变量 | 用途 | 要求 |
| --- | --- | --- | --- |
| user 登录页 | `USER_LOGIN_URL` | user 端登录入口 | 指向测试环境，不允许使用生产域名。 |
| user 账号 | `USER_USERNAME` | user 登录、KYC、钱包、消息、账号安全 | 账号状态正常，具备访问目标菜单权限。 |
| user 密码 | `USER_PASSWORD` | user 登录 | 放在本地环境变量。 |
| admin 登录页 | `ADMIN_LOGIN_URL` | admin 端登录入口 | 指向测试环境，不允许使用生产域名。 |
| admin 账号 | `ADMIN_USERNAME` | 后台登录、KYC 审核、资料修改 | 具备审核和资料编辑权限。 |
| admin 密码 | `ADMIN_PASSWORD` | admin 登录和资料修改确认 | 放在本地环境变量。 |

## KYC 数据

| 数据项 | 变量 | 建议值 |
| --- | --- | --- |
| 企业名称前缀 | `KYC_ENTERPRISE_NAME_PREFIX` | `自动化测试企业` |
| 营业执照号前缀 | `KYC_LICENSE_NO_PREFIX` | `AUTO` |
| 法人姓名 | `KYC_LEGAL_PERSON` | 使用测试环境允许的虚拟姓名。 |
| 法人身份证号 | `KYC_ID_CARD_NO` | 使用测试环境白名单或虚拟证件号。 |
| 审核备注 | `KYC_REVIEW_REMARK` | `自动化测试审核通过` |
| 营业执照图片 | `KYC_BUSINESS_LICENSE_FILE` | 项目相对路径，例如 `uploads/business-license.png`。 |
| 身份证人像面 | `KYC_ID_CARD_FRONT_FILE` | 项目相对路径。 |
| 身份证国徽面 | `KYC_ID_CARD_BACK_FILE` | 项目相对路径。 |

KYC 用例会用 `${timestamp}` 拼接企业名称和执照号，减少重复数据冲突。若测试环境对证件号唯一性有约束，需要准备可重复回收的数据池。

## 附件要求

- 文件放在 `uploads/` 或 `uploads/cases/<caseId>/` 下，本目录默认不提交。
- YAML 中只写项目相对路径，不写本机绝对路径。
- 演示前确认附件不包含真实证件、真实姓名、手机号、邮箱或客户资料。
- 上传失败时先执行 `pnpm dwt preflight <caseId> --env=local` 检查路径。

## API 与 DB

| 能力 | 变量 | 默认 | 说明 |
| --- | --- | --- | --- |
| API 断言 | `API_ENABLED` | `false` | 启用后补齐 `API_BASE_URL` 或同义变量。 |
| 业务成功码 | `API_BUSINESS_SUCCESS_CODES` | `0000` | 多个值用英文逗号分隔。 |
| DB 校验 | `DB_ENABLED` | `false` | 只允许只读账号和只读 SQL。 |
| DB 类型 | `DB_TYPE` | `mysql` | 当前主要面向 MySQL。 |

DB 用例只允许 `select/show/desc/describe/explain`。涉及清理、状态回滚、资金或审批历史时，不在自动化脚本中直接改库，必须走人工确认的补偿流程。

## 演示前检查

```bash
pnpm dwt doctor
pnpm dwt validate
pnpm dwt preflight login_user --env=local
pnpm dwt preflight login_admin --env=local
pnpm dwt preflight kyc_submit_and_approve --env=local
```

预检通过后再执行真实浏览器回归。对外展示报告、截图、trace 和视频前，需要完成脱敏检查。
