import { ImageResponse } from "next/og";
import { getProductBySlug, getPriceHistory } from "@/lib/data";
import { CATEGORY_LABELS, CATEGORY_ICONS } from "@/types";

// Next.js picks these up automatically and serves the image at
// /product/[slug]/opengraph-image. It also injects the correct
// <meta property="og:image"> tag into the page's <head>, so
// page.tsx and generateMetadata don't need to change.

export const alt = "TrackAura - Canadian electronics price tracking";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 14400; // 4h, matches product page

type Props = { params: Promise<{ slug: string }> };

const BRANDS = [
  "samsung", "intel", "amd", "nvidia", "asus", "msi", "gigabyte",
  "corsair", "kingston", "crucial", "western", "seagate", "noctua",
  "logitech", "razer", "steelseries", "hyperx", "cooler master",
  "nzxt", "evga", "sapphire", "asrock", "biostar", "zotac",
  "pny", "patriot", "gskill", "g.skill", "team", "thermaltake",
  "be quiet", "fractal", "lian", "phanteks", "deepcool", "arctic",
  "acer", "dell", "lenovo", "benq", "viewsonic", "lg", "sony",
  "jbl", "sennheiser", "audio-technica", "shokz", "maxell",
  "edifier", "bose", "beats", "anker", "soundcore", "skullcandy",
  "jabra", "1more", "creative", "hifiman", "fiio",
  "tp-link", "netgear", "linksys", "dlink", "ubiquiti",
  "western digital", "wd", "sandisk", "hynix", "micron",
  "roccat", "redragon", "keychron", "ducky", "anne",
  "antec", "montech", "lga", "ryzen", "geforce", "radeon",
];

function extractBrand(name: string): string | null {
  const lower = name.toLowerCase();
  const sorted = [...BRANDS].sort((a, b) => b.length - a.length);
  for (const b of sorted) {
    if (lower.includes(b)) return b;
  }
  return null;
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function fmt(n: number): string {
  return "$" + n.toLocaleString("en-CA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1).trimEnd() + "…" : s;
}

// Fetch retailer image server-side with a browser-like UA, decode to
// something Satori can render, and inline as a base64 data URL.
//
// Satori natively supports jpeg/png/gif only. Newegg's CDN ignores
// Accept headers and always serves WebP, so we run those through sharp
// (bundled with Next.js 16) to get a PNG. Any failure in this pipeline
// resolves to null and triggers the category-icon fallback.
async function loadImageAsDataUrl(
  url: string | null | undefined
): Promise<string | null> {
  if (!url || typeof url !== "string") return null;
  if (!/^https?:\/\//i.test(url)) return null;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        Accept: "image/jpeg,image/png,image/gif;q=0.9,*/*;q=0.1",
      },
    });
    clearTimeout(timeoutId);
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") || "";
    if (!ct.startsWith("image/")) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength === 0) return null;

    // Fast path: format is already supported by Satori
    if (/image\/(jpeg|jpg|png|gif)/i.test(ct)) {
      return `data:${ct};base64,${buf.toString("base64")}`;
    }

    // Decode path: WebP/AVIF must be converted to PNG via sharp.
    // Dynamic import so a missing sharp install still lets the OG
    // route serve icon-fallback images rather than 500.
    if (/image\/(webp|avif)/i.test(ct)) {
      try {
        const sharpMod = await import("sharp");
        const sharp = sharpMod.default;
        const pngBuf = await sharp(buf).png().toBuffer();
        return `data:image/png;base64,${pngBuf.toString("base64")}`;
      } catch (err) {
        console.error("[og] sharp decode failed:", err);
        return null;
      }
    }

    return null;
  } catch (err) {
    console.error("[og] image fetch failed:", err);
    return null;
  }
}

// --- Design tokens (hard-coded; satori does not read CSS vars) ---
const BG = "#0a0a0f";
const BG_CARD = "#13131a";
const BG_FOOTER = "#050508";
const BORDER = "#1f1f2a";
const BORDER_STRONG = "#2a2a35";
const TEXT = "#ffffff";
const TEXT_DIM = "#8b8b95";
const ACCENT = "#10b981";
const ACCENT_BG = "rgba(16,185,129,0.15)";
const DANGER = "#ef4444";
const DANGER_BG = "rgba(239,68,68,0.15)";
const CC_RED = "#cc0000";
const NEWEGG_ORANGE = "#f8a30e";

