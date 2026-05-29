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

The wallet screen can show a shared custody deposit address plus a unique memo for each Telegram user.

Set these Vercel environment variables before accepting deposits:

```bash
TON_CUSTODY_DEPOSIT_ADDRESS=your_ton_custody_address
TON_CUSTODY_MEMO_SECRET=your_private_random_secret
TON_NETWORK=testnet
TON_CUSTODY_ASSET_NAME=Testnet TON
```

`TON_CUSTODY_DEPOSIT_ADDRESS` is the TON address users send funds to. `TON_CUSTODY_MEMO_SECRET` keeps each user's memo stable without exposing how it is generated. `TON_CUSTODY_ASSET_NAME` controls the wallet label, so testnet can show `Testnet TON` and mainnet can later show `USDT on TON`. Deposits still need a server-side scanner or admin reconciliation step before balances are credited inside the app.

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
