import fs from "node:fs/promises";
import path from "node:path";
import { maskSensitive } from "@ai-e2e/shared";

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
  routes: DowaletRouteNode[];
  enterpriseRoutes: DowaletRouteNode[];
  approvalRoutes: DowaletRouteNode[];
}

export interface DowaletContextSummary {
  user: DowaletAuthSourceSummary;
  admin: DowaletAuthSourceSummary;
}

export interface DowaletContextOptions {
  userAuthFile?: string;
  adminAuthFile?: string;
}

interface RawRouteNode {
  path?: string;
  component?: string;
  visible?: string;
  hidden?: boolean;
  perm?: string;
  children?: RawRouteNode[];
  meta?: {
    title?: string;
    name?: string;
  };
  name?: string;
  menuType?: string;
  id?: string;
}

interface RawLoginPayload {
  data?: Record<string, unknown> & {
    auths?: RawRouteNode[];
  };
}

const enterpriseKeywords = ["企业", "enterprise", "认证", "auth"];
const approvalKeywords = ["审批", "审核", "approve", "review"];

export async function loadDowaletContext(rootDir: string, options: DowaletContextOptions = {}): Promise<DowaletContextSummary> {
  const userAuthFile = options.userAuthFile ?? process.env.DOWALET_USER_AUTH_FILE ?? "../front-end/dowalet-dev/ccc.json";
  const adminAuthFile = options.adminAuthFile ?? process.env.DOWALET_ADMIN_AUTH_FILE ?? "../front-end/dowalet-dev/ddd.json";

  const [user, admin] = await Promise.all([
    loadOne(rootDir, "user", userAuthFile),
    loadOne(rootDir, "admin", adminAuthFile)
  ]);

  return { user, admin };
}

export function findRoutesByKeyword(routes: DowaletRouteNode[], keywords: string[]): DowaletRouteNode[] {
  const normalizedKeywords = keywords.map((keyword) => keyword.toLowerCase());
  return routes.filter((route) => {
    const haystack = [route.path, route.fullPath, route.name, route.title, route.component, route.perm].filter(Boolean).join(" ").toLowerCase();
    return normalizedKeywords.some((keyword) => haystack.includes(keyword));
  });
}

async function loadOne(rootDir: string, source: "user" | "admin", authFile: string): Promise<DowaletAuthSourceSummary> {
  const absoluteFile = path.resolve(rootDir, authFile);
  const raw = JSON.parse(await fs.readFile(absoluteFile, "utf8")) as RawLoginPayload;
  const data = raw.data ?? {};
  const routes = flattenRoutes(data.auths ?? []);
  const profile = buildSafeProfile(data);

  return {
    source,
    authFile,
    profile,
    routeCount: routes.length,
    visibleRouteCount: routes.filter((route) => route.visible === "0" && !route.hidden).length,
    routes,
    enterpriseRoutes: findRoutesByKeyword(routes, enterpriseKeywords).slice(0, 30),
    approvalRoutes: findRoutesByKeyword(routes, approvalKeywords).slice(0, 30)
  };
}

function flattenRoutes(nodes: RawRouteNode[], parentPath = ""): DowaletRouteNode[] {
  const output: DowaletRouteNode[] = [];

  for (const node of nodes) {
    const pathValue = node.path ?? "";
    const fullPath = normalizeRoutePath(parentPath, pathValue);
    output.push({
      path: pathValue,
      fullPath,
      name: node.name,
      title: node.meta?.title ?? node.meta?.name,
      component: node.component,
      perm: node.perm,
      visible: node.visible,
      hidden: node.hidden,
      menuType: node.menuType,
      id: node.id
    });
    output.push(...flattenRoutes(node.children ?? [], fullPath));
  }

  return output;
}

function normalizeRoutePath(parentPath: string, currentPath: string): string {
  if (!parentPath && currentPath) {
    return ensureLeadingSlash(currentPath);
  }
  if (currentPath.startsWith("/")) {
    return currentPath;
  }
  return ensureLeadingSlash(`${parentPath}/${currentPath}`.replace(/\/+/g, "/"));
}

function ensureLeadingSlash(value: string): string {
  return value.startsWith("/") ? value : `/${value}`;
}

function buildSafeProfile(data: Record<string, unknown>): Record<string, unknown> {
  const keys = [
    "userId",
    "userType",
    "name",
    "mobileNo",
    "email",
    "userLevel",
    "userAuthStatus",
    "accountType",
    "enterNo",
    "enterStatus",
    "loginSource",
    "serviceProviderFlag",
    "isGoogleVerify"
  ];

  return maskSensitive(Object.fromEntries(keys.filter((key) => key in data).map((key) => [key, data[key]])));
}
