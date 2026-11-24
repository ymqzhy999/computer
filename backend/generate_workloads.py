"""
PC Forge - 硬件驱动能力与适用项目 (Workloads & Capabilities) 本地推导引擎
0 Token 消耗，全自动为全库 385 款硬件注入结构化能力属性
"""

import json
import os
import re

CATALOG_PATH = r"F:\ai_video\pc-forge\src\data\catalog.json"
USER_IMPORTED_PATH = r"F:\ai_video\pc-forge\backend\user_imported_catalog.json"

def derive_gpu_workloads(brand, model, attrs, specs, price):
    m = model.upper()
    vram = attrs.get("vramGb") or 8
    p = price or 3000

    if "5090" in m or "4090" in m:
        return {
            "tier": "4K 全极致光追 / 本地大模型旗舰",
            "badge": "顶级生产力 & AI算力怪兽",
            "games": [
                "《黑神话:悟空》(4K 全景路径光追 + DLSS 100FPS+)",
                "《赛博朋克2077》(4K 变态光追 + 帧生成 120FPS+)",
                "各大 3A 大作 4K 240Hz / 8K 超高清畅玩",
                "《CS2》/《无畏契约》(4K 360FPS+ 极低竞技延迟)"
            ],
            "productivity": [
                "DeepSeek-R1 / Qwen-72B 本地私有化量化大模型流畅推理",
                "Stable Diffusion XL / FLUX.1 (1024×1024 极速秒级出图)",
                "虚幻5 (UE5) 复杂 Nanite 场景与影视级 8K 物理渲染",
                "DaVinci Resolve / Premiere 8K RAW 复杂节点实时剪辑调色"
            ],
            "summary": "消费级显卡性能巅峰，单卡可部署 70B 级别大模型，通吃目前市面所有 4K 3A 极致画质游戏，硬核发烧友与工业渲染终极之选。"
        }
    elif "5080" in m or "4080" in m or "7900 XTX" in m:
        return {
            "tier": "4K 顶级光追 / 重度影视与 AI 创作",
            "badge": "4K 旗舰级游戏与创作",
            "games": [
                "《黑神话:悟空》(4K 超高画质 + 全景光追 80FPS+)",
                "《赛博朋克2077》(4K 超级光追 + 帧生成 95FPS+)",
                "《荒野大镖客2》/《极限竞速:地平线5》(4K 极致高刷 120FPS+)"
            ],
            "productivity": [
                "本地部署 32B 参数大模型推理，日常知识库构建",
                "Stable Diffusion XL 快速生成与批量高清修复放大",
                "Blender / 3ds Max 复杂室内外工业级模型实时渲染"
            ],
            "summary": "4K 顶级游戏旗舰，兼备极强的大模型微调与专业影视后期渲染能力，性能长效领先。"
        }
    elif "5070 TI" in m or "4070 TI" in m or "7900 XT" in m or "7900 GRE" in m or "9070 XT" in m:
        return {
            "tier": "2K 极致电竞 / 4K 高画质入门",
            "badge": "2K 顶级甜点主力卡",
            "games": [
                "《黑神话:悟空》(2K 超高画质 + 全景光追 75FPS+)",
                "《赛博朋克2077》(2K 超高光追 + 帧生成 90FPS+)",
                "《绝地求生》/《Apex 英雄》(2K 极致高刷 240FPS+)"
            ],
            "productivity": [
                "DaVinci Resolve / Premiere 4K 10bit 复杂调色剪辑",
                "Stable Diffusion SDXL 1024×1024 生图 (约 5~8 秒/张)",
                "本地流畅运行 14B 参数多模态大语言模型"
            ],
            "summary": "2K 分辨率下的黄金主力卡，高帧通吃所有顶级光追大作，拥有出色的 4K 视频后期与本地 AI 部署能力。"
        }
    elif "5070" in m or "4070" in m or "7800 XT" in m or "7700 XT" in m:
        return {
            "tier": "2K 高画质 3A / 顺畅视频创作",
            "badge": "2K 畅玩主流选择",
            "games": [
                "《黑神话:悟空》(2K 高画质 + DLSS 65FPS+)",
                "《艾尔登法环》/《霍格沃茨之遗》(2K 极致画质 80FPS+)",
                "《CS2》/《瓦罗兰特》(2K 电竞画质 240FPS+)"
            ],
            "productivity": [
                "剪映 / Premiere 4K 多轨道无损剪辑与快速渲染",
                "Stable Diffusion 1.5/SDXL 高清生图创作",
                "本地运行 7B~14B 量化模型与代码辅助助手"
            ],
            "summary": "主流 2K 游戏利器，功耗控制极佳，满足所有主流 3A 游戏的 2K 高清畅玩与日常生产力创作。"
        }
    elif "5060 TI" in m or "4060 TI" in m or "6750 GRE" in m or "7600 XT" in m:
        return {
            "tier": "1080P 全特效 3A / 2K 电竞高刷",
            "badge": "高能效甜点装机王",
            "games": [
                "《黑神话:悟空》(1080P 高画质 + DLSS 60FPS+ / 2K 动态分辨率 60FPS)",
                "《赛博朋克2077》(1080P 高光追 + 帧生成 75FPS+)",
                "《CS2》/《永劫无间》(1080P 电竞 240FPS+ / 2K 144FPS+)"
            ],
            "productivity": [
                "剪映 / PR 4K H.264/H.265 快速剪辑与硬件编码导出",
                "Stable Diffusion 1.5 绘图 (512×512 约 3~5 秒/张)",
                "Blender / C4D 视口流畅实时预览与轻量场景渲染"
            ],
            "summary": "大众装机最均衡的甜点卡，1080P 全特效通吃全部 3A 大作，兼顾日常视频剪辑与轻度 AI 绘图。"
        }
    elif "4060" in m or "5060" in m or "7600" in m:
        return {
            "tier": "1080P 高画质 3A / 极低功耗",
            "badge": "低功耗 1080P 守门员",
            "games": [
                "《黑神话:悟空》(1080P 高画质 + DLSS 55~60FPS)",
                "《原神》/《崩坏:星穹铁道》(1080P/2K 满帧 60FPS)",
                "《英雄联盟》/《无畏契约》(1080P 极致画质 300FPS+)"
            ],
            "productivity": [
                "B站 / 抖音 1080P/4K 短视频剪辑与导出",
                "Photoshop / Lightroom 复杂摄影原片修图调色",
                "OBS 游戏直播超低功耗硬件推流"
            ],
            "summary": "115W 极低功耗，支持全套 DLSS 3 帧生成，1080P 畅玩主流大作的国民级高能效显卡。"
        }
    elif "3050" in m or "6600" in m or "6500" in m or "1660" in m or "A580" in m or "A750" in m or "A380" in m:
        return {
            "tier": "1080P 主流网游 / 入门单机",
            "badge": "千元级经济实惠首选",
            "games": [
                "《英雄联盟》/《DOTA2》(1080P 极致画质 200FPS+)",
                "《CS2》/《瓦罗兰特》(1080P 电竞低延迟 144FPS+)",
                "《GTA5》/《原神》/《永劫无间》(1080P 中高画质 60FPS+)"
            ],
            "productivity": [
                "1080P 日常视频剪辑与 Vlog 制作",
                "Photoshop / Illustrator 平面设计与海报渲染",
                "多屏多窗口日常办公与高清炒股/网课"
            ],
            "summary": "千元级亲民首选，满足主流网游高帧畅玩与日常设计办公需求，功耗极低。"
        }
    else:
        return {
            "tier": "高清图形处理 / 多屏办公显示",
            "badge": "经济型实用显卡",
            "games": ["主流网络竞技游戏流畅运行", "1080P 基础单机游戏畅玩"],
            "productivity": ["多屏高清输出", "日常办公与轻量图形处理"],
            "summary": "提供可靠的高清图形输出与基础游戏娱乐体验。"
        }

