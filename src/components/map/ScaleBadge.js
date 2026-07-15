import React from "react";

export default function ScaleBadge({ scaleDenom, mdUp }) {
  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        bottom: 12,
        transform: "translateX(-50%)",
        background: "rgba(17,25,40,0.75)",
        color: "#e7eef7",
        padding: "8px 12px",
        borderRadius: 10,
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 10px 30px rgba(2,8,20,0.20)",
        fontSize: 12,
        letterSpacing: 0.2,
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ opacity: 0.8 }}
      >
        <path d="M3 19h18M7 15h10M9 11h6M11 7h2" stroke="#e7eef7" strokeWidth="2" strokeLinecap="round" />
      </svg>
      {mdUp ? `Масштаб: 1:${(scaleDenom || 0).toLocaleString()}` : `1:${(scaleDenom || 0).toLocaleString()}`}
    </div>
  );
}
