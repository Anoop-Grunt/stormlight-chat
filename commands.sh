pnpm wrangler pages deploy out/ --project-name=cloudflare-test
#the next command needs to be repeated for each worker
pnpm wrangler deploy --config workers/sse-do/wrangler.toml
pnpm wrangler kv namespace create CHAT_KV
