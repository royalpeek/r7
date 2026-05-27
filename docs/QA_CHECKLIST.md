# R7 QA Checklist

Use this before every serious deploy.

## Setup

- Vercel environment variables exist for Supabase and Telegram bot.
- Supabase has run `supabase/setup.sql` or all current migration snippets.
- Your Telegram user is set to `admin` in `public.users`.
- Test user has enough balance.

## Home

- Home loads without a full-page crash.
- Active markets show only live markets.
- Ended/closed markets do not appear as active.
- Vote counts are hidden before a market ends.
- Swipe up/down changes cards with feedback.
- Swipe left/right opens the correct vote direction.
- Wallet balance updates after voting.

## Create

- Only `creator` and `admin` users see Create.
- Normal users cannot create through the API.
- Creator open-market quota blocks extra active markets.
- Creator gets a new slot after one market ends/closes.
- Long or empty questions are rejected clearly.

## Search

- Searching finds matching markets.
- Opening a result does not hide stake buttons behind navigation.
- Active searched markets hide vote counts.
- Ended searched markets show final result data.

## Portfolio

- Balance card shows wallet balance.
- P&L card opens Performance.
- Claimable only shows unclaimed ended winning rewards.
- Active tab only shows live positions.
- History tab shows ended/closed positions.
- Claim button appears only when there is something claimable.
- Claiming updates wallet balance and transaction history.

## Performance

- Header and tabs stay fixed while stats scroll.
- Performance tab shows profit/loss, win rate, and market count.
- Creator tab appears only for creator/admin accounts.
- Creator tab shows fees and created markets.

## Wallet

- Wallet sheet opens cleanly above nav.
- Transaction history loads.
- Stake and fee appear after voting.
- Claim payout appears after claiming.
- Creator reward appears when creator reward is paid.

## Admin

- Admin page is hidden from non-admin users.
- Admin can pause, resume, close, archive, and delete test markets.
- Archived markets do not appear in public feed.
- Deleted test markets remove related history/votes.

## Privacy

- Active markets do not reveal YES/NO vote counts.
- Active markets do not reveal total voter count.
- Votes table is blocked from direct browser reads.
- Users table is blocked from direct browser reads.
- Transactions table is blocked from direct browser reads.

## Claims

- Ended winning positions show claimable payout.
- Losing positions cannot claim.
- Draw returns stake only.
- User cannot claim twice.
- Claimable number drops after claiming.

## Final Smoke Test

- Create market.
- Vote YES from one account.
- Vote NO from another account if available.
- Close/end market.
- Confirm final screen shows winner only after end.
- Claim reward.
- Confirm balance and transaction history update.
