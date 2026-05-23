import fs from "node:fs/promises";
import path from "node:path";
import { maskSensitive } from "@ai-e2e/shared";

export type AiAnalysisSource = "auto_failure" | "manual_screenshot";
export type AiAnalysisStatus = "completed" | "failed";

export interface AiAnalysisRecord {
  stepId: string;
  stepName?: string;
  source: AiAnalysisSource;
  status: AiAnalysisStatus;
  content?: string;
  error?: string;
  generatedAt: string;
  screenshot?: string;
  reportFile?: string;
}

export interface AiRunReport {
  runId: string;
  caseId?: string;
  caseName?: string;
  env?: string;
  updatedAt: string;
  analyses: AiAnalysisRecord[];
}

export interface SaveAiAnalysisInput {
  runId: string;
  caseId?: string;
  caseName?: string;
  env?: string;
  stepId: string;
  stepName?: string;
  source: AiAnalysisSource;
  status: AiAnalysisStatus;
  content?: string;
  error?: string;
  generatedAt?: string;
  screenshot?: string;
}

export class AiReportService {
  constructor(private readonly rootDir: string) {}

  async saveAnalysis(input: SaveAiAnalysisInput): Promise<AiRunReport> {
    const runId = this.safeSegment(input.runId, "runId");
    const stepId = this.safeSegment(input.stepId, "stepId");
    const generatedAt = input.generatedAt ?? new Date().toISOString();
    const dir = this.runDir(runId);
    await fs.mkdir(dir, { recursive: true });

    const reportFileName = `${stepId}.${input.source}.analysis.md`;
    const reportFilePath = path.resolve(dir, reportFileName);
    const reportFile = `/ai-reports/${runId}/${reportFileName}`;
    const content = input.content?.trim();

    if (content) {
      await fs.writeFile(reportFilePath, `${content.replace(/\s+$/, "")}\n`, "utf8");
    }

    const current = await this.readReport(runId).catch(() => ({
      runId,
      updatedAt: generatedAt,
      analyses: []
    }) as AiRunReport);

    const record: AiAnalysisRecord = {
      stepId: input.stepId,
      stepName: input.stepName,
      source: input.source,
      status: input.status,
      content,
      error: input.error,
      generatedAt,
      screenshot: input.screenshot,
      reportFile: content ? reportFile : undefined
    };
    const next: AiRunReport = {
      runId,
      caseId: input.caseId ?? current.caseId,
      caseName: input.caseName ?? current.caseName,
      env: input.env ?? current.env,
      updatedAt: generatedAt,
      analyses: [
        ...current.analyses.filter((item) => !(item.stepId === input.stepId && item.source === input.source)),
        record
      ].sort((a, b) => a.generatedAt.localeCompare(b.generatedAt))
    };

    await fs.writeFile(this.indexPath(runId), `${JSON.stringify(maskSensitive(next), null, 2)}\n`, "utf8");
    return next;
  }

  async readReport(runId: string): Promise<AiRunReport> {
    const safeRunId = this.safeSegment(runId, "runId");
    return JSON.parse(await fs.readFile(this.indexPath(safeRunId), "utf8")) as AiRunReport;
  }

  reportsDir(): string {
    const dir = path.resolve(this.rootDir, "ai-reports");
    this.assertInsideRoot(dir);
    return dir;
  }

  private runDir(runId: string): string {
    const dir = path.resolve(this.reportsDir(), runId);
    this.assertInsideRoot(dir);
    return dir;
  }

  private indexPath(runId: string): string {
    const file = path.resolve(this.runDir(runId), "index.json");
    this.assertInsideRoot(file);
    return file;
  }

  private safeSegment(value: string, fieldName: string): string {
    const safeValue = path.basename(value.trim());
    if (!/^[a-zA-Z0-9_.-]+$/.test(safeValue)) {
      throw new Error(`${fieldName} 非法`);
    }
    return safeValue;
  }

  private assertInsideRoot(targetPath: string): void {
    const root = path.resolve(this.rootDir);
    const resolved = path.resolve(targetPath);
    if (resolved !== root && !resolved.startsWith(root + path.sep)) {
      throw new Error("AI 报告路径非法");
    }
  }
}
