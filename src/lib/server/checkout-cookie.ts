import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { readCityPayCredentials } from './configuration';
import { CheckoutError } from './errors';

const name = 'citypay-checkout';
const lifetime = 30 * 60;
const checkoutSchema = z.object({
  intentId: z.string().min(1),
  amount: z.number().int().positive(),
  merchantId: z.number().int().positive(),
  expires: z.number().int(),
});
type Checkout = z.infer<typeof checkoutSchema>;

// This demo binds the intent and server price to the browser without a database.
// Derive a purpose-specific signing key; no licence key or card data enters the cookie.
// A merchant application should use its existing authenticated order/session instead.
function signature(payload: string) {
  const { licence } = readCityPayCredentials();
  if (!licence) throw new CheckoutError(503, 'CONFIGURATION', 'Checkout is not configured.');
  const key = createHmac('sha256', licence).update('citypay-nextjs-demo-cookie-v1').digest();
  return createHmac('sha256', key).update(payload).digest();
}

export function setCheckoutCookie(
  response: NextResponse,
  request: NextRequest,
  checkout: Omit<Checkout, 'expires'>,
) {
  const payload = Buffer.from(
    JSON.stringify({ ...checkout, expires: Date.now() + lifetime * 1000 }),
  ).toString('base64url');
  response.cookies.set(name, `${payload}.${signature(payload).toString('base64url')}`, {
    httpOnly: true,
    sameSite: 'strict',
    secure: request.nextUrl.protocol === 'https:',
    path: '/api',
    maxAge: lifetime,
  });
}

/** Reject missing, tampered, expired or unrelated checkout capabilities before SDK calls. */
export function requireCheckout(request: NextRequest, intentId: string, merchantId: number) {
  const [payload, mac, extra] = (request.cookies.get(name)?.value ?? '').split('.');
  if (payload && mac && !extra) {
    const received = Buffer.from(mac, 'base64url');
    const expected = signature(payload);
    if (received.length === expected.length && timingSafeEqual(received, expected)) {
      try {
        const checkout = checkoutSchema.parse(
          JSON.parse(Buffer.from(payload, 'base64url').toString()),
        );
        if (
          checkout.intentId === intentId &&
          checkout.merchantId === merchantId &&
          checkout.expires > Date.now()
        )
          return checkout;
      } catch {
        /* Invalid signed payload is still not a usable checkout. */
      }
    }
  }
  throw new CheckoutError(
    403,
    'INVALID_SESSION',
    'Use the browser that started this checkout. The session may have expired.',
  );
}
