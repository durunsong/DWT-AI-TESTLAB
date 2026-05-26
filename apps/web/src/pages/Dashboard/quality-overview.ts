import type { CaseItem } from "../../types/case";
import type { RunHistoryItem } from "../../types/report";

export interface FailedCaseSummary {
  caseId: string;
  caseName: string;
  failures: number;
  latestRunId: string;
}

export interface QualityOverview {
  totalCases: number;
  runnableCases: number;
  invalidCases: number;
  unrunRunnableCases: number;
  completedRuns: number;
  passRate: number;
  passRateText: string;
  failedRuns: number;
  topFailedCases: FailedCaseSummary[];
  recommendationTone: "success" | "warning" | "error";
  recommendation: string;
}

export function buildQualityOverview(cases: CaseItem[], history: RunHistoryItem[]): QualityOverview {
  const runnableCases = cases.filter((item) => item.valid !== false);
  const completedRuns = history.filter((item) => item.status === "passed" || item.status === "failed");
  const failedRuns = completedRuns.filter((item) => item.status === "failed");
  const passRate = completedRuns.length ? (completedRuns.length - failedRuns.length) / completedRuns.length : 0;
  const historyCaseIds = new Set(history.map((item) => item.caseId));
  const unrunRunnableCases = runnableCases.filter((item) => !historyCaseIds.has(item.caseId));
  const topFailedCases = rankFailedCases(failedRuns);

  return {
    totalCases: cases.length,
    runnableCases: runnableCases.length,
    invalidCases: cases.length - runnableCases.length,
    unrunRunnableCases: unrunRunnableCases.length,
    completedRuns: completedRuns.length,
    passRate,
    passRateText: `${(passRate * 100).toFixed(1)}%`,
    failedRuns: failedRuns.length,
    topFailedCases,
    ...buildRecommendation({ failedCases: topFailedCases.length, invalidCases: cases.length - runnableCases.length, unrunCases: unrunRunnableCases.length })
  };
}

function rankFailedCases(failedRuns: RunHistoryItem[]): FailedCaseSummary[] {
  const byCase = new Map<string, FailedCaseSummary & { latestStartedAt: string }>();
  for (const item of failedRuns) {
    const current = byCase.get(item.caseId);
    if (!current) {
      byCase.set(item.caseId, {
        caseId: item.caseId,
        caseName: item.caseName || item.caseId,
        failures: 1,
        latestRunId: item.runId,
        latestStartedAt: item.startedAt
      });
      continue;
    }
    current.failures += 1;
    if (String(item.startedAt).localeCompare(current.latestStartedAt) > 0) {
      current.latestRunId = item.runId;
      current.latestStartedAt = item.startedAt;
    }
  }

  return [...byCase.values()]
    .sort((a, b) => b.failures - a.failures || String(b.latestStartedAt).localeCompare(a.latestStartedAt))
    .slice(0, 3)
    .map(({ latestStartedAt: _latestStartedAt, ...item }) => item);
}

function buildRecommendation(input: { failedCases: number; invalidCases: number; unrunCases: number }): Pick<QualityOverview, "recommendationTone" | "recommendation"> {
  if (input.failedCases > 0) {
    return {
      recommendationTone: "error",
      recommendation: `优先处理 ${input.failedCases} 个最近失败用例，避免继续扩大回归噪音。`
    };
  }
  if (input.invalidCases > 0) {
    return {
      recommendationTone: "warning",
      recommendation: `先修复 ${input.invalidCases} 个不可执行用例，再扩展新的业务覆盖。`
    };
  }
  if (input.unrunCases > 0) {
    return {
      recommendationTone: "warning",
      recommendation: `还有 ${input.unrunCases} 个可执行用例没有历史结果，建议纳入冒烟运行。`
    };
  }
  return {
    recommendationTone: "success",
    recommendation: "当前用例资产状态稳定，可以继续补充业务覆盖。"
  };
}
