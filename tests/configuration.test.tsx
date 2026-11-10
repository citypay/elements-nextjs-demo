import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { getCheckoutConfiguration } from '../src/lib/server/configuration';
import { getCityPay } from '../src/lib/server/citypay';
import Page from '../src/app/page';

beforeEach(() => {
  for (const key of [
    'CITYPAY_CLIENT_ID',
    'CITYPAY_LICENCE_KEY',
    'CITYPAY_MERCHANT_ID',
    'NEXT_PUBLIC_CITYPAY_PUBLIC_KEY',
    'VERCEL',
  ])
    vi.stubEnv(key, '');
});
afterEach(() => vi.unstubAllEnvs());
function configure() {
  vi.stubEnv('CITYPAY_CLIENT_ID', 'private-client-marker');
  vi.stubEnv('CITYPAY_LICENCE_KEY', 'private-licence-marker');
  vi.stubEnv('CITYPAY_MERCHANT_ID', '123');
  vi.stubEnv('NEXT_PUBLIC_CITYPAY_PUBLIC_KEY', 'public-test-key');
}
it('renders a configuration error before any form submission with no environment', () => {
  const html = renderToStaticMarkup(Page());
  expect(html).toContain('role="alert"');
  expect(html).toContain('Payment is not configured');
  expect(html).toContain('CityPay client ID is missing on the server.');
  expect(html).not.toContain('Your payment details stay private');
  expect(html).not.toContain('Continue to payment');
});
it('catches missing server credentials even when the browser public key exists', () => {
  configure();
  vi.stubEnv('CITYPAY_LICENCE_KEY', '  ');
  expect(getCheckoutConfiguration()).toEqual({
    ready: false,
    issues: ['CityPay licence key is missing on the server.'],
  });
  expect(() => getCityPay()).toThrow(/not configured/);
});
it.each(['', '0', '-1', '1.5', 'not-a-number'])('rejects invalid merchant ID %j', (merchant) => {
  configure();
  vi.stubEnv('CITYPAY_MERCHANT_ID', merchant);
  expect(getCheckoutConfiguration().ready).toBe(false);
});
it('reads changed runtime settings without a module reload and never exposes their values', () => {
  expect(getCheckoutConfiguration().ready).toBe(false);
  configure();
  const html = renderToStaticMarkup(Page());
  expect(getCheckoutConfiguration()).toEqual({ ready: true, issues: [] });
  expect(html).toContain('Loading secure payment components');
  expect(html).not.toContain('required=');
  expect(html).not.toContain('Payment is not configured');
  expect(html).not.toContain('private-client-marker');
  expect(html).not.toContain('private-licence-marker');
});
it('runs on Vercel with only CityPay configuration and no database', () => {
  configure();
  vi.stubEnv('VERCEL', '1');
  expect(getCheckoutConfiguration()).toEqual({ ready: true, issues: [] });
});
it('detects missing public key without requiring optional wallet settings', () => {
  configure();
  expect(getCheckoutConfiguration().ready).toBe(true);
  vi.stubEnv('NEXT_PUBLIC_CITYPAY_PUBLIC_KEY', '');
  expect(getCheckoutConfiguration().issues).toContain(
    'The CityPay public key is missing from this build.',
  );
});
