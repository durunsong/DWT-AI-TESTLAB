export interface TypewriterTextOptions {
  onUpdate: (value: string) => void;
  schedule?: (callback: () => void, delayMs: number) => number;
  cancel?: (id: number) => void;
  intervalMs?: number;
  charsPerTick?: number;
  charsPerFrame?: number;
  minCharsPerTick?: number;
  maxCharsPerTick?: number;
  onTypingChange?: (typing: boolean) => void;
}

export interface TypewriterTextController {
  done: Promise<void>;
  cancel: () => void;
  finish: () => void;
}

export function playTypewriterText(text: string, options: TypewriterTextOptions): TypewriterTextController {
  const schedule = options.schedule ?? ((callback, delayMs) => window.setTimeout(callback, delayMs));
  const cancelScheduled = options.cancel ?? ((id) => window.clearTimeout(id));
  const chars = splitTypewriterText(text);
  const intervalMs = normalizePositiveNumber(options.intervalMs, 22);
  const charsPerTick = Math.max(
    1,
    Math.floor(options.charsPerTick ?? options.charsPerFrame ?? adaptiveCharsPerTick(chars.length, options))
  );
  let index = 0;
  let scheduledId: number | undefined;
  let settled = false;
  let resolveDone: () => void = () => undefined;
  const done = new Promise<void>((resolve) => {
    resolveDone = resolve;
  });

  const complete = () => {
    if (settled) {
      return;
    }
    settled = true;
    if (scheduledId !== undefined) {
      cancelScheduled(scheduledId);
      scheduledId = undefined;
    }
    options.onTypingChange?.(false);
    resolveDone();
  };

  const tick = () => {
    scheduledId = undefined;
    if (settled) {
      return;
    }
    index = Math.min(chars.length, index + charsPerTick);
    options.onUpdate(chars.slice(0, index).join(""));
    if (index >= chars.length) {
      complete();
      return;
    }
    scheduledId = schedule(tick, intervalMs);
  };

  options.onTypingChange?.(Boolean(chars.length));
  options.onUpdate("");
  scheduledId = schedule(tick, 0);

  return {
    done,
    cancel: complete,
    finish() {
      options.onUpdate(text);
      complete();
    }
  };
}

function adaptiveCharsPerTick(length: number, options: TypewriterTextOptions): number {
  const min = Math.max(1, Math.floor(options.minCharsPerTick ?? 2));
  const max = Math.max(min, Math.floor(options.maxCharsPerTick ?? 28));
  if (length <= 0) {
    return min;
  }
  return Math.min(max, Math.max(min, Math.ceil(length / 140)));
}

function normalizePositiveNumber(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}

function splitTypewriterText(text: string): string[] {
  try {
    const segmenterCtor = (Intl as unknown as {
      Segmenter?: new (locale: string, options: { granularity: "grapheme" }) => {
        segment(value: string): Iterable<{ segment: string }>;
      };
    }).Segmenter;

    if (segmenterCtor) {
      const segmenter = new segmenterCtor("zh-CN", { granularity: "grapheme" });
      return Array.from(segmenter.segment(text), (item) => item.segment);
    }
  } catch {
    // Fall back to code points when Segmenter is unavailable or partially implemented.
  }
  return Array.from(text);
}
