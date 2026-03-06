/**
 * NetAgentService — agent.ts
 * Compile với tsconfig.main.json → dist/main/service/agent.js
 * Chạy dưới LocalSystem qua node-windows
 */
import { execSync, exec, spawn } from "child_process";
import path from "path";
import fs from "fs";
import os from "os";
import { WebSocketServer, WebSocket } from "ws";
import http from "http";
import type {
  ServiceState,
  IPCMessage,
  LoginSuccessPayload,
  TimerData,
  SessionWarning,
} from "../types";

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const CONFIG = {
  NET_CLIENT_EXE: process.env.NET_CLIENT_PATH ?? "C:\\NetCafe\\NetClient.exe",
  IPC_PORT: 9988,
  IPC_SECRET: process.env.IPC_SECRET ?? "netcafe-secret-2024",
  WATCHDOG_INTERVAL: 2000,
  LOG_FILE: "C:\\NetCafe\\logs\\agent.log",
  BLOCKED_PROCESSES: [
    "taskmgr.exe",
    "regedit.exe",
    "cmd.exe",
    "powershell.exe",
    "mmc.exe",
    "msconfig.exe",
  ],
} as const;

// ─── STATE ───────────────────────────────────────────────────────────────────
let state: ServiceState = {
  isLoggedIn: false,
  sessionUser: null,
  sessionStart: null,
  sessionMinutes: 0,
};

