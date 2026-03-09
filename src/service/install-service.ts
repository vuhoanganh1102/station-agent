/**
 * install-service.ts
 *
 * Cài đặt / gỡ cài đặt Windows Service cho Station Agent
 * Chạy bằng: npx ts-node src/service/install-service.ts [install|uninstall]
 * ⚠️ Yêu cầu chạy với quyền Administrator
 *
 * npm install node-windows --save
 */

import path from "path";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { Service } = require("node-windows") as {
  Service: new (config: Record<string, unknown>) => {
    on: (event: string, cb: () => void) => void;
    install: () => void;
    uninstall: () => void;
    start: () => void;
    stop: () => void;
    exists: boolean;
  };
};

// In production (packaged .exe), service files are placed in resources/service/
// via extraResources in package.json.
// In development (ts-node from project root), use the compiled dist path.
const isPackaged = process.argv[0].endsWith("StationAgent.exe") ||
  process.argv[0].endsWith("electron.exe") === false && __dirname.includes("app.asar");

const SERVICE_SCRIPT = isPackaged
  ? path.join(process.resourcesPath ?? __dirname, "service", "station-service.js")
  : path.resolve(__dirname, "../../dist/main/service/station-service.js");

const svc = new Service({
  name: "NetCafeStationAgent",
  description:
    "NetCafe Station Agent Service - Quản lý phiên người dùng và bảo mật máy trạm",
  script: SERVICE_SCRIPT,

  // Service configuration
  nodeOptions: ["--max_old_space_size=512"],

  // ✅ Startup Type = Automatic (boot with Windows, before login screen)
  startuptype: "auto",

  // Run as SYSTEM account (highest privileges)
  // logOnAs: 'LocalSystem',  // Default

  // Auto-restart on failure
  grow: 0.5, // Restart delay grows by 50%
  wait: 2, // 2 seconds before first restart
  maxRetries: -1, // Infinite retries

  // Allow service to interact with desktop (needed for launching Electron)
  allowServiceLogon: true,
});

const command = process.argv[2] || "install";

switch (command) {
  case "install":
    console.log("📦 Installing NetCafe Station Agent service...");
    console.log(`   Script: ${SERVICE_SCRIPT}`);

    svc.on("install", () => {
      console.log("✅ Service installed successfully!");
      console.log("🚀 Starting service...");
      svc.start();
    });

    svc.on("alreadyinstalled", () => {
      console.log("⚠️ Service already installed. Use 'uninstall' first.");
    });

    svc.on("start", () => {
      console.log("✅ Service started!");
      console.log("");
      console.log("Verify with:");
      console.log("  sc query NetCafeStationAgent");
      console.log("  Get-Service NetCafeStationAgent  (PowerShell)");
    });

    svc.on("error", () => {
      console.error("❌ Installation error. Run as Administrator!");
    });

    svc.install();
    break;

  case "uninstall":
    console.log("🗑️ Uninstalling NetCafe Station Agent service...");

    svc.on("uninstall", () => {
      console.log("✅ Service uninstalled successfully!");
      console.log(
        "   All system restrictions have been removed (if service was running).",
      );
    });

    svc.on("alreadyuninstalled", () => {
      console.log("⚠️ Service is not installed.");
    });

    svc.uninstall();
    break;

  case "start":
    console.log("🚀 Starting service...");
    svc.start();
    break;

  case "stop":
    console.log("⏹️ Stopping service...");
    svc.on("stop", () => {
      console.log("✅ Service stopped");
    });
    svc.stop();
    break;

  case "status":
    console.log(`Service exists: ${svc.exists}`);
    break;

  default:
    console.log(
      "Usage: ts-node install-service.ts [install|uninstall|start|stop|status]",
    );
}
