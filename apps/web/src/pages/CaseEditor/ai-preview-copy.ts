export function aiYamlPreviewPlaceholder(generating: boolean): string {
  return generating ? "AI 正在整理用例内容，请稍等。" : "选择生成方式并点击生成后，AI 会在这里准备 YAML 草稿。";
}
