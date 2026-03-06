// src/components/StatusPanel.tsx
import React, { useRef, useEffect, CSSProperties } from "react";
import type { LogEntry } from "../../../types";

interface StatusPanelProps {
  serviceConnected: boolean;
  serverConnected: boolean;
  stationId: string;
  logs: LogEntry[];
}

export default function StatusPanel({
  serviceConnected,
  serverConnected,
  stationId,
  logs,
}: StatusPanelProps): React.ReactElement {
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs]);

  const indicators = [
    { label: "SERVICE", connected: serviceConnected, desc: "NetAgentService" },
    { label: "SERVER", connected: serverConnected, desc: "Management Server" },
  ];

  const logColor: Record<LogEntry["type"], string> = {
    error: "#fca5a5",
    warn: "#fde68a",
    success: "#86efac",
    info: "var(--text-secondary)",
  };

  return (
    <div style={s.root}>
      {/* Header */}
      <div style={s.header}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
            <rect
              x="2"
              y="3"
              width="20"
              height="14"
              rx="2"
              stroke="#00d4ff"
              strokeWidth="1.5"
            />
            <path
              d="M8 21h8M12 17v4"
              stroke="#00d4ff"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          <span style={s.headerTitle}>SYSTEM STATUS</span>
        </div>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            color: "#00d4ff",
            letterSpacing: "0.08em",
          }}
        >
          {stationId}
        </span>
      </div>

      {/* Indicators */}
      <div style={s.indicatorRow}>
        {indicators.map((ind, i) => (
          <div
            key={ind.label}
            style={{
              ...s.indicator,
              borderRight:
                i < indicators.length - 1
                  ? "1px solid var(--border-color)"
                  : "none",
            }}
          >
            <span
              style={{
                width: 9,
                height: 9,
                borderRadius: "50%",
                flexShrink: 0,
                display: "inline-block",
                background: ind.connected ? "#22c55e" : "#ef4444",
                boxShadow: ind.connected
                  ? "0 0 6px #22c55e"
                  : "0 0 6px #ef4444",
              }}
            />
            <div>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 9,
                  fontWeight: 600,
                  letterSpacing: "0.1em",
                  color: "var(--text-secondary)",
                }}
              >
                {ind.label}
              </div>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 8,
                  color: "var(--text-muted)",
                  marginTop: 1,
                }}
              >
                {ind.desc}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Log */}
      <div ref={logRef} style={s.logBody}>
        {logs.length === 0 ? (
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              color: "var(--text-muted)",
              textAlign: "center",
              marginTop: 6,
            }}
          >
            Đang khởi động...
          </span>
        ) : (
          logs.map((entry, i) => (
            <div key={i} style={{ display: "flex", gap: 7, lineHeight: 1.5 }}>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 9,
                  color: "var(--text-muted)",
                  flexShrink: 0,
                }}
              >
                {entry.time}
              </span>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  color: logColor[entry.type],
                }}
              >
                {entry.msg}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

const s: Record<string, CSSProperties> = {
  root: {
    width: "100%",
    height: "100%",
    background: "var(--bg-secondary)",
    display: "flex",
    flexDirection: "column",
    fontFamily: "var(--font-body)",
    overflow: "hidden",
  },
  header: {
    padding: "8px 12px",
    borderBottom: "1px solid var(--border-color)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    background: "var(--bg-card)",
    flexShrink: 0,
  },
  headerTitle: {
    fontFamily: "var(--font-display)",
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: "0.14em",
    color: "var(--text-primary)",
  },
  indicatorRow: {
    display: "flex",
    borderBottom: "1px solid var(--border-color)",
    flexShrink: 0,
  },
  indicator: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    gap: 7,
    padding: "7px 10px",
  },
  logBody: {
    flex: 1,
    overflowY: "auto",
    padding: "5px 9px",
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },
};
