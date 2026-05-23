import fs from "node:fs/promises";
import type { FastifyInstance } from "fastify";
import { megabytesToBytes, type PlatformConfig } from "@ai-e2e/runner";
import {
  buildCaseGenerationPrompt,
  buildMaterialCaseGenerationPrompt,
  buildCaseYamlAssistPrompt,
  buildScreenshotAnalysisMessages,
  OpenAiCompatibleClient,
  type AiChatMessage
} from "@ai-e2e/ai-generator";
import { extractMaterialFiles, fetchMaterialLinks, imageMaterialToDataUrl, isImageMaterialFile, type AiMaterialFile } from "../services/ai-material.service";
import { imageMimeType, resolveScreenshotPath } from "../services/ai-screenshot";
import type { AiReportService } from "../services/ai-report.service";
import { ok } from "../utils/response";

export async function registerAiRoutes(app: FastifyInstance, rootDir: string, platformConfig: PlatformConfig, aiReportService?: AiReportService): Promise<void> {
  const materialBodyLimit = Math.max(megabytesToBytes(platformConfig.uploads.materialFileMaxMb) * 2, 1024 * 1024);

  app.post<{ Body: { requirement: string } }>("/api/ai/prompts/case", async (request) => {
    return ok({ prompt: buildCaseGenerationPrompt(request.body.requirement) });
  });

  app.post<{ Body: { messages: AiChatMessage[] } }>("/api/ai/chat", async (request) => {
    const client = new OpenAiCompatibleClient();
    return ok({ content: await client.chat(request.body.messages) });
  });

  app.post<{ Body: { screenshotPath: string; runId?: string; stepId?: string; error?: string } }>(
    "/api/ai/analyze-screenshot",
    async (request) => {
      const filePath = resolveScreenshotPath(rootDir, request.body.screenshotPath, platformConfig);
      const image = await fs.readFile(filePath);
      const imageDataUrl = `data:${imageMimeType(filePath)};base64,${image.toString("base64")}`;
      const client = new OpenAiCompatibleClient();
      const content = await client.chat(buildScreenshotAnalysisMessages({
        imageDataUrl,
        stepId: request.body.stepId,
        error: request.body.error
      }));
      await saveManualScreenshotAnalysis(aiReportService, {
        runId: request.body.runId,
        stepId: request.body.stepId,
        screenshotPath: request.body.screenshotPath,
        content
      }).catch(() => undefined);

      return ok({
        content
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

  app.post<{
    Body: {
      caseId: string;
      caseName: string;
      description?: string;
      templateHint?: string;
      requirement?: string;
      prdText?: string;
      docUrls?: string[];
      files?: AiMaterialFile[];
      sharedAbilities?: Array<{
        sharedId: string;
        name: string;
        description?: string;
        params: Array<{ name: string; required?: boolean; defaultValue?: string; description?: string }>;
        stepCount: number;
        file: string;
      }>;
    };
  }>("/api/ai/cases/material-draft", { bodyLimit: materialBodyLimit }, async (request) => {
    const sources = [
      request.body.prdText?.trim()
        ? { title: "粘贴的 PRD / 需求说明", content: request.body.prdText.trim() }
        : undefined,
      ...await fetchMaterialLinks(request.body.docUrls, platformConfig.uploads),
      ...await extractMaterialFiles(request.body.files, platformConfig.uploads)
    ].filter((item): item is { title: string; content: string } => Boolean(item?.content));
    const imageMaterials = (request.body.files ?? [])
      .filter(isImageMaterialFile)
      .map((file) => imageMaterialToDataUrl(file, platformConfig.uploads));

    if (!sources.length && !imageMaterials.length && !request.body.requirement?.trim()) {
      throw new Error("请至少提供 PRD 文本、文档链接、上传文件或补充要求中的一项");
    }

    const prompt = buildMaterialCaseGenerationPrompt({
      caseId: request.body.caseId,
      caseName: request.body.caseName,
      description: request.body.description,
      templateHint: request.body.templateHint,
      requirement: request.body.requirement,
      materials: sources,
      sharedAbilities: request.body.sharedAbilities
    });
    const client = new OpenAiCompatibleClient({ temperature: 0.12 });
    const userContent: AiChatMessage["content"] = imageMaterials.length
      ? [
        { type: "text", text: [
          prompt,
          "",
          "以下图片资料可能包含产品原型、流程图、页面截图或字段说明。请结合图片理解业务流程、页面元素和断言点。"
        ].join("\n") },
        ...imageMaterials.flatMap((item) => [
          { type: "text" as const, text: item.title },
          { type: "image_url" as const, image_url: { url: item.dataUrl } }
        ])
      ]
      : prompt;

    return ok({
      prompt,
      sources: [
        ...sources.map((item) => ({ title: item.title, length: item.content.length })),
        ...imageMaterials.map((item) => ({ title: item.title, length: item.dataUrl.length }))
      ],
      content: await client.chat([
        { role: "system", content: "你是自动化测试 DSL 生成器，只输出 YAML 正文，不要输出解释。" },
        { role: "user", content: userContent }
      ])
    });
  });

  app.post<{
    Body: {
      mode: "write" | "continue" | "optimize" | "fix";
      caseId?: string;
      currentYaml: string;
      instruction?: string;
      validationIssues?: Array<{ path: string; message: string }>;
      files?: AiMaterialFile[];
    };
  }>("/api/ai/cases/assist", { bodyLimit: materialBodyLimit }, async (request) => {
    const sources = await extractMaterialFiles(request.body.files, platformConfig.uploads);
    const imageMaterials = (request.body.files ?? [])
      .filter(isImageMaterialFile)
      .map((file) => imageMaterialToDataUrl(file, platformConfig.uploads));
    const prompt = appendAssistMaterials(buildCaseYamlAssistPrompt(request.body), sources, imageMaterials);
    const client = new OpenAiCompatibleClient({ temperature: 0.15 });
    const userContent: AiChatMessage["content"] = imageMaterials.length
      ? [
        { type: "text", text: prompt },
        ...imageMaterials.flatMap((item) => [
          { type: "text" as const, text: item.title },
          { type: "image_url" as const, image_url: { url: item.dataUrl } }
        ])
      ]
      : prompt;

    return ok({
      content: await client.chat([
        { role: "system", content: "你是自动化测试 DSL 编辑助手。你必须只输出最终 YAML 正文，不输出解释。" },
        { role: "user", content: userContent }
      ])
    });
  });
}

async function saveManualScreenshotAnalysis(
  aiReportService: AiReportService | undefined,
  input: { runId?: string; stepId?: string; screenshotPath: string; content: string }
): Promise<void> {
  if (!aiReportService || !input.runId || !input.stepId || !input.content.trim()) {
    return;
  }
  await aiReportService.saveAnalysis({
    runId: input.runId,
    stepId: input.stepId,
    source: "manual_screenshot",
    status: "completed",
    content: input.content,
    screenshot: input.screenshotPath
  });
}

function appendAssistMaterials(
  prompt: string,
  sources: Array<{ title: string; content: string }>,
  imageMaterials: Array<{ title: string; dataUrl: string }>
): string {
  if (!sources.length && !imageMaterials.length) {
    return prompt;
  }

  const sections = [
    prompt,
    "",
    "AI 对话临时上传资料（仅用于本次生成，不保存为用例附件）："
  ];

  for (const source of sources) {
    sections.push("", `## ${source.title}`, source.content);
  }

  if (imageMaterials.length) {
    sections.push(
      "",
      "以下图片资料会以图片形式随本次对话发送，请结合图片理解页面元素、上传控件、字段和断言点。",
      ...imageMaterials.map((item) => `- ${item.title}`)
    );
  }

  return sections.join("\n");
}
