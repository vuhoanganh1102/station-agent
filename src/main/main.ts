import {
  app,
  BrowserWindow,
  desktopCapturer,
  ipcMain,
  Tray,
  Menu,
  nativeImage,
  screen,
  dialog,
  IpcMainEvent,
  IpcMainInvokeEvent,
  globalShortcut,
  net,
} from "electron";
import path from "path";
import os from "os";
import http from "http";
import { io, Socket } from "socket.io-client";

import type {
  SystemInfo,
  ScreenSource,
  MouseButton,
  KeyEventPayload,
  WebRTCOfferPayload,
  LoginRequest,
  LoginResponse,
} from "../types";
import config from "./config";

// ─── GLOBALS ─────────────────────────────────────────────────────────────────
let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let socket: Socket | null = null;
let isQuitting = false;
let isStationLocked = true; // Start locked — user must login

const stationId: string = config.STATION_ID || os.hostname();
const serverUrl = `https://daniel-unforetellable-uncorrelatively.ngrok-free.dev`;

// ─── SYSTEM INFO ─────────────────────────────────────────────────────────────
function getLocalIP(): string {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] ?? []) {
      if (iface.family === "IPv4" && !iface.internal) return iface.address;
    }
  }
  return "127.0.0.1";
}

function getSystemInfo(): SystemInfo {
  return {
    stationId,
    stationIp: getLocalIP(),
    hostname: os.hostname(),
    platform: os.platform(),
    cpuModel: os.cpus()[0]?.model ?? "Unknown",
    totalMemory: Math.round((os.totalmem() / 1024 ** 3) * 10) / 10,
  };
}

// ─── ROBOT (nut-js) ──────────────────────────────────────────────────────────
type NutMouse = {
  setPosition: (p: { x: number; y: number }) => Promise<void>;
  click: (btn: unknown) => Promise<void>;
  doubleClick: (btn: unknown) => Promise<void>;
  releaseButton: (btn: unknown) => Promise<void>;
  scrollDown: (n: number) => Promise<void>;
  scrollUp: (n: number) => Promise<void>;
  scrollLeft: (n: number) => Promise<void>;
  scrollRight: (n: number) => Promise<void>;
  getPosition: () => Promise<{ x: number; y: number }>;
  config: { mouseSpeed: number };
};

type NutKeyboard = {
  pressKey: (k: unknown) => Promise<void>;
  releaseKey: (k: unknown) => Promise<void>;
  type: (s: string) => Promise<void>;
  config: { autoDelayMs: number };
};

interface NutLib {
  mouse: NutMouse;
  keyboard: NutKeyboard;
  Key: Record<string, unknown>;
  Button: Record<string, unknown>;
  Point: new (x: number, y: number) => { x: number; y: number };
}

let nutLib: NutLib | null = null;
let mouseMoveCount = 0;

async function initRobot(): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const nut = require("@nut-tree-fork/nut-js") as NutLib;
    nut.mouse.config.mouseSpeed = 2000;
    nut.keyboard.config.autoDelayMs = 0;
    nutLib = nut;
    const pos = await nut.mouse.getPosition();
    console.log(`✅ nut-js OK — mouse: ${pos.x},${pos.y}`);
  } catch (e) {
    const err = e as Error;
    console.warn("⚠️ nut-js unavailable:", err.message);
  }
}

