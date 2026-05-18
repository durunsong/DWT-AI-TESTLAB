import fs from "node:fs/promises";
import type { FastifyInstance } from "fastify";
import {
  buildCaseGenerationPrompt,
  buildScreenshotAnalysisMessages,
  OpenAiCompatibleClient,
  type AiChatMessage
} from "@ai-e2e/ai-generator";
import { imageMimeType, resolveScreenshotPath } from "../services/ai-screenshot";
import { ok } from "../utils/response";

export async function registerAiRoutes(app: FastifyInstance, rootDir: string): Promise<void> {
  app.post<{ Body: { requirement: string } }>("/api/ai/prompts/case", async (request) => {
    return ok({ prompt: buildCaseGenerationPrompt(request.body.requirement) });
  });

  app.post<{ Body: { messages: AiChatMessage[] } }>("/api/ai/chat", async (request) => {
    const client = new OpenAiCompatibleClient();
    return ok({ content: await client.chat(request.body.messages) });
  });

  app.post<{ Body: { screenshotPath: string; stepId?: string; error?: string } }>(
    "/api/ai/analyze-screenshot",
    async (request) => {
      const filePath = resolveScreenshotPath(rootDir, request.body.screenshotPath);
      const image = await fs.readFile(filePath);
      const imageDataUrl = `data:${imageMimeType(filePath)};base64,${image.toString("base64")}`;
      const client = new OpenAiCompatibleClient();

      return ok({
        content: await client.chat(buildScreenshotAnalysisMessages({
          imageDataUrl,
          stepId: request.body.stepId,
          error: request.body.error
        }))
      });
    }
  );

  app.post<{ Body: { requirement: string } }>("/api/ai/cases/draft", async (request) => {
    const prompt = buildCaseGenerationPrompt(request.body.requirement);
    const client = new OpenAiCompatibleClient();
    return ok({
      prompt,
      content: await client.chat([
        { role: "system", content: "你是自动化测试 DSL 生成器，只输出 YAML 草稿，不要输出解释。" },
        { role: "user", content: prompt }
      ])
    });
  });
}
