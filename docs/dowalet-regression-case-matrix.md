# Dowalet 核心回归用例矩阵

本文档用于参赛交付和日常回归排期，统计 `cases/scenario/` 中已沉淀的 YAML 用例，并标记课题目标里的缺口。

## 覆盖结论

截至 2026-05-27，仓库内已有 6 条可校验 YAML 场景：

| 优先级 | 流程 | 状态 | 已有用例 | 建议补充数 | 说明 |
| --- | --- | --- | --- | ---: | --- |
| P0 | user 登录 | 已覆盖 | `login_user` | 0 | 已包含打开登录页、登录 flow、首页可见断言。 |
| P0 | admin 登录 | 已覆盖 | `login_admin` | 0 | 已包含打开登录页、登录 flow、首页可见断言。 |
| P0 | KYC 提交 | 已覆盖 | `kyc_submit` | 0 | 已覆盖 user 端提交和审核中断言。 |
| P0 | KYC 提交并审核 | 已覆盖 | `kyc_submit_and_approve` | 0 | 已覆盖 user/admin 双端流转和通过后回查。 |
| P0 | 钱包首页 | 待补充 | - | 2 | 建议补充登录后钱包首页冒烟、资产/入口渲染检查。 |
| P0 | 消息中心 | 待补充 | - | 2 | 建议补充消息列表/未读数、消息详情/空态检查。 |
| P1 | 注册 | 待补充 | - | 2 | 建议补充正常注册、验证码/协议/重复账号异常。 |
| P1 | 忘记密码 | 待补充 | - | 2 | 建议补充验证码重置成功、弱密码或验证码错误。 |
| P1 | 手机号绑定 | 待补充 | - | 2 | 建议补充绑定成功、验证码错误或已绑定提示。 |
| P1 | 验证方式修改 | 待补充 | - | 2 | 建议补充修改成功、二次校验失败或取消流程。 |
| P1 | 后台个人资料修改 | 已覆盖 | `admin_zilkiaoxiugai001`、`admin_zilkiaoxiugai002` | 0 | 两条用例均覆盖保存接口等待和成功提示断言。 |

## 测试用例补充统计

建议新增业务 YAML 用例 12 条：

| 类别 | 数量 | 建议 case_id |
| --- | ---: | --- |
| P0 钱包首页 | 2 | `wallet_home_smoke`、`wallet_home_asset_entry` |
| P0 消息中心 | 2 | `message_center_list`、`message_center_detail_or_empty` |
| P1 注册 | 2 | `register_success`、`register_validation_error` |
| P1 忘记密码 | 2 | `forgot_password_success`、`forgot_password_validation_error` |
| P1 手机号绑定 | 2 | `phone_binding_success`、`phone_binding_validation_error` |
| P1 验证方式修改 | 2 | `verification_method_update_success`、`verification_method_update_validation_error` |

其中 P0 缺口 4 条，P1 缺口 8 条。新增前应先确认真实页面路径、验证码处理方式、测试账号数据隔离规则和接口业务码。

## 已有用例清单

| case_id | 文件 | 类型 | 关键断言/等待 |
| --- | --- | --- | --- |
| `login_user` | `cases/scenario/login.user.yaml` | `user-main` | `user_home_marker` 可见。 |
| `login_admin` | `cases/scenario/login.admin.yaml` | `admin-main` | `admin_home_marker` 可见。 |
| `kyc_submit` | `cases/scenario/kyc.submit.yaml` | `user-main` | `kyc_status` 为“审核中”。 |
| `kyc_submit_and_approve` | `cases/scenario/kyc.submit-and-approve.yaml` | `user-main` | user 端“审核中”、admin 审核、user 端“审核通过”。 |
| `admin_zilkiaoxiugai001` | `cases/scenario/admin_zilkiaoxiugai001.yaml` | `admin-main` | `/user/baseInfo/edit` 返回成功码，页面提示“修改成功”。 |
| `admin_zilkiaoxiugai002` | `cases/scenario/admin_zilkiaoxiugai002.yaml` | `admin-main` | `/user/baseInfo/edit` 返回成功码，页面提示“修改成功”。 |

## 新增用例准入标准

每条新增用例至少包含：

- 页面入口或接口入口。
- 关键用户操作。
- `wait_for_api`、`api_assert` 或可解释的页面等待。
- 至少一个页面断言、业务码断言或只读 DB 断言。
- 失败产物可定位：截图、trace、日志、HTML/JSON 报告。

涉及账号、验证码、资金、审批、绑定关系或历史数据时，先确认测试环境数据准备和回滚策略，再落 YAML。
