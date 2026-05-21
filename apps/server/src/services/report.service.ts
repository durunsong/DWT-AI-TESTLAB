import fs from "node:fs/promises";
import path from "node:path";
import { resolveArtifactBaseDir, platformArtifactKinds, type PlatformConfig } from "@ai-e2e/runner";
import type { RunReport, TestRunSummary } from "@ai-e2e/shared";

export type ArtifactKind = "logs" | "screenshots" | "reports" | "traces";

export interface ArtifactSummary {
  kind: ArtifactKind;
  path: string;
  count: number;
  sizeBytes: number;
}

export interface RunHistoryItem {
  runId: string;
  caseId: string;
  caseName: string;
  env: string;
  status: RunReport["status"];
  startedAt: string;
  endedAt?: string;
  durationMs?: number;
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  reportLinks: {
    html: string;
    json: string;
    logs: string;
  };
}

export interface DeleteRunHistoryResult {
  deleted: true;
  runId: string;
  files: string[];
}

export class ReportService {
  constructor(
    private readonly rootDir: string,
    private readonly platformConfig?: PlatformConfig
  ) {}

  async readJsonReport(runId: string): Promise<unknown> {
    const safeRunId = await this.resolveRunId(runId);
    const file = path.resolve(this.artifactDir("reports"), `${safeRunId}.json`);
    return JSON.parse(await fs.readFile(file, "utf8"));
  }

  async readLog(runId: string): Promise<string> {
    const safeRunId = await this.resolveRunId(runId);
    const file = path.resolve(this.artifactDir("logs"), `${safeRunId}.log`);
    return fs.readFile(file, "utf8");
  }

  async readRunSummary(runId: string): Promise<TestRunSummary> {
    const report = (await this.readJsonReport(runId)) as RunReport;
    return this.toRunSummary(report);
  }

  async listHistory(): Promise<RunHistoryItem[]> {
    const reportsDir = this.artifactDir("reports");
    const files = await fs.readdir(reportsDir).catch(() => []);
    const jsonFiles = files.filter((file) => file.endsWith(".json"));
    const items = await Promise.all(
      jsonFiles.map(async (file) => {
        const report = JSON.parse(await fs.readFile(path.resolve(reportsDir, file), "utf8")) as RunReport;
        return this.toHistoryItem(report);
      })
    );

    return items.sort((a, b) => String(b.startedAt).localeCompare(String(a.startedAt)));
  }

  async artifactSummaries(): Promise<ArtifactSummary[]> {
    const kinds: ArtifactKind[] = ["logs", "screenshots", "reports", "traces"];
    return Promise.all(kinds.map((kind) => this.artifactSummary(kind)));
  }

  async clearArtifacts(kinds: ArtifactKind[]): Promise<{ cleared: ArtifactSummary[]; remaining: ArtifactSummary[] }> {
    const uniqueKinds = [...new Set(kinds)];
    for (const kind of uniqueKinds) {
      if (!this.isArtifactKind(kind)) {
        throw new Error(`不支持的产物类型：${kind}`);
      }
    }
    for (const kind of uniqueKinds) {
      const dir = this.artifactDir(kind);
      const entries = await fs.readdir(dir).catch(() => []);
      await Promise.all(entries.map((entry) => fs.rm(path.resolve(dir, entry), { recursive: true, force: true })));
    }

    return {
      cleared: await Promise.all(uniqueKinds.map((kind) => this.artifactSummary(kind))),
      remaining: await this.artifactSummaries()
    };
  }

  async deleteRunHistory(runId: string): Promise<DeleteRunHistoryResult> {
    const safeRunId = this.safeRunId(runId);
    const targets = [
      path.resolve(this.artifactDir("reports"), `${safeRunId}.json`),
      path.resolve(this.artifactDir("reports"), `${safeRunId}.html`),
      path.resolve(this.artifactDir("logs"), `${safeRunId}.log`),
      path.resolve(this.artifactDir("screenshots"), safeRunId),
      path.resolve(this.artifactDir("traces"), safeRunId)
    ];
    const files: string[] = [];

    for (const target of targets) {
      this.assertInsideRoot(target);
      await fs.rm(target, { recursive: true, force: true });
      files.push(path.relative(this.rootDir, target).replace(/\\/g, "/"));
    }

    return { deleted: true, runId: safeRunId, files };
  }

