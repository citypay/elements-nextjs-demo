import { expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../src/app/api/payment-session/route';
function request(body: string, origin = 'https://demo.example', contentType = 'application/json') {
  return new NextRequest('https://demo.example/api/payment-session', {
    method: 'POST',
    headers: { origin, 'content-type': contentType },
    body,
  });
}
it('rejects cross-origin and non-JSON requests without credentials', async () => {
  expect((await POST(request('{}', 'https://evil.example'))).status).toBe(403);
  expect((await POST(request('{}', 'https://demo.example', 'text/plain'))).status).toBe(415);
});
it('rejects invalid JSON, oversized bodies and schema errors; never caches responses', async () => {
  for (const [body, status] of [
    ['{bad', 400],
    ['x'.repeat(16385), 413],
    ['{}', 400],
  ] as const) {
    const response = await POST(request(body));
    expect(response.status).toBe(status);
    expect(response.headers.get('cache-control')).toContain('no-store');
  }
});

it('uses the public Host when Next.js normalises the internal URL to localhost', async () => {
  const local = new NextRequest('http://localhost:3100/api/payment-session', {
    method: 'POST',
    headers: {
      host: '127.0.0.1:3100',
      origin: 'http://127.0.0.1:3100',
      'content-type': 'application/json',
    },
    body: '{}',
  });
  // The request passes origin validation and reaches the input schema.
  expect((await POST(local)).status).toBe(400);
  const foreign = new NextRequest('http://localhost:3100/api/payment-session', {
    method: 'POST',
    headers: {
      host: '127.0.0.1:3100',
      origin: 'https://evil.example',
      'content-type': 'application/json',
    },
    body: '{}',
  });
  expect((await POST(foreign)).status).toBe(403);
});
