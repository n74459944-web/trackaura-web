# TrackAura

**Canadian electronics price tracker** — real-time pricing across major Canadian retailers with historical tracking, price drop alerts, and deal discovery.

🌐 [trackaura.com](https://trackaura.com)

---

## What It Does

TrackAura scrapes product prices from Canadian electronics retailers every 4 hours and tracks them over time. It gives Canadian shoppers something that barely exists north of the border: transparent, independent price history for the stuff they actually buy.

- **6,400+ products** across 17 categories (GPUs, CPUs, laptops, monitors, SSDs, RAM, and more)
- **Price history charts** — see how prices have moved over time, not just today's number
- **Price drop alerts** — get emailed when a product you're watching hits a new low
- **Deals page** — surface the biggest recent drops across all categories
- **Price Index** — category-level price trends built from raw scraped data (the seed of something bigger)
- **Buying guides** — auto-generated best-of lists per category, ranked by value

## Why

Canada has almost no independent price tracking tools. PCPartPicker covers some ground, but it's US-first and limited to PC components. There's no Canadian equivalent of CamelCamelCamel that works across multiple retailers, and no one is building a consumer-facing price index from actual scraped retail data.

TrackAura started as a personal tool to stop overpaying for PC parts. It's growing into something more ambitious — an independent price index for Canadian retail, built from the ground up on real transaction-level data.

## Tech Stack

| Layer | Tech |
|-------|------|
| **Frontend** | Next.js (TypeScript, Tailwind CSS, App Router) |
| **Hosting** | Vercel |
| **Scraping** | Python, Playwright, Chromium |
| **Database** | SQLite (local), Supabase (auth & alerts) |
| **Email** | Resend |
| **Analytics** | Google Analytics |

## Architecture

```
┌─────────────────────┐     ┌──────────────────┐
│   Python Scrapers   │────▶│  SQLite Database  │
│  (Playwright + Cr.) │     │  (price history)  │
└─────────────────────┘     └────────┬─────────┘
        ▲                            │
        │ every 4 hrs                │ JSON export
        │                            ▼
┌───────┴─────────┐         ┌──────────────────┐
│ categories.json │         │   Next.js App     │
│  (config-driven │         │  (Vercel deploy)  │
│   scrape rules) │         └──────────────────┘
└─────────────────┘
```

- **Config-driven scrapers** — adding a new category or retailer is a JSON config change, not a code change
- **Automated pipeline** — scrapes run every 4 hours on a local machine, data syncs to the frontend via Git
- **Parallel scraping** — categories are scraped concurrently with a 15-minute timeout per run

## Retailers

- Canada Computers
- Newegg Canada

(More coming — Amazon.ca and Best Buy Canada were evaluated but their anti-bot systems are too aggressive for reliable scraping.)

## Categories

GPUs · CPUs · RAM · Motherboards · SSDs · Monitors · Laptops · Keyboards · Mice · Headphones · Speakers · Webcams · Routers · CPU Coolers · Power Supplies · External Storage · Cases

## Roadmap

- [ ] Expand to additional Canadian retailers
- [ ] Improve search (multi-word query support)
- [ ] Add HDDs category
- [ ] Expand beyond electronics — groceries, household goods, auto parts
- [ ] Build out the True Price Index as a standalone data product
- [ ] User accounts with portfolio tracking
- [ ] P2P marketplace for buying/selling/trading

## About

Built solo by a developer in Quebec, Canada. This started as a side project and is growing into something real. The long-term vision is an independent Canadian price index built from raw retail data — no hedonic adjustments, no substitution effects, just what things actually cost.

## License

All rights reserved. Source code is shared for transparency. Not licensed for redistribution or commercial use.
