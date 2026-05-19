import type { AiChatMessage } from "./openai-compatible-client";
import { appBrandName } from "./brand";

export interface ScreenshotAnalysisInput {
  imageDataUrl: string;
  stepId?: string;
  error?: string;
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
