# Contributing

感谢你愿意改进 DWT Testing。这个项目优先追求可维护、可诊断、可回滚的工程质量。

## 本地开发

```bash
pnpm install
cp .env.example .env
pnpm dev
```

提交前建议执行：

```bash
pnpm typecheck
pnpm test
pnpm dwt validate
```

也可以直接运行：

```bash
pnpm ci:check
```

## 贡献规则

- 不提交真实账号、密码、token、证书、生产地址和本地 `.env*`。
- 不提交 `dist/`、`node_modules/`、`reports/`、`logs/`、`screenshots/`、`traces/`、`uploads/` 等运行产物。
- 新增 DSL 字段时，同步更新 Zod Schema、类型、示例、预检和文档。
- 修改执行器时，补充对应单元测试或最小可复现 YAML。
- 涉及 DB 能力时，保持只读默认；不要绕过 SQL 安全拦截。
- 面向模板使用者的配置必须使用占位值和清晰注释。

## Pull Request 建议

- 说明问题背景和变更范围。
- 列出已执行的验证命令。
- 对破坏性变更给出迁移说明。
- 文案和文档使用 UTF-8，中文必须可读。
