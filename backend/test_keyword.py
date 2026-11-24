import requests
url = "https://zj.zol.com.cn/index.php?c=Ajax_ParamResponse&a=GetGoods&subcateId=28&type=1&keyword=9800X3D"
resp = requests.get(url, headers={"User-Agent": "Mozilla/5.0"})
html = resp.json().get("data", "")
with open("F:/ai_video/pc-forge/backend/sample_9800x3d.html", "w", encoding="utf-8") as f:
    f.write(html)
print("Written sample_9800x3d.html, length:", len(html))
