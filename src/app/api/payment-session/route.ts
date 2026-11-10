import { NextRequest } from 'next/server';
import { sessionRequestSchema, paymentSessionSchema } from '@/lib/contracts';
import { getCityPay } from '@/lib/server/citypay';
import { CheckoutError } from '@/lib/server/errors';
import { quoteOrder } from '@/lib/server/order';
import { setCheckoutCookie } from '@/lib/server/checkout-cookie';
import { json, readBody, requestError } from '@/lib/server/request';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Create the browser's Elements session using the published server SDK. */
export async function POST(request: NextRequest) {
  try {
    const { checkoutId, order: input } = sessionRequestSchema.parse(await readBody(request));
    const { order, quote } = quoteOrder(input);
    const { sdk, merchantId } = getCityPay();
    const c = order.customer;
    const contact = c
      ? {
          firstname: c.firstName,
          lastname: c.lastName,
          email: c.email,
          address1: c.address,
          address2: c.apartment,
          address3: c.region,
          area: c.city,
          country: c.country,
          postcode: c.postcode,
          telephoneNo: c.phone,
        }
      : undefined;
    // Reuse this key for an unchanged request. The SDK sends the Idempotency-Key header.
    // Durable order recovery and concurrent retries belong to the merchant application.
    const result = paymentSessionSchema.safeParse(
      await sdk.paymentIntents.create(
        {
          merchantid: merchantId,
          amount: quote.total,
          currency: quote.currency,
          identifier: `demo-${checkoutId}`,
          ...(contact && { billTo: contact, shipTo: contact }),
        },
        { idempotencyKey: `create-${checkoutId}` },
      ),
    );
    if (!result.success)
      throw new CheckoutError(
        502,
        'SESSION_UNCERTAIN',
        'The payment session could not be confirmed. Keep the same checkout when checking with the demo operator.',
      );
    const session = result.data;
    const response = json({ session, quote });
    setCheckoutCookie(response, request, {
      intentId: session.paymentIntentId,
      amount: quote.total,
      merchantId,
    });
    return response;
  } catch (error) {
    return requestError(error);
  }
}
