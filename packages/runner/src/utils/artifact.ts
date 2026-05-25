import fs from "node:fs/promises";
import path from "node:path";
import { loadPlatformConfig, resolveArtifactBaseDir, type PlatformConfig } from "../config/platform-config";

export interface ArtifactPaths {
  reportsDir: string;
  logsDir: string;
  screenshotsDir: string;
  tracesDir: string;
  videosDir: string;
  jsonReport: string;
  htmlReport: string;
  logFile: string;
}

export async function createArtifactPaths(rootDir: string, runId: string, platformConfig = loadPlatformConfig(rootDir)): Promise<ArtifactPaths> {
  const reportsDir = artifactBaseDir(rootDir, platformConfig, "reports");
  const logsDir = artifactBaseDir(rootDir, platformConfig, "logs");
  const screenshotsDir = path.resolve(artifactBaseDir(rootDir, platformConfig, "screenshots"), runId);
  const tracesDir = path.resolve(artifactBaseDir(rootDir, platformConfig, "traces"), runId);
  const videosDir = path.resolve(artifactBaseDir(rootDir, platformConfig, "videos"), runId);

  await Promise.all([
    fs.mkdir(reportsDir, { recursive: true }),
    fs.mkdir(logsDir, { recursive: true }),
    fs.mkdir(screenshotsDir, { recursive: true }),
    fs.mkdir(tracesDir, { recursive: true }),
    fs.mkdir(videosDir, { recursive: true })
  ]);

  return {
    reportsDir,
    logsDir,
    screenshotsDir,
    tracesDir,
    videosDir,
    jsonReport: path.resolve(reportsDir, `${runId}.json`),
    htmlReport: path.resolve(reportsDir, `${runId}.html`),
    logFile: path.resolve(logsDir, `${runId}.log`)
  };
}

function artifactBaseDir(rootDir: string, platformConfig: PlatformConfig, kind: "logs" | "screenshots" | "reports" | "traces" | "videos"): string {
  return resolveArtifactBaseDir(rootDir, platformConfig, kind);
}
