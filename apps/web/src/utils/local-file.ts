export interface DataUrlReaderOptions {
  readAsDataUrl?: (file: File) => Promise<string>;
}

export interface ObjectUrlFactory {
  createObjectURL(file: Blob): string;
  revokeObjectURL(url: string): void;
}

export interface ObjectUrlPreview {
  url: string;
  revoke: () => void;
}

export function createBase64FileCache(options: DataUrlReaderOptions = {}) {
  const readAsDataUrl = options.readAsDataUrl ?? readFileAsDataUrl;
  const cache = new Map<string, Promise<string>>();

  return {
    read(file: File): Promise<string> {
      const key = fileCacheKey(file);
      const cached = cache.get(key);
      if (cached) {
        return cached;
      }

      const reading = readAsDataUrl(file)
        .then(dataUrlToBase64)
        .catch((error: unknown) => {
          cache.delete(key);
          throw error;
        });
      cache.set(key, reading);
      return reading;
    },
    clear() {
      cache.clear();
    }
  };
}

export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (!items.length) {
    return [];
  }

  const limit = Math.max(1, Math.min(Math.floor(concurrency), items.length));
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index] as T, index);
    }
  }

  await Promise.all(Array.from({ length: limit }, worker));
  return results;
}

export function createObjectUrlPreview(file: File, urlFactory: ObjectUrlFactory = URL): ObjectUrlPreview {
  const url = urlFactory.createObjectURL(file);
  let revoked = false;
  return {
    url,
    revoke() {
      if (revoked) {
        return;
      }
      revoked = true;
      urlFactory.revokeObjectURL(url);
    }
  };
}

export function dataUrlToBase64(dataUrl: string): string {
  return dataUrl.split(",", 2)[1] ?? "";
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error(`${file.name} 文件读取失败`));
    reader.readAsDataURL(file);
  });
}

function fileCacheKey(file: File): string {
  return [file.name, file.size, file.type, file.lastModified].join(":");
}
