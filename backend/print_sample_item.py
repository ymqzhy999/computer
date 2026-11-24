import urllib.request
import urllib.parse
import json

base_url = 'https://zj.zol.com.cn/index.php'
headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Referer': 'https://zj.zol.com.cn/',
    'X-Requested-With': 'XMLHttpRequest',
}
params = urllib.parse.urlencode({
    'c': 'Ajax_ParamResponse',
    'a': 'GetGoods',
    'subcateId': '28',
    'type': '1',
    'page': '1',
})
raw = urllib.request.urlopen(urllib.request.Request(f"{base_url}?{params}", headers=headers)).read().decode('gbk', errors='ignore')
data = json.loads(raw)
html_data = data.get('data', '')
# Print first 2000 chars of data
print(html_data[:2000])
