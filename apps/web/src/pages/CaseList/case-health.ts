import type { CaseItem } from "../../types/case";
import type { RunHistoryItem } from "../../types/report";

export interface CaseHealth {
  tone: "success" | "warning" | "error" | "processing";
  label: string;
  description: string;
}

export function deriveCaseHealth(item: CaseItem, history: RunHistoryItem[]): CaseHealth {
  if (item.valid === false) {
    return {
      tone: "error",
      label: "需修复",
      description: "DSL 校验未通过，暂不可执行。"
    };
  }

  const runs = history
    .filter((run) => run.caseId === item.caseId)
    .sort((a, b) => String(b.startedAt).localeCompare(a.startedAt));
  const latest = runs[0];
  if (!latest) {
    return {
      tone: "warning",
      label: "未运行",
      description: "还没有历史结果，建议先做一次预检或冒烟执行。"
    };
  }

  if (latest.status === "running") {
    return {
      tone: "processing",
      label: "运行中",
      description: "当前已有一次执行正在进行。"
    };
  }
  if (latest.status === "failed") {
    return {
      tone: "error",
      label: "最近失败",
      description: "最近一次执行失败，应先查看报告和失败截图。"
    };
  }
  if (runs.slice(1, 5).some((run) => run.status === "failed")) {
    return {
      tone: "warning",
      label: "已恢复",
      description: `最近一次已通过，但近 ${Math.min(runs.length, 5)} 次内出现过失败。`
    };
  }
  return {
    tone: "success",
    label: "稳定",
    description: "最近执行通过，暂无明显回归风险。"
  };
}
