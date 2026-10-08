import urllib.request
import re

url = 'https://docs.google.com/spreadsheets/d/1rPqAjEaHe2EeTQQArVUIR8JEj2khGngJE8p2s088-Ak/edit?usp=sharing'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
html = urllib.request.urlopen(req).read().decode('utf-8')
matches = re.findall(r'(\w+gid=\d+)', html)
print('matches:', set(matches)[:10] if matches else 'none')
# find sheet names or grid data
gids = re.findall(r'gid=(\d+)', html)
print('gids:', set(gids))
