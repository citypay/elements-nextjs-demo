import 'server-only';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { getCityPay } from './citypay';
import { requireCheckout } from './checkout-cookie';
import { CheckoutError } from './errors';

const verifiedAuth = z.object({
  status: z.literal('success'),
  auth: z.object({
    amountValue: z.number().int(),
    currency: z.literal('GBP'),
    merchantid: z.number().int(),
    authcode: z.string().min(1),
  }),
});

/** Shared by POST verification and the SDK's GET callback. This never charges. */
export async function verifyPayment(request: NextRequest, intentId: string) {
  const { sdk, merchantId } = getCityPay();
  const checkout = requireCheckout(request, intentId, merchantId);
  // The SDK checks authorisation; the merchant checks it matches the intended order.
  const result = verifiedAuth.safeParse(
    await sdk.paymentIntents.verifyAuthorised({
      payment_intent_id: intentId,
      unmask_fields: [],
    }),
  );
  if (
    !result.success ||
    result.data.auth.amountValue !== checkout.amount ||
    result.data.auth.merchantid !== merchantId
  )
    throw new CheckoutError(
      409,
      'NOT_VERIFIED',
      'Payment has not been verified against this checkout. Check its status before paying again.',
    );
  return { status: 'success' as const, auth: { authcode: result.data.auth.authcode } };
}
