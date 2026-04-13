import { Metadata } from "next";
import Link from "next/link";
import fs from "fs";
import path from "path";


export const revalidate = 14400;
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

export const metadata: Metadata = {
  title: "Blog",
  description: "Price tracking insights, buying guides, and deal analysis for Canadian electronics shoppers. Real data from TrackAura.",
  alternates: { canonical: "https://www.trackaura.com/blog" },
};

export default function BlogPage() {
  const posts = getPosts();

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "2rem 1.5rem" }}>
      <h1 style={{ fontFamily: "'Sora', sans-serif", fontWeight: 800, fontSize: "1.75rem", marginBottom: "0.5rem" }}>
        TrackAura Blog
      </h1>
      <p style={{ color: "var(--text-secondary)", fontSize: "0.9375rem", marginBottom: "2rem", lineHeight: 1.6 }}>
        Price tracking insights, buying guides, and deal analysis for Canadian electronics.
      </p>

      {posts.length === 0 ? (
        <p style={{ color: "var(--text-secondary)" }}>No posts yet. Check back soon.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {posts.map((post) => (
            <Link
              key={post.slug}
              href={"/blog/" + post.slug}
              className="card"
              style={{ padding: "1.5rem", textDecoration: "none", display: "block" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
                <span style={{ fontSize: "0.6875rem", color: "var(--accent)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {post.category}
                </span>
                <span style={{ fontSize: "0.6875rem", color: "var(--text-secondary)" }}>
                  {new Date(post.date).toLocaleDateString("en-CA", { month: "long", day: "numeric", year: "numeric" })}
                </span>
              </div>
              <h2 style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: "1.125rem", color: "var(--text-primary)", marginBottom: "0.375rem" }}>
                {post.title}
              </h2>
              <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", lineHeight: 1.6 }}>
                {post.description}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

