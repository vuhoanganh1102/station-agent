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

// Build the exposed API with full types
const agentAPI = {
  // ─── SCREEN CAPTURE ──────────────────────────────────────────────────
  getSources: (): Promise<ScreenSource[]> => ipcRenderer.invoke("get-sources"),

  onSourcesList: (callback: Callback<ScreenSource[]>): void => {
    ipcRenderer.removeAllListeners("sources-list");
    ipcRenderer.once(
      "sources-list",
      (_event: IpcRendererEvent, sources: ScreenSource[]) => callback(sources),
    );
  },

  // ─── SCREEN SHARING ──────────────────────────────────────────────────
  onStartScreenShare: (callback: Callback<{ adminSocketId: string }>): void => {
    ipcRenderer.on("start-screen-share", (_e: IpcRendererEvent, data) =>
      callback(data),
    );
  },
  onStopScreenShare: (callback: Callback<{ adminSocketId: string }>): void => {
    ipcRenderer.on("stop-screen-share", (_e: IpcRendererEvent, data) =>
      callback(data),
    );
  },

  // ─── WEBRTC SIGNALING ─────────────────────────────────────────────────
  onWebRTCOffer: (
    callback: Callback<{
      adminSocketId: string;
      sdp: RTCSessionDescriptionInit;
    }>,
  ): void => {
    ipcRenderer.on("webrtc-offer", (_e: IpcRendererEvent, data) =>
      callback(data),
    );
  },
  onWebRTCAnswer: (
    callback: Callback<{
      adminSocketId: string;
      sdp: RTCSessionDescriptionInit;
    }>,
  ): void => {
    ipcRenderer.on("webrtc-answer", (_e: IpcRendererEvent, data) =>
      callback(data),
    );
  },
  onWebRTCIceCandidate: (
    callback: Callback<{
      adminSocketId: string;
      candidate: RTCIceCandidateInit;
    }>,
  ): void => {
    ipcRenderer.on("webrtc-icecandidate", (_e: IpcRendererEvent, data) =>
      callback(data),
    );
  },
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
  onMouseMove: (callback: Callback<unknown>): void => {
    ipcRenderer.on("remote-mouse-move", (_e: IpcRendererEvent, data) =>
      callback(data),
    );
  },
  onMouseClick: (callback: Callback<unknown>): void => {
    ipcRenderer.on("remote-mouse-click", (_e: IpcRendererEvent, data) =>
      callback(data),
    );
  },
  onMouseScroll: (callback: Callback<unknown>): void => {
    ipcRenderer.on("remote-mouse-scroll", (_e: IpcRendererEvent, data) =>
      callback(data),
    );
  },
  onKeyTap: (callback: Callback<unknown>): void => {
    ipcRenderer.on("remote-key-tap", (_e: IpcRendererEvent, data) =>
      callback(data),
    );
  },
  onKeyType: (callback: Callback<unknown>): void => {
    ipcRenderer.on("remote-key-type", (_e: IpcRendererEvent, data) =>
      callback(data),
    );
  },

  // ─── ADMIN COMMANDS ──────────────────────────────────────────────────
  onLock: (callback: SimpleCallback): void => {
    ipcRenderer.on("lock-station", () => callback());
  },
  onUnlock: (callback: SimpleCallback): void => {
    ipcRenderer.on("unlock-station", () => callback());
  },
  onShowMessage: (callback: Callback<{ message: string }>): void => {
    ipcRenderer.on("show-message", (_e: IpcRendererEvent, data) =>
      callback(data),
    );
  },
  onTakeScreenshot: (callback: Callback<{ targetAdminId: string }>): void => {
    ipcRenderer.on("take-screenshot", (_e: IpcRendererEvent, data) =>
      callback(data),
    );
  },
  sendScreenshot: (data: { targetAdminId: string; image: string }): void => {
    ipcRenderer.send("screenshot-ready", data);
  },

  // ─── LOGIN FLOW ──────────────────────────────────────────────────────
  login: (credentials: LoginRequest): Promise<LoginResponse> =>
    ipcRenderer.invoke("login", credentials),

  logout: (): Promise<{ success: boolean }> => ipcRenderer.invoke("logout"),

  getStationId: (): Promise<string> => ipcRenderer.invoke("get-station-id"),

  // ─── SERVICE STATE RELAY ─────────────────────────────────────────────
  onServiceState: (callback: Callback<ServiceState>): void => {
    ipcRenderer.on("service-state", (_e: IpcRendererEvent, data) =>
      callback(data),
    );
  },
  onTimerUpdate: (callback: Callback<TimerData>): void => {
    ipcRenderer.on("timer-update", (_e: IpcRendererEvent, data) =>
      callback(data),
    );
  },
  onSessionWarning: (callback: Callback<SessionWarning>): void => {
    ipcRenderer.on("session-warning", (_e: IpcRendererEvent, data) =>
      callback(data),
    );
  },
  onSessionExpired: (callback: SimpleCallback): void => {
    ipcRenderer.on("session-expired", () => callback());
  },
  onServerConnected: (callback: Callback<boolean>): void => {
    ipcRenderer.on(
      "server-connected",
      (_e: IpcRendererEvent, status: boolean) => callback(status),
    );
  },
} as const;

// Expose to renderer
contextBridge.exposeInMainWorld("electron", { agentAPI });

// Export type so renderer can import it for window.agentAPI typing
export type AgentAPI = typeof agentAPI;
