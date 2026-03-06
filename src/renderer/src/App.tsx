import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  CSSProperties,
} from "react";
import type { LoginResponse, LogEntry } from "../../types";
import { useScreenShare } from "./hooks/useScreenShare";
import LoginScreen from "./components/LoginScreen";
import StatusPanel from "./components/StatusPanel";
import SessionOverlay from "./components/SessionOverlay";
import SessionExpired from "./components/Sessionexpired";

// ─── Types ───────────────────────────────────────────────────────────────────
type View = "login" | "session" | "expired";

interface SessionData {
  username: string;
  sessionMinutes: number;
  balance?: number;
  token?: string;
}

interface TimerData {
  elapsed: number;
  remaining: number;
}

interface SessionWarning {
  message: string;
  remaining: number;
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function App(): React.ReactElement {
  const [view, setView] = useState<View>("login");
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [stationId, setStationId] = useState("STATION-01");
  const [serverConnected, setServerConnected] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [timerData, setTimerData] = useState<TimerData>({
    elapsed: 0,
    remaining: 0,
  });
  const [sessionWarning, setSessionWarning] = useState<SessionWarning | null>(
    null,
  );

  // Timer ref for session countdown
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionStartRef = useRef<number>(0);

  const addLog = useCallback((msg: string, type: LogEntry["type"] = "info") => {
    const entry: LogEntry = {
      time: new Date().toLocaleTimeString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
      msg,
      type,
    };
    setLogs((prev) => [...prev.slice(-200), entry]);
  }, []);

  // ── Screen Share hook (runs in background always) ──
  useScreenShare({
    onLog: (msg) => addLog(msg, "info"),
    onStatusChange: (status) => addLog(`Screen: ${status}`, "info"),
    onSharingChange: (sharing) => {
      setIsSharing(sharing);
      addLog(
        sharing ? "✅ Screen sharing active" : "Screen sharing stopped",
        sharing ? "success" : "info",
      );
    },
  });

  // ── Init ──
  useEffect(() => {
    const api = window.electron?.agentAPI;
    if (!api) {
      addLog("⚠️ Not in Electron — agentAPI unavailable", "warn");
      return;
    }

    addLog("Agent renderer initialized", "success");

    api
      .getStationId()
      .then(setStationId)
      .catch(() => {});

    api.onServerConnected((status) => {
      console.log("Server connected", status);
      setServerConnected(status);
      addLog(
        status ? "✅ Server connected" : "❌ Server disconnected",
        status ? "success" : "error",
      );
    });

    // Admin remote lock → force back to login
    api.onLock(() => {
      addLog("🔒 Khóa máy bởi quản lý", "warn");
      stopSessionTimer();
      setView("login");
      setSessionData(null);
    });

    api.onUnlock(() => addLog("🔓 Mở khóa bởi quản lý", "success"));

    api.onShowMessage(({ message }) => {
      addLog(`💬 Admin: ${message}`, "info");
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Session Timer ──
  const startSessionTimer = useCallback(
    (sessionMinutes: number) => {
      stopSessionTimer();
      sessionStartRef.current = Date.now();
      const totalMs = sessionMinutes * 60 * 1000;

      timerRef.current = setInterval(() => {
        const elapsed = Math.floor(
          (Date.now() - sessionStartRef.current) / 60000,
        );
        const remaining = Math.max(0, sessionMinutes - elapsed);

        setTimerData({ elapsed, remaining });

        // Warning at 5 minutes
        if (remaining === 5) {
          setSessionWarning({
            message: "⚠️ Phiên sẽ hết trong 5 phút!",
            remaining: 5,
          });
          setTimeout(() => setSessionWarning(null), 10000);
        }

        // Warning at 1 minute
        if (remaining === 1) {
          setSessionWarning({
            message: "⚠️ Phiên sẽ hết trong 1 phút!",
            remaining: 1,
          });
        }

        // Session expired
        if (remaining <= 0) {
          stopSessionTimer();
          addLog("⏰ Phiên đã hết hạn", "error");
          setView("expired");
        }
      }, 1000);
    },
    [addLog],
  );

  const stopSessionTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // ── Login Handler ──
  const handleLoginSuccess = useCallback(
    (result: LoginResponse) => {
      if (!result.success || !result.username) return;

      const data: SessionData = {
        username: result.username,
        sessionMinutes: result.sessionMinutes ?? 60,
        balance: result.balance,
        token: result.token,
      };

      addLog(
        `✅ Đăng nhập: ${data.username} (${data.sessionMinutes} phút)`,
        "success",
      );
      setSessionData(data);
      setTimerData({ elapsed: 0, remaining: data.sessionMinutes });
      setView("session");

      // Start countdown timer
      startSessionTimer(data.sessionMinutes);
    },
    [addLog, startSessionTimer],
  );

  // ── Logout Handler ──
  const handleLogout = useCallback(async () => {
    addLog(`Đăng xuất: ${sessionData?.username ?? ""}`, "info");
    stopSessionTimer();

    // Call main process logout (re-enables kiosk mode)
    try {
      await window.electron?.agentAPI?.logout();
    } catch {
      // Continue even if IPC fails
    }

    setSessionData(null);
    setSessionWarning(null);
    setView("login");
  }, [sessionData, addLog, stopSessionTimer]);

  // ── Session Expired Done ──
  const handleExpiredDone = useCallback(async () => {
    try {
      await window.electron?.agentAPI?.logout();
    } catch {
      // Continue
    }
    setSessionData(null);
    setSessionWarning(null);
    setView("login");
  }, []);

  // ── Render ──
  return (
    <>
      {/* ─── LOGIN VIEW ─── */}
      {view === "login" && (
        <div style={s.loginRoot}>
          <LoginScreen
            onLoginSuccess={handleLoginSuccess}
            serverConnected={serverConnected}
            stationId={stationId}
          />
          {/* Status panel at bottom */}
          <div style={s.statusPanelWrap}>
            <StatusPanel
              serviceConnected={true}
              serverConnected={serverConnected}
              stationId={stationId}
              logs={logs}
            />
          </div>
        </div>
      )}

      {/* ─── SESSION VIEW (user is logged in, using desktop) ─── */}
      {view === "session" && sessionData && (
        <SessionOverlay
          sessionData={{
            username: sessionData.username,
            sessionMinutes: sessionData.sessionMinutes,
          }}
          timerData={timerData}
          warning={sessionWarning}
          onLogout={() => void handleLogout()}
        />
      )}

      {/* ─── EXPIRED VIEW ─── */}
      {view === "expired" && (
        <SessionExpired
          username={sessionData?.username ?? ""}
          onDone={() => void handleExpiredDone()}
        />
      )}
    </>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const s: Record<string, CSSProperties> = {
  loginRoot: {
    width: "100vw",
    height: "100vh",
    position: "fixed",
    inset: 0,
    zIndex: 1000,
  },
  statusPanelWrap: {
    position: "absolute",
    bottom: 32,
    left: "50%",
    transform: "translateX(-50%)",
    width: 380,
    height: 140,
    borderRadius: 10,
    overflow: "hidden",
    border: "1px solid rgba(0,212,255,0.1)",
    opacity: 0.8,
  },
};
