# KO Trends — online store

What's in the package:

- **The store website** (Arabic and English).
- **An owner panel** at `/admin`, where you:
  - see orders and change their status;
  - add and edit products and upload photos;
  - mark sizes as sold out.
- **A real database** (Cloudflare D1) that holds products and orders.
- **Photo storage** (Cloudflare R2) for product pictures.

Every order is checked on the server, then saved:

- **Prices** come from the database.
- **Stock** is checked before the order is accepted and goes down when it's placed.
- **Discounts:** 10% off 3 or more items, or with the code `KO10`.
- **Delivery:** $4 to Lebanon and $5 to Syria, free from $100.

## Go live (one time, about 10 minutes)

You need: a free Cloudflare account and Node.js 18+ (nodejs.org).

1. In the Cloudflare dashboard, open **R2** once and press **Enable** (free tier, no card charge for small use).
2. Unzip this folder, open a terminal inside it and run:

   ```
   bash setup.sh
   ```

   The script does the following:
   - logs you in to Cloudflare in your browser;
   - creates the database and fills it with the 31 products;
   - creates the photo storage and the website project;
   - asks you to **type the owner password** (pick a strong one; only you know it);
   - puts the site online.

   On Windows, run it in **Git Bash** or **WSL**.

3. Open `https://ko-trends.pages.dev`. The owner panel is `https://ko-trends.pages.dev/admin`.
4. **Your own domain:** Cloudflare dashboard → Workers & Pages → ko-trends → Custom domains → add e.g. `kotrends.com`.

## Every day

- **New order:** it shows in `/admin` (refreshes every 30 s). The customer also sends it to WhatsApp. Change the status as you go:
  - New → Confirmed → Out for delivery → Delivered.
  - Setting it to **Cancelled** puts the stock back automatically.
- **New product:** go to `/admin` → Products → **+ Add product**, then add photos, price, sizes and stock, and press Save. It's on the site within 30 seconds.
- **Sold-out size:** open the product and tap the size so it turns red.

## Change the owner password

```
npx wrangler pages secret put ADMIN_PASSWORD --project-name ko-trends
npm run deploy
```

After 8 wrong passwords, that connection is blocked for 15 minutes.

## Update the website files

After changing anything in `public/` or `functions/`:

```
npm run deploy
```

## Test on your own computer

```
cp .dev.vars.example .dev.vars     # set a local test password inside
npm run dev                        # http://localhost:8788
```

## Backups

```
npx wrangler d1 export ko-trends --remote --output=backup.sql
```

Designed and developed by Kamel Nassif · Solunera 2026
