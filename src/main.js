const {
  app,
  BrowserWindow,
  desktopCapturer,
  ipcMain,
  Tray,
  Menu,
  nativeImage,
  screen,
  dialog,
} = require("electron");
const path = require("path");
const os = require("os");
const { io } = require("socket.io-client");
const config = require("./config");

// ============================================================
// Globals
// ============================================================
let mainWindow = null;
let tray = null;
let socket = null;
let isQuitting = false;

const stationId = config.STATION_ID || os.hostname();
const serverUrl = `https://daniel-unforetellable-uncorrelatively.ngrok-free.dev`;

// ============================================================
// Get local IP
// ============================================================
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name in interfaces) {
    for (const iface of interfaces[name]) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return "127.0.0.1";
}

// ============================================================
// Get system info
// ============================================================
function getSystemInfo() {
  return {
    stationId,
    stationIp: getLocalIP(),
    hostname: os.hostname(),
    platform: os.platform(),
    cpuModel: os.cpus()[0]?.model || "Unknown",
    totalMemory: Math.round((os.totalmem() / (1024 * 1024 * 1024)) * 10) / 10,
  };
}

// ============================================================
// Robot controller - uses @nut-tree/nut-js
// ============================================================
let robot = null;
let keyboard = null;
let mouse = null;
let Key = null;
let Button = null;

async function initRobot() {
  try {
    const nutjs = require("@nut-tree-fork/nut-js");
    mouse = nutjs.mouse;
    keyboard = nutjs.keyboard;
    Key = nutjs.Key;
    Button = nutjs.Button;

    // Configure for speed
    mouse.config.mouseSpeed = 2000;
    keyboard.config.autoDelayMs = 0;

    robot = nutjs;
    console.log("✅ nut.js robot initialized");
  } catch (e) {
    console.warn("⚠️ @nut-tree-fork/nut-js not available, trying robotjs...");
    try {
      robot = require("robotjs");
      console.log("✅ robotjs initialized");
    } catch (e2) {
      console.error(
        "❌ No robot library available. Remote control will not work.",
      );
      console.error(
        "   Install: npm install @nut-tree-fork/nut-js  OR  npm install robotjs",
      );
    }
  }
}

// ============================================================
// Map web key names to nut-js Key enum
// ============================================================
function mapKeyToNut(key, code) {
  // Special keys
  const keyMap = {
    Enter: Key.Return,
    Backspace: Key.Backspace,
    Tab: Key.Tab,
    Escape: Key.Escape,
    Delete: Key.Delete,
    Insert: Key.Insert,
    Home: Key.Home,
    End: Key.End,
    PageUp: Key.PageUp,
    PageDown: Key.PageDown,
    ArrowUp: Key.Up,
    ArrowDown: Key.Down,
    ArrowLeft: Key.Left,
    ArrowRight: Key.Right,
    " ": Key.Space,
    Control: Key.LeftControl,
    Shift: Key.LeftShift,
    Alt: Key.LeftAlt,
    Meta: Key.LeftSuper,
    CapsLock: Key.CapsLock,
    F1: Key.F1,
    F2: Key.F2,
    F3: Key.F3,
    F4: Key.F4,
    F5: Key.F5,
    F6: Key.F6,
    F7: Key.F7,
    F8: Key.F8,
    F9: Key.F9,
    F10: Key.F10,
    F11: Key.F11,
    F12: Key.F12,
  };

  if (keyMap[key]) return keyMap[key];

  // Letters (a-z)
  if (key.length === 1 && /[a-zA-Z]/.test(key)) {
    const upper = key.toUpperCase();
    return Key[upper] || null;
  }

  // Numbers (0-9)
  if (key.length === 1 && /[0-9]/.test(key)) {
    return Key[`Num${key}`] || null;
  }

  // Special characters
  const charMap = {
    "-": Key.Minus,
    "=": Key.Equal,
    "[": Key.LeftBracket,
    "]": Key.RightBracket,
    "\\": Key.Backslash,
    ";": Key.Semicolon,
    "'": Key.Quote,
    ",": Key.Comma,
    ".": Key.Period,
    "/": Key.Slash,
    "`": Key.Grave,
  };

  return charMap[key] || null;
}

