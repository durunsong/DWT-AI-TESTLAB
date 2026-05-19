import { Card, Progress, Tag } from "antd";
import type { TestRunSummary } from "../types/run";
import { formatDuration, progressPercent } from "../utils/format";

interface RunStatusCardProps {
  run?: TestRunSummary;
}

export function RunStatusCard({ run }: RunStatusCardProps) {
  const percent = run ? progressPercent(run.total, run.passed, run.failed, run.skipped) : 0;

  return (
    <Card title="执行状态">
      <div className="grid grid-cols-2 gap-3 2xl:grid-cols-4">
        <StatusMetric label="RunId" value={run?.runId ?? "-"} mono />
        <StatusMetric label="用例" value={run?.caseId ?? "-"} mono />
        <StatusMetric label="当前步骤" value={run?.currentStep ?? "-"} mono />
        <StatusMetric label="总耗时" value={formatDuration(run?.durationMs)} />
      </div>
      <div className="my-2 mt-[18px] flex flex-wrap items-center gap-2.5 text-[#68758a]">
        <Tag color={statusColor(run?.status)}>{run?.status ?? "idle"}</Tag>
        <span>{run ? `${run.passed} 成功 / ${run.failed} 失败 / ${run.skipped} 跳过` : "等待执行"}</span>
      </div>
      <Progress percent={percent} status={run?.failed ? "exception" : run?.status === "passed" ? "success" : "active"} />
    </Card>
  );
}

function StatusMetric(props: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
      <span className="block text-xs leading-5 text-slate-500">{props.label}</span>
      <strong
        className={`block min-w-0 truncate text-lg font-semibold leading-8 text-slate-950 2xl:text-[20px] ${props.mono ? "font-mono tracking-[-0.02em]" : ""}`}
        title={props.value}
      >
        {props.value}
      </strong>
    </div>
  );
}

function statusColor(status?: string): string {
  if (status === "passed") return "success";
  if (status === "failed") return "error";
  if (status === "running") return "processing";
  return "default";
}
