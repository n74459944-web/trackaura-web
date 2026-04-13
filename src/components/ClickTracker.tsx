"use client";

import { ReactNode } from "react";

interface ClickTrackerProps {
  href: string;
  event: string;
  label: string;
  retailer: string;
  category: string;
  price: number;
  className?: string;
  style?: React.CSSProperties;
  /** Extra rel tokens. nofollow, sponsored, noopener, noreferrer are always applied. */
  rel?: string;
  children: ReactNode;
}

export default function ClickTracker({
  href,
  event,
  label,
  retailer,
  category,
  price,
  className,
  style,
  rel,
  children,
}: ClickTrackerProps) {
  const handleClick = () => {
    if (typeof window !== "undefined" && (window as any).gtag) {
      (window as any).gtag("event", event, {
        event_category: event === "affiliate_click" ? "affiliate" : "outbound",
        event_label: label,
        retailer,
        product_category: category,
        price,
      });
    }
  };

  // All retailer destinations are commercial / affiliate links and must be
  // marked nofollow + sponsored per Google's link attribution guidance.
  const baseRel = "noopener noreferrer nofollow sponsored";
  const finalRel = rel ? `${baseRel} ${rel}` : baseRel;

  return (
    <a href={href} target="_blank" rel={finalRel} className={className} style={style} onClick={handleClick}>
      {children}
    </a>
  );
}
