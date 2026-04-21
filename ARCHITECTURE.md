# TrackAura — Architecture Bible

**Status:** Draft 2 · Locked decisions in **bold** · Questions marked [TBD] · Last revised: session of 2026-04-20

---

## 0. How to use this document

This is the source of truth for every engineering decision on TrackAura. Paste it at the top of every future development session. When we disagree with what's written here, we update the document first, then change the code. When this doc and the code disagree, the code is wrong.

Every section tagged `[TBD]` is a decision we're deferring. When we make the decision, we update the section and remove the tag.

### Changelog

- **Draft 2 (2026-04-20)** — First Week 2 session. Amendments driven by reality:
  - TechPowerUp switched to PoW + drag-captcha anti-scrape; section 5 rewritten to reflect source selection principles learned from this
  - Three-phase catalog import model added (§5)
  - Variant-as-attribute rule added (§3)
  - Display name cleanup deferred (§3)
  - New-canonicals-via-review-queue principle added (§5)
  - Catalog source quality warning added (§11)
  - Two-level entity type naming documented (§3): `gpu_chip` / `gpus`

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

**Phase 0 (today):** Canadian consumer electronics — GPUs, CPUs, motherboards, laptops, peripherals. ~23k canonical entities already exist. As of 2026-04-20, GPU vertical is migrated to the new canonical-entity schema with a two-level tree (chip parents + board children).

**Phase 1 (next 3-6 months):** Collectibles with clean canonical identifiers — Pokemon TCG, MTG, sports cards, sealed video games, LEGO sets, comic books (graded). Caveat added 2026-04-20: TCGplayer may have anti-scrape measures similar to TechPowerUp's (PoW / captcha). **Verify scrape-ability of TCGplayer and other Phase 1 sources BEFORE committing to Phase 1 start.** Scryfall (MTG) is API-friendly and confirmed open; BrickLink and GoCollect need reconnaissance.

**Phase 2 (6-12 months):** Watches, jewelry, other luxury goods where model identities are clean. Then tools, appliances, cameras where catalog data is available.

**Phase 3 (12+ months):** Commodity physical goods where UPC/EAN suffices as identity (groceries, household goods). Needs a GS1-like catalog source.

**Deferred indefinitely:** Real estate individual properties. Services. Digital goods.

### Item conditions

**NEW items only for Phase 0 and Phase 1.** Used, refurbished, open-box, graded-condition variants are Phase 2+. Per §3 variant rule (below), conditions when they arrive are `entity_attributes(is_price_defining=true)`, not separate entities.

---

## 3. Data model

### Core principle

The current `canonical_products` table is **the v0 electronics catalog**. It stays running. We build a new set of generic tables alongside it (`canonical_entities`, `entity_attributes`, `entity_relationships`, `listings`, `price_observations`, `catalog_sources`, `entity_source_mappings`) and migrate category-by-category.

Zero-downtime. Live site keeps working on old tables. New tables come online as categories migrate.

As of 2026-04-20 the seven new tables exist in Supabase. The GPU vertical is fully migrated and has a working two-level tree (chip parents + board leaves).

### New tables

