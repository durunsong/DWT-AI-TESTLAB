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
  timeoutMs?: number;
  maxRetries?: number;
  retryDelayMs?: number;
  fetch?: typeof fetch;
}

export type AiErrorCategory =
  | "config"
  | "network"
  | "timeout"
  | "auth"
  | "rate_limit"
  | "server"
  | "invalid_response"
  | "unknown";

export interface AiUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface AiChatResult {
  content: string;
  usage?: AiUsage;
  model?: string;
}

export class AiClientError extends Error {
  constructor(
    message: string,
    readonly category: AiErrorCategory,
    readonly retryable: boolean,
    readonly status?: number
  ) {
    super(message);
    this.name = "AiClientError";
  }
}

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  model?: string;
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
    return (await this.chatWithMetadata(messages)).content;
  }

  async chatWithMetadata(messages: AiChatMessage[]): Promise<AiChatResult> {
    const config = this.resolveConfig();
    const payload = await this.withRetries(() => this.requestJson(config, messages));
    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      throw new AiClientError("AI 响应为空或格式不符合预期", "invalid_response", false);
    }
    return {
      content,
      usage: normalizeUsage(payload.usage),
      model: payload.model
    };
  }

  async *chatStream(messages: AiChatMessage[]): AsyncGenerator<string> {
    const config = this.resolveConfig();
    const response = await this.withRetries(() => this.requestStream(config, messages));
    if (!response.body) {
      throw new AiClientError("AI 流式响应为空", "invalid_response", false, response.status);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      let chunk: ReadableStreamReadResult<Uint8Array>;
      try {
        chunk = await reader.read();
      } catch (error) {
        throw new AiClientError(`AI 流式响应中断：${formatFetchCause(error)}`, "network", true);
      }
      if (chunk.done) break;

      buffer += decoder.decode(chunk.value, { stream: true });
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

  private resolveConfig(): Required<Pick<AiChatOptions, "baseUrl" | "apiKey" | "model">> & {
    temperature: number;
    timeoutMs: number;
    maxRetries: number;
    retryDelayMs: number;
    fetch: typeof fetch;
  } {
    const baseUrl = this.options.baseUrl ?? process.env.AI_BASE_URL;
    const apiKey = this.options.apiKey ?? process.env.AI_API_KEY;
    const model = this.options.model ?? process.env.AI_MODEL;

    if (!baseUrl) {
      throw new AiClientError("AI_BASE_URL 未配置", "config", false);
    }
    if (!apiKey) {
      throw new AiClientError("AI_API_KEY 未配置", "config", false);
    }
    if (!model) {
      throw new AiClientError("AI_MODEL 未配置", "config", false);
    }

    return {
      baseUrl: normalizeBaseUrl(baseUrl),
      apiKey,
      model,
      temperature: this.options.temperature ?? 0.2,
      timeoutMs: positiveNumber(this.options.timeoutMs ?? process.env.AI_TIMEOUT_MS, 60_000),
      maxRetries: nonNegativeInteger(this.options.maxRetries ?? process.env.AI_MAX_RETRIES, 2),
      retryDelayMs: nonNegativeInteger(this.options.retryDelayMs ?? process.env.AI_RETRY_DELAY_MS, 1_000),
      fetch: this.options.fetch ?? fetch
    };
  }

  private async requestJson(
    config: ReturnType<OpenAiCompatibleClient["resolveConfig"]>,
    messages: AiChatMessage[]
  ): Promise<ChatCompletionResponse> {
    const response = await this.fetchCompletion(config, messages, false);
    const payload = (await response.json().catch(() => null)) as ChatCompletionResponse | null;
    if (!response.ok) {
      throw httpError(response.status, payload?.error?.message);
    }
    if (!payload || !Array.isArray(payload.choices)) {
      throw new AiClientError("AI 响应 JSON 结构不符合预期", "invalid_response", false, response.status);
    }
    return payload;
  }

  private async requestStream(
    config: ReturnType<OpenAiCompatibleClient["resolveConfig"]>,
    messages: AiChatMessage[]
  ): Promise<Response> {
    const response = await this.fetchCompletion(config, messages, true);
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as ChatCompletionResponse | null;
      throw httpError(response.status, payload?.error?.message);
    }
    return response;
  }

  private async fetchCompletion(
    config: ReturnType<OpenAiCompatibleClient["resolveConfig"]>,
    messages: AiChatMessage[],
    stream: boolean
  ): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
    try {
      return await config.fetch(`${config.baseUrl}/chat/completions`, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: buildAuthorizationHeader(config.apiKey)
        },
        body: JSON.stringify({
          model: config.model,
          messages,
          temperature: config.temperature,
          stream
        })
      });
    } catch (error) {
      if (isAbortError(error)) {
        throw new AiClientError(`AI 请求超时：${config.timeoutMs}ms`, "timeout", true);
      }
      throw new AiClientError(buildFetchFailureMessage(config.baseUrl, error), "network", true);
    } finally {
      clearTimeout(timeout);
    }
  }

  private async withRetries<T>(operation: () => Promise<T>): Promise<T> {
    const maxRetries = nonNegativeInteger(this.options.maxRetries ?? process.env.AI_MAX_RETRIES, 2);
    const retryDelayMs = nonNegativeInteger(this.options.retryDelayMs ?? process.env.AI_RETRY_DELAY_MS, 1_000);
    let attempt = 0;
    while (true) {
      try {
        return await operation();
      } catch (error) {
        const normalized = toAiClientError(error);
        if (!normalized.retryable || attempt >= maxRetries) {
          throw normalized;
        }
        attempt += 1;
        await sleep(retryDelayMs * attempt);
      }
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

function httpError(status: number, message?: string): AiClientError {
  if (status === 401 || status === 403) {
    return new AiClientError(message ?? `AI 鉴权失败：HTTP ${status}`, "auth", false, status);
  }
  if (status === 429) {
    return new AiClientError(message ?? "AI 请求触发限流", "rate_limit", true, status);
  }
  if (status >= 500) {
    return new AiClientError(message ?? `AI 服务异常：HTTP ${status}`, "server", true, status);
  }
  return new AiClientError(message ?? `AI 请求失败：HTTP ${status}`, "unknown", false, status);
}

function toAiClientError(error: unknown): AiClientError {
  if (error instanceof AiClientError) {
    return error;
  }
  return new AiClientError(error instanceof Error ? error.message : String(error), "unknown", false);
}

function normalizeUsage(usage: ChatCompletionResponse["usage"]): AiUsage | undefined {
  if (!usage) {
    return undefined;
  }
  const promptTokens = numberValue(usage.prompt_tokens ?? usage.promptTokens);
  const completionTokens = numberValue(usage.completion_tokens ?? usage.completionTokens);
  const totalTokens = numberValue(usage.total_tokens ?? usage.totalTokens);
  if (promptTokens === undefined && completionTokens === undefined && totalTokens === undefined) {
    return undefined;
  }
  return {
    promptTokens: promptTokens ?? 0,
    completionTokens: completionTokens ?? 0,
    totalTokens: totalTokens ?? (promptTokens ?? 0) + (completionTokens ?? 0)
  };
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function positiveNumber(value: unknown, fallback: number): number {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function nonNegativeInteger(value: unknown, fallback: number): number {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.floor(number) : fallback;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

async function sleep(ms: number): Promise<void> {
  if (ms <= 0) {
    return;
  }
  await new Promise((resolve) => setTimeout(resolve, ms));
}
