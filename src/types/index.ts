// src/types/index.ts

export interface AppConfig {
  SERVER_IP: string;
  SERVER_PORT: number | string;
  STATION_ID: string;
  ICE_SERVERS: RTCIceServer[];
  RECONNECT_INTERVAL: number;
  RECONNECT_ATTEMPTS: number | typeof Infinity;
  SCREENSHOT_QUALITY: "low" | "medium" | "high";
  SCREENSHOT_MAX_WIDTH: number;
}

export interface ServiceState {
  isLoggedIn: boolean;
  sessionUser: string | null;
  sessionStart: number | null;
  sessionMinutes: number;
}

export interface TimerData {
  elapsed: number;
  remaining: number;
}

export interface SessionWarning {
  message: string;
  remaining: number;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  username?: string;
  sessionMinutes?: number;
  balance?: number;
  token?: string;
  message?: string;
}
// ─── WEBRTC ──────────────────────────────────────────────────────────────────
export interface SerializedSDP {
  type: RTCSdpType;
  sdp: string;
}

export interface SerializedCandidate {
  candidate: string;
  sdpMid: string | null;
  sdpMLineIndex: number | null;
}

export interface WebRTCAnswerPayload {
  adminSocketId: string;
  sdp: SerializedSDP;
}
export interface WebRTCOfferPayload {
  targetAdminId: string;
  sdp: SerializedSDP;
}
export interface KeyEventPayload {
  key: string;
  code: string;
  modifiers?: string[];
}
export interface KeyEventPayload {
  key: string;
  code: string;
  modifiers?: string[];
}
export interface WebRTCCandidatePayload {
  adminSocketId?: string;
  targetAdminId?: string;
  candidate: SerializedCandidate;
}

export type LogLevel = "info" | "success" | "warn" | "error";

export interface LogEntry {
  time: string;
  msg: string;
  type: LogLevel;
}

export type IPCMessageType =
  | "LOGIN_SUCCESS"
  | "LOGOUT"
  | "GET_STATE"
  | "STATE"
  | "TIMER_UPDATE"
  | "SESSION_WARNING"
  | "SESSION_EXPIRED"
  | "SPAWN_EXPLORER"
  | "PING"
  | "PONG";

export interface IPCMessage<T = unknown> {
  type: IPCMessageType;
  payload?: T;
  secret: string;
  ts?: number;
}

export interface LoginSuccessPayload {
  username: string;
  sessionMinutes: number;
  token?: string;
}

export type MouseButton = "left" | "right" | "middle";

export interface ScreenSource {
  id: string;
  name: string;
  display_id: string;
}

export interface SystemInfo {
  stationId: string;
  stationIp: string;
  hostname: string;
  platform: string;
  cpuModel: string;
  totalMemory: number;
}
