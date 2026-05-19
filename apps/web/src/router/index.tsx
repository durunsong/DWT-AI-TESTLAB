import { lazy, Suspense, type ReactNode } from "react";
import { Navigate, createBrowserRouter } from "react-router-dom";
import { Spin } from "antd";
import { App } from "../App";

const Dashboard = lazy(() => import("../pages/Dashboard"));
const CaseList = lazy(() => import("../pages/CaseList"));
const CaseEditor = lazy(() => import("../pages/CaseEditor"));
const RunDetail = lazy(() => import("../pages/RunDetail"));
const ReportViewer = lazy(() => import("../pages/ReportViewer"));
const RunHistory = lazy(() => import("../pages/RunHistory"));
const Settings = lazy(() => import("../pages/Settings"));

export const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: "dashboard", element: route(<Dashboard />) },
      { path: "cases", element: route(<CaseList />) },
      { path: "cases/:caseId", element: route(<CaseEditor />) },
      { path: "runs/:runId", element: route(<RunDetail />) },
      { path: "reports/:runId", element: route(<ReportViewer />) },
      { path: "history", element: route(<RunHistory />) },
      { path: "settings", element: route(<Settings />) }
    ]
  }
]);

function route(element: ReactNode) {
  return <Suspense fallback={<PageLoading />}>{element}</Suspense>;
}

function PageLoading() {
  return (
    <div className="flex min-h-[360px] items-center justify-center rounded-lg border border-slate-200 bg-white">
      <Spin tip="页面加载中">
        <div className="h-12 w-36" />
      </Spin>
    </div>
  );
}
