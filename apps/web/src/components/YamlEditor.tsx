import Editor from "@monaco-editor/react";

interface YamlEditorProps {
  value: string;
  onChange: (value: string) => void;
}

export function YamlEditor({ value, onChange }: YamlEditorProps) {
  return (
    <Editor
      height="calc(100vh - 260px)"
      defaultLanguage="yaml"
      language="yaml"
      theme="vs-dark"
      value={value}
      onChange={(next) => onChange(next ?? "")}
      options={{
        fontSize: 14,
        minimap: { enabled: false },
        wordWrap: "on",
        tabSize: 2,
        scrollBeyondLastLine: false
      }}
    />
  );
}
