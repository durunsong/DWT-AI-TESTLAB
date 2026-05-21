import { Buffer } from "node:buffer";
import { isIP } from "node:net";

export interface AiMaterialFile {
  name: string;
  mimeType?: string;
  base64: string;
}

export interface AiMaterialSource {
  title: string;
  content: string;
}

export interface AiMaterialLimits {
  materialFileMaxMb: number;
  materialSourceMaxChars: number;
  materialLinkMaxChars: number;
}

const defaultLimits: AiMaterialLimits = {
  materialFileMaxMb: 8,
  materialSourceMaxChars: 18_000,
  materialLinkMaxChars: 24_000
};
const textFilePattern = /\.(txt|md|markdown|csv|json|yaml|yml)$/i;
const imageMimeTypes = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]);

export async function extractMaterialFiles(files: AiMaterialFile[] = [], limits: AiMaterialLimits = defaultLimits): Promise<AiMaterialSource[]> {
  const sources: AiMaterialSource[] = [];
  const maxFileBytes = materialMaxFileBytes(limits);

  for (const file of files) {
    if (isImageMaterialFile(file)) {
      continue;
    }

    const buffer = Buffer.from(file.base64, "base64");
    if (buffer.byteLength > maxFileBytes) {
      throw new Error(`${file.name} 超过 ${limits.materialFileMaxMb}MB，请拆分或精简后再上传`);
    }

    const content = await extractFileText(file.name, file.mimeType, buffer);
    sources.push({
      title: `上传文件：${file.name}`,
      content: truncate(content, limits.materialSourceMaxChars)
    });
  }

  return sources;
}

export function isImageMaterialFile(file: AiMaterialFile): boolean {
  return imageMimeTypes.has((file.mimeType ?? "").toLowerCase()) || /\.(png|jpe?g|webp)$/i.test(file.name);
}

export function imageMaterialToDataUrl(file: AiMaterialFile, limits: AiMaterialLimits = defaultLimits): { title: string; dataUrl: string } {
  const buffer = Buffer.from(file.base64, "base64");
  if (buffer.byteLength > materialMaxFileBytes(limits)) {
    throw new Error(`${file.name} 超过 ${limits.materialFileMaxMb}MB，请压缩后再上传`);
  }

  const mimeType = normalizeImageMimeType(file);
  if (!mimeType) {
    throw new Error(`${file.name} 不是支持的图片格式，请上传 PNG、JPG 或 WebP`);
  }

  return {
    title: `图片资料：${file.name}`,
    dataUrl: `data:${mimeType};base64,${file.base64}`
  };
}

export async function fetchMaterialLinks(urls: string[] = [], limits: AiMaterialLimits = defaultLimits): Promise<AiMaterialSource[]> {
  const sources: AiMaterialSource[] = [];

  for (const rawUrl of urls.map((item) => item.trim()).filter(Boolean)) {
    const url = assertPublicHttpUrl(rawUrl);
    const response = await fetch(url, {
      headers: {
        accept: "text/html,application/xhtml+xml,text/plain,application/json;q=0.9,*/*;q=0.5",
        "user-agent": `${process.env.APP_PRODUCT_NAME || "Custom Test Platform"}-AI-Material-Importer/1.0`
      },
      signal: AbortSignal.timeout(12_000)
    });

    if (!response.ok) {
      throw new Error(`文档链接读取失败：${url} HTTP ${response.status}`);
    }

    const text = await response.text();
    sources.push({
      title: `文档链接：${url}`,
      content: truncate(stripHtml(text), limits.materialLinkMaxChars)
    });
  }

  return sources;
}

async function extractFileText(name: string, mimeType: string | undefined, buffer: Buffer): Promise<string> {
  const lowerName = name.toLowerCase();
  if (lowerName.endsWith(".docx") || mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  if (lowerName.endsWith(".pdf") || mimeType === "application/pdf") {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      return result.text;
    } finally {
      await parser.destroy();
    }
  }

  if (textFilePattern.test(lowerName) || mimeType?.startsWith("text/")) {
    return buffer.toString("utf8");
  }

  throw new Error(`${name} 暂不支持解析，请上传 docx、PDF、Markdown 或 TXT 文件`);
}

function assertPublicHttpUrl(input: string): string {
  const url = new URL(input);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`仅支持 http/https 文档链接：${input}`);
  }

  const hostname = url.hostname.toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".local")) {
    throw new Error(`不允许读取本机或内网文档链接：${input}`);
  }

  const ipVersion = isIP(hostname);
  if (ipVersion && isPrivateIp(hostname)) {
    throw new Error(`不允许读取内网 IP 文档链接：${input}`);
  }

  return url.toString();
}

function isPrivateIp(hostname: string): boolean {
  if (hostname === "127.0.0.1" || hostname === "0.0.0.0") return true;
  if (hostname.startsWith("10.")) return true;
  if (hostname.startsWith("192.168.")) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)) return true;
  if (hostname.startsWith("169.254.")) return true;
  if (hostname === "::1") return true;
  return false;
}

function stripHtml(input: string): string {
  return input
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(input: string, maxLength: number): string {
  const normalized = input.replace(/\u0000/g, "").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength)}\n\n[内容过长，已截断]`;
}

function normalizeImageMimeType(file: AiMaterialFile): string | undefined {
  const mimeType = (file.mimeType ?? "").toLowerCase();
  if (imageMimeTypes.has(mimeType)) {
    return mimeType === "image/jpg" ? "image/jpeg" : mimeType;
  }
  if (/\.png$/i.test(file.name)) return "image/png";
  if (/\.jpe?g$/i.test(file.name)) return "image/jpeg";
  if (/\.webp$/i.test(file.name)) return "image/webp";
  return undefined;
}

function materialMaxFileBytes(limits: AiMaterialLimits): number {
  return Math.max(1, Math.floor(limits.materialFileMaxMb * 1024 * 1024));
}
