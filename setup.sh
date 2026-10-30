#!/usr/bin/env bash
# KO Trends — one-time Cloudflare setup. Run from this folder: bash setup.sh
set -euo pipefail
cd "$(dirname "$0")"

echo "== 1/6 Installing tools"
npm install --silent

echo "== 2/6 Log in to Cloudflare (a browser window opens)"
npx wrangler whoami >/dev/null 2>&1 || npx wrangler login

echo "== 3/6 Database (D1)"
if grep -q REPLACE_WITH_YOUR_D1_ID wrangler.toml; then
  OUT=$(npx wrangler d1 create ko-trends 2>&1) || { echo "$OUT"; exit 1; }
  ID=$(echo "$OUT" | grep -oE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' | head -1)
  [ -n "$ID" ] || { echo "$OUT"; echo "Could not read the database id. Paste it into wrangler.toml by hand."; exit 1; }
  sed -i.bak "s/REPLACE_WITH_YOUR_D1_ID/$ID/" wrangler.toml && rm -f wrangler.toml.bak
  echo "Database created: $ID"
fi
npx wrangler d1 execute ko-trends --remote --file=schema.sql -y
npx wrangler d1 execute ko-trends --remote --file=seed.sql -y

echo "== 4/6 Photo storage (R2)"
npx wrangler r2 bucket create ko-trends-media 2>&1 | grep -v "already exists" || true

echo "== 5/6 Website project"
npx wrangler pages project create ko-trends --production-branch=main 2>&1 | grep -v "already exists" || true

echo "== 6/6 Owner password"
echo "Type the password the owner will use to log in at /admin (at least 10 characters):"
npx wrangler pages secret put ADMIN_PASSWORD --project-name ko-trends
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))" | npx wrangler pages secret put SESSION_SECRET --project-name ko-trends

npx wrangler pages deploy public --project-name ko-trends --branch main --commit-dirty=true
echo
echo "Done. Your store is live at https://ko-trends.pages.dev  (owner panel: /admin)"
echo "Add your own domain in Cloudflare: Workers & Pages > ko-trends > Custom domains."