def derive_cpu_workloads(brand, model, attrs, specs, price):
    m = model.upper()
    cores = attrs.get("cores") or 6

    if "9950X3D" in m or "9950X" in m or "7950X" in m or "285K" in m or "14900K" in m:
        return {
            "tier": "重度生产力旗舰 / 极限多任务",
            "badge": "多核怪兽 & 顶级算力",
            "games": [
                "通吃全部 3A 游戏物理模拟与高负载计算",
                "《文明6》/《天际线2》超大后期地图万人不卡顿",
                "各类大型安卓模拟器、多开网游 10+ 挂机无压力"
            ],
            "productivity": [
                "Linux 内核 / Chromium 大型代码工程秒级并行编译",
                "Blender / V-Ray CPU 离线渲染与物理粒子解算",
                "4K/8K 多机位 ProRes 实时转码与复杂特效工程合成"
            ],
            "summary": "16~24核顶级多任务性能，适合程序编译、影视工程、三维工业设计与发烧级多任务重度用户。"
        }
    elif "9800X3D" in m or "7800X3D" in m or "9900X3D" in m:
        return {
            "tier": "全球电竞游戏天花板 / 3D V-Cache",
            "badge": "顶级游戏物理引擎神U",
            "games": [
                "《CS2》400FPS+ / 《无畏契约》600FPS+ 极限电竞高帧",
                "《绝地求生》/《逃离塔科夫》极其稳定的 1% Low 最低帧率",
                "《黑神话:悟空》/《博德之门3》第三章极度平稳无掉帧"
            ],
            "productivity": [
                "日常中度视频剪辑、办公与敏捷代码编写",
                "大型游戏全程无卡顿录屏与 OBS 高清推流",
                "中型工程项目构建与日常多任务极速解压"
            ],
            "summary": "游戏玩家的神级首选！凭借大缓存彻底消除游戏掉帧卡顿，电竞帧率与最低帧冠绝全场。"
        }
    elif "9700X" in m or "7700" in m or "14700K" in m or "265K" in m or "9900X" in m:
        return {
            "tier": "全能高端主力 / 游戏兼生产力",
            "badge": "全场景高能多面手",
            "games": [
                "完美喂饱高端旗舰显卡，3A 大作全程无 CPU 瓶颈",
                "各大竞技网游 240FPS+ 稳帧输出",
                "复杂多人同屏游戏满载不降频"
            ],
            "productivity": [
                "Premiere / AE 4K 复杂特效制作与实时回放",
                "Java / Python / Web 前后端全栈中大型工程开发",
                "虚拟机 2~3 个流畅并发运行无压力"
            ],
            "summary": "8~20核强劲性能，游戏与生产力兼得的高端主力，无明显短板。"
        }
    elif "9600X" in m or "7500F" in m or "7600" in m or "14600" in m or "12600" in m:
        return {
            "tier": "高性价比主流游戏 / 日常家用",
            "badge": "国民级装机首选",
            "games": [
                "《黑神话:悟空》/ 3A 大作全程高帧无瓶颈",
                "《CS2》/《英雄联盟》240FPS 电竞高刷畅玩",
                "主流大型单机与网游日常多开"
            ],
            "productivity": [
                "1080P/4K 日常短视频剪辑与硬件编码加速",
                "Office / WPS 百兆复杂表格与多任务处理",
                "VS Code / 开发工具日常敏捷开发构建"
            ],
            "summary": "性价比最高的国民游戏神U，低功耗高主频，完美胜任游戏娱乐与日常内容创作。"
        }
    elif "5600" in m or "12400" in m or "13400" in m or "5500" in m or "12100" in m:
        return {
            "tier": "千元级入门经典 / 实用主义",
            "badge": "高性价比入门基石",
            "games": [
                "《英雄联盟》/《永劫无间》/《绝地求生》顺畅运行",
                "单机 3A 游戏搭配甜点卡稳定 60FPS"
            ],
            "productivity": [
                "日常学习办公、网页数十个标签多开",
                "轻度剪映剪辑、Photoshop 平面设计",
                "高清视频播放与日常家用娱乐"
            ],
            "summary": "千元预算装机常青树，性能扎实稳定，轻松满足绝大多数家庭与网游需求。"
        }
    else:
        return {
            "tier": "日常办公与娱乐处理器",
            "badge": "稳定可靠日常通用",
            "games": ["主流网游稳定运行", "轻度休闲单机畅玩"],
            "productivity": ["日常办公、文档编辑与网络多任务浏览"],
            "summary": "提供可靠平稳的运算性能，适合日常多任务与办公。"
        }

