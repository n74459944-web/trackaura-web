import { Metadata } from "next";
import Link from "next/link";
import { getStats } from "@/lib/data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "How TrackAura Works — Price Tracking for Canadian Electronics",
  description:
    "Learn how TrackAura tracks electronics prices across Canadian retailers every 4 hours. Price history, alerts, comparisons, and more.",
  alternates: { canonical: "https://www.trackaura.com/how-it-works" },
};

export default function HowItWorksPage() {
  const stats = getStats();

  const steps = [
    {
      number: "1",
      title: "We Scrape Retailer Prices",
      description:
        "Every 4 hours, our automated scrapers visit Canada Computers and Newegg Canada. " +
        "They collect the current price for every product across " +
        stats.categories.length +
        " categories \u2014 from GPUs and CPUs to keyboards and webcams. " +
        "We currently track " +
        stats.totalProducts.toLocaleString() +
        " products.",
    },
    {
      number: "2",
      title: "We Record Every Price Change",
      description:
        "Each price gets saved with a timestamp. Over time, this builds a complete price history for every product. " +
        "We\u2019ve collected " +
        stats.totalPricePoints.toLocaleString() +
        " price points so far. " +
        "This history lets you see trends \u2014 whether a product\u2019s price is rising, falling, or stable.",
    },
    {
      number: "3",
      title: "You Search and Compare",
      description:
        "Search for any product and instantly see its price history chart, current price, " +
        "lowest tracked price, and whether it\u2019s available at other retailers for less. " +
        "Our buying guides highlight the best deals in every category.",
    },
    {
      number: "4",
      title: "You Set Alerts",
      description:
        "Found something you want but the price isn\u2019t right? Set a price alert and we\u2019ll email you " +
        "when it drops to your target price. No account needed \u2014 just your email and your target price.",
    },
    {
      number: "5",
      title: "You Buy at the Right Time",
      description:
        "With full price history, you\u2019ll know if a \u201Csale\u201D is a real deal or just a marketing trick. " +
        "Click through to the retailer or compare on Amazon.ca to find the best price.",
    },
  ];

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "2rem 1.5rem" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": [
          {
            "@type": "Question",
            "name": "Is TrackAura free?",
            "acceptedAnswer": { "@type": "Answer", "text": "Yes, completely free. We earn a small commission when you click through to Amazon.ca and make a purchase." }
          },
          {
            "@type": "Question",
            "name": "How often are prices updated?",
            "acceptedAnswer": { "@type": "Answer", "text": "Every 4 hours, 24 hours a day, 7 days a week." }
          },
          {
            "@type": "Question",
            "name": "Which retailers do you track?",
            "acceptedAnswer": { "@type": "Answer", "text": "Currently Canada Computers and Newegg Canada, with Amazon.ca comparison links on every product." }
          },
          {
            "@type": "Question",
            "name": "Are the prices accurate?",
            "acceptedAnswer": { "@type": "Answer", "text": "Prices come directly from each retailer's website. We recommend verifying on the retailer's site before purchasing." }
          },
          {
            "@type": "Question",
            "name": "How do price alerts work?",
            "acceptedAnswer": { "@type": "Answer", "text": "Enter your email and target price on any product page. We'll email you when the price drops to your target." }
          },
          {
            "@type": "Question",
            "name": "Why are all prices in CAD?",
            "acceptedAnswer": { "@type": "Answer", "text": "TrackAura is built for Canadian shoppers. All prices are in Canadian dollars from Canadian retailer websites." }
          }
        ]
      }) }} />
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
        <span style={{ color: "var(--text-secondary)" }}>How It Works</span>
      </nav>

      <h1
        style={{
          fontFamily: "'Sora', sans-serif",
          fontWeight: 800,
          fontSize: "2rem",
          marginBottom: "0.75rem",
        }}
      >
        How TrackAura Works
      </h1>

      <p
        style={{
          color: "var(--text-secondary)",
          fontSize: "0.9375rem",
          lineHeight: 1.7,
          marginBottom: "2.5rem",
        }}
      >
        {"TrackAura is a free, automated price tracking tool for Canadian electronics shoppers. " +
        "Here\u2019s exactly what happens behind the scenes."}
      </p>

      {/* Steps */}
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", marginBottom: "2.5rem" }}>
        {steps.map((step) => (
          <div
            key={step.number}
            className="card"
            style={{
              padding: "1.5rem",
              display: "flex",
              gap: "1.25rem",
              alignItems: "flex-start",
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                minWidth: 44,
                borderRadius: "50%",
                background: "var(--accent-glow)",
                border: "1px solid var(--accent)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "'Sora', sans-serif",
                fontWeight: 700,
                color: "var(--accent)",
                fontSize: "1rem",
              }}
            >
              {step.number}
            </div>
            <div>
              <h2
                style={{
                  fontFamily: "'Sora', sans-serif",
                  fontWeight: 700,
                  fontSize: "1.0625rem",
                  marginBottom: "0.5rem",
                }}
              >
                {step.title}
              </h2>
              <p
                style={{
                  fontSize: "0.875rem",
                  color: "var(--text-secondary)",
                  lineHeight: 1.75,
                }}
              >
                {step.description}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* FAQ section */}
      <h2
        style={{
          fontFamily: "'Sora', sans-serif",
          fontWeight: 700,
          fontSize: "1.25rem",
          marginBottom: "1rem",
        }}
      >
        Frequently Asked Questions
      </h2>

      <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "2rem" }}>
        <FaqItem
          question="Is TrackAura free?"
          answer="Yes, completely free. We earn a small commission when you click through to Amazon.ca and make a purchase. This keeps the site running without ads or subscriptions."
        />
        <FaqItem
          question="How often are prices updated?"
          answer="Every 4 hours, 24 hours a day, 7 days a week. Our scrapers run automatically to ensure the data is always fresh."
        />
        <FaqItem
          question="Which retailers do you track?"
          answer="Currently Canada Computers and Newegg Canada. We also include Amazon.ca comparison links on every product page. We're working on adding more Canadian retailers."
        />
        <FaqItem
          question="Are the prices accurate?"
          answer="Our prices come directly from each retailer's website. However, prices can change between our scraping intervals, so we always recommend clicking through to the retailer to verify the current price before purchasing."
        />
        <FaqItem
          question="How do price alerts work?"
          answer="On any product page, enter your email and a target price. When our scrapers detect that the product has dropped to or below your target, we'll send you an email notification."
        />
        <FaqItem
          question="Why are all prices in CAD?"
          answer="TrackAura is built specifically for Canadian shoppers. All prices are in Canadian dollars as listed on the Canadian versions of each retailer's website."
        />
      </div>

      <div style={{ textAlign: "center" }}>
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

function FaqItem({ question, answer }: { question: string; answer: string }) {
  return (
    <div className="card" style={{ padding: "1.25rem" }}>
      <h3
        style={{
          fontFamily: "'Sora', sans-serif",
          fontWeight: 600,
          fontSize: "0.9375rem",
          marginBottom: "0.5rem",
        }}
      >
        {question}
      </h3>
      <p
        style={{
          fontSize: "0.875rem",
          color: "var(--text-secondary)",
          lineHeight: 1.7,
        }}
      >
        {answer}
      </p>
    </div>
  );
}
