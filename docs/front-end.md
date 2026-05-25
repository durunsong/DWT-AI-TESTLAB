# 前端实现说明

本文记录当前 `apps/web` 的真实前端实现，不再保留早期“推荐依赖/示例页面”式说明。

## 技术栈

- React 19
- TypeScript
- Vite
- Ant Design
- Zustand
- Axios
- React Router
- Monaco Editor
- Tailwind CSS 4

当前未接入 `@tanstack/react-query` 或 `xterm.js`；日志展示使用项目内的 `LogTerminal` 组件。

## 目录结构

```text
apps/web/
  src/
    api/          Axios 请求封装和业务 API
    components/   通用组件
    config/       品牌配置
    pages/        页面模块
    router/       React Router 路由
    stores/       Zustand 状态
    styles/       全局样式
    types/        前端类型
    utils/        格式化、下载、脱敏、报告链接等工具
```

主要页面：

- `Dashboard`：运行工作台、快捷执行、近期运行信息和日志。
- `CaseList`：用例列表、AI 资料导入、共享能力选择、创建和复制用例。
- `CaseEditor`：YAML 编辑、保存、预检、执行、附件上传。
- `RunDetail`：运行状态、步骤时间线、实时日志、报告入口。
- `ReportViewer`：概览、HTML/JSON 报告、截图、日志、trace、AI 分析。
- `RunHistory`：运行历史、产物统计、单条删除、批量清理。
- `Settings`：环境变量文件、业务上下文、DB 健康检查。

## 路由

路由定义在 `apps/web/src/router/index.tsx`：

```text
/dashboard
/cases
/cases/:caseId
/runs/:runId
/reports/:runId
/history
/settings
```

桌面端或 `file:` 协议下使用 hash router，普通 Web 开发环境使用 browser router。

## API 封装

请求封装在 `apps/web/src/api/request.ts`，默认访问 `/api`，请求超时时间来自 `platform.config.json` 的 `web.requestTimeoutMs`。

主要 API 模块：

- `cases.ts`：用例列表、详情、保存、删除、校验、预检、附件。
- `test-runs.ts` / `testRuns.ts`：创建运行、查询运行、读取日志、事件流。
- `reports.ts`：报告、产物、AI 分析。
- `settings.ts`：环境配置文件。
- `context.ts`：业务上下文。
- `ai.ts`：AI 对话、草稿生成、截图分析。

## 状态管理

- `useRunStore`：当前运行状态、步骤、日志。
- `useCaseStore`：用例列表与当前用例。
- `useSettingStore`：运行环境、无头模式、慢放、trace、截图等运行设置。

环境类型为 `local | dev | sit | prod`。前端可以展示 `prod` 配置，但 runner 会阻止在生产环境执行自动化流程。

## 关键组件

- `YamlEditor`：Monaco YAML 编辑器。
- `LogTerminal`：日志展示。
- `StepTimeline`：步骤时间线。
- `RunStatusCard`：运行状态摘要。
- `RunButtonGroup`：运行按钮组。
- `ReportLinks`：报告和产物入口。
- `EnvSelector`：环境选择。
- `MarkdownViewer` / `TypewriterMarkdownViewer`：AI 内容展示。

## 构建命令

```bash
pnpm --filter @ai-e2e/web dev
pnpm --filter @ai-e2e/web typecheck
pnpm --filter @ai-e2e/web test
pnpm --filter @ai-e2e/web build
```

根目录也提供聚合命令：

```bash
pnpm dev
pnpm typecheck
pnpm test
pnpm web:build
```

## 维护约定

- 优先复用现有 API、store、组件和页面布局。
- 新增用例相关交互时同步考虑 YAML 校验、预检、执行和报告入口。
- 上传附件默认保存到 `uploads/cases/<caseId>/`，前端只写入项目相对路径。
- 不在前端写死真实环境地址、账号、token、AI Key 或 DB 配置。
- 页面文案保持中文可读，错误态、空态、加载态都要有明确反馈。