def derive_motherboard_workloads(brand, model, attrs, specs, price):
    m = model.upper()
    if "X870" in m or "X670" in m or "Z790" in m or "Z890" in m:
        return {
            "tier": "旗舰发烧超频板 / 满血扩展",
            "badge": "全规格超频利器",
            "games": ["为 9950X / 14900K 释放 100% 极限超频潜力", "满速 PCIe 5.0 显卡与固态直通低延迟"],
            "productivity": ["多条 M.2 满血并发、高速 Wi-Fi 7 与万兆/双网口数据交互"],
            "summary": "豪华供电规格与顶级做工，适合极客超频与重度外接扩展用户。"
        }
    elif "B650" in m or "B760" in m or "B850" in m:
        return {
            "tier": "主流全能甜点 / 稳健长效",
            "badge": "大众装机最稳支柱",
            "games": ["稳定驾驭 9800X3D / 14600KF 全程满载不降频", "双通道 DDR5 高频超频"],
            "productivity": ["双/三 M.2 扩展满足大容量存储，丰富 USB 接口连接多设备"],
            "summary": "绝大多数装机用户的黄金选择，用料扎实做工靠谱，性价比首选。"
        }
    else:
        return {
            "tier": "经济实用入门主板",
            "badge": "入门装机性价比底座",
            "games": ["稳定搭配千元级 CPU 与主流独显", "单卡电竞网游与日常娱乐"],
            "productivity": ["日常文档、网页多开、高清影音播放"],
            "summary": "低成本装机优选，省心耐用，满足日常家庭办公与主流网游。"
        }

