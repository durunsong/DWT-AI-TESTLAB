import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { AppContextService } from "./app-context.service";

test("persists imported route source and reloads it after service recreation", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "app-context-service-"));
  const service = new AppContextService(rootDir);

  const saved = await service.saveSource({
    source: "user",
    fileName: "../user-routes.ts",
    content: `
      export const routes = [
        { path: "/account", meta: { title: "Account" } },
        { path: "/enterprise", children: [{ path: "auth", title: "Enterprise Auth" }] }
      ];
    `
  });

  assert.equal(saved.fileName, "user-routes.ts");
  assert.equal(saved.summary.routeCount, 3);

  const recreated = new AppContextService(rootDir);
  const context = await recreated.getContext();
  const detail = await recreated.getSource("user");

  assert.equal(context.user.routeCount, 3);
  assert.deepEqual(
    context.sources.map((source) => source.source),
    ["user", "admin"]
  );
  assert.match(detail.content, /export const routes/);
  assert.equal(detail.summary.routes[2]?.fullPath, "/enterprise/auth");
  assert.equal(context.admin.routeCount, 0);
});

test("supports custom route source keys beyond user and admin", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "app-context-custom-"));
  const service = new AppContextService(rootDir);

  await service.saveSource({
    source: "operator",
    fileName: "operator-menu.json",
    content: JSON.stringify({ menus: [{ path: "/ops/review", title: "Ops Review" }] })
  });

  const context = await service.getContext();
  assert.deepEqual(
    context.sources.map((source) => source.source),
    ["user", "admin", "operator"]
  );
  assert.equal(context.sources.find((source) => source.source === "operator")?.routeCount, 1);

  const afterDelete = await service.deleteSource("operator");
  assert.equal(afterDelete.sources.some((source) => source.source === "operator"), false);
});

test("builds lightweight context overview without full route arrays", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "app-context-overview-"));
  const service = new AppContextService(rootDir);

  await service.saveSource({
    source: "user",
    fileName: "user-routes.json",
    content: JSON.stringify({ routes: [{ path: "/account" }, { path: "/enterprise/auth" }] })
  });

  const overview = await service.getContextOverview();

  assert.equal(overview.user.routeCount, 2);
  assert.equal("routes" in overview.user, false);
  assert.equal("enterpriseRoutes" in overview.user, false);
  assert.equal("approvalRoutes" in overview.user, false);
  assert.equal(overview.sources[0]?.source, "user");
});
