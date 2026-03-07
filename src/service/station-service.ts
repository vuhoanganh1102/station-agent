/**
 * station-service.ts
 *
 * Windows Service chạy dưới quyền SYSTEM, start type = Automatic
 * → Chạy TRƯỚC login screen (services.exe load trước winlogon)
 *
 * Nhiệm vụ:
 * 1. Lock hệ thống (block Task Manager, regedit, services.msc...)
 * 2. Mở IPC server (WebSocket localhost:4001) để Electron app kết nối
 * 3. Monitor Electron app — restart nếu bị kill
 * 4. Nhận lệnh lock/unlock từ Electron app khi user login/logout
 * 5. Process monitoring — kill blocked apps liên tục
 */

import { WebSocketServer, WebSocket } from "ws";
import { spawn, ChildProcess } from "child_process";
import path from "path";
import { lockSystem, unlockSystem, startProcessMonitor } from "./system-lock";

// ─── Configuration ───────────────────────────────────────────────────────────
const IPC_PORT = 4001;
const IPC_SECRET = "netcafe-secret-2024";
const ELECTRON_APP_PATH = path.resolve(
  __dirname,
  "../../StationAgent Setup 1.2.0.exe",
);
const PROCESS_MONITOR_INTERVAL = 3000;

// ─── State ───────────────────────────────────────────────────────────────────
let isLocked = true; // Start locked — user must login
let electronProcess: ChildProcess | null = null;
let connectedClient: WebSocket | null = null;
let processMonitorId: NodeJS.Timeout | null = null;

// ─── IPC WebSocket Server ────────────────────────────────────────────────────
const wss = new WebSocketServer({ port: 4001, host: "127.0.0.1" });
console.log(`[Service] IPC server listening on ws://127.0.0.1:${IPC_PORT}`);

wss.on("connection", (ws) => {
  console.log("[Service] Electron app connected via IPC");
  connectedClient = ws;

  // Send current state immediately
  sendToClient({
    type: "STATE",
    payload: { isLocked, isLoggedIn: !isLocked },
  });

  ws.on("message", (raw) => {
    try {
      const msg = JSON.parse(raw.toString()) as {
        type: string;
        secret?: string;
        payload?: Record<string, unknown>;
      };

      // Validate secret
      if (msg.secret !== IPC_SECRET) {
        console.warn("[Service] Invalid IPC secret");
        return;
      }

      handleIPCMessage(msg);
    } catch (e) {
      console.error("[Service] IPC parse error:", (e as Error).message);
    }
  });

  ws.on("close", () => {
    console.log("[Service] Electron app disconnected");
    connectedClient = null;
  });

  ws.on("error", (err) => {
    console.error("[Service] IPC error:", err.message);
  });
});

function sendToClient(msg: Record<string, unknown>): void {
  if (connectedClient?.readyState === WebSocket.OPEN) {
    connectedClient.send(JSON.stringify(msg));
  }
}

// ─── IPC Message Handlers ────────────────────────────────────────────────────
function handleIPCMessage(msg: {
  type: string;
  payload?: Record<string, unknown>;
}): void {
  switch (msg.type) {
    case "LOGIN_SUCCESS": {
      const { username, sessionMinutes } = msg.payload ?? {};
      console.log(
        `[Service] ✅ User login: ${username} (${sessionMinutes} min)`,
      );
      isLocked = false;
      unlockSystem();
      stopProcessMonitor();
      sendToClient({
        type: "STATE",
        payload: {
          isLocked: false,
          isLoggedIn: true,
          sessionUser: username,
          sessionMinutes,
        },
      });
      break;
    }

    case "LOGOUT": {
      console.log("[Service] 🔒 User logout — locking system");
      isLocked = true;
      lockSystem();
      startMonitor();
      sendToClient({
        type: "STATE",
        payload: { isLocked: true, isLoggedIn: false },
      });
      break;
    }

    case "SESSION_EXPIRED": {
      console.log("[Service] ⏰ Session expired — locking system");
      isLocked = true;
      lockSystem();
      startMonitor();
      sendToClient({ type: "SESSION_EXPIRED" });
      break;
    }

    case "GET_STATE": {
      sendToClient({
        type: "STATE",
        payload: { isLocked, isLoggedIn: !isLocked },
      });
      break;
    }

    case "PING": {
      sendToClient({ type: "PONG" });
      break;
    }

    default:
      console.log(`[Service] Unknown IPC message type: ${msg.type}`);
  }
}

// ─── Process Monitor ─────────────────────────────────────────────────────────
function startMonitor(): void {
  if (processMonitorId) return;
  processMonitorId = startProcessMonitor(PROCESS_MONITOR_INTERVAL);
}

function stopProcessMonitor(): void {
  if (processMonitorId) {
    clearInterval(processMonitorId);
    processMonitorId = null;
    console.log("[Service] Process monitor stopped");
  }
}

// ─── Electron App Monitor ────────────────────────────────────────────────────
function startElectronApp(): void {
  if (electronProcess) return;

  try {
    console.log(`[Service] Starting Electron app: ${ELECTRON_APP_PATH}`);

    electronProcess = spawn(ELECTRON_APP_PATH, [], {
      detached: false,
      stdio: "ignore",
      // Run in user session (Session 1) — not Session 0 (service session)
      // Note: For this to work properly, the service needs to interact with desktop
      // or use a helper to launch in the user's session
    });

    electronProcess.on("exit", (code) => {
      console.log(`[Service] Electron app exited with code ${code}`);
      electronProcess = null;

      // Restart after delay if station is locked (prevent user from killing it)
      if (isLocked) {
        console.log("[Service] Station locked — restarting Electron in 3s...");
        setTimeout(startElectronApp, 3000);
      }
    });

    electronProcess.on("error", (err) => {
      console.error("[Service] Failed to start Electron:", err.message);
      electronProcess = null;
      // Retry
      setTimeout(startElectronApp, 5000);
    });
  } catch (e) {
    console.error("[Service] Electron spawn error:", (e as Error).message);
    setTimeout(startElectronApp, 5000);
  }
}

// ─── Service Lifecycle ───────────────────────────────────────────────────────
function init(): void {
  console.log("========================================");
  console.log("  NetCafe Station Service");
  console.log(`  IPC Port: ${IPC_PORT}`);
  console.log(`  State: LOCKED`);
  console.log("========================================");

  // 1. Apply system lockdown immediately
  lockSystem();

  // 2. Start process monitor
  startMonitor();

  // 3. Start Electron app (for the login GUI)
  // Note: In production, Electron app should auto-start via registry
  // or the service launches it in the user session
  startElectronApp(); // Uncomment when paths are configured

  console.log("[Service] ✅ Service initialized — waiting for connections");
}

// ─── Graceful Shutdown ───────────────────────────────────────────────────────
function shutdown(): void {
  console.log("[Service] Shutting down...");
  stopProcessMonitor();
  unlockSystem(); // Remove restrictions on service stop
  wss.close();

  if (electronProcess) {
    electronProcess.kill();
  }

  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

// ─── Start ───────────────────────────────────────────────────────────────────
init();
