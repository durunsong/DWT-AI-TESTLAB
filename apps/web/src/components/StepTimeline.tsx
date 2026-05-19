import { Timeline, Typography } from "antd";
import type { StepResult } from "../types/run";
import { formatDuration, formatTime } from "../utils/format";

interface StepTimelineProps {
  steps: StepResult[];
}

export function StepTimeline({ steps }: StepTimelineProps) {
  if (!steps.length) {
    return <Typography.Text type="secondary">暂无步骤数据</Typography.Text>;
  }

  return (
    <Timeline
      items={steps.map((step, index) => ({
        key: `${step.stepId}-${index}`,
        color: color(step.status),
        children: (
          <div className="grid gap-1">
            <strong>{step.name}</strong>
            <span className="text-xs text-[#68758a]">{step.stepId} · {step.type} · {formatTime(step.startedAt)} · {formatDuration(step.durationMs)}</span>
            {step.error ? <Typography.Text type="danger">{step.error}</Typography.Text> : null}
          </div>
        )
      }))}
    />
  );
}

function color(status: string): string {
  if (status === "passed") return "green";
  if (status === "failed") return "red";
  if (status === "running") return "blue";
  return "gray";
}
