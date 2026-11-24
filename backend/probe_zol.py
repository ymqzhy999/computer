import urllib.request
import urllib.parse
import json
import re

categories = [
    ('CPU', 'cpu', 28),
    ('主板', 'motherboard', 5),
    ('显卡', 'gpu', 6),
    ('内存', 'ram', 3),
    ('固态硬盘', 'ssd', 626),
    ('电源', 'psu', 35),
    ('机箱', 'case', 10),
    ('散热器', 'cooler', 67),
]

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Referer': 'https://zj.zol.com.cn/',
    'X-Requested-With': 'XMLHttpRequest',
}

base_url = 'https://zj.zol.com.cn/index.php'

print("=== Testing ZOL Hardware Subcategories ===")
for label, cat_key, sub_id in categories:
    params = urllib.parse.urlencode({
        'c': 'Ajax_ParamResponse',
        'a': 'GetGoods',
        'subcateId': str(sub_id),
        'type': '1',
        'page': '1',
    })
    req = urllib.request.Request(f"{base_url}?{params}", headers=headers)
    try:
        raw = urllib.request.urlopen(req, timeout=10).read().decode('gbk', errors='ignore')
        data = json.loads(raw)
        max_page = data.get('maxPage')
        all_num = data.get('allNum')
        html_data = data.get('data', '')
        
        # Parse items
        items = re.findall(r'<div class="pitem clearfix[^"]*">(.*?)</div>\s*<!--pitem end-->', html_data, re.S)
        if not items:
            items = re.split(r'<div class="pitem clearfix', html_data)[1:]
            
        print(f"[{label} (subcateId={sub_id})] 总数: {all_num} 款 | 总页数: {max_page} | 本页解析出 {len(items)} 款商品")
        
        # Print top 2 samples
        for idx, item in enumerate(items[:2]):
            name_m = re.search(r'<a[^>]+title=["\']([^"\']+)["\']', item)
            name = name_m.group(1) if name_m else "Unknown"
            price_m = re.search(r'class="price"[^>]*>.*?([0-9\.]+)', item, re.S)
            price = price_m.group(1) if price_m else "暂无报价"
            param_m = re.search(r'class="param"[^>]*>(.*?)</div>', item, re.S)
            param = re.sub(r'<[^>]+>', ' ', param_m.group(1)).strip() if param_m else ""
            print(f"   -> [{idx+1}] {name} | 报价: ¥{price} | 参数: {param[:50]}")
    except Exception as e:
        print(f"[{label}] Error: {e}")
