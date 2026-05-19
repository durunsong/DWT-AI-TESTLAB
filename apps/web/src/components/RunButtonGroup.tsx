import { PlayCircleOutlined } from "@ant-design/icons";
import { Button, Space } from "antd";
import type { CaseItem } from "../types/case";

const preferredCases = ["login_user", "login_admin", "kyc_submit", "kyc_submit_and_approve"];

interface RunButtonGroupProps {
  cases: CaseItem[];
  runningCaseId?: string;
  disabled?: boolean;
  onRun: (caseId: string) => void;
}

export function RunButtonGroup({ cases, runningCaseId, disabled, onRun }: RunButtonGroupProps) {
  const ordered = [...cases].sort((a, b) => {
    const left = preferredCases.indexOf(a.caseId);
    const right = preferredCases.indexOf(b.caseId);
    return (left === -1 ? 99 : left) - (right === -1 ? 99 : right);
  });

  return (
    <Space wrap className="w-full">
      {ordered.map((item) => (
        <Button
          key={item.caseId}
          type={preferredCases.includes(item.caseId) ? "primary" : "default"}
          icon={<PlayCircleOutlined />}
          loading={runningCaseId === item.caseId}
          disabled={disabled}
          className="max-w-full"
          onClick={() => onRun(item.caseId)}
        >
          {caseName(item)}
        </Button>
      ))}
    </Space>
  );
}

function caseName(item: CaseItem): string {
  const names: Record<string, string> = {
    login_user: "user 登录流程",
    login_admin: "admin 登录流程",
    kyc_submit: "KYC 提交流程",
    kyc_submit_and_approve: "KYC 提交 + admin 审核完整流程"
  };
  return names[item.caseId] ?? item.caseName;
}
