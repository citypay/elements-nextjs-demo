# Published package compatibility notes

These notes apply to the published package versions used by this example. Dependencies are installed from npm; no local workspace links or package patches are required.

## Resolved versions and SSR

`npm view @citypay/elements-react dist-tags versions --json --registry=https://registry.npmjs.org --@citypay:registry=https://registry.npmjs.org` returned `latest: 1.0.6` and versions `["1.0.6"]`. Its dependency is `@citypay/sdk: ^2.1.7`; this demo resolves 2.2.0.

`node scripts/probe-published-library.mjs` imports both packages in Node without `window` or `document` and server-renders the provider with a simple child. Observed: import passes, `<span>SSR works</span>` renders. Browser operations still require a DOM. All payment imports/hooks live under an explicit client boundary, and the payment panel uses `next/dynamic` with `ssr: false`. The storefront itself is server-rendered per request to check runtime configuration, then hydrates normally.

## Server debug logging in SDK 2.2.0

Tracked as [CE-156](https://citypay.atlassian.net/browse/CE-156), a High-priority bug. The standalone [safe reproducer](scripts/reproduce-sdk-logging.mjs) confirms the unmitigated issue in both published formats without network access or real credentials:

```sh
node scripts/reproduce-sdk-logging.mjs
node scripts/reproduce-sdk-logging.mjs --cjs
```

Both runs on 2.2.0 reported `clientIdLogged`, `licenceKeyLogged`, `customerEmailLogged` and `arbitraryResponseHeaderLogged` as `true`. The response header is injected synthetic data, not evidence of a real CityPay response leaking a cookie. After the upstream fix all four flags should be `false`. This script runs outside Next.js, where the application's startup suppression is not active.

The published `index.js` `apiFetch` function unconditionally calls `console.debug(bd)` after serialising each request body. Authentication uses that same transport, with client ID, licence key, nonce and timestamp in its body. Payment session bodies also contain contact details. There is no public server logging opt-out in the installed `CityPayControlOptions`.

The application therefore uses Next.js `src/instrumentation.ts` to disable **all Node server `console.debug` output at startup**, before handling requests. Info/warn/error are unaffected. This is a documented application-level workaround, not a package patch. Do not enable debug output or run credentialed standalone SDK scripts without equivalent protection until the package fixes this upstream.

Reproduction uses synthetic values only: `tests/sdk-logging.test.ts` invokes the real installed `CityPay` client with a mocked `fetch`, runs startup registration, and asserts its debug calls do not reach the console. Inspect `apiFetch` and `__generateApiKey` in the published package to locate the issue; never demonstrate it by printing real credentials.

The same transport currently starts its abort timer at a fixed 10 seconds despite exposing a timeout option. The showcase uses the SDK default rather than presenting an ineffective 20-second override. Recheck both behaviours on upgrade.

## Missing Google Pay React export

Reproduction:

```sh
node --input-type=module -e 'const m=await import("@citypay/elements-react"); console.log("GooglepayElement" in m)'
```

Observed: `false`. `GooglepayElement` is absent from the installed package's runtime exports and declarations, although it is imported by the local Vite reference. The demo uses `useElements()` and the public `elements.googlePay()` factory, with `init`, `awaitReady`, cancellation/error listeners, tokenisation callback and `destroy`. It does not invent a React export.

## Published CardFields listener defect

The installed `dist/index.d.ts` exposes `FieldsReferences`, `CardFieldsProvider` and a `refs` prop. The Vite reference uses the newer `FieldReferences` / `fieldReferences` spelling; those are not the installed API.

There is also a runtime defect in the published `dist/index.mjs`:

- `useCardFields` calls `addApiListeners(api2, props)` after initialisation.
- `addApiListeners` reads `listeners.current.onChange` and other listeners as though its second argument were a React ref.
- A props object has no `.current`.

`node scripts/probe-published-library.mjs` extracts and calls the exact installed helper with a normal props object (without editing the installed package). Observed: `TypeError: Cannot read properties of undefined (reading 'onChange')`. To reproduce the full lifecycle, mount `<CardFields refs={refs} onChange={handler}/>` inside both published providers with a valid sandbox session; after the element initialises the listener effect passes the wrong shape. The defective React wrapper’s full hosted lifecycle has not been exercised; the example uses the public SDK adapter described below.

The demo therefore mounts individual fields through the public `elements.cardFieldsElement()` API obtained from the React provider. It registers listeners before `init`, keeps callbacks current, waits for readiness and calls `destroy` on unmount. It does not copy the CardFields implementation, add ambient module replacements or patch node_modules.

## React Strict Mode and mount-only options

Source inspection of 1.0.6 `useSdkElement` shows `initStartedRef.current = true` before initialisation. Its cleanup destroys/removes the instance but does not reset that flag. On Strict Mode's effect setup → cleanup → setup replay, a ready provider can leave the second setup unable to initialise the element. Reproduction: enable `reactStrictMode`, mount a CardElement after the provider is ready, then inspect the effect sequence/removed registry entry. This is a source-confirmed lifecycle issue; a credentialed hosted-browser reproduction is still needed.

`next.config.ts` disables Strict Mode for this demo and explains why. The browser shares its session-creation request and the server passes a stable SDK idempotency key; disabling effect replay is not a substitute for merchant-side retry handling. Re-enable Strict Mode once the published wrapper fixes its lifecycle. The wrapper also reads widget options only on initialisation: layout/theme changes intentionally remount a keyed CardElement and reset completion state.

## SDK type declaration packaging

Reproduction:

```sh
pnpm exec tsc --noEmit --skipLibCheck false
```

Observed: TS2307 failures in the installed SDK declarations for:

- `@citypay/sdk-core`
- `@citypay/cpe-protocol`
- `@citypay/api-client-ts-priv/...` request/reference/auth models
- `citypay-api-ts-client`

SDK 2.2.0 declares no dependencies for those imports. The first three packages return 404 from public npm. Inspection of published SDK 2.1.7 found the same problem, so downgrading to the declared baseline does not fix it.

The app uses normal `skipLibCheck: true`, with strict checks on application code. **A passing app typecheck does not establish full vendor type safety.** The missing vendor declarations erase part of the SDK types. Narrow application interfaces and Zod checks validate request bodies, server responses, tokenisation/confirmation results and verification results. These are integration contracts, not ambient replacements for unpublished package declarations. The library needs a release with self-contained declarations or published dependencies for complete downstream type checking.

## Runtime contracts that differ from examples

The public SDK's source map points to [loader 2.2.0](https://js.citypay.com/v2/loader/2.2.0/citypay.js). Its [2.2 manifest](https://js.citypay.com/v2/manifest/2.2.json) selected [core 2.2.0](https://js.citypay.com/v2/core/citypay-core-2.2.0.js) when inspected. These assets were inspected, not copied into the app.

- **Wallet amounts:** runtime validation calls the total “a finite number of minor units” and converts it for Apple/Google display. The app passes `7452`, not `74.52`, for £74.52. A focused test protects this.
- **Tokenisation:** core 2.2.0's own card flow reads `result.data.token`. The public documentation shows `data.cp_card_token`; the Vite reference reads `result.token`. The app accepts these observed/documented shapes, requires a nonempty token and fails before attach if absent.
- **Verification transport:** core's `verifyPaymentIntentAuth()` makes `GET <middleware.verifyAuth>/<intentId>` and wraps the returned raw auth as `{ status: 'success', auth }`. It does not POST `{ intentId }`. An additional Node GET adapter supports that contract; the POST route is the app's primary verification route. Both call the same owned-intent, amount/currency/merchant verification function. GET errors are non-2xx, so the SDK cannot wrap a failed response as success.
- **Authorisation transport:** the SDK middleware adapter expects a string `status` in the authorisation JSON. `/api/authorise` returns that together with `authorised`, with a structured error for a decline. The checkout itself explicitly awaits authorisation and verification.
- **Apple Pay:** core's Apple Pay implementation uses its session-authenticated `/apple-pay/authorise` operation. The merchant app must verify afterwards rather than submit another authorisation. The auth identifier may reflect the wallet request; verification is bound by the server-owned intent ID and checks amount, currency and merchant, without assuming the wallet preserves the original order identifier.

The loader uses the 2.2 channel, so the CDN can move independently of the npm package. Recheck these contracts after package/channel updates. No live gateway, card or wallet success is claimed by this inspection.
