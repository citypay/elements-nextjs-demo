import { NextRequest } from 'next/server';
import { json, requestError, checkOrigin } from '@/lib/server/request';
import { verifyPayment } from '@/lib/server/verify-payment';
import { intentRequestSchema } from '@/lib/contracts';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
// Core 2.2.0's verifyPaymentIntentAuth issues GET <verifyAuth>/<intentId> and
// wraps the raw auth object itself. The checkout also exposes the requested POST.
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ intentId: string }> },
) {
  try {
    checkOrigin(request, true);
    const { intentId } = intentRequestSchema.parse(await context.params);
    const result = await verifyPayment(request, intentId);
    return json(result.auth);
  } catch (error) {
    const response = requestError(error);
    const body = await response.json();
    return json({ error: { ...body, retriable: response.status >= 500 } }, response.status);
  }
}
