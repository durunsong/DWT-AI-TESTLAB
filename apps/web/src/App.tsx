import {
  BarChartOutlined,
  FileSearchOutlined,
  HistoryOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  PlaySquareOutlined,
  SettingOutlined,
  UnorderedListOutlined
} from "@ant-design/icons";
import { Button, Layout, Menu, Tooltip, Typography } from "antd";
import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { appProductName } from "./config/brand";
import { cn } from "./utils/cn";

export function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(() => (typeof window === "undefined" ? false : window.innerWidth < 1280));

  useEffect(() => {
    const media = window.matchMedia("(max-width: 1279px)");
    const syncCollapsed = (event: MediaQueryListEvent | MediaQueryList) => {
      if (event.matches) setCollapsed(true);
    };
    syncCollapsed(media);
    media.addEventListener("change", syncCollapsed);
    return () => media.removeEventListener("change", syncCollapsed);
  }, []);

  return (
    <Layout className="h-screen overflow-hidden">
      <Layout.Sider
        width={248}
        collapsedWidth={76}
        collapsed={collapsed}
        collapsible
        trigger={null}
        theme="dark"
        className="h-screen shrink-0 overflow-y-auto overflow-x-hidden !bg-[#111827]"
      >
        <div className={cn("flex h-24 items-center border-b border-white/10 px-4 transition-all", collapsed ? "justify-center" : "justify-between gap-3")}>
          <div className={cn("flex min-w-0 items-center", collapsed ? "justify-center" : "gap-3")}>
            <BrandMark className="h-10 w-10 shrink-0" />
            {!collapsed ? (
              <div className="min-w-0 flex-1">
                <Typography.Text className="!block !whitespace-nowrap !text-slate-400">AI 自动化测试平台</Typography.Text>
                <Typography.Title level={4} className="!mb-0 !mt-1 truncate !text-slate-50">
                  {appProductName}
                </Typography.Title>
              </div>
            ) : null}
          </div>
          <Tooltip title={collapsed ? "展开菜单" : "折叠菜单"} placement="right">
            <Button
              aria-label={collapsed ? "展开菜单" : "折叠菜单"}
              type="text"
              size="small"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              className={cn("!h-8 !w-8 !rounded-lg !text-slate-300 hover:!bg-white/10 hover:!text-white", collapsed ? "!hidden" : "")}
              onClick={() => setCollapsed((value) => !value)}
            />
          </Tooltip>
        </div>
        {collapsed ? (
          <Tooltip title="展开菜单" placement="right">
            <Button
              aria-label="展开菜单"
              type="text"
              size="small"
              icon={<MenuUnfoldOutlined />}
              className="!mx-auto !mb-2 !mt-3 !flex !h-8 !w-8 !items-center !justify-center !rounded-lg !text-slate-300 hover:!bg-white/10 hover:!text-white"
              onClick={() => setCollapsed(false)}
            />
          </Tooltip>
        ) : null}
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey(location.pathname)]}
          onClick={(item) => navigate(item.key)}
          inlineCollapsed={collapsed}
          items={[
            { key: "/dashboard", icon: <BarChartOutlined />, label: "运行工作台" },
            { key: "/cases", icon: <UnorderedListOutlined />, label: "用例管理" },
            { key: "/runs/latest", icon: <PlaySquareOutlined />, label: "执行详情" },
            { key: "/reports/latest", icon: <FileSearchOutlined />, label: "报告查看" },
            { key: "/history", icon: <HistoryOutlined />, label: "历史记录" },
            { key: "/settings", icon: <SettingOutlined />, label: "运行设置" }
          ]}
        />
      </Layout.Sider>
      <Layout className="h-screen min-w-0 overflow-hidden">
        <Layout.Content className="h-screen min-w-0 overflow-y-auto overflow-x-hidden p-4 2xl:p-[22px]">
          <Outlet />
        </Layout.Content>
      </Layout>
    </Layout>
  );
}

function BrandMark({ className }: { className?: string }) {
  return (
    <span className={cn("relative inline-flex items-center justify-center rounded-xl bg-slate-950 shadow-sm ring-1 ring-white/10", className)}>
      <svg viewBox="0 0 48 48" aria-hidden="true" className="h-8 w-8">
        <path
          d="M24 5.6c5.9 5.1 11.4 7.4 17.2 8.4v9.9c0 10.4-6.6 17.2-17.2 20.5C13.4 40.9 6.8 34.2 6.8 23.9V14c5.8-1 11.3-3.3 17.2-8.4Z"
          fill="#f20562"
        />
        <path
          d="M24 12.1c3.8 3 7.5 4.6 11.6 5.4v6.1c0 6.7-4.3 11.1-11.6 13.7-7.3-2.6-11.6-7-11.6-13.7v-6.1c4.1-.8 7.8-2.4 11.6-5.4Z"
          fill="#111827"
        />
      </svg>
    </span>
  );
}

function selectedKey(pathname: string): string {
  if (pathname.startsWith("/cases")) return "/cases";
  if (pathname.startsWith("/runs")) return "/runs/latest";
  if (pathname.startsWith("/reports")) return "/reports/latest";
  if (pathname.startsWith("/history")) return "/history";
  if (pathname.startsWith("/settings")) return "/settings";
  return "/dashboard";
}
