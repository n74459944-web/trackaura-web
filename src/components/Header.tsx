"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/products", label: "All Products" },
  { href: "/products?category=headphones", label: "Headphones" },
  { href: "/products?category=gpus", label: "GPUs" },
  { href: "/products?category=ssds", label: "SSDs" },
];

export default function Header() {
  const pathname = usePathname();

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        borderBottom: "1px solid var(--border)",
        background: "rgba(6, 9, 15, 0.85)",
        backdropFilter: "blur(12px)",
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "0 1.5rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: 64,
        }}
      >
        {/* Logo */}
        <Link
          href="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            textDecoration: "none",
          }}
        >
          <span
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              background: "linear-gradient(135deg, #00e5a0, #38bdf8)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 14,
              fontWeight: 800,
              color: "#06090f",
              fontFamily: "'Sora', sans-serif",
            }}
          >
            T
          </span>
          <span
            style={{
              fontFamily: "'Sora', sans-serif",
              fontWeight: 700,
              fontSize: "1.125rem",
              color: "var(--text-primary)",
            }}
          >
            Track
            <span style={{ color: "var(--accent)" }}>Aura</span>
          </span>
        </Link>

        {/* Nav */}
        <nav style={{ display: "flex", gap: "0.25rem", alignItems: "center" }}>
          {NAV_LINKS.map((link) => {
            const isActive =
              link.href === "/"
                ? pathname === "/"
                : pathname.startsWith(link.href.split("?")[0]) &&
                  (link.href.includes("?")
                    ? typeof window !== "undefined" &&
                      window.location.search.includes(
                        link.href.split("?")[1]
                      )
                    : !link.href.includes("?"));

            return (
              <Link
                key={link.href}
                href={link.href}
                style={{
                  padding: "0.375rem 0.75rem",
                  borderRadius: 6,
                  fontSize: "0.8125rem",
                  fontWeight: 500,
                  color: isActive ? "var(--accent)" : "var(--text-secondary)",
                  textDecoration: "none",
                  transition: "color 0.15s",
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
