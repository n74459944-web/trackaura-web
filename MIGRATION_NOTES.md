# TrackAura — Turso Migration Handoff (April 12, 2026 — end of session 6)

**Status:** Step 5 INCOMPLETE. Dedup rolled back cleanly (wrong table name). Turso token expired mid-session. `prices.db` untouched, site still live.

---

## Catalog size correction (carry forward)

Previous sessions said "6,400 products across 2 retailers." Wrong. Actual:
- **37,312 products** in prices.db (pre-dedup; ~36,800 after dedup)
- **3 retailers:** Canada Computers (~8,500), Newegg (~18,650), Vuugo (~10,000)
- 91 empty-URL rows + 196 duplicate URLs to clean up
- Update system prompt for next session.

---

## prices.db schema (confirmed)

**Tables:** `products`, `price_points`, `canonical_products`, `sqlite_sequence`

**products:** `id, name, url, retailer, first_seen, image_url, brand, description, specs, source_category, category, model_key, match_group, canonical_id`

**price_points:** `id, product_id, price, timestamp`

Turso names them `price_history` with column `ts`. `export_data.py` does the rename during sync.

---

## What got done

- Confirmed `lib/data.ts` reads products + history from Turso only
- Deleted `PriceSpy Daily Scrape` task (broken, pointing at nonexistent directory)
- Disabled `TrackAura Daily` + `TrackAura Weekly Digest` (STILL DISABLED)
- Identified three scrapers: `scraper.py`, `scraper_newegg.py`, `scrape_vuugo.py` — all invoked by `run_all.py`

## What failed

- **Dedup script** hit wrong table name (`price_history` instead of `price_points`). Transaction rolled back. prices.db unchanged. Backup: `prices.db.backup-20260412-173945`.
- **Turso auth token expired:** `HTTP 400: JWT error: InvalidToken`. JSON writes succeeded as safety net. Turso is stale but live site still reads fine.
- **Legacy JSON files NOT deleted** — correctly held off.

---

## Resume next session — exact sequence

### 1. Generate new Turso token
Browser: https://turso.tech → database `trackaura` → Create Token. Copy it.

### 2. Set token in env
```powershell
[Environment]::SetEnvironmentVariable("TURSO_AUTH_TOKEN", "NEW_TOKEN", "User")
$env:TURSO_AUTH_TOKEN = "NEW_TOKEN"
```

### 3. Fix `_dedup.py` table name
Edit `C:\Users\crown\price-tracker\_dedup.py`: replace every `price_history` with `price_points`, every `ts` with `timestamp`. Save.

### 4. Run dedup
```powershell
cd C:\Users\crown\price-tracker
python _dedup.py
```
Expected: ~36,828 products remain, 0 empty URLs, 0 duplicate URLs.

### 5. Re-sync Turso
```powershell
python C:\dev\trackaura-web\scripts\export_data.py
```

### 6. Verify
```powershell
turso db shell trackaura "SELECT COUNT(*) FROM products;"
turso db shell trackaura "SELECT COUNT(*) FROM price_history;"
```

### 7. Delete legacy JSON + update .gitignore
```powershell
cd C:\dev\trackaura-web
Remove-Item "public\data\products.json" -ErrorAction SilentlyContinue
Remove-Item "public\data\products" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item "public\data\history" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item "public\data\changes.json" -ErrorAction SilentlyContinue
Add-Content .gitignore "`n# Legacy JSON data (migrated to Turso)`npublic/data/products.json`npublic/data/products/`npublic/data/history/`npublic/data/changes.json"
git add -A
git status
git commit -m "Remove legacy JSON product files, migrate to Turso"
git push
```

### 8. Fix scraper upsert bug (CRITICAL before re-enabling tasks)
Find insert logic:
```powershell
Select-String -Path "C:\Users\crown\price-tracker\scraper.py","C:\Users\crown\price-tracker\scraper_newegg.py","C:\Users\crown\price-tracker\scrape_vuugo.py" -Pattern "INSERT|execute.*products|to_sql|session\.add|session\.merge" -SimpleMatch
```
Patch each to `INSERT INTO products (...) VALUES (...) ON CONFLICT(url) DO UPDATE SET ...` keeping `first_seen` unchanged.

Verify `url` has unique index:
```powershell
python -c "import sqlite3; c=sqlite3.connect('prices.db'); [print(r) for r in c.execute('PRAGMA index_list(products)').fetchall()]"
```
If none: `CREATE UNIQUE INDEX idx_products_url ON products(url);`

### 9. Re-enable tasks (elevated PowerShell)
```powershell
Enable-ScheduledTask -TaskName "TrackAura Daily"
Enable-ScheduledTask -TaskName "TrackAura Weekly Digest"
```

### 10. Line-endings commit
```powershell
cd C:\dev\trackaura-web
git config --global core.autocrlf input
git add --renormalize .
git commit -m "Normalize line endings"
```

---

## Scratch files (clean up after success)

- `_inspect.py`, `_tables.py` — delete anytime
- `_dedup.py` — delete after Step 4 succeeds
- `prices.db.backup-20260412-173945` — keep ~1 week after Step 4

---

## First prompt for next session

> Resume Turso migration from session 6 handoff. Last session ended with dedup rolled back (local price table is `price_points` not `price_history`) and Turso auth token expired. I've generated a new token. Walk me through Steps 2-7.

End of session 6 handoff.
