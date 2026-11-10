import { z } from 'zod';
// Narrow application contracts for documented runtime methods. SDK 2.2.0 omits their
// referenced type packages. See LIBRARY-NOTES.md; these do not augment that package.
export interface PaymentApi {
  init(): Promise<void>;
  awaitReady(): Promise<void>;
  destroy(): void;
  tokenise(): Promise<unknown>;
  attach(options: { token?: string; select?: boolean; intentId?: string }): Promise<unknown>;
  confirm(options: { autoHandle3DS: boolean; autoAuthorise: boolean }): Promise<unknown>;
  onChange(listener: (value: unknown) => void): unknown;
  onError(listener: (value: unknown) => void): unknown;
  onCancel(listener: () => void): unknown;
  onTokeniseEnd(listener: () => void): unknown;
  onProcessingStart(listener: () => void): unknown;
  onAuthoriseStart(listener: () => void): unknown;
  onAuthoriseEnd(listener: (value: unknown) => void): unknown;
}
export type FlowBackend = { authorise(): Promise<unknown>; verify(): Promise<unknown> };
export const verifiedSchema = z.object({
  status: z.literal('success'),
  auth: z.object({ authcode: z.string().min(1) }),
});
/** UI recovery flags: uncertain blocks paying again; declined permits a new checkout. */
export class FlowError extends Error {
  constructor(
    message: string,
    public uncertain = false,
    public declined = false,
  ) {
    super(message);
  }
}
/**
 * Complete card or already-tokenised Google Pay, then require server verification.
 * `wallet` means the Google callback already supplied token data to its SDK API;
 * Apple Pay has its own authorisation lifecycle and must not enter this function.
 * Throws on incomplete authentication, failure or uncertain authorisation/verification.
 */
export async function finishPayment(
  api: PaymentApi,
  intentId: string,
  wallet: boolean,
  backend: FlowBackend,
) {
  if (wallet) await api.attach({});
  else {
    // Hosted core 2.2.0 uses data.token; the docs show data.cp_card_token and
    // the Vite reference uses token. Accept only a nonempty observed token.
    const result = z
      .object({
        token: z.string().min(1).optional(),
        data: z
          .object({
            token: z.string().min(1).optional(),
            cp_card_token: z.string().min(1).optional(),
          })
          .optional(),
      })
      .parse(await api.tokenise());
    const token = result.data?.token ?? result.data?.cp_card_token ?? result.token;
    if (!token)
      throw new FlowError('Card details could not be tokenised. Please check the fields.');
    await api.attach({ token, select: true, intentId });
  }
  const result = z
    .object({ status: z.string() })
    .parse(await api.confirm({ autoHandle3DS: true, autoAuthorise: false }));
  if (
    result.status === 'error' ||
    result.status === 'failed' ||
    result.status === 'requires_payment_method'
  )
    throw new FlowError('Payment confirmation failed. Please check the card details.');
  if (result.status === 'cancelled') throw new FlowError('Payment cancelled. You can try again.');
  if (result.status === 'requires_customer_authentication')
    throw new FlowError('Card authentication was not completed. Please try again.');
  if (result.status === 'requires_authorisation') {
    let auth: unknown;
    try {
      auth = await backend.authorise();
    } catch {
      throw new FlowError(
        'Authorisation could not be confirmed. Check payment status before paying again.',
        true,
      );
    }
    if (!z.object({ authorised: z.literal(true) }).safeParse(auth).success)
      throw new FlowError(
        'Payment declined. Start a new checkout to try another card.',
        true,
        true,
      );
  }
  // No other confirmation state is treated as payment success; always ask the server.
  try {
    return verifiedSchema.parse(await backend.verify());
  } catch {
    throw new FlowError(
      'Payment is not yet verified. Check payment status; do not pay again.',
      true,
    );
  }
}

// Hosted core 2.2.0 converts minor units to wallet display amounts itself.
export function walletTotal(amount: number) {
  if (!Number.isSafeInteger(amount) || amount <= 0)
    throw new Error('Wallet amount must be positive integer pence.');
  return { amount, label: 'CityPay Demo Store', currency: 'GBP' as const };
}
