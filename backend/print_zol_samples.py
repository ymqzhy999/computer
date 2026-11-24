import json

cat = json.load(open('F:/ai_video/pc-forge/src/data/catalog.json', encoding='utf-8'))
zol_prods = [p for p in cat['products'] if p['id'].startswith('zol-')]
print(f"Total ZOL products in catalog: {len(zol_prods)}")

by_c = {}
for p in zol_prods:
    by_c.setdefault(p['category'], []).append(p)

for c, items in by_c.items():
    print(f"\n--- {c.upper()} ({len(items)} items) ---")
    for p in items[:3]:
        pr = p.get('price', {})
        print(f"  * [{p.get('brand')}] {p.get('model')}")
        print(f"      ZOL参考价: ¥{pr.get('reference')} | 商家底价: ¥{pr.get('min')} | 京东: ¥{pr.get('jdPrice')} | 商家: {pr.get('merchantCount')}")
        print(f"      详情: {pr.get('sourceUrl')}")
