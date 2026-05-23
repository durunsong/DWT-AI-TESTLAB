import type { CaseItem } from "../../types/case";

export const preferredCaseSourceIds = ["login_user", "login_admin", "kyc_submit", "kyc_submit_and_approve"];

export interface CaseSourceOption {
  label: string;
  value: string;
  description: string;
}

export interface CaseSourceMeta {
  caseId: string;
  caseName: string;
  description?: string;
}

export function buildCaseSourceOptions(cases: CaseItem[]): CaseSourceOption[] {
  return cases
    .filter((item) => item.valid !== false)
    .slice()
    .sort(compareCaseSource)
    .map((item) => ({
      label: item.caseName ? `${item.caseId} - ${item.caseName}` : item.caseId,
      value: item.caseId,
      description: `${item.mode} / ${item.total} steps${item.file ? ` / ${item.file}` : ""}`
    }));
}

export function createCaseYamlFromSource(source: string, meta: CaseSourceMeta): string {
  const lines = source.replace(/^\uFEFF/, "").split(/\r?\n/);
  let next = upsertYamlScalar(lines, "case_id", meta.caseId, 0);
  next = upsertYamlScalar(next, "case_name", meta.caseName, findYamlKeyIndex(next, "case_id") + 1);
  if (meta.description?.trim()) {
    next = upsertYamlScalar(next, "description", meta.description.trim(), findYamlKeyIndex(next, "case_name") + 1);
  }
  return `${next.join("\n").replace(/\n*$/, "")}\n`;
}

function compareCaseSource(a: CaseItem, b: CaseItem): number {
  const aPreferred = preferredCaseSourceIds.indexOf(a.caseId);
  const bPreferred = preferredCaseSourceIds.indexOf(b.caseId);
  if (aPreferred !== -1 || bPreferred !== -1) {
    if (aPreferred === -1) return 1;
    if (bPreferred === -1) return -1;
    return aPreferred - bPreferred;
  }
  return a.caseId.localeCompare(b.caseId);
}

function upsertYamlScalar(lines: string[], key: "case_id" | "case_name" | "description", value: string, insertIndex: number): string[] {
  const next = [...lines];
  const index = findYamlKeyIndex(next, key);
  const rendered = `${key}: ${key === "case_id" ? value : JSON.stringify(value)}`;
  if (index >= 0) {
    next[index] = rendered;
    return next;
  }
  next.splice(Math.max(0, insertIndex), 0, rendered);
  return next;
}

function findYamlKeyIndex(lines: string[], key: string): number {
  return lines.findIndex((line) => new RegExp(`^${key}\\s*:`).test(line));
}
