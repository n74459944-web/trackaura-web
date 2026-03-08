# TrackAura Frontend — Setup Guide

## Quick Start

### 1. Install dependencies

```bash
cd C:\Users\crown\trackaura-web
npm install recharts
```

### 2. Export your real data

Run this from your **price-tracker** folder:

```bash
cd C:\Users\crown\price-tracker
python C:\Users\crown\trackaura-web\scripts\export_data.py
```

This reads `prices.db` and writes JSON files to `trackaura-web/public/data/`.

### 3. Run the dev server

```bash
cd C:\Users\crown\trackaura-web
npm run dev
```

Open http://localhost:3000 — you should see TrackAura with your real product data.

### 4. Deploy to Vercel

```bash
npm i -g vercel
vercel
```

Follow the prompts. Once deployed, point TrackAura.com to your Vercel project in GoDaddy DNS settings.

## Keeping Data Fresh

After each scrape cycle, re-run the export script and push to trigger a Vercel rebuild:

```bash
cd C:\Users\crown\price-tracker
python C:\Users\crown\trackaura-web\scripts\export_data.py
cd C:\Users\crown\trackaura-web
git add public/data
git commit -m "Update price data"
git push
```

Or add this to your `run_all.py` after the sync step.

## File Structure

```
trackaura-web/
  public/data/              ← Generated JSON data (from export script)
    products.json            ← All products with latest prices
    stats.json               ← Site-wide stats
    history/                 ← Per-product price history
      1.json, 2.json, ...
  scripts/
    export_data.py           ← SQLite → JSON export script
  src/
    app/
      layout.tsx             ← Root layout (Header + Footer)
      page.tsx               ← Homepage
      products/
        page.tsx             ← Product listing with filters
      product/[slug]/
        page.tsx             ← Individual product page
    components/
      Header.tsx             ← Sticky nav bar
      Footer.tsx             ← Footer with links
      SearchBar.tsx          ← Live product search
      ProductCard.tsx        ← Product card for listings
      PriceChart.tsx         ← Price history chart (recharts)
      StatsBar.tsx           ← Stats display
    lib/
      data.ts                ← Data loading utilities
    types/
      index.ts               ← TypeScript types
```
