## 1. 推荐前端架构

```text
apps/web/
├─ src/
│  ├─ main.tsx
│  ├─ App.tsx
│  ├─ router/
│  │  └─ index.tsx
│  ├─ api/
│  │  ├─ request.ts
│  │  ├─ cases.ts
│  │  ├─ testRuns.ts
│  │  └─ reports.ts
│  ├─ stores/
│  │  ├─ useRunStore.ts
│  │  ├─ useCaseStore.ts
│  │  └─ useSettingStore.ts
│  ├─ pages/
│  │  ├─ Dashboard/
│  │  │  └─ index.tsx
│  │  ├─ CaseList/
│  │  │  └─ index.tsx
│  │  ├─ CaseEditor/
│  │  │  └─ index.tsx
│  │  ├─ RunDetail/
│  │  │  └─ index.tsx
│  │  ├─ ReportViewer/
│  │  │  └─ index.tsx
│  │  └─ Settings/
│  │     └─ index.tsx
│  ├─ components/
│  │  ├─ EnvSelector.tsx
│  │  ├─ RunButtonGroup.tsx
│  │  ├─ RunStatusCard.tsx
│  │  ├─ StepTimeline.tsx
│  │  ├─ LogTerminal.tsx
│  │  ├─ YamlEditor.tsx
│  │  ├─ ReportLinks.tsx
│  │  └─ PageHeader.tsx
│  ├─ types/
│  │  ├─ case.ts
│  │  ├─ run.ts
│  │  └─ report.ts
│  ├─ utils/
│  │  ├─ format.ts
│  │  ├─ mask.ts
│  │  └─ download.ts
│  └─ styles/
│     └─ index.css
├─ package.json
└─ vite.config.ts
```

---

## 2. 推荐依赖

### P0 必装

```bash
pnpm add react react-dom react-router-dom
pnpm add antd @ant-design/icons
pnpm add zustand axios dayjs
```

用途：

```text
react / react-dom：React 基础
react-router-dom：页面路由
antd：后台控制台 UI 组件
@ant-design/icons：图标
zustand：轻量状态管理
axios：请求后端 API
dayjs：时间格式化
```

---

## 3. 服务端请求管理

### P0 简单版

```bash
pnpm add axios
```

P0 用 `axios + Zustand` 就够。

### P1 推荐加 TanStack Query

```bash
pnpm add @tanstack/react-query
```

适合：

```text
用例列表缓存
执行状态轮询
报告查询
日志查询
失败重试
```

我的建议：

```text
P0：axios + Zustand
P1：加 @tanstack/react-query
```

---

## 4. YAML 编辑器

推荐：

```bash
pnpm add @monaco-editor/react monaco-editor
```

用于：

```text
编辑 cases/scenario/*.yaml
编辑 cases/location/*.yaml
展示 AI 生成的 YAML
展示 DSL 校验错误
```

组件示例：

```tsx
import Editor from '@monaco-editor/react'

export function YamlEditor() {
  return (
    <Editor
      height="70vh"
      defaultLanguage="yaml"
      theme="vs-dark"
      value=""
      options={{
        fontSize: 14,
        minimap: { enabled: false },
        wordWrap: 'on',
      }}
    />
  )
}
```

---

## 5. 实时日志

### P0：普通日志面板

先用这个就够：

```tsx
export function LogPanel({ logs }: { logs: string[] }) {
  return (
    <pre
      style={{
        height: 320,
        overflow: 'auto',
        background: '#111827',
        color: '#d1d5db',
        padding: 16,
        borderRadius: 8,
      }}
    >
      {logs.join('\n')}
    </pre>
  )
}
```

### P1：xterm.js

```bash
pnpm add @xterm/xterm @xterm/addon-fit
```

用于做真正终端效果。

---

## 6. 页面规划

### Dashboard 首页

```text
环境选择：local/dev/test/sit
流程按钮：
- user 登录流程
- admin 登录流程
- KYC 提交流程
- KYC 提交 + admin 审核完整流程

执行状态：
- runId
- caseId
- 当前步骤
- 总步骤
- 成功数
- 失败数
- 总耗时

底部：
- 实时日志
- 报告链接
```

Ant Design 组件建议：

```text
Card
Button
Tag
Progress
Statistic
Timeline
Tabs
Alert
Space
Select
Table
Drawer
Modal
```

---

### CaseList 用例列表

```text
展示 cases/scenario/*.yaml
支持：
- 查看
- 编辑
- 执行
- 删除，可选
- 复制为新用例
```

---

### CaseEditor 用例编辑器

```text
左侧 Monaco YAML 编辑器
右侧 DSL 校验结果
底部按钮：
- 保存
- 校验
- 执行
- AI 生成
```

---

### RunDetail 执行详情