function mapKeyToNut(key: string): unknown | null {
  if (!nutLib) return null;
  const { Key } = nutLib;

  const map: Record<string, unknown> = {
    Enter: Key["Return"],
    Backspace: Key["Backspace"],
    Tab: Key["Tab"],
    Escape: Key["Escape"],
    Delete: Key["Delete"],
    Home: Key["Home"],
    End: Key["End"],
    PageUp: Key["PageUp"],
    PageDown: Key["PageDown"],
    ArrowUp: Key["Up"],
    ArrowDown: Key["Down"],
    ArrowLeft: Key["Left"],
    ArrowRight: Key["Right"],
    " ": Key["Space"],
    Control: Key["LeftControl"],
    Shift: Key["LeftShift"],
    Alt: Key["LeftAlt"],
    Meta: Key["LeftSuper"],
    CapsLock: Key["CapsLock"],
    F1: Key["F1"],
    F2: Key["F2"],
    F3: Key["F3"],
    F4: Key["F4"],
    F5: Key["F5"],
    F6: Key["F6"],
    F7: Key["F7"],
    F8: Key["F8"],
    F9: Key["F9"],
    F10: Key["F10"],
    F11: Key["F11"],
    F12: Key["F12"],
  };
  if (map[key]) return map[key];
  if (key.length === 1 && /[a-zA-Z]/.test(key)) return Key[key.toUpperCase()];
  if (key.length === 1 && /[0-9]/.test(key)) return Key[`Num${key}`];
  const charMap: Record<string, unknown> = {
    "-": Key["Minus"],
    "=": Key["Equal"],
    "[": Key["LeftBracket"],
    "]": Key["RightBracket"],
    "\\": Key["Backslash"],
    ";": Key["Semicolon"],
    "'": Key["Quote"],
    ",": Key["Comma"],
    ".": Key["Period"],
    "/": Key["Slash"],
    "`": Key["Grave"],
  };
  return charMap[key] ?? null;
}

async function executeMouseMove(x: number, y: number): Promise<void> {
  if (!nutLib) return;
  mouseMoveCount++;
  try {
    await nutLib.mouse.setPosition(new nutLib.Point(x, y));
    if (mouseMoveCount % 100 === 1)
      console.log(`🖱️ move #${mouseMoveCount}: ${x},${y}`);
  } catch (e) {
    if (mouseMoveCount % 100 === 1)
      console.error("Mouse move error:", (e as Error).message);
  }
}

async function executeMouseClick(
  button: MouseButton,
  double: boolean,
  x: number,
  y: number,
): Promise<void> {
  if (!nutLib) return;
  const { Button } = nutLib;
  const btnMap: Record<string, unknown> = {
    left: Button["LEFT"],
    right: Button["RIGHT"],
    middle: Button["MIDDLE"],
  };
  try {
    await nutLib.mouse.setPosition(new nutLib.Point(x, y));
    const btn = btnMap[button] ?? Button["LEFT"];
    if (double) await nutLib.mouse.doubleClick(btn);
    else await nutLib.mouse.click(btn);
  } catch (e) {
    console.error("Click error:", (e as Error).message);
  }
}

async function executeMouseScroll(
  deltaX: number,
  deltaY: number,
): Promise<void> {
  if (!nutLib) return;
  try {
    if (deltaY > 0) await nutLib.mouse.scrollDown(Math.abs(deltaY));
    else if (deltaY < 0) await nutLib.mouse.scrollUp(Math.abs(deltaY));
    if (deltaX > 0) await nutLib.mouse.scrollRight(Math.abs(deltaX));
    else if (deltaX < 0) await nutLib.mouse.scrollLeft(Math.abs(deltaX));
  } catch (e) {
    console.error("Scroll error:", (e as Error).message);
  }
}

async function executeKeyDown(
  key: string,
  code: string,
  modifiers?: string[],
): Promise<void> {
  if (!nutLib) return;
  try {
    const k = mapKeyToNut(key);
    if (k != null) await nutLib.keyboard.pressKey(k);
  } catch (e) {
    console.error("KeyDown error:", (e as Error).message);
  }
}

async function executeKeyUp(key: string, _code: string): Promise<void> {
  if (!nutLib) return;
  try {
    const k = mapKeyToNut(key);
    if (k != null) await nutLib.keyboard.releaseKey(k);
  } catch (e) {
    console.error("KeyUp error:", (e as Error).message);
  }
}

// ─── COORDINATE SCALING ──────────────────────────────────────────────────────
function getScreenSize(): { width: number; height: number } {
  const d = screen.getPrimaryDisplay();
  return { width: d.size.width, height: d.size.height };
}

function scaleCoords(
  x: number,
  y: number,
  sw?: number,
  sh?: number,
): { x: number; y: number } {
  const actual = getScreenSize();
  if (sw && sh) {
    return {
      x: Math.round((x * actual.width) / sw),
      y: Math.round((y * actual.height) / sh),
    };
  }
  return { x: Math.round(x), y: Math.round(y) };
}

