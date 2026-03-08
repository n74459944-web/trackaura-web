"""
Export prices.db to JSON files for the Next.js frontend.

Run this from your price-tracker folder:
    python C:\\Users\\crown\\trackaura-web\\scripts\\export_data.py

Or copy it into your price-tracker folder and run:
    python export_data.py

It reads prices.db and writes JSON files to the trackaura-web/public/data/ folder.
"""

import sqlite3
import json
import os
import re
from datetime import datetime

# --- CONFIGURE THESE PATHS ---
DB_PATH = os.environ.get("DB_PATH", "prices.db")
OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "data")
# If running from price-tracker folder, override OUTPUT_DIR:
ALT_OUTPUT = r"C:\Users\crown\trackaura-web\public\data"
if os.path.isdir(os.path.dirname(ALT_OUTPUT)):
    OUTPUT_DIR = ALT_OUTPUT


def slugify(name: str) -> str:
    """Convert product name to URL-friendly slug."""
    slug = name.lower().strip()
    slug = re.sub(r'[^a-z0-9\s-]', '', slug)
    slug = re.sub(r'[\s-]+', '-', slug)
    slug = slug.strip('-')
    return slug[:120]  # cap length


def guess_category(name: str, url: str) -> str:
    """Guess product category from name/URL."""
    combined = (name + " " + url).lower()
    if any(kw in combined for kw in ["headphone", "headset", "earphone", "earbud", "ear bud"]):
        return "headphones"
    if any(kw in combined for kw in ["graphics", "gpu", "geforce", "radeon", "rtx", "rx "]):
        return "gpus"
    if any(kw in combined for kw in ["ssd", "solid state", "nvme", "m.2"]):
        return "ssds"
    return "other"


def export():
    if not os.path.exists(DB_PATH):
        print(f"ERROR: Database not found at {DB_PATH}")
        print("Run this script from your price-tracker folder, or set DB_PATH env var.")
        return

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    os.makedirs(os.path.join(OUTPUT_DIR, "history"), exist_ok=True)

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row

    # --- Export products with latest prices ---
    products = []
    rows = conn.execute("""
        SELECT 
            p.id,
            p.name,
            p.url,
            p.retailer,
            p.first_seen,
            pp_latest.price as current_price,
            pp_latest.timestamp as last_updated,
            pp_stats.min_price,
            pp_stats.max_price,
            pp_stats.price_count
        FROM products p
        LEFT JOIN (
            SELECT product_id, price, timestamp
            FROM price_points pp1
            WHERE timestamp = (
                SELECT MAX(timestamp) FROM price_points pp2 WHERE pp2.product_id = pp1.product_id
            )
        ) pp_latest ON p.id = pp_latest.product_id
        LEFT JOIN (
            SELECT 
                product_id,
                MIN(price) as min_price,
                MAX(price) as max_price,
                COUNT(*) as price_count
            FROM price_points
            GROUP BY product_id
        ) pp_stats ON p.id = pp_stats.product_id
        WHERE pp_latest.price IS NOT NULL
        ORDER BY p.name
    """).fetchall()

    seen_slugs = {}
    for row in rows:
        slug = slugify(row["name"])
        # Handle duplicate slugs
        if slug in seen_slugs:
            seen_slugs[slug] += 1
            slug = f"{slug}-{seen_slugs[slug]}"
        else:
            seen_slugs[slug] = 1

        category = guess_category(row["name"], row["url"])
        
        product = {
            "id": row["id"],
            "name": row["name"],
            "slug": slug,
            "url": row["url"],
            "retailer": row["retailer"],
            "category": category,
            "currentPrice": row["current_price"],
            "minPrice": row["min_price"],
            "maxPrice": row["max_price"],
            "priceCount": row["price_count"],
            "firstSeen": row["first_seen"],
            "lastUpdated": row["last_updated"],
        }
        products.append(product)

    # Write products.json
    with open(os.path.join(OUTPUT_DIR, "products.json"), "w") as f:
        json.dump(products, f, indent=2)
    print(f"Exported {len(products)} products to products.json")

    # --- Export price history per product ---
    history_dir = os.path.join(OUTPUT_DIR, "history")
    for product in products:
        history_rows = conn.execute("""
            SELECT price, timestamp
            FROM price_points
            WHERE product_id = ?
            ORDER BY timestamp ASC
        """, (product["id"],)).fetchall()

        history = [{"price": r["price"], "date": r["timestamp"]} for r in history_rows]

        with open(os.path.join(history_dir, f"{product['id']}.json"), "w") as f:
            json.dump(history, f)

    print(f"Exported price history for {len(products)} products")

    # --- Export stats ---
    stats = {
        "totalProducts": len(products),
        "totalPricePoints": conn.execute("SELECT COUNT(*) FROM price_points").fetchone()[0],
        "retailers": list(set(p["retailer"] for p in products)),
        "categories": list(set(p["category"] for p in products)),
        "lastUpdated": datetime.now().isoformat(),
        "productsByRetailer": {},
        "productsByCategory": {},
    }
    for p in products:
        stats["productsByRetailer"][p["retailer"]] = stats["productsByRetailer"].get(p["retailer"], 0) + 1
        stats["productsByCategory"][p["category"]] = stats["productsByCategory"].get(p["category"], 0) + 1

    with open(os.path.join(OUTPUT_DIR, "stats.json"), "w") as f:
        json.dump(stats, f, indent=2)
    print(f"Exported stats.json")

    conn.close()
    print(f"\nAll data exported to: {OUTPUT_DIR}")
    print("Now run: cd trackaura-web && npm run build")


if __name__ == "__main__":
    export()
