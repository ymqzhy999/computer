import urllib.request
import urllib.parse
import json
import re
import time
import sys

CATEGORIES = [
    {
        "category": "cpu",
        "name_cn": "处理器 CPU",
        "subcateId": 28,
        "max_pages": 3,
    },
    {
        "category": "gpu",
        "name_cn": "显卡 GPU",
        "subcateId": 6,
        "max_pages": 3,
    },
    {
        "category": "motherboard",
        "name_cn": "主板 Motherboard",
        "subcateId": 5,
        "max_pages": 3,
    },
    {
        "category": "ram",
        "name_cn": "内存 Memory",
        "subcateId": 3,
        "max_pages": 3,
    },
    {
        "category": "ssd",
        "name_cn": "固态硬盘 SSD",
        "subcateId": 626,
        "max_pages": 3,
    },
    {
        "category": "psu",
        "name_cn": "电源 PSU",
        "subcateId": 35,
        "max_pages": 3,
    },
    {
        "category": "case",
        "name_cn": "机箱 Chassis",
        "subcateId": 10,
        "max_pages": 3,
    },
    {
        "category": "cooler",
        "name_cn": "散热器 Cooler",
        "subcateId": 67,
        "max_pages": 3,
    },
]

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'https://zj.zol.com.cn/',
    'X-Requested-With': 'XMLHttpRequest',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
}

BASE_URL = 'https://zj.zol.com.cn/index.php'


def parse_price(price_text: str):
    m = re.search(r'([0-9]+(?:\.[0-9]+)?)', price_text)
    if m:
        try:
            return float(m.group(1))
        except ValueError:
            return None
    return None


def fetch_page(subcate_id: int, page: int):
    params = urllib.parse.urlencode({
        'c': 'Ajax_ParamResponse',
        'a': 'GetGoods',
        'subcateId': str(subcate_id),
        'type': '1',
        'page': str(page),
    })
    req = urllib.request.Request(f"{BASE_URL}?{params}", headers=HEADERS)
    with urllib.request.urlopen(req, timeout=12) as resp:
        raw = resp.read().decode('gbk', errors='ignore')
        return json.loads(raw)


def extract_items_from_html(html_data: str, category_key: str):
    items = []
    # Split by pitem
    parts = re.split(r'<div class="pitem clearfix', html_data)[1:]
    for part in parts:
        # zolId & manuId
        id_m = re.search(r'reldate="(\d+)"', part)
        zol_id = id_m.group(1) if id_m else None
        manu_m = re.search(r'relmanu="(\d+)"', part)
        manu_id = manu_m.group(1) if manu_m else None

        # Title / Name
        title_m = re.search(r'<h3>.*?<a[^>]+title=["\']([^"\']+)["\'][^>]*>(.*?)</a>', part, re.S)
        if title_m:
            name = title_m.group(1).strip()
            detail_path_m = re.search(r'href=["\']([^"\']+)["\']', title_m.group(0))
            detail_url = "https:" + detail_path_m.group(1) if detail_path_m and detail_path_m.group(1).startswith("//") else (detail_path_m.group(1) if detail_path_m else None)
        else:
            name_m = re.search(r'<a[^>]+title=["\']([^"\']+)["\']', part)
            name = name_m.group(1).strip() if name_m else "Unknown"
            detail_url = None

        # Image
        img_m = re.search(r'<div class="pic">.*?<img[^>]+src=["\']([^"\']+)["\']', part, re.S)
        img_url = img_m.group(1) if img_m else None
        if img_url and img_url.startswith("//"):
            img_url = "https:" + img_url

        # Price
        price_m = re.search(r'class="price"[^>]*>([^<]+)</span>', part)
        price_raw = price_m.group(1).strip() if price_m else "暂无报价"
        price_num = parse_price(price_raw)

        # Monthly popularity / installs
        pop_m = re.search(r'本月<i>(\d+)</i>人已选用', part)
        popularity = int(pop_m.group(1)) if pop_m else 0

        # Specs / Paramet
        specs = {}
        param_spans = re.findall(r'<span[^>]*title=["\']([^"\']+)["\'][^>]*>([^<]+)：<em>([^<]+)</em></span>', part)
        for _, k, v in param_spans:
            specs[k.strip()] = v.strip()

        # Brand extraction heuristic
        brand = None
        for candidate in ["AMD", "Intel", "英特尔", "NVIDIA", "华硕", "ASUS", "七彩虹", "Colorful", "微星", "MSI", "技嘉", "Gigabyte", "影驰", "Galax", "索泰", "ZOTAC", "耕升", "铭瑄", "Maxsun", "盈通", "Yeston", "蓝宝石", "Sapphire", "瀚铠", "讯景", "XFX", "金士顿", "Kingston", "芝奇", "G.SKILL", "海盗船", "Corsair", "威刚", "ADATA", "金百达", "KingBank", "光威", "Gloway", "致态", "ZhiTai", "三星", "Samsung", "西数", "Western Digital", "铠侠", "KIOXIA", "长城", "Great Wall", "航嘉", "Huntkey", "海韵", "Seasonic", "振华", "Super Flower", "安钛克", "Antec", "先马", "SAMA", "联力", "Lian Li", "乔思伯", "JONSBO", "酷冷至尊", "Cooler Master", "追风者", "Phanteks", "利民", "Thermalright", "九州风神", "DeepCool", "Tt", "瓦尔基里", "VALKYRIE", "雅浚", "ProArtist"]:
            if re.search(rf"\b{re.escape(candidate)}\b", name, re.I) or candidate in name:
                brand = candidate
                break

        product = {
            "id": f"zol-{category_key}-{zol_id}" if zol_id else f"zol-{category_key}-{int(time.time()*1000)}",
            "zolId": zol_id,
            "category": category_key,
            "brand": brand or "ZOL",
            "model": name,
            "name": name,
            "price": price_num,
            "priceDisplay": price_raw,
            "currency": "CNY",
            "popularity": popularity,
            "specs": specs,
            "imageUrl": img_url,
            "sourceUrl": detail_url,
            "source": "ZOL中关村在线",
            "crawledAt": time.strftime("%Y-%m-%d %H:%M:%S"),
        }
        items.append(product)
    return items


