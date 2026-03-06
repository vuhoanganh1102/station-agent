import type { AppConfig } from "../types";

const config: AppConfig = {
  // Server IP - thay bằng IP máy chủ trong mạng LAN
  SERVER_IP: process.env.SERVER_IP ?? "192.168.1.53",
  SERVER_PORT: process.env.SERVER_PORT ?? 4000,

  // Station ID - nếu không set sẽ dùng hostname
  STATION_ID: process.env.STATION_ID ?? "",

  // WebRTC config - trong LAN không cần TURN server
  ICE_SERVERS: [{ urls: "stun:stun.l.google.com:19302" }],

  // Reconnection
  RECONNECT_INTERVAL: 3000,
  RECONNECT_ATTEMPTS: Infinity,

  // Screenshot quality for thumbnails
  SCREENSHOT_QUALITY: "low",
  SCREENSHOT_MAX_WIDTH: 400,
};

export default config;
