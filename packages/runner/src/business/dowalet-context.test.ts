import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { loadDowaletContext, findRoutesByKeyword } from "./dowalet-context";

const rootDir = path.resolve(process.cwd(), "..", "..", "..");

test("loads user and admin auth context without leaking token fields", async () => {
  const context = await loadDowaletContext(rootDir, {
    userAuthFile: "front-end/dowalet-dev/ccc.json",
    adminAuthFile: "front-end/dowalet-dev/ddd.json"
  });

  assert.equal(context.user.source, "user");
  assert.equal(context.admin.source, "admin");
  assert.ok(context.user.routeCount > 0);
  assert.ok(context.admin.routeCount > 0);
  assert.equal("token" in context.user.profile, false);
  assert.equal("token" in context.admin.profile, false);
});

test("finds enterprise and approval routes from auth route table", async () => {
  const context = await loadDowaletContext(rootDir, {
    userAuthFile: "front-end/dowalet-dev/ccc.json",
    adminAuthFile: "front-end/dowalet-dev/ddd.json"
  });

  const userEnterpriseRoutes = findRoutesByKeyword(context.user.routes, ["企业", "enterprise"]);
  const adminApproveRoutes = findRoutesByKeyword(context.admin.routes, ["审批", "approve"]);

  assert.ok(userEnterpriseRoutes.some((route) => route.path.includes("enterprise") || route.title?.includes("企业")));
  assert.ok(adminApproveRoutes.some((route) => route.path.includes("approve") || route.title?.includes("审批")));
});
