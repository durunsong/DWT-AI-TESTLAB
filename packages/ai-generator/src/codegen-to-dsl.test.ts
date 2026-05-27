import assert from "node:assert/strict";
import test from "node:test";
import { convertCodegenScriptToSteps } from "./codegen-to-dsl";

test("uses the last quoted argument for generated input and text assertion steps", () => {
  const steps = convertCodegenScriptToSteps([
    "await page.getByLabel('Username').fill('alice');",
    "await expect(page.getByRole('heading')).toContainText('Welcome');"
  ].join("\n"));

  assert.equal(steps[0]?.type, "web_input");
  assert.equal(steps[0]?.value, "alice");
  assert.equal(steps[1]?.type, "web_assert_text");
  assert.equal(steps[1]?.expected, "Welcome");
});
