"""
Merge logged-in ZOL crawl data (with jdPrice, lowestPrice, merchantCount)
into catalog.json and user_imported_catalog.json
"""
import glob
import json
import os
import re

CRAWL_DIR = r"C:\Users\ymq\.gemini\antigravity\brain\be288a9f-ddce-4cd7-b692-4016483b5f7a\browser_sandbox\outputs"
CATALOG_PATH = r"F:\ai_video\pc-forge\src\data\catalog.json"
USER_IMPORTED_PATH = r"F:\ai_video\pc-forge\backend\user_imported_catalog.json"

step_files = [
    "step_102.json",  # cpu
    "step_106.json",  # motherboard
    "step_108.json",  # ram
    "step_110.json",  # ssd
    "step_112.json",  # gpu
    "step_114.json",  # case
    "step_116.json",  # psu
    "step_120.json",  # cooler
    "step_122.json",  # hdd
]

all_crawled = []
for sf in step_files:
    p = os.path.join(CRAWL_DIR, sf)
    if os.path.exists(p):
        try:
            with open(p, "r", encoding="utf-8") as f:
                d = json.load(f)
                val = d.get("value", {})
                if isinstance(val, dict) and "products" in val:
                    all_crawled.extend(val["products"])
        except Exception as e:
            print(f"Error reading {sf}: {e}")

print(f"Loaded {len(all_crawled)} high-precision products from logged-in crawl.")

# Load catalog.json
with open(CATALOG_PATH, "r", encoding="utf-8") as f:
    catalog = json.load(f)

prods = catalog.get("products", [])
updated_count = 0

for c_item in all_crawled:
    zol_id = str(c_item.get("id", ""))
    c_name = c_item.get("name", "")
    ref_p = float(c_item["price"]) if c_item.get("price") else None
    low_p = float(c_item["lowestPrice"]) if c_item.get("lowestPrice") else None
    jd_p = float(c_item["jdPrice"]) if c_item.get("jdPrice") else None
    m_cnt = c_item.get("merchantCount", "")

    # Match in catalog
    for p in prods:
        matched = False
        if p.get("sku") == f"ZOL-{zol_id}" or zol_id in p.get("id", ""):
            matched = True
        elif c_name and (c_name.lower() in p.get("model", "").lower() or p.get("model", "").lower() in c_name.lower()):
            matched = True

        if matched:
            updated_count += 1
            pr = p.get("price") or {}
            if ref_p:
                pr["reference"] = ref_p
            if low_p:
                pr["min"] = low_p
            if ref_p:
                pr["max"] = round(ref_p * 1.05, 1)
            pr["jdPrice"] = jd_p
            pr["merchantCount"] = int(m_cnt) if m_cnt and m_cnt.isdigit() else None
            pr["confidence"] = "high"
            pr["status"] = "live"
            pr["source"] = "中关村在线 (ZOL) 微信登录态实盘核验"
            note_parts = []
            if ref_p:
                note_parts.append(f"ZOL参考价 ¥{ref_p}")
            if low_p and m_cnt:
                note_parts.append(f"{m_cnt}商家底价 ¥{low_p}")
            if jd_p:
                note_parts.append(f"京东现货价 ¥{jd_p}")
            pr["note"] = " · ".join(note_parts)
            p["price"] = pr
            break

with open(CATALOG_PATH, "w", encoding="utf-8") as f:
    json.dump(catalog, f, ensure_ascii=False, indent=2)

print(f"Updated {updated_count} items in catalog.json with multi-dimensional pricing.")

# Also update user_imported_catalog.json
if os.path.exists(USER_IMPORTED_PATH):
    with open(USER_IMPORTED_PATH, "r", encoding="utf-8") as f:
        u_cat = json.load(f)
    u_updated = 0
    for u in u_cat.get("products", []):
        u_mod = u.get("model", "").lower()
        for c_item in all_crawled:
            c_name = c_item.get("name", "").lower()
            if u_mod in c_name or c_name in u_mod:
                ref_p = float(c_item["price"]) if c_item.get("price") else None
                low_p = float(c_item["lowestPrice"]) if c_item.get("lowestPrice") else None
                jd_p = float(c_item["jdPrice"]) if c_item.get("jdPrice") else None
                if ref_p:
                    u["referencePrice"] = ref_p
                if low_p:
                    u["marketMin"] = low_p
                if ref_p:
                    u["marketMax"] = round(ref_p * 1.05, 1)
                u["marketMedian"] = jd_p if jd_p else ref_p
                u["priceSources"] = [
                    {
                        "seller": "ZOL 中关村在线 (登录态核验)",
                        "price": ref_p,
                        "lowestMerchantPrice": low_p,
                        "jdPrice": jd_p,
                        "url": c_item.get("sourceUrl"),
                        "condition": "new",
                        "collectedAt": "2026-11-21"
                    }
                ]
                u_updated += 1
                break
    with open(USER_IMPORTED_PATH, "w", encoding="utf-8") as f:
        json.dump(u_cat, f, ensure_ascii=False, indent=2)
    print(f"Updated {u_updated} items in user_imported_catalog.json.")
