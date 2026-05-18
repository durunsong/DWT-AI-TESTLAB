import { execFileSync } from "node:child_process";
import path from "node:path";

const rootDir = path.resolve(process.cwd()).toLowerCase();
const ports = (process.env.DEV_PORTS ?? "4300,4301,4302")
  .split(",")
  .map((port) => Number(port.trim()))
  .filter((port) => Number.isInteger(port) && port > 0);

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

function collectProcesses(targetPorts) {
  const ps = `
$ports = @(${targetPorts.join(",")})
$items = foreach ($port in $ports) {
  Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue |
    Where-Object { $_.State -eq 'Listen' } |
    Select-Object -Property LocalPort, OwningProcess
}
$items |
  Sort-Object -Property OwningProcess -Unique |
  ForEach-Object {
    $proc = Get-CimInstance Win32_Process -Filter "ProcessId = $($_.OwningProcess)" -ErrorAction SilentlyContinue
    [PSCustomObject]@{
      port = $_.LocalPort
      pid = $_.OwningProcess
      commandLine = if ($proc) { $proc.CommandLine } else { "" }
    }
  } |
  ConvertTo-Json -Compress
`;

  const output = execFileSync("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", ps], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  }).trim();

  if (!output) {
    return [];
  }

  const parsed = JSON.parse(output);
  return (Array.isArray(parsed) ? parsed : [parsed]).map((item) => ({
    port: Number(item.port),
    pid: Number(item.pid),
    commandLine: String(item.commandLine ?? "")
  }));
}
