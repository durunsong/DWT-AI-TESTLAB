import type { CreateTestRunParams, TestRunSummary } from "../../types/run";

type RerunnableRun = Pick<TestRunSummary, "status" | "caseId" | "env">;

export function canRerunCase(run?: RerunnableRun | null): run is RerunnableRun {
  return Boolean(run?.status === "failed" && run.caseId.trim() && run.env.trim());
}

export function buildRerunCaseRequest(run?: RerunnableRun | null): CreateTestRunParams {
  if (!canRerunCase(run)) {
    throw new Error("当前运行记录不能重新执行");
  }
  return {
    caseId: run.caseId,
    env: run.env
  };
}
