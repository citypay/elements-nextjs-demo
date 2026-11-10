import { expect, it, vi } from 'vitest';
import { CityPay } from '@citypay/sdk';
import { register } from '../src/instrumentation';

it('suppresses the real SDK debug output before authentication or payment calls', async () => {
  const originalDebug = console.debug;
  const debug = vi.fn();
  console.debug = debug;
  vi.stubEnv('NEXT_RUNTIME', 'nodejs');
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(Response.json({ key: 'synthetic-api-key' }))
    .mockResolvedValueOnce(Response.json({ paymentIntentId: 'pi_test' }));
  vi.stubGlobal('fetch', fetchMock);
  try {
    register();
    const sdk = new CityPay('synthetic-client', 'synthetic-licence', { sandbox: true });
    await sdk.paymentIntents.create({
      merchantid: 123,
      amount: 100,
      currency: 'GBP',
      identifier: 'logging-test',
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(debug).not.toHaveBeenCalled();
  } finally {
    console.debug = originalDebug;
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  }
});
