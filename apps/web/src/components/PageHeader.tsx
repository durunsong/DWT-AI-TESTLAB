import { Space, Typography } from "antd";
import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  description?: string;
  extra?: ReactNode;
}

export function PageHeader({ title, description, extra }: PageHeaderProps) {
  return (
    <div className="flex min-h-[72px] flex-wrap items-start justify-between gap-3 rounded-lg border border-[#d8e0ec] bg-white px-4 py-4 shadow-[0_10px_30px_rgba(15,23,42,0.08)] 2xl:px-5 2xl:py-[18px]">
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
          <Typography.Title level={2} className="!mb-0 !mt-0 break-words">
            {title}
          </Typography.Title>
          {description ? (
            <Typography.Text className="min-w-0 break-all font-mono !text-xs !leading-5" type="secondary">
              {description}
            </Typography.Text>
          ) : null}
        </div>
      </div>
      {extra ? <Space wrap>{extra}</Space> : null}
    </div>
  );
}
