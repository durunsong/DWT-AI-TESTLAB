import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { loadPlatformConfig, resolveArtifactBaseDir, type PlatformConfig } from "@ai-e2e/runner";

const sequencePattern = /^(\d{4})_/;

export function getNextRunSequence(names: string[]): number {
  const maxSequence = names.reduce((max, name) => {
    const match = sequencePattern.exec(name);
    const sequence = match ? Number(match[1]) : 0;
    return Number.isFinite(sequence) && sequence > max ? sequence : max;
  }, 0);
  return maxSequence + 1;
}

export function formatRunId(sequence: number, caseId: string): string {
  const prefix = String(sequence).padStart(4, "0");
  const safeCaseId = caseId.replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "") || "case";
  return `${prefix}_${safeCaseId}_${Date.now().toString(36)}${crypto.randomUUID().slice(0, 4)}`;
}

export async function createNextRunId(rootDir: string, caseId: string, platformConfig = loadPlatformConfig(rootDir)): Promise<string> {
  const dirs = await Promise.all([
    readEntryNames(artifactBaseDir(rootDir, platformConfig, "screenshots")),
    readEntryNames(artifactBaseDir(rootDir, platformConfig, "reports")),
    readEntryNames(artifactBaseDir(rootDir, platformConfig, "logs"))
  ]);
  return formatRunId(getNextRunSequence(dirs.flat()), caseId);
}

function artifactBaseDir(rootDir: string, platformConfig: PlatformConfig, kind: "logs" | "screenshots" | "reports"): string {
  return resolveArtifactBaseDir(rootDir, platformConfig, kind);
}

async function readEntryNames(dir: string): Promise<string[]> {
  try {
    return await fs.readdir(dir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}
