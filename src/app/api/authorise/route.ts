import { NextRequest } from 'next/server';
import { z } from 'zod';
import { intentRequestSchema } from '@/lib/contracts';
import { CheckoutError } from '@/lib/server/errors';
import { getCityPay } from '@/lib/server/citypay';
import { requireCheckout } from '@/lib/server/checkout-cookie';
import { json, readBody, requestError } from '@/lib/server/request';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const { intentId } = intentRequestSchema.parse(await readBody(request));
    const { sdk, merchantId } = getCityPay();
    requireCheckout(request, intentId, merchantId);
    const result = z.object({ authorised: z.boolean() }).safeParse(
      await sdk.paymentIntents.authorise(
        { payment_intent_id: intentId },
        {
          idempotencyKey: `authorise-${intentId}`,
        },
      ),
    );
    if (!result.success)
      throw new CheckoutError(
        502,
        'AUTHORISATION_UNCERTAIN',
        'Authorisation could not be confirmed. Check payment status before paying again.',
      );
    const { authorised } = result.data;
    // Keep the SDK middleware response shape without forwarding customer/auth data.
    return json({
      authorised,
      status: authorised ? 'success' : 'error',
      ...(!authorised && {
        error: { code: 'DECLINED', message: 'Payment declined.', retriable: false },
      }),
    });
  } catch (error) {
    return requestError(error);
  }
}
