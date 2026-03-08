import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: {
    default: "TrackAura — Canadian Electronics Price Tracker",
    template: "%s | TrackAura",
  },
  description:
    "Track price history for headphones, GPUs, and SSDs across Canadian retailers. Compare prices at Canada Computers, Newegg Canada, and Amazon.ca. Never overpay for electronics.",
  keywords: [
    "Canadian electronics price tracker",
    "Canada Computers prices",
    "Newegg Canada prices",
    "GPU price history Canada",
    "SSD price history Canada",
    "headphone price tracker",
    "price comparison Canada",
  ],
  openGraph: {
    title: "TrackAura — Canadian Electronics Price Tracker",
    description: "Track price history across Canadian electronics retailers.",
    siteName: "TrackAura",
    locale: "en_CA",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="noise-bg">
        <Header />
        <main style={{ minHeight: "calc(100vh - 200px)" }}>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