def main():
    print("=" * 70)
    print("🚀 PC FORGE · ZOL 中关村在线真实硬件数据爬取程序启动")
    print(f"📡 目标来源: {BASE_URL} (中关村在线模拟攒机实时报价)")
    print("=" * 70)

    total_catalog = []
    category_summary = {}

    for cat in CATEGORIES:
        category_key = cat["category"]
        name_cn = cat["name_cn"]
        sub_id = cat["subcateId"]
        max_p = cat["max_pages"]

        print(f"\n📦 正在抓取分类: 【{name_cn}】(subcateId={sub_id}, 抓取前 {max_p} 页)...")
        cat_items = []

        for p in range(1, max_p + 1):
            try:
                data = fetch_page(sub_id, p)
                all_num = data.get("allNum", "未知")
                html_data = data.get("data", "")
                page_items = extract_items_from_html(html_data, category_key)
                cat_items.extend(page_items)
                print(f"   ✓ 第 {p}/{max_p} 页解析完成，获得 {len(page_items)} 款 (该分类全网在售共 {all_num} 款)")
                # Print real-time samples
                for item in page_items[:3]:
                    price_str = f"¥{item['price']}" if item['price'] else "暂无报价"
                    specs_summary = " | ".join(f"{k}:{v}" for k, v in list(item['specs'].items())[:3])
                    print(f"      • [{item['brand']}] {item['name'][:30]:<30} | {price_str:>8} | {specs_summary}")
                time.sleep(0.3)
            except Exception as e:
                print(f"   ✗ 第 {p} 页抓取失败: {e}")

        category_summary[category_key] = len(cat_items)
        total_catalog.extend(cat_items)
        print(f"✨ 【{name_cn}】抓取完毕，累计收录: {len(cat_items)} 款真实商品")

    # Save to JSON
    output_path = "F:/ai_video/pc-forge/backend/zol_hardware_catalog.json"
    result_data = {
        "meta": {
            "source": "ZOL 中关村在线 (https://zj.zol.com.cn/)",
            "description": "中国大陆市场主流硬件产品真实参考报价与规格库",
            "crawledAt": time.strftime("%Y-%m-%d %H:%M:%S"),
            "totalProducts": len(total_catalog),
            "categories": category_summary,
        },
        "products": total_catalog,
    }

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(result_data, f, ensure_ascii=False, indent=2)

    print("\n" + "=" * 70)
    print(f"🎉 爬取完成！共收集 {len(total_catalog)} 款真实硬件产品数据")
    print(f"📁 结果已保存至: {output_path}")
    print(f"📊 分类分布:")
    for k, v in category_summary.items():
        print(f"   - {k:<12}: {v:>3} 款")
    print("=" * 70)


if __name__ == "__main__":
    main()