// Map web key names to robotjs
function mapKeyToRobotjs(key) {
  const keyMap = {
    Enter: "enter",
    Backspace: "backspace",
    Tab: "tab",
    Escape: "escape",
    Delete: "delete",
    Insert: "insert",
    Home: "home",
    End: "end",
    PageUp: "pageup",
    PageDown: "pagedown",
    ArrowUp: "up",
    ArrowDown: "down",
    ArrowLeft: "left",
    ArrowRight: "right",
    " ": "space",
    Control: "control",
    Shift: "shift",
    Alt: "alt",
    Meta: "command",
    CapsLock: "capslock",
    F1: "f1",
    F2: "f2",
    F3: "f3",
    F4: "f4",
    F5: "f5",
    F6: "f6",
    F7: "f7",
    F8: "f8",
    F9: "f9",
    F10: "f10",
    F11: "f11",
    F12: "f12",
  };

  if (keyMap[key]) return keyMap[key];
  if (key.length === 1) return key.toLowerCase();
  return null;
}

// ============================================================
// Execute remote control commands
// ============================================================
async function executeMouseMove(x, y) {
  if (!robot) return;

  try {
    if (mouse) {
      // nut-js
      const { straightTo, Point } = require("@nut-tree-fork/nut-js");
      await mouse.setPosition(new Point(x, y));
    } else {
      // robotjs
      robot.moveMouse(x, y);
    }
  } catch (e) {
    // silent - too frequent to log
  }
}

async function executeMouseClick(button, double, x, y) {
  if (!robot) return;

  try {
    if (mouse) {
      // nut-js
      const { Point } = require("@nut-tree-fork/nut-js");
      await mouse.setPosition(new Point(x, y));

      const btnMap = {
        left: Button.LEFT,
        right: Button.RIGHT,
        middle: Button.MIDDLE,
      };
      const btn = btnMap[button] || Button.LEFT;

      if (double) {
        await mouse.doubleClick(btn);
      } else {
        await mouse.click(btn);
      }
    } else {
      // robotjs
      robot.moveMouse(x, y);
      robot.mouseClick(button || "left", double);
    }
  } catch (e) {
    console.error("Mouse click error:", e.message);
  }
}

async function executeMouseUp(button, x, y) {
  if (!robot) return;

  try {
    if (mouse) {
      const btnMap = {
        left: Button.LEFT,
        right: Button.RIGHT,
        middle: Button.MIDDLE,
      };
      const btn = btnMap[button] || Button.LEFT;
      await mouse.releaseButton(btn);
    } else {
      robot.mouseToggle("up", button || "left");
    }
  } catch (e) {
    console.error("Mouse up error:", e.message);
  }
}

async function executeMouseScroll(deltaX, deltaY) {
  if (!robot) return;

  try {
    if (mouse) {
      await mouse.scrollDown(deltaY);
    } else {
      robot.scrollMouse(deltaX, deltaY);
    }
  } catch (e) {
    console.error("Scroll error:", e.message);
  }
}

async function executeKeyDown(key, code, modifiers) {
  if (!robot) return;

  try {
    if (keyboard && Key) {
      const nutKey = mapKeyToNut(key, code);
      if (nutKey) {
        await keyboard.pressKey(nutKey);
      }
    } else {
      // robotjs - use keyToggle
      const rjKey = mapKeyToRobotjs(key);
      if (rjKey) {
        robot.keyToggle(rjKey, "down", modifiers || []);
      }
    }
  } catch (e) {
    console.error("Key down error:", e.message);
  }
}

async function executeKeyUp(key, code) {
  if (!robot) return;

  try {
    if (keyboard && Key) {
      const nutKey = mapKeyToNut(key, code);
      if (nutKey) {
        await keyboard.releaseKey(nutKey);
      }
    } else {
      const rjKey = mapKeyToRobotjs(key);
      if (rjKey) {
        robot.keyToggle(rjKey, "up");
      }
    }
  } catch (e) {
    console.error("Key up error:", e.message);
  }
}