// ─── LOGGER ──────────────────────────────────────────────────────────────────
function log(msg: string): void {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  try {
    const dir = path.dirname(CONFIG.LOG_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(CONFIG.LOG_FILE, line + "\n");
  } catch (_) {
    /* ignore */
  }
}

// ─── PROCESS UTILS ───────────────────────────────────────────────────────────
function isProcessRunning(exeName: string): boolean {
  try {
    const out = execSync(`tasklist /FI "IMAGENAME eq ${exeName}" /FO CSV /NH`, {
      encoding: "utf8",
      windowsHide: true,
      timeout: 3000,
    });
    return out.toLowerCase().includes(exeName.toLowerCase());
  } catch {
    return false;
  }
}

function killProcess(exeName: string): void {
  try {
    execSync(`taskkill /F /IM "${exeName}"`, {
      windowsHide: true,
      timeout: 3000,
    });
    log(`[Watchdog] Killed: ${exeName}`);
  } catch (_) {
    /* process may not exist */
  }
}

function spawnNetClient(): void {
  try {
    const child = spawn(CONFIG.NET_CLIENT_EXE, [], {
      detached: true,
      stdio: "ignore",
      windowsHide: false,
    });
    child.unref();
    log("[Watchdog] Spawned NetClient.exe");
  } catch (e) {
    log(`[Watchdog] Failed to spawn NetClient: ${(e as Error).message}`);
  }
}

function spawnExplorer(): void {
  exec("explorer.exe", { windowsHide: false }, (err) => {
    if (err) log("[Service] Failed to spawn explorer: " + err.message);
    else log("[Service] Spawned explorer.exe");
  });
}

// ─── REGISTRY HELPERS ────────────────────────────────────────────────────────
function regWrite(
  fullPath: string,
  valueName: string,
  valueType: string,
  value: string,
): void {
  try {
    execSync(
      `reg add "${fullPath}" /v "${valueName}" /t ${valueType} /d "${value}" /f`,
      { windowsHide: true, timeout: 5000 },
    );
  } catch (e) {
    log(
      `[Registry] Error writing ${fullPath}\\${valueName}: ${(e as Error).message}`,
    );
  }
}

// ─── SECURITY POLICIES ───────────────────────────────────────────────────────
function applyLockdownPolicies(): void {
  log("[Security] Applying lockdown policies...");

  // 1) Đổi Shell → NetClient.exe
  regWrite(
    "HKLM\\Software\\Microsoft\\Windows NT\\CurrentVersion\\Winlogon",
    "Shell",
    "REG_SZ",
    CONFIG.NET_CLIENT_EXE,
  );

  // 2) Disable Task Manager (user + system)
  regWrite(
    "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Policies\\System",
    "DisableTaskMgr",
    "REG_DWORD",
    "1",
  );
  regWrite(
    "HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Policies\\System",
    "DisableTaskMgr",
    "REG_DWORD",
    "1",
  );

  // 3) Disable Registry Editor
  regWrite(
    "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Policies\\System",
    "DisableRegistryTools",
    "REG_DWORD",
    "1",
  );

  // 4) Disable CMD
  regWrite(
    "HKCU\\Software\\Policies\\Microsoft\\Windows\\System",
    "DisableCMD",
    "REG_DWORD",
    "1",
  );

  // 5) Disable Run dialog
  regWrite(
    "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Policies\\Explorer",
    "NoRun",
    "REG_DWORD",
    "1",
  );

  // 6) Disable right-click desktop
  regWrite(
    "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Policies\\Explorer",
    "NoViewContextMenu",
    "REG_DWORD",
    "1",
  );

  // 7) No Control Panel
  regWrite(
    "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Policies\\Explorer",
    "NoControlPanel",
    "REG_DWORD",
    "1",
  );

  log("[Security] Lockdown applied.");
}

function restoreShell(): void {
  regWrite(
    "HKLM\\Software\\Microsoft\\Windows NT\\CurrentVersion\\Winlogon",
    "Shell",
    "REG_SZ",
    "explorer.exe",
  );
  log("[Security] Shell restored to explorer.exe");
}

// ─── WATCHDOG ─────────────────────────────────────────────────────────────────
let watchdogTimer: ReturnType<typeof setInterval> | null = null;

function startWatchdog(): void {
  log("[Watchdog] Starting...");
  watchdogTimer = setInterval(() => {
    // Ensure NetClient always runs
    if (!isProcessRunning("NetClient.exe")) {
      log("[Watchdog] NetClient not running → respawn");
      spawnNetClient();
    }

    // Kill explorer + blocked apps when locked
    if (!state.isLoggedIn) {
      if (isProcessRunning("explorer.exe")) {
        log("[Watchdog] Unauthorized explorer → kill");
        killProcess("explorer.exe");
      }
      for (const proc of CONFIG.BLOCKED_PROCESSES) {
        if (isProcessRunning(proc)) {
          log(`[Watchdog] Blocked process: ${proc}`);
          killProcess(proc);
        }
      }
    }
  }, CONFIG.WATCHDOG_INTERVAL);
}

function stopWatchdog(): void {
  if (watchdogTimer) clearInterval(watchdogTimer);
}

// ─── SESSION TIMER ────────────────────────────────────────────────────────────
let sessionTimer: ReturnType<typeof setInterval> | null = null;

function startSessionTimer(): void {
  let elapsed = 0;
  sessionTimer = setInterval(() => {
    elapsed += 1;
    const remaining = state.sessionMinutes - elapsed;

    const timerData: TimerData = { elapsed, remaining };
    broadcastIPC({
      type: "TIMER_UPDATE",
      payload: timerData,
      secret: CONFIG.IPC_SECRET,
    });

    if (remaining === 5) {
      const warning: SessionWarning = { message: "Còn 5 phút!", remaining };
      broadcastIPC({
        type: "SESSION_WARNING",
        payload: warning,
        secret: CONFIG.IPC_SECRET,
      });
    }

    if (remaining <= 0) {
      stopSessionTimer();
      onSessionExpired();
    }
  }, 60 * 1000);
}

function stopSessionTimer(): void {
  if (sessionTimer) clearInterval(sessionTimer);
  sessionTimer = null;
}

// ─── SESSION EVENTS ───────────────────────────────────────────────────────────
function onLoginSuccess(payload: LoginSuccessPayload): void {
  log(`[Session] Login: ${payload.username}, ${payload.sessionMinutes} min`);
  state = {
    isLoggedIn: true,
    sessionUser: payload.username,
    sessionStart: Date.now(),
    sessionMinutes: payload.sessionMinutes,
  };
  spawnExplorer();
  startSessionTimer();
  broadcastIPC({ type: "STATE", payload: state, secret: CONFIG.IPC_SECRET });
}

function onLogout(): void {
  log(`[Session] Logout: ${state.sessionUser ?? "unknown"}`);
  state = {
    isLoggedIn: false,
    sessionUser: null,
    sessionStart: null,
    sessionMinutes: 0,
  };
  stopSessionTimer();
  killProcess("explorer.exe");
  applyLockdownPolicies();
  broadcastIPC({ type: "STATE", payload: state, secret: CONFIG.IPC_SECRET });
}

function onSessionExpired(): void {
  log("[Session] Expired");
  broadcastIPC({
    type: "SESSION_EXPIRED",
    payload: {},
    secret: CONFIG.IPC_SECRET,
  });
  setTimeout(() => onLogout(), 3000);
}

// ─── IPC SERVER ───────────────────────────────────────────────────────────────
const ipcClients = new Set<WebSocket>();

function startIPCServer(): void {
  const server = http.createServer();
  const wss = new WebSocketServer({ server });

  wss.on("connection", (ws, req) => {
    const ip = req.socket.remoteAddress ?? "";
    const isLocal = ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(ip);
    if (!isLocal) {
      ws.close(1008, "Unauthorized");
      return;
    }

    log("[IPC] Client connected");
    ipcClients.add(ws);
    ws.send(JSON.stringify({ type: "STATE", payload: state }));

    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as IPCMessage;
        if (msg.secret !== CONFIG.IPC_SECRET) {
          ws.close(1008, "Unauthorized");
          return;
        }
        handleIPCMessage(ws, msg);
      } catch (e) {
        log("[IPC] Parse error: " + (e as Error).message);
      }
    });

    ws.on("close", () => {
      ipcClients.delete(ws);
      log("[IPC] Client disconnected");
    });

    ws.on("error", (e) => log("[IPC] WS error: " + e.message));
  });

  server.listen(CONFIG.IPC_PORT, "127.0.0.1", () => {
    log(`[IPC] Server listening on 127.0.0.1:${CONFIG.IPC_PORT}`);
  });
}

