"""
Export prices.db to JSON files for the Next.js frontend.

Run this from your price-tracker folder:
    python C:\\Users\\crown\\trackaura-web\\scripts\\export_data.py

It reads prices.db and categories.json, then writes JSON files
to the trackaura-web/public/data/ folder.
"""

import sqlite3
import json
import os
import re
from datetime import datetime

# --- CONFIGURE THESE PATHS ---
DB_PATH = os.environ.get("DB_PATH", "prices.db")
OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "data")
CONFIG_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "price-tracker", "categories.json")

# If running from price-tracker folder, override paths:
ALT_OUTPUT = r"C:\Users\crown\trackaura-web\public\data"
ALT_CONFIG = r"C:\Users\crown\price-tracker\categories.json"
if os.path.isdir(os.path.dirname(ALT_OUTPUT)):
    OUTPUT_DIR = ALT_OUTPUT
if os.path.isfile(ALT_CONFIG):
    CONFIG_PATH = ALT_CONFIG


def load_category_keywords():
    """Load keyword mappings from categories.json if available."""
    if os.path.isfile(CONFIG_PATH):
        with open(CONFIG_PATH, "r", encoding="utf-8") as f:
            config = json.load(f)
        mappings = {}
        for key, cat in config["categories"].items():
            mappings[key] = cat.get("keywords", [])
        return mappings
    # Fallback hardcoded keywords
    return {
        "headphones": ["headphone", "headset", "earphone", "earbud", "ear bud"],
        "gpus": ["graphics", "gpu", "geforce", "radeon", "rtx", "rx "],
        "ssds": ["ssd", "solid state", "nvme", "m.2"],
        "monitors": ["monitor", "display", "screen"],
        "keyboards": ["keyboard", "mechanical keyboard", "keycap"],
        "mice": ["mouse", "mice", "trackball", "trackpad"],
        "laptops": ["laptop", "notebook", "chromebook"],
    }


def slugify(name: str) -> str:
    """Convert product name to URL-friendly slug."""
    slug = name.lower().strip()
    slug = re.sub(r'[^a-z0-9\s-]', '', slug)
    slug = re.sub(r'[\s-]+', '-', slug)
    slug = slug.strip('-')
    return slug[:120]


# --- Category classification rules ---

