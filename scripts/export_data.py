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
        "panoramic case", "atx case", "mini-itx case", "sff case",
        "turbo module", "ventilation add-on",
        "alienware area", "gaming pc windows",
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
        "mouse", "mice",
    ],
    "mice": [
        "keyboard",
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
        "controller skin", "console skin",
        "headset", "gaming chair", "racing chair", "office chair",
        "controller holder", "cable guys",
        "performance grips", "kontrolfreek",
        "stick module", "component pack",
        "vive", "vr2", "pc adapter", "streaming kit",
        "cuisinart", "vacuum bag", "vacuum sealer", "vacuum rol",
        "waffle maker",
        "mini arcade", "micro player", "pocket player",
        "dreamgear", "my arcade", "atari portable",
        "joystick player",
    ],
    "smart-home": [
        "laptop", "notebook",
        "smart watch", "smartwatch", "fitness tracker",
    ],
    "ups-power": [
        "laptop", "notebook",
        "power supply", "psu", "atx",
        "chair", "head cushion",
    ],
    "network-switches": [
        "laptop", "notebook",
        "nintendo switch", "game", "joy-con", "joycon",
        "kvm switch",
    ],
}

# Strong identifiers that override weaker keyword matches.
STRONG_IDENTIFIERS = {
    "laptops": [
        "laptop", "notebook", "chromebook", "ultrabook",
        "macbook", "thinkpad", "ideapad", "vivobook", "zenbook",
        "rog strix g14", "rog strix g15", "rog strix g16",
        "rog zephyrus", "rog flow z13", "rog flow x13",
        "legion 5", "legion 7", "legion pro",
        "omen transcend", "omen 16", "omen 17",
        "swift go", "swift x", "nitro v",
        "raider ge", "stealth 16", "stealth 14",
        "dell latitude", "dell inspiron", "dell xps", "dell pro ",
        "hp pavilion", "hp probook", "hp elitebook",
        "expertbook", "gram evo", "lg gram", "surface laptop",
        "mobile workstation", "copilot+ pc",
        "zbook", "dell pro max",
        "thinkbook", "matebook", "yoga 7", "yoga 9",
        "aspire go", "aspire 3", "aspire 5", "aspire 7",
        "surface pro", "x1 fold",
        "lenovo yoga", "2-in-1",
        "hp elite mini", "elite mini",
    ],
    "motherboards": [
        "motherboard", "mainboard", "mobo",
        "lga 1700", "lga 1851", "lga 1200", "lga 1151",
        "socket am4", "socket am5",
        "b650", "b850", "x670", "x870", "z790", "z890",
        "b550", "b450", "a620", "b760", "h770", "b660",
        "b365m", "h81 m-atx",
        "h610m", "h510m", "h410m", "h310m",
    ],
    "coolers": [
        "cpu cooler", "cpu liquid cooler", "aio cooler",
        "cpu heatsink", "liquid cooling",
        "noctua nh-", "hyper 212",
        "240mm radiator", "280mm radiator", "360mm radiator",
        "hyperflow", "kraken", "icue elite",
        "liquid freezer", "arctic freezer",
        "galahad", "liquid / water cooling", "water cooling",
        "420mm radiator", "hydroshift",
    ],
    "cases": [
        "computer case", "pc case", "atx case", "mid tower",
        "mini itx case", "micro atx case", "full tower",
        "tempered glass case", "chassis",
        "mid-tower", "atx mid-tower", "matx case", "m-atx case",
        "meshify", "define 7", "6500d", "6500x", "cg530", "cg330",
        "cc560", "y70", "2000d rgb", "7000x rgb",
        "mid tower", "full tower", "mini-itx",
        "panoramic case",
    ],
    "mice": [
        "gaming mouse", "wireless mouse", "mouse pad", "mousepad",
        "desk mat", "mouse mat",
        "gaming mice", "productivity mice", "ergonomic mice",
        "wired mouse", "optical mouse", "ambidextrous mice",
        "right-handed mice", "vertical mouse", "deskpad", "desk pad", "desk mat",
    ],
    "keyboards": [
        "keycap", "key cap", "keycaps",
        "gaming keyboard", "mechanical keyboard", "wireless keyboard",
        "numpad", "keypad",
        "gaming keyboards", "wired keyboard", "membrane keyboard",
        "keyboard combo", "keyboard and mouse combo",
    ],
    "monitors": [
        "computer monitor", "gaming monitor", "office monitor",
        "curved monitor", "ultrawide monitor", "portable monitor",
        "ips monitor", "oled monitor", "4k monitor",
        "1920x1080", "1920 x 1080", "2560x1440", "2560 x 1440",
        "3840x2160", "3840 x 2160", "1080p monitor", "4k uhd",
        "lcd ips", "lcd led", "wide lcd",
        "predator x", "predator z",
        "gbmix ", "bmiix ", "bmiipx", "bmiiprx",
        "wmiipx", "gbiipx", "gbiip",
        "adaptivesync", "freesync monitor", "g-sync monitor",
        "ultragear", "ultrawide", "ultrasharp",
        "250nits", "300nits", "350nits", "400nits", "500nits",
    ],
    "power-supplies": [
        "power supply", "psu",
        "500w,", "550w,", "600w,", "650w,", "700w,", "750w,", "800w,",
        "850w,", "1000w,", "1200w,", "1600w,", "1800w,",
        "500w ", "550w ", "600w ", "650w ", "700w ", "750w ", "800w ",
        "850w ", "1000w ", "1200w ", "1600w ", "1800w ", "2400w ", "2500w ",
        "80 plus gold", "80 plus bronze", "80 plus platinum",
        "80+ gold", "80+ bronze", "80+ platinum",
        "sfx form factor", "atx form factor", "tfx form factor",
    ],
    "routers": [
        "wifi router", "wireless router", "mesh router",
        "wifi repeater", "wifi extender", "wifi modem",
        "wireless repeater", "wireless extender",
        "ap router", "ceiling ap", "access point",
        "lte router", "lte cpe", "4g router", "5g router",
        "range extender", "amplifi", "dream machine", "cloud gateway", "ucg-ultra",
    ],
    "ssds": [
        "ssd", "solid state drive", "nvme drive",
        "with heatsink",
        "solid state disk", "msata",
    ],
    "hard-drives": [
        "barracuda", "ironwolf", "wd red", "wd blue", "wd black",
        "wd gold", "wd purple", "red plus", "red pro", "ultrastar",
        "exos", "skyhawk", "wd re ",
    ],
    "tvs": [
        "smart tv", "oled tv", "qled tv", "led tv", "mini led tv",
        "4k uhd tv", "8k tv", "television",
        "nanocell", "bravia", "roku tv", "fire tv", "google tv",
        "webos", "tizen",
        "crystal uhd", "d-led",
        "nano75", "nano76", "nano80", "nano81", "nano90",
        "skyworth", "ud6300", "class (", "viewable)",
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
        "8bitdo", "gaming chair",
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
        "apc smt", "apc smc", "apc srt",
    ],
    "network-switches": [
        "ethernet switch", "network switch", "gigabit switch",
        "managed switch", "unmanaged switch", "poe switch",
        "8-port switch", "16-port switch", "24-port switch", "48-port switch",
        "8-port gigabit", "16-port gigabit", "24-port gigabit",
        "plug and play switch", "trendnet", "poe+ switch", "gigabit poe",
    ],
    "external-storage": [
        "external hard drive", "external ssd", "portable ssd",
        "portable drive", "backup drive",
        "adata sd6", "adata sd8",
    ],
    "cpus": [
        "epyc", "xeon",
    ],
    "webcams": [
        "webcam", "web cam",
    ],
    "speakers": [
        "soundbar", "bluetooth speaker", "bookshelf speaker",
    ],
    "headphones": [
        "in-ear monitor", "iems", "earbuds", "earbud",
        "jabra elite", "galaxy buds", "airpods",
    ],
    "case-fans": [
    "120mm pwm", "140mm pwm", "120mm fan", "140mm fan",
    "argb light wings", "aspect 12", "aspect 14",
    "thicc fp12", "thicc q60",
    "f120p", "f120q", "f140p",
    "aer rgb", "sl infinity",
    "pwm fan", "case fan",
    ],
}

