# Instructions for contributors and coding agents

This is a **minimal CityPay sandbox SDK showcase for integrators**. Keep its integration easy to read. `CLAUDE.md` imports this file for Claude Code; other agents should follow it directly.

## Start here

Read [README.md](README.md) for the integration path, [docs/INTEGRATION.md](docs/INTEGRATION.md) for contracts, and [LIBRARY-NOTES.md](LIBRARY-NOTES.md) before changing package usage. [docs/MERCHANT-RESPONSIBILITIES.md](docs/MERCHANT-RESPONSIBILITIES.md) deliberately separates production order concerns. [VERIFICATION.md](VERIFICATION.md) records actual evidence, not deployment guarantees.

## Keep the example small

- Use public exports from the installed `@citypay/sdk` and `@citypay/elements-react` dependencies. No workspace links, copied library implementations, patched node_modules or invented APIs.
- Keep direct `sdk.paymentIntents.create` and `authorise` calls readable in their Next.js routes. Shared verification is in `src/lib/server/verify-payment.ts` for the POST route and SDK GET callback.
- Do not reintroduce a generic payment dispatcher, Gateway abstraction, custom CityPay HTTP transport, Redis requirement or production order state machine. Keep the example focused on SDK usage and document merchant responsibilities separately.
- `src/lib/server/request.ts` is only for incoming Next.js request checks and safe responses; the SDK owns outbound CityPay HTTP/authentication.
- Keep method-specific browser examples in `src/components/payment-methods/`. The main payment panel shows the React provider and card integration.
- Comments should explain purpose, units, safety boundaries and necessary compatibility workarounds. Use ordinary readable functions, descriptive names and the formatter.

## Preserve these boundaries

- Keep server credentials and SDK construction in `server-only` modules. Only the public key and public wallet settings go to the browser. Never copy credentials from another repository or capture them in docs/logs/screenshots.
- Keep this example in CityPay sandbox and Google Pay TEST. Production is a separate merchant integration decision.
- Keep the homepage dynamic and check configuration server-side. Missing settings must show a persistent payment error before submission; only fixed error descriptions may be serialised.
- Validate browser input, calculate amounts on the server in integer GBP pence, and allowlist browser responses. Never accept client prices or card data in merchant routes.
- Preserve origin/JSON/body-size checks, uncached responses and sanitised errors. Preserve the signed cookie's ownership, signature, expiry and merchant checks until replacing it with a real authenticated order system.
- Load the widget immediately through the provider's stable `createServerIntent` callback, sharing one in-flight session promise. Do not add independent intent-creation effects, gate widget loading on customer-form validation, or change idempotency keys after an ambiguous result. Browser duplicate-click guards and stable SDK keys are demonstrations, not distributed at-most-once guarantees.
- Keep tokenisation, attachment, confirmation and 3DS in the SDK. Only a server-verified matching payment may trigger success. Apple Pay completion verifies without a second authorisation. Keep the 3DS challenge interactive while processing.
- Preserve status checking after uncertain authorisation/verification. Do not convert a timeout into a decline or silently start a new checkout.
- Keep `src/instrumentation.ts` server debug suppression until SDK request-body logging is fixed upstream and verified. Do not temporarily replace global logging around individual requests; concurrent requests make that unsafe.
- Payment components load with SSR disabled. Preserve documented Strict Mode and type-declaration workarounds until upstream fixes are checked.

## UI preferences

Use British English in project wording, including “licence” for the noun and `CITYPAY_LICENCE_KEY` for the application environment variable. Preserve names defined by external APIs and package formats.

Use toasts for completion/success and recoverable errors. Use a persistent alert for missing configuration. Preserve accessible labels, responsive layout, clear loading states and disabled incomplete submission. Use the official CityPay logo from `https://cdn.citypay.com/citypay-logo.svg` unchanged.

## Validation and handover

Use Node.js 24 LTS and the pnpm version in package.json. For first-time setup, copy `.env.example` to `.env.local` without overwriting existing settings.

```sh
pnpm format:check
pnpm typecheck
pnpm lint
pnpm test
pnpm build
node scripts/check-client-assets.mjs
```

Run `pnpm format` when needed. Tests mock the published SDK/network, using synthetic data; do not add a fake-success production mode. Add meaningful tests for validation, cookie ownership, pricing or payment outcome changes. Browser changes need applicable integration-guide smoke checks. The library probe intentionally reproduces known defects and is not a passing-release certificate.

Update docs with behaviour and environment changes. Clearly distinguish tests/static inspection, browser checks, real sandbox transactions and deployment. Do not claim a live payment or production readiness from a mocked test or successful build. Preserve unrelated contributor work.
