#!/usr/bin/python3
import shutil

caddy_content = """tracker.noedis.uk {
\treverse_proxy 127.0.0.1:8090
\tencode zstd gzip
\theader {
\t\tStrict-Transport-Security "max-age=31536000; includeSubDomains"
\t\tX-Content-Type-Options "nosniff"
\t\tReferrer-Policy "strict-origin-when-cross-origin"
\t}
}

flow.noedis.uk {
\tredir /atlas /atlas/ 308
\thandle /atlas/* {
\t\treverse_proxy 127.0.0.1:5193
\t}
\thandle {
\t\treverse_proxy 127.0.0.1:3000
\t}
\tencode zstd gzip
\theader {
\t\tStrict-Transport-Security "max-age=31536000; includeSubDomains"
\t\tX-Content-Type-Options "nosniff"
\t\tReferrer-Policy "strict-origin-when-cross-origin"
\t}
}

noedis.io {
\treverse_proxy 127.0.0.1:5195
\tencode zstd gzip
\theader {
\t\tStrict-Transport-Security "max-age=31536000; includeSubDomains"
\t\tX-Content-Type-Options "nosniff"
\t\tReferrer-Policy "strict-origin-when-cross-origin"
\t}
}

noedis.me {
\troot * /opt/noedis/noedis-me/dist
\t@ndnoslash path /plantyy
\tredir @ndnoslash /plantyy/ 301
\tfile_server
\tencode zstd gzip
\theader {
\t\tStrict-Transport-Security "max-age=31536000; includeSubDomains"
\t\tX-Content-Type-Options "nosniff"
\t\tReferrer-Policy "strict-origin-when-cross-origin"
\t}
\t@ndfonts path /plantyy/assets/fonts/*
\theader @ndfonts Cache-Control "public, max-age=31536000, immutable"
\t@ndbrand path /plantyy/assets/brand/*
\theader @ndbrand Cache-Control "public, max-age=604800"
\t@ndhtml path *.html
\theader @ndhtml Cache-Control "public, max-age=0, must-revalidate"
}

# NOEDIS Autonomous Company
noedis.org {
\thandle /noedis/gameplay/* {
\t\troot * /srv/noedis/gameplay
\t\tfile_server
\t}
\thandle {
\t\treverse_proxy 127.0.0.1:3100
\t}
\tencode zstd gzip
\theader {
\t\tStrict-Transport-Security "max-age=31536000; includeSubDomains"
\t\tX-Content-Type-Options "nosniff"
\t\tX-Frame-Options "DENY"
\t\tReferrer-Policy "strict-origin-when-cross-origin"
\t}
}

notify.noedis.org {
\treverse_proxy 127.0.0.1:8100
\tencode zstd gzip
\theader {
\t\tStrict-Transport-Security "max-age=31536000; includeSubDomains"
\t\tX-Content-Type-Options "nosniff"
\t}
}
"""

with open('/etc/caddy/Caddyfile', 'w') as f:
    f.write(caddy_content)

print("Caddyfile written successfully.")