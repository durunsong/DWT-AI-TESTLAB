import { useEffect, useState } from "react";
import { MarkdownViewer } from "./MarkdownViewer";
import { playTypewriterText } from "../utils/typewriter-text";
import { cn } from "../utils/cn";

interface TypewriterMarkdownViewerProps {
  content: string;
  className?: string;
  charsPerTick?: number;
  charsPerFrame?: number;
  intervalMs?: number;
  onCopyCode?: (code: string) => void;
}

export function TypewriterMarkdownViewer({ content, className, charsPerTick, charsPerFrame, intervalMs, onCopyCode }: TypewriterMarkdownViewerProps) {
  const [visibleContent, setVisibleContent] = useState("");
  const [typing, setTyping] = useState(false);

  useEffect(() => {
    let active = true;
    const typing = playTypewriterText(content, {
      charsPerTick,
      charsPerFrame,
      intervalMs,
      onTypingChange: (nextTyping) => {
        if (active) setTyping(nextTyping);
      },
      onUpdate: (value) => {
        if (active) setVisibleContent(value);
      }
    });
    return () => {
      active = false;
      typing.cancel();
    };
  }, [charsPerFrame, charsPerTick, content, intervalMs]);

  return (
    <div className={cn("typewriter-markdown", typing ? "typewriter-markdown--typing" : undefined)}>
      <MarkdownViewer content={visibleContent} className={className} onCopyCode={onCopyCode} />
      {typing ? <span className="typewriter-caret typewriter-caret--markdown" aria-hidden="true" /> : null}
    </div>
  );
}
