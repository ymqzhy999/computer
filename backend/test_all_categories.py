import requests
import json
import re
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
}

test_queries = [
    ("cpu", "Ryzen 9 9950X", ["9950X", "Ryzen 9 9950X"]),
    ("cpu", "i5-14600KF", ["14600KF", "i5 14600KF"]),
    ("gpu", "TUF-RTX4070S-O12G", ["4070 SUPER", "RTX 4070 SUPER", "RTX4070"]),
    ("gpu", "GeForce RTX 4060 Ti", ["4060 Ti", "RTX 4060 Ti"]),
    ("motherboard", "TUF GAMING B650M-PLUS", ["B650M-PLUS", "B650M"]),
    ("motherboard", "MAG B760M MORTAR WIFI", ["B760M MORTAR", "B760M 迫击炮", "B760M"]),
    ("memory", "Kingston FURY Beast DDR5 6000", ["DDR5 6000", "FURY Beast"]),
    ("ssd", "致态 TiPro7000 1TB", ["TiPro7000", "致态"]),
    ("cooler", "利民 PA120", ["PA120", "利民"]),
    ("psu", "海韵 FOCUS GX-850", ["GX-850", "GX850", "海韵 850"]),
    ("case", "联力 包豪斯 O11D", ["O11D", "包豪斯", "联力"]),
]

headers = {"User-Agent": "Mozilla/5.0"}

for cat, orig, kw_list in test_queries:
    sub_id = SUBCATE_MAP[cat]
    found = False
    for kw in kw_list:
        url = f"https://zj.zol.com.cn/index.php?c=Ajax_ParamResponse&a=GetGoods&subcateId={sub_id}&type=1&keyword={urllib.parse.quote(kw)}"
        try:
            resp = requests.get(url, headers=headers, timeout=10)
            data = resp.json()
            if data.get("allNum", 0) > 0:
                html = data.get("data", "")
                titles = re.findall(r'<a[^>]+title="([^"]+)"[^>]*class="">\s*([^<]+)</a>', html)
                prices = re.findall(r'<span class="price">￥([0-9.]+)</span>', html)
                other = re.findall(r'class="sjtotal"><i></i>([0-9]+)商家:￥([0-9.]+)', html)
                jd = re.findall(r'class="jd shop-click"[^>]*><i></i>京东:￥([0-9.]+)', html)
                
                title = titles[0][1].strip() if titles else "Unknown"
                ref_p = prices[0] if prices else "N/A"
                min_p = other[0][1] if other else "N/A"
                jd_p = jd[0] if jd else "N/A"
                m_cnt = other[0][0] if other else "0"
                
                print(f"✅ [{cat}] '{orig}' -> matched '{kw}' (Hits: {data.get('allNum')}):")
                print(f"    Title: {title}")
                print(f"    Ref Price: ¥{ref_p} | Min Price: ¥{min_p} | JD Price: ¥{jd_p} | Merchants: {m_cnt}")
                found = True
                break
        except Exception as e:
            pass
    if not found:
        print(f"❌ [{cat}] '{orig}' -> No match found for {kw_list}")
