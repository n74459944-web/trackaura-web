"use client";

import { useState } from "react";

const SUPABASE_URL = "https://scsinqiyoxutvkopahbb.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjc2lucWl5b3h1dHZrb3BhaGJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwMzkyNTIsImV4cCI6MjA4ODYxNTI1Mn0.tcFRAK1x9o0Dru39jK0Soo6yeA2Xz0O0C_vm989r_VA";

interface PriceAlertProps {
  productSlug: string;
  productName: string;
  currentPrice: number;
  retailer: string;
}

export default function PriceAlert({ productSlug, productName, currentPrice, retailer }: PriceAlertProps) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [target, setTarget] = useState(Math.floor(currentPrice * 0.9 * 100) / 100);
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "exists" | "error">("idle");
  const [validationError, setValidationError] = useState<string | null>(null);

  const validate = (): string | null => {
    if (!email || !email.includes("@") || !email.includes(".")) {
      return "Please enter a valid email address.";
    }
    if (!Number.isFinite(target) || target <= 0) {
      return "Target price must be greater than $0.";
    }
    if (target >= currentPrice) {
      return "Target must be less than the current price of $" + currentPrice.toFixed(2) + ".";
    }
    return null;
  };

  const handleSubmit = async () => {
    const err = validate();
    if (err) {
      setValidationError(err);
      return;
    }
    setValidationError(null);
    setStatus("saving");

    try {
      const res = await fetch(SUPABASE_URL + "/rest/v1/price_alerts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_KEY,
          Authorization: "Bearer " + SUPABASE_KEY,
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          email: email.toLowerCase().trim(),
          product_slug: productSlug,
          product_name: productName,
          target_price: target,
          current_price: currentPrice,
          retailer: retailer,
        }),
      });

      if (res.ok) {
        setStatus("done");
        if (typeof window !== "undefined" && (window as any).gtag) {
          (window as any).gtag("event", "price_alert_set", {
            event_category: "engagement",
            event_label: productName,
            value: target,
          });
        }
      } else if (res.status === 409) {
        setStatus("exists");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-secondary" style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.375rem" }}>
        <svg width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" />
        </svg>
        Set Price Alert
      </button>
    );
  }

  if (status === "done") {
    return (
      <div style={{ background: "var(--accent-glow)", border: "1px solid var(--accent)", borderRadius: 8, padding: "1rem", textAlign: "center" }}>
        <p style={{ color: "var(--accent)", fontWeight: 600, fontSize: "0.875rem" }}>
          {"\u2713 Alert set! We will email you when this drops below $" + target.toFixed(2)}
        </p>
      </div>
    );
  }

  if (status === "exists") {
    return (
      <div style={{ background: "var(--accent-glow)", border: "1px solid var(--accent)", borderRadius: 8, padding: "1rem", textAlign: "center" }}>
        <p style={{ color: "var(--accent)", fontWeight: 600, fontSize: "0.875rem" }}>
          {"\u2713 You already have an alert for this product."}
        </p>
      </div>
    );
  }

  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "1rem", background: "var(--bg-secondary)" }}>
      <p style={{ fontFamily: "'Sora', sans-serif", fontWeight: 600, fontSize: "0.8125rem", marginBottom: "0.75rem" }}>
        {"\uD83D\uDD14 Set Price Alert"}
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        <div>
          <label style={{ fontSize: "0.6875rem", color: "var(--text-secondary)", display: "block", marginBottom: "0.25rem" }}>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); if (validationError) setValidationError(null); }}
            placeholder="your@email.com"
            style={{ width: "100%", padding: "0.5rem 0.75rem", background: "var(--bg-primary)", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text-primary)", fontSize: "0.8125rem", outline: "none", fontFamily: "'DM Sans', sans-serif" }}
          />
        </div>
        <div>
          <label style={{ fontSize: "0.6875rem", color: "var(--text-secondary)", display: "block", marginBottom: "0.25rem" }}>{"Alert me when price drops below (currently $" + currentPrice.toFixed(2) + ")"}</label>
          <input
            type="number"
            value={Number.isFinite(target) ? target : ""}
            onChange={(e) => {
              const v = e.target.value;
              setTarget(v === "" ? NaN : Number(v));
              if (validationError) setValidationError(null);
            }}
            step="0.01"
            min="0.01"
            max={currentPrice}
            style={{ width: "100%", padding: "0.5rem 0.75rem", background: "var(--bg-primary)", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text-primary)", fontSize: "0.8125rem", outline: "none", fontFamily: "'DM Sans', sans-serif" }}
          />
        </div>
        <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.25rem" }}>
          <button onClick={handleSubmit} disabled={status === "saving"} className="btn-primary" style={{ flex: 1, fontSize: "0.8125rem" }}>
            {status === "saving" ? "Saving..." : "Set Alert"}
          </button>
          <button onClick={() => setOpen(false)} className="btn-secondary" style={{ fontSize: "0.8125rem" }}>Cancel</button>
        </div>
        {validationError && (
          <p style={{ color: "var(--danger)", fontSize: "0.75rem" }}>{validationError}</p>
        )}
        {status === "error" && (
          <p style={{ color: "var(--danger)", fontSize: "0.75rem" }}>Something went wrong. Try again.</p>
        )}
      </div>
    </div>
  );
}
