#!/usr/bin/python3
import sys

html_path = "/usr/lib/node_modules/paperclipai/node_modules/@paperclipai/server/ui-dist/index.html"

# Read the file
with open(html_path, 'r') as f:
    content = f.read()

# Check if already injected
if 'noedis-nav' in content:
    print("Already injected, skipping.")
    sys.exit(0)

# Create the navigation HTML to inject
nav_html = '''<!-- NOEDIS THREE-VIEW NAV -->
<style>
.noedis-nav{position:fixed;top:0;left:0;right:0;z-index:99999;display:flex;justify-content:center;gap:2px;padding:6px;background:rgba(0,0,0,0.9);border-bottom:1px solid #333;font-family:system-ui,sans-serif}
.noedis-nav a{color:#666;text-decoration:none;padding:4px 16px;border-radius:4px;font-size:12px;font-weight:600;letter-spacing:1px;transition:all .2s}
.noedis-nav a:hover{color:#fff;background:rgba(255,255,255,0.1)}
.noedis-nav a.active{color:#0f0;background:rgba(0,255,0,0.1)}
.noedis-nav a:first-child{color:#0af}
</style>
<div class="noedis-nav"><a href="/" class="active">PAPERCLIP</a><a href="/noedis/gameplay/" target="_blank">GAMEPLAY</a><a href="#" onclick="alert(\'Dashboard coming soon\')">DASHBOARD</a></div>
'''

# Inject after PAPERCLIP_RUNTIME_BRANDING_END
content = content.replace(
    '<!-- PAPERCLIP_RUNTIME_BRANDING_END -->',
    '<!-- PAPERCLIP_RUNTIME_BRANDING_END -->\n' + nav_html
)

# Write back
with open(html_path, 'w') as f:
    f.write(content)

print("Navigation injected successfully.")