# Words that BLOCK a product from being in a category, even if keywords match.
# For example, a laptop with "RTX 5060" should NOT be classified as a GPU.
CATEGORY_BLOCKLIST = {
    "gpus": [
        "laptop", "notebook", "desktop pc", "gaming pc", "prebuilt",
        "pre-built", "all-in-one", "aio pc", "workstation pc",
        "motherboard", "mobo", "mainboard",
        "power supply", "psu",
        "keycap", "key cap", "keyboard",
        "mouse pad", "mousepad", "desk mat",
        "case for", "pc case", "computer case", "tower case",
        "monitor", "display",
        "cpu cooler", "heatsink", "liquid cool",
        "water block", "waterblock", "water cooling block", "gpu block",
        "backplate", "gpu bracket", "gpu holder", "gpu support",
        "anti-sag", "sag bracket","core i3", "core i5", "core i7", "core i9",
        "sandy bridge", "ivy bridge", "haswell", "skylake",
        "dual-core", "quad-core", "6-core", "8-core",
        "desktop processor", "socket am4", "socket lga",
        "desktop processor", "dual-core", "quad-core",
        "sandy bridge", "ivy bridge",
        "core i3", "core i5", "core i7", "core i9",
        "vga fan", "pin fan",
        "80+ gold", "80+ bronze", "80+ platinum",
        "full-modular", "semi-modular",
    ],
    "cpus": [
        "laptop", "notebook", "desktop pc", "gaming pc", "prebuilt",
        "pre-built", "all-in-one", "aio pc",
        "motherboard", "mobo", "mainboard",
        "graphics card", "gpu", "geforce", "radeon",
        "cooler", "heatsink", "liquid cool", "aio",
        "power supply", "psu",
        "ram", "memory module", "dimm",
    ],
    "ssds": [
        "laptop", "notebook", "desktop pc", "gaming pc", "prebuilt",
        "motherboard", "mobo", "mainboard",
        "graphics card", "gpu",
    ],
    "ram": [
        "laptop", "notebook", "desktop pc", "gaming pc", "prebuilt",
        "motherboard", "mobo", "mainboard",
        "graphics card", "gpu",
    ],
    "monitors": [
        "laptop", "notebook",
        "monitor arm", "monitor mount", "monitor stand", "monitor cable",
        "screen protector",
        "television", "smart tv", "oled tv", "qled tv", "led tv",
    ],
    "motherboards": [
        "laptop", "notebook", "desktop pc", "gaming pc", "prebuilt",
        "graphics card",
    ],
    "keyboards": [
        "mouse", "mice",  # Canada Computers shares a keyboards-mice page
    ],
    "mice": [
        "keyboard",  # Opposite direction
    ],
    "coolers": [
        "laptop", "notebook", "desktop pc", "gaming pc", "prebuilt",
        "graphics card", "gpu",
    ],
    "laptops": [],
    "power-supplies": [
        "laptop", "notebook",
    ],
    "cases": [
        "laptop", "notebook",
        "phone case", "tablet case", "ipad case",
    ],
    "routers": [],
    "webcams": [],
    "speakers": [
        "headphone", "headset", "earphone", "earbud",
    ],
    "headphones": [
        "speaker", "soundbar",
    ],
    "external-storage": [],
    "ssds": ["hard drive", "hdd", "barracuda", "ironwolf", "nas drive"],
    "hard-drives": ["ssd", "solid state", "nvme", "m.2", "external", "portable"
    ],
    "tvs": [
        "laptop", "notebook", "monitor", "computer monitor", "gaming monitor",
        "tv mount", "tv stand", "tv wall", "remote control",
        "streaming", "tv box", "fire stick", "chromecast",
    ],
    "tablets": [
        "laptop", "notebook", "desktop",
        "tablet case", "tablet stand", "tablet mount", "screen protector",
        "stylus", "keyboard for",
        "drawing tablet", "graphic tablet", "pen tablet",
    ],
    "printers": [
        "laptop", "notebook",
        "ink cartridge", "toner cartridge", "printer paper", "photo paper",
        "printer cable",
    ],
    "gaming-consoles": [
        "laptop", "notebook", "desktop pc",
        "controller skin", "console skin", "charging dock",
        "headset", "gaming chair",
    ],
    "smart-home": [
        "laptop", "notebook",
        "smart watch", "smartwatch", "fitness tracker",
    ],
    "ups-power": [
        "laptop", "notebook",
        "power supply", "psu", "atx",
    ],
    "network-switches": [
        "laptop", "notebook",
        "nintendo switch", "game", "joy-con", "joycon",
        "kvm switch",
    ],
}

