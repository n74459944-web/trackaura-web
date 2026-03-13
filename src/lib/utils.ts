import { AMAZON_AFFILIATE_TAG } from "@/types";

export const RAKUTEN_AFFILIATE_ID = "jlyoivMwGNs";
export const NEWEGG_MERCHANT_ID = "1786142";

export function formatPrice(price: number): string {
  return `$${price.toFixed(2)}`;
}

/**
 * Build a clean Amazon search query from a product name.
 * Strips marketing fluff, keeps brand + model + key specs.
 */
function buildAmazonQuery(productName: string): string {
  let q = productName;

  // Remove parenthesized part numbers at the end: (MZ-VAP2T0B/AM), (BX8071512400)
  q = q.replace(/\s*\([A-Z0-9][A-Z0-9\-\/\.]{4,}\)\s*$/i, "");

  // Remove common marketing phrases
  q = q.replace(/,?\s*Best for\s+.*/i, "");
  q = q.replace(/,?\s*Seq\.?\s*Read\s+Speeds?\s+Up\s+to\s+[\d,]+\s*MB\/s/i, "");
  q = q.replace(/,?\s*Up\s+to\s+[\d,]+\s*MB\/s/i, "");
  q = q.replace(/,?\s*with\s+(Height\s+)?Adjustable.*$/i, "");
  q = q.replace(/,?\s*for\s+Work\/Game\/Office.*$/i, "");
  q = q.replace(/,?\s*for\s+Gaming\s*&\s*Home\s+Office.*$/i, "");
  q = q.replace(/,?\s*with\s+Stitched\s+Edge.*$/i, "");
  q = q.replace(/,?\s*Non-Slip\s+Rubber\s+Base.*$/i, "");

  // Remove filler words that hurt search precision
  const fillerWords = [
    "Desktop", "Processor", "Graphics Card",
    "Internal Solid State Drive",
    "Wired", "Wireless",
  ];
  for (const word of fillerWords) {
    q = q.replace(new RegExp(`\\b${word}\\b`, "gi"), " ");
  }

  // Remove "Refurbished" prefix
  q = q.replace(/^Refurbished\s*/i, "");

  // Clean up extra spaces and trailing punctuation
  q = q.replace(/\s+/g, " ").replace(/[\s,\-]+$/, "").trim();

  // If still too long (>80 chars), take the first ~80 chars at a word boundary
  if (q.length > 80) {
    q = q.slice(0, 80);
    const lastSpace = q.lastIndexOf(" ");
    if (lastSpace > 30) q = q.slice(0, lastSpace);
    q = q.replace(/[\s,\-]+$/, "");
  }

  return q;
}

export function getAmazonSearchUrl(productName: string): string {
  const query = encodeURIComponent(buildAmazonQuery(productName));
  return `https://www.amazon.ca/s?k=${query}&tag=${AMAZON_AFFILIATE_TAG}`;
}

export function getNeweggAffiliateUrl(productUrl: string): string {
  // Rakuten affiliate terminated — link directly for now
  return productUrl;
}

export function getRetailerAffiliateUrl(product: { url: string; retailer: string }): string {
  if (product.retailer === "Newegg Canada") {
    return getNeweggAffiliateUrl(product.url);
  }
  // Canada Computers — no affiliate yet, link directly
  return product.url;
}