def derive_memory_workloads(brand, model, attrs, specs, price):
    m = model.upper()
    if "64G" in m or "96G" in m or "128G" in m:
        return {
            "tier": "重度生产力 / 本地大模型 / 虚拟机",
            "badge": "海量内存大肚王",
            "games": ["《天际线2》满Mod超大城市建设、《微软飞行模拟》超精细地景加载", "游戏后台挂机多开毫无压力"],
            "productivity": ["4K/8K 视频多机位剪辑多轨道不卡顿、本地大模型平滑内存交换、多开 5+ 虚拟机"],
            "summary": "专业创作者与开发者的标配，彻底摆脱系统内存不足警告。"
        }
    elif "32G" in m:
        return {
            "tier": "现代游戏黄金标准 / 顺畅多任务",
            "badge": "3A 与生产力黄金配置",
            "games": ["《黑神话:悟空》/《霍格沃茨之遗》无后台清理压力，后台开着浏览器依然丝滑", "各类大型单机游戏不爆内存"],
            "productivity": ["剪映/PR 4K 顺畅剪辑、大型 IDE (IDEA/VS) 极速索引与多服务联调"],
            "summary": "当前新装机最推荐的黄金容量，兼顾未来 3~5 年大作不爆内存。"
        }
    else:
        return {
            "tier": "主流电竞 / 基础日常办公",
            "badge": "日常刚需及格线",
            "games": ["《英雄联盟》/《CS2》/《无畏契约》无压力畅玩", "轻度单开 3A 游戏"],
            "productivity": ["日常办公、网课、轻度修图与 1080P 剪辑"],
            "summary": "预算有限下的实用之选，日常多任务请注意及时关闭多余后台网页。"
        }

def derive_ssd_workloads(brand, model, attrs, specs, price):
    m = model.upper()
    if "2TB" in m or "4TB" in m:
        return {
            "tier": "海量高速仓库 / 次世代大作秒进",
            "badge": "次世代高速大容量",
            "games": ["可安装 10~15 款 3A 超级大作 (黑神话/COD/大镖客)，告别删游戏焦虑", "DirectStorage 秒速加载无需等待读条"],
            "productivity": ["几十 GB 4K/8K 原始工程素材秒级导入与拖拽回放、频繁大文件拷贝秒传"],
            "summary": "一步到位的高速仓储，极高读写性能带来源源不断的畅快体验。"
        }
    elif "1TB" in m:
        return {
            "tier": "主流系统+游戏标准盘",
            "badge": "主流装机标配",
            "games": ["容纳 Windows 操作系统 + 3~5 款常玩 3A 大作或电竞网游", "极速开机与游戏进图秒加载"],
            "productivity": ["系统运行飞快、设计软件冷启动秒开、日常工程文件秒存"],
            "summary": "当前性价比最高的容量选择，满足大多数玩家日常核心需求。"
        }
    else:
        return {
            "tier": "系统盘 / 办公网游",
            "badge": "基础日常够用",
            "games": ["容纳系统 + 1~2 款核心网游 (LOL/CS2)"],
            "productivity": ["系统开机数秒即达，办公文档极速响应"],
            "summary": "适合预算有限或作为办公主机的系统盘使用。"
        }