// ─── LOGIN API ───────────────────────────────────────────────────────────────
async function loginToServer(
  credentials: LoginRequest,
): Promise<LoginResponse> {
  try {
    const res = await fetch(`${serverUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...credentials }),
      signal: AbortSignal.timeout(10000),
    });

    return (await res.json()) as LoginResponse;
  } catch (e) {
    const msg = (e as Error).message;
    console.error("[Login] Error:", msg);
    return {
      success: false,
      message: `Không thể kết nối server: ${msg}`,
    };
  }
}
// ─── KIOSK MODE (Lock Screen Behavior) ──────────────────────────────────────
function applyKioskMode(): void {
  if (!mainWindow) return;

  // Fullscreen, always on top, non-closable
  mainWindow.setFullScreen(true);
  mainWindow.setAlwaysOnTop(true, "screen-saver"); // Highest z-order
  mainWindow.setSkipTaskbar(true);
  mainWindow.setMinimizable(false);
  mainWindow.setMaximizable(false);
  mainWindow.setClosable(false);
  mainWindow.setResizable(false);

  // Block keyboard shortcuts
  registerKioskShortcuts();

  console.log("[Kiosk] 🔒 Kiosk mode enabled");
}

function disableKioskMode(): void {
  if (!mainWindow) return;

  mainWindow.setAlwaysOnTop(false);
  mainWindow.setFullScreen(false);
  mainWindow.setClosable(true);
  mainWindow.setResizable(true);
  mainWindow.setMinimizable(true);

  // Show in taskbar when unlocked (optional — hide if you want agent invisible)
  mainWindow.setSkipTaskbar(true);

  // Minimize to tray when unlocked — user uses desktop normally
  mainWindow.hide();

  unregisterKioskShortcuts();

  console.log("[Kiosk] 🔓 Kiosk mode disabled — user has desktop access");
}

function registerKioskShortcuts(): void {
  // Block common escape shortcuts (these only work when app is focused)
  const shortcuts = [
    "Alt+Tab",
    "Alt+F4",
    "CommandOrControl+Escape",
    "Super+D", // Win+D (Show Desktop)
    "Super+E", // Win+E (Explorer)
    "Super+R", // Win+R (Run)
    "Super+L", // Win+L (Lock)
  ];

  shortcuts.forEach((shortcut) => {
    try {
      globalShortcut.register(shortcut, () => {
        // Block — do nothing
      });
    } catch {
      // Some shortcuts can't be registered
    }
  });
}

function unregisterKioskShortcuts(): void {
  globalShortcut.unregisterAll();
}

// ─── SOCKET CONNECTION ───────────────────────────────────────────────────────
function connectToServer(): void {
  socket = io(`${serverUrl}/agents`, {
    reconnection: true,
    reconnectionDelay: config.RECONNECT_INTERVAL,
    reconnectionAttempts:
      config.RECONNECT_ATTEMPTS === Infinity
        ? undefined
        : (config.RECONNECT_ATTEMPTS as number),
    auth: getSystemInfo(),
    transports: ["websocket", "polling"],
  });

  socket.on("connect", () => {
    console.log(`✅ Connected: ${serverUrl} | ID: ${stationId}`);
    const d = screen.getPrimaryDisplay();
    socket!.emit("screen-info", {
      width: d.size.width,
      height: d.size.height,
      scaleFactor: d.scaleFactor,
    });
    updateTrayTooltip("Connected");
    // Đợi renderer ready rồi mới gửi
    if (mainWindow?.webContents.isLoading()) {
      mainWindow.webContents.once("did-finish-load", () => {
        mainWindow?.webContents.send("server-connected", true);
      });
    } else {
      mainWindow?.webContents.send("server-connected", true);
    }
  });

  socket.on("disconnect", () => {
    console.log("❌ Disconnected from server");
    updateTrayTooltip("Disconnected");
    mainWindow?.webContents.send("server-connected", false);
  });

  socket.on("connect_error", (err: Error) => {
    console.log("Connection error:", err.message);
    updateTrayTooltip("Connection error");
  });

  // ── Screen sharing ──
  socket.on(
    "request-screen",
    ({ adminSocketId }: { adminSocketId: string }) => {
      console.log("📥 request-screen from admin:", adminSocketId);
      mainWindow?.webContents.send("start-screen-share", { adminSocketId });
    },
  );

  socket.on("stop-screen", ({ adminSocketId }: { adminSocketId: string }) => {
    mainWindow?.webContents.send("stop-screen-share", { adminSocketId });
  });

  // ── WebRTC signaling ──
  socket.on(
    "offer",
    ({ targetAdminId, sdp }: { targetAdminId: string; sdp: unknown }) => {
      mainWindow?.webContents.send("webrtc-offer", {
        adminSocketId: targetAdminId,
        sdp,
      });
    },
  );

  socket.on(
    "answer",
    ({ adminSocketId, sdp }: { adminSocketId: string; sdp: unknown }) => {
      mainWindow?.webContents.send("webrtc-answer", { adminSocketId, sdp });
    },
  );

  socket.on(
    "icecandidate",
    (data: { adminSocketId: string; candidate: unknown }) => {
      mainWindow?.webContents.send("webrtc-icecandidate", data);
    },
  );

  // ── Remote control ──
  socket.on(
    "mouse-move",
    (data: {
      x: number;
      y: number;
      screenWidth: number;
      screenHeight: number;
    }) => {
      const s = scaleCoords(
        data.x,
        data.y,
        data.screenWidth,
        data.screenHeight,
      );
      void executeMouseMove(s.x, s.y);
    },
  );

  socket.on(
    "mouse-click",
    (data: {
      button: MouseButton;
      double: boolean;
      x: number;
      y: number;
      screenWidth: number;
      screenHeight: number;
    }) => {
      const s = scaleCoords(
        data.x,
        data.y,
        data.screenWidth,
        data.screenHeight,
      );
      console.log(`🖱️ click: ${data.button} at ${s.x},${s.y}`);
      void executeMouseClick(data.button, data.double, s.x, s.y);
    },
  );

  socket.on(
    "mouse-up",
    (_data: { button: MouseButton; x: number; y: number }) => {
      // handled internally by nut-js in click flow
    },
  );

  socket.on("mouse-scroll", (data: { deltaX: number; deltaY: number }) => {
    void executeMouseScroll(data.deltaX, data.deltaY);
  });

  socket.on("key-down", (data: KeyEventPayload) => {
    void executeKeyDown(data.key, data.code, data.modifiers);
  });

  socket.on("key-up", (data: KeyEventPayload) => {
    void executeKeyUp(data.key, data.code);
  });

  socket.on("key-tap", (data: { key: string; modifiers?: string[] }) => {
    void executeKeyDown(data.key, data.key, data.modifiers);
    setTimeout(() => void executeKeyUp(data.key, data.key), 50);
  });

  socket.on("key-type", ({ text }: { text: string }) => {
    void nutLib?.keyboard.type(text);
  });

  // ── Management commands ──
  socket.on("lock-station", () => {
    console.log("🔒 Lock station (remote)");
    isStationLocked = true;
    applyKioskMode();
    mainWindow?.show();
    mainWindow?.webContents.send("lock-station");
  });

  socket.on("unlock-station", () => {
    console.log("🔓 Unlock station (remote)");
    isStationLocked = false;
    disableKioskMode();
    mainWindow?.webContents.send("unlock-station");
  });

  socket.on("shutdown-station", () => {
    const { exec } = require("child_process") as typeof import("child_process");
    exec(
      process.platform === "win32"
        ? 'shutdown /s /t 30 /c "Admin initiated shutdown"'
        : 'shutdown -h +1 "Admin initiated shutdown"',
    );
  });

  socket.on("restart-station", () => {
    const { exec } = require("child_process") as typeof import("child_process");
    exec(
      process.platform === "win32"
        ? 'shutdown /r /t 30 /c "Admin initiated restart"'
        : 'shutdown -r +1 "Admin initiated restart"',
    );
  });

  socket.on("show-message", ({ message }: { message: string }) => {
    console.log("💬 Admin message:", message);
    mainWindow?.webContents.send("show-message", { message });
  });

  socket.on("open-app", ({ appPath }: { appPath: string }) => {
    const { exec } = require("child_process") as typeof import("child_process");
    exec(
      process.platform === "win32"
        ? `start "" "${appPath}"`
        : `xdg-open "${appPath}"`,
    );
  });

  socket.on(
    "request-screenshot",
    ({ adminSocketId }: { adminSocketId: string }) => {
      mainWindow?.webContents.send("take-screenshot", { adminSocketId });
    },
  );
}

// ─── LOCK SCREEN ─────────────────────────────────────────────────────────────
function lockScreen(): void {
  const { exec } = require("child_process") as typeof import("child_process");
  if (process.platform === "win32")
    exec("rundll32.exe user32.dll,LockWorkStation");
  else exec("loginctl lock-session");
}

// ─── IPC HANDLERS ─────────────────────────────────────────────────────────────
function setupIPC(): void {
  // ── Station ID ──
  ipcMain.handle("get-station-id", () => stationId);

  // ── Login ──
  ipcMain.handle(
    "login",
    async (_e: IpcMainInvokeEvent, credentials: LoginRequest) => {
      console.log(`[IPC] Login attempt: ${credentials.username}`);

      const result = await loginToServer(credentials);

      if (result.success) {
        console.log(`[IPC] ✅ Login success: ${result.username}`);
        isStationLocked = false;

        // Disable kiosk mode — give user desktop access
        disableKioskMode();

        // Notify server that station is now in use
        socket?.emit("status-update", {
          status: "in-use",
          currentUser: result.username,
        });
      } else {
        console.log(`[IPC] ❌ Login failed: ${result.message}`);
      }

      return result;
    },
  );

  // ── Logout ──
  ipcMain.handle("logout", async () => {
    console.log("[IPC] Logout");
    isStationLocked = true;

    // Re-enable kiosk mode
    mainWindow?.show();
    applyKioskMode();

    // Notify server
    socket?.emit("status-update", {
      status: "online",
      currentUser: null,
    });

    return { success: true };
  });

  // ── WebRTC signaling relay ──
  ipcMain.on(
    "webrtc-offer",
    (_e: IpcMainEvent, { targetAdminId, sdp }: WebRTCOfferPayload) => {
      socket?.emit("offer", { targetAdminId, sdp });
    },
  );

  ipcMain.on(
    "webrtc-answer",
    (_e: IpcMainEvent, { targetAdminId, sdp }: WebRTCOfferPayload) => {
      socket?.emit("answer", { targetAdminId, sdp });
    },
  );

  ipcMain.on("webrtc-icecandidate", (_e: IpcMainEvent, data: unknown) => {
    socket?.emit("icecandidate", data);
  });

  ipcMain.on("screenshot-ready", (_e: IpcMainEvent, data: unknown) => {
    socket?.emit("screenshot", data);
  });

  ipcMain.handle(
    "get-sources",
    async (_e: IpcMainInvokeEvent): Promise<ScreenSource[]> => {
      try {
        const sources = await desktopCapturer.getSources({
          types: ["screen"],
          thumbnailSize: { width: 1920, height: 1080 },
        });
        return sources.map((s) => ({
          id: s.id,
          name: s.name,
          display_id: s.display_id,
        }));
      } catch (e) {
        console.error("get-sources error:", (e as Error).message);
        return [];
      }
    },
  );
}

// ─── TRAY ────────────────────────────────────────────────────────────────────
function createTray(): void {
  const icon = nativeImage.createFromBuffer(
    Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAbwAAAG8B8aLcQwAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAEBSURBVDiNpZMxSgNBFIa/mZ0lG7KJoKUgWHgBr+ABvIGFZ/AAegCx8AhewMZC0MJGBBsLaxE2m53n+yxmJ7sxBvzh8Zj//97MPBj+U+pH4BR4Bnq/lN8Al8C5qn5V1ftpW90CvIisBZ7cAMfAlYgcqeoNwC6AiOwBB8AhsKWqJyLSAZ6AE+BJRB6BS1V9F5G2m/sT+AL2VHUiIu/AHjAGLlT1WUQugCMROQJ2gBPg0d0Bc8Ba89e/e6iqa8ABcA0sA++qOhaRDjBQ1UcR6QNXQB84U9UJMHJ/gCLywN3lQ0TeVPWj+RgD9O4H3JpjfNr4rv0AAAAASUVORK5CYII=",
      "base64",
    ),
  );

  tray = new Tray(icon);
  const contextMenu = Menu.buildFromTemplate([
    { label: `Station: ${stationId}`, enabled: false },
    { label: `IP: ${getLocalIP()}`, enabled: false },
    { type: "separator" },
    {
      label: "Show Window",
      click: () => {
        mainWindow?.show();
        mainWindow?.focus();
      },
    },
    { type: "separator" },
    {
      label: "Quit (Admin Only)",
      click: () => {
        isQuitting = true;
        unregisterKioskShortcuts();
        app.quit();
      },
    },
  ]);
  tray.setToolTip(`Station Agent - ${stationId}`);
  tray.setContextMenu(contextMenu);
  tray.on("double-click", () => {
    mainWindow?.show();
    mainWindow?.focus();
  });
}

function updateTrayTooltip(status: string): void {
  tray?.setToolTip(`Station Agent - ${stationId} [${status}]`);
}

// ─── WINDOW ──────────────────────────────────────────────────────────────────
function createWindow(): void {
  const display = screen.getPrimaryDisplay();

  mainWindow = new BrowserWindow({
    width: display.size.height,
    height: display.size.height,
    x: 0,
    y: 0,
    frame: false, // No title bar — kiosk style
    fullscreen: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    minimizable: false,
    maximizable: false,
    closable: false,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, "../preload/preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.webContents.session.setPermissionRequestHandler(
    (_wc, permission, callback) => {
      callback(["media", "display-capture", "screen"].includes(permission));
    },
  );

  mainWindow.webContents.session.setDisplayMediaRequestHandler(
    (_request, callback) => {
      void desktopCapturer.getSources({ types: ["screen"] }).then((sources) => {
        callback({ video: sources[0], audio: "loopback" });
      });
    },
  );

  const isDev = process.env.NODE_ENV === "development";

  if (isDev) {
    void mainWindow.loadURL("http://localhost:5173");
    // In dev mode, don't apply full kiosk (for debugging)
    mainWindow.setAlwaysOnTop(false);
    mainWindow.setFullScreen(false);
    mainWindow.setClosable(true);
    mainWindow.setResizable(true);
    mainWindow.setBounds({ width: 500, height: 700, x: 100, y: 100 });
    mainWindow.show();
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    void mainWindow.loadFile(
      path.join(__dirname, "../../src/renderer/dist/index.html"),
    );
    // Production: start in kiosk mode (locked)
    mainWindow.show();
    applyKioskMode();
  }

  mainWindow.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      // In locked state, don't allow closing
      if (isStationLocked) {
        mainWindow?.show();
        mainWindow?.focus();
      } else {
        mainWindow?.hide();
      }
    }
  });

  // Prevent navigation away
  mainWindow.webContents.on("will-navigate", (event) => {
    if (!isDev) event.preventDefault();
  });
}

// ─── APP LIFECYCLE ────────────────────────────────────────────────────────────
app.commandLine.appendSwitch("enable-features", "WebRTCPipeWireCapturer");
app.commandLine.appendSwitch("use-fake-ui-for-media-stream");

app.on("ready", async () => {
  createWindow();
  createTray();
  setupIPC();
  await initRobot();
  connectToServer();

  if (process.env.NODE_ENV !== "development") {
    app.setLoginItemSettings({ openAtLogin: true, path: app.getPath("exe") });
  }

  console.log("========================================");
  console.log(`  Station Agent  |  ID: ${stationId}`);
  console.log(`  IP: ${getLocalIP()}  |  Server: ${serverUrl}`);
  console.log(`  Mode: ${isStationLocked ? "LOCKED" : "UNLOCKED"}`);
  console.log("========================================");
});

app.on("window-all-closed", (e: Event) => {
  (e as { preventDefault: () => void }).preventDefault?.();
});
app.on("before-quit", () => {
  isQuitting = true;
  unregisterKioskShortcuts();
});
app.on("activate", () => {
  if (mainWindow) mainWindow.show();
});
