# Merchant responsibilities

This repository is an SDK showcase, not a production order system. The example intentionally has no Redis dependency, persistent checkout service or custom CityPay HTTP client. Use the published SDK for CityPay operations and connect it to your application's existing order infrastructure.

## Before using the pattern for real orders

| Merchant concern                | Application responsibility                                                                                                                                                                            |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Trusted order                   | Load products, amounts, customer permissions and merchant routing from trusted server data. Bind the payment intent to that order.                                                                    |
| Durable payment record          | Save the order, intent, idempotency keys and verified outcome. The demo's 30-minute signed cookie is only a browser capability and cannot replace these records.                                      |
| Concurrent requests and retries | Coordinate attempts across processes/tabs. Reuse the original key and unchanged payload. Confirm CityPay's idempotency retention, conflict and response-replay behaviour for your integration.        |
| Unknown outcomes                | A timeout does not prove failure. Reconcile the original intent before creating a replacement or submitting another payment. Persist this state across browser reloads and server restarts.           |
| Fulfilment                      | Trigger delivery only from trusted server-side verification and durable state transitions, never a browser callback or toast. Make fulfilment idempotent too.                                         |
| Recovery after expiry           | Support payment lookup/reconciliation when a cookie expires, credentials rotate or another tab starts a checkout. Do not treat loss of the browser session as a declined payment.                     |
| Public endpoint abuse           | Apply appropriate rate limits, order authentication and operational monitoring. Same-origin checks protect browser requests; they are not user authentication or protection against scripted clients. |
| Deployment and data handling    | Manage secrets, HTTPS, wallet/domain registration, access controls and retention. Avoid logging credentials, customer request bodies, card data or session tokens.                                    |

## What the demonstration actually guarantees

The app recalculates the amount, rejects invalid input, verifies its signed cookie before authorising/checking an intent, and compares the verified amount, GBP currency and merchant. Browser guards stop repeated clicks while a request runs. SDK calls carry stable idempotency keys; the app does not implement a distributed deduplication ledger or claim at-most-once processing across reloads and instances.

After an unknown authorisation result, the current page disables payment and allows verification. This state is not durable. Likewise, a session creation retry forwards the same key upstream; it does not recover an app-side saved response. Do not rely on the demo to reconcile a payment after reload, expiration or a lost response. Use a durable order workflow for those cases.

## Published-package limitations

SDK 2.2.0 logs authentication/request bodies at debug level. This Next.js app disables **all server `console.debug` output at startup** because the package has no supported logging opt-out. Do not remove that setting or run credentialed standalone SDK scripts without equivalent protection until an upstream fix is verified. It does not suppress info/warn/error logs or make arbitrary custom logging safe.

The React package also needs fixes for individual-field listeners, a missing Google Pay export and Strict Mode lifecycle behaviour. SDK declarations reference unpublished type dependencies. [LIBRARY-NOTES.md](../LIBRARY-NOTES.md) records the evidence and current workarounds. Upgrade the published packages when fixed; do not copy library internals into the merchant example.