export default async function OGImage({ params }: Props) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  // Fallback card when slug doesn't resolve (stale share links etc.)
  if (!product) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: BG,
            color: TEXT,
            fontFamily: "sans-serif",
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 72,
              fontWeight: 800,
              letterSpacing: -2,
            }}
          >
            <span style={{ color: ACCENT }}>Track</span>
            <span>Aura</span>
          </div>
          <div style={{ fontSize: 28, color: TEXT_DIM, marginTop: 16 }}>
            Canadian electronics price tracking
          </div>
        </div>
      ),
      { ...size }
    );
  }

  // Run image fetch in parallel with history query
  const [history, imageDataUrl] = await Promise.all([
    getPriceHistory(product.id),
    loadImageAsDataUrl(product.imageUrl),
  ]);

  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const recentPrices = history
    .filter((h) => new Date(h.date).getTime() >= thirtyDaysAgo)
    .map((h) => h.price);
  const thirtyDayMedian = recentPrices.length >= 2 ? median(recentPrices) : null;
  const medianDelta = thirtyDayMedian
    ? ((product.currentPrice - thirtyDayMedian) / thirtyDayMedian) * 100
    : null;

  const isAtLowest = product.currentPrice <= product.minPrice && product.priceCount > 1;
  const hasRange = product.minPrice < product.maxPrice;
  const brand = extractBrand(product.name);
  const retailerColor =
    product.retailer === "Canada Computers" ? CC_RED : NEWEGG_ORANGE;
  const catLabel = CATEGORY_LABELS[product.category] || product.category;
  const catIcon = CATEGORY_ICONS[product.category] || "📦";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: BG,
          color: TEXT,
          fontFamily: "sans-serif",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "28px 48px",
            borderBottom: `1px solid ${BORDER}`,
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 34,
              fontWeight: 800,
              letterSpacing: -1,
            }}
          >
            <span style={{ color: ACCENT }}>Track</span>
            <span>Aura</span>
          </div>
          <div
            style={{
              display: "flex",
              padding: "8px 16px",
              borderRadius: 6,
              background: retailerColor,
              color: "#ffffff",
              fontSize: 18,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: 1,
            }}
          >
            {product.retailer}
          </div>
        </div>

        {/* Body */}
        <div
          style={{
            display: "flex",
            flex: 1,
            padding: "36px 48px",
            gap: 40,
            alignItems: "center",
          }}
        >
          {/* Image / icon */}
          <div
            style={{
              display: "flex",
              width: 300,
              height: 300,
              alignItems: "center",
              justifyContent: "center",
              background: BG_CARD,
              borderRadius: 16,
              border: `1px solid ${BORDER_STRONG}`,
              flexShrink: 0,
              overflow: "hidden",
            }}
          >
            {imageDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageDataUrl}
                alt=""
                width={260}
                height={260}
                style={{ objectFit: "contain" }}
              />
            ) : (
              <div style={{ fontSize: 140, display: "flex" }}>{catIcon}</div>
            )}
          </div>

          {/* Text column */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flex: 1,
              gap: 10,
              minWidth: 0,
            }}
          >
            {/* Category + brand */}
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  display: "flex",
                  fontSize: 18,
                  color: ACCENT,
                  textTransform: "uppercase",
                  letterSpacing: 2,
                  fontWeight: 700,
                }}
              >
                {catLabel}
              </div>
              {brand && (
                <div
                  style={{
                    display: "flex",
                    fontSize: 18,
                    color: TEXT_DIM,
                    textTransform: "uppercase",
                    letterSpacing: 2,
                  }}
                >
                  · {brand}
                </div>
              )}
            </div>

            {/* Name */}
            <div
              style={{
                display: "flex",
                fontSize: 38,
                fontWeight: 700,
                lineHeight: 1.15,
                letterSpacing: -0.5,
                maxHeight: 140,
                overflow: "hidden",
              }}
            >
              {truncate(product.name, 90)}
            </div>

            {/* Price + delta */}
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 18,
                marginTop: 8,
              }}
            >
              <div
                style={{
                  display: "flex",
                  fontSize: 84,
                  fontWeight: 800,
                  letterSpacing: -3,
                  color: ACCENT,
                  lineHeight: 1,
                }}
              >
                {fmt(product.currentPrice)}
              </div>
              {medianDelta !== null && Math.abs(medianDelta) >= 0.5 && (
                <div
                  style={{
                    display: "flex",
                    padding: "6px 14px",
                    borderRadius: 6,
                    background: medianDelta < 0 ? ACCENT_BG : DANGER_BG,
                    color: medianDelta < 0 ? ACCENT : DANGER,
                    fontSize: 22,
                    fontWeight: 700,
                  }}
                >
                  {medianDelta < 0 ? "▼" : "▲"} {Math.abs(medianDelta).toFixed(1)}% vs 30d
                </div>
              )}
            </div>

            {/* Range */}
            {hasRange && (
              <div
                style={{
                  display: "flex",
                  gap: 28,
                  marginTop: 6,
                  fontSize: 20,
                  color: TEXT_DIM,
                }}
              >
                <div style={{ display: "flex", gap: 6 }}>
                  Low:
                  <span style={{ color: ACCENT, fontWeight: 700 }}>
                    {fmt(product.minPrice)}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  High:
                  <span style={{ color: DANGER, fontWeight: 700 }}>
                    {fmt(product.maxPrice)}
                  </span>
                </div>
                <div style={{ display: "flex" }}>
                  {product.priceCount} data points
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "22px 48px",
            borderTop: `1px solid ${BORDER}`,
            background: BG_FOOTER,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              fontSize: 20,
              color: TEXT_DIM,
            }}
          >
            {isAtLowest ? (
              <div style={{ display: "flex", color: ACCENT, fontWeight: 700 }}>
                Lowest price we've tracked
              </div>
            ) : (
              <div style={{ display: "flex" }}>
                Canadian electronics price tracking · live data
              </div>
            )}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 20,
              color: TEXT,
              fontWeight: 600,
            }}
          >
            trackaura.com
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      emoji: "twemoji",
    }
  );
}
