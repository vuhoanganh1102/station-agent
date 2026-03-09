import { useEffect, useRef, useCallback } from "react";

const ICE_SERVERS = [{ urls: "stun:stun.l.google.com:19302" }];

interface UseScreenShareOptions {
  onLog?: (msg: string) => void;
  onStatusChange?: (status: string) => void;
  onSharingChange?: (isSharing: boolean) => void;
}

function getAPI() {
  return window.electron?.agentAPI ?? null;
}

/**
 * Hook xử lý WebRTC screen sharing phía Agent renderer.
 *
 * Key design: all IPC listeners registered ONCE on mount (empty deps).
 * Latest callback versions accessed via refs to avoid useEffect dependency loops.
 */
export function useScreenShare(options: UseScreenShareOptions = {}) {
  // ── Store ALL mutable state in refs to keep useEffect deps empty ──
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());

  // ── Stable log function (never changes) ──
  const log = useCallback((msg: string) => {
    console.log(`[ScreenShare] ${msg}`);
    optionsRef.current.onLog?.(msg);
  }, []);

  // ── Stop sharing ──
  const stopScreenShare = useCallback(
    (adminSocketId: string) => {
      const pc = peerConnectionsRef.current.get(adminSocketId);
      if (pc) {
        pc.getSenders().forEach((sender) => {
          if (sender.track) sender.track.stop();
        });
        pc.close();
        peerConnectionsRef.current.delete(adminSocketId);
        log(`Stopped sharing with ${adminSocketId}`);
      }
      if (peerConnectionsRef.current.size === 0) {
        optionsRef.current.onSharingChange?.(false);
        optionsRef.current.onStatusChange?.("Connected - idle");
      }
    },
    [log],
  );

  // ── Setup peer connection ──
  const setupPeerConnection = useCallback(
    (adminSocketId: string, stream: MediaStream) => {
      const api = getAPI();
      if (!api) return;

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      peerConnectionsRef.current.set(adminSocketId, pc);

      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          api.sendIceCandidate({
            targetAdminId: adminSocketId,
            candidate: {
              candidate: e.candidate.candidate,
              sdpMid: e.candidate.sdpMid,
              sdpMLineIndex: e.candidate.sdpMLineIndex,
            },
          });
        }
      };

      pc.oniceconnectionstatechange = () => {
        log(`ICE state [${adminSocketId}]: ${pc.iceConnectionState}`);
        if (pc.iceConnectionState === "connected") {
          optionsRef.current.onStatusChange?.("Screen sharing active");
          optionsRef.current.onSharingChange?.(true);
        }
        if (
          pc.iceConnectionState === "disconnected" ||
          pc.iceConnectionState === "failed"
        ) {
          stopScreenShare(adminSocketId);
        }
      };

      pc.createOffer()
        .then((offer) => pc.setLocalDescription(offer).then(() => offer))
        .then((offer) => {
          api.sendOffer({
            targetAdminId: adminSocketId,
            sdp: { type: offer.type, sdp: offer.sdp },
          });
          log("Sent WebRTC offer to admin");
        })
        .catch((e) => log(`Offer error: ${(e as Error).message}`));
    },
    [log, stopScreenShare],
  );

  // ── Start screen capture ──
  const startScreenShare = useCallback(
    async (adminSocketId: string) => {
      const api = getAPI();
      if (!api) {
        log("agentAPI not available");
        return;
      }

      log(`Starting screen share for admin: ${adminSocketId}`);

      if (peerConnectionsRef.current.has(adminSocketId)) {
        log(`Already sharing with ${adminSocketId}, cleaning up first`);
        stopScreenShare(adminSocketId);
      }

      try {
        const sources = await api.getSources();
        if (!sources || sources.length === 0) {
          log("No screen sources available");
          return;
        }

        const source = sources[0];
        log(`Using source: ${source.name} (${source.id})`);

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            mandatory: {
              chromeMediaSource: "desktop",
              chromeMediaSourceId: source.id,
              maxWidth: 1920,
              maxHeight: 1080,
              maxFrameRate: 30,
            },
          } as MediaTrackConstraints,
        });

        log("Screen captured successfully");
        setupPeerConnection(adminSocketId, stream);
      } catch (e) {
        log(`Screen capture error: ${(e as Error).message}`);
      }
    },
    [log, stopScreenShare, setupPeerConnection],
  );

  // ── Refs to access latest versions inside IPC handlers ──
  const startRef = useRef(startScreenShare);
  startRef.current = startScreenShare;

  const stopRef = useRef(stopScreenShare);
  stopRef.current = stopScreenShare;

  // ── Register IPC listeners ONCE on mount ──────────────────────────
  useEffect(() => {
    const api = getAPI();
    if (!api) {
      console.warn("[ScreenShare] agentAPI not available — skipping");
      return;
    }

    log("Registering screen share IPC listeners");
    const cleanups: (() => void)[] = [];

    // ── START screen share (from main process) ──
    cleanups.push(
      api.onStartScreenShare(({ adminSocketId }: { adminSocketId: string }) => {
        log(`Received start-screen-share for admin: ${adminSocketId}`);
        void startRef.current(adminSocketId);
      }),
    );

    // ── STOP screen share ──
    cleanups.push(
      api.onStopScreenShare(({ adminSocketId }: { adminSocketId: string }) => {
        log(`Received stop-screen-share for admin: ${adminSocketId}`);
        stopRef.current(adminSocketId);
      }),
    );

    // ── WebRTC ANSWER from admin (via main process) ──
    cleanups.push(
      api.onWebRTCAnswer(
        ({ adminSocketId, sdp }: { adminSocketId: string; sdp: any }) => {
          log(
            `Received answer from admin: ${adminSocketId}, ` +
              `known peers: [${[...peerConnectionsRef.current.keys()].join(", ")}]`,
          );

          const pc = peerConnectionsRef.current.get(adminSocketId);
          if (!pc) {
            log(`No PeerConnection found for admin ${adminSocketId}`);
            return;
          }

          if (pc.signalingState !== "have-local-offer") {
            log(
              `Ignoring answer — state is "${pc.signalingState}", need "have-local-offer"`,
            );
            return;
          }

          if (!sdp || !sdp.type || !sdp.sdp) {
            log(`Invalid answer SDP: ${JSON.stringify(sdp)}`);
            return;
          }

          pc.setRemoteDescription(
            new RTCSessionDescription({ type: sdp.type, sdp: sdp.sdp }),
          )
            .then(() => log("✅ Set remote description (answer) OK"))
            .catch((e) => log(`Error setting answer: ${(e as Error).message}`));
        },
      ),
    );

    // ── ICE candidates from admin ──
    cleanups.push(
      api.onWebRTCIceCandidate(
        ({
          adminSocketId,
          candidate,
        }: {
          adminSocketId: string;
          candidate: any;
        }) => {
          const pc = peerConnectionsRef.current.get(adminSocketId);
          if (!pc) return;
          if (!candidate || !candidate.candidate) return;

          pc.addIceCandidate(new RTCIceCandidate(candidate)).catch((e) =>
            log(`ICE error: ${(e as Error).message}`),
          );
        },
      ),
    );

    // Cleanup on unmount (critical for HMR / dev mode)
    return () => {
      log("CLEANUP: removing all IPC listeners");
      cleanups.forEach((fn) => fn?.());
      peerConnectionsRef.current.forEach((_pc, adminId) => {
        stopRef.current(adminId);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // ← EMPTY — register once, never re-register

  return {
    stopAll: () => {
      peerConnectionsRef.current.forEach((_pc, adminId) => {
        stopScreenShare(adminId);
      });
    },
  };
}
