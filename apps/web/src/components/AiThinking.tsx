interface AiThinkingProps {
  text?: string;
}

export function AiThinking({ text = "AI 正在分析" }: AiThinkingProps) {
  return (
    <div className="ai-thinking" aria-live="polite" aria-label={text}>
      <span className="ai-thinking__icon" aria-hidden="true" />
      <span className="ai-thinking__text">
        {text}
        <span className="ai-thinking__dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
      </span>
    </div>
  );
}
