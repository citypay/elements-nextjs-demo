import { describe, expect, it, vi } from 'vitest';
import { finishPayment, walletTotal, type PaymentApi } from '../src/lib/payment-flow';
function setup(status = 'requires_authorisation') {
  const api = {
    tokenise: vi.fn().mockResolvedValue({ data: { token: 'token' } }),
    attach: vi.fn().mockResolvedValue({}),
    confirm: vi.fn().mockResolvedValue({ status }),
  };
  const backend = {
    authorise: vi.fn().mockResolvedValue({ authorised: true }),
    verify: vi.fn().mockResolvedValue({ status: 'success', auth: { authcode: 'TEST' } }),
  };
  return {
    api,
    backend,
    run: (wallet = false) => finishPayment(api as unknown as PaymentApi, 'pi_123', wallet, backend),
  };
}
describe('browser payment orchestration', () => {
  it('tokenises, attaches, confirms with 3DS, authorises and verifies', async () => {
    const { api, backend, run } = setup();
    await run();
    expect(api.attach).toHaveBeenCalledWith({ intentId: 'pi_123', token: 'token', select: true });
    expect(api.confirm).toHaveBeenCalledWith({ autoHandle3DS: true, autoAuthorise: false });
    expect(backend.authorise).toHaveBeenCalledOnce();
    expect(backend.verify).toHaveBeenCalledOnce();
  });
  it('Google Pay attaches the SDK wallet token without tokenising again', async () => {
    const { api, run } = setup();
    await run(true);
    expect(api.tokenise).not.toHaveBeenCalled();
    expect(api.attach).toHaveBeenCalledWith({});
  });
  it.each([
    'error',
    'failed',
    'cancelled',
    'requires_customer_authentication',
    'requires_payment_method',
  ])('stops before authorisation for %s', async (status) => {
    const { run, backend } = setup(status);
    await expect(run()).rejects.toThrow();
    expect(backend.authorise).not.toHaveBeenCalled();
    expect(backend.verify).not.toHaveBeenCalled();
  });
  it('never treats another confirmation status as final success', async () => {
    const { run, backend } = setup('succeeded');
    backend.verify.mockResolvedValue({ status: 'error' });
    await expect(run()).rejects.toMatchObject({ uncertain: true });
    expect(backend.authorise).not.toHaveBeenCalled();
  });
  it('does not verify a declined authorisation as success', async () => {
    const { run, backend } = setup();
    backend.authorise.mockResolvedValue({ authorised: false });
    await expect(run()).rejects.toThrow(/declined/);
    expect(backend.verify).not.toHaveBeenCalled();
  });
  it('marks verification failures as uncertain to stop a new charge', async () => {
    const { run, backend } = setup();
    backend.verify.mockRejectedValue(new Error('offline'));
    await expect(run()).rejects.toMatchObject({ uncertain: true });
  });
  it('never attaches malformed tokenisation output', async () => {
    const { run, api } = setup();
    api.tokenise.mockResolvedValue({});
    await expect(run()).rejects.toThrow();
    expect(api.attach).not.toHaveBeenCalled();
  });
});

it('keeps wallet totals in integer pence', () => {
  expect(walletTotal(7452)).toEqual({ amount: 7452, label: 'CityPay Demo Store', currency: 'GBP' });
  expect(() => walletTotal(74.52)).toThrow();
});
