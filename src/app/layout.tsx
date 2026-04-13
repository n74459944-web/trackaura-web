import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

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
    <html lang="en">
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
          Google Tag Manager loaded with strategy="lazyOnload".
          This defers GA/GTM until the browser is idle after page load,
          removing ~150 KiB of JS from the critical path and cutting
          ~200-400ms of main-thread blocking time.
          Analytics still fires — just after the user can interact.
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
