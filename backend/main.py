"""PC FORGE price and catalog service.

Design boundary
---------------
This service never invents prices. It serves the checked-in catalog archive and,
only when an operator explicitly supplies a validated quote feed, exposes those
quotes to the frontend. Marketplace credentials stay on the server and are never
sent to the browser.

Run:
    uvicorn main:app --host 127.0.0.1 --port 8018 --reload
"""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parent
CATALOG_PATH = ROOT.parent / "src" / "data" / "catalog.json"
QUOTE_FEED = Path(os.environ["PC_FORGE_QUOTE_FEED"]) if os.environ.get("PC_FORGE_QUOTE_FEED") else None
VALID_STATUS = {"live", "sample", "stale", "unavailable"}


def load_catalog() -> dict[str, Any]:
    with CATALOG_PATH.open("r", encoding="utf-8") as handle:
        payload = json.load(handle)
    products = payload.get("products")
    if not isinstance(products, list) or not products:
        raise RuntimeError("catalog.json must contain a non-empty products array")
    return payload


def reload_catalog() -> None:
    global CATALOG, PRODUCTS, CATALOG_UPDATED_AT
    CATALOG = load_catalog()
    PRODUCTS = {item["id"]: item for item in CATALOG["products"]}
    CATALOG_UPDATED_AT = CATALOG.get("updatedAt")


CATALOG = load_catalog()
PRODUCTS = {item["id"]: item for item in CATALOG["products"]}
CATALOG_UPDATED_AT = CATALOG.get("updatedAt")


class QuoteRequest(BaseModel):
    productIds: list[str] = Field(default_factory=list, max_length=80)
    region: str = "CN"
    currency: str = "CNY"


def now_iso() -> str:
    return datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")


def load_feed() -> list[dict[str, Any]]:
    """Optional operator-provided feed. Invalid entries are ignored, never guessed."""
    if QUOTE_FEED is None or not QUOTE_FEED.exists():
        return []
    try:
        raw = json.loads(QUOTE_FEED.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return []
    entries = raw.get("quotes") if isinstance(raw, dict) else raw
    if not isinstance(entries, list):
        return []
    clean: list[dict[str, Any]] = []
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        product_id = entry.get("productId")
        price = entry.get("price")
        if product_id not in PRODUCTS or not isinstance(price, dict):
            continue
        reference = price.get("reference")
        source = price.get("source")
        status = price.get("status")
        if not isinstance(reference, (int, float)) or reference <= 0:
            continue
        if not isinstance(source, str) or not source.strip():
            continue
        if status not in VALID_STATUS:
            continue
        clean.append({"productId": product_id, "price": price})
    return clean


def stats() -> dict[str, Any]:
    by_category: dict[str, int] = {}
    priced = 0
    live = 0
    for product in PRODUCTS.values():
        by_category[product["category"]] = by_category.get(product["category"], 0) + 1
        price = product.get("price") or {}
        if isinstance(price.get("reference"), (int, float)):
            priced += 1
        if price.get("status") == "live":
            live += 1
    total = len(PRODUCTS)
    return {
        "total": total,
        "priced": priced,
        "unpriced": total - priced,
        "live": live,
        "byCategory": by_category,
        "coverage": round(priced / total, 4) if total else 0,
        "version": CATALOG.get("version"),
        "updatedAt": CATALOG_UPDATED_AT,
        "region": CATALOG.get("region", "CN"),
        "currency": CATALOG.get("currency", "CNY"),
        "disclaimer": CATALOG.get("disclaimer", ""),
    }


app = FastAPI(
    title="PC FORGE Catalog & Price Service",
    version="1.0.0",
    description="Read-only catalog archive plus an optional, verified quote feed.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5178",
        "http://localhost:5178",
        "http://127.0.0.1:4178",
        "http://localhost:4178",
    ],
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type"],
)


@app.get("/api/prices/health")
def price_health() -> dict[str, Any]:
    configured = QUOTE_FEED is not None and QUOTE_FEED.exists()
    if configured:
        message = "已验证报价文件通道已配置；仅返回文件中通过校验的报价。"
        adapter = "verified-quote-feed"
    else:
        message = "实时价格适配器未配置，服务仅提供归档样本与用户导入价格。"
        adapter = "archive-only"
    return {
        "configured": configured,
        "adapter": adapter,
        "message": message,
        "catalogUpdatedAt": CATALOG_UPDATED_AT,
        "serverTime": now_iso(),
        "liveQuotes": 0 if not configured else len(load_feed()),
    }


@app.post("/api/prices/quotes")
def price_quotes(request: QuoteRequest) -> dict[str, Any]:
    """Return verified quotes only. With no feed configured, return no quotes."""
    if len(request.productIds) > 80:
        raise HTTPException(status_code=413, detail="一次最多查询 80 个 SKU")
    requested = [pid for pid in dict.fromkeys(request.productIds) if pid in PRODUCTS]
    feed = {entry["productId"]: entry["price"] for entry in load_feed()}
    quotes = [
        {"productId": pid, "price": feed[pid]}
        for pid in requested
        if pid in feed
    ]
    warnings: list[str] = []
    if QUOTE_FEED is None or not QUOTE_FEED.exists():
        warnings.append("未配置实时报价通道；本次没有更新任何价格，归档样本保持不变。")
    elif len(quotes) < len(requested):
        warnings.append(f"{len(requested) - len(quotes)} 个 SKU 没有通过校验的实时报价。")
    return {
        "adapter": "verified-quote-feed" if feed else "archive-only",
        "fetchedAt": now_iso(),
        "quotes": quotes,
        "warnings": warnings,
        "catalogUpdatedAt": CATALOG_UPDATED_AT,
    }


@app.get("/api/catalog/stats")
def catalog_stats() -> dict[str, Any]:
    return stats()


@app.get("/api/catalog")
def catalog_list(
    q: str = Query(default="", max_length=80),
    category: str | None = Query(default=None, max_length=24),
    limit: int = Query(default=24, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> dict[str, Any]:
    query = q.strip().lower()
    items = []
    for product in PRODUCTS.values():
        if category and product["category"] != category:
            continue
        if query:
            haystack = " ".join(
                str(part)
                for part in (
                    product.get("brand"),
                    product.get("model"),
                    product.get("sku"),
                    product.get("tagline"),
                    product.get("description"),
                )
                if part
            ).lower()
            if query not in haystack:
                continue
        items.append(product)
    total = len(items)
    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "items": items[offset : offset + limit],
        "version": CATALOG.get("version"),
        "updatedAt": CATALOG_UPDATED_AT,
        "disclaimer": CATALOG.get("disclaimer", ""),
    }


@app.post("/api/catalog/reload")
def catalog_reload() -> dict[str, Any]:
    reload_catalog()
    return stats()


@app.get("/api/raw-catalog")
def raw_catalog() -> dict[str, Any]:
    user_catalog_path = ROOT / "user_imported_catalog.json"
    if user_catalog_path.exists():
        with user_catalog_path.open("r", encoding="utf-8") as handle:
            return json.load(handle)
    return {"meta": {}, "products": []}


@app.get("/api/catalog/{product_id}")
def catalog_product(product_id: str) -> dict[str, Any]:
    product = PRODUCTS.get(product_id)
    if product is None:
        raise HTTPException(status_code=404, detail="未知 SKU")
    return product