# Strong identifiers that override weaker keyword matches.
# If a product name contains one of these, it's DEFINITELY this category.
STRONG_IDENTIFIERS = {
    "laptops": [
        "laptop", "notebook", "chromebook", "ultrabook",
        "macbook", "thinkpad", "ideapad", "vivobook", "zenbook",
        "rog strix g14", "rog strix g15", "rog strix g16",
        "rog zephyrus", "legion 5", "legion 7", "legion pro",
        "omen transcend", "omen 16", "omen 17",
        "swift go", "swift x", "nitro v",
        "raider ge", "stealth 16", "stealth 14",
        "dell latitude", "dell inspiron", "dell xps",
        "hp pavilion", "hp probook", "hp elitebook",
    ],
    "motherboards": [
        "motherboard", "mainboard", "mobo",
        "lga 1700", "lga 1851", "lga 1200", "lga 1151",
        "socket am4", "socket am5",
        "b650", "b850", "x670", "x870", "z790", "z890",
        "b550", "b450", "a620", "b760", "h770", "b660",
        "b365m", "h81 m-atx",
    ],
    "coolers": [
        "cpu cooler", "cpu liquid cooler", "aio cooler",
        "cpu heatsink", "liquid cooling",
        "noctua nh-", "hyper 212",
        "240mm radiator", "280mm radiator", "360mm radiator",
        "hyperflow", "kraken", "icue elite",
    ],
    "cases": [
        "computer case", "pc case", "atx case", "mid tower",
        "mini itx case", "micro atx case", "full tower",
        "tempered glass case", "chassis",
    ],
    "mice": [
        "gaming mouse", "wireless mouse", "mouse pad", "mousepad",
        "desk mat", "mouse mat",
    ],
    "keyboards": [
        "keycap", "key cap", "keycaps",
        "gaming keyboard", "mechanical keyboard", "wireless keyboard",
    ],
    "monitors": [
        "computer monitor", "gaming monitor", "office monitor",
        "curved monitor", "ultrawide monitor", "portable monitor",
        "ips monitor", "oled monitor", "4k monitor",
    ],
    "ssds": [
        "ssd", "solid state drive", "nvme drive",
        "with heatsink",
    ],
    "hard-drives": ["barracuda", "ironwolf", "wd red", "wd blue", "wd black", "wd gold", "wd purple", "red plus", "red pro", "ultrastar"
    ],
    "tvs": [
        "smart tv", "oled tv", "qled tv", "led tv", "mini led tv",
        "4k uhd tv", "8k tv", "television",
        "nanocell", "bravia", "roku tv", "fire tv", "google tv",
        "webos", "tizen",
    ],
    "tablets": [
        "ipad", "ipad pro", "ipad air", "ipad mini",
        "galaxy tab", "surface pro", "surface go",
        "fire tablet", "kindle",
    ],
    "printers": [
        "inkjet printer", "laser printer", "photo printer",
        "all-in-one printer", "multifunction printer",
        "laserjet", "pixma", "ecotank", "supertank",
    ],
    "gaming-consoles": [
        "playstation 5", "ps5", "xbox series", "nintendo switch",
        "steam deck", "rog ally", "legion go",
        "dualsense", "xbox controller",
    ],
    "smart-home": [
        "echo dot", "echo show", "google nest", "google home",
        "smart plug", "smart bulb", "smart light",
        "ring doorbell", "blink camera", "wyze cam",
        "smart display", "smart thermostat",
    ],
    "ups-power": [
        "ups ", "uninterruptible", "battery backup",
        "surge protector", "power bar",
        "cyberpower", "apc back-ups", "apc smart-ups",
    ],
    "network-switches": [
        "ethernet switch", "network switch", "gigabit switch",
        "managed switch", "unmanaged switch", "poe switch",
        "8-port switch", "16-port switch", "24-port switch", "48-port switch",
    ],
}

# Categories checked in priority order.
# More specific categories FIRST so they match before generic ones.
CATEGORY_PRIORITY = [
    "laptops",        # Check first: laptops contain CPU/GPU keywords
    "tablets",        # Before monitors: tablets have "display" keywords
    "tvs",            # Before monitors: TVs have "display" and "screen" keywords
    "motherboards",   # Motherboards contain CPU socket keywords
    "coolers",        # Coolers mention CPU brands
    "cases",          # Cases mention ATX/tower keywords
    "mice",           # Before keyboards (shared CC page)
    "keyboards",      # Before keyboards
    "monitors",
    "headphones",
    "speakers",
    "webcams",
    "routers",
    "network-switches",  # After routers: switches share networking keywords
    "gaming-consoles",
    "smart-home",
    "printers",
    "ups-power",
    "external-storage",
    "gpus",           # Late: many products mention GPU keywords
    "cpus",           # Late: many products mention CPU keywords
    "ssds",
    "hard-drives",
    "ram",
    "power-supplies",
]


def guess_category(name: str, url: str, keywords_map: dict) -> str:
    """Guess product category from name using config keywords + validation rules."""
    name_lower = name.lower()

    # Accessories that get miscategorized — send to "other"
    accessory_words = [
        "cable", "adapter", "converter", "splitter", "extender", "extension",
        "bracket", "mount", "stand", "holder", "riser", "hub",
        "cleaning", "cloth", "wipe", "tool kit", "screwdriver",
        "earpad", "ear pad", "replacement pad", "cushion",
        "sticker", "decal", "skin", "cover", "sleeve", "bag", "case for",
        "anti-static", "thermal paste", "thermal pad", "heatsink for",
    ]
    is_accessory = any(w in name_lower for w in accessory_words)
    if is_accessory:
        # Still allow some categories for accessories (keycaps -> keyboards, mouse pad -> mice)
        for cat_key in ["keyboards", "mice"]:
            strong = STRONG_IDENTIFIERS.get(cat_key, [])
            if any(s in name_lower for s in strong):
                return cat_key
        return "other"

    # Step 1: Check strong identifiers first (highest confidence)
    for cat_key in CATEGORY_PRIORITY:
        strong = STRONG_IDENTIFIERS.get(cat_key, [])
        if any(s in name_lower for s in strong):
            return cat_key

    # Step 2: Keyword matching with blocklist validation, in priority order
    for cat_key in CATEGORY_PRIORITY:
        keywords = keywords_map.get(cat_key, [])
        if not keywords:
            continue

        # Check if any keyword matches
        has_keyword = any(kw in name_lower for kw in keywords)
        if not has_keyword:
            continue

        # Check blocklist — if ANY blocklist word is present, skip this category
        blocklist = CATEGORY_BLOCKLIST.get(cat_key, [])
        is_blocked = any(bw in name_lower for bw in blocklist)
        if is_blocked:
            continue

        return cat_key

    return "other"

