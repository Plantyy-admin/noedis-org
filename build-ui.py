import sys
with open('/tmp/index-clean.html','r') as f:
    h = f.read()
css = '<style>.noedis-bar{position:fixed;top:0;left:0;right:0;z-index:99999;display:flex;align-items:center;justify-content:center;height:36px;background:#0a0a0a;border-bottom:1px solid #1a2a1a;font-family:system-ui,sans-serif}.noedis-overlay{position:fixed;top:36px;left:0;right:0;bottom:0;z-index:99998;display:none;background:#0a0a0a;overflow:auto}.noedis-overlay.active{display:block}.ob{overflow:hidden}</style>'
h = h.replace('</head>', css + '\n</head>')
with open('/tmp/noedis-app.js','r') as f:
    js = f.read()
h = h.replace('</body>', '<script>\n' + js + '\n</script>\n</body>')
with open('/tmp/index-final.html','w') as f:
    f.write(h)
ok1 = 'CODY' in h
ok2 = 'STRUCTURE' in h
print('OK len=' + str(len(h)) + ' CODY=' + str(ok1) + ' STRUCTURE=' + str(ok2))