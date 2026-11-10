// Safe reproducer for the published SDK: synthetic data, mocked fetch, no network.
// Run outside Next.js so the demo's startup debug suppression is not installed.
import { createRequire } from 'node:module';

const commonJs = process.argv.includes('--cjs');
const { CityPay } = commonJs
  ? createRequire(import.meta.url)('@citypay/sdk')
  : await import('@citypay/sdk');
const captured = [];
const originalDebug = console.debug;
const originalFetch = globalThis.fetch;
let calls = 0;

try {
  console.debug = (...args) => captured.push(args.map(String).join(' '));
  globalThis.fetch = async (url) => {
    calls++;
    if (String(url).endsWith('/authenticate')) {
      return Response.json({ key: 'SYNTHETIC_API_KEY' });
    }
    if (String(url).endsWith('/intent/create')) {
      return Response.json(
        { paymentIntentId: 'pi_synthetic' },
        { headers: { 'set-cookie': 'SYNTHETIC_RESPONSE_COOKIE' } },
      );
    }
    throw new Error('Unexpected SDK request; real network access is disabled.');
  };
  const sdk = new CityPay('SYNTHETIC_CLIENT', 'SYNTHETIC_LICENCE', { sandbox: true });
  await sdk.paymentIntents.create({
    merchantid: 123,
    amount: 100,
    currency: 'GBP',
    identifier: 'synthetic-logging-repro',
    billTo: { email: 'synthetic-buyer@example.invalid' },
  });
} finally {
  console.debug = originalDebug;
  globalThis.fetch = originalFetch;
}

// Report presence only. Never print captured bodies or adapt this to real credentials.
const output = captured.join('\n');
console.log(
  JSON.stringify(
    {
      format: commonJs ? 'CommonJS' : 'ESM',
      mockedRequests: calls,
      clientIdLogged: output.includes('SYNTHETIC_CLIENT'),
      licenceKeyLogged: output.includes('SYNTHETIC_LICENCE'),
      customerEmailLogged: output.includes('synthetic-buyer@example.invalid'),
      arbitraryResponseHeaderLogged: output.includes('SYNTHETIC_RESPONSE_COOKIE'),
    },
    null,
    2,
  ),
);
