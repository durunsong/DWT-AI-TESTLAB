import assert from "node:assert/strict";
import { test } from "node:test";
import { dashboardLayoutClasses } from "./dashboard-layout";

test("dashboard main content uses page-level scrolling instead of clipping the left column", () => {
  assert.equal(hasClass(dashboardLayoutClasses.page, "h-full"), false);
  assert.equal(hasClass(dashboardLayoutClasses.row, "xl:overflow-hidden"), false);
  assert.equal(hasClass(dashboardLayoutClasses.leftColumn, "xl:overflow-y-auto"), false);
  assert.equal(hasClass(dashboardLayoutClasses.page, "pb-4"), true);
});

function hasClass(className: string, token: string): boolean {
  return className.split(/\s+/).includes(token);
}
