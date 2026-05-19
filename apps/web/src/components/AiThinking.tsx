export function AiThinking() {
  return (
    <div className="ai-thinking" aria-live="polite" aria-label="AI 正在分析">
      <span className="ai-thinking__icon" aria-hidden="true" />
      <span className="ai-thinking__text">
        AI 正在分析
        <span className="ai-thinking__dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
      </span>
    </div>
  );
}
