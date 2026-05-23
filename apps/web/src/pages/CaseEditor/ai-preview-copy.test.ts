import assert from "node:assert/strict";
import test from "node:test";
import { aiYamlPreviewPlaceholder } from "./ai-preview-copy";

test("uses friendly AI preview copy without technical streaming wording", () => {
  assert.equal(aiYamlPreviewPlaceholder(false), "选择生成方式并点击生成后，AI 会在这里准备 YAML 草稿。");
  assert.equal(aiYamlPreviewPlaceholder(true), "AI 正在整理用例内容，请稍等。");
  assert.doesNotMatch(aiYamlPreviewPlaceholder(false), /流式输出|模拟流式|stream/i);
  assert.doesNotMatch(aiYamlPreviewPlaceholder(true), /流式输出|模拟流式|stream/i);
});
