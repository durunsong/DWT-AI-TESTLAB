import type { CaseItem } from "../../types/case";

export function filterCasesByType(cases: CaseItem[], caseType: string): CaseItem[] {
  const target = caseType.trim();
  if (!target) {
    return cases;
  }
  return cases.filter((item) => (item.caseType || "uncategorized") === target);
}

export function buildBatchRunRequest(cases: CaseItem[], selectedCaseIds: string[], env: string): { caseIds: string[]; env: string } {
  const selected = new Set(selectedCaseIds);
  return {
    env,
    caseIds: cases
      .filter((item) => selected.has(item.caseId) && item.valid !== false)
      .map((item) => item.caseId)
  };
}
