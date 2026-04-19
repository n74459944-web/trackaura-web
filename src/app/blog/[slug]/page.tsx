import React from "react";
import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import fs from "fs";
import path from "path";

interface BlogPost {
  slug: string;
  title: string;
  description: string;
  date: string;
  category: string;
  content: string[];
}

function getPosts(): BlogPost[] {
  try {
    const filePath = path.join(process.cwd(), "public", "data", "blog-posts.json");
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function getPost(slug: string): BlogPost | undefined {
  return getPosts().find((p) => p.slug === slug);
}

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) return { title: "Not Found" };

  return {
    title: post.title,
    description: post.description,
    openGraph: {
      title: post.title,
      description: post.description,
      type: "article",
      url: "https://www.trackaura.com/blog/" + slug,
      siteName: "TrackAura",
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.description,
    },
    alternates: { canonical: "https://www.trackaura.com/blog/" + slug },
  };
}

// -----------------------------------------------------------------------
// Content rendering
//
// Each entry in post.content is treated as a "section". Inside a section
// we support:
//   - Full-line H2 headers:       "## Heading"
//   - Paragraph breaks:           separated by blank line ("\n\n")
//   - Unordered lists:            block of lines each starting with "- "
//   - Inline bold:                "**bold**"
//   - Inline markdown links:      "[text](url)"
// Anything not matching the above renders as plain paragraph text with
// "\n" treated as a soft line break within the paragraph.
// -----------------------------------------------------------------------

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  // Combined regex catches **bold** or [text](url); anything else stays
  // as a plain text segment between matches.
  const combined = /\*\*(.+?)\*\*|\[([^\]]+?)\]\(([^)]+?)\)/g;
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let i = 0;
  let match: RegExpExecArray | null;

  while ((match = combined.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(
        <span key={keyPrefix + "-t" + i++}>
          {text.slice(lastIndex, match.index)}
        </span>
      );
    }
    if (match[1] !== undefined) {
      nodes.push(
        <strong key={keyPrefix + "-b" + i++} style={{ color: "var(--text-primary)" }}>
          {match[1]}
        </strong>
      );
    } else if (match[2] !== undefined && match[3] !== undefined) {
      const href = match[3];
      const linkText = match[2];
      // Use Next's Link for internal routes, plain <a> for external
      if (href.startsWith("/")) {
        nodes.push(
          <Link key={keyPrefix + "-l" + i++} href={href} className="accent-link">
            {linkText}
          </Link>
        );
      } else {
        nodes.push(
          <a
            key={keyPrefix + "-l" + i++}
            href={href}
            className="accent-link"
            target="_blank"
            rel="noopener noreferrer"
          >
            {linkText}
          </a>
        );
      }
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    nodes.push(<span key={keyPrefix + "-t" + i++}>{text.slice(lastIndex)}</span>);
  }
  return nodes;
}

function renderBlock(block: string, keyPrefix: string): React.ReactElement {
  const lines = block.split("\n");
  const isList = lines.length > 0 && lines.every((l) => /^[-*]\s+/.test(l));

  if (isList) {
    return (
      <ul
        key={keyPrefix}
        style={{
          color: "var(--text-secondary)",
          fontSize: "0.9375rem",
          lineHeight: 1.8,
          marginBottom: "1rem",
          paddingLeft: "1.25rem",
        }}
      >
        {lines.map((line, i) => (
          <li key={keyPrefix + "-li" + i} style={{ marginBottom: "0.375rem" }}>
            {renderInline(line.replace(/^[-*]\s+/, ""), keyPrefix + "-li" + i)}
          </li>
        ))}
      </ul>
    );
  }

  // Paragraph: preserve soft line breaks within the block
  return (
    <p
      key={keyPrefix}
      style={{
        color: "var(--text-secondary)",
        fontSize: "0.9375rem",
        lineHeight: 1.8,
        marginBottom: "1rem",
      }}
    >
      {lines.map((line, i) => (
        <React.Fragment key={keyPrefix + "-ln" + i}>
          {i > 0 && <br />}
          {renderInline(line, keyPrefix + "-ln" + i)}
        </React.Fragment>
      ))}
    </p>
  );
}

