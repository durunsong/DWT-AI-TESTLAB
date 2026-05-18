import fs from "node:fs/promises";
import path from "node:path";

export interface ArtifactPaths {
  reportsDir: string;
  logsDir: string;
  screenshotsDir: string;
  tracesDir: string;
  jsonReport: string;
  htmlReport: string;
  logFile: string;
}

export async function createArtifactPaths(rootDir: string, runId: string): Promise<ArtifactPaths> {
  const reportsDir = path.resolve(rootDir, "reports");
  const logsDir = path.resolve(rootDir, "logs");
  const screenshotsDir = path.resolve(rootDir, "screenshots", runId);
  const tracesDir = path.resolve(rootDir, "traces", runId);

  await Promise.all([
    fs.mkdir(reportsDir, { recursive: true }),
    fs.mkdir(logsDir, { recursive: true }),
    fs.mkdir(screenshotsDir, { recursive: true }),
    fs.mkdir(tracesDir, { recursive: true })
  ]);

  return {
    reportsDir,
    logsDir,
    screenshotsDir,
    tracesDir,
    jsonReport: path.resolve(reportsDir, `${runId}.json`),
    htmlReport: path.resolve(reportsDir, `${runId}.html`),
    logFile: path.resolve(logsDir, `${runId}.log`)
  };
}
