export interface AiChatMessage {
  role: "system" | "user" | "assistant";
  content: string | AiChatContentPart[];
}

export type AiChatContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export interface AiChatOptions {
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  temperature?: number;
}

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
}

interface ChatCompletionStreamChunk {
  choices?: Array<{
    delta?: {
      content?: string;
    };
    message?: {
      content?: string;
    };
    text?: string;
  }>;
  error?: {
    message?: string;
  };
}

export function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

export function buildAuthorizationHeader(apiKey: string): string {
  const trimmed = apiKey.trim();
  return /^Bearer\s+/i.test(trimmed) ? trimmed : `Bearer ${trimmed}`;
}

export class OpenAiCompatibleClient {
  constructor(private readonly options: AiChatOptions = {}) {}

  async chat(messages: AiChatMessage[]): Promise<string> {
    const baseUrl = this.options.baseUrl ?? process.env.AI_BASE_URL;
    const apiKey = this.options.apiKey ?? process.env.AI_API_KEY;
    const model = this.options.model ?? process.env.AI_MODEL;

    if (!baseUrl) {
      throw new Error("AI_BASE_URL 未配置");
    }
    if (!apiKey) {
      throw new Error("AI_API_KEY 未配置");
    }
    if (!model) {
      throw new Error("AI_MODEL 未配置");
    }

    const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
    const response = await fetch(`${normalizedBaseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: buildAuthorizationHeader(apiKey)
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: this.options.temperature ?? 0.2,
        stream: false
      })
    }).catch((error: unknown) => {
      throw new Error(buildFetchFailureMessage(normalizedBaseUrl, error));
    });

    const payload = (await response.json()) as ChatCompletionResponse;
    if (!response.ok) {
      throw new Error(payload.error?.message ?? `AI 请求失败：HTTP ${response.status}`);
    }

    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("AI 响应为空");
    }
    return content;
  }

  async *chatStream(messages: AiChatMessage[]): AsyncGenerator<string> {
    const baseUrl = this.options.baseUrl ?? process.env.AI_BASE_URL;
    const apiKey = this.options.apiKey ?? process.env.AI_API_KEY;
    const model = this.options.model ?? process.env.AI_MODEL;

    if (!baseUrl) {
      throw new Error("AI_BASE_URL 未配置");
    }
    if (!apiKey) {
      throw new Error("AI_API_KEY 未配置");
    }
    if (!model) {
      throw new Error("AI_MODEL 未配置");
    }

    const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
    const response = await fetch(`${normalizedBaseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: buildAuthorizationHeader(apiKey)
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: this.options.temperature ?? 0.2,
        stream: true
      })
    }).catch((error: unknown) => {
      throw new Error(buildFetchFailureMessage(normalizedBaseUrl, error));
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as ChatCompletionResponse | null;
      throw new Error(payload?.error?.message ?? `AI 请求失败：HTTP ${response.status}`);
    }
    if (!response.body) {
      throw new Error("AI 流式响应为空");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const content = parseStreamLine(line);
        if (content === "[DONE]") return;
        if (content) yield content;
      }
    }

    const rest = decoder.decode();
    if (rest) buffer += rest;
    if (buffer.trim()) {
      const content = parseStreamLine(buffer);
      if (content && content !== "[DONE]") yield content;
    }
  }
}

function parseStreamLine(line: string): string {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith(":")) return "";
  if (trimmed.startsWith("event:")) return "";
  const data = trimmed.startsWith("data:") ? trimmed.slice(5).trim() : trimmed;
  if (!data) return "";
  if (data === "[DONE]") return "[DONE]";

  try {
    const payload = JSON.parse(data) as ChatCompletionStreamChunk;
    if (payload.error?.message) {
      throw new Error(payload.error.message);
    }
    const choice = payload.choices?.[0];
    return choice?.delta?.content ?? choice?.message?.content ?? choice?.text ?? "";
  } catch (error) {
    if (error instanceof Error && error.message !== "Unexpected end of JSON input") {
      throw error;
    }
    return "";
  }
}

export function buildFetchFailureMessage(baseUrl: string, error: unknown): string {
  const cause = error instanceof Error
    ? formatFetchCause(error.cause ?? error)
    : String(error);
  return [
    `AI 请求网络失败：无法连接 ${baseUrl}/chat/completions。`,
    "请检查 AI_BASE_URL 是否正确、当前网络/代理/VPN 是否可访问该地址，以及服务证书或网关是否正常。",
    cause ? `底层错误：${cause}` : ""
  ].filter(Boolean).join(" ");
}

function formatFetchCause(error: unknown): string {
  if (!error || typeof error !== "object") {
    return String(error);
  }

  const detail = error as { code?: string; message?: string };
  return [detail.code, detail.message].filter(Boolean).join(" ");
}