```
canonical_entities
─────────────────
id                 bigint PK
slug               text unique
canonical_name     text           -- the form scrapers match against
display_name       text           -- NULL during migration; cleaned up
                                  -- in a Week 5+ polish pass
vertical           text           -- 'electronics', 'tcg', 'lego', 'watches'
entity_type        text           -- see type conventions below
parent_entity_id   bigint FK      -- tree hierarchy, null for roots
brand              text
release_date       date
msrp_cad           numeric
msrp_currency      text
image_primary_url  text
description_md     text
created_at         timestamptz
updated_at         timestamptz

entity_attributes
─────────────────
id                    bigint PK
entity_id             bigint FK
attribute_key         text       -- free-form; vertical-specific conventions
attribute_value       text
attribute_value_num   numeric    -- when sortable/filterable
is_price_defining     boolean    -- true when this attribute splits price
                                 -- tracking (memory size, condition grade,
                                 -- foil vs non-foil, etc.)

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
retailer_sku      text
url               text
first_seen        timestamptz
last_seen         timestamptz
is_active         boolean
match_confidence  numeric       -- 0-1, from resolution engine
match_source      text          -- 'llm', 'fuzzy', 'human', 'exact_sku'
country_code      text

price_observations
──────────────────
id              bigint PK
listing_id      bigint FK
entity_id       bigint FK    -- denormalized for entity-level queries
price           numeric
currency        text
is_in_stock     boolean
is_openbox      boolean
observed_at     timestamptz

catalog_sources
───────────────
id             bigint PK
name           text
vertical       text
kind           text         -- 'scraped', 'manual', 'api'
last_imported  timestamptz
notes          text

entity_source_mappings
──────────────────────
id                 bigint PK
entity_id          bigint FK
source_id          bigint FK
external_id        text
source_url         text
confidence         numeric
verified_by_human  boolean
```

### Tree structure and entity_type naming

Entities form a tree via `parent_entity_id`. Each vertical has its own type names, lowercased and snake-cased:

- **Electronics/GPUs:** `gpu_chip` (parent, e.g. "GeForce RTX 5070") → `gpus` (board leaf, e.g. "MSI GeForce RTX 5070 12G GAMING TRIO OC WHITE"). The `gpus` name is historical; later verticals should use cleaner names like `gpu_board`.
- **TCG (planned):** `tcg_card_base` (parent, e.g. "Pikachu Alt Art") → `tcg_card_printing` (leaf, condition+foil variants as attributes on the leaf, not sub-entities)
- **LEGO (planned):** `lego_set_base` (parent) → `lego_set_edition` (leaf, regional and release-year variants)

Rule: **if two things share a catalog name but differ in ways that affect price, they are one entity with `is_price_defining` attributes, not two entities.** If they differ in ways that affect identity (different silicon, different set numbers), they are separate entities.

### Variants as attributes, not as entities

**Memory capacity, condition grade, foil vs non-foil, 1st edition vs unlimited, regional release, color variant** — all of these are `entity_attributes(is_price_defining=true)` on a single canonical_entities row, not separate rows.

Rationale: retailers list "RTX 5060 Ti" as one product family with two SKUs (8GB, 16GB). Our canonical should match their mental model. Price tracking per-variant is handled by the leaf entity recording its variant attributes, not by multiplying the entity count.

Source imports that arrive with variants already split (e.g. dbgpu ships "RTX 5060 Ti 8 GB" and "RTX 5060 Ti 16 GB" as separate rows) MUST be collapsed in the import pipeline before they land in `canonical_entities`. See §5 "three-phase catalog import."

### display_name strategy

`canonical_name` is the form scrapers match retailer listings against — messy but necessary.
`display_name` is what users see on product pages.

During early migration, `display_name` is left NULL and the frontend falls back to `canonical_name`. A polish pass in **Week 5+** will derive cleaner display names from chip parent + board partner + product line. Don't do this work before the tree structure and matching are stable and we've seen actual rendered pages.

### What this enables

- **Tree hierarchy:** MacBook → MacBook Pro → MacBook Pro 16" → MacBook Pro 16" M3 Max → leaf. Via `parent_entity_id`.
- **Leaf-level pricing:** Only entities with `is_price_defining=true` attributes are the ones retailers attach listings to. Parent nodes aggregate.
- **Cross-vertical queries:** Same tables hold a GPU, a Pokemon card, a LEGO set. Joins are the same.
- **Source provenance:** We always know where a canonical identity came from.

### Migration from `canonical_products`

