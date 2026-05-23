import type { AiChatMessage } from "./openai-compatible-client";
import { appBrandName } from "./brand";

export interface ScreenshotAnalysisInput {
  imageDataUrl: string;
  stepId?: string;
  error?: string;
}

export interface FailureAnalysisInput {
  imageDataUrl?: string;
  runId: string;
  caseId: string;
  env: string;
  failedStep: unknown;
  logsTail?: string;
  scenarioYaml?: string;
  locationYaml?: string;
}

export function buildScreenshotAnalysisMessages(input: ScreenshotAnalysisInput): AiChatMessage[] {
  const context = [
    `step_id: ${input.stepId || "-"}`,
    `error: ${input.error || "-"}`
  ].join("\n");

  return [
    {
      role: "system",
      content: [
        `你是 ${appBrandName()} 自动化测试的视觉诊断助手。`,
        "根据失败截图判断页面当前状态、自动化失败原因、下一步应该点击或输入的位置。",
        "只输出简洁的中文分析，不要输出账号、密码、token、cookie 等敏感信息。"
      ].join("\n")
    },
    {
      role: "user",
      content: [
        {
          type: "text",
          text: [
            "请分析这张失败截图，按以下格式返回：",
            "1. 页面状态",
            "2. 失败原因",
            "3. 建议点击/输入目标",
            "4. 建议修改的 location/YAML 定位策略",
            "",
            context
          ].join("\n")
        },
        {
          type: "image_url",
          image_url: {
            url: input.imageDataUrl
          }
        }
      ]
    }
  ];
}

export function buildFailureAnalysisMessages(input: FailureAnalysisInput): AiChatMessage[] {
  const text = [
    "请分析这次自动化失败，按以下格式用简体中文返回：",
    "1. 开发处理摘要",
    "   - 归因建议：前端 / 后端 / 测试用例 / 环境数据 / 暂不确定",
    "   - 建议处理人：具体到前端开发、后端开发、测试同学或环境负责人",
    "   - 复现方式：包含环境、runId、caseId、失败步骤和关键入口",
    "   - 建议修改点：指出应检查的接口、页面元素、YAML、location 或数据条件",
    "2. 结论",
    "3. 关键证据",
    "4. 后端/接口返回解读",
    "5. 用例或定位问题",
    "6. 建议修改方案",
    "",
    "分析要求：",
    "- 如果 failedStep.data.diagnostics.recentActionDiagnostics 存在，请优先作为动作诊断依据；input_value.matched=false 通常表示页面实际值和用例期望值不一致，可能是人工干预、页面异步覆盖或输入未生效。",
    "- 如果接口诊断里包含 requestPostData/requestJson，请结合接口请求参数、HTTP 状态、业务码和响应内容判断是前端提交参数问题、后端业务失败还是测试数据问题。",
    "- 对账号、密码、token、cookie 等敏感信息只描述是否一致、是否为空、长度等摘要，不要输出原文。",
    "",
    `runId: ${input.runId}`,
    `caseId: ${input.caseId}`,
    `env: ${input.env}`,
    "",
    "失败步骤：",
    JSON.stringify(input.failedStep, null, 2),
    "",
    "日志尾部：",
    input.logsTail || "-",
    "",
    "scenario YAML：",
    input.scenarioYaml || "-",
    "",
    "location YAML：",
    input.locationYaml || "-"
  ].join("\n");

  const content: AiChatMessage["content"] = input.imageDataUrl
    ? [
      { type: "text", text },
      { type: "image_url", image_url: { url: input.imageDataUrl } }
    ]
    : text;

  return [
    {
      role: "system",
      content: [
        `你是 ${appBrandName()} 自动化测试失败诊断助手。`,
        "你需要结合日志、接口响应、用例 YAML、定位文件和失败截图判断根因。",
        "你需要重点阅读动作诊断和接口请求参数，识别人工干预、输入值被覆盖、请求参数不符合预期等异常。",
        "优先指出真实业务/后端错误，其次指出自动化等待、定位、断言或用例生成问题。",
        "不要输出账号、密码、token、cookie 等敏感信息。"
      ].join("\n")
    },
    {
      role: "user",
      content
    }
  ];
}