def make_short_name(name: str) -> str:
    """Create a clean short product name for card displays.
    
    Strategy: Keep brand + model + one key spec (capacity/size).
    Strip everything that's specs, marketing, or redundancy.
    """
    short = name.strip()

    # 1. Remove parenthesized part/model numbers anywhere
    #    e.g., (MZ-V9P1T0B/AM), (BX8071512400), (Black)
    short = re.sub(r'\s*\([A-Z0-9][A-Z0-9\-\/\.]{4,}\)', '', short)

    # 2. Remove everything after these cut-off phrases
    #    These indicate the start of marketing/spec dumps
    cut_phrases = [
        r',?\s*Seq\.?\s*Read\s+Speed',
        r',?\s*Up\s+to\s+[\d,]+\s*MB/s',
        r',?\s*Best\s+for\s+',
        r',?\s*for\s+High\s+End\s+',
        r',?\s*for\s+AI\s+Computing',
        r',?\s*for\s+Gaming\s+and\s+',
        r',?\s*for\s+Work/Game',
        r',?\s*for\s+Gaming\s*&',
        r',?\s*for\s+Home\s+Office',
        r',?\s*Internal\s+Solid\s+State',
        r',?\s*Internal\s+Gaming\s+SSD',
        r',?\s*Internal\s+SSD',
        r',?\s*Solid\s+State\s+Drive',
        r',?\s*with\s+Height\s+Adjustable',
        r',?\s*with\s+Stitched\s+Edge',
        r',?\s*with\s+Adjustable',
        r',?\s*Non-Slip\s+Rubber',
        r',?\s*with\s+Google\s+Assistant',
        r',?\s*with\s+NF-[A-Z]',
        r',?\s*with\s+High-Performance',
        r',?\s*with\s+NA-HC',
        r',?\s*Compatible\s+with\s+',
        r',?\s*Support[s]?\s+\d+mm\s+Radiator',
        r',?\s*Supports?\s+M-ATX',
    ]
    for pattern in cut_phrases:
        short = re.split(pattern, short, flags=re.IGNORECASE)[0]

    # 3. Remove redundant repeated brand/model info after a dash
    #    e.g., "Intel Core i5-12400 - Core i5 12th Gen Alder Lake 6-Core..."
    #    Keep everything before the " - " if what follows repeats earlier info
    if ' - ' in short:
        parts = short.split(' - ', 1)
        before_words = set(parts[0].lower().split())
        after_words = set(parts[1].lower().split()[:5])
        overlap = before_words & after_words
        # If 2+ words from before appear in after, it's redundant
        if len(overlap) >= 2:
            short = parts[0]

    # 4. Remove spec dumps: long sequences of specs after the model
    #    Pattern: number + Buttons, number + x Wheel, number + dpi, etc.
    spec_patterns = [
        r'\s+\d+\s+Buttons\s+.*$',
        r'\s+\d+\s+x\s+Wheel\s+.*$',
        r'\s+USB\s+(2\.0|3\.0|3\.2|Wired)\s+\d+\s+dpi\s+.*$',
    ]
    for pattern in spec_patterns:
        short = re.sub(pattern, '', short, flags=re.IGNORECASE)

    # 5. Remove trailing color words if name is still long
    if len(short) > 60:
        short = re.sub(r'\s*[-,]\s*(Black|White|Red|Blue|Green|Grey|Gray|Silver|Gold|Pink|Brown)\s*$', '', short, flags=re.IGNORECASE)

    # 6. Remove trailing punctuation and cleanup
    short = re.sub(r'[\s,\-]+$', '', short).strip()
    
    # 7. Remove trailing lone dash or incomplete words
    short = re.sub(r'\s+-\s*$', '', short).strip()
    short = re.sub(r'\s+\w$', '', short).strip()  # trailing single char

    # 8. Cap at 70 chars with clean word break
    if len(short) > 70:
        short = short[:70]
        last_space = short.rfind(' ')
        if last_space > 25:
            short = short[:last_space]
        short = re.sub(r'[\s,\-]+$', '', short)

    # 9. Safety: if we trimmed too aggressively, fall back to first 70 chars
    if len(short) < 10:
        short = name[:70]
        last_space = short.rfind(' ')
        if last_space > 25:
            short = short[:last_space]
        short = re.sub(r'[\s,\-]+$', '', short)

    return short