1. Build the new tables empty. ✅ done 2026-04-20
2. Write a migration script that, for one category at a time, creates `canonical_entities` rows from existing `canonical_products` rows. ✅ GPUs done
3. Attach existing retailer listings as `listings` rows pointing at the new entities. ✅
4. Attach existing price points as `price_observations`. ✅
5. Import catalog source(s) for the vertical as parent entities. ✅ GPUs: dbgpu chips loaded
6. Link existing leaves to parents (write `parent_entity_id`). ✅ GPUs: 95.6% auto-matched
7. Route new scraper output into new tables only. Pending (Week 4 adapter work).
8. Frontend reads switch from old tables to `canonical_entities_view` union. Pending (Week 4).
9. Sunset `canonical_products` once all categories are migrated. Months away.

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
       DONE   ┌───────────────────────┐
              │ Structured tier parse? │  (brand, series, number, suffix)
              │ for typed verticals    │
              └───┬───────────────┬───┘
                  │yes            │no
                  ▼               ▼
              LINK           ┌─────────────────┐
              (auto)         │ Fuzzy trigram?  │
                             └───┬───────────┬─┘
                                 │yes        │no
                                 ▼           ▼
                             LINK or     ┌───────────────────┐
                             REVIEW      │ LLM resolution    │
                                         └───┬───────────┬───┘
                                             │high conf  │low conf
                                             ▼           ▼
                                         LINK        HUMAN REVIEW
                                         (auto)      QUEUE
