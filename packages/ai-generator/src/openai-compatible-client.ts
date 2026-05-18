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
