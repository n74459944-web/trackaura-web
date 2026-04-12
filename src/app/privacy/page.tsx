import { Metadata } from "next";
import Link from "next/link";


export const revalidate = 14400;
export const metadata: Metadata = {
  title: "Privacy Policy — TrackAura",
  description: "TrackAura's privacy policy. Learn how we collect, use, and protect your data.",
  alternates: { canonical: "https://www.trackaura.com/privacy" },
};

export default function PrivacyPage() {
  const lastUpdated = "March 9, 2026";

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "2rem 1.5rem" }}>
      <nav style={{ display: "flex", gap: "0.5rem", fontSize: "0.8125rem", marginBottom: "1.5rem" }}>
        <Link href="/" className="accent-link">Home</Link>
        <span style={{ color: "var(--text-secondary)" }}>/</span>
        <span style={{ color: "var(--text-secondary)" }}>Privacy Policy</span>
      </nav>

      <h1 style={{ fontFamily: "'Sora', sans-serif", fontWeight: 800, fontSize: "2rem", marginBottom: "0.5rem" }}>
        Privacy Policy
      </h1>
      <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", marginBottom: "2rem" }}>
        {"Last updated: " + lastUpdated}
      </p>

      <div style={{ fontSize: "0.9375rem", color: "var(--text-secondary)", lineHeight: 1.85 }}>
        <Section title="Overview">
          <p>
            {"TrackAura (\u201Cwe\u201D, \u201Cour\u201D, \u201Cus\u201D) operates trackaura.com. " +
            "This page explains what data we collect, why we collect it, and how we protect it. " +
            "We respect your privacy and keep things simple \u2014 we collect as little as possible."}
          </p>
        </Section>

        <Section title="What We Collect">
          <p style={{ marginBottom: "0.75rem" }}>
            <strong style={{ color: "var(--text-primary)" }}>Email addresses</strong>
            {" \u2014 only if you voluntarily sign up for our newsletter or set a price alert. " +
            "We use your email solely to send you the alerts or updates you requested."}
          </p>
          <p style={{ marginBottom: "0.75rem" }}>
            <strong style={{ color: "var(--text-primary)" }}>Analytics data</strong>
            {" \u2014 we use Google Analytics to understand how visitors use our site. " +
            "This includes anonymous data such as pages visited, time on site, browser type, and general location. " +
            "This data is aggregated and does not personally identify you."}
          </p>
          <p>
            <strong style={{ color: "var(--text-primary)" }}>Cookies</strong>
            {" \u2014 Google Analytics uses cookies to track site usage. " +
            "We do not use cookies for advertising or tracking you across other websites."}
          </p>
        </Section>

        <Section title="How We Use Your Data">
          <p>
            {"We use your data to: send price alert emails you\u2019ve requested, " +
            "send newsletter updates if you\u2019ve subscribed, " +
            "and understand how people use TrackAura so we can improve it. " +
            "We do not sell, rent, or share your personal information with third parties."}
          </p>
        </Section>

        <Section title="Affiliate Links">
          <p>
            {"TrackAura contains affiliate links to Amazon.ca and may include links to other retailers. " +
            "When you click these links and make a purchase, we may earn a small commission at no extra cost to you. " +
            "These affiliate partnerships do not influence the prices we display \u2014 all prices come directly from each retailer\u2019s website."}
          </p>
        </Section>

        <Section title="Data Storage">
          <p>
            {"Email addresses for price alerts and newsletter signups are stored securely using Supabase, " +
            "a trusted cloud database provider. We do not store payment information or passwords, " +
            "as TrackAura does not require accounts or process transactions."}
          </p>
        </Section>

        <Section title="Your Rights">
          <p>
            {"You can unsubscribe from emails at any time by clicking the unsubscribe link in any email we send. " +
            "If you want your email address deleted from our database entirely, " +
            "contact us at admin@trackaura.com and we\u2019ll remove it promptly."}
          </p>
        </Section>

        <Section title="Children\u2019s Privacy">
          <p>
            {"TrackAura is not directed at children under 13. " +
            "We do not knowingly collect personal information from children."}
          </p>
        </Section>

        <Section title="Changes to This Policy">
          <p>
            {"We may update this privacy policy from time to time. " +
            "Any changes will be posted on this page with an updated date."}
          </p>
        </Section>

        <Section title="Contact">
          <p>
            {"If you have any questions about this privacy policy, contact us at "}
            <a href="mailto:admin@trackaura.com" className="accent-link">admin@trackaura.com</a>.
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

