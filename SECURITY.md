# Security Policy

## 报告漏洞

如果你发现安全问题，请优先通过私密渠道联系维护者；如果暂时没有私密渠道，请在公开 Issue 中只描述影响范围，不要贴出可直接利用的 payload、密钥、真实地址或用户数据。

## 敏感信息规则

- 不要提交 `.env`、`.env.local`、`.env.*`、证书、token、账号密码或生产配置。
- `.env.example` 只能包含安全占位值。
- 报告、日志、截图和 trace 可能包含业务数据，默认不应提交。
- AI 供应商 Key、DB 密码和接口 token 应放入本地环境变量或 CI Secret。

## 默认安全边界

- `TEST_ENV=prod` 和 `TEST_ENV=production` 默认禁止执行。
- DB 执行器只允许只读 SQL。
- API、报告和日志会尽量脱敏密码、token、cookie、authorization 等字段。

安全边界不能替代真实环境隔离。接入生产相邻环境前，请先完成账号权限、网络访问、数据脱敏和回滚方案评审。
