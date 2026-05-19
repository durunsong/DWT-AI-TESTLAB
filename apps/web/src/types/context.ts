export interface DowaletRouteNode {
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

export interface DowaletAuthSourceSummary {
  source: "user" | "admin";
  authFile: string;
  profile: Record<string, unknown>;
  routeCount: number;
  visibleRouteCount: number;
  enterpriseRoutes: DowaletRouteNode[];
  approvalRoutes: DowaletRouteNode[];
}

export interface DowaletContextSummary {
  user: DowaletAuthSourceSummary;
  admin: DowaletAuthSourceSummary;
}

export interface DbHealthResult {
  enabled: boolean;
  ok: boolean;
  host?: string;
  port?: number;
  database?: string;
  message: string;
}
