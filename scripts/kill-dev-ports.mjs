import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const rootDir = path.resolve(process.cwd()).toLowerCase();
const platformPorts = readPlatformPorts();
const ports = (process.env.DEV_PORTS ?? platformPorts.join(","))
  .split(",")
  .map((port) => Number(port.trim()))
  .filter((port) => Number.isInteger(port) && port > 0);

if (!ports.length) {
  console.log("[dev:stop] 未配置需要清理的端口，跳过。");
  process.exit(0);
}

if (process.platform !== "win32") {
  console.log("[dev:stop] 当前清理脚本只处理 Windows 端口残留；非 Windows 环境跳过。");
  process.exit(0);
}

const processes = collectProcesses(ports);
const projectProcesses = processes.filter((item) => {
  const commandLine = item.commandLine.toLowerCase();
  return commandLine.includes(rootDir) && commandLine.includes("node");
});

if (!projectProcesses.length) {
  console.log(`[dev:stop] 未发现本项目残留端口进程：${ports.join(", ")}`);
  process.exit(0);
}

for (const item of projectProcesses) {
  try {
    execFileSync("taskkill", ["/PID", String(item.pid), "/F"], { stdio: "pipe" });
    console.log(`[dev:stop] 已结束 PID ${item.pid}，端口 ${item.port}`);
  } catch (error) {
    console.warn(`[dev:stop] 结束 PID ${item.pid} 失败：${error instanceof Error ? error.message : String(error)}`);
  }
}

function readPlatformPorts() {
  const fallback = [4300, 4301, 4302];
  const configPath = path.resolve(process.cwd(), "platform.config.json");
  if (!fs.existsSync(configPath)) {
    return fallback;
  }

  try {
    const raw = JSON.parse(fs.readFileSync(configPath, "utf8"));
    const configuredPorts = [
      raw.server?.port,
      raw.web?.port,
      raw.desktop?.apiPort
    ]
      .map((port) => Number(port))
      .filter((port) => Number.isInteger(port) && port > 0);
    return configuredPorts.length ? configuredPorts : fallback;
  } catch (error) {
    console.warn(`[dev:stop] 读取 platform.config.json 失败，使用默认端口：${error instanceof Error ? error.message : String(error)}`);
    return fallback;
  }
}

function collectProcesses(targetPorts) {
  const netstatOutput = execFileSync("netstat", ["-ano", "-p", "tcp"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
  const portSet = new Set(targetPorts);
  const byPid = new Map();

  for (const line of netstatOutput.split(/\r?\n/)) {
    const columns = line.trim().split(/\s+/);
    if (columns.length < 5 || columns[0] !== "TCP" || columns[3] !== "LISTENING") {
      continue;
    }
    const port = Number(columns[1]?.match(/:(\d+)$/)?.[1]);
    const pid = Number(columns[4]);
    if (!portSet.has(port) || !Number.isInteger(pid)) {
      continue;
    }
    byPid.set(pid, { port, pid, commandLine: "" });
  }

  if (!byPid.size) {
    return [];
  }

  const commandLines = readCommandLines([...byPid.keys()]);
  return [...byPid.values()].map((item) => ({
    ...item,
    commandLine: commandLines.get(item.pid) ?? ""
  }));
}

function readCommandLines(pids) {
  const ps = `
$pids = @(${pids.join(",")})
$pids | ForEach-Object {
  $proc = Get-CimInstance Win32_Process -Filter "ProcessId = $($_)" -ErrorAction SilentlyContinue
  if ($proc) {
    [PSCustomObject]@{
      pid = $_
      commandLine = $proc.CommandLine
    }
  }
} | ConvertTo-Json -Compress
`;

  const output = execFileSync("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", ps], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  }).trim();
  if (!output) {
    return new Map();
  }

  const parsed = JSON.parse(output);
  const rows = Array.isArray(parsed) ? parsed : [parsed];
  return new Map(rows.map((item) => [Number(item.pid), String(item.commandLine ?? "")]));
}