```text
展示：
- 步骤时间线
- 每一步状态
- 失败截图
- trace 链接
- 日志
- 报告
```

---

### ReportViewer 报告页

```text
展示：
- HTML 报告 iframe
- JSON 报告格式化
- 截图列表
- trace 文件链接
```

---

## 7. Zustand 状态设计

### useRunStore.ts

```ts
import { create } from 'zustand'

export type RunStatus = 'idle' | 'running' | 'passed' | 'failed'

interface RunState {
  runId: string
  caseId: string
  status: RunStatus
  currentStep: string
  total: number
  passed: number
  failed: number
  logs: string[]
  setRun: (data: Partial<RunState>) => void
  appendLog: (log: string) => void
  reset: () => void
}

export const useRunStore = create<RunState>((set) => ({
  runId: '',
  caseId: '',
  status: 'idle',
  currentStep: '',
  total: 0,
  passed: 0,
  failed: 0,
  logs: [],
  setRun: (data) => set(data),
  appendLog: (log) =>
    set((state) => ({
      logs: [...state.logs, log],
    })),
  reset: () =>
    set({
      runId: '',
      caseId: '',
      status: 'idle',
      currentStep: '',
      total: 0,
      passed: 0,
      failed: 0,
      logs: [],
    }),
}))
```

---

### useSettingStore.ts

```ts
import { create } from 'zustand'

type TestEnv = 'local' | 'dev' | 'test' | 'sit'

interface SettingState {
  env: TestEnv
  headless: boolean
  slowMo: number
  setEnv: (env: TestEnv) => void
  setHeadless: (headless: boolean) => void
  setSlowMo: (slowMo: number) => void
}

export const useSettingStore = create<SettingState>((set) => ({
  env: 'local',
  headless: false,
  slowMo: 100,
  setEnv: (env) => set({ env }),
  setHeadless: (headless) => set({ headless }),
  setSlowMo: (slowMo) => set({ slowMo }),
}))
```

---

## 8. axios 封装

```ts
// src/api/request.ts
import axios from 'axios'

export const request = axios.create({
  baseURL: '/api',
  timeout: 30000,
})

request.interceptors.response.use(
  (response) => response.data,
  (error) => {
    return Promise.reject(error)
  },
)
```

---

## 9. testRuns API

```ts
// src/api/testRuns.ts
import { request } from './request'

export interface CreateTestRunParams {
  caseId: string
  env: string
}

export function createTestRun(data: CreateTestRunParams) {
  return request.post('/test-runs', data)
}

export function getTestRun(runId: string) {
  return request.get(`/test-runs/${runId}`)
}

export function getTestRunLogs(runId: string) {
  return request.get(`/test-runs/${runId}/logs`)
}

export function getTestRunReport(runId: string) {
  return request.get(`/test-runs/${runId}/report`)
}
```

---

## 10. Dashboard 页面示例

```tsx
import { Button, Card, Col, Progress, Row, Select, Space, Statistic, Tag } from 'antd'
import { createTestRun } from '@/api/testRuns'
import { useRunStore } from '@/stores/useRunStore'
import { useSettingStore } from '@/stores/useSettingStore'

const flowButtons = [
  { label: 'user 登录流程', caseId: 'login_user' },
  { label: 'admin 登录流程', caseId: 'login_admin' },
  { label: 'KYC 提交流程', caseId: 'kyc_submit' },
  { label: 'KYC 提交 + admin 审核完整流程', caseId: 'kyc_submit_and_approve' },
]

export default function Dashboard() {
  const { env, setEnv } = useSettingStore()
  const { status, runId, caseId, currentStep, total, passed, failed, setRun } = useRunStore()

  const handleRun = async (targetCaseId: string) => {
    const res: any = await createTestRun({
      caseId: targetCaseId,
      env,
    })

    setRun({
      runId: res.runId,
      caseId: targetCaseId,
      status: 'running',
    })
  }

  return (
    <div style={{ padding: 24 }}>
      <Card title="AI 自动化测试平台">
        <Space orientation="vertical" size={24} style={{ width: '100%' }}>
          <Space>
            <span>测试环境：</span>
            <Select
              value={env}
              style={{ width: 160 }}
              onChange={setEnv}
              options={[
                { label: 'local', value: 'local' },
                { label: 'dev', value: 'dev' },
                { label: 'test', value: 'test' },
                { label: 'sit', value: 'sit' },
              ]}
            />
          </Space>

          <Space wrap>
            {flowButtons.map((item) => (
              <Button
                key={item.caseId}
                type="primary"
                loading={status === 'running' && caseId === item.caseId}
                onClick={() => handleRun(item.caseId)}
              >
                {item.label}
              </Button>
            ))}
          </Space>
        </Space>
      </Card>

      <Row gutter={16} style={{ marginTop: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic title="当前 RunId" value={runId || '-'} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="当前用例" value={caseId || '-'} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="当前步骤" value={currentStep || '-'} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Tag color={status === 'passed' ? 'green' : status === 'failed' ? 'red' : 'blue'}>
              {status}
            </Tag>
          </Card>
        </Col>
      </Row>

      <Card title="执行进度" style={{ marginTop: 16 }}>
        <Progress
          percent={total > 0 ? Math.round(((passed + failed) / total) * 100) : 0}
          status={failed > 0 ? 'exception' : status === 'passed' ? 'success' : 'active'}
        />
      </Card>
    </div>
  )
}
```

