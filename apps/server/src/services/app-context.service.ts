import fs from "node:fs/promises";
import path from "node:path";
import { createEmptyAppAuthSource, loadPlatformConfig, megabytesToBytes, parseAppAuthSourceContent, type AppAuthSourceSummary, type AppContextSummary, type PlatformConfig } from "@ai-e2e/runner";

export interface ParseAppContextSourceInput {
  source: string;
  fileName: string;
  content: string;
}

export interface AppContextSourceDetail {
  source: string;
  fileName: string;
  content: string;
  updatedAt?: string;
  summary: AppAuthSourceSummary;
}

type SourceMeta = Record<string, SourceMetaItem | undefined>;

interface SourceMetaItem {
  fileName: string;
  updatedAt: string;
}

export class AppContextService {
  private readonly platformConfig: PlatformConfig;

  constructor(private readonly rootDir: string, platformConfig?: PlatformConfig) {
    this.platformConfig = platformConfig ?? loadPlatformConfig(rootDir);
  }

  async getContext(): Promise<AppContextSummary> {
    const sourceKeys = await this.listSourceKeys();
    const sources = await Promise.all(sourceKeys.map((source) => this.loadSourceSummary(source)));
    const sourceMap = new Map(sources.map((source) => [source.source, source]));
    const user = sourceMap.get("user") ?? createEmptyAppAuthSource("user");
    const admin = sourceMap.get("admin") ?? createEmptyAppAuthSource("admin");
    return { user, admin, sources };
  }

  async getSource(source: string): Promise<AppContextSourceDetail> {
    const sourceKey = normalizeSourceKey(source);
    const meta = await this.readMeta();
    const content = await this.readSourceContent(sourceKey);
    const fileName = meta[sourceKey]?.fileName ?? `${sourceKey}.json`;
    return {
      source: sourceKey,
      fileName,
      content,
      updatedAt: meta[sourceKey]?.updatedAt,
      summary: content ? this.parseSourceContent(sourceKey, fileName, content) : createEmptyAppAuthSource(sourceKey)
    };
  }

  async saveSource(input: ParseAppContextSourceInput): Promise<AppContextSourceDetail> {
    const source = normalizeSourceKey(input.source);
    const fileName = sanitizeFileName(input.fileName) || `${source}.json`;
    const summary = this.parseSourceContent(source, fileName, input.content);
    const updatedAt = new Date().toISOString();
    const meta = await this.readMeta();

    await fs.mkdir(this.contextStorageDir(), { recursive: true });
    await Promise.all([
      fs.writeFile(this.sourceFilePath(source), input.content, "utf8"),
      fs.writeFile(
        this.contextMetaFile(),
        JSON.stringify(
          {
            ...meta,
            [source]: { fileName, updatedAt }
          } satisfies SourceMeta,
          null,
          2
        ),
        "utf8"
      )
    ]);

    return {
      source,
      fileName,
      content: input.content,
      updatedAt,
      summary
    };
  }

  async deleteSource(source: string): Promise<AppContextSummary> {
    const sourceKey = normalizeSourceKey(source);
    const meta = await this.readMeta();
    delete meta[sourceKey];
    await fs.rm(this.sourceFilePath(sourceKey), { force: true });
    await fs.mkdir(this.contextStorageDir(), { recursive: true });
    await fs.writeFile(this.contextMetaFile(), JSON.stringify(meta, null, 2), "utf8");
    return this.getContext();
  }

  parseSource(input: ParseAppContextSourceInput) {
    const source = normalizeSourceKey(input.source);
    return this.parseSourceContent(source, input.fileName, input.content);
  }

  contextBodyLimitBytes(): number {
    return megabytesToBytes(this.platformConfig.uploads.contextBodyLimitMb);
  }

  private async listSourceKeys(): Promise<string[]> {
    const meta = await this.readMeta();
    return [...new Set([...this.platformConfig.context.defaultSources, ...Object.keys(meta).map(normalizeSourceKey)])];
  }

  private async loadSourceSummary(source: string): Promise<AppAuthSourceSummary> {
    const detail = await this.getSource(source);
    return detail.summary;
  }

  private async readSourceContent(source: string): Promise<string> {
    return fs.readFile(this.sourceFilePath(source), "utf8").catch((error: unknown) => {
      if (isNodeError(error) && error.code === "ENOENT") {
        return "";
      }
      throw error;
    });
  }

  private async readMeta(): Promise<SourceMeta> {
    const content = await fs.readFile(this.contextMetaFile(), "utf8").catch((error: unknown) => {
      if (isNodeError(error) && error.code === "ENOENT") {
        return "{}";
      }
      throw error;
    });
    return JSON.parse(content) as SourceMeta;
  }

  private sourceFilePath(source: string): string {
    return path.resolve(this.contextStorageDir(), `${source}.json`);
  }

  private contextStorageDir(): string {
    return path.resolve(this.rootDir, "uploads", "app-context");
  }

  private contextMetaFile(): string {
    return path.resolve(this.contextStorageDir(), "manifest.json");
  }

  private parseSourceContent(source: string, fileName: string, content: string): AppAuthSourceSummary {
    return parseAppAuthSourceContent(source, fileName, content, this.platformConfig.context.routeGroups);
  }
}

function sanitizeFileName(fileName: string): string {
  return path.basename(fileName).replace(/[^\w.\-\u4e00-\u9fa5]/g, "_").slice(0, 120);
}

function normalizeSourceKey(source: string): string {
  const sourceKey = source.trim();
  if (!/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(sourceKey)) {
    throw new Error("路由来源标识只能使用字母开头的英文、数字、下划线或中划线，最长 64 位");
  }
  return sourceKey;
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
