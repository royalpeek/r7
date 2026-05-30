This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Telegram market sharing

Market share links use each market's database `id` as the deep-link payload.

Set these Vercel environment variables so shared links open the Telegram Mini App directly:

```bash
NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=your_bot_username
NEXT_PUBLIC_TELEGRAM_APP_SHORT_NAME=your_mini_app_short_name
```

Shared links are generated like:

```text
https://t.me/your_bot_username/your_mini_app_short_name?startapp=market_MARKET_ID_ref_REFERRAL_CODE
```

When that link opens, the app reads `market_MARKET_ID_ref_REFERRAL_CODE`, applies the referral code if the user has not already been referred, finds the market, and opens the live detail page or the ended result page.

Profile invite links use this format:

```text
https://t.me/your_bot_username/your_mini_app_short_name?startapp=ref_REFERRAL_CODE
```

## Custodial TON wallet

R7 uses custodial TON wallets. The server creates a TON wallet for each user and signs testnet sends on the server. `TON_WALLET_ENCRYPTION_KEY` is the master key to user wallet mnemonics and must stay server-only.

Set these Vercel environment variables before accepting deposits:

```bash
TON_CUSTODY_DEPOSIT_ADDRESS=your_ton_custody_address
TON_WALLET_ENCRYPTION_KEY=your_private_wallet_encryption_secret
TON_NETWORK=testnet
TON_CUSTODY_ASSET_NAME=Testnet TON
TONCENTER_API_KEY=your_toncenter_api_key_optional
TONAPI_KEY=your_tonapi_key_optional
TON_TESTNET_WITHDRAW_LIMIT=5
TON_TESTNET_DAILY_WITHDRAW_LIMIT=10
TON_ADMIN_RECOVERY_LIMIT=25
CRON_SECRET=your_private_cron_secret
```

Each user now gets a unique TON deposit address, so memo is no longer required. `TON_WALLET_ENCRYPTION_KEY` is required for wallet mnemonic encryption and decryption. Do not set `NEXT_PUBLIC_TON_WALLET_ENCRYPTION_KEY`; anything prefixed with `NEXT_PUBLIC_` can reach the browser.

Run `supabase/user-ton-wallets.sql`, `supabase/ton-deposits.sql`, and `supabase/transactions.sql` in Supabase before enabling automatic deposit crediting. Vercel Hobby can only run the built-in cron slowly, so use an external scheduler for faster testnet scans. Call this URL every few minutes:

```text
https://your-domain.vercel.app/api/cron/ton-deposits?secret=YOUR_CRON_SECRET
```

`CRON_SECRET` protects that endpoint, and `TONCENTER_API_KEY` raises Toncenter rate limits.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
