import { Metadata } from "next";
import Link from "next/link";
import { getStats } from "@/lib/data";

export const metadata: Metadata = {
  title: "About TrackAura — Canadian Electronics Price Tracker",
  description:
    "TrackAura tracks thousands of electronics prices across Canadian retailers every 4 hours. Learn about our mission, how we work, and why we built this.",
  alternates: { canonical: "https://www.trackaura.com/about" },
};

export default function AboutPage() {
  const stats = getStats();

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "2rem 1.5rem" }}>
      <nav
        style={{
          display: "flex",
          gap: "0.5rem",
          fontSize: "0.8125rem",
          marginBottom: "1.5rem",
        }}
      >
        <Link href="/" className="accent-link">Home</Link>
        <span style={{ color: "var(--text-secondary)" }}>/</span>
        <span style={{ color: "var(--text-secondary)" }}>About</span>
      </nav>

      <h1
        style={{
          fontFamily: "'Sora', sans-serif",
          fontWeight: 800,
          fontSize: "2rem",
          marginBottom: "1.5rem",
        }}
      >
        About TrackAura
      </h1>

      <div
        style={{
          fontSize: "0.9375rem",
          color: "var(--text-secondary)",
          lineHeight: 1.85,
        }}
      >
        <p style={{ marginBottom: "1.25rem" }}>
          TrackAura is a free price tracking platform built for Canadian shoppers.
          We monitor electronics prices across major Canadian retailers — including
          Canada Computers and Newegg Canada — so you can see exactly how prices
          change over time and buy at the right moment.
        </p>

        <p style={{ marginBottom: "1.25rem" }}>
          {"Right now, we\u2019re tracking "}
          <strong style={{ color: "var(--text-primary)" }}>
            {stats.totalProducts.toLocaleString()} products
          </strong>
          {" across "}
          <strong style={{ color: "var(--text-primary)" }}>
            {stats.categories.length} categories
          </strong>
          {", with "}
          <strong style={{ color: "var(--text-primary)" }}>
            {stats.totalPricePoints.toLocaleString()} price points
          </strong>
          {" collected so far. Our scrapers run every 4 hours, 24/7, so the data is always fresh."}
        </p>

        <h2
          style={{
            fontFamily: "'Sora', sans-serif",
            fontWeight: 700,
            fontSize: "1.25rem",
            color: "var(--text-primary)",
            marginBottom: "0.75rem",
            marginTop: "2rem",
          }}
        >
          Why We Built This
        </h2>

        <p style={{ marginBottom: "1.25rem" }}>
          {"If you\u2019ve ever bought something online only to see the price drop a week later, you know the frustration. " +
          "Sites like CamelCamelCamel exist for Amazon, but there wasn\u2019t a good equivalent for Canadian electronics retailers. " +
          "TrackAura fills that gap."}
        </p>

        <p style={{ marginBottom: "1.25rem" }}>
          {"We believe you shouldn\u2019t have to guess whether a \u201Csale\u201D price is actually a good deal. " +
          "With full price history for every product, you can see for yourself whether the current price is genuinely low or just marketing."}
        </p>

        <h2
          style={{
            fontFamily: "'Sora', sans-serif",
            fontWeight: 700,
            fontSize: "1.25rem",
            color: "var(--text-primary)",
            marginBottom: "0.75rem",
            marginTop: "2rem",
          }}
        >
          How We Make Money
        </h2>

        <p style={{ marginBottom: "1.25rem" }}>
          {"TrackAura is free to use. We earn a small commission when you click through to Amazon.ca using our comparison links and make a purchase. " +
          "This doesn\u2019t affect the prices you see \u2014 it\u2019s how we keep the site running without ads or subscriptions. " +
          "We\u2019re also working with other retailers to offer the same service."}
        </p>

        <h2
          style={{
            fontFamily: "'Sora', sans-serif",
            fontWeight: 700,
            fontSize: "1.25rem",
            color: "var(--text-primary)",
            marginBottom: "0.75rem",
            marginTop: "2rem",
          }}
        >
          What We Track
        </h2>

        <p style={{ marginBottom: "1.25rem" }}>
          {"We cover the categories that matter most to Canadian tech shoppers: " +
          "graphics cards, CPUs, RAM, SSDs, monitors, laptops, keyboards, mice, " +
          "motherboards, power supplies, PC cases, CPU coolers, routers, webcams, " +
          "speakers, and external storage. We\u2019re always adding more."}
        </p>

        <h2
          style={{
            fontFamily: "'Sora', sans-serif",
            fontWeight: 700,
            fontSize: "1.25rem",
            color: "var(--text-primary)",
            marginBottom: "0.75rem",
            marginTop: "2rem",
          }}
        >
          Our Data
        </h2>

        <p style={{ marginBottom: "1.25rem" }}>
          {"Every price on TrackAura comes directly from the retailer\u2019s website. " +
          "We don\u2019t rely on third-party feeds or estimated prices \u2014 our scrapers visit each product page and record the actual listed price. " +
          "All prices are in Canadian dollars (CAD)."}
        </p>

        <p style={{ marginBottom: "1.25rem" }}>
          {"If you have questions, suggestions, or want to report an issue, feel free to reach out at "}
          <a href="mailto:admin@trackaura.com" className="accent-link">
            admin@trackaura.com
          </a>
          .
        </p>
      </div>

      <div style={{ marginTop: "2rem", textAlign: "center" }}>
        <Link
          href="/products"
          className="btn-primary"
          style={{ textDecoration: "none", display: "inline-block" }}
        >
          Start Tracking Prices
        </Link>
      </div>
    </div>
  );
}
