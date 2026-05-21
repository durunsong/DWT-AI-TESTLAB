import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { findRoutesByKeyword, loadAppContext, parseAppAuthSourceContent } from "./app-context";

test("loads login payload and direct route files without leaking token fields", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "app-context-"));
  await fs.writeFile(
    path.join(rootDir, "user-login.json"),
    JSON.stringify({
      data: {
        userId: "u-1",
        name: "测试用户",
        token: "secret-token",
        auths: [
          {
            path: "enterprise",
            meta: { title: "企业管理" },
            children: [{ path: "auth", meta: { title: "企业认证" }, component: "views/enterprise/auth.vue", visible: "0" }]
          }
        ]
      }
    }),
    "utf8"
  );
  await fs.writeFile(
    path.join(rootDir, "admin-routes.json"),
    JSON.stringify({
      routes: [
        {
          path: "/admin",
          title: "管理端",
          children: [{ path: "approve", title: "认证审批", component: "views/admin/approve.vue" }]
        }
      ]
    }),
    "utf8"
  );

  const context = await loadAppContext(rootDir, {
    userAuthFile: "user-login.json",
    adminAuthFile: "admin-routes.json"
  });

  assert.equal(context.user.source, "user");
  assert.equal(context.admin.source, "admin");
  assert.equal(context.user.routeSourceKey, "$.data.auths");
  assert.equal(context.admin.routeSourceKey, "$.routes");
  assert.equal(context.user.routeCount, 2);
  assert.equal(context.admin.routeCount, 2);
  assert.equal("token" in context.user.profile, false);
  assert.equal(context.user.routes[1]?.fullPath, "/enterprise/auth");
});

test("parses js route modules without executing uploaded code", () => {
  const summary = parseAppAuthSourceContent(
    "admin",
    "admin-routes.ts",
    `
      import Layout from "@/layout";

      export default [
        {
          path: "/admin",
          name: "AdminRoot",
          component: Layout,
          children: [
            {
              path: "audit",
              meta: { title: "Audit Center" },
              component: () => import("@/views/admin/audit/index.vue"),
              permission: "audit:view"
            }
          ]
        }
      ];
    `
  );

  assert.equal(summary.routeSourceKey, "$.routes");
  assert.equal(summary.routeCount, 2);
  assert.equal(summary.routes[1]?.fullPath, "/admin/audit");
  assert.equal(summary.routes[1]?.title, "Audit Center");
  assert.equal(summary.routes[1]?.component, "@/views/admin/audit/index.vue");
});

test("returns empty summaries when no auth files are configured", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "app-context-empty-"));
  const context = await loadAppContext(rootDir);

  assert.equal(context.user.routeCount, 0);
  assert.equal(context.admin.routeCount, 0);
  assert.equal(context.user.authFile, "");
  assert.equal(context.admin.authFile, "");
});

test("parses imported route arrays and nested menu containers", () => {
  const user = parseAppAuthSourceContent(
    "user",
    "imported-user-routes.json",
    JSON.stringify([
      { path: "/enterprise/query", label: "企业查询" },
      { path: "/account", meta: { title: "账户中心" } }
    ])
  );
  const admin = parseAppAuthSourceContent(
    "admin",
    "imported-admin-menu.json",
    JSON.stringify({
      result: {
        menuList: [{ routePath: "/admin/audit", menuName: "认证审核", permission: "audit:view" }]
      }
    })
  );

  const userEnterpriseRoutes = findRoutesByKeyword(user.routes, ["企业", "enterprise"]);
  const adminApproveRoutes = findRoutesByKeyword(admin.routes, ["审核", "approve"]);

  assert.equal(user.routeSourceKey, "$");
  assert.equal(admin.routeSourceKey, "$.result.menuList");
  assert.equal(userEnterpriseRoutes[0]?.title, "企业查询");
  assert.equal(adminApproveRoutes[0]?.perm, "audit:view");
});
