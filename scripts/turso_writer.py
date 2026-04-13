"""
Turso writer for TrackAura — HTTP API version (tuned for large datasets).

Changes vs. previous version:
- Smaller batch size (50 products, 100 history rows) to stay under Turso's
  per-request processing time limit.
- 180-second request timeout.
- 5 retries with exponential backoff.
- INCREMENTAL price_history: queries MAX(ts) per product once at startup and
  only inserts rows newer than the existing max. This keeps writes/month
  well under the 10M free-tier limit.

Env vars required:
    TURSO_DATABASE_URL
    TURSO_AUTH_TOKEN

Install:
    pip install requests
"""

import json
import os
import sys
import time
import traceback
from typing import Iterable, List, Dict, Any

try:
    import requests
except ImportError:
    requests = None


PRODUCT_UPSERT_SQL = (
    "INSERT INTO products "
    "(slug, name, category, retailer, currentPrice, minPrice, maxPrice, priceCount, data) "
    "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) "
    "ON CONFLICT(slug) DO UPDATE SET "
    "name=excluded.name, category=excluded.category, retailer=excluded.retailer, "
    "currentPrice=excluded.currentPrice, minPrice=excluded.minPrice, "
    "maxPrice=excluded.maxPrice, priceCount=excluded.priceCount, data=excluded.data"
)

HISTORY_INSERT_SQL = (
    "INSERT OR IGNORE INTO price_history (product_id, ts, price) VALUES (?, ?, ?)"
)

PRODUCT_BATCH = 50
HISTORY_BATCH = 100
REQUEST_TIMEOUT = 180
MAX_RETRIES = 5


def _chunks(seq, size):
    for i in range(0, len(seq), size):
        yield seq[i:i + size]


def _endpoint_and_headers():
    if requests is None:
        raise RuntimeError("requests not installed. Run: pip install requests")
    url = os.environ.get("TURSO_DATABASE_URL")
    token = os.environ.get("TURSO_AUTH_TOKEN")
    if not url or not token:
        raise RuntimeError(
            "TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be set in environment"
        )
    if url.startswith("libsql://"):
        url = "https://" + url[len("libsql://"):]
    endpoint = url.rstrip("/") + "/v2/pipeline"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }
    return endpoint, headers


def _arg(value):
    if value is None:
        return {"type": "null", "value": None}
    if isinstance(value, bool):
        return {"type": "integer", "value": "1" if value else "0"}
    if isinstance(value, int):
        return {"type": "integer", "value": str(value)}
    if isinstance(value, float):
        return {"type": "float", "value": value}
    return {"type": "text", "value": str(value)}


def _post(endpoint, headers, payload):
    """POST with retries and exponential backoff."""
    for attempt in range(MAX_RETRIES):
        try:
            resp = requests.post(endpoint, headers=headers,
                                 data=json.dumps(payload),
                                 timeout=REQUEST_TIMEOUT)
            if resp.status_code == 200:
                body = resp.json()
                for i, result in enumerate(body.get("results", [])):
                    if result.get("type") == "error":
                        raise RuntimeError(
                            f"Statement {i} failed: {result.get('error')}"
                        )
                return body
            raise RuntimeError(f"HTTP {resp.status_code}: {resp.text[:400]}")
        except (requests.RequestException, RuntimeError) as e:
            if attempt == MAX_RETRIES - 1:
                raise
            wait = min(2 ** attempt, 30)
            print(f"  retry {attempt + 1}/{MAX_RETRIES} after {wait}s: {e}",
                  file=sys.stderr, flush=True)
            time.sleep(wait)


def _execute_batch(endpoint, headers, sql, rows):
    payload = {"requests": [
        {"type": "execute", "stmt": {"sql": sql, "args": [_arg(v) for v in row]}}
        for row in rows
    ] + [{"type": "close"}]}
    _post(endpoint, headers, payload)


