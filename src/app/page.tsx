import Link from 'next/link';
import SearchBar from '@/components/SearchBar';
import EmailSignup from '@/components/EmailSignup';
import {
  getHomeStats,
  getHomeCategories,
  getFeaturedDeals,
  getRecentDrops,
  type HomeFeaturedProduct,
} from '@/lib/queries/home';
import { CATEGORY_LABELS, CATEGORY_ICONS } from '@/types';

// Re-render every 15 minutes. Homepage doesn't need per-minute freshness.
export const revalidate = 900;

const fmtPrice = (n: number) =>
  `$${Math.round(n).toLocaleString('en-CA', { maximumFractionDigits: 0 })}`;

export default async function HomePage() {
  // Fan out all four queries in parallel.
  const [stats, rawCategories, featured, drops] = await Promise.all([
    getHomeStats(),
    getHomeCategories(12),
    getFeaturedDeals(6),
    getRecentDrops(6),
  ]);

  // Merge in the emoji icon map from /types (same pattern as the old page).
  const topCategories = rawCategories.map((c) => ({
    ...c,
    label: CATEGORY_LABELS[c.key] ?? c.label,
    icon: CATEGORY_ICONS[c.key] ?? '📦',
  }));

  return (
    <div>
      {/* ── Hero ── */}
      <section
        style={{
          padding: '3.5rem 1.5rem 2rem',
          maxWidth: 680,
          margin: '0 auto',
          textAlign: 'center',
        }}
      >
        <h1
          className="animate-in"
          style={{
            fontFamily: "'Sora', sans-serif",
            fontWeight: 800,
            fontSize: '2.25rem',
            lineHeight: 1.15,
            marginBottom: '0.75rem',
          }}
        >
          The Canadian
          <br />
          <span className="gradient-text">Price Encyclopedia</span>
        </h1>
        <p
          className="animate-in animate-delay-1"
          style={{
            color: 'var(--text-secondary)',
            fontSize: '1rem',
            lineHeight: 1.6,
            maxWidth: 480,
            margin: '0 auto 1.75rem',
          }}
        >
          {stats.totalProducts.toLocaleString()} electronics products tracked daily across Canadian retailers.
        </p>

        <div
          className="animate-in animate-delay-2"
          style={{ maxWidth: 520, margin: '0 auto', position: 'relative', zIndex: 100 }}
        >
          <SearchBar large />
        </div>
      </section>

      {/* ── Retailer line ── */}
      <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
        <p
          style={{
            fontSize: '0.75rem',
            color: 'var(--text-secondary)',
            letterSpacing: '0.02em',
          }}
        >
          Tracking prices from{' '}
          <span style={{ color: 'var(--cc-color)', fontWeight: 600 }}>
            Canada Computers
          </span>{' '}
          ·{' '}
          <span style={{ color: 'var(--newegg-color)', fontWeight: 600 }}>
            Newegg Canada
          </span>{' '}
          ·{' '}
          <span style={{ color: 'var(--accent)', fontWeight: 600 }}>Vuugo</span>
        </p>
      </div>

      {/* ── Categories (flat grid, top 12) ── */}
      <section style={{ maxWidth: 1200, margin: '0 auto 3rem', padding: '0 1.5rem' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1rem',
          }}
        >
          <h2
            style={{
              fontFamily: "'Sora', sans-serif",
              fontWeight: 700,
              fontSize: '1.25rem',
            }}
          >
            Browse Categories
          </h2>
          <Link href="/categories" className="accent-link" style={{ fontSize: '0.875rem' }}>
            All categories →
          </Link>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
            gap: '0.75rem',
          }}
        >
          {topCategories.map((cat) => (
            <Link
              key={cat.key}
              href={`/c/${cat.key}`}
              className="card"
              style={{
                padding: '1rem',
                textDecoration: 'none',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.25rem',
              }}
            >
              <span style={{ fontSize: '1.5rem' }}>{cat.icon}</span>
              <p
                style={{
                  fontFamily: "'Sora', sans-serif",
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  color: 'var(--text-primary)',
                }}
              >
                {cat.label}
              </p>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                {cat.count.toLocaleString()} tracked
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Top Deals ── */}
      {featured.length > 0 && (
        <section style={{ maxWidth: 1200, margin: '0 auto 3rem', padding: '0 1.5rem' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1rem',
            }}
          >
            <h2
              style={{
                fontFamily: "'Sora', sans-serif",
                fontWeight: 700,
                fontSize: '1.25rem',
              }}
            >
              Top Deals Right Now
            </h2>
            <Link href="/deals" className="accent-link" style={{ fontSize: '0.875rem' }}>
              All deals →
            </Link>
          </div>
          <div className="grid-products">
            {featured.map((p) => (
              <FeaturedCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      {/* ── Recent Price Drops ── */}
      {drops.length > 0 && (
        <section style={{ maxWidth: 900, margin: '0 auto 3rem', padding: '0 1.5rem' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1rem',
            }}
          >
            <h2
              style={{
                fontFamily: "'Sora', sans-serif",
                fontWeight: 700,
                fontSize: '1.25rem',
              }}
            >
              Recent Price Drops
            </h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {drops.map((d, i) => (
              <Link
                key={`${d.productSlug}-${i}`}
                href={`/p/${d.productSlug}`}
                className="card"
                style={{
                  padding: '0.75rem 1.25rem',
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '1rem',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ flex: 1, minWidth: 200 }}>
                  <p
                    style={{
                      fontFamily: "'Sora', sans-serif",
                      fontWeight: 600,
                      fontSize: '0.8125rem',
                      color: 'var(--text-primary)',
                      marginBottom: '0.125rem',
                      lineHeight: 1.4,
                    }}
                  >
                    {d.productName.length > 70
                      ? d.productName.slice(0, 70) + '…'
                      : d.productName}
                  </p>
                  <p style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)' }}>
                    {d.retailerName} ·{' '}
                    {CATEGORY_LABELS[d.category] ?? d.category} · {d.when}
                  </p>
                </div>
                <div style={{ textAlign: 'right', minWidth: 110 }}>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      color: 'var(--text-secondary)',
                      textDecoration: 'line-through',
                      marginRight: '0.5rem',
                    }}
                  >
                    {fmtPrice(d.oldPrice)}
                  </span>
                  <span
                    style={{
                      fontSize: '0.9375rem',
                      fontWeight: 700,
                      color: 'var(--accent)',
                    }}
                  >
                    {fmtPrice(d.newPrice)}
                  </span>
                  <p
                    style={{
                      fontSize: '0.6875rem',
                      fontWeight: 600,
                      color: 'var(--accent)',
                      marginTop: '0.125rem',
                    }}
                  >
                    ▼ {d.pct.toFixed(1)}%
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── Email signup ── */}
      <section style={{ maxWidth: 600, margin: '0 auto 3rem', padding: '0 1.5rem' }}>
        <EmailSignup />
      </section>

      {/* ── How it works ── */}
      <section
        style={{
          maxWidth: 800,
          margin: '0 auto 4rem',
          padding: '0 1.5rem',
          textAlign: 'center',
        }}
      >
        <h2
          style={{
            fontFamily: "'Sora', sans-serif",
            fontWeight: 700,
            fontSize: '1.25rem',
            marginBottom: '1.5rem',
          }}
        >
          How It Works
        </h2>
        <div className="grid-howitworks">
          {[
            {
              step: '1',
              title: 'Prices Get Logged',
              desc: 'Every day, our system checks prices across Canada Computers, Newegg, and Vuugo.',
            },
            {
              step: '2',
              title: 'History Builds Up',
              desc: 'Over time you get a real price chart — so you can tell a genuine drop from a fake sale.',
            },
            {
              step: '3',
              title: 'You Buy Smarter',
              desc: 'Compare the same product across stores, or set a price alert and get emailed when it drops.',
            },
          ].map((item) => (
            <div key={item.step}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  background: 'var(--accent-glow)',
                  border: '1px solid var(--accent)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 0.75rem',
                  fontFamily: "'Sora', sans-serif",
                  fontWeight: 700,
                  color: 'var(--accent)',
                  fontSize: '0.875rem',
                }}
              >
                {item.step}
              </div>
              <p
                style={{
                  fontFamily: "'Sora', sans-serif",
                  fontWeight: 600,
                  marginBottom: '0.25rem',
                }}
              >
                {item.title}
              </p>
              <p
                style={{
                  fontSize: '0.8125rem',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.5,
                }}
              >
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Footer blurb ── */}
      <section
        style={{
          maxWidth: 600,
          margin: '0 auto 4rem',
          padding: '0 1.5rem',
          textAlign: 'center',
        }}
      >
        <p
          style={{
            fontSize: '0.8125rem',
            color: 'var(--text-secondary)',
            lineHeight: 1.7,
          }}
        >
          Built in Quebec. TrackAura is an independent price tracker — not affiliated with any retailer.{' '}
          <Link href="/about" style={{ color: 'var(--accent)' }}>
            Learn more →
          </Link>
        </p>
      </section>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   Featured product card — inline, uses same .card + .grid-products
   classes as the rest of the homepage.
   ────────────────────────────────────────────────────────────── */

function FeaturedCard({ product }: { product: HomeFeaturedProduct }) {
  return (
    <Link
      href={`/p/${product.slug}`}
      className="card"
      style={{
        textDecoration: 'none',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          aspectRatio: '4 / 3',
          borderBottom: '1px solid var(--border)',
          background:
            'linear-gradient(135deg, var(--bg-card), var(--bg-primary))',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.imageUrl}
            alt={product.name}
            loading="lazy"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              padding: '1rem',
            }}
          />
        ) : (
          <div
            style={{
              display: 'flex',
              height: '100%',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.625rem',
              color: 'var(--text-secondary)',
            }}
          >
            No image
          </div>
        )}
        {product.isAtl && (
          <span
            style={{
              position: 'absolute',
              top: '0.5rem',
              left: '0.5rem',
              fontSize: '0.625rem',
              fontWeight: 700,
              fontFamily: "'Sora', sans-serif",
              textTransform: 'uppercase',
              padding: '0.25rem 0.5rem',
              borderRadius: 6,
              background: 'rgba(0, 229, 160, 0.15)',
              border: '1px solid rgba(0, 229, 160, 0.4)',
              color: 'var(--accent)',
              backdropFilter: 'blur(4px)',
            }}
          >
            ATL
          </span>
        )}
        <span
          style={{
            position: 'absolute',
            top: '0.5rem',
            right: '0.5rem',
            fontSize: '0.625rem',
            fontWeight: 700,
            fontFamily: "'Sora', sans-serif",
            textTransform: 'uppercase',
            padding: '0.25rem 0.5rem',
            borderRadius: 6,
            background: 'rgba(56, 189, 248, 0.15)',
            border: '1px solid rgba(56, 189, 248, 0.4)',
            color: '#38bdf8',
            backdropFilter: 'blur(4px)',
          }}
        >
          −{Math.round(product.dropPct)}%
        </span>
      </div>
      <div
        style={{
          padding: '0.75rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
          flex: 1,
        }}
      >
        {product.brand && (
          <p
            style={{
              fontSize: '0.6875rem',
              color: 'var(--text-secondary)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              fontFamily: "'Sora', sans-serif",
            }}
          >
            {product.brand}
          </p>
        )}
        <p
          style={{
            fontSize: '0.8125rem',
            fontWeight: 600,
            color: 'var(--text-primary)',
            lineHeight: 1.4,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {product.name}
        </p>
        <div
          style={{
            marginTop: 'auto',
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: '0.5rem',
          }}
        >
          <span
            style={{
              fontSize: '1.125rem',
              fontWeight: 700,
              color: 'var(--accent)',
              fontFamily: "'Sora', sans-serif",
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {fmtPrice(product.bestPrice)}
          </span>
          <span
            style={{
              fontSize: '0.6875rem',
              color: 'var(--text-secondary)',
              textDecoration: 'line-through',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {fmtPrice(product.allTimeHigh)}
          </span>
        </div>
        {product.bestRetailerName && (
          <p
            style={{
              fontSize: '0.625rem',
              color: 'var(--text-secondary)',
            }}
          >
            at {product.bestRetailerName}
          </p>
        )}
      </div>
    </Link>
  );
}
