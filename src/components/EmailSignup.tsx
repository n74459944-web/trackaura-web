"use client";

import { useState } from "react";

export default function EmailSignup() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">("idle");

  const handleSubmit = () => {
    if (!email || !email.includes("@")) return;
    setStatus("saving");

    // Store in localStorage for now - migrate to Supabase later
    try {
      const existing = JSON.parse(localStorage.getItem("trackaura_emails") || "[]");
      if (!existing.includes(email)) {
        existing.push(email);
        localStorage.setItem("trackaura_emails", JSON.stringify(existing));
      }

      // Track in Google Analytics
      if (typeof window !== "undefined" && (window as any).gtag) {
        (window as any).gtag("event", "email_signup", {
          event_category: "engagement",
          event_label: "price_alerts",
        });
      }

      setStatus("done");
      setEmail("");
    } catch {
      setStatus("error");
    }
  };

  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: "2rem",
        textAlign: "center",
      }}
    >
      <h3
        style={{
          fontFamily: "'Sora', sans-serif",
          fontWeight: 700,
          fontSize: "1.125rem",
          marginBottom: "0.5rem",
        }}
      >
        {"\uD83D\uDD14"} Price Drop Alerts
      </h3>
      <p
        style={{
          color: "var(--text-secondary)",
          fontSize: "0.875rem",
          marginBottom: "1.25rem",
          lineHeight: 1.5,
        }}
      >
        Get notified when prices drop on Canadian electronics. Coming soon.
      </p>

      {status === "done" ? (
        <p style={{ color: "var(--accent)", fontWeight: 600, fontSize: "0.9375rem" }}>
          {"\u2713"} You are on the list! We will notify you when alerts launch.
        </p>
      ) : (
        <div style={{ display: "flex", gap: "0.5rem", maxWidth: 440, margin: "0 auto" }}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            style={{
              flex: 1,
              padding: "0.625rem 1rem",
              background: "var(--bg-primary)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              color: "var(--text-primary)",
              fontSize: "0.875rem",
              outline: "none",
              fontFamily: "'DM Sans', sans-serif",
            }}
          />
          <button
            onClick={handleSubmit}
            disabled={status === "saving"}
            className="btn-primary"
            style={{ whiteSpace: "nowrap" }}
          >
            {status === "saving" ? "..." : "Notify Me"}
          </button>
        </div>
      )}

      {status === "error" && (
        <p style={{ color: "var(--danger)", fontSize: "0.8125rem", marginTop: "0.5rem" }}>
          Something went wrong. Try again.
        </p>
      )}
    </div>
  );
}
