"""
Test matching catalog products with ZOL
"""
import json
import re
import requests
import urllib.parse

SUBCATE_MAP = {
    "cpu": 28,
    "motherboard": 5,
    "gpu": 6,
    "memory": 3,
    "ram": 3,
    "ssd": 626,
    "hdd": 2,
    "psu": 35,
    "case": 10,
    "cooler": 67,
    "fan": 67,
    "expansion": 6,
}

def clean_keyword(cat, brand, model):
    # Simplify model for ZOL search
    # e.g., "Ryzen 5 5600" -> "5600" or "Ryzen 5 5600"
    m = model
    # remove parenthesized parts
    m = re.sub(r'\(.*?\)', '', m)
    m = m.strip()
    return m

with open("F:/ai_video/pc-forge/src/data/catalog.json", "r", encoding="utf-8") as f:
    catalog = json.load(f)

products = catalog.get("products", [])
print(f"Total products in catalog: {len(products)}")

sample_prods = products[:10]
headers = {"User-Agent": "Mozilla/5.0"}

for p in sample_prods:
    cat = p.get("category", "")
    sub_id = SUBCATE_MAP.get(cat, 28)
    kw = clean_keyword(cat, p.get("brand", ""), p.get("model", ""))
    url = f"https://zj.zol.com.cn/index.php?c=Ajax_ParamResponse&a=GetGoods&subcateId={sub_id}&type=1&keyword={urllib.parse.quote(kw)}"
    
    try:
        resp = requests.get(url, headers=headers, timeout=10)
        data = resp.json()
        all_num = data.get("allNum", 0)
        html = data.get("data", "")
        titles = re.findall(r'<a[^>]+title="([^"]+)"[^>]*class="">\s*([^<]+)</a>', html)
        prices = re.findall(r'<span class="price">￥([0-9.]+)</span>', html)
        print(f"[{cat}] {p.get('model')} -> kw='{kw}' | Hits: {all_num} | Price: {prices[0] if prices else 'None'} | Title: {titles[0][1].strip() if titles else 'None'}")
    except Exception as e:
        print(f"Error for {p.get('id')}: {e}")
