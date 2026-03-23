import { Metadata } from "next";
import Link from "next/link";


export const revalidate = 14400;
export const metadata: Metadata = {
  title: "Terms of Use — TrackAura",
  description: "Terms of use for TrackAura.com, a Canadian electronics price tracking platform.",
  alternates: { canonical: "https://www.trackaura.com/terms" },
};

export default function TermsPage() {
  const lastUpdated = "March 9, 2026";

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "2rem 1.5rem" }}>
      <nav style={{ display: "flex", gap: "0.5rem", fontSize: "0.8125rem", marginBottom: "1.5rem" }}>
        <Link href="/" className="accent-link">Home</Link>
        <span style={{ color: "var(--text-secondary)" }}>/</span>
        <span style={{ color: "var(--text-secondary)" }}>Terms of Use</span>
      </nav>

      <h1 style={{ fontFamily: "'Sora', sans-serif", fontWeight: 800, fontSize: "2rem", marginBottom: "0.5rem" }}>
        Terms of Use
      </h1>
      <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", marginBottom: "2rem" }}>
        {"Last updated: " + lastUpdated}
      </p>

      <div style={{ fontSize: "0.9375rem", color: "var(--text-secondary)", lineHeight: 1.85 }}>
        <Section title="Acceptance of Terms">
          <p>
            {"By accessing and using TrackAura.com (\u201Cthe Site\u201D), you agree to these terms. " +
            "If you do not agree, please do not use the Site."}
          </p>
        </Section>

        <Section title="What TrackAura Does">
          <p>
            {"TrackAura is a free price tracking tool that collects and displays product prices from Canadian electronics retailers. " +
            "We provide price history charts, deal alerts, price comparisons, and buying guides to help Canadian shoppers make informed purchasing decisions."}
          </p>
        </Section>

        <Section title="Price Accuracy">
          <p>
            {"We make every effort to ensure prices displayed on TrackAura are accurate. " +
            "However, prices are scraped from third-party retailer websites and may change between our update intervals. " +
            "TrackAura is not a store \u2014 we do not sell products or process transactions. " +
            "Always verify the current price on the retailer\u2019s website before making a purchase. " +
            "We are not responsible for pricing errors or discrepancies."}
          </p>
        </Section>

        <Section title="Affiliate Disclosure">
          <p>
            {"TrackAura participates in affiliate programs, including the Amazon Associates Program. " +
            "When you click certain links on our site and make a purchase, we may earn a commission. " +
            "This does not affect the price you pay. " +
            "Our product listings and price data are not influenced by affiliate relationships \u2014 we display all products equally regardless of commission."}
          </p>
        </Section>

        <Section title="User Conduct">
          <p>
            {"You agree not to: scrape or programmatically access TrackAura\u2019s data without permission, " +
            "attempt to interfere with the site\u2019s operation, " +
            "use the site for any unlawful purpose, " +
            "or misrepresent your affiliation with TrackAura."}
          </p>
        </Section>

        <Section title="Email Communications">
          <p>
            {"By providing your email address for price alerts or our newsletter, " +
            "you consent to receiving emails related to those services. " +
            "You can unsubscribe at any time. " +
            "We will never send you unsolicited marketing or share your email with third parties."}
          </p>
        </Section>

        <Section title="Intellectual Property">
          <p>
            {"The TrackAura name, logo, and original content on this site are our property. " +
            "Product names, prices, and descriptions belong to their respective retailers and manufacturers. " +
            "TrackAura does not claim ownership of third-party product information."}
          </p>
        </Section>

        <Section title="Limitation of Liability">
          <p>
            {"TrackAura is provided \u201Cas is\u201D without warranties of any kind. " +
            "We are not liable for any damages resulting from your use of the site, " +
            "including but not limited to purchasing decisions made based on our data. " +
            "Our maximum liability is limited to the amount you paid to use TrackAura, which is zero, as the service is free."}
          </p>
        </Section>

        <Section title="Changes to These Terms">
          <p>
            {"We may update these terms from time to time. " +
            "Continued use of the Site after changes constitutes acceptance of the updated terms."}
          </p>
        </Section>

        <Section title="Governing Law">
          <p>
            {"These terms are governed by the laws of the Province of Quebec, Canada."}
          </p>
        </Section>

        <Section title="Contact">
          <p>
            {"Questions about these terms? Contact us at "}
            <a href="mailto:alerts@trackaura.com" className="accent-link">alerts@trackaura.com</a>.
          </p>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: "1.75rem" }}>
      <h2 style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: "1.125rem", color: "var(--text-primary)", marginBottom: "0.5rem" }}>
        {title}
      </h2>
      {children}
    </div>
  );
}
