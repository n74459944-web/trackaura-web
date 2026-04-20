# TrackAura — Architecture Bible

**Status:** Draft 1 · Locked decisions in **bold** · Questions marked [TBD] · Last revised: session of 2026-04-19

---

## 0. How to use this document

This is the source of truth for every engineering decision on TrackAura. Paste it at the top of every future development session. When we disagree with what's written here, we update the document first, then change the code. When this doc and the code disagree, the code is wrong.

Every section tagged `[TBD]` is a decision we're deferring. When we make the decision, we update the section and remove the tag.

---

## 1. Vision and non-vision

### What TrackAura is

**TrackAura is a canonical registry of physical items with price history and provenance attached.** One item in the real world = one identity in the database. Every retailer listing anywhere is either a known identity or a candidate for a new identity. Prices are observations tied to the canonical identity over time.

The moat is the catalog. Not the scrapers, not the UI, not the features. The clean, deduplicated, cross-source-verified **identity of every thing** is what makes this defensible.

### The killer feature

The unique value is **breadth × depth**. Single-vertical competitors can beat TrackAura in their vertical. CamelCamelCamel owns Amazon. PCPartPicker owns PC builds. TCGplayer owns cards. No one owns the intersection.

TrackAura's promise to the user: **"Pick any item in any category. We know what it is, what it's been worth over time, and where you can buy it now."** Everything else follows from this.

### What TrackAura is NOT