def export():
    if not os.path.exists(DB_PATH):
        print(f"ERROR: Database not found at {DB_PATH}")
        print("Run this script from your price-tracker folder, or set DB_PATH env var.")
        return

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    os.makedirs(os.path.join(OUTPUT_DIR, "history"), exist_ok=True)

    keywords_map = load_category_keywords()
    print(f"Loaded {len(keywords_map)} categories from config")

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
            p.image_url,
            p.brand,
            p.description,
            p.specs,
            p.source_category,
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
    reclassified = 0
    for row in rows:
        slug = slugify(row["name"])
        if slug in seen_slugs:
            seen_slugs[slug] += 1
            slug = f"{slug}-{seen_slugs[slug]}"
        else:
            seen_slugs[slug] = 1

        # Prefer source category from retailer, fall back to keyword rules
        # source_category may be a config key ("tvs") or a label ("TVs") from older scrapes
        source_cat = row["source_category"] or ""
        
        # Build label-to-key lookup if not already done
        if not hasattr(export, '_label_to_key'):
            export._label_to_key = {}
            for k, v in keywords_map.items():
                export._label_to_key[k] = k  # key -> key (already correct)
            # Also map labels from categories.json
            if os.path.isfile(CONFIG_PATH):
                with open(CONFIG_PATH, "r", encoding="utf-8") as cf:
                    cfg = json.load(cf)
                for k, v in cfg["categories"].items():
                    export._label_to_key[v["label"].lower()] = k
        
        # Resolve source_category to a config key
        resolved_cat = ""
        if source_cat:
            sc_lower = source_cat.lower()
            if source_cat in keywords_map:
                # Already a valid config key (e.g., "tvs")
                resolved_cat = source_cat
            elif sc_lower in export._label_to_key:
                # It's a label (e.g., "TVs" -> "tvs")
                resolved_cat = export._label_to_key[sc_lower]
        
        if resolved_cat and resolved_cat != "other":
            category = resolved_cat
        else:
            category = guess_category(row["name"], row["url"], keywords_map)

        # Validate: blocklist overrides even retailer-assigned categories
        # (catches accessories that landed on a wrong category page)
        if category != "other":
            name_lower = row["name"].lower()
            blocklist = CATEGORY_BLOCKLIST.get(category, [])
            if any(bw in name_lower for bw in blocklist):
                # Wrong category — try all other categories with full blocklist checks
                category = "other"
                for cat_key in CATEGORY_PRIORITY:
                    if cat_key == resolved_cat:
                        continue
                    keywords = keywords_map.get(cat_key, [])
                    if not keywords:
                        continue
                    if any(kw in name_lower for kw in keywords):
                        cat_blocklist = CATEGORY_BLOCKLIST.get(cat_key, [])
                        if not any(bw in name_lower for bw in cat_blocklist):
                            category = cat_key
                            break

        product = {
            "id": row["id"],
            "name": row["name"],
            "shortName": make_short_name(row["name"]),
            "imageUrl": row["image_url"] or "",
            "brand": row["brand"] or "",
            "description": row["description"] or "",
            "specs": json.loads(row["specs"]) if row["specs"] else {},
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

    # Category breakdown
    print("\nProducts by category:")
    for cat, count in sorted(stats["productsByCategory"].items(), key=lambda x: -x[1]):
        print(f"  {cat}: {count}")

    conn.close()
    print(f"\nAll data exported to: {OUTPUT_DIR}")


if __name__ == "__main__":
    export()
