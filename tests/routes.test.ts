import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const sdk = vi.hoisted(() => ({
  paymentIntents: { create: vi.fn(), authorise: vi.fn(), verifyAuthorised: vi.fn() },
}));
vi.mock('../src/lib/server/citypay', () => ({ getCityPay: () => ({ sdk, merchantId: 123 }) }));
import { POST as create } from '../src/app/api/payment-session/route';
import { POST as authorise } from '../src/app/api/authorise/route';
import { POST as verify } from '../src/app/api/verify-auth/route';
import { GET } from '../src/app/api/verify-auth/[intentId]/route';

const origin = 'https://demo.example';
const checkoutId = '627596e9-c3f3-43f5-8ad0-771288a49ea3';
const intentId = 'pi_route_test';
const input = {
  checkoutId,
  order: {
    items: [{ productId: 'tee-black', quantity: 1 }],
    delivery: 'standard',
    customer: {
      firstName: 'Test',
      lastName: 'Buyer',
      email: 'test@example.com',
      address: '1 Test Street',
      apartment: '',
      city: 'London',
      region: '',
      postcode: 'SW1A 1AA',
      country: 'GB',
      phone: '',
    },
  },
};
const verified = {
  status: 'success',
  auth: {
    amountValue: 3996,
    currency: 'GBP',
    merchantid: 123,
    authcode: 'TEST',
    email: 'private@example.com',
  },
};
function request(path: string, body: unknown, cookie = '') {
  return new NextRequest(origin + path, {
    method: 'POST',
    headers: { origin, 'content-type': 'application/json', cookie },
    body: JSON.stringify(body),
  });
}
async function session() {
  const response = await create(request('/api/payment-session', input));
  return { response, cookie: response.headers.get('set-cookie')!.split(';')[0] };
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('CITYPAY_LICENCE_KEY', 'test-only-signing-secret');
  sdk.paymentIntents.create.mockResolvedValue({
    paymentIntentId: intentId,
    sessionToken: 'public-session',
    opaqueKey: 'public-opaque',
    secretField: 'never-expose',
  });
  sdk.paymentIntents.authorise.mockResolvedValue({ authorised: true, secretField: 'never-expose' });
  sdk.paymentIntents.verifyAuthorised.mockResolvedValue(verified);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

it('calls the published SDK with server pricing and stable idempotency keys', async () => {
  const { response, cookie } = await session();
  expect(response.status).toBe(200);
  expect(await response.text()).not.toContain('secretField');
  expect(response.headers.get('set-cookie')).toMatch(/HttpOnly/);
  expect(response.headers.get('set-cookie')).toMatch(/SameSite=strict/);
  expect(response.headers.get('set-cookie')).toMatch(/Secure/);
  expect(cookie).not.toContain('test-only-signing-secret');
  await session();
  for (const call of sdk.paymentIntents.create.mock.calls) {
    expect(call).toEqual([
      expect.objectContaining({ amount: 3996, currency: 'GBP', merchantid: 123 }),
      { idempotencyKey: `create-${checkoutId}` },
    ]);
  }
  const authorised = await authorise(request('/api/authorise', { intentId }, cookie));
  expect(await authorised.json()).toEqual({ authorised: true, status: 'success' });
  expect(sdk.paymentIntents.authorise).toHaveBeenCalledWith(
    { payment_intent_id: intentId },
    { idempotencyKey: `authorise-${intentId}` },
  );
  const result = await verify(request('/api/verify-auth', { intentId }, cookie));
  expect(await result.json()).toEqual({ status: 'success', auth: { authcode: 'TEST' } });
  expect(result.headers.get('cache-control')).toContain('no-store');
  const adapter = await GET(
    new NextRequest(`${origin}/api/verify-auth/${intentId}`, { headers: { cookie } }),
    { params: Promise.resolve({ intentId }) },
  );
  expect(await adapter.json()).toEqual({ authcode: 'TEST' });
});

it('rejects absent, tampered, expired and foreign cookies before payment calls', async () => {
  const { cookie } = await session();
  for (const badCookie of ['', cookie + 'tampered', cookie.replace(/=./, '=x')]) {
    expect((await authorise(request('/api/authorise', { intentId }, badCookie))).status).toBe(403);
    expect((await verify(request('/api/verify-auth', { intentId }, badCookie))).status).toBe(403);
  }
  expect(
    (await authorise(request('/api/authorise', { intentId: 'pi_foreign' }, cookie))).status,
  ).toBe(403);
  vi.useFakeTimers();
  vi.setSystemTime(Date.now() + 31 * 60 * 1000);
  expect((await authorise(request('/api/authorise', { intentId }, cookie))).status).toBe(403);
  expect(sdk.paymentIntents.authorise).not.toHaveBeenCalled();
  expect(sdk.paymentIntents.verifyAuthorised).not.toHaveBeenCalled();
});
it('invalidates existing cookies when server credentials change', async () => {
  const { cookie } = await session();
  vi.stubEnv('CITYPAY_LICENCE_KEY', 'rotated-test-secret');
  expect((await verify(request('/api/verify-auth', { intentId }, cookie))).status).toBe(403);
});
it.each([{ amountValue: 1 }, { currency: 'USD' }, { merchantid: 456 }, { authcode: '' }])(
  'rejects mismatched verification %j',
  async (changed) => {
    const { cookie } = await session();
    sdk.paymentIntents.verifyAuthorised.mockResolvedValue({
      ...verified,
      auth: { ...verified.auth, ...changed },
    });
    expect((await verify(request('/api/verify-auth', { intentId }, cookie))).status).toBe(409);
  },
);
it('keeps declines and uncertain outcomes distinct without exposing SDK exceptions', async () => {
  const { cookie } = await session();
  sdk.paymentIntents.authorise.mockResolvedValue({ authorised: false });
  const declined = await authorise(request('/api/authorise', { intentId }, cookie));
  expect(await declined.json()).toMatchObject({ authorised: false, status: 'error' });
  sdk.paymentIntents.authorise.mockRejectedValue(new Error('private SDK payload'));
  const uncertain = await authorise(request('/api/authorise', { intentId }, cookie));
  expect(uncertain.status).toBe(503);
  expect(await uncertain.text()).not.toContain('private SDK payload');
  sdk.paymentIntents.verifyAuthorised.mockResolvedValue({ status: 'error' });
  expect((await verify(request('/api/verify-auth', { intentId }, cookie))).status).toBe(409);
});
it('rejects cross-site and unowned SDK GET verification requests', async () => {
  const params = { params: Promise.resolve({ intentId }) };
  expect(
    (
      await GET(
        new NextRequest(`${origin}/api/verify-auth/${intentId}`, {
          headers: { 'sec-fetch-site': 'cross-site' },
        }),
        params,
      )
    ).status,
  ).toBe(403);
  const unowned = await GET(new NextRequest(`${origin}/api/verify-auth/${intentId}`), params);
  expect(unowned.status).toBe(403);
  expect(await unowned.json()).toHaveProperty('error.code', 'INVALID_SESSION');
});

it('treats malformed SDK results as uncertain upstream responses, not bad customer input', async () => {
  const { cookie } = await session();
  sdk.paymentIntents.authorise.mockResolvedValue({});
  expect((await authorise(request('/api/authorise', { intentId }, cookie))).status).toBe(502);
  sdk.paymentIntents.create.mockResolvedValue({});
  expect((await create(request('/api/payment-session', input))).status).toBe(502);
});

it('creates a demo session without contact details and omits billing/shipping data', async () => {
  const { items, delivery } = input.order;
  const response = await create(
    request('/api/payment-session', { checkoutId, order: { items, delivery } }),
  );
  expect(response.status).toBe(200);
  const [payload] = sdk.paymentIntents.create.mock.calls[0];
  expect(payload.amount).toBe(3996);
  expect(payload).not.toHaveProperty('billTo');
  expect(payload).not.toHaveProperty('shipTo');
});
