import json
from pathlib import Path

user_json_path = Path(r"F:\ai_video\pc-forge\backend\user_imported_catalog.json")
target_paths = [
    Path(r"F:\ai_video\pc-forge\src\data\catalog.json"),
    Path(r"G:\pc-forge\frontend\src\data\catalog.json")
]

with open(user_json_path, "r", encoding="utf-8") as f:
    user_data = json.load(f)

def transform_cpu(p):
    specs = p.get("specs") or {}
    cores = specs.get("cores") or 8
    threads = specs.get("threads") or (cores * 2)
    base_clock = specs.get("baseClockGHz") or 3.8
    boost_clock = specs.get("boostClockGHz") or 5.0
    tdp = specs.get("tdpW") or 105
    peak = specs.get("pptW") or specs.get("mtpW") or int(tdp * 1.35)
    socket = specs.get("socket") or ("AM5" if "AMD" in p["brand"] else "LGA1700")
    mem_support = specs.get("memorySupport") or "DDR5"
    mem_type = "DDR4" if "DDR4" in mem_support and "DDR5" not in mem_support else "DDR5"

    ref_price = p.get("referencePrice")
    if not ref_price:
        if p.get("marketMedian"):
            ref_price = p["marketMedian"]
        elif p.get("marketMin") and p.get("marketMax"):
            ref_price = (p["marketMin"] + p["marketMax"]) // 2
        elif p.get("marketMin"):
            ref_price = p["marketMin"]
        else:
            m = p["model"]
            if "9950X3D" in m: ref_price = 5299
            elif "9950X" in m: ref_price = 4499
            elif "9900X3D" in m: ref_price = 4299
            elif "9900X" in m: ref_price = 3299
            elif "9850X3D" in m: ref_price = 3999
            elif "9800X3D" in m: ref_price = 3799
            elif "9700X" in m: ref_price = 2299
            elif "9600X" in m: ref_price = 1599
            elif "9600" in m: ref_price = 1499
            elif "9500F" in m: ref_price = 1199
            elif "285K" in m: ref_price = 4199
            elif "270K" in m: ref_price = 3699
            elif "265K" in m: ref_price = 2899
            elif "250K" in m: ref_price = 2499
            elif "245K" in m: ref_price = 2199
            elif "225F" in m: ref_price = 1499
            elif "14900K" in m: ref_price = 3999
            elif "14900KF" in m: ref_price = 3699
            elif "14700K" in m: ref_price = 2799
            elif "14700KF" in m: ref_price = 2599
            elif "14600K" in m: ref_price = 1999
            elif "14600KF" in m: ref_price = 1799
            elif "14400F" in m: ref_price = 1199
            elif "14100F" in m: ref_price = 699
            elif "13900K" in m: ref_price = 3499
            elif "13700K" in m: ref_price = 2399
            elif "13600KF" in m: ref_price = 1699
            elif "13400F" in m: ref_price = 1099
            elif "12700K" in m: ref_price = 1699
            elif "12600KF" in m: ref_price = 1099
            elif "12490F" in m: ref_price = 749
            elif "12400F" in m: ref_price = 669
            elif "12100F" in m: ref_price = 489
            elif "7950X3D" in m: ref_price = 4299
            elif "7950X" in m: ref_price = 3499
            elif "7900X" in m: ref_price = 2699
            elif "7800X3D" in m: ref_price = 2699
            elif "7700X" in m: ref_price = 1799
            elif "7600X" in m: ref_price = 1299
            elif "7500F" in m: ref_price = 899
            elif "8700G" in m: ref_price = 1999
            elif "8600G" in m: ref_price = 1299
            elif "5900X" in m: ref_price = 1699
            elif "5800X3D" in m: ref_price = 1799
            elif "5700X3D" in m: ref_price = 1299
            elif "5600GT" in m: ref_price = 799
            elif "5600" in m: ref_price = 549
            elif "5500" in m: ref_price = 459
            else: ref_price = 1500

    min_price = p.get("marketMin") or int(ref_price * 0.9)
    max_price = p.get("marketMax") or int(ref_price * 1.15)
    perf_index = min(100, max(25, int(cores * 3.5 + (boost_clock or 4.0) * 8 + (30 if "9" in p.get("series", "") or "Ultra 9" in p.get("series", "") else 15))))

    return {
        "id": p["id"],
        "category": "cpu",
        "brand": p["brand"],
        "model": p["model"],
        "sku": p.get("sku") or p.get("mpn") or p["id"],
        "releasedAt": (p.get("releaseDate") or "2024")[:7],
        "status": p.get("lifecycle") or "active",
        "tagline": p.get("tagline") or f"{p['brand']} {p['model']} · 架构 {specs.get('architecture', '')}",
        "description": f"{p['brand']} {p['model']}，{cores}核{threads}线程，最高加速 {boost_clock}GHz，插槽 {socket}，L3缓存 {specs.get('l3CacheMB', 32)}MB。",
        "attrs": {
            "socket": socket,
            "cores": cores,
            "threads": threads,
            "baseClock": base_clock,
            "boostClock": boost_clock,
            "cacheMb": specs.get("l3CacheMB", 32),
            "tdp": tdp,
            "peakPower": peak,
            "memoryType": mem_type,
            "memoryMaxSpeed": 5600 if mem_type == "DDR5" else 3200,
            "igpu": bool(specs.get("integratedGraphics")),
            "architecture": specs.get("architecture"),
            "processNode": specs.get("processNode"),
        },
        "specs": {
            "核心 / 线程": f"{cores}C / {threads}T",
            "基础 / 加速": f"{base_clock or '-'} / {boost_clock} GHz",
            "三级缓存": f"{specs.get('l3CacheMB', '-')} MB",
            "插槽": socket,
            "默认功耗": f"{tdp} W",
            "峰值功耗": f"{peak} W",
            "内存支持": mem_support,
            "核显": specs.get("igpuModel") or ("是" if specs.get("integratedGraphics") else "否")
        },
        "price": {
            "reference": ref_price,
            "min": min_price,
            "max": max_price,
            "currency": p.get("currency") or "CNY",
            "region": "CN",
            "source": p.get("priceSources", [{}])[0].get("seller") if p.get("priceSources") else "官方行情与公开市场归档",
            "updatedAt": p.get("verifiedAt") or "2026-11-21",
            "status": "active" if p.get("referencePrice") or p.get("marketMin") else "sample",
            "confidence": "high" if p.get("referencePrice") else "medium",
            "note": "大陆市场参考价"
        },
        "usedPrice": None,
        "performance": {
            "index": perf_index,
            "gaming": min(100, int(perf_index * 1.02)),
            "productivity": min(100, int(perf_index * 0.98)),
            "single": min(100, int((boost_clock or 4.0) * 16)),
            "multi": min(100, int(cores * 5.5)),
        },
        "visual": {
            "accent": "#44dcff",
            "tone": "black",
            "variant": "cpu"
        },
        "raw": p
    }

