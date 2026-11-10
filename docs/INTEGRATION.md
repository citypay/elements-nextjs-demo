# Integration guide

Start with the [README](../README.md). This guide explains where to adapt the running example, without requiring CityPay's internal repositories.

## The integration path

```text
Provider startup → Next.js session route → @citypay/sdk → CityPay
                                   ↓ browser session
                    @citypay/elements-react provider + hosted fields
                                   ↓ tokenise / attach / confirm / 3DS
                    Next.js authorise and verify routes → @citypay/sdk
                                   ↓ verified result
                              Success toast
```

The SDK owns CityPay authentication and HTTP transport. Next.js owns your site's incoming requests. The request helper is not another SDK: it checks origin, JSON, a 16 KB body limit, no-cache responses and safe errors. Keeping these checks together avoids repeating them across routes.

## Files to edit

| File                                   | Purpose                                                                            |
| -------------------------------------- | ---------------------------------------------------------------------------------- |
| `src/app/api/payment-session/route.ts` | Direct `sdk.paymentIntents.create` call and browser session response               |
| `src/app/api/authorise/route.ts`       | Direct `sdk.paymentIntents.authorise` call                                         |
| `src/lib/server/verify-payment.ts`     | `sdk.paymentIntents.verifyAuthorised` and matching the result to the checkout      |
| `src/lib/server/citypay.ts`            | Server-only SDK construction and sandbox credentials                               |
| `src/components/payment-panel.tsx`     | React provider, card widget, readiness, payment actions and toasts                 |
| `src/components/payment-methods/`      | Separate individual-field, Apple Pay and Google Pay examples                       |
| `src/lib/payment-flow.ts`              | Card/Google SDK sequence and uncertain-result handling                             |
| `src/lib/server/order.ts`              | Authoritative price/tax calculation                                                |
| `src/lib/catalogue.ts`                 | Demo products and delivery prices                                                  |
| `src/lib/contracts.ts`                 | Input validation and browser response allowlists                                   |
| `src/lib/server/request.ts`            | Incoming Next.js request checks and error responses                                |
| `src/lib/server/checkout-cookie.ts`    | Small signed browser-to-intent binding; replace with merchant order/session lookup |
| `src/instrumentation.ts`               | Startup suppression of unsafe SDK debug logging                                    |

`checkout.tsx` contains the storefront. The server page checks required settings on each request and passes only fixed error descriptions to it. Payment components load with `ssr: false`; `'use client'` alone does not stop server rendering.

## Routes

| Route                             | Input / result                                                                            |
| --------------------------------- | ----------------------------------------------------------------------------------------- |
| `GET /api/ping`                   | Process health only; does not check credentials or gateway access                         |
| `POST /api/payment-session`       | `{ checkoutId, order }` → `{ session, quote }`; sets signed HttpOnly cookie               |
| `POST /api/authorise`             | `{ intentId }` → `{ authorised, status }`, with a structured error for a decline          |
| `POST /api/verify-auth`           | `{ intentId }` → `{ status: 'success', auth: { authcode } }` only after verification      |
| `GET /api/verify-auth/[intentId]` | SDK 2.2.0 compatibility callback; returns the raw `{ authcode }` because the SDK wraps it |

POST requests use same-origin `/api/...` URLs and JSON. `order` contains `items: [{ productId, quantity }]`, `delivery` and an optional `customer`; the exact allowed fields are in `contracts.ts`. Unknown request keys, including prices, are rejected. The catalogue accepts `tee-black` and `tee-sienna`, quantities 1–8, and `standard` or `express` delivery. The immediate demo omits `customer` and sends no billing/shipping contacts. If a merchant supplies `customer`, its full schema is still validated and optional contact fields use empty strings. The collapsed page inputs are layout examples, not submitted payment data. Do not send PAN, CSC or wallet tokens to these routes.

Responses are uncached. Errors return a safe `{ code, message }` with non-2xx HTTP status; the SDK GET callback nests it under `error`. An HTTP 200 from authorisation can still be a decline: inspect `authorised`. Only verification is final payment evidence for this UI. SDK exceptions are never returned directly.

## Small safeguards retained in the example

The signed checkout cookie contains only intent ID, amount, merchant ID and expiry. It is HMAC-authenticated, **not encrypted**. A purpose-specific signing key is derived from the server licence key, so no extra setup variable is needed. Rotating that key invalidates existing cookies. It expires after 30 minutes, is HttpOnly and SameSite Strict, and uses Secure on HTTPS. Another checkout in the same browser replaces it. It does not contain contact details, card data or CityPay session tokens.

The cookie prevents arbitrary intent IDs or prices from being substituted on authorisation/verification requests. It does not provide an order database, replay ledger or customer login. Merchants should replace it with their existing authenticated order/session system; see [Merchant responsibilities](MERCHANT-RESPONSIBILITIES.md).

The browser keeps one checkout UUID in sessionStorage and passes it as the SDK creation idempotency key. Authorisation uses a stable intent-derived key. No automatic mutation retries are added. A failed authorisation/verification leaves the UI in an uncertain state with a status-check action. A known decline can start a new checkout. Keep an unchanged payload when reusing a key; new keys represent new checkouts, not recovery of an unknown payment.

## Adaptation and browser checks

- Change product/delivery data and validation together. The server recalculates prices; only the returned quote funds the intent and wallets. Values are integer GBP pence (`7452` means £74.52).
- Keep the provider callback stable and share its in-flight request. The SDK requests the fixed-basket session on initialisation; do not add independent creation effects or create another session for widget/layout remounts. Failed loading requires an explicit retry using the same checkout ID.
- Card and Google Pay use tokenise/attach/confirm, automatic 3DS, server authorisation when required, then verification. Apple Pay's SDK authorises internally; its completion event must verify without authorising twice.
- Widget options are read at mount, so layout/theme changes remount it and reset completion. Preserve readiness, duplicate-click guards and an interactive 3DS challenge.
- Keep version-specific field/Google adapters until the published React package supports the required APIs. See [Library notes](../LIBRARY-NOTES.md).

For a release, run the README checks, then inspect desktop/mobile layouts, each payment method/layout, required fields, unavailable wallets and the missing-configuration error. On a configured HTTPS sandbox origin, exercise successful/declined payments, 3DS completion/cancellation, lost responses, verification mismatch and wallet cancellation. Confirm that only verified results show success and that private credentials are absent from browser assets, responses and logs. Keep these real gateway checks distinct from mocked unit tests.
