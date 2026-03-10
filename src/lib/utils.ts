import { AMAZON_AFFILIATE_TAG } from "@/types";

export const RAKUTEN_AFFILIATE_ID = "jlyoivMwGNs";
export const NEWEGG_MERCHANT_ID = "1786142";

export function formatPrice(price: number): string {
  return `$${price.toFixed(2)}`;
}

export function getAmazonSearchUrl(productName: string): string {
  const query = encodeURIComponent(productName);
  return `https://www.amazon.ca/s?k=${query}&tag=${AMAZON_AFFILIATE_TAG}`;
}

export function getNeweggAffiliateUrl(productUrl: string): string {
  const encoded = encodeURIComponent(productUrl);
  return `https://click.linksynergy.com/deeplink?id=${RAKUTEN_AFFILIATE_ID}&mid=${NEWEGG_MERCHANT_ID}&murl=${encoded}`;
}

export function getRetailerAffiliateUrl(product: { url: string; retailer: string }): string {
  if (product.retailer === "Newegg Canada") {
    return getNeweggAffiliateUrl(product.url);
  }
  // Canada Computers — no affiliate yet, link directly
  return product.url;
}