# Categories checked in priority order.
CATEGORY_PRIORITY = [
    "laptops",
    "tablets",
    "tvs",
    "motherboards",
    "coolers",
    "power-supplies",
    "cases",
    "mice",
    "keyboards",
    "monitors",
    "headphones",
    "speakers",
    "webcams",
    "routers",
    "network-switches",
    "gaming-consoles",
    "smart-home",
    "printers",
    "ups-power",
    "external-storage",
    "gpus",
    "cpus",
    "ssds",
    "hard-drives",
    "ram",
]


def guess_category(name: str, url: str, keywords_map: dict) -> str:
    """Guess product category from name using config keywords + validation rules."""
    name_lower = name.lower()

    # Accessories that get miscategorized — send to "other"
    accessory_words = [
        "cable", "converter", "splitter",
        "bracket", "mount", "riser",
        "cleaning", "cloth", "wipe", "tool kit", "screwdriver",
        "earpad", "ear pad", "replacement pad", "ear cushion",
        "sticker", "decal", "skin", "cover", "sleeve",
        "anti-static", "thermal paste", "thermal pad", "heatsink for",
        "dust filter", "fan guard", "fan grill", "finger guard",
        "replacement battery", "pcb mount",
        "rj45 plug", "rj45 connector", "modular plug",
        "not available for order", "quick view",
        "molex", "6pin to", "8pin to", "4pin to",
        "g1/4", "water cooling fitting", "water cooling block",
        "usb hub", "usb splitter", "usb3.0 hub",
        "expansion dock", "docking station",
        "projector lamp", "projector bulb",
        "replacement module", "mounting-kit", "mounting kit",
        "adaptor cable", "adapter cable",
        "poe injector", "media converter",
        "snagless boots", "connector plugs",
        "mini arcade", "micro player",
        "desk fan", "mini fan",
        "charger with", "battery charger",
        "front panel hub", "front panel usb",
    ]
    is_accessory = any(w in name_lower for w in accessory_words)
    if is_accessory:
        for cat_key in CATEGORY_PRIORITY:
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

        has_keyword = any(kw in name_lower for kw in keywords)
        if not has_keyword:
            continue

        blocklist = CATEGORY_BLOCKLIST.get(cat_key, [])
        is_blocked = any(bw in name_lower for bw in blocklist)
        if is_blocked:
            continue

        return cat_key

    return "other"

