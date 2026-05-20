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
    "1. 结论",
    "2. 关键证据",
    "3. 后端/接口返回解读",
    "4. 用例或定位问题",
    "5. 建议修改方案",
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
