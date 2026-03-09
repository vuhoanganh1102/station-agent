import { contextBridge, ipcRenderer, IpcRendererEvent } from "electron";
import type {
  ScreenSource,
  LoginRequest,
  LoginResponse,
  ServiceState,
  TimerData,
  SessionWarning,
} from "../types";

// Typed callback helpers
type Callback<T> = (data: T) => void;
type SimpleCallback = () => void;
type Unsubscribe = () => void;

/** Helper: register an IPC listener and return an unsubscribe function */
function onIpc<T>(channel: string, callback: Callback<T>): Unsubscribe {
  const handler = (_e: IpcRendererEvent, data: T) => callback(data);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}

/** Helper: register an IPC listener (no data) and return an unsubscribe function */
function onIpcSimple(channel: string, callback: SimpleCallback): Unsubscribe {
  const handler = () => callback();
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}

// Build the exposed API with full types
const agentAPI = {
  // ─── SCREEN CAPTURE ──────────────────────────────────────────────────
  getSources: (): Promise<ScreenSource[]> => ipcRenderer.invoke("get-sources"),

  onSourcesList: (callback: Callback<ScreenSource[]>): Unsubscribe => {
    ipcRenderer.removeAllListeners("sources-list");
    const handler = (_event: IpcRendererEvent, sources: ScreenSource[]) =>
      callback(sources);
    ipcRenderer.once("sources-list", handler);
    return () => ipcRenderer.removeListener("sources-list", handler);
  },

  // ─── SCREEN SHARING ──────────────────────────────────────────────────
  onStartScreenShare: (
    callback: Callback<{ adminSocketId: string }>,
  ): Unsubscribe => onIpc("start-screen-share", callback),

  onStopScreenShare: (
    callback: Callback<{ adminSocketId: string }>,
  ): Unsubscribe => onIpc("stop-screen-share", callback),

  // ─── WEBRTC SIGNALING ─────────────────────────────────────────────────
  onWebRTCOffer: (
    callback: Callback<{
      adminSocketId: string;
      sdp: RTCSessionDescriptionInit;
    }>,
  ): Unsubscribe => onIpc("webrtc-offer", callback),

  onWebRTCAnswer: (
    callback: Callback<{
      adminSocketId: string;
      sdp: RTCSessionDescriptionInit;
    }>,
  ): Unsubscribe => onIpc("webrtc-answer", callback),

  onWebRTCIceCandidate: (
    callback: Callback<{
      adminSocketId: string;
      candidate: RTCIceCandidateInit;
    }>,
  ): Unsubscribe => onIpc("webrtc-icecandidate", callback),

  sendOffer: (data: {
    targetAdminId: string;
    sdp: RTCSessionDescriptionInit;
  }): void => {
    ipcRenderer.send("webrtc-offer", data);
  },
  sendAnswer: (data: {
    targetAdminId: string;
    sdp: RTCSessionDescriptionInit;
  }): void => {
    ipcRenderer.send("webrtc-answer", data);
  },
  sendIceCandidate: (data: {
    targetAdminId: string;
    candidate: RTCIceCandidateInit;
  }): void => {
    ipcRenderer.send("webrtc-icecandidate", data);
  },

  // ─── REMOTE CONTROL ──────────────────────────────────────────────────
  onMouseMove: (callback: Callback<unknown>): Unsubscribe =>
    onIpc("remote-mouse-move", callback),
  onMouseClick: (callback: Callback<unknown>): Unsubscribe =>
    onIpc("remote-mouse-click", callback),
  onMouseScroll: (callback: Callback<unknown>): Unsubscribe =>
    onIpc("remote-mouse-scroll", callback),
  onKeyTap: (callback: Callback<unknown>): Unsubscribe =>
    onIpc("remote-key-tap", callback),
  onKeyType: (callback: Callback<unknown>): Unsubscribe =>
    onIpc("remote-key-type", callback),

  // ─── ADMIN COMMANDS ──────────────────────────────────────────────────
  onLock: (callback: SimpleCallback): Unsubscribe =>
    onIpcSimple("lock-station", callback),
  onUnlock: (callback: SimpleCallback): Unsubscribe =>
    onIpcSimple("unlock-station", callback),
  onShowMessage: (callback: Callback<{ message: string }>): Unsubscribe =>
    onIpc("show-message", callback),
  onTakeScreenshot: (
    callback: Callback<{ targetAdminId: string }>,
  ): Unsubscribe => onIpc("take-screenshot", callback),
  sendScreenshot: (data: { targetAdminId: string; image: string }): void => {
    ipcRenderer.send("screenshot-ready", data);
  },

  // ─── LOGIN FLOW ──────────────────────────────────────────────────────
  login: (credentials: LoginRequest): Promise<LoginResponse> =>
    ipcRenderer.invoke("login", credentials),

  logout: (): Promise<{ success: boolean }> => ipcRenderer.invoke("logout"),

  getStationId: (): Promise<string> => ipcRenderer.invoke("get-station-id"),

  // ─── SERVICE STATE RELAY ─────────────────────────────────────────────
  onServiceState: (callback: Callback<ServiceState>): Unsubscribe =>
    onIpc("service-state", callback),
  onTimerUpdate: (callback: Callback<TimerData>): Unsubscribe =>
    onIpc("timer-update", callback),
  onSessionWarning: (callback: Callback<SessionWarning>): Unsubscribe =>
    onIpc("session-warning", callback),
  onSessionExpired: (callback: SimpleCallback): Unsubscribe =>
    onIpcSimple("session-expired", callback),
  onServerConnected: (callback: Callback<boolean>): Unsubscribe =>
    onIpc("server-connected", callback),
} as const;

// Expose to renderer
contextBridge.exposeInMainWorld("electron", { agentAPI });

// Export type so renderer can import it for window.agentAPI typing
export type AgentAPI = typeof agentAPI;
