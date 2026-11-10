import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { CheckoutError } from './errors';
const headers = { 'Cache-Control': 'no-store, max-age=0', Pragma: 'no-cache' };
export const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers });
/** Compare against the public Host; Next.js may normalise nextUrl to localhost. */
export function checkOrigin(request: NextRequest, allowMissing = false) {
  const origin = request.headers.get('origin');
  const expected = `${request.nextUrl.protocol}//${request.headers.get('host') ?? request.nextUrl.host}`;
  if (
    (!(allowMissing && !origin) && origin !== expected) ||
    request.headers.get('sec-fetch-site') === 'cross-site'
  )
    throw new CheckoutError(403, 'ORIGIN', 'Checkout requests must come from this site.');
}
/** Enforce browser origin, content type and a streaming size limit before parsing. */
export async function readBody(request: NextRequest) {
  checkOrigin(request);
  if (!request.headers.get('content-type')?.startsWith('application/json'))
    throw new CheckoutError(415, 'CONTENT_TYPE', 'JSON is required.');
  // Enforce the size while reading, including bodies without Content-Length.
  const reader = request.body?.getReader();
  if (!reader) throw new CheckoutError(400, 'BODY', 'A request body is required.');
  let size = 0;
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 16384) {
      await reader.cancel();
      throw new CheckoutError(413, 'BODY_SIZE', 'Request is too large.');
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
  } catch {
    throw new CheckoutError(400, 'JSON', 'Invalid JSON request.');
  }
}
/** Map application errors to safe responses; never forward raw SDK exceptions. */
export function requestError(error: unknown) {
  if (error instanceof ZodError)
    return json({ code: 'VALIDATION', message: 'Check the checkout details.' }, 400);
  if (error instanceof CheckoutError)
    return json({ code: error.code, message: error.message }, error.status);
  return json(
    {
      code: 'UNAVAILABLE',
      message:
        'The result could not be confirmed. Check payment status before starting another payment.',
    },
    503,
  );
}
