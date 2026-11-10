import { NextRequest } from 'next/server';
import { intentRequestSchema } from '@/lib/contracts';
import { verifyPayment } from '@/lib/server/verify-payment';
import { json, readBody, requestError } from '@/lib/server/request';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const { intentId } = intentRequestSchema.parse(await readBody(request));
    return json(await verifyPayment(request, intentId));
  } catch (error) {
    return requestError(error);
  }
}