def transform_gpu(p):
    specs = p.get("specs") or {}
    vram = specs.get("vramGB") or 16
    vram_type = specs.get("vramType") or "GDDR7"
    bus = specs.get("memoryBusWidth") or 256
    chip = specs.get("gpuChip") or p["model"]
    cuda = specs.get("cudaCores")
    rec_psu = specs.get("recommendedPsuW") or 750
    tdp = specs.get("tdpW")
    if not tdp:
        if "5090" in p["model"]: tdp = 575
        elif "5080" in p["model"]: tdp = 380
        elif "5070Ti" in p["model"] or "5070 Ti" in p["model"]: tdp = 300
        elif "5070" in p["model"]: tdp = 250
        elif "5060Ti" in p["model"] or "5060 Ti" in p["model"]: tdp = 165
        else: tdp = 130

    length = specs.get("lengthMm")
    if not length:
        if "Mini" in p["model"]: length = 180
        elif "Vulcan" in p["model"]: length = 348
        elif "Advanced" in p["model"]: length = 320
        else: length = 314

    slots = 2.0 if "Mini" in p["model"] else 3.5 if "Vulcan" in p["model"] else 2.5

    ref_price = p.get("referencePrice")
    if not ref_price:
        if p.get("marketMedian"): ref_price = p["marketMedian"]
        elif p.get("marketMin") and p.get("marketMax"): ref_price = (p["marketMin"] + p["marketMax"]) // 2
        elif p.get("marketMin"): ref_price = p["marketMin"]
        else:
            if "5090" in p["model"]: ref_price = 21999
            elif "5080" in p["model"]: ref_price = 10999
            elif "5070 Ti" in p["model"] or "5070Ti" in p["model"]: ref_price = 7999
            elif "5070" in p["model"]: ref_price = 5699
            elif "5060 Ti" in p["model"] or "5060Ti" in p["model"]: ref_price = 3899
            else: ref_price = 2999

    min_price = p.get("marketMin") or int(ref_price * 0.92)
    max_price = p.get("marketMax") or int(ref_price * 1.1)
    perf_index = 100 if "5090" in p["model"] else 94 if "5080" in p["model"] else 88 if "5070 Ti" in p["model"] or "5070Ti" in p["model"] else 82 if "5070" in p["model"] else 72 if "5060 Ti" in p["model"] or "5060Ti" in p["model"] else 62

    return {
        "id": p["id"],
        "category": "gpu",
        "brand": f"{p['brand']} (七彩虹)" if p["brand"] == "Colorful" else p["brand"],
        "model": p["model"],
        "sku": p.get("sku") or p.get("mpn") or p["id"],
        "releasedAt": (p.get("releaseDate") or "2025")[:7],
        "status": p.get("lifecycle") or "active",
        "tagline": p.get("tagline") or f"{p['brand']} {p.get('series', '')} · {chip}",
        "description": f"{p['brand']} {p['model']}，基于 Blackwell 架构 {chip}，配备 {vram}GB {vram_type} 显存，建议电源 {rec_psu}W。",
        "attrs": {
            "gpuChip": chip,
            "vramGb": vram,
            "memoryType": vram_type,
            "memoryBusBit": bus,
            "tdp": tdp,
            "suggestedPsuWatt": rec_psu,
            "lengthMm": length,
            "thicknessSlots": slots,
            "powerConnectors": specs.get("powerConnector") or "16pin",
            "rgb": specs.get("rgb", True),
            "fans": specs.get("fans", 3)
        },
        "specs": {
            "核心芯片": chip,
            "显存规格": f"{vram}GB {vram_type}" + (f" / {bus}-bit" if bus else ""),
            "CUDA核心": cuda or "-",
            "额定功耗": f"{tdp} W",
            "建议电源": f"{rec_psu} W",
            "显卡尺寸": f"{length} mm ({slots} 槽)",
            "供电接口": specs.get("powerConnector") or "16-pin (12V-2x6)",
            "视频接口": ", ".join(specs.get("outputs", [])) if specs.get("outputs") else "DP / HDMI"
        },
        "price": {
            "reference": ref_price,
            "min": min_price,
            "max": max_price,
            "currency": p.get("currency") or "CNY",
            "region": "CN",
            "source": p.get("priceSources", [{}])[0].get("seller") if p.get("priceSources") else "七彩虹官方自营 / 行情归档",
            "updatedAt": p.get("verifiedAt") or "2026-11-21",
            "status": "active" if p.get("referencePrice") or p.get("marketMin") else "sample",
            "confidence": "high" if p.get("referencePrice") else "medium",
            "note": "大陆现货参考价"
        },
        "usedPrice": None,
        "performance": {
            "index": perf_index,
            "gaming": min(100, int(perf_index * 1.02)),
            "productivity": min(100, int(perf_index * 0.98)),
            "single": 0,
            "multi": 0
        },
        "visual": {
            "accent": "#44dcff",
            "tone": "white" if "white" in (p.get("color") or "").lower() or "ultra" in p["model"].lower() else "black",
            "variant": "gpu"
        },
        "raw": p
    }

transformed_items = []
for p in user_data["products"]:
    if p["category"] == "PROCESSOR":
        transformed_items.append(transform_cpu(p))
    elif p["category"] == "GRAPHICS_CARD":
        transformed_items.append(transform_gpu(p))

print(f"Transformed {len(transformed_items)} products ({len([x for x in transformed_items if x['category'] == 'cpu'])} CPUs, {len([x for x in transformed_items if x['category'] == 'gpu'])} GPUs)")

for target in target_paths:
    if target.exists():
        with open(target, "r", encoding="utf-8") as f:
            cat = json.load(f)
        existing_map = {item["id"]: item for item in cat["products"]}
        added_count = 0
        updated_count = 0
        for item in transformed_items:
            if item["id"] in existing_map:
                existing_map[item["id"]].update(item)
                updated_count += 1
            else:
                existing_map[item["id"]] = item
                added_count += 1
        cat["products"] = list(existing_map.values())
        cat["updatedAt"] = "2026-11-21T11:45:00+08:00"
        with open(target, "w", encoding="utf-8") as f:
            json.dump(cat, f, ensure_ascii=False, indent=2)
        print(f"Updated {target}: Added {added_count}, Updated {updated_count}, Total products now: {len(cat['products'])}")