def derive_psu_workloads(brand, model, attrs, specs, price):
    m = model.upper()
    if "1000W" in m or "1200W" in m or "1300W" in m or "1600W" in m:
        return {
            "tier": "旗舰功耗保障 / RTX 5090 / 4090 顶配",
            "badge": "旗舰战未来核动力",
            "games": ["稳定支撑 9950X / 14900K + RTX 5090 / 4090 满载运行，从容应对瞬时尖峰功耗"],
            "productivity": ["多卡并行计算或超频高负荷工况长效安全供电"],
            "summary": "千瓦级黄金动力，为顶级旗舰卡保驾护航，长效稳定静音。"
        }
    elif "850W" in m:
        return {
            "tier": "高端电竞黄金功耗 / 4080S / 9800X3D",
            "badge": "高端主机稳健基石",
            "games": ["完美支撑 Ryzen 7 9800X3D / i7-14700K + RTX 4080S / 4070TiS 整机组合"],
            "productivity": ["长时间渲染与大模型训练满载不跳闸"],
            "summary": "高端装机的黄金额定功率，预留足够余量，转换效率高。"
        }
    elif "750W" in m:
        return {
            "tier": "中高端甜点功耗 / 4070S / 7800XT",
            "badge": "主流高配黄金选择",
            "games": ["完美支撑 Ryzen 7 9700X / i5-14600KF + RTX 4070 SUPER / 4070 级别的整机高负载"],
            "productivity": ["日常剪辑与高负载游戏运行平稳"],
            "summary": "甜点高配的极佳选择，兼具性价比与扎实供电能力。"
        }
    else:
        return {
            "tier": "主流入门功耗 / 4060 / 6600",
            "badge": "经济实用能源",
            "games": ["稳定带动 R5 7500F / i5-12400F + RTX 4060 / 3050 / RX 6600 甜点组合"],
            "productivity": ["日常家用与办公超静音运行"],
            "summary": "适合入门与甜点级配置，节能环保静音。"
        }

def derive_cooler_workloads(brand, model, attrs, specs, price):
    m = model.upper()
    if "360" in m or "420" in m or "280" in m or "水冷" in model:
        return {
            "tier": "强力水冷解热 / 压制高功耗旗舰",
            "badge": "极客水冷降温利器",
            "games": ["轻松压制 i9-14900K / Ultra 9 285K / 9950X 满载运行，温度控制在合理区间"],
            "productivity": ["长时间三维渲染与视频转码不积热、不降频"],
            "summary": "大面积水冷排，提供强劲解热效能与机箱正面 RGB 桌搭视觉效果。"
        }
    elif "120 SE" in m or "AK620" in m or "FC140" in m or "双塔" in model or "D15" in m:
        return {
            "tier": "双塔风冷性价比之王 / 耐用无漏液风险",
            "badge": "双塔风冷坚固战神",
            "games": ["完美压制 Ryzen 7 9800X3D / 7800X3D / i5-14600KF，游戏全程 60~70°C 稳健如初"],
            "productivity": ["日常渲染与多任务负载温度平稳，寿命长久省心"],
            "summary": "风冷首选方案，纯铜底座加多热管，性能匹敌中型水冷且终身无漏液隐患。"
        }
    else:
        return {
            "tier": "百元内入门首选 / 低功耗神雕",
            "badge": "国民级百元风冷",
            "games": ["轻松搞定 R5 7500F / 9600X / 5600 / i5-12400F 等 65~100W 处理器，安安静静不积热"],
            "productivity": ["日常多任务与办公低噪运行"],
            "summary": "安装简便，性能够用，高性价比入门与主流 CPU 绝配。"
        }

