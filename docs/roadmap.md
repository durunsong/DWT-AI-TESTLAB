# Roadmap

本文按当前项目状态记录已完成能力和后续建议，避免把早期 P0/P1 计划误认为未实现内容。

## 已完成

- YAML DSL 加载、Zod 校验和运行前预检。
- 多 session Playwright 浏览器上下文。
- Web 步骤执行、截图、trace、JSON/HTML 报告。
- Fastify API、React 控制台和 Electron 桌面端入口。
- 用例列表、用例编辑、运行详情、报告查看、历史记录和设置页。
- API 请求与响应断言，支持业务码、字段断言、变量保存和 session cookie 复用。
- DB 只读查询与断言，含 DB 健康检查和危险 SQL 拦截。
- AI 对话、用例草稿、资料导入、共享能力引用和失败截图分析。
- CI 基础命令：`typecheck`、`test`、`dwt validate`。

## 下一步建议

- 补充更多真实业务用例和页面定位文件，减少示例模板色彩。
- 增加 API-only、DB-only、混合流程的示例 YAML。
- 完善 Playwright codegen 到 DSL 的定位抽取和人工确认流程。
- 扩展 AI 生成后的差异预览、预检解释和修复建议。
- 为桌面端补充代码签名、公证、浏览器资源策略和跨平台安装验证。
- 在 CI 中分层执行 `validate`、`preflight`、headless 回归，并按环境注入 Secret。
- 增加报告脱敏规则和产物清理策略的团队级配置。
