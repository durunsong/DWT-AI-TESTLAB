import { Button } from "antd";
import { CopyOutlined } from "@ant-design/icons";
import { useMemo, type ReactNode } from "react";
import { cn } from "../utils/cn";

interface MarkdownViewerProps {
  content: string;
  onCopyCode?: (code: string) => void;
  className?: string;
}

type Block =
  | { type: "heading"; level: number; text: string }
  | { type: "paragraph"; lines: string[] }
  | { type: "ordered"; items: string[] }
  | { type: "unordered"; items: string[] }
  | { type: "code"; code: string };

export function MarkdownViewer({ content, onCopyCode, className }: MarkdownViewerProps) {
  const blocks = useMemo(() => parseMarkdown(content), [content]);

  return (
    <div className={cn("text-sm leading-7 text-slate-100", className ?? "max-h-[62vh] min-h-[260px] overflow-auto rounded-lg bg-slate-950 p-5")}>
      <div className="space-y-2.5">
        {blocks.map((block, index) => renderBlock(block, index, onCopyCode))}
      </div>
    </div>
  );
}

function renderBlock(block: Block, index: number, onCopyCode?: (code: string) => void): ReactNode {
  if (block.type === "heading") {
    const Tag = `h${Math.min(block.level, 4)}` as "h1" | "h2" | "h3" | "h4";
    return (
      <Tag key={index} className="mt-1 font-semibold text-white">
        {renderInline(block.text)}
      </Tag>
    );
  }

  if (block.type === "ordered") {
    return (
      <ol key={index} className="list-decimal space-y-2 pl-6">
        {block.items.map((item, itemIndex) => (
          <li key={itemIndex}>{renderInline(item)}</li>
        ))}
      </ol>
    );
  }

  if (block.type === "unordered") {
    return (
      <ul key={index} className="list-disc space-y-2 pl-6">
        {block.items.map((item, itemIndex) => (
          <li key={itemIndex}>{renderInline(item)}</li>
        ))}
      </ul>
    );
  }

  if (block.type === "code") {
    return (
      <div key={index} className="overflow-hidden rounded-md border border-slate-700 bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-700 px-3 py-2 text-xs text-slate-400">
          <span>代码块</span>
          <Button
            size="small"
            icon={<CopyOutlined />}
            disabled={!onCopyCode}
            onClick={() => onCopyCode?.(block.code)}
          >
            复制代码
          </Button>
        </div>
        <pre className="m-0 overflow-auto p-3 text-xs leading-6 text-slate-200">
          <code>{block.code}</code>
        </pre>
      </div>
    );
  }

  return (
    <p key={index} className="whitespace-pre-wrap text-slate-100">
      {block.lines.map((line, lineIndex) => (
        <span key={`${line}-${lineIndex}`}>
          {lineIndex > 0 ? <br /> : null}
          {renderInline(line)}
        </span>
      ))}
    </p>
  );
}

export function parseMarkdown(content: string): Block[] {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index] ?? "";

    if (!line.trim()) {
      index += 1;
      continue;
    }

    if (line.trim().startsWith("```")) {
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !(lines[index] ?? "").trim().startsWith("```")) {
        code.push(lines[index] ?? "");
        index += 1;
      }
      blocks.push({ type: "code", code: code.join("\n") });
      index += 1;
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading?.[1] && heading[2]) {
      blocks.push({ type: "heading", level: heading[1].length, text: heading[2] });
      index += 1;
      continue;
    }

    const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (ordered) {
      const items: string[] = [];
      while (index < lines.length) {
        const item = (lines[index] ?? "").match(/^\s*\d+[.)]\s+(.+)$/);
        if (!item?.[1]) break;
        items.push(item[1]);
        index += 1;
      }
      blocks.push({ type: "ordered", items });
      continue;
    }

    const unordered = line.match(/^\s*[-*]\s+(.+)$/);
    if (unordered) {
      const items: string[] = [];
      while (index < lines.length) {
        const item = (lines[index] ?? "").match(/^\s*[-*]\s+(.+)$/);
        if (!item?.[1]) break;
        items.push(item[1]);
        index += 1;
      }
      blocks.push({ type: "unordered", items });
      continue;
    }

    const paragraph: string[] = [];
    while (index < lines.length) {
      const current = lines[index] ?? "";
      if (
        !current.trim() ||
        current.trim().startsWith("```") ||
        /^(#{1,4})\s+.+$/.test(current) ||
        /^\s*(?:\d+[.)]|[-*])\s+.+$/.test(current)
      ) {
        break;
      }
      paragraph.push(current);
      index += 1;
    }
    blocks.push({ type: "paragraph", lines: paragraph });
  }

  return blocks;
}

function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    const token = match[0];
    if (token.startsWith("**")) {
      nodes.push(
        <strong key={`${token}-${match.index}`} className="font-semibold text-white">
          {token.slice(2, -2)}
        </strong>
      );
    } else {
      nodes.push(
        <code key={`${token}-${match.index}`} className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-xs text-cyan-100">
          {token.slice(1, -1)}
        </code>
      );
    }

    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}