```

### Tier 1: exact SKU match (free)

If a retailer SKU has been linked to an entity before, auto-link. This catches 80%+ of daily re-scrapes.

### Tier 2a: structured tier parse (free, preferred for typed verticals)

For verticals with predictable model-name structure (GPUs, CPUs, watches with reference numbers, LEGO with set numbers), parse the listing name into structured tokens — e.g. for GPUs, `(brand, series, number, suffix)` — and look up by exact match on those tokens. **This is more reliable than trigram similarity for typed products.**

Trigram similarity is a distance metric over character n-grams; it doesn't know that "RTX 5060" and "RTX 5060 Ti" are different products. Structured parsing does, because the suffix token is part of the key.

Tier 2a was proven on the GPU board→chip linking in Week 2: structured parsing gave 88.3% exact matches where pg_trgm had given 1.6%.

### Tier 2b: deterministic fuzzy match (cheap, fallback)

For verticals where names don't structure well (free-form laptop names, loose camera model strings, TCG variant names), Postgres pg_trgm on canonical_name within the same brand + category. Similarity > 0.85 auto-links.

pg_trgm remains useful but it is no longer the default first-line matcher.

### Tier 3: LLM resolution (paid, rare)

Only fires when tiers 1 and 2 miss. We pass the LLM: the raw listing title, the brand, the top 5 fuzzy candidates, and ask "is this a match to one of these, or is this a new entity?"

Use the cheapest LLM that performs acceptably. Current candidates: Claude Haiku, GPT-4o-mini, Gemini Flash. Plan for $0.0005-$0.002 per call.

**Budget:** New listings per day post-launch will be maybe 500-2000 (most daily scrapes are unchanged). At $0.002 each worst case, $1-4/day = $30-120/mo. Under budget if we're disciplined.

### Tier 4: local Ollama verification (free)

For the tier 3 LLM result, run a local Ollama model as a sanity check on high-stakes links (price-defining entities, popular categories). Two-model consensus. Only fires on a subset to stay fast.

### Tier 5: human review queue

Low-confidence matches, LLM-uncertain matches, ambiguous matches (multiple candidates at same tier key), and any match that would merge two existing entities get routed to a review queue. Simple CRUD page showing pending matches with "approve / reject / new entity" buttons. Expect 50-200 per week.

**The review queue is also the only path for creating new canonical_entities post-initial-seed.** New products released after the catalog source snapshot don't get auto-created — they land in review and a human decides.

### Confidence scoring

Every `listings` row records `match_confidence` (0.0-1.0) and `match_source` (exact/fuzzy/llm/human). Below 0.7 flags for review. Never auto-link below 0.5.

---

## 5. Catalog acquisition strategy

### Core principles

**(1) Prefer freely-licensed reference sources over ad-supported sites.** Wikidata, Scryfall, manufacturer product pages. Specifically, prefer SPARQL/REST endpoints over HTML scraping. Learned 2026-04-20 when TechPowerUp turned out to have proof-of-work challenges and drag-captchas — "scrapable" is not the same as "permitted."

**(2) Store the local dump. Never live-query the source.** Scrape or API-fetch once per source, store the result as a JSON/CSV artifact in the repo (or a regenerable vendored file), re-fetch monthly or on-demand. This is both politeness to sources and insulation from source-side changes (anti-scrape additions, schema changes, outages, takedowns).

**(3) New canonicals come from the review queue, not from automated scraping.** After the initial seed, dbgpu/Wikidata/whatever gets re-imported periodically — but the diff goes to the human review queue, it isn't auto-applied. This keeps the catalog clean.

**(4) Catalog sources have errors.** Don't treat any source as ground truth. Expect a few percent of entries to have mislabeled codenames, wrong release dates, or typos. Bake in the assumption that Week 3's review queue will surface these, and flag them for correction.

### Three-phase catalog import

Every new source import follows three phases, executed in order, each idempotent:

**Phase 1 — Raw ingest.** Pull data from the source exactly as the source structures it. Write a vendored local copy to `catalog/<source>/raw/` (or JSON dump in `catalog/<source>/`). No Supabase writes. Repeatable monthly.

**Phase 2 — Collapse.** Apply vertical-specific rules to merge the source's redundant entries into canonical shape. Per §3 variant-as-attribute rule: memory variants, condition SKUs, foil variants, edition variants, regional variants all fold into their parent entity as `entity_attributes`. Phase 2 is the hardest phase and has no generic solution — each source has its own redundancies that require vertical-specific collapse logic.

**Phase 3 — Link.** Wire up parent/child relationships between the newly-imported source entities and the existing catalog (chip→boards, set→editions, base model→limited editions). Usually involves the tiered matcher from §4.

**Budget 1-3 days per new catalog source** for the combined three phases. Most of it is Phase 2 learning what the source's quirks are. This is invisible work that doesn't show up in feature counts but is what makes the catalog trustworthy.

### Per-vertical source picks

**GPUs (Phase 0):** dbgpu (PyPI, MIT, vendored bundle of TechPowerUp's data) as near-term seed. **Long-term: Wikidata SPARQL** for chip identity data, supplemented by NVIDIA / AMD / Intel product pages for current-generation spec detail. dbgpu is a one-maintainer project so it's a medium-term bus-factor risk; Wikidata is the durable replacement. **Not used: direct TechPowerUp scraping.** They have PoW + drag-captcha; they've explicitly asked not to be machine-accessed.

**CPUs (Phase 0):** TBD. Candidates: dbgpu's CPU side, manufacturer ARK/spec pages (Intel/AMD), Wikidata.

**Laptops (Phase 0):** Hardest. NotebookCheck has a big database. Manufacturer sites are fragmented. May need manual curation for top 500 SKUs.

**Motherboards, RAM, SSDs, PSUs (Phase 0):** Manufacturer sites + existing canonicals. Medium difficulty.

**Peripherals (Phase 0):** Manufacturer sites. Long tail is messy. Accept imperfection.

**TCG (Phase 1):** Scryfall for MTG (free, clean, API). TCGplayer for Pokemon / sports / Yu-Gi-Oh — reconnaissance needed before committing: they may have added anti-scrape.

**Sealed video games (Phase 1):** PriceCharting. Scrapable.

**LEGO (Phase 1):** BrickLink + Rebrickable. Reconnaissance needed.

**Comics (Phase 1):** GoCollect. Reconnaissance needed.

**Watches (Phase 2):** Wikidata + manufacturer. Chrono24 is hostile; skip.

### What about items no catalog source has?

Long-tail, brand-new, obscure items not in any external catalog enter the system through the resolution engine's review queue (§4 T5). A retailer listing that can't be matched becomes a candidate "new canonical." A human decides whether it's a real new canonical or a variant of an existing one, and approves. Nothing auto-creates canonicals post-initial-seed.

---

## 6. Scraper architecture

### Current state

Site-first scrapers, one per retailer. They enumerate categories, extract listings, normalize, insert into `products` table with a canonical_id guess.

### Target state

**Catalog-first scrapers:** for each entity in the catalog, check each retailer for matching listings. Discovery scrapers still exist for finding new entities not yet in the catalog. New-entity candidates go to the review queue (§4 T5), not auto-insert.

### Adapter pattern

```
interface RetailerAdapter {
  name: string
  country_code: string

