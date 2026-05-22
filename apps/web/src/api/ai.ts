import { request } from "./request";
import { apiUrl } from "./base-url";
import { AI_MATERIAL_DRAFT_TIMEOUT_MS } from "./timeouts";

export interface AnalyzeScreenshotInput {
  screenshotPath: string;
  stepId?: string;
  error?: string;
}

export type CaseYamlAssistMode = "write" | "continue" | "optimize" | "fix";

export interface CaseYamlAssistInput {
  mode: CaseYamlAssistMode;
  caseId?: string;
  currentYaml: string;
  instruction?: string;
  validationIssues?: Array<{ path: string; message: string }>;
  files?: AiMaterialFileInput[];
}

export interface AiMaterialFileInput {
  name: string;
  mimeType?: string;
  base64: string;
}

export interface MaterialCaseDraftInput {
  caseId: string;
  caseName: string;
  description?: string;
  templateHint?: string;
  requirement?: string;
  prdText?: string;
  docUrls?: string[];
  files?: AiMaterialFileInput[];
}

export interface MaterialCaseDraftResult {
  prompt: string;
  content: string;
  sources: Array<{ title: string; length: number }>;
}

export function analyzeScreenshot(input: AnalyzeScreenshotInput): Promise<string> {
  return request.post<unknown, { content: string }>("/ai/analyze-screenshot", input).then((result) => result.content);
}

export function generateMaterialCaseDraft(input: MaterialCaseDraftInput): Promise<MaterialCaseDraftResult> {
  return request.post<unknown, MaterialCaseDraftResult>("/ai/cases/material-draft", input, {
    timeout: AI_MATERIAL_DRAFT_TIMEOUT_MS
  });
}

export async function analyzeScreenshotStream(
  input: AnalyzeScreenshotInput,
  handlers: {
    onChunk: (chunk: string) => void;
    onDone?: () => void;
    onError?: (error: Error) => void;
  }
): Promise<void> {
  return readAiEventStream("/ai/analyze-screenshot/stream", input, handlers);
}

export async function assistCaseYamlStream(
  input: CaseYamlAssistInput,
  handlers: {
    onChunk: (chunk: string) => void;
    onDone?: () => void;
    onError?: (error: Error) => void;
  }
): Promise<void> {
  return readAiEventStream("/ai/cases/assist/stream", input, handlers);
}

async function readAiEventStream(
  url: string,
  input: unknown,
  handlers: {
    onChunk: (chunk: string) => void;
    onDone?: () => void;
    onError?: (error: Error) => void;
  }
): Promise<void> {
  const response = await fetch(apiUrl(url), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input)
  });

  if (!response.ok || !response.body) {
    throw new Error(`AI 流式请求失败：HTTP ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split(/\r?\n\r?\n/);
    buffer = events.pop() ?? "";

    for (const eventText of events) {
      handleStreamEvent(eventText, handlers);
    }
  }

  const rest = decoder.decode();
  if (rest) buffer += rest;
  if (buffer.trim()) {
    handleStreamEvent(buffer, handlers);
  }
}

function handleStreamEvent(
  eventText: string,
  handlers: {
    onChunk: (chunk: string) => void;
    onDone?: () => void;
    onError?: (error: Error) => void;
  }
) {
  const eventType = eventText.match(/^event:\s*(.+)$/m)?.[1]?.trim() ?? "message";
  const data = eventText
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .join("\n");

  if (!data) return;
  const payload = JSON.parse(data) as { content?: string; done?: boolean; message?: string };

  if (eventType === "chunk" && payload.content) {
    handlers.onChunk(payload.content);
  } else if (eventType === "done" || payload.done) {
    handlers.onDone?.();
  } else if (eventType === "error") {
    handlers.onError?.(new Error(payload.message || "AI 分析失败"));
  }
}
