/**
 * station-service.ts
 *
 * Windows Service chạy dưới quyền SYSTEM, start type = Automatic
 * → Chạy TRƯỚC login screen (services.exe load trước winlogon)
 *
 * Nhiệm vụ:
 * 1. Lock hệ thống (block Task Manager, regedit, services.msc...)
 * 2. Mở IPC server (WebSocket localhost:4001) để Electron app kết nối
 * 3. Nhận lệnh lock/unlock từ Electron app khi user login/logout
 * 4. Process monitoring — kill blocked apps liên tục
 *
 * NOTE: Electron app tự khởi động qua Windows Registry Run key
 * (app.setLoginItemSettings trong main.ts). Service KHÔNG spawn Electron
 * vì service chạy ở Session 0 — không có desktop, không hiển thị GUI được.
 */

import { WebSocketServer, WebSocket } from "ws";
import { lockSystem, unlockSystem, startProcessMonitor } from "./system-lock";

// ─── Configuration ───────────────────────────────────────────────────────────
const IPC_PORT = 4001;
const IPC_SECRET = "netcafe-secret-2024";
const PROCESS_MONITOR_INTERVAL = 3000;

// ─── State ───────────────────────────────────────────────────────────────────
let isLocked = true; // Start locked — user must login
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

// ─── Service Lifecycle ───────────────────────────────────────────────────────
// NOTE: Electron app is launched via Windows Registry Run key (set by app.setLoginItemSettings).
// Services run in Session 0 (no desktop) — cannot spawn GUI apps directly.
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

  console.log("[Service] ✅ Service initialized — waiting for connections");
}

// ─── Graceful Shutdown ───────────────────────────────────────────────────────
function shutdown(): void {
  console.log("[Service] Shutting down...");
  stopProcessMonitor();
  unlockSystem(); // Remove restrictions on service stop
  wss.close();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

// ─── Start ───────────────────────────────────────────────────────────────────
init();