// ============================================================
// Socket connection to server
// ============================================================
function connectToServer() {
  const systemInfo = getSystemInfo();

  socket = io(`${serverUrl}/agents`, {
    reconnection: true,
    reconnectionDelay: config.RECONNECT_INTERVAL,
    reconnectionAttempts: config.RECONNECT_ATTEMPTS,
    auth: systemInfo,
    transports: ["websocket", "polling"],
  });

  socket.on("connect", () => {
    console.log(`✅ Connected to server: ${serverUrl}`);
    console.log(`   Station ID: ${stationId}`);
    console.log(`   Local IP: ${systemInfo.stationIp}`);

    // Send screen info
    const primaryDisplay = screen.getPrimaryDisplay();
    socket.emit("screen-info", {
      width: primaryDisplay.size.width,
      height: primaryDisplay.size.height,
      scaleFactor: primaryDisplay.scaleFactor,
    });

    updateTrayTooltip("Connected");
  });

  socket.on("disconnect", () => {
    console.log("❌ Disconnected from server");
    updateTrayTooltip("Disconnected");
  });

  socket.on("connect_error", (err) => {
    console.log(`Connection error: ${err.message}`);
    updateTrayTooltip("Connection error");
  });

  // ---- Admin requests screen sharing ----
  socket.on("request-screen", ({ adminSocketId }) => {
    console.log(`🖥️ Admin ${adminSocketId} requesting screen`);
    if (mainWindow) {
      mainWindow.webContents.send("start-screen-share", { adminSocketId });
    }
  });

  socket.on("stop-screen", ({ adminSocketId }) => {
    console.log(`🖥️ Admin ${adminSocketId} stopped viewing`);
    if (mainWindow) {
      mainWindow.webContents.send("stop-screen-share", { adminSocketId });
    }
  });

  // ---- WebRTC signaling from admin ----
  socket.on("offer", ({ targetAdminId, sdp }) => {
    if (mainWindow) {
      mainWindow.webContents.send("webrtc-offer", {
        adminSocketId: targetAdminId,
        sdp,
      });
    }
  });

  socket.on("answer", ({ adminSocketId, sdp }) => {
    if (mainWindow) {
      mainWindow.webContents.send("webrtc-answer", { adminSocketId, sdp });
    }
  });

  socket.on("icecandidate", ({ adminSocketId, candidate }) => {
    if (mainWindow) {
      mainWindow.webContents.send("webrtc-icecandidate", {
        adminSocketId,
        candidate,
      });
    }
  });

  // ---- Remote control commands (executed in main process) ----
  socket.on("mouse-move", ({ x, y }) => {
    executeMouseMove(Math.round(x), Math.round(y));
  });

  socket.on("mouse-click", ({ button, double, x, y }) => {
    executeMouseClick(button, double, Math.round(x), Math.round(y));
  });

  socket.on("mouse-up", ({ button, x, y }) => {
    executeMouseUp(button, Math.round(x), Math.round(y));
  });

  socket.on("mouse-scroll", ({ deltaX, deltaY }) => {
    executeMouseScroll(deltaX, deltaY);
  });

  socket.on("key-down", ({ key, code, modifiers }) => {
    executeKeyDown(key, code, modifiers);
  });

  socket.on("key-up", ({ key, code }) => {
    executeKeyUp(key, code);
  });

  // Legacy key events
  socket.on("key-tap", ({ key, modifiers }) => {
    executeKeyDown(key, null, modifiers);
    setTimeout(() => executeKeyUp(key, null), 50);
  });

  socket.on("key-type", ({ text }) => {
    if (keyboard) {
      keyboard.type(text).catch((e) => console.error("Type error:", e));
    } else if (robot) {
      robot.typeString(text);
    }
  });

  // ---- Management commands ----
  socket.on("lock-station", () => {
    console.log("🔒 Locking station");
    lockScreen();
  });

  socket.on("unlock-station", () => {
    console.log("🔓 Unlocking station");
  });

  socket.on("shutdown-station", () => {
    console.log("⏻ Shutting down");
    const { exec } = require("child_process");
    if (process.platform === "win32") {
      exec('shutdown /s /t 30 /c "Admin initiated shutdown"');
    } else {
      exec('shutdown -h +1 "Admin initiated shutdown"');
    }
  });

  socket.on("restart-station", () => {
    console.log("🔄 Restarting");
    const { exec } = require("child_process");
    if (process.platform === "win32") {
      exec('shutdown /r /t 30 /c "Admin initiated restart"');
    } else {
      exec('shutdown -r +1 "Admin initiated restart"');
    }
  });

  socket.on("show-message", ({ message }) => {
    console.log(`💬 Message from admin: ${message}`);
    dialog.showMessageBox({
      type: "info",
      title: "Thông báo từ quản lý",
      message: message,
      buttons: ["OK"],
    });
  });

  socket.on("open-app", ({ appPath }) => {
    console.log(`📂 Opening app: ${appPath}`);
    const { exec } = require("child_process");
    if (process.platform === "win32") {
      exec(`start "" "${appPath}"`);
    } else {
      exec(`xdg-open "${appPath}"`);
    }
  });

  socket.on("request-screenshot", ({ targetAdminId }) => {
    if (mainWindow) {
      mainWindow.webContents.send("take-screenshot", { targetAdminId });
    }
  });

  return socket;
}

