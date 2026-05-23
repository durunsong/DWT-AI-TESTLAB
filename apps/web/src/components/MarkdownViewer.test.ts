import assert from "node:assert/strict";
import test from "node:test";
import { parseMarkdown } from "./MarkdownViewer";

test("treats incomplete markdown markers as plain paragraphs", () => {
  assert.deepEqual(parseMarkdown("- "), [{ type: "paragraph", lines: ["- "] }]);
  assert.deepEqual(parseMarkdown("1. "), [{ type: "paragraph", lines: ["1. "] }]);
  assert.deepEqual(parseMarkdown("## "), [{ type: "paragraph", lines: ["## "] }]);
});
