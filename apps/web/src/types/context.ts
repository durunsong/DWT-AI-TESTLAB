export interface AppRouteNode {
  path: string;
  fullPath: string;
  name?: string;
  title?: string;
  component?: string;
  perm?: string;
  visible?: string;
  hidden?: boolean;
  menuType?: string;
  id?: string;
}

export interface AppAuthSourceSummary {
  source: string;
  authFile: string;
  routeSourceKey?: string;
  profile: Record<string, unknown>;
  routeCount: number;
  visibleRouteCount: number;
  routes: AppRouteNode[];
  enterpriseRoutes: AppRouteNode[];
  approvalRoutes: AppRouteNode[];
}

export interface AppContextSummary {
  user: AppAuthSourceSummary;
  admin: AppAuthSourceSummary;
  sources: AppAuthSourceSummary[];
}

export type AppAuthSourceOverview = Omit<AppAuthSourceSummary, "routes" | "enterpriseRoutes" | "approvalRoutes">;

export interface AppContextOverview {
  user: AppAuthSourceOverview;
  admin: AppAuthSourceOverview;
  sources: AppAuthSourceOverview[];
}

export interface AppContextSourceDetail {
  source: string;
  fileName: string;
  content: string;
  updatedAt?: string;
  summary: AppAuthSourceSummary;
}

export interface DbHealthResult {
  enabled: boolean;
  ok: boolean;
  host?: string;
  port?: number;
  database?: string;
  message: string;
}
