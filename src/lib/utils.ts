import { AMAZON_AFFILIATE_TAG } from "@/types";

export function formatPrice(price: number): string {
  return `$${price.toFixed(2)}`;
}

export function getAmazonSearchUrl(productName: string): string {
  const query = encodeURIComponent(productName);
  return `https://www.amazon.ca/s?k=${query}&tag=${AMAZON_AFFILIATE_TAG}`;
}