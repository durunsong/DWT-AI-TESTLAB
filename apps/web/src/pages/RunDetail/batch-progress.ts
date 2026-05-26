import type { BatchRunItem, BatchTestRunSummary } from "../../types/run";

export type ProgressViewStatus = "success" | "exception" | "active" | undefined;

export interface BatchProgressView {
  completed: number;
  totalPercent: number;
  totalStatus: ProgressViewStatus;
  currentText: string;
  currentPercent: number;
  currentStatus: ProgressViewStatus;
}

export function buildBatchProgressView(batch: BatchTestRunSummary): BatchProgressView {
  const completed = batch.passed + batch.failed;
  const totalPercent = toPercent(completed, batch.total);
  const currentItem = findCurrentBatchItem(batch);
  const currentIndex = currentItem ? batch.items.indexOf(currentItem) : -1;
  const currentText = currentItem ? `${currentIndex + 1}/${batch.total} ${currentItem.caseName || currentItem.caseId}` : `${completed}/${batch.total}`;
  const currentPercent = currentItem && batch.status === "running" ? toPercent(currentIndex + 1, batch.total) : toPercent(completed, batch.total);

  return {
    completed,
    totalPercent,
    totalStatus: batch.failed ? "exception" : batch.status === "passed" ? "success" : "active",
    currentText,
    currentPercent,
    currentStatus: resolveCurrentStatus(batch, currentItem)
  };
}

function findCurrentBatchItem(batch: BatchTestRunSummary): BatchRunItem | undefined {
  return batch.items.find((item) => item.status === "running") ?? batch.items.find((item) => item.status === "pending");
}

function resolveCurrentStatus(batch: BatchTestRunSummary, currentItem?: BatchRunItem): ProgressViewStatus {
  if (currentItem?.status === "failed" || (!currentItem && batch.failed)) return "exception";
  if (!currentItem && batch.status === "passed") return "success";
  if (batch.status === "running") return "active";
  return undefined;
}

function toPercent(value: number, total: number): number {
  return total ? Math.round((value / total) * 100) : 0;
}
