import { AMAZON_AFFILIATE_TAG } from "@/types";

// Rakuten Advertising — Newegg Canada program
export const RAKUTEN_MID = "44583";
export const RAKUTEN_SID = "4674140";

export function formatPrice(price: number): string {
  return `$${price.toFixed(2)}`;
}

/**
 * Build a clean Amazon search query from a product name.
 * Strips marketing fluff, keeps brand + model + key specs.
 */
function buildAmazonQuery(productName: string): string {
  let q = productName;

  // Remove parenthesized part numbers: (MZ-VAP2T0B/AM)
  q = q.replace(/\s*\([A-Z0-9][A-Z0-9\-\/\.]{4,}\)\s*$/i, "");

  // Remove "Refurbished" prefix
  q = q.replace(/^Refurbished\s*/i, "");

  // Remove everything after common spec dumps
  q = q.replace(/,?\s*PCI\s*Express.*$/i, "");
  q = q.replace(/,?\s*PCIe.*$/i, "");
  q = q.replace(/,?\s*SATA\s*(III|6).*$/i, "");
  q = q.replace(/,?\s*Seq\.?\s*Read.*$/i, "");
  q = q.replace(/,?\s*Up\s+to\s+[\d,]+\s*MB\/s.*$/i, "");
  q = q.replace(/,?\s*Best\s+for\s+.*$/i, "");
  q = q.replace(/,?\s*with\s+(Height\s+)?Adjustable.*$/i, "");
  q = q.replace(/,?\s*for\s+(Work|Gaming|Home|Office).*$/i, "");
  q = q.replace(/,?\s*Non-Slip.*$/i, "");
  q = q.replace(/,?\s*with\s+Stitched.*$/i, "");

  // Remove filler words
  const fillerWords = [
    "Desktop", "Processor", "Graphics Card", "Video Card",
    "Internal Solid State Drive", "Internal SSD",
    "Wired", "Wireless", "OC Edition", "OC",
    "Edition", "ATX", "mATX", "Mini-ITX",
  ];
  for (const word of fillerWords) {
    q = q.replace(new RegExp(`\\b${word}\\b`, "gi"), " ");
  }

  // Clean up
  q = q.replace(/\s+/g, " ").replace(/[\s,\-]+$/, "").trim();

  // Cap at 60 chars — shorter queries match better on Amazon
  if (q.length > 60) {
    q = q.slice(0, 60);
    const lastSpace = q.lastIndexOf(" ");
    if (lastSpace > 20) q = q.slice(0, lastSpace);
    q = q.replace(/[\s,\-]+$/, "");
  }

  return q;
}

export function getAmazonSearchUrl(productName: string): string {
  const query = encodeURIComponent(buildAmazonQuery(productName));
  return `https://www.amazon.ca/s?k=${query}&tag=${AMAZON_AFFILIATE_TAG}`;
}

/**
 * Build a Rakuten deeplink for Newegg Canada.
 * Format: https://click.linksynergy.com/deeplink?id=SID&mid=MID&murl=ENCODED_PRODUCT_URL
 */
export function getNeweggAffiliateUrl(productUrl: string): string {
  const encoded = encodeURIComponent(productUrl);
  return `https://click.linksynergy.com/deeplink?id=${RAKUTEN_SID}&mid=${RAKUTEN_MID}&murl=${encoded}`;
}

export function getRetailerAffiliateUrl(product: { url: string; retailer: string }): string {
  if (product.retailer === "Newegg Canada") {
    return getNeweggAffiliateUrl(product.url);
  }
  // Canada Computers + Vuugo — no affiliate yet, link directly
  return product.url;
}
