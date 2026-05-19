import { Button, Empty, Space } from "antd";
import { CopyOutlined } from "@ant-design/icons";
import { maskText } from "../utils/mask";
import { cn } from "../utils/cn";

interface LogTerminalProps {
  logs: string[] | string;
  heightClassName?: string;
  className?: string;
}

export function LogTerminal({ logs, heightClassName = "h-[360px]", className }: LogTerminalProps) {
  const content = Array.isArray(logs) ? logs.join("\n") : logs;

  async function copy() {
    if (content) {
      await navigator.clipboard.writeText(content);
    }
  }

  return (
    <div className={cn("flex min-h-0 flex-col overflow-hidden rounded-lg border border-[#d8e0ec] bg-white", className)}>
      <div className="flex min-h-[46px] items-center justify-between border-b border-[#d8e0ec] px-3 py-2">
        <span>运行日志</span>
        <Space>
          <Button size="small" icon={<CopyOutlined />} disabled={!content} onClick={() => void copy()}>
            复制
          </Button>
        </Space>
      </div>
      {content ? (
        <pre
          className={cn(
            "m-0 min-h-0 w-full flex-1 overflow-auto whitespace-pre-wrap break-words bg-slate-900 p-3.5 font-mono text-xs leading-relaxed text-slate-300",
            heightClassName
          )}
        >
          {maskText(content)}
        </pre>
      ) : (
        <div className={cn("flex min-h-0 flex-1 items-center justify-center", heightClassName)}>
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无日志" />
        </div>
      )}
    </div>
  );
}
