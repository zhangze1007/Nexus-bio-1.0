"use client";
import { useState, useEffect } from "react";
import { THEME } from "../theme";

export function ConsentBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem("nexus-bio-consent");
    if (!consent) setShow(true);
  }, []);

  const accept = () => {
    localStorage.setItem("nexus-bio-consent", JSON.stringify({ analytics: true, timestamp: Date.now() }));
    setShow(false);
  };

  if (!show) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        background: "#0d0f14",
        borderTop: "1px solid rgba(255,255,255,0.06)",
        padding: "12px 24px",
        zIndex: 9999,
        display: "flex",
        justifyContent: "center",
        gap: "16px",
        alignItems: "center",
        fontFamily: THEME.SANS,
      }}
    >
      <span style={{ color: "rgba(200,216,232,0.6)", fontSize: "13px" }}>
        We use analytics to improve your experience.{" "}
        <a href="/privacy" style={{ color: THEME.SKY, textDecoration: "underline" }}>
          Privacy Policy
        </a>
      </span>
      <button
        onClick={accept}
        style={{
          background: "rgba(175,195,214,0.12)",
          color: THEME.SKY,
          border: "1px solid rgba(175,195,214,0.24)",
          padding: "6px 16px",
          borderRadius: "6px",
          cursor: "pointer",
          fontSize: "13px",
          fontFamily: THEME.SANS,
        }}
      >
        Accept
      </button>
    </div>
  );
}