---

## 11. vite.config.ts

```ts
import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5174,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: 'http://localhost:7001',
        changeOrigin: true,
      },
    },
  },
})
```

---

## 12. package.json 脚本

```json
{
  "scripts": {
    "dev": "vite --host 0.0.0.0",
    "build": "tsc -b && vite build",
    "preview": "vite preview"
  }
}
```

---

## 13. React 版 AI 提示词补充

你之前那份总提示词里，把前端部分替换成下面这段：

```md
【前端技术栈要求】
前端使用 React 生态：
- React
- TypeScript
- Vite
- Ant Design
- Zustand
- React Router
- Axios
- Monaco Editor
- P0 阶段日志展示先使用 pre/code 面板
- P1 阶段再接入 xterm.js
- P1 阶段可接入 @tanstack/react-query 管理服务端状态

【前端目录要求】
apps/web/
├─ src/
│  ├─ main.tsx
│  ├─ App.tsx
│  ├─ router/
│  │  └─ index.tsx
│  ├─ api/
│  │  ├─ request.ts
│  │  ├─ cases.ts
│  │  ├─ testRuns.ts
│  │  └─ reports.ts
│  ├─ stores/
│  │  ├─ useRunStore.ts
│  │  ├─ useCaseStore.ts
│  │  └─ useSettingStore.ts
│  ├─ pages/
│  │  ├─ Dashboard/
│  │  │  └─ index.tsx
│  │  ├─ CaseList/
│  │  │  └─ index.tsx
│  │  ├─ CaseEditor/
│  │  │  └─ index.tsx
│  │  ├─ RunDetail/
│  │  │  └─ index.tsx
│  │  ├─ ReportViewer/
│  │  │  └─ index.tsx
│  │  └─ Settings/
│  │     └─ index.tsx
│  ├─ components/
│  │  ├─ EnvSelector.tsx
│  │  ├─ RunButtonGroup.tsx
│  │  ├─ RunStatusCard.tsx
│  │  ├─ StepTimeline.tsx
│  │  ├─ LogTerminal.tsx
│  │  ├─ YamlEditor.tsx
│  │  ├─ ReportLinks.tsx
│  │  └─ PageHeader.tsx
│  ├─ types/
│  │  ├─ case.ts
│  │  ├─ run.ts
│  │  └─ report.ts
│  ├─ utils/
│  │  ├─ format.ts
│  │  ├─ mask.ts
│  │  └─ download.ts
│  └─ styles/
│     └─ index.css

【前端页面要求】
1. Dashboard：测试流程按钮、环境选择、执行状态、实时日志。
2. CaseList：展示 cases/scenario/*.yaml，用例查看、编辑、执行。
3. CaseEditor：Monaco Editor 编辑 YAML，右侧展示 DSL 校验结果。
4. RunDetail：步骤时间线、截图、日志、trace、失败原因。
5. ReportViewer：HTML 报告 iframe 预览、JSON 报告查看。
6. Settings：环境配置、headless、slowMo、trace、screenshot 设置。

【前端 UI 要求】
使用 Ant Design：
- Card
- Button
- Tag
- Progress
- Statistic
- Timeline
- Table
- Tabs
- Drawer
- Modal
- Select
- Space
- Alert

【状态管理】
使用 Zustand：
- useRunStore：当前执行任务状态、runId、caseId、当前步骤、日志。
- useCaseStore：用例列表、当前 YAML 内容。
- useSettingStore：当前环境、headless、slowMo。

【接口请求】
使用 Axios 封装：
- GET /api/cases
- POST /api/test-runs
- GET /api/test-runs/:runId
- GET /api/test-runs/:runId/report
- GET /api/test-runs/:runId/logs
```

---

## 14. 最终推荐

你用 React 生态的话，我推荐最终定为：

```text
React 18/19 + TypeScript + Vite
Ant Design
Zustand
Axios
React Router
Monaco Editor
P0 日志用 pre/code
P1 日志换 xterm.js
P1 状态请求换 TanStack Query
```

这套最适合你这个项目，能快速出效果，也方便后续扩展成真正的平台。
