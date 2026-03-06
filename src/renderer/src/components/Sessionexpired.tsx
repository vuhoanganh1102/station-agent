// src/components/SessionExpired.tsx
import React, { useEffect, useState, CSSProperties } from "react";

interface SessionExpiredProps {
  username: string;
  onDone: () => void;
}

export default function SessionExpired({
  username,
  onDone,
}: SessionExpiredProps): React.ReactElement {
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    const t = setInterval(() => {
      setCountdown((v) => {
        if (v <= 1) {
          clearInterval(t);
          onDone();
          return 0;
        }
        return v - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [onDone]);

  return (
    <div style={s.root}>
      <div style={s.card}>
        {/* Icon */}
        <div style={s.iconWrap}>
          <svg width="38" height="38" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="#ef4444" strokeWidth="1.5" />
            <path
              d="M12 8v4M12 16h.01"
              stroke="#ef4444"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </div>

        <h2 style={s.title}>PHIÊN ĐÃ KẾT THÚC</h2>

        <div style={s.userBadge}>{username}</div>

        <p style={s.msg}>
          Thời gian sử dụng đã hết.
          <br />
          Vui lòng liên hệ nhân viên để gia hạn.
        </p>

        {/* Countdown */}
        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
          <span style={s.countNum}>{countdown}</span>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 13,
              color: "var(--text-muted)",
            }}
          >
            giây
          </span>
        </div>

        <p style={s.sub}>Đang chuyển về màn hình đăng nhập...</p>
      </div>
    </div>
  );
}

const s: Record<string, CSSProperties> = {
  root: {
    position: "fixed",
    inset: 0,
    zIndex: 999999,
    background: "rgba(3,7,18,0.97)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "var(--font-body)",
    animation: "fadeIn 0.3s ease",
  },
  card: {
    textAlign: "center",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 14,
    padding: "44px 38px",
    background: "rgba(13,20,36,0.92)",
    border: "1px solid rgba(239,68,68,0.28)",
    borderRadius: 16,
    boxShadow: "0 0 60px rgba(239,68,68,0.18), 0 24px 60px rgba(0,0,0,0.6)",
    maxWidth: 360,
    width: "90%",
  },
  iconWrap: {
    width: 70,
    height: 70,
    borderRadius: "50%",
    background: "rgba(239,68,68,0.09)",
    border: "1px solid rgba(239,68,68,0.2)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    animation: "pulse-red 2s infinite",
  },
  title: {
    fontFamily: "var(--font-display)",
    fontSize: 20,
    fontWeight: 700,
    letterSpacing: "0.1em",
    color: "#ef4444",
    margin: 0,
  },
  userBadge: {
    fontFamily: "var(--font-mono)",
    fontSize: 13,
    color: "var(--text-secondary)",
    background: "rgba(0,212,255,0.06)",
    border: "1px solid rgba(0,212,255,0.1)",
    padding: "4px 14px",
    borderRadius: 6,
  },
  msg: {
    fontSize: 14,
    color: "var(--text-secondary)",
    lineHeight: 1.7,
    margin: 0,
  },
  countNum: {
    fontFamily: "var(--font-display)",
    fontSize: 46,
    fontWeight: 900,
    color: "#ef4444",
    lineHeight: 1,
    textShadow: "0 0 20px rgba(239,68,68,0.55)",
    animation: "countdown-tick 1s ease infinite",
  },
  sub: {
    fontFamily: "var(--font-mono)",
    fontSize: 10,
    color: "var(--text-muted)",
    letterSpacing: "0.05em",
    margin: 0,
  },
};