function renderContent(line: string, sectionIndex: number): React.ReactNode {
  // Whole-line H2 header
  if (line.startsWith("## ")) {
    return (
      <h2
        key={"sec" + sectionIndex}
        style={{
          fontFamily: "'Sora', sans-serif",
          fontWeight: 700,
          fontSize: "1.125rem",
          color: "var(--text-primary)",
          marginTop: "1.75rem",
          marginBottom: "0.75rem",
        }}
      >
        {line.slice(3)}
      </h2>
    );
  }

  // Split into blocks on blank lines, then render each block
  const blocks = line.split(/\n\s*\n/);
  return (
    <React.Fragment key={"sec" + sectionIndex}>
      {blocks.map((block, i) =>
        renderBlock(block, "sec" + sectionIndex + "-b" + i)
      )}
    </React.Fragment>
  );
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();

  const allPosts = getPosts().filter((p) => p.slug !== slug);

  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: post.title,
      description: post.description,
      datePublished: post.date,
      dateModified: post.date,
      author: { "@type": "Organization", name: "TrackAura" },
      publisher: { "@type": "Organization", name: "TrackAura", url: "https://www.trackaura.com" },
      mainEntityOfPage: "https://www.trackaura.com/blog/" + slug,
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: "https://www.trackaura.com" },
        { "@type": "ListItem", position: 2, name: "Blog", item: "https://www.trackaura.com/blog" },
        { "@type": "ListItem", position: 3, name: post.title },
      ],
    },
  ];

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "2rem 1.5rem" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />

      <nav style={{ display: "flex", gap: "0.5rem", fontSize: "0.8125rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
        <Link href="/" className="accent-link">Home</Link>
        <span style={{ color: "var(--text-secondary)" }}>/</span>
        <Link href="/blog" className="accent-link">Blog</Link>
        <span style={{ color: "var(--text-secondary)" }}>/</span>
        <span style={{ color: "var(--text-secondary)" }}>
          {post.title.length > 50 ? post.title.slice(0, 50) + "\u2026" : post.title}
        </span>
      </nav>

      <article>
        <div style={{ marginBottom: "2rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
            <span style={{ fontSize: "0.6875rem", color: "var(--accent)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {post.category}
            </span>
            <span style={{ fontSize: "0.6875rem", color: "var(--text-secondary)" }}>
              {new Date(post.date).toLocaleDateString("en-CA", { month: "long", day: "numeric", year: "numeric" })}
            </span>
          </div>
          <h1 style={{ fontFamily: "'Sora', sans-serif", fontWeight: 800, fontSize: "1.75rem", lineHeight: 1.3, marginBottom: "0.75rem" }}>
            {post.title}
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "1rem", lineHeight: 1.6 }}>
            {post.description}
          </p>
        </div>

        <div style={{ borderTop: "1px solid var(--border)", paddingTop: "1.5rem" }}>
          {post.content.map((line, i) => renderContent(line, i))}
        </div>
      </article>

      {/* CTA */}
      <div className="card" style={{ padding: "1.5rem", marginTop: "2rem", marginBottom: "1.5rem", textAlign: "center" }}>
        <p style={{ fontFamily: "'Sora', sans-serif", fontWeight: 600, fontSize: "1rem", marginBottom: "0.5rem" }}>
          Start Tracking Prices
        </p>
        <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", marginBottom: "1rem" }}>
          Browse products, check price history, and set alerts so you never overpay.
        </p>
        <Link href="/products" className="btn-primary" style={{ textDecoration: "none", display: "inline-block" }}>
          Browse Products
        </Link>
      </div>

      {/* Other posts */}
      {allPosts.length > 0 && (
        <div style={{ marginTop: "2rem" }}>
          <h2 style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: "1.125rem", marginBottom: "1rem" }}>
            More from the Blog
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {allPosts.map((p) => (
              <Link
                key={p.slug}
                href={"/blog/" + p.slug}
                className="card"
                style={{ padding: "1rem 1.25rem", textDecoration: "none", display: "block" }}
              >
                <p style={{ fontFamily: "'Sora', sans-serif", fontWeight: 600, fontSize: "0.9375rem", color: "var(--text-primary)", marginBottom: "0.25rem" }}>
                  {p.title}
                </p>
                <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                  {p.category + " \u00B7 " + new Date(p.date).toLocaleDateString("en-CA", { month: "long", day: "numeric", year: "numeric" })}
                </p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
