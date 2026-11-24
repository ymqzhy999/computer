import json

cat = json.load(open('F:/ai_video/pc-forge/src/data/catalog.json', encoding='utf-8'))
prods = cat['products']

by_cat = {}
for p in prods:
    c = p['category']
    by_cat.setdefault(c, []).append(p)

for c, lst in by_cat.items():
    print(f"=== {c.upper()} (Total: {len(lst)}) ===")
    for item in lst[:5]:
        pr = item.get('price', {}) or {}
        ref = pr.get('reference', 'N/A')
        low = pr.get('min', 'N/A')
        jd = pr.get('jdPrice', 'N/A')
        m_cnt = pr.get('merchantCount', 'N/A')
        print(f"  [{item.get('brand')}] {item.get('model')} -> 参考价: ¥{ref} | 底价: ¥{low} | 京东: ¥{jd} | 商家数: {m_cnt}")