  private toHistoryItem(report: RunReport): RunHistoryItem {
    return {
      runId: report.runId,
      caseId: report.caseId,
      caseName: report.caseName,
      env: report.env,
      status: report.status,
      startedAt: report.startedAt,
      endedAt: report.endedAt,
      durationMs: report.durationMs,
      total: report.total,
      passed: report.passed,
      failed: report.failed,
      skipped: report.skipped,
      reportLinks: {
        html: `/reports/${report.runId}.html`,
        json: `/api/test-runs/${report.runId}/report`,
        logs: `/api/test-runs/${report.runId}/logs`
      }
    };
  }

  private toRunSummary(report: RunReport): TestRunSummary {
    return {
      runId: report.runId,
      caseId: report.caseId,
      caseName: report.caseName,
      env: report.env,
      status: report.status,
      total: report.total,
      passed: report.passed,
      failed: report.failed,
      skipped: report.skipped,
      startedAt: report.startedAt,
      endedAt: report.endedAt,
      durationMs: report.durationMs,
      steps: report.steps,
      reportLinks: {
        json: `/api/test-runs/${report.runId}/report`,
        html: `/reports/${report.runId}.html`,
        logs: `/api/test-runs/${report.runId}/logs`,
        screenshots: `/screenshots/${report.runId}`,
        traces: `/traces/${report.runId}`
      }
    };
  }

  private async resolveRunId(runId: string): Promise<string> {
    if (runId !== "latest") {
      return this.safeRunId(runId);
    }

    const latest = (await this.listHistory())[0];
    if (!latest) {
      throw new Error("暂无历史运行记录");
    }
    return latest.runId;
  }

  private async artifactSummary(kind: ArtifactKind): Promise<ArtifactSummary> {
    const dir = this.artifactDir(kind);
    const stats = await this.readDirStats(dir);
    return {
      kind,
      path: path.relative(this.rootDir, dir).replace(/\\/g, "/"),
      count: stats.count,
      sizeBytes: stats.sizeBytes
    };
  }

  private artifactDir(kind: ArtifactKind): string {
    if (!this.isArtifactKind(kind)) {
      throw new Error(`不支持的产物类型：${kind}`);
    }
    const dir = this.platformConfig ? resolveArtifactBaseDir(this.rootDir, this.platformConfig, kind) : path.resolve(this.rootDir, kind);
    this.assertInsideRoot(dir);
    return dir;
  }

  private assertInsideRoot(targetPath: string): void {
    const root = path.resolve(this.rootDir);
    const resolved = path.resolve(targetPath);
    if (resolved !== root && !resolved.startsWith(root + path.sep)) {
      throw new Error("产物路径非法");
    }
  }

  private safeRunId(runId: string): string {
    const value = path.basename(runId.trim());
    if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
      throw new Error("runId 非法");
    }
    return value;
  }

  private async readDirStats(dir: string): Promise<{ count: number; sizeBytes: number }> {
    const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
    let count = 0;
    let sizeBytes = 0;

    for (const entry of entries) {
      const entryPath = path.resolve(dir, entry.name);
      if (entry.isDirectory()) {
        const nested = await this.readDirStats(entryPath);
        count += 1 + nested.count;
        sizeBytes += nested.sizeBytes;
      } else {
        count += 1;
        sizeBytes += (await fs.stat(entryPath)).size;
      }
    }

    return { count, sizeBytes };
  }

  private isArtifactKind(value: string): value is ArtifactKind {
    return platformArtifactKinds.includes(value as ArtifactKind);
  }
}