def _execute_single(endpoint, headers, sql, args=None):
    stmt = {"sql": sql}
    if args is not None:
        stmt["args"] = [_arg(v) for v in args]
    payload = {"requests": [
        {"type": "execute", "stmt": stmt},
        {"type": "close"},
    ]}
    body = _post(endpoint, headers, payload)
    return body["results"][0]["response"]["result"]


def _scalar(result):
    rows = result.get("rows", [])
    if not rows:
        return None
    cell = rows[0][0]
    if cell.get("type") == "null":
        return None
    return cell.get("value")


def write_products(endpoint, headers, products) -> int:
    total = 0
    for batch in _chunks(products, PRODUCT_BATCH):
        rows = [
            (
                p["slug"],
                p.get("name", ""),
                p.get("category"),
                p.get("retailer"),
                p.get("currentPrice"),
                p.get("minPrice"),
                p.get("maxPrice"),
                p.get("priceCount"),
                json.dumps(p, ensure_ascii=False),
            )
            for p in batch
        ]
        _execute_batch(endpoint, headers, PRODUCT_UPSERT_SQL, rows)
        total += len(batch)
        if total % 500 == 0 or total == len(products):
            print(f"  Turso products: upserted {total}/{len(products)}", flush=True)
    return total


def fetch_max_ts_map(endpoint, headers) -> Dict[int, str]:
    """Return {product_id: max_ts_iso_string} from price_history."""
    print("  Fetching existing MAX(ts) per product for incremental write...",
          flush=True)
    result = _execute_single(
        endpoint, headers,
        "SELECT product_id, MAX(ts) FROM price_history GROUP BY product_id"
    )
    out = {}
    for row in result.get("rows", []):
        pid_cell, ts_cell = row[0], row[1]
        if pid_cell.get("type") == "null" or ts_cell.get("type") == "null":
            continue
        out[int(pid_cell["value"])] = ts_cell["value"]
    print(f"  Found existing history for {len(out)} products", flush=True)
    return out


def write_price_history(endpoint, headers, history_by_product_id) -> int:
    """Incremental write: only insert rows with ts > existing MAX(ts) per product."""
    max_ts_map = fetch_max_ts_map(endpoint, headers)

    flat = []
    skipped = 0
    for pid, rows in history_by_product_id.items():
        existing_max = max_ts_map.get(pid)
        for r in rows:
            if existing_max is not None and r["date"] <= existing_max:
                skipped += 1
                continue
            flat.append((pid, r["date"], r["price"]))

    print(f"  Price history: {len(flat)} new rows to write "
          f"({skipped} already present, skipped)", flush=True)

    total = 0
    for batch in _chunks(flat, HISTORY_BATCH):
        _execute_batch(endpoint, headers, HISTORY_INSERT_SQL, batch)
        total += len(batch)
        if total % 1000 == 0 or total == len(flat):
            print(f"  Turso price_history: inserted {total}/{len(flat)}",
                  flush=True)
    return total


def verify_freshness(endpoint, headers) -> None:
    pc = _scalar(_execute_single(endpoint, headers, "SELECT COUNT(*) FROM products"))
    hc = _scalar(_execute_single(endpoint, headers, "SELECT COUNT(*) FROM price_history"))
    latest = _scalar(_execute_single(endpoint, headers, "SELECT MAX(ts) FROM price_history"))
    print(f"Turso verify: products={pc}, price_history={hc}, latest_ts={latest}")


def safe_dual_write(products, history_by_product_id) -> bool:
    try:
        print("\n--- Turso dual-write starting ---", flush=True)
        endpoint, headers = _endpoint_and_headers()
        write_products(endpoint, headers, products)
        write_price_history(endpoint, headers, history_by_product_id)
        verify_freshness(endpoint, headers)
        print("--- Turso dual-write OK ---\n", flush=True)
        return True
    except Exception as e:
        print(f"\n!!! Turso write FAILED: {e}", file=sys.stderr, flush=True)
        traceback.print_exc()
        print("!!! JSON files were written successfully; pipeline continues.\n",
              file=sys.stderr, flush=True)
        return False
