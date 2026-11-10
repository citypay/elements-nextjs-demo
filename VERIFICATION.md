# Validation and testing

This document describes the checks completed for the example and the validation still needed when adapting it to a merchant integration. It does not certify a production deployment.

## Automated checks

- All 49 tests pass. Coverage includes input validation, server-side pricing, signed-cookie ownership and expiry, SDK parameters, response filtering, payment-flow failures, configuration errors and debug-log suppression.
- Widget-loading tests cover automatic mounting, reuse of an in-flight session request, explicit retry behaviour and omission of customer data from the demo session.
- TypeScript, lint, formatting and the production build pass.
- The browser-asset scan finds no synthetic server credential markers or legacy backend URL. This is a targeted boundary check, not a general-purpose security audit.
- HTTP checks confirm uncached health responses, input validation and rejection of foreign origins. A regression test covers Next.js hostname normalisation during local development.

The SDK logging test uses the installed package with synthetic credentials and mocked network responses. See [Library compatibility notes](LIBRARY-NOTES.md) for the logging workaround and other package limitations.

## Browser and sandbox checks

With sandbox configuration supplied, the widget loads automatically and displays the hosted card fields without requiring contact or shipping details. Switching to individually mounted fields and back to the default card widget works. Incomplete card details leave Pay disabled. No browser errors were recorded during these checks.

The page also displays a persistent configuration error when required CityPay settings are missing. The official branding, storefront and fixed demo total render correctly.

[View the widget example](docs/screenshots/immediate-widget.jpg).

A sandbox session was created for widget-loading verification. No card details were entered and no authorisation or payment was submitted.

## Validation required for a merchant integration

The following remain unverified in this example:

- Completed card validation and successful or declined authorisations.
- 3DS challenges, completion and cancellation.
- Apple Pay and Google Pay sheets, payment outcomes and cancellation.
- Upstream idempotency retention, conflict handling and response replay.
- Deployment to Vercel and behaviour on the merchant's configured HTTPS origin.

Mocked tests and source inspection do not establish these outcomes. Follow the [integration guide](docs/INTEGRATION.md) for sandbox smoke tests and [Merchant responsibilities](docs/MERCHANT-RESPONSIBILITIES.md) for durable orders, recovery and fulfilment.

## Repeat the local checks

```sh
pnpm format:check
pnpm typecheck
pnpm lint
pnpm test
pnpm build
node scripts/check-client-assets.mjs
```

Use the configured sandbox environment for hosted-widget checks. Keep local test results, actual payment outcomes and deployment evidence distinct.
