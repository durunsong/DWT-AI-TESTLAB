import path from "node:path";

const screenshotUrlPattern = /^\/?screenshots[\\/]/i;
const allowedImagePattern = /\.(png|jpg|jpeg|webp)$/i;

export function resolveScreenshotPath(rootDir: string, inputPath: string): string {
  if (!inputPath) {
    throw new Error("截图路径不能为空");
  }

  const screenshotsRoot = path.resolve(rootDir, "screenshots");
  const decoded = decodeURIComponent(inputPath.trim());
  const localPath = screenshotUrlPattern.test(decoded)
    ? path.resolve(rootDir, decoded.replace(/^\/+/, ""))
    : path.resolve(decoded);

  const normalizedRoot = normalizeForCompare(screenshotsRoot);
  const normalizedPath = normalizeForCompare(localPath);
  if (normalizedPath !== normalizedRoot && !normalizedPath.startsWith(`${normalizedRoot}${path.sep}`)) {
    throw new Error(`截图文件必须位于 ${screenshotsRoot} 下`);
  }
  if (!allowedImagePattern.test(localPath)) {
    throw new Error("只支持分析 png、jpg、jpeg、webp 截图");
  }

  return localPath;
}

export function imageMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  return "image/png";
}

function normalizeForCompare(filePath: string): string {
  return path.resolve(filePath).toLowerCase();
}