def make_short_name(name: str) -> str:
    """Create a clean short product name for card displays."""
    short = name.strip()

    # 1. Remove parenthesized part/model numbers
    short = re.sub(r'\s*\([A-Z0-9][A-Z0-9\-\/\.]{4,}\)', '', short)

    # 2. Remove everything after cut-off phrases
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
    if ' - ' in short:
        parts = short.split(' - ', 1)
        before_words = set(parts[0].lower().split())
        after_words = set(parts[1].lower().split()[:5])
        overlap = before_words & after_words
        if len(overlap) >= 2:
            short = parts[0]

    # 4. Remove spec dumps
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
    short = re.sub(r'\s+\w$', '', short).strip()

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
    # Load canonical categories for fast lookup
    canonical_categories = {}
    for row in conn.execute("SELECT id, category FROM canonical_products WHERE category != '' AND category != 'other'"):
        canonical_categories[row[0]] = row[1]

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
            p.category as db_category,
            p.match_group,
            p.canonical_id,
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

        # --- CATEGORY CLASSIFICATION ---
        source_cat = row["source_category"] or ""
        
        # Build label-to-key lookup if not already done
        if not hasattr(export, '_label_to_key'):
            export._label_to_key = {}
            for k, v in keywords_map.items():
                export._label_to_key[k] = k
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
                resolved_cat = source_cat
            elif sc_lower in export._label_to_key:
                resolved_cat = export._label_to_key[sc_lower]
        
        name_lower = row["name"].lower()
        
        def name_matches_category(cat_key, name_lower):
            """Check if a product name has any keyword or strong identifier for a category."""
            strong = STRONG_IDENTIFIERS.get(cat_key, [])
            if any(s in name_lower for s in strong):
                return True
            keywords = keywords_map.get(cat_key, [])
            if any(kw in name_lower for kw in keywords):
                return True
            return False
        
        # DB category is the truth (cleaned manually, scraper-assigned, AI-assigned).
        # Trust it if present. Only run keyword guessing as a fallback for null/other.
        db_category = row["db_category"] or ""
        if db_category and db_category != "other":
            category = db_category
        elif resolved_cat and resolved_cat != "other" and name_matches_category(resolved_cat, name_lower):
            category = resolved_cat
        else:
            category = guess_category(row["name"], row["url"], keywords_map)
            if resolved_cat and resolved_cat != "other" and category != resolved_cat:
                reclassified += 1

        # CANONICAL OVERRIDE: if this product has a canonical category, use it.
        # The canonical category was assigned by AI (Haiku) and is more reliable
        # than keyword matching. This scales to 100K+ products without manual keywords.
        canonical_row = row["canonical_id"] and conn.execute(
            "SELECT category, upc, ean, model_number FROM canonical_products WHERE id = ?", (row["canonical_id"],)
        ).fetchone()
        canonical_cat = None
        canonical_upc = ""
        canonical_mpn = ""
        if canonical_row:
            canonical_cat = canonical_row[0]
            canonical_upc = canonical_row[1] or canonical_row[2] or ""
            canonical_mpn = canonical_row[3] or ""
        if canonical_cat and canonical_cat != "other":
            category = canonical_cat

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
            "matchGroup": row["match_group"],
            "canonicalId": row["canonical_id"],
            "upc": canonical_upc,
            "mpn": canonical_mpn,
        }
        products.append(product)

    # --- Merge matched products (cross-retailer price comparison) ---
    # Uses canonical_id (Product Identity Layer) as the primary matching key.
    # Falls back to match_group for products not yet in the canonical system.
    canonical_groups = {}
    match_groups = {}

    for p in products:
        cid = p.get("canonicalId")
        mg = p.get("matchGroup")
        entry = {
            "id": p["id"],
            "retailer": p["retailer"],
            "price": p["currentPrice"],
            "url": p["url"],
            "slug": p["slug"],
        }
        # Prefer canonical_id over match_group
        if cid:
            if cid not in canonical_groups:
                canonical_groups[cid] = []
            canonical_groups[cid].append(entry)
        elif mg:
            if mg not in match_groups:
                match_groups[mg] = []
            match_groups[mg].append(entry)

    matched_count = 0
    for p in products:
        cid = p.get("canonicalId")
        mg = p.get("matchGroup")

        comparisons = []
        if cid and cid in canonical_groups and len(canonical_groups[cid]) > 1:
            comparisons = [r for r in canonical_groups[cid] if r["id"] != p["id"]]
        elif mg and mg in match_groups and len(match_groups[mg]) > 1:
            comparisons = [r for r in match_groups[mg] if r["id"] != p["id"]]

        p["priceComparison"] = comparisons
        if comparisons:
            matched_count += 1

    canonical_cross = sum(
        1 for items in canonical_groups.values()
        if len(set(i["retailer"] for i in items)) > 1
    )
    legacy_cross = sum(
        1 for items in match_groups.values()
        if len(set(i["retailer"] for i in items)) > 1
    )
    print(f"Price comparison: {canonical_cross} canonical + {legacy_cross} legacy cross-retailer groups, {matched_count} products with comparisons")

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
    print(f"\nProducts by category ({reclassified} reclassified from retailer source):")
    for cat, count in sorted(stats["productsByCategory"].items(), key=lambda x: -x[1]):
        print(f"  {cat}: {count}")

    conn.close()
    print(f"\nAll data exported to: {OUTPUT_DIR}")


if __name__ == "__main__":
    export()
