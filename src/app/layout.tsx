import type { Metadata } from "next";
import Script from "next/script";
import { Sora, DM_Sans } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

// Self-host Sora and DM Sans via next/font.
// This replaces the render-blocking @import in globals.css, removing 2-3
// network round-trips from the critical path. Next.js inlines font CSS
// and preloads .woff2 files, so text renders ~300-500ms faster on mobile.
// CSS variables keep the existing `font-family: 'Sora'` references working
// in globals.css and inline styles throughout the app.
const sora = Sora({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sora",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-dm-sans",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.trackaura.com"),
  title: {
    default: "TrackAura — Canadian Electronics Price Tracker",
    template: "%s | TrackAura",
  },
  description:
    "Track price history for GPUs, CPUs, RAM, monitors, laptops, and more across Canadian retailers. Compare prices at Canada Computers, Newegg Canada, and Amazon.ca. Never overpay.",
  keywords: [
    "Canadian electronics price tracker",
    "Canada Computers prices",
    "Newegg Canada prices",
    "GPU price history Canada",
    "CPU price history Canada",
    "RAM prices Canada",
    "monitor prices Canada",
    "laptop deals Canada",
    "SSD price history Canada",
    "price comparison Canada",
    "electronics deals Canada",
    "price drop alert Canada",
    "best electronics prices Canada",
    "motherboard prices Canada",
    "power supply prices Canada",
  ],
  openGraph: {
    title: "TrackAura — Canadian Electronics Price Tracker",
    description:
      "Track price history for GPUs, CPUs, RAM, monitors, laptops, and more across Canadian retailers. Never overpay.",
    siteName: "TrackAura",
    locale: "en_CA",
    type: "website",
    url: "https://www.trackaura.com",
  },
  twitter: {
    card: "summary_large_image",
    title: "TrackAura — Canadian Electronics Price Tracker",
    description:
      "Track price history across Canadian electronics retailers. Compare prices and find the best deals.",
  },
  alternates: {
    canonical: "https://www.trackaura.com",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${sora.variable} ${dmSans.variable}`}>
      <head>
        <meta
          name="impact-site-verification"
          content="c001a43a-bc75-4c79-91a3-7d18227c42e5"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: "TrackAura",
              url: "https://www.trackaura.com",
              description:
                "Canadian electronics price tracking across multiple retailers.",
              potentialAction: {
                "@type": "SearchAction",
                target: {
                  "@type": "EntryPoint",
                  urlTemplate:
                    "https://www.trackaura.com/products?search={search_term_string}",
                },
                "query-input": "required name=search_term_string",
              },
            }),
          }}
        />
      </head>
      <body className="noise-bg">
        <Header />
        <main style={{ minHeight: "calc(100vh - 200px)" }}>{children}</main>
        <Footer />

        {/*
          GTM deferred with lazyOnload: fires after the browser is idle
          post-load, keeping ~150 KiB off the critical path.
        */}
        <Script
          id="gtag-src"
          src="https://www.googletagmanager.com/gtag/js?id=G-TDTJZ8L61H"
          strategy="lazyOnload"
        />
        <Script id="gtag-init" strategy="lazyOnload">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-TDTJZ8L61H');
          `}
        </Script>
      </body>
    </html>
  );
}
