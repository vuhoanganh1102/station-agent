// src/components/LoginScreen.tsx
import React, { useState, useEffect, useRef, CSSProperties } from "react";
import type { LoginResponse } from "../../../types";
interface LoginScreenProps {
  onLoginSuccess: (result: LoginResponse) => void;
  serverConnected: boolean;
  stationId: string;
}

// Dev mock — xóa khi production
async function mockLogin(
  username: string,
  password: string,
): Promise<LoginResponse> {
  await new Promise<void>((r) => setTimeout(r, 1000));
  if (username === "demo" && password === "1234") {
    return {
      success: true,
      username: "demo",
      sessionMinutes: 60,
      balance: 50000,
      token: "tok_123",
    };
  }
  return { success: false, message: "Sai tài khoản hoặc mật khẩu" };
}

function NeonGrid(): React.ReactElement {
  return (
    <svg
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        opacity: 0.04,
      }}
    >
      <defs>
        <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
          <path
            d="M 60 0 L 0 0 0 60"
            fill="none"
            stroke="#00d4ff"
            strokeWidth="0.5"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid)" />
    </svg>
  );
}

export default function LoginScreen({
  onLoginSuccess,
  serverConnected,
  stationId,
}: LoginScreenProps): React.ReactElement {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [shakeError, setShakeError] = useState(false);
  const [time, setTime] = useState(new Date());
  const usernameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    usernameRef.current?.focus();
    const tick = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(tick);
  }, []);

  const triggerError = (msg: string): void => {
    setError(msg);
    setShakeError(true);
    setTimeout(() => setShakeError(false), 500);
  };

  const handleLogin = async (): Promise<void> => {
    if (!username.trim() || !password.trim()) {
      triggerError("Vui lòng nhập đầy đủ thông tin");
      return;
    }
    setLoading(true);
    setError("");
    try {
      s;
      const loginFn = window.electron.agentAPI?.login ?? mockLogin;
      const result = await loginFn({ username, password });
      if (result.success) {
        onLoginSuccess(result);
      } else {
        triggerError(result.message ?? "Sai tài khoản hoặc mật khẩu");
      }
    } catch {
      triggerError("Không thể kết nối máy chủ");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === "Enter") void handleLogin();
  };

  const timeStr = time.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const dateStr = time.toLocaleDateString("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  return (
    <div style={s.root}>
      <NeonGrid />

      {/* Orbs */}
      <div
        style={{
          position: "absolute",
          width: 500,
          height: 500,
          top: "-15%",
          left: "-10%",
          borderRadius: "50%",
          background: "rgba(0,212,255,0.07)",
          filter: "blur(80px)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 350,
          height: 350,
          bottom: "0%",
          right: "-5%",
          borderRadius: "50%",
          background: "rgba(59,130,246,0.07)",
          filter: "blur(80px)",
          pointerEvents: "none",
        }}
      />

      {/* Top bar */}
      <div style={s.topBar}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              display: "inline-block",
              background: serverConnected ? "#22c55e" : "#ef4444",
              boxShadow: serverConnected
                ? "0 0 8px #22c55e"
                : "0 0 8px #ef4444",
            }}
          />
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 13,
              color: "var(--accent-cyan)",
              letterSpacing: "0.1em",
            }}
          >
            {stationId}
          </span>
        </div>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: serverConnected ? "#22c55e" : "#ef4444",
          }}
        >
          {serverConnected ? "● SERVER ONLINE" : "● SERVER OFFLINE"}
        </span>
      </div>

      {/* Clock */}
      <div style={{ position: "absolute", top: 68, textAlign: "center" }}>
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 52,
            fontWeight: 700,
            letterSpacing: "0.08em",
            color: "var(--accent-cyan)",
            textShadow: "0 0 30px rgba(0,212,255,0.4)",
            lineHeight: 1,
          }}
        >
          {timeStr}
        </div>
        <div
          style={{
            fontFamily: "var(--font-body)",
            fontSize: 13,
            fontWeight: 500,
            color: "var(--text-secondary)",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            marginTop: 6,
          }}
        >
          {dateStr}
        </div>
      </div>

      {/* Card */}
      <div
        style={{
          ...s.card,
          animation: shakeError ? "glitch 0.4s ease" : "slideUp 0.45s ease",
          marginTop: 50,
        }}
      >
        {/* Animated top border */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 2,
            background:
              "linear-gradient(90deg, transparent, #00d4ff, #3b82f6, #00d4ff, transparent)",
            backgroundSize: "200% 100%",
            animation: "border-flow 3s linear infinite",
          }}
        />

        {/* Logo */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            marginBottom: 22,
          }}
        >
          <div
            style={{
              width: 50,
              height: 50,
              borderRadius: 12,
              background: "rgba(0,212,255,0.08)",
              border: "1px solid rgba(0,212,255,0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 0 18px rgba(0,212,255,0.12)",
            }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                stroke="#00d4ff"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div>
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 18,
                fontWeight: 700,
                letterSpacing: "0.2em",
                color: "var(--text-primary)",
              }}
            >
              NET CAFE
            </div>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 9,
                letterSpacing: "0.2em",
                color: "var(--text-muted)",
                marginTop: 2,
              }}
            >
              STATION ACCESS SYSTEM
            </div>
          </div>
        </div>

        <div
          style={{
            height: 1,
            marginBottom: 22,
            background:
              "linear-gradient(90deg, transparent, rgba(0,212,255,0.2), transparent)",
          }}
        />

        {/* Fields */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Username */}
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <label style={s.label}>TÀI KHOẢN</label>
            <div style={{ position: "relative" }}>
              <svg
                style={{
                  position: "absolute",
                  left: 12,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--text-muted)",
                  pointerEvents: "none",
                }}
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
              >
                <path
                  d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
              <input
                ref={usernameRef}
                type="text"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setError("");
                }}
                onKeyDown={handleKeyDown}
                placeholder="Nhập tài khoản..."
                style={s.input}
                disabled={loading}
                autoComplete="off"
                spellCheck={false}
              />
            </div>
          </div>

          {/* Password */}
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <label style={s.label}>MẬT KHẨU</label>
            <div style={{ position: "relative" }}>
              <svg
                style={{
                  position: "absolute",
                  left: 12,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--text-muted)",
                  pointerEvents: "none",
                }}
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
              >
                <rect
                  x="3"
                  y="11"
                  width="18"
                  height="11"
                  rx="2"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
                <path
                  d="M7 11V7a5 5 0 0 1 10 0v4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
              <input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError("");
                }}
                onKeyDown={handleKeyDown}
                placeholder="Nhập mật khẩu..."
                style={s.input}
                disabled={loading}
                autoComplete="off"
              />
            </div>
          </div>

          {/* Error */}
          {error && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "9px 12px",
                background: "rgba(239,68,68,0.09)",
                border: "1px solid rgba(239,68,68,0.25)",
                borderRadius: 8,
                color: "#fca5a5",
                fontSize: 13,
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
                <path
                  d="M12 8v4M12 16h.01"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            onClick={() => void handleLogin()}
            disabled={loading || !serverConnected}
            style={{
              ...s.submitBtn,
              ...(loading ? { opacity: 0.65, cursor: "default" } : {}),
              ...(!serverConnected
                ? {
                    opacity: 0.35,
                    cursor: "not-allowed",
                    color: "#ef4444",
                    borderColor: "rgba(239,68,68,0.25)",
                  }
                : {}),
            }}
          >
            {loading ? (
              <>
                <span
                  style={{
                    width: 13,
                    height: 13,
                    borderRadius: "50%",
                    border: "2px solid rgba(0,212,255,0.2)",
                    borderTopColor: "#00d4ff",
                    display: "inline-block",
                    animation: "spin 0.7s linear infinite",
                  }}
                />
                ĐANG XÁC THỰC...
              </>
            ) : !serverConnected ? (
              "MẤT KẾT NỐI SERVER"
            ) : (
              <>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                ĐĂNG NHẬP
              </>
            )}
          </button>
        </div>

        <p
          style={{
            marginTop: 18,
            textAlign: "center",
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            color: "var(--text-muted)",
            opacity: 0.6,
          }}
        >
          Liên hệ nhân viên nếu quên mật khẩu
        </p>
      </div>

      {/* Bottom bar */}
      <div style={s.bottomBar}>
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            style={{
              width: 3,
              borderRadius: 2,
              height: 4 + (i % 3) * 5,
              background: `hsl(${185 + i * 10},100%,60%)`,
              opacity: 0.55,
            }}
          />
        ))}
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: "0.18em",
            color: "var(--text-muted)",
            margin: "0 14px",
          }}
        >
          NETCAFE MANAGEMENT SYSTEM v2.0
        </span>
        {[...Array(5)].map((_, i) => (
          <div
            key={`r${i}`}
            style={{
              width: 3,
              borderRadius: 2,
              height: 4 + (i % 3) * 5,
              background: `hsl(${220 + i * 10},100%,60%)`,
              opacity: 0.55,
            }}
          />
        ))}
      </div>
    </div>
  );
}

