
wrangler pages deploy out/ --project-name=cloudflare-test
wrangler init cloudflare-test-audio-websocket
wrangler deploy --config workers/sse-do/wrangler.toml
