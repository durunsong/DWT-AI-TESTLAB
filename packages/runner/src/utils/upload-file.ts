import path from "node:path";

export function resolveUploadFilePath(rootDir: string, file: string): string {
  const trimmed = file.trim();
  if (!trimmed) {
    throw new Error("上传文件路径不能为空");
  }

  const rootPath = path.resolve(rootDir);
  const filePath = path.isAbsolute(trimmed)
    ? path.resolve(trimmed)
    : path.resolve(rootPath, trimmed);

  if (filePath !== rootPath && !filePath.startsWith(rootPath + path.sep)) {
    throw new Error(`上传文件不能指向项目目录外：${file}`);
  }

  return filePath;
}
