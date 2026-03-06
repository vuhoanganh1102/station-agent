// src/hooks/useServiceIPC.ts
import { useState, useEffect, useCallback, useRef } from "react";
import { ServiceState, SessionWarning, TimerData } from "../../../types";
const IPC_PORT = 4001;
const IPC_SECRET = "netcafe-secret-2024";

interface UseServiceIPCReturn {
  serviceState: ServiceState;
  serviceConnected: boolean;
  timerData: TimerData;
  sessionWarning: SessionWarning | null;
  sessionExpired: boolean;
  notifyLoginSuccess: (
    username: string,
    sessionMinutes: number,
    token?: string,
  ) => void;
  notifyLogout: () => Promise<void>;
}

const DEFAULT_STATE: ServiceState = {
  isLoggedIn: false,
  sessionUser: null,
  sessionStart: null,
  sessionMinutes: 0,
};

export function useServiceIPC(): UseServiceIPCReturn {
  const [serviceState, setServiceState] = useState<ServiceState>(DEFAULT_STATE);
  const [serviceConnected, setServiceConnected] = useState(false);
  const [timerData, setTimerData] = useState<TimerData>({
    elapsed: 0,
    remaining: 0,
  });
  const [sessionWarning, setSessionWarning] = useState<SessionWarning | null>(
    null,
  );
  const [sessionExpired, setSessionExpired] = useState(false);

  const isElectron = typeof window !== "undefined" && "agentAPI" in window;
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Electron mode: events relay qua preload bridge ──────────────────────
  useEffect(() => {
    if (!isElectron) return;

    const api = window.electron.agentAPI;

    api.onServiceState((s) => {
      setServiceState(s);
      setServiceConnected(true);
      if (!s.isLoggedIn) setSessionExpired(false);
    });

    api.onTimerUpdate((d) => setTimerData(d));

    api.onSessionWarning((d) => {
      setSessionWarning(d);
      setTimeout(() => setSessionWarning(null), 10_000);
    });

    api.onSessionExpired(() => setSessionExpired(true));

    api.onServerConnected((status) => setServiceConnected(status));

    // Assume connected once preload is available
    setServiceConnected(true);
  }, [isElectron]);

  // ── Dev/browser mode: kết nối WebSocket trực tiếp tới agent.js ─────────
  useEffect(() => {
    if (isElectron) return;

    function connect(): void {
      try {
        const ws = new WebSocket(`ws://127.0.0.1:4001`);
        wsRef.current = ws;

        ws.onopen = () => {
          setServiceConnected(true);
          ws.send(JSON.stringify({ type: "GET_STATE", secret: IPC_SECRET }));
        };

        ws.onmessage = (e: MessageEvent<string>) => {
          try {
            const msg = JSON.parse(e.data) as {
              type: string;
              payload?: unknown;
            };
            switch (msg.type) {
              case "STATE":
                setServiceState(msg.payload as ServiceState);
                break;
              case "TIMER_UPDATE":
                setTimerData(msg.payload as TimerData);
                break;
              case "SESSION_WARNING":
                setSessionWarning(msg.payload as SessionWarning);
                setTimeout(() => setSessionWarning(null), 10_000);
                break;
              case "SESSION_EXPIRED":
                setSessionExpired(true);
                break;
            }
          } catch (_) {
            /* ignore parse errors */
          }
        };

        ws.onclose = () => {
          setServiceConnected(false);
          reconnectRef.current = setTimeout(connect, 2_000);
        };

        ws.onerror = () => ws.close();
      } catch (_) {
        reconnectRef.current = setTimeout(connect, 2_000);
      }
    }

    connect();

    return () => {
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      wsRef.current?.close();
    };
  }, [isElectron]);

  // ── Actions ─────────────────────────────────────────────────────────────
  const notifyLoginSuccess = useCallback(
    (username: string, sessionMinutes: number, token?: string): void => {
      // Dev mode only — Electron mode handled by main process ipcMain handler
      if (!isElectron && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: "LOGIN_SUCCESS",
            payload: { username, sessionMinutes, token },
            secret: IPC_SECRET,
          }),
        );
      }
    },
    [isElectron],
  );

  const notifyLogout = useCallback(async (): Promise<void> => {
    if (isElectron) {
      await window.electron.agentAPI.logout();
    } else if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({ type: "LOGOUT", payload: {}, secret: IPC_SECRET }),
      );
    }
  }, [isElectron]);

  return {
    serviceState,
    serviceConnected,
    timerData,
    sessionWarning,
    sessionExpired,
    notifyLoginSuccess,
    notifyLogout,
  };
}
