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
  rel?: string;
  children: ReactNode;
}

export default function ClickTracker({ href, event, label, retailer, category, price, className, style, rel, children }: ClickTrackerProps) {
  const handleClick = () => {
    if (typeof window !== "undefined" && (window as any).gtag) {
      (window as any).gtag("event", event, {
        event_category: event === "affiliate_click" ? "affiliate" : "outbound",
        event_label: label,
        retailer: retailer,
        product_category: category,
        price: price,
      });
    }
  };

  return (
    <a href={href} target="_blank" rel={`noopener noreferrer ${rel || ""}`} className={className} style={style} onClick={handleClick}>
      {children}
    </a>
  );
}