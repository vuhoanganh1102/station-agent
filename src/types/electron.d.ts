// src/types/electron.d.ts
import type {
  ScreenSource,
  LoginRequest,
  LoginResponse,
  ServiceState,
  TimerData,
  SessionWarning,
} from "./index";

interface SDP {
  type: "offer" | "pranswer" | "answer" | "rollback";
  sdp: string | undefined;
}

interface IceCandidate {
  candidate: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
}

declare global {
  interface Window {
    electron: {
      agentAPI: {
        // Screen capture
        getSources: () => Promise<ScreenSource[]>;
        onSourcesList: (callback: (sources: ScreenSource[]) => void) => void;

        // Screen sharing
        onStartScreenShare: (
          callback: (data: { adminSocketId: string }) => void,
        ) => void;
        onStopScreenShare: (
          callback: (data: { adminSocketId: string }) => void,
        ) => void;

        // WebRTC
        onWebRTCOffer: (
          callback: (data: { adminSocketId: string; sdp: SDP }) => void,
        ) => void;
        onWebRTCAnswer: (
          callback: (data: { adminSocketId: string; sdp: SDP }) => void,
        ) => void;
        onWebRTCIceCandidate: (
          callback: (data: {
            adminSocketId: string;
            candidate: IceCandidate;
          }) => void,
        ) => void;
        sendOffer: (data: { targetAdminId: string; sdp: SDP }) => void;
        sendAnswer: (data: { targetAdminId: string; sdp: SDP }) => void;
        sendIceCandidate: (data: {
          targetAdminId: string;
          candidate: IceCandidate;
        }) => void;

        // Remote control
        onMouseMove: (callback: (data: unknown) => void) => void;
        onMouseClick: (callback: (data: unknown) => void) => void;
        onMouseScroll: (callback: (data: unknown) => void) => void;
        onKeyTap: (callback: (data: unknown) => void) => void;
        onKeyType: (callback: (data: unknown) => void) => void;

        // Admin commands
        onLock: (callback: () => void) => void;
        onUnlock: (callback: () => void) => void;
        onShowMessage: (callback: (data: { message: string }) => void) => void;
        onTakeScreenshot: (
          callback: (data: { targetAdminId: string }) => void,
        ) => void;
        sendScreenshot: (data: {
          targetAdminId: string;
          image: string;
        }) => void;

        // Login flow
        login: (credentials: LoginRequest) => Promise<LoginResponse>;
        logout: () => Promise<{ success: boolean }>;
        getStationId: () => Promise<string>;

        // Service state relay
        onServiceState: (callback: (state: ServiceState) => void) => void;
        onTimerUpdate: (callback: (data: TimerData) => void) => void;
        onSessionWarning: (callback: (data: SessionWarning) => void) => void;
        onSessionExpired: (callback: () => void) => void;
        onServerConnected: (callback: (status: boolean) => void) => void;
      };
    };
  }
}
