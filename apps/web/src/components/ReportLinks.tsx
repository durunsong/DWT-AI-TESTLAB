import { Button, Space } from "antd";
import { FileTextOutlined, FolderOpenOutlined } from "@ant-design/icons";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import type { TestRunSummary } from "../types/run";

interface ReportLinksProps {
  run?: TestRunSummary;
}

export function ReportLinks({ run }: ReportLinksProps) {
  const navigate = useNavigate();
  const links = run?.reportLinks;

  function openReport(mode: "html" | "json" | "screenshots" | "logs") {
    if (!run?.runId) return;
    navigate(`/reports/${run.runId}?mode=${mode}`);
  }

  return (
    <Space wrap className="w-full">
      <LinkButton label="HTML 报告" disabled={!links?.html} icon={<FileTextOutlined />} onClick={() => openReport("html")} />
      <LinkButton label="JSON 报告" disabled={!run?.runId} icon={<FileTextOutlined />} onClick={() => openReport("json")} />
      <LinkButton label="截图查看" disabled={!run?.runId} icon={<FolderOpenOutlined />} onClick={() => openReport("screenshots")} />
      <LinkButton label="Trace 目录" disabled={!links?.traces} href={links?.traces} icon={<FolderOpenOutlined />} />
      <LinkButton label="运行日志" disabled={!run?.runId} icon={<FileTextOutlined />} onClick={() => openReport("logs")} />
    </Space>
  );
}

function LinkButton(props: { label: string; disabled?: boolean; href?: string; icon: ReactNode; onClick?: () => void }) {
  return (
    <Button icon={props.icon} disabled={props.disabled} href={props.href} onClick={props.onClick}>
      {props.label}
    </Button>
  );
}
