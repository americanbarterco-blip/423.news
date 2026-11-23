# 423 Arcade Stripe monetization setup

## Current integration scope
- Arcade Club subscription Checkout (Stripe Price ID supplied via Worker variable)
- One-time Arcade sponsorship Checkout (Stripe Price ID supplied via Worker variable)
- Checkout sessions created server-side by the Cloudflare Worker; secret key never goes into browser code
- Stripe webhook endpoint verifies Stripe's signature with a 5-minute timestamp tolerance
- Payment proceeds are collected by the 423.news platform Stripe account and then paid out to the platform's bank account through Stripe's configured payout schedule
- No virtual game coins, scores, or gameplay winnings are cash-redeemable

## Required Cloudflare Worker secrets/variables
Configure on the 423-news Worker before checkout can work:
- Secret `STRIPE_SECRET_KEY`: restricted or standard Stripe secret key for the platform account
- Secret `STRIPE_WEBHOOK_SECRET`: signing secret for webhook endpoint
- Variable `ARCADE_CLUB_PRICE_ID`: Stripe recurring monthly Price ID (set the price to USD $2.99/month in Stripe Dashboard)
- Variable `ARCADE_SPONSOR_PRICE_ID`: Stripe one-time Price ID for sponsorship contribution

## Stripe webhook
Register `https://423.news/api/arcade/stripe-webhook` in Stripe Dashboard > Developers > Webhooks. Subscribe at minimum to:
- `checkout.session.completed`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_failed`

Webhook currently verifies and acknowledges events; durable subscription/sponsor status, receipts, entitlements, and reconciliation are **not yet implemented**. Do not represent the membership as activated until that storage/entitlement work is completed.

## Payouts
Payments go to the platform's Stripe account balance. Set the bank account and payout cadence in Stripe Dashboard > Settings > Bank accounts and scheduling. This integration does not pay players or game creators, and Stripe Connect recipient payouts are not enabled. Do not use Stripe payouts for virtual-game winnings.

## Production launch checklist
1. Create the recurring $2.99 Arcade Club price and one-time sponsor price in the Stripe account.
2. Add the four Worker variables/secrets above.
3. Register the webhook and add its signing secret.
4. Test in Stripe test mode, including cancellation and payment failure.
5. Add durable webhook event handling, idempotency, subscription entitlement state, sponsor records, admin controls, and privacy/terms/renewal/cancellation notices before enabling live charges.
6. Switch to live Stripe keys and live Price IDs only after full verification.