function broadcastIPC(msg: IPCMessage): void {
  const data = JSON.stringify(msg);
  for (const ws of ipcClients) {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(data);
      } catch (_) {
        /* ignore */
      }
    }
  }
}

function handleIPCMessage(ws: WebSocket, msg: IPCMessage): void {
  log(`[IPC] Received: ${msg.type}`);
  switch (msg.type) {
    case "LOGIN_SUCCESS":
      onLoginSuccess(msg.payload as LoginSuccessPayload);
      break;
    case "LOGOUT":
      onLogout();
      break;
    case "GET_STATE":
      ws.send(
        JSON.stringify({
          type: "STATE",
          payload: state,
          secret: CONFIG.IPC_SECRET,
        }),
      );
      break;
    case "SPAWN_EXPLORER":
      spawnExplorer();
      break;
    case "PING":
      ws.send(
        JSON.stringify({
          type: "PONG",
          ts: Date.now(),
          secret: CONFIG.IPC_SECRET,
        }),
      );
      break;
    default:
      log(`[IPC] Unknown: ${msg.type}`);
  }
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
function main(): void {
  log("===========================================");
  log("  NetAgentService starting");
  log(`  Machine: ${os.hostname()} | ${os.platform()} ${os.release()}`);
  log("===========================================");

  applyLockdownPolicies();
  startIPCServer();
  startWatchdog();

  process.on("SIGTERM", () => {
    log("[Service] SIGTERM → shutdown");
    stopWatchdog();
    restoreShell();
    process.exit(0);
  });

  process.on("SIGINT", () => {
    log("[Service] SIGINT → shutdown");
    stopWatchdog();
    process.exit(0);
  });
}

main();