// ============================================================
// Lock screen
// ============================================================
function lockScreen() {
  const { exec } = require("child_process");
  if (process.platform === "win32") {
    exec("rundll32.exe user32.dll,LockWorkStation");
  } else {
    exec("loginctl lock-session");
  }
}

// ============================================================
// IPC handlers (renderer → main → server)
// ============================================================
function setupIPC() {
  // WebRTC signaling relay
  ipcMain.on("webrtc-offer", (event, { targetAdminId, sdp }) => {
    socket?.emit("offer", { targetAdminId, sdp });
  });

  ipcMain.on("webrtc-answer", (event, { targetAdminId, sdp }) => {
    socket?.emit("answer", { targetAdminId, sdp });
  });

  ipcMain.on("webrtc-icecandidate", (event, { targetAdminId, candidate }) => {
    socket?.emit("icecandidate", { targetAdminId, candidate });
  });

  ipcMain.on("screenshot-ready", (event, { targetAdminId, image }) => {
    socket?.emit("screenshot", { targetAdminId, image });
  });

  ipcMain.on("get-sources", async (event) => {
    try {
      const sources = await desktopCapturer.getSources({
        types: ["screen"],
        thumbnailSize: { width: 1920, height: 1080 },
      });
      event.reply(
        "sources-list",
        sources.map((s) => ({
          id: s.id,
          name: s.name,
          display_id: s.display_id,
        })),
      );
    } catch (e) {
      console.error("Error getting sources:", e);
      event.reply("sources-list", []);
    }
  });
}

// ============================================================
// Tray icon
// ============================================================
function createTray() {
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
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setToolTip(`Station Agent - ${stationId}`);
  tray.setContextMenu(contextMenu);

  tray.on("double-click", () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

function updateTrayTooltip(status) {
  if (tray) {
    tray.setToolTip(`Station Agent - ${stationId} [${status}]`);
  }
}

// ============================================================
// Create hidden window
// ============================================================
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 400,
    height: 300,
    show: false,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));

  mainWindow.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  if (process.env.NODE_ENV === "development") {
    mainWindow.show();
    mainWindow.webContents.openDevTools();
  }
}

// ============================================================
// App lifecycle
// ============================================================
app.on("ready", async () => {
  createWindow();
  createTray();
  setupIPC();

  // Initialize robot for remote control
  await initRobot();

  connectToServer();

  if (process.env.NODE_ENV !== "development") {
    app.setLoginItemSettings({
      openAtLogin: true,
      path: app.getPath("exe"),
    });
  }

  console.log("========================================");
  console.log(`  Station Agent started`);
  console.log(`  ID: ${stationId}`);
  console.log(`  IP: ${getLocalIP()}`);
  console.log(`  Server: ${serverUrl}`);
  console.log("========================================");
});

app.on("window-all-closed", (e) => {
  e.preventDefault?.();
});

app.on("before-quit", () => {
  isQuitting = true;
});

app.on("activate", () => {
  if (mainWindow) {
    mainWindow.show();
  }
});