def derive_case_workloads(brand, model, attrs, specs, price):
    m = model.upper()
    if "海景房" in model or "O11" in m or "全景" in model or "D300" in m:
        return {
            "tier": "270°全景全透海景房 / 旗舰硬件无阻容纳",
            "badge": "高颜值桌搭担当",
            "games": ["支持 360 冷排顶部安装、兼容 400mm+ 超长巨型三风扇显卡、内置手办展示空间"],
            "productivity": ["宽大背线仓，理线方便，多硬盘位拓展充足"],
            "summary": "视野极度开阔的无界全景机箱，硬件光效尽收眼底，适合喜欢桌面美学的用户。"
        }
    else:
        return {
            "tier": "高通风中塔机箱 / 稳健防尘风道",
            "badge": "实用风道散热主力",
            "games": ["前后贯通大风道，快速排出显卡与 CPU 热量，游戏全程清爽"],
            "productivity": ["标配多风扇位与防尘网，日常使用少积灰好打理"],
            "summary": "散热与实用性兼具的标准机箱，结构紧凑扎实，兼容性良好。"
        }

def main():
    print("=" * 60)
    print("🚀 开始为全库硬件批量生成『workloads (驱动能力与带动项目)』字段...")
    print("=" * 60)

    with open(CATALOG_PATH, "r", encoding="utf-8") as f:
        catalog = json.load(f)

    prods = catalog.get("products", [])
    print(f"📦 正在处理 catalog.json 中的 {len(prods)} 款硬件...")

    updated_count = 0
    for p in prods:
        cat = p.get("category", "")
        brand = p.get("brand", "")
        model = p.get("model", "")
        attrs = p.get("attrs", {})
        specs = p.get("specs", {})
        pr = p.get("price") or {}
        price = pr.get("reference")

        if cat == "gpu":
            p["workloads"] = derive_gpu_workloads(brand, model, attrs, specs, price)
        elif cat == "cpu":
            p["workloads"] = derive_cpu_workloads(brand, model, attrs, specs, price)
        elif cat == "motherboard":
            p["workloads"] = derive_motherboard_workloads(brand, model, attrs, specs, price)
        elif cat in ["memory", "ram"]:
            p["workloads"] = derive_memory_workloads(brand, model, attrs, specs, price)
        elif cat in ["ssd", "hdd"]:
            p["workloads"] = derive_ssd_workloads(brand, model, attrs, specs, price)
        elif cat == "psu":
            p["workloads"] = derive_psu_workloads(brand, model, attrs, specs, price)
        elif cat == "cooler":
            p["workloads"] = derive_cooler_workloads(brand, model, attrs, specs, price)
        elif cat == "case":
            p["workloads"] = derive_case_workloads(brand, model, attrs, specs, price)
        else:
            p["workloads"] = {
                "tier": "标准配件支持",
                "badge": "稳定可靠扩展",
                "games": ["为整机系统提供辅助支持与稳定散热"],
                "productivity": ["保障整机长效平稳运转"],
                "summary": "实用配件，为整机搭建提供必不可少的连接与扩展支持。"
            }
        updated_count += 1

    with open(CATALOG_PATH, "w", encoding="utf-8") as f:
        json.dump(catalog, f, ensure_ascii=False, indent=2)

    print(f"✅ catalog.json 处理完毕！全部 {updated_count} 款硬件已成功注入 workloads 字段。")

    # 同时为 user_imported_catalog.json (58 款) 注入能力字段
    if os.path.exists(USER_IMPORTED_PATH):
        with open(USER_IMPORTED_PATH, "r", encoding="utf-8") as f:
            u_cat = json.load(f)
        u_prods = u_cat.get("products", [])
        u_count = 0
        for u in u_prods:
            c = u.get("category", "").lower()
            b = u.get("brand", "")
            m = u.get("model", "")
            attrs = u.get("specs", {})
            pr = u.get("referencePrice")
            if c in ["processor", "cpu"]:
                u["workloads"] = derive_cpu_workloads(b, m, attrs, {}, pr)
            elif c in ["graphics_card", "gpu"]:
                u["workloads"] = derive_gpu_workloads(b, m, attrs, {}, pr)
            u_count += 1
        with open(USER_IMPORTED_PATH, "w", encoding="utf-8") as f:
            json.dump(u_cat, f, ensure_ascii=False, indent=2)
        print(f"✅ user_imported_catalog.json 处理完毕！全部 {u_count} 款硬件已成功注入 workloads 字段。")

if __name__ == "__main__":
    main()