  // Find listings by querying the retailer's search with a known entity.
  findByEntity(entity: CanonicalEntity): Promise<ListingCandidate[]>

  // Fallback: enumerate a category for discovery.
  enumerateCategory(category: string): Promise<ListingCandidate[]>

  // Fetch current price for a known listing URL.
  fetchPrice(listingUrl: string): Promise<PriceSnapshot>
}
```

One adapter per retailer. Adding a new retailer = writing one file. The job orchestrator calls adapters uniformly.

### Retailer priority order

1. **Best Buy Canada** — public REST API. Ship first.
2. **Memory Express** — standard HTML. Previously blocked our IP during a scraper attempt — approach with caution.
3. **Walmart Canada** — `__NEXT_DATA__` JSON + `curl_cffi` for Akamai TLS fingerprint.
4. **Staples Canada** — HTML + JSON-LD.
5. **Canada Computers** — already integrated. Keep running.
6. **Newegg Canada** — already integrated. Keep running.
7. **Vuugo** — already integrated.
8. **Visions Electronics** — already integrated.

**Not scraped, ever:** Amazon, eBay, Facebook Marketplace, Kijiji.

### Scheduling

**Daily full scrape** for entities in the active catalog. **Hourly delta scrapes** for top 1000 entities (later). **On-demand re-scrape** triggered when a user views a product page with stale data (>24h old) (later).

---

## 7. Tech stack

### Stays

- **Next.js 16 (App Router) on Vercel** — frontend
- **Supabase Postgres** — main database
- **Python scrapers on Windows** — fine for now
- **Resend for email** — price alerts
- **Existing UI design tokens** — teal accent, Sora/DM Sans, dark theme

### Changes

- `canonical_products` deprecated over 6-12 months
- `products` becomes `listings` in the new schema
- Homepage moves to "encyclopedia framing" once new tables have data

### New

- **LLM gateway service** — thin wrapper, batches calls, caches by input hash, falls back Claude → GPT → Gemini, hard $100/mo cap, circuit-breaker at 80%
- **Ollama instance** — local LLM for deterministic verification
- **Job queue** — Postgres-based (river/graphile-worker-style), runs scraper adapters against the catalog
- **Human review UI** at `/admin/review` — approves low-confidence matches AND new-canonical candidates
- **Per-source import scripts** in `catalog/<source>/` — raw ingest + collapse + link, each phase separately runnable, vendored JSON artifacts committed to repo

---

## 8. Monetization sequence

### Phase 0 (now): Affiliate only

Every retailer "View at X" button is an affiliate link where supported. Canada Computers, Newegg, Best Buy have affiliate programs. Revenue is small but non-zero.

### Phase 1 (post-catalog-first, months 3-6): Affiliate scaled

More retailers = more affiliate coverage. SEO traffic compounds as canonical pages rank for long-tail queries. Expect 10-50x growth purely from traffic.

### Phase 2 (months 6-12): API access + premium tier

- **Free tier:** same as today, with rate limits
- **Premium ($5-10/mo):** unlimited alerts, portfolio tracking, history export, API access
- **Business API ($50-500/mo):** bulk API for resellers, price intelligence tools, insurance appraisers, market research

### Phase 3 (year 2+): Data licensing

When the catalog is authoritative, businesses will pay for it. Insurance companies appraising collections, pawnshops pricing inventory, secondary-market resellers.

### What we don't do

- **No ads ever.**
- **No paywalled content.** The catalog is free to browse.
- **No sponsored product placements.**

---

## 9. Stopping rules and phase metrics

### Phase 0 complete when

- [ ] Top 500 Google searches for "X price history Canada" include at least one TrackAura result in positions 1-10
- [ ] At least 3 retailers per top-1000-product
- [ ] Weekly organic traffic growing 5%+ week-over-week for 4 consecutive weeks

### Phase 1 (first new vertical) start when

- [ ] Phase 0 traffic has plateaued for 2+ weeks OR is solid enough to sustain
- [ ] Electronics entity resolution runs without human intervention on >95% of daily scraped listings
- [ ] Monthly infra + LLM costs under $100 consistently
- [ ] Review queue processed to zero weekly (no backlog)
- [ ] Phase 1 source scrape-ability reconnaissance complete (per §2 caveat)

### Metrics we track weekly

- Entity count (total, per vertical)
- Listings-per-entity median
- Active retailers per entity median
- Daily resolution engine stats: auto-linked / reviewed / LLM-resolved
- Human review queue depth (and queue aging)
- Organic traffic (GSC + Google Analytics)
- Monthly infra cost
- Monthly LLM cost

### Metrics we explicitly DON'T track

- Daily active users (meaningless pre-community)
- Session duration (gameable, misleading)
- Page views (correlate with traffic, no new info)

---

## 10. 30-day checklist and progress

### Week 1 — schema foundation ✅ DONE 2026-04-20

- [x] New tables live in Supabase (canonical_entities + 6 others, pg_trgm, indexes)
- [x] `canonical_entities_view` unions old + new for frontend transition
- [x] GPU migration script: 1,522 canonicals, 1,498 listings, 14,388 price_observations moved to new tables

### Week 2 — GPU catalog seed and linking ✅ DONE 2026-04-20

- [x] dbgpu chip extractor → `catalog/dbgpu/chips.json` (1,769 chips vendored)
- [x] Supabase loader for chips as parent canonical_entities (1,769 rows, entity_type='gpu_chip')
- [x] Memory-variant collapse (41 safe groups, 44 rows merged into entity_attributes)
- [x] Structured tier-parse matcher linked 1,455 / 1,522 boards to chip parents (95.6%)
- [x] 67 unmatched boards remain for Week 3 review queue

### Week 3 — resolution engine + review UI

- [ ] Resolution engine: tiers 1 → 2a (structured parse) → 2b (fuzzy) → 3 (LLM) → 4 (Ollama) → 5 (review)
- [ ] LLM gateway service with budget cap + circuit-breaker
- [ ] Admin review UI at `/admin/review`, shared-secret auth
- [ ] Clear the 67 unparented GPU boards through the review queue
- [ ] Run resolution engine on live CC/Newegg GPU listings, measure auto-link rate

### Week 4 — catalog-first scraping + Best Buy Canada

- [ ] RetailerAdapter interface
- [ ] Port Canada Computers + Newegg scrapers to adapter interface
- [ ] Build Best Buy Canada adapter (public API)
- [ ] Wire catalog-first daily job for GPUs
- [ ] Frontend switches to reading from `canonical_entities_view` (transparent cutover)

### End of month 1 success criteria

- GPU vertical runs on new architecture end-to-end
- Other verticals still run on old architecture; site not broken
- Best Buy Canada integrated for GPUs
- Human review queue exists and is actively used
- Richer data visible on live GPU product pages

---

## 11. Risk register

### High risk

1. **Scope creep.** Mitigation: §9 stopping rules.
2. **LLM costs spiral.** Mitigation: hard $100/mo cap in gateway, circuit-breaker to review queue at 80%.
3. **Solo burnout.** Mitigation: 30-day checklist, small shippable milestones.
4. **Catalog source breaks or goes hostile.** Mitigation: vendored local dumps, never live-query (§5 principle #2). Proven necessary 2026-04-20 when TechPowerUp's PoW surfaced.
5. **Per-source collapse is a tax.** Budget 1-3 days per new catalog source for Phase 2 (§5). Scope-plan accordingly. Hit this on dbgpu in Week 2.
6. **Catalog sources have errors.** Treat as signal, not truth. Review queue surfaces them (§5 principle #4). Example: dbgpu has at least one wrong codename (AMD R7 M350 "Meso" vs "Litho" — neither is a real AMD codename).

### Medium risk

7. **Retailer blocks scrapers.** Mitigation: curl_cffi TLS fingerprinting (already used for Walmart). Rotate user agents. Respect rate limits. Move on if blocked — we have 8 retailer plans.
8. **Legal pressure from a retailer.** Low probability solo, higher at scale. Mitigation: stay affiliate-legitimate, not price-underminer.
9. **Supabase hits pricing tier.** Watch monthly bill. Partition aggressively. Archive price_observations after 2 years.

### Low risk

10. **Copy-cat competitor.** Moat is catalog, not features. 18 months of catalog work is hard to replicate.
11. **Google algo change tanks SEO.** Diversify traffic once organic flows — Reddit, RFD, Twitter.
12. **Tech changes underneath.** Pin versions, upgrade deliberately.

---

## 12. Open questions

- **[TBD]** Exact LLM provider strategy. Haiku vs GPT-4o-mini vs Gemini Flash. Pick after first 1000 real calls.
- **[TBD]** Ollama model for local verification. Llama 3 8B probably.
- **[TBD]** Job queue tech. Start with Postgres polling, migrate if slow.
- **[TBD]** Admin review UI auth. Shared secret URL initially.
- **[TBD]** Portfolio features design. Phase 2+.
- **[TBD]** Brand strategy at 100k MAU.
- **[TBD]** Rebrand UI colors.
- **[TBD]** TCGplayer anti-scrape reconnaissance (before Phase 1 start).
- **[TBD]** Wikidata SPARQL migration for GPU chip identity (Week 5+).
- **[TBD]** display_name cleanup pass for migrated entities (Week 5+).
- **[TBD]** Entity-type naming: migrate `gpus` → `gpu_board` for consistency?

---

## 13. Session protocol

1. Every session starts with "is the architecture bible current?" If we made changes last session, they're in the doc.
2. Every session ends with "what decisions did we make?" If any, update the doc.
3. When Claude proposes a change that contradicts the doc, Claude must flag the contradiction before proceeding.
4. When you push back on a Claude suggestion, the pushback gets captured — even if the suggestion is rejected, the reasoning helps future sessions.
5. Concrete code gets generated against the architecture described here. If the architecture is wrong, fix the doc first.
6. **Grep before deleting.** When cleaning up files, check imports first. This doc is the record of what's intentional; the code is the record of what's used.

---

## 14. What success looks like in 12 months

- TrackAura.com is the first Google result for 500+ "product X price history Canada" queries.
- 3 verticals live: electronics (deep), one collectibles vertical (medium), one other (shallow).
- 50,000+ monthly unique visitors from organic search.
- Catalog of 100,000+ canonical entities across verticals.
- Monthly revenue of $500-2000 from affiliate + early premium users.
- Monthly cost of $100-200 infra + LLM.

And — more important than the metrics — a foundation that makes the next 12 months 10x easier than the last 12.

---

*End of Draft 2. Amend when reality requires.*
