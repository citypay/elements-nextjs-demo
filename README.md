# CityPay Elements · Next.js example

A sandbox checkout demonstrating two published dependencies:

- **`@citypay/elements-react`** mounts the provider, hosted card widget and Apple Pay component.
- **`@citypay/sdk`** creates payment sessions, authorises payments and verifies their results on the server. The React provider also exposes its browser Elements APIs.

The widget loads immediately with a fixed demo basket. Visitors can try card layouts, individually mounted fields and wallets without completing contact or shipping details. Optional example fields are collapsed and are not sent with the demo payment. It runs as **one Next.js application**, locally or on Vercel. No database or separate backend is required.

## Run locally

Use Node.js 24 LTS and pnpm 11.15.1.

```sh
pnpm install --frozen-lockfile
cp .env.example .env.local
# Fill in your CityPay sandbox settings, then:
pnpm dev
```

Open `http://localhost:3000`. If required settings are missing, the server renders a clear configuration error and disables payment. Restart after changing environment variables; public settings require a rebuild for deployment. The configuration check does not test credential validity or gateway connectivity.

| Variable                               | Purpose                                  |
| -------------------------------------- | ---------------------------------------- |
| `NEXT_PUBLIC_CITYPAY_PUBLIC_KEY`       | Public sandbox key for the browser       |
| `CITYPAY_CLIENT_ID`                    | Server-only sandbox client ID            |
| `CITYPAY_LICENCE_KEY`                  | Server-only sandbox licence key          |
| `CITYPAY_MERCHANT_ID`                  | Server-only positive integer merchant ID |
| `NEXT_PUBLIC_GOOGLE_PAY_MERCHANT_ID`   | Optional public Google Pay merchant ID   |
| `NEXT_PUBLIC_GOOGLE_PAY_MERCHANT_NAME` | Optional public wallet display name      |

Use matching sandbox settings. Never prefix private credentials with `NEXT_PUBLIC_`. The application fixes CityPay to sandbox and Google Pay to `TEST`.

## Start with these files

1. [Create a payment session](src/app/api/payment-session/route.ts). Validate the basket, calculate its total on the server, then call `sdk.paymentIntents.create(...)`.
2. [Mount the React components](src/components/payment-panel.tsx). Give `CityPayProvider` the returned session and render `CardElement`.
3. [Complete the card payment](src/lib/payment-flow.ts). Use the element's `tokenise`, `attach` and `confirm` methods, including SDK-managed 3DS.
4. [Authorise](src/app/api/authorise/route.ts) and [verify](src/lib/server/verify-payment.ts) with the server SDK. Only a verified result produces the success toast.

The provider integration is:

```tsx
import { CardElement, CityPayProvider } from '@citypay/elements-react';

<CityPayProvider
  pubKey={process.env.NEXT_PUBLIC_CITYPAY_PUBLIC_KEY}
  createServerIntent={async () => (await loadCheckout()).session}
  middleware={{ authorise: '/api/authorise', verifyAuth: '/api/verify-auth' }}
>
  <CardElement identifier="checkout-card" visible />
</CityPayProvider>;
```

This mounts the widget; [payment-panel.tsx](src/components/payment-panel.tsx) connects readiness and the Pay button. The provider requests the session on startup through `loadCheckout`, which shares a single in-flight promise across callback repeats. There is no Continue step or customer-form validation gate. Layout and theme changes reuse that session; an explicit loading retry retains its checkout ID. All payment components sit behind a client-only, no-SSR boundary.

On the server, [citypay.ts](src/lib/server/citypay.ts) constructs `CityPay` from `@citypay/sdk` with private credentials and `{ sandbox: true }`. The route calls the SDK directly. **There is no custom CityPay HTTP client or payment-service abstraction.** The SDK owns authentication, request transport and API response conversion.

The small [request helper](src/lib/server/request.ts) only checks incoming browser requests and formats safe Next.js responses. A [signed cookie](src/lib/server/checkout-cookie.ts) binds the browser to the intent and server-calculated amount. Neither is a CityPay dependency or a replacement for SDK functionality.

## Payment methods

The card widget uses `CardElement`; Apple Pay uses `ApplepayElement`. Method-specific components are in [payment-methods](src/components/payment-methods). Google Pay and individual fields use public SDK factories through `useElements()` because React 1.0.6 has a missing export and a listener defect. No package internals are copied or patched.

Wallets require HTTPS, a supported browser/device, merchant enablement and any required domain registration. Apple Pay additionally needs a usable Wallet card. Google Pay needs the public merchant settings above. Local HTTP is suitable for inspecting the storefront; use trusted HTTPS for hosted payment/wallet testing. Next.js supports `pnpm exec next dev --experimental-https` for local development.

The default order is £74.52: two £32 shirts, £5 delivery and illustrative 8% tax. The server computes integer GBP pence; the browser cannot supply prices. Wallets receive that same total.

## Deploy to Vercel

1. Import this folder as a Next.js project with Node.js 24.x.
2. Use `pnpm install --frozen-lockfile` and `pnpm build`; keep the default output directory.
3. Set the four CityPay variables and optional Google Pay settings. Use sandbox credentials even in Vercel's Production environment.
4. Deploy and register the HTTPS origin with CityPay and the wallet providers as required.

The page and `/api/...` routes deploy together. No Redis, Express service, proxy, localhost API URL or uploaded certificate is needed. Do not use static export.

## What this example does—and what merchants provide

The example validates input, keeps credentials server-side, checks the current checkout, passes stable SDK idempotency keys, prevents duplicate clicks and verifies the amount/currency/merchant before success. It does **not** provide durable order storage, distributed request deduplication, reconciliation or fulfilment.

Read [Merchant responsibilities](docs/MERCHANT-RESPONSIBILITIES.md) before adapting it to real orders. Passing an idempotency key demonstrates SDK usage; it is not evidence that every upstream retry or retention case is safe. Live retry semantics have not been verified here.

**Published SDK 2.2.0 logs request bodies through `console.debug`, including authentication data.** [instrumentation.ts](src/instrumentation.ts) disables all Node server debug output before requests are served. Info/warn/error logging remains available. Keep this workaround until an upstream fix is verified; do not run credentialed SDK scripts outside this setup without equivalent protection. [Library notes](LIBRARY-NOTES.md) document this and the component/type limitations.

## Validate and adapt

```sh
pnpm format:check
pnpm typecheck
pnpm lint
pnpm test
pnpm build
node scripts/check-client-assets.mjs
```

Tests use synthetic values and mocked network responses. Actual card/3DS/wallet transactions still require sandbox credentials and a configured HTTPS origin. See [VERIFICATION.md](VERIFICATION.md) for evidence and [the integration guide](docs/INTEGRATION.md) for route contracts and smoke tests.

Resolved dependencies are `@citypay/elements-react` **1.0.6**, `@citypay/sdk` **2.2.0**, Next.js **16.4.6** and React **19.3.1**. Keep the lockfile when sharing this example. [AGENTS.md](AGENTS.md) guides coding assistants; [CLAUDE.md](CLAUDE.md) imports it.

Official references: [CityPay Elements](https://docs.citypay.com/elements), [Payment Intents](https://docs.citypay.com/intent).
