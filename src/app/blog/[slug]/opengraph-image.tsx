import { ImageResponse } from "next/og";
import fs from "fs";
import path from "path";

// Next.js picks these up automatically and serves the image at
// /blog/[slug]/opengraph-image. It also injects the correct
// <meta property="og:image"> tag into the page's <head>, so
// page.tsx and generateMetadata don't need to change.

export const alt = "TrackAura - Canadian electronics price tracking";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 14400; // 4h

type Props = { params: Promise<{ slug: string }> };

interface BlogPost {
  slug: string;
  title: string;
  description: string;
  date: string;
  category: string;
  content: string[];
}

function getPost(slug: string): BlogPost | undefined {
  try {
    const filePath = path.join(process.cwd(), "public", "data", "blog-posts.json");
    const raw = fs.readFileSync(filePath, "utf-8");
    const posts: BlogPost[] = JSON.parse(raw);
    return posts.find((p) => p.slug === slug);
  } catch {
    return undefined;
  }
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1).trimEnd() + "\u2026" : s;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso + "T00:00:00").toLocaleDateString("en-CA", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

// --- Design tokens (hard-coded; satori does not read CSS vars) ---
const BG = "#0a0a0f";
const BG_FOOTER = "#050508";
const BORDER = "#1f1f2a";
const TEXT = "#ffffff";
const TEXT_DIM = "#8b8b95";
const ACCENT = "#10b981";
const ACCENT_BG = "rgba(16,185,129,0.15)";

export default async function OGImage({ params }: Props) {
  const { slug } = await params;
  const post = getPost(slug);

  // Fallback card when slug doesn't resolve (stale share links etc.)
  if (!post) {
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

  // Dynamic title sizing -- shorter titles get more visual weight.
  // Longest observed title is 75 chars; 56px at ~90 chars per line
  // gives safe 2-line layout with room for the em-dash punctuation.
  const titleLen = post.title.length;
  const titleFontSize =
    titleLen <= 40 ? 96 :
    titleLen <= 70 ? 72 :
    56;
  const titleLetterSpacing =
    titleLen <= 40 ? -3 :
    titleLen <= 70 ? -2 :
    -1;

  const title = truncate(post.title, 120);
  const description = truncate(post.description, 160);

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
              background: ACCENT_BG,
              color: ACCENT,
              border: `1px solid ${ACCENT}`,
              fontSize: 18,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: 1,
            }}
          >
            {post.category}
          </div>
        </div>

        {/* Body */}
        <div
          style={{
            display: "flex",
            flex: 1,
            flexDirection: "column",
            padding: "48px 64px",
            gap: 28,
            justifyContent: "center",
          }}
        >
          {/* Title */}
          <div
            style={{
              display: "flex",
              fontSize: titleFontSize,
              fontWeight: 800,
              lineHeight: 1.1,
              letterSpacing: titleLetterSpacing,
              color: TEXT,
            }}
          >
            {title}
          </div>

          {/* Description */}
          <div
            style={{
              display: "flex",
              fontSize: 24,
              lineHeight: 1.4,
              color: TEXT_DIM,
            }}
          >
            {description}
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
              gap: 12,
              fontSize: 20,
              color: TEXT_DIM,
            }}
          >
            <div style={{ display: "flex", color: TEXT, fontWeight: 600 }}>
              {formatDate(post.date)}
            </div>
            <div style={{ display: "flex" }}>
              {"\u00B7 Canadian electronics price tracking"}
            </div>
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