const s: Record<string, CSSProperties> = {
  root: {
    width: "100vw",
    height: "100vh",
    background:
      "linear-gradient(135deg, #030712 0%, #0a0f1e 50%, #030b1a 100%)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    overflow: "hidden",
  },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 22px",
    background: "rgba(3,7,18,0.85)",
    borderBottom: "1px solid rgba(0,212,255,0.1)",
    backdropFilter: "blur(10px)",
    zIndex: 10,
  },
  card: {
    width: 400,
    position: "relative",
    zIndex: 10,
    background:
      "linear-gradient(145deg, rgba(13,20,36,0.96), rgba(10,15,30,0.98))",
    border: "1px solid rgba(0,212,255,0.18)",
    borderRadius: 16,
    padding: "30px 30px 22px",
    boxShadow:
      "0 24px 80px rgba(0,0,0,0.65), inset 0 1px 0 rgba(0,212,255,0.08)",
    overflow: "hidden",
  },
  label: {
    fontFamily: "var(--font-mono)",
    fontSize: 10,
    fontWeight: 500,
    letterSpacing: "0.18em",
    color: "var(--text-muted)",
  },
  input: {
    width: "100%",
    padding: "11px 11px 11px 38px",
    background: "rgba(0,212,255,0.04)",
    border: "1px solid rgba(0,212,255,0.14)",
    borderRadius: 8,
    color: "var(--text-primary)",
    fontFamily: "var(--font-body)",
    fontSize: 15,
    fontWeight: 500,
    outline: "none",
    caretColor: "#00d4ff",
    transition: "border-color 0.2s",
  },
  submitBtn: {
    width: "100%",
    padding: "13px",
    background:
      "linear-gradient(135deg, rgba(0,212,255,0.12), rgba(59,130,246,0.12))",
    border: "1px solid rgba(0,212,255,0.28)",
    borderRadius: 10,
    color: "#00d4ff",
    fontFamily: "var(--font-display)",
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: "0.14em",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 2,
    transition: "all 0.2s",
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 30,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    background: "rgba(3,7,18,0.92)",
    borderTop: "1px solid rgba(0,212,255,0.07)",
  },
};