- Not a deals site. (Deals are a byproduct of good price data, not the product.)
- Not a marketplace. (We don't sell. We observe.)
- Not a social network. (Phase 2+ only, never the launch frame.)
- Not a reviews site. (We aggregate facts, not opinions.)
- Not a recommendation engine. (Phase 2+ only.)
- Not a financial product. (No "buy now" signals. No price predictions as advice.)

### Users served, in priority order

1. **Price investigator** — lands via Google query ("X price history Canada"). Wants: authoritative current price, full history, every retailer. Optimized for. This is how we get traffic.
2. **Collector browser** — arrives knowing what they want to research. Wants: Wikipedia-style depth, variants, lineage, specs. Same underlying data, richer UI emphasis. Served once data is dense enough.
3. **Portfolio owner** — Phase 2+. Tracks the value of what they own over time. Not priority for MVP.

---

## 2. Scope boundaries

### Geographic

**Canada first.** Because the scrapers, retailer relationships, and affiliate economics are already there. The architecture is geography-agnostic, so expansion is an infra question later (retailer adapters + regional pricing), not an architectural one. Never declare "Canadian" in the data model. Use `country_code` as a field on listings and prices.

### Item categories, in order of launch

**Phase 0 (today):** Canadian consumer electronics — GPUs, CPUs, motherboards, laptops, peripherals. ~23k canonical entities already exist.

**Phase 1 (next 3-6 months):** Collectibles with clean canonical identifiers — Pokemon TCG, MTG, sports cards, sealed video games, comic books (graded), LEGO sets. These have existing vertical-specific catalog sources (TCGplayer for cards, BrickLink/Rebrickable for LEGO, GoCollect for comics).

**Phase 2 (6-12 months):** Watches, jewelry, other luxury goods where model identities are clean. Then tools, appliances, cameras where catalog data is available.

**Phase 3 (12+ months):** Commodity physical goods where UPC/EAN suffices as identity (groceries, household goods). Needs a GS1-like catalog source.

**Deferred indefinitely:** Real estate individual properties (aggregate regional data is acceptable, individual units are a different product). Services (plumbers, lawyers — how do you canonicalize an individual?). Digital goods (game keys, NFTs — architecturally possible, culturally different).

### Item conditions

**NEW items only for Phase 0 and Phase 1.** Used, refurbished, open-box, graded-condition variants are Phase 2+. This is the single biggest scope simplification. Every listing on the site is assumed NEW unless explicitly flagged.

Condition handling later requires: a condition taxonomy per vertical (a used GPU has different condition grades than a graded Pokemon card), per-condition price tracking, per-condition matching. It's a 6-month project on its own when we get there.

---

## 3. Data model

### Core principle

The current `canonical_products` table is **the v0 electronics catalog**. It stays running. We build a new set of generic tables alongside it (`canonical_entities`, `entity_variants`, `entity_attributes`, `listings`, `price_points_v2`) and migrate category-by-category.

Zero-downtime. Live site keeps working on old tables. New tables come online as categories migrate.

### Proposed new tables

```
canonical_entities
─────────────────
id                 bigint PK
slug               text unique
canonical_name     text           -- "iPhone 15 Pro Max 256GB Natural Titanium"
display_name       text           -- "iPhone 15 Pro Max"
vertical           text           -- 'electronics', 'tcg', 'lego', 'watches'
entity_type        text           -- 'phone', 'gpu', 'card', 'set', 'watch'
parent_entity_id   bigint FK      -- for tree hierarchy, null for roots
brand              text
release_date       date
msrp_cad           numeric
msrp_currency      text           -- some items MSRP in USD even in CA
image_primary_url  text
description_md     text           -- markdown, LLM-generated or hand-edited
created_at         timestamptz
updated_at         timestamptz


entity_attributes
─────────────────
id                    bigint PK
entity_id             bigint FK
attribute_key         text       -- 'storage_gb', 'color', 'generation', 'chip'
attribute_value       text       -- '256', 'Natural Titanium', 'M3 Max'
attribute_value_num   numeric    -- when sortable/filterable
is_price_defining     boolean    -- if true, entity is a leaf and gets its own price

UNIQUE(entity_id, attribute_key)


entity_relationships
────────────────────
id               bigint PK
from_entity_id   bigint FK
to_entity_id     bigint FK
relationship     text  -- 'predecessor', 'successor', 'variant_of', 'alternative_to'


listings
────────
id                bigint PK
entity_id         bigint FK
retailer          text
retailer_sku      text          -- their internal ID
url               text
first_seen        timestamptz
last_seen         timestamptz
is_active         boolean
match_confidence  numeric       -- 0.0-1.0, from resolution engine
match_source      text          -- 'llm', 'fuzzy', 'human', 'exact_sku'
country_code      text          -- 'CA', 'US', 'GB'


price_observations
──────────────────
id              bigint PK
listing_id      bigint FK
entity_id       bigint FK    -- denormalized for fast entity-level queries
price           numeric
currency        text
is_in_stock     boolean
is_openbox      boolean
observed_at     timestamptz


catalog_sources
───────────────
id             bigint PK
name           text         -- 'techpowerup', 'tcgplayer', 'manufacturer_nvidia'
vertical       text
kind           text         -- 'scraped', 'manual', 'api'
last_imported  timestamptz
notes          text

entity_source_mappings
──────────────────────
id                 bigint PK
entity_id          bigint FK
source_id          bigint FK
external_id        text        -- the ID the source uses
source_url         text
confidence         numeric
verified_by_human  boolean
```

### What this enables

- **Tree hierarchy:** MacBook → MacBook Pro → MacBook Pro 16" → MacBook Pro 16" M3 Max → [specific leaf configuration]. Via `parent_entity_id`.
- **Leaf-level pricing:** Only entities with `is_price_defining = true` on their variants are the ones with prices attached. Parent nodes aggregate.
- **Variants as first-class:** Color, storage, capacity are real data, not free-form metadata.
- **Cross-vertical queries:** Same tables hold a GPU, a Pokemon card, a LEGO set. Joins are the same.
- **Source provenance:** We always know where a canonical identity came from.

### Migration from `canonical_products`

1. Build the new tables empty.
2. Write a migration script that, for one category at a time, creates `canonical_entities` rows from existing `canonical_products` rows.
3. Attach existing retailer listings as `listings` rows pointing at the new entities.
4. Attach existing price points as `price_observations`.
5. Route new scraper output into new tables only.
6. Run both pipelines in parallel for one category for 2 weeks. Compare outputs. Investigate discrepancies.
7. Switch the frontend category-by-category to read from new tables.
8. Sunset `canonical_products` once all categories are migrated. (Months away.)

---

## 4. Entity resolution — the hard part

### The problem

Canada Computers lists: "ASUS ROG Strix GeForce RTX 4070 Ti Super 16GB OC GDDR6X"
Newegg Canada lists: "ASUS ROG Strix RTX 4070 Ti SUPER OC 16GB"
Best Buy Canada lists: "ASUS ROG Strix GeForce RTX4070Ti Super OC Edition"

These are the same card. The resolution engine must know this.

### The engine, conceptually

```
┌─────────────────────────────────┐
│ Incoming listing from scraper   │
│ (title, brand, retailer_sku,    │
│  category, price, image_url)    │
└──────────────┬──────────────────┘
               │
               ▼
       ┌───────────────┐
       │ Exact match?  │  (retailer SKU previously linked)
       └───┬───────┬───┘
           │yes    │no
           ▼       ▼
       DONE   ┌─────────────────┐
              │ High-conf fuzzy? │  (trigram on canonical_name, brand match, price sanity)
              └───┬───────────┬──┘
                  │yes        │no
                  ▼           ▼
              LINK        ┌───────────────────┐
              (auto)      │ LLM resolution     │
                          │ (Haiku/mini, cheap)│
                          └───┬───────────┬────┘
                              │high conf  │low conf
                              ▼           ▼
                          LINK        HUMAN REVIEW
                          (auto)      QUEUE
```

### Tier 1: exact SKU match (free)

If a retailer SKU has been linked to an entity before, auto-link. This catches 80%+ of daily re-scrapes.

### Tier 2: deterministic fuzzy match (cheap)

Postgres pg_trgm, already available. Compute trigram similarity against existing `canonical_entities.canonical_name` for the same brand + category. If similarity > 0.85, auto-link with confidence score recorded.

This catches ~10% more.

### Tier 3: LLM resolution (paid, rare)

Only fires when tier 1 and 2 miss. We pass the LLM: the raw listing title, the brand, the top 5 fuzzy candidates, and ask "is this a match to one of these, or is this a new entity?"

Use the cheapest LLM that performs acceptably. Current candidates: Claude Haiku, GPT-4o-mini, Gemini Flash. Plan for $0.0005-$0.002 per call.

**Budget:** New listings per day post-launch will be maybe 500-2000 (most daily scrapes are unchanged). At $0.002 each worst case, $1-4/day = $30-120/mo. Under budget if we're disciplined.

### Tier 4: local Ollama verification (free)

For the tier 3 LLM result, run a local Ollama model as a sanity check on high-stakes links (price-defining entities, popular categories). Two-model consensus. Only fires on a subset to stay fast.

### Tier 5: human review queue

Low-confidence matches, LLM-uncertain matches, and any match that would merge two existing entities get routed to a review queue. This is a simple CRUD page showing pending matches with "approve / reject / new entity" buttons. You review these by hand. Expect 50-200 per week.

### Confidence scoring

Every `listings` row records `match_confidence` (0.0-1.0) and `match_source` (exact/fuzzy/llm/human). Below 0.7 flags for review. Never auto-link below 0.5.

---

## 5. Catalog acquisition strategy

Without a paid catalog source, we bootstrap category-by-category from the best free-ish option. Priority order:

### Electronics — Phase 0 / already here

- **GPUs:** TechPowerUp's GPU database is the gold standard. Scrapable, comprehensive, well-structured. Use it to seed the `canonical_entities` table for the GPU vertical. This is the first catalog source to integrate.
- **CPUs:** TechPowerUp also, plus Intel/AMD ARK-style manufacturer sites. Free, structured.
- **Laptops:** Hardest. NotebookCheck has a big database. Manufacturer sites are fragmented. May need manual curation for top 500 SKUs.
- **Motherboards, RAM, SSDs, PSUs:** Manufacturer sites + existing canonicals. Medium difficulty.
- **Peripherals (keyboards, mice, headsets):** Manufacturer sites. Long tail is messy. Accept imperfection.

### Collectibles — Phase 1

- **TCG (Pokemon, MTG, Yu-Gi-Oh):** TCGplayer has structured data. Scrapable. Existing open-source alternatives (Scryfall for MTG is free and clean).
- **Sports cards:** Harder. Beckett is paywalled. GoCollect has some free data. May start with modern (2000+) only.
- **Sealed video games:** PriceCharting has this. Scrapable.
- **LEGO:** BrickLink + Rebrickable. Clean, structured, free-ish.
- **Comics (graded):** GoCollect has CGC/CBCS census data. Scrapable.

### Watches — Phase 2

- **Reference databases:** Chrono24 (hostile to scrape), WatchRecon (better). May need Wikidata as the free catalog source. Manufacturer sites for current models.

### Strategy for ALL verticals

1. **Pick one authoritative free source per vertical.** Even if it's imperfect.
2. **Scrape it once** (or access via API where possible). Store raw dump.
3. **Normalize into `canonical_entities`** with source provenance in `entity_source_mappings`.
4. **Manual review of top 100-500 entities** per category to fix obvious issues. This is unavoidable hand-work.
5. **Retailer scraping maps listings onto this catalog**, doesn't create it.
6. **Gaps get reported.** If a retailer lists something no catalog source knows about, that's a signal — either the catalog source is incomplete, or the retailer is lying, or it's legitimately new. Human review.

### What about items no catalog source has?

Some items (long-tail, brand-new, obscure) won't be in any external catalog. They enter the system via retailer scraping, get a `canonical_entities` row with `match_source = 'scraper_seed'`, and sit in a "provisional" state until a catalog source covers them or a human verifies them. Provisional entities show on the site with a badge: "Limited data — we're still learning about this item."

---

## 6. Scraper architecture

### Current state

Site-first scrapers, one per retailer. They enumerate categories, extract listings, normalize, insert into `products` table with a canonical_id guess.

### Target state

**Catalog-first scrapers:** for each entity in the catalog, check each retailer for matching listings. Discovery scrapers still exist for finding new entities not yet in the catalog.

### Adapter pattern

```
interface RetailerAdapter {
  name: string
  country_code: string

  // Find listings by querying the retailer's search with a known entity.
  // Returns candidate listings with enough data to run entity resolution.
  findByEntity(entity: CanonicalEntity): Promise<ListingCandidate[]>

  // Fallback: enumerate a category. Used for discovery of new entities.
  enumerateCategory(category: string): Promise<ListingCandidate[]>

  // Fetch current price for a known listing URL.
  fetchPrice(listingUrl: string): Promise<PriceSnapshot>
}
```

One adapter per retailer. Adding a new retailer = writing one file. The job orchestrator calls adapters uniformly.

### Retailer priority order

1. **Best Buy Canada** — public REST API. Easiest integration. Biggest catalog outside Amazon. Ship first.
2. **Memory Express** — standard HTML. PC-enthusiast audience overlap with RFD. High value.
3. **Walmart Canada** — `__NEXT_DATA__` JSON extraction. Broad catalog. Low-margin PC parts but good for general electronics.
4. **Staples Canada** — HTML + JSON-LD. Broad SMB market.
5. **Canada Computers** — already integrated. Keep running.
6. **Newegg Canada** — already integrated. Keep running.
7. **Vuugo** — already integrated. Small, keep running for breadth.
8. **Visions Electronics** — already integrated. Small, keep running for breadth.

**Not scraped, ever:** Amazon (legal risk), eBay (different product), Facebook Marketplace / Kijiji (user-generated, not retailer).

### Scheduling

**Daily full scrape** for entities in the active catalog. **Hourly delta scrapes** for top 1000 entities (the ones that drive the most page views). **On-demand re-scrape** triggered when a user views a product page with stale data (>24h old).

The hourly and on-demand tiers come later. Daily full is the launch requirement.

---

## 7. Tech stack — what stays, what changes, what's new

### Stays

- **Next.js 16 (App Router) on Vercel** — frontend. No reason to change.
- **Supabase Postgres** — main database. Stays.
- **Python scrapers on Windows** — fine for now. Will move to cloud scheduler (see below) eventually, but not urgent.
- **Resend for email** — price alerts. Stays.
- **Existing UI design tokens** — teal accent, Sora/DM Sans, dark theme. Tweak colors later if needed (you mentioned palette changes), but no total rebuild.

### Changes

- **The `canonical_products` table becomes deprecated** over 6-12 months. Not dropped until all categories migrate.
- **`products` table becomes `listings`** in the new schema. Same data shape mostly, but tied to `canonical_entities`.
- **The homepage moves to "encyclopedia framing"** once the new tables have data in them. Current "deals feed" framing is fine for short term.

### New

- **LLM gateway service** — a thin wrapper in Python or TypeScript that batches LLM calls, caches by input hash, falls back between providers (Claude → GPT → Gemini in order of quality/price). Prevents locking in to one vendor.
- **Ollama instance** — local LLM for deterministic tasks. Runs on your machine initially. Cloud later if scale demands.
- **Job queue** — right now scrapers run via Windows Scheduled Task. That doesn't scale for catalog-first where there are thousands of targeted lookups. Options: Postgres-based queue (river, graphile-worker), Redis-based (BullMQ), cloud-native (Vercel Cron + small workers). Start with the simplest: a Postgres table + a Python daemon. Migrate when painful.
- **Human review UI** — a simple admin page at `/admin/review` for approving low-confidence matches. Solo product — no auth complexity, just a shared secret URL or basic HTTP auth.

---

## 8. Monetization sequence

### Phase 0 (now): Affiliate only

Every retailer "View at X" button is an affiliate link where supported. Canada Computers, Newegg, Best Buy have affiliate programs. Revenue is small but non-zero. No pressure.

### Phase 1 (post-catalog-first, months 3-6): Affiliate still, but now with scale

More retailers = more affiliate coverage = more clicks. SEO traffic compounds as canonical pages rank for long-tail queries. Expect revenue to grow 10-50x from Phase 0 purely from traffic scaling. Still modest in absolute terms.

### Phase 2 (months 6-12): API access + premium tier

Once the catalog is genuinely dense, offer:
- **Free tier:** same as today, with rate limits.
- **Premium ($5-10/mo):** unlimited alerts, portfolio tracking, history export, API access for small apps.
- **Business API ($50-500/mo):** bulk API access for resellers, price intelligence tools, insurance appraisers, market research firms.

Decision point: if premium isn't producing revenue within 3 months of launch, kill it and double down on API licensing which has higher per-customer value.

### Phase 3 (year 2+): Data licensing

When the catalog is authoritative, businesses will pay for it. Insurance companies appraising collections. Pawnshops pricing inventory. Secondary-market resellers. This is where the real money is, but it requires catalog credibility that takes 18+ months to build.

### What we don't do

- **No ads ever.** RFD crowd hates them, we said it, we mean it.
- **No paywalled content.** The catalog is free to browse. Locking it defeats the SEO moat.
- **No sponsored product placements.** Compromises the "authoritative" framing.

---

## 9. Stopping rules and phase metrics

We need stopping rules so you don't perfect-polish forever.

### Phase 0 complete when:

- [ ] Top 500 Google searches for "X price history Canada" include at least one TrackAura result in positions 1-10.
- [ ] At least 3 retailers per top-1000-product (currently at ~1).
- [ ] Weekly organic traffic is growing 5%+ week-over-week for 4 consecutive weeks.

### Phase 1 (first new vertical) start when:

- [ ] Phase 0 traffic has plateaued for 2+ weeks OR is solid enough to sustain.
- [ ] Electronics entity resolution runs without human intervention on >95% of daily scraped listings.
- [ ] Monthly infra + LLM costs under $100 consistently.

### Phase 1 complete when:

- [ ] The new vertical has catalog depth equal to Phase 0 electronics.
- [ ] Cross-vertical search on the site returns coherent results.

### Phase 2 (portfolio / API) start when:

- [ ] 3+ verticals live at Phase 1 depth each.
- [ ] Organic traffic > 10k unique visitors/month.
- [ ] At least one external site or app is scraping TrackAura (signal of catalog value).

### Metrics we track weekly

- Entity count (total, per vertical)
- Listings-per-entity median (coverage metric)
- Active retailers per entity median
- Daily resolution engine stats: auto-linked / reviewed / LLM-resolved
- Human review queue depth
- Organic traffic (GSC + Google Analytics)
- Monthly infra cost
- Monthly LLM cost

### Metrics we explicitly DON'T track

- Daily active users (meaningless pre-community)
- Session duration (gameable, misleading)
- Page views (correlate with traffic, no new info)

---

## 10. First 30 days checklist

This is the concrete work to execute Monday morning. In order.

### Week 1 — foundation

- [ ] Spin up the new tables (`canonical_entities`, `entity_attributes`, `entity_relationships`, `listings`, `price_observations`, `catalog_sources`, `entity_source_mappings`) in Supabase. Indexes. RLS off (no user data in these).
- [ ] Write the migration script for ONE category (GPUs): copies existing GPU canonical_products rows into `canonical_entities`, existing products rows into `listings`, existing price_points into `price_observations`.
- [ ] Run the migration, verify row counts, spot-check data.
- [ ] Write a read-only `canonical_entities_view` that unions old and new tables — the frontend queries this view during transition.

### Week 2 — catalog import

- [ ] Build the TechPowerUp GPU importer. Scrapes their DB once, stores as JSON. Parses into `canonical_entities`.
- [ ] Match existing GPU canonicals to TechPowerUp entities via pg_trgm + manual review. Produces a CSV of conflicts to resolve.
- [ ] You hand-review conflicts (expect ~100 rows, 2-3 hours of work).
- [ ] Finalize the GPU catalog. `canonical_entities` for the GPU vertical now has TechPowerUp as the source of truth.

### Week 3 — entity resolution engine

- [ ] Build the resolution engine: exact → fuzzy → LLM → human pipeline.
- [ ] LLM gateway service with caching and multi-provider fallback.
- [ ] Human review UI at `/admin/review`. Simple. Shared-secret auth.
- [ ] Run engine against live Canada Computers GPU listings. Measure auto-link rate.

### Week 4 — catalog-first scraping + one new retailer

- [ ] Build the retailer adapter interface.
- [ ] Port Canada Computers and Newegg scrapers to the adapter interface.
- [ ] Build the Best Buy Canada adapter (public API, easiest).
- [ ] Wire up catalog-first scraping for GPUs: for each TechPowerUp GPU, query each retailer adapter for matches.
- [ ] Daily job runs end-to-end. Data lands in new tables.

### End of month 1 — success criteria

- GPU vertical runs on the new architecture end-to-end.
- Other verticals still run on old architecture. Site is not broken.
- Best Buy Canada integrated for GPUs.
- Human review queue exists and is actively used.
- You can look at a GPU product page on the live site and see richer data than before.

---

## 11. Risk register — what kills this

Ranked by probability × severity.

### High risk

1. **Scope creep.** Trying to launch multiple verticals simultaneously. Mitigation: the stopping rules above. Do not start Phase 1 until Phase 0 metrics are met.
2. **LLM costs spiral.** A bug in the resolution engine calls the LLM 10x more than expected. Mitigation: hard monthly budget cap in the LLM gateway ($100/mo), circuit-breaker that switches to "queue for human review" when budget hits 80%.
3. **Solo burnout.** Weekend project for a year. Mitigation: the 30-day checklist. Small wins. Shippable milestones. Don't try to finish the whole vision in Q1.
4. **The catalog source breaks or goes hostile.** TechPowerUp adds anti-scraping or changes their schema. Mitigation: store the catalog dump, don't depend on live queries to the source. Re-scrape monthly, not per-request.

### Medium risk

5. **Retailer blocks your scrapers.** Mitigation: use curl_cffi with TLS fingerprint spoofing (already do this for Walmart). Rotate user agents. Respect rate limits. If blocked, move on — we have 8 retailer plans.
6. **Legal pressure from a retailer.** Low probability (you're a single-person project with affiliate links). Higher probability at scale. Mitigation: stay affiliate-legitimate, not a price-underminer. Don't expose retailer internal data (prices are fine, SKU structures and URLs are fine, stock levels are borderline).
7. **Supabase hits pricing tier.** At 100k+ entities and daily scrapes, egress + compute could jump. Mitigation: watch the monthly bill weekly. Partition aggressively. Archive old price_points to cold storage after 2 years.

### Low risk but worth watching

8. **Copy-cat competitor.** Unlikely at solo scale, real at scale. Mitigation: the catalog itself is the moat. Competitors can copy features, not 18 months of catalog work.
9. **Google algo change tanks SEO.** Always possible. Mitigation: don't depend on any single traffic source. Diversify once organic is flowing — Reddit posts, RFD engagement, Twitter.
10. **The tech changes underneath you.** Next.js breaking change, Supabase policy shift. Mitigation: pin versions, upgrade deliberately. Don't be first on new frameworks.

---

## 12. Open questions for future sessions

These are decisions we're deferring. When they come up, we update this doc.

- **[TBD]** Exact LLM provider strategy. Claude Haiku vs GPT-4o-mini vs Gemini Flash. Pick after first 1000 real calls.
- **[TBD]** Ollama model for local verification. Llama 3 8B probably, test alternatives.
- **[TBD]** Job queue tech. Start with Postgres polling, migrate if slow.
- **[TBD]** Admin review UI auth. Shared secret URL initially, proper auth when other humans contribute.
- **[TBD]** Condition handling. Phase 2+ design needs its own doc. Must handle: used grades (Amazon "Like New", eBay "Used - Good"), collectible grades (CGC 9.8, PSA 10), cosmetic condition for watches, etc.
- **[TBD]** Portfolio features design. Phase 2+. Consider: is it one-product-per-row or a rich UI with photos? Cross-vertical? How is value calculated for items with price ranges?
- **[TBD]** Brand strategy. Does TrackAura stay the name? Or spin encyclopedia to a different domain? Revisit at 100k MAU.
- **[TBD]** Rebrand UI colors. You mentioned wanting to change the palette. Do it when the catalog-first migration is done, not before.

---

## 13. Session protocol

How we work going forward.

1. Every session starts with "is the architecture bible current?" If we've made changes last session, they're in the doc.
2. Every session ends with "what decisions did we make?" If any, update the doc.
3. When Claude proposes a change that contradicts the doc, Claude must flag the contradiction explicitly before proceeding.
4. When you push back on a Claude suggestion, the pushback gets captured — even if the suggestion is rejected, the reasoning helps future sessions.
5. Concrete code gets generated against the architecture described here. If the architecture is wrong, fix the doc first.

---

## 14. What success looks like in 12 months

- TrackAura.com is the first Google result for 500+ "product X price history Canada" queries.
- 3 verticals live: electronics (deep), one collectibles vertical (medium), one other (shallow).
- 50,000+ monthly unique visitors from organic search.
- Catalog of 100,000+ canonical entities across verticals.
- Monthly revenue of $500-2000 from affiliate + early premium users.
- Monthly cost of $100-200 infra + LLM.
- A coherent product story that would make sense to a Thiel-style investor if you wanted one.

And — more important than the metrics — a foundation that makes the next 12 months 10x easier than the last 12. That's the compounding play.

---

*End of architecture bible. This document is the constitution. Amend when reality requires.*
