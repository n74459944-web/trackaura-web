"use client";

import { useState } from "react";

export default function ShareButton({ name, slug }: { name: string; slug: string }) {
  const [copied, setCopied] = useState(false);
  const url = "https://www.trackaura.com/product/" + slug;

  const handleCopy = () => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      if (typeof window !== "undefined" && (window as any).gtag) {
        (window as any).gtag("event", "share", { method: "copy_link", content_type: "product", item_id: slug });
      }
    });
  };

  const handleNativeShare = () => {
    if (navigator.share) {
      navigator.share({ title: name + " - TrackAura", url: url });
    } else {
      handleCopy();
    }
  };

  return (
    <div style={{ display: "flex", gap: "0.375rem" }}>
      <button onClick={handleNativeShare} className="btn-secondary" style={{ fontSize: "0.75rem", padding: "0.375rem 0.75rem", display: "flex", alignItems: "center", gap: "0.375rem" }}>
        <svg width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" />
        </svg>
        Share
      </button>
      <button onClick={handleCopy} className="btn-secondary" style={{ fontSize: "0.75rem", padding: "0.375rem 0.75rem" }}>
        {copied ? "Copied!" : "Copy Link"}
      </button>
    </div>
  );
}
