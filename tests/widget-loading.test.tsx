import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { CheckoutSession } from '../src/lib/contracts';
import { demoOrder } from '../src/lib/catalogue';

const captured = vi.hoisted(() => ({
  load: undefined as undefined | (() => Promise<CheckoutSession>),
}));
vi.mock('next/dynamic', () => ({
  default: () => (props: { loadCheckout: () => Promise<CheckoutSession> }) => {
    captured.load = props.loadCheckout;
    return null;
  },
}));
vi.mock('../src/lib/api', () => ({ post: vi.fn() }));
import { post } from '../src/lib/api';
import Checkout from '../src/components/checkout';
const checkout = {
  session: { paymentIntentId: 'pi_test', sessionToken: 'synthetic', opaqueKey: 'synthetic' },
  quote: { subtotal: 6400, shipping: 500, tax: 552, total: 7452, currency: 'GBP' },
};
beforeEach(() => {
  vi.clearAllMocks();
  captured.load = undefined;
  vi.stubGlobal('sessionStorage', { getItem: () => 'existing-checkout-id', setItem: vi.fn() });
});
afterEach(() => vi.unstubAllGlobals());

it('mounts the payment panel without validating or submitting customer fields', async () => {
  vi.mocked(post).mockResolvedValue(checkout);
  const html = renderToStaticMarkup(<Checkout configuration={{ ready: true, issues: [] }} />);
  expect(captured.load).toBeDefined();
  expect(html).not.toContain('required=');
  expect(html).not.toContain('Continue to payment');
  expect(html).toContain('These details are not required or sent');
  await captured.load!();
  expect(post).toHaveBeenCalledWith('/api/payment-session', {
    checkoutId: 'existing-checkout-id',
    order: demoOrder,
  });
  expect(demoOrder).not.toHaveProperty('customer');
});
it('shares one session request when the SDK calls back repeatedly or concurrently', async () => {
  vi.mocked(post).mockResolvedValue(checkout);
  renderToStaticMarkup(<Checkout configuration={{ ready: true, issues: [] }} />);
  const first = captured.load!();
  const second = captured.load!();
  expect(first).toBe(second);
  await Promise.all([first, second]);
  await captured.load!();
  expect(post).toHaveBeenCalledOnce();
});
it('does not silently retry a failed creation callback', async () => {
  vi.mocked(post).mockRejectedValue(new Error('unconfirmed session'));
  renderToStaticMarkup(<Checkout configuration={{ ready: true, issues: [] }} />);
  await expect(captured.load!()).rejects.toThrow('unconfirmed session');
  await expect(captured.load!()).rejects.toThrow('unconfirmed session');
  expect(post).toHaveBeenCalledOnce();
});
it('does not mount the payment panel when server configuration is missing', () => {
  renderToStaticMarkup(<Checkout configuration={{ ready: false, issues: ['Missing settings'] }} />);
  expect(captured.load).toBeUndefined();
  expect(post).not.toHaveBeenCalled();
});
