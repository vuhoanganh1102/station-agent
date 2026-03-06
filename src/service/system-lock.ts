/**
 * system-lock.ts
 * Quản lý khóa hệ thống Windows: block Task Manager, regedit, services.msc, cmd
 * Chạy dưới quyền SYSTEM (Windows Service) hoặc Administrator
 *
 * Registry keys used:
 * - DisableTaskMgr: HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System
 * - DisableRegistryTools: HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System
 * - DisallowRun: HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\Explorer
 */

import { execSync } from "child_process";

// ─── Registry Helpers ────────────────────────────────────────────────────────

function regAdd(
  keyPath: string,
  valueName: string,
  valueType: string,
  data: string | number,
): void {
  try {
    execSync(
      `reg add "${keyPath}" /v "${valueName}" /t ${valueType} /d ${data} /f`,
      { stdio: "pipe" },
    );
    console.log(`[SystemLock] SET ${keyPath}\\${valueName} = ${data}`);
  } catch (e) {
    console.error(
      `[SystemLock] Failed to set ${valueName}:`,
      (e as Error).message,
    );
  }
}

function regDelete(keyPath: string, valueName: string): void {
  try {
    execSync(`reg delete "${keyPath}" /v "${valueName}" /f`, {
      stdio: "pipe",
    });
    console.log(`[SystemLock] DEL ${keyPath}\\${valueName}`);
  } catch {
    // Key may not exist — safe to ignore
  }
}

// ─── Blocked Programs ────────────────────────────────────────────────────────
const BLOCKED_APPS = [
  "taskmgr.exe",
  "services.msc",
  "regedit.exe",
  "cmd.exe",
  "powershell.exe",
  "mmc.exe", // Microsoft Management Console
  "msconfig.exe",
];

const POLICY_SYSTEM =
  "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\System";
const POLICY_EXPLORER =
  "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\Explorer";
const DISALLOW_RUN =
  "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\Explorer\\DisallowRun";

// ─── Lock Functions ──────────────────────────────────────────────────────────

/**
 * Block Task Manager for all users
 */
export function blockTaskManager(): void {
  regAdd(POLICY_SYSTEM, "DisableTaskMgr", "REG_DWORD", 1);
}

/**
 * Unblock Task Manager
 */
export function unblockTaskManager(): void {
  regDelete(POLICY_SYSTEM, "DisableTaskMgr");
}

/**
 * Block Registry Editor
 */
export function blockRegedit(): void {
  regAdd(POLICY_SYSTEM, "DisableRegistryTools", "REG_DWORD", 1);
}

export function unblockRegedit(): void {
  regDelete(POLICY_SYSTEM, "DisableRegistryTools");
}

/**
 * Block specific applications via DisallowRun policy
 */
export function blockApplications(): void {
  // Enable DisallowRun
  regAdd(POLICY_EXPLORER, "DisallowRun", "REG_DWORD", 1);

  // Create DisallowRun subkey and add each app
  try {
    execSync(`reg add "${DISALLOW_RUN}" /f`, { stdio: "pipe" });
  } catch {
    // Key may already exist
  }

  BLOCKED_APPS.forEach((app, index) => {
    regAdd(DISALLOW_RUN, String(index + 1), "REG_SZ", app);
  });
}

export function unblockApplications(): void {
  regDelete(POLICY_EXPLORER, "DisallowRun");
  try {
    execSync(`reg delete "${DISALLOW_RUN}" /f`, { stdio: "pipe" });
  } catch {
    // Key may not exist
  }
}

/**
 * Block Ctrl+Alt+Del options (Change Password, Sign Out, etc.)
 * Note: Cannot fully block Ctrl+Alt+Del itself (handled by kernel)
 * but we can remove options from the security screen
 */
export function blockSecurityOptions(): void {
  // Disable Change Password
  regAdd(POLICY_SYSTEM, "DisableChangePassword", "REG_DWORD", 1);
  // Disable Lock Workstation
  regAdd(POLICY_SYSTEM, "DisableLockWorkstation", "REG_DWORD", 1);
  // Disable Sign Out
  regAdd(POLICY_EXPLORER, "NoLogoff", "REG_DWORD", 1);
  // Disable Switch User
  regAdd(POLICY_SYSTEM, "HideFastUserSwitching", "REG_DWORD", 1);
}

export function unblockSecurityOptions(): void {
  regDelete(POLICY_SYSTEM, "DisableChangePassword");
  regDelete(POLICY_SYSTEM, "DisableLockWorkstation");
  regDelete(POLICY_EXPLORER, "NoLogoff");
  regDelete(POLICY_SYSTEM, "HideFastUserSwitching");
}

// ─── High-Level Lock/Unlock ──────────────────────────────────────────────────

/**
 * Apply full system lockdown
 * Call this when station is in "locked" state (no user logged in)
 */
export function lockSystem(): void {
  console.log("[SystemLock] 🔒 Applying full system lockdown...");
  blockTaskManager();
  blockRegedit();
  blockApplications();
  blockSecurityOptions();
  console.log("[SystemLock] ✅ System locked");
}

/**
 * Remove all system restrictions
 * Call this when user logs in successfully
 */
export function unlockSystem(): void {
  console.log("[SystemLock] 🔓 Removing system lockdown...");
  unblockTaskManager();
  unblockRegedit();
  unblockApplications();
  unblockSecurityOptions();
  console.log("[SystemLock] ✅ System unlocked");
}

/**
 * Kill a process by name (for enforcement)
 */
export function killProcess(processName: string): void {
  try {
    execSync(`taskkill /F /IM "${processName}" /T`, { stdio: "pipe" });
    console.log(`[SystemLock] Killed ${processName}`);
  } catch {
    // Process may not be running
  }
}

/**
 * Continuously monitor and kill blocked processes
 * Returns interval ID for cleanup
 */
export function startProcessMonitor(intervalMs = 2000): NodeJS.Timeout {
  console.log("[SystemLock] Starting process monitor...");
  return setInterval(() => {
    for (const app of BLOCKED_APPS) {
      // Only kill .exe processes (not .msc)
      if (app.endsWith(".exe")) {
        try {
          const result = execSync(
            `tasklist /FI "IMAGENAME eq ${app}" /NH /FO CSV`,
            { stdio: "pipe", encoding: "utf-8" },
          );
          if (result.includes(app)) {
            killProcess(app);
          }
        } catch {
          // Ignore errors
        }
      }
    }
  }, intervalMs);
}
