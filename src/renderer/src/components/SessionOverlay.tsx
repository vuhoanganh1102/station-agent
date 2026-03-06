// src/components/SessionOverlay.tsx
import React, { useState, useEffect, CSSProperties } from "react";
import type { TimerData, SessionWarning } from "../../../types";

interface SessionOverlayProps {
  sessionData: {
    username: string;
    sessionMinutes: number;
  };
  timerData: TimerData;
  warning: SessionWarning | null;
  onLogout: () => void;
}

function TimerRing({
  progress,
  size = 110,
  strokeWidth = 6,
  color = "#00d4ff",
}: {
  progress: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
}): React.ReactElement {
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - progress * circumference;

  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="rgba(0,212,255,0.07)"
        strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{
          transition: "stroke-dashoffset 1s linear",
          filter: `drop-shadow(0 0 5px ${color})`,
        }}
      />
    </svg>
  );
}

export default function SessionOverlay({
  sessionData,
  timerData,
  warning,
  onLogout,
}: SessionOverlayProps): React.ReactElement {
  const [showConfirm, setShowConfirm] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const { username, sessionMinutes } = sessionData;
  const { elapsed = 0, remaining = sessionMinutes } = timerData;

  const progress = sessionMinutes > 0 ? remaining / sessionMinutes : 1;
  const remainingH = Math.floor(remaining / 60);
  const remainingM = remaining % 60;
  const isCritical = remaining <= 5;
  const isWarning = remaining <= 10;

  const ringColor = isCritical ? "#ef4444" : isWarning ? "#f59e0b" : "#00d4ff";

  const timeStr = currentTime.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  return (
    <div style={s.root}>
      {/* Warning banner */}
      {warning && (
        <div style={s.warningBanner}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <path
              d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <path
              d="M12 9v4M12 17h.01"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          {warning.message}
        </div>
      )}

      {/* Top bar */}
      <div style={s.topBar}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "#22c55e",
              boxShadow: "0 0 7px #22c55e",
              display: "inline-block",
            }}
          />
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: "#00d4ff",
              letterSpacing: "0.1em",
            }}
          >
            SESSION ACTIVE
          </span>
        </div>

        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 17,
            color: "var(--text-primary)",
            letterSpacing: "0.08em",
          }}
        >
          {timeStr}
        </span>

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
            <path
              d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"
              stroke="#00d4ff"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              color: "#00d4ff",
            }}
          >
            {username}
          </span>
        </div>
      </div>

      {/* Timer widget - bottom right */}
      <div
        style={{
          ...s.timerWidget,
          borderColor: isCritical
            ? "rgba(239,68,68,0.45)"
            : isWarning
              ? "rgba(245,158,11,0.35)"
              : "rgba(0,212,255,0.2)",
          animation: isCritical ? "pulse-red 1.5s infinite" : "none",
        }}
      >
        <div style={s.timerInner}>
          {/* Ring */}
          <div
            style={{
              position: "relative",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <TimerRing progress={progress} color={ringColor} />
            <div style={{ position: "absolute", textAlign: "center" }}>
              <div
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 20,
                  fontWeight: 700,
                  color: ringColor,
                  lineHeight: 1,
                  textShadow: `0 0 12px ${ringColor}`,
                }}
              >
                {String(remainingH).padStart(2, "0")}:
                {String(remainingM).padStart(2, "0")}
              </div>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 8,
                  color: "var(--text-muted)",
                  marginTop: 3,
                  letterSpacing: "0.1em",
                }}
              >
                CÒN LẠI
              </div>
            </div>
          </div>

          {/* Stats */}
          <div style={s.statsRow}>
            <div style={{ textAlign: "center", flex: 1 }}>
              <div
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 15,
                  fontWeight: 700,
                  color: "var(--text-secondary)",
                }}
              >
                {elapsed}
              </div>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 8,
                  color: "var(--text-muted)",
                  marginTop: 1,
                }}
              >
                đã dùng
              </div>
            </div>
            <div
              style={{
                width: 1,
                background: "rgba(0,212,255,0.1)",
                alignSelf: "stretch",
              }}
            />
            <div style={{ textAlign: "center", flex: 1 }}>
              <div
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 15,
                  fontWeight: 700,
                  color: "#00d4ff",
                }}
              >
                {sessionMinutes}
              </div>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 8,
                  color: "var(--text-muted)",
                  marginTop: 1,
                }}
              >
                gói (ph)
              </div>
            </div>
          </div>

          {/* Logout */}
          {showConfirm ? (
            <div
              style={{
                display: "flex",
                gap: 5,
                alignItems: "center",
                justifyContent: "center",
                flexWrap: "wrap",
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  color: "var(--text-muted)",
                  width: "100%",
                  textAlign: "center",
                }}
              >
                Thoát phiên?
              </span>
              <button onClick={onLogout} style={s.confirmYes}>
                XÁC NHẬN
              </button>
              <button onClick={() => setShowConfirm(false)} style={s.confirmNo}>
                HỦY
              </button>
            </div>
          ) : (
            <button onClick={() => setShowConfirm(true)} style={s.logoutBtn}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                <path
                  d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              ĐĂNG XUẤT
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const s: Record<string, CSSProperties> = {
  root: {
    position: "fixed",
    inset: 0,
    pointerEvents: "none",
    zIndex: 99999,
    fontFamily: "var(--font-body)",
  },
  warningBanner: {
    position: "absolute",
    top: 48,
    left: "50%",
    transform: "translateX(-50%)",
    background: "rgba(239,68,68,0.14)",
    border: "1px solid rgba(239,68,68,0.38)",
    borderRadius: 8,
    padding: "9px 18px",
    color: "#fca5a5",
    fontFamily: "var(--font-mono)",
    fontSize: 12,
    fontWeight: 500,
    display: "flex",
    alignItems: "center",
    gap: 8,
    pointerEvents: "auto",
    whiteSpace: "nowrap",
    zIndex: 100001,
  },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 40,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 14px",
    background: "rgba(3,7,18,0.88)",
    borderBottom: "1px solid rgba(0,212,255,0.1)",
    backdropFilter: "blur(10px)",
    pointerEvents: "auto",
    zIndex: 100000,
  },
  timerWidget: {
    position: "absolute",
    bottom: 18,
    right: 18,
    width: 185,
    background:
      "linear-gradient(145deg, rgba(13,20,36,0.97), rgba(10,15,30,0.99))",
    border: "1px solid",
    borderRadius: 14,
    overflow: "hidden",
    pointerEvents: "auto",
    transition: "border-color 0.4s",
  },
  timerInner: {
    padding: "14px 12px 12px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 10,
  },
  statsRow: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    padding: "7px 0",
    background: "rgba(0,212,255,0.03)",
    borderRadius: 7,
    border: "1px solid rgba(0,212,255,0.07)",
  },
  logoutBtn: {
    width: "100%",
    padding: "7px",
    background: "rgba(239,68,68,0.08)",
    border: "1px solid rgba(239,68,68,0.2)",
    borderRadius: 7,
    color: "#fca5a5",
    fontFamily: "var(--font-display)",
    fontSize: 9,
    fontWeight: 600,
    letterSpacing: "0.14em",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  confirmYes: {
    padding: "5px 10px",
    background: "rgba(239,68,68,0.14)",
    border: "1px solid rgba(239,68,68,0.3)",
    borderRadius: 6,
    color: "#fca5a5",
    fontFamily: "var(--font-mono)",
    fontSize: 10,
    cursor: "pointer",
  },
  confirmNo: {
    padding: "5px 10px",
    background: "rgba(0,212,255,0.08)",
    border: "1px solid rgba(0,212,255,0.2)",
    borderRadius: 6,
    color: "#00d4ff",
    fontFamily: "var(--font-mono)",
    fontSize: 10,
    cursor: "pointer",
  },
};
