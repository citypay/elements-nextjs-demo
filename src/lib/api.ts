export class ApiError extends Error {
  constructor(
    message: string,
    public code: string,
  ) {
    super(message);
  }
}
/**
 * Merchant browser transport. Callers validate the returned unknown value.
 * Preserve the same-origin ownership cookie; never automatically retry a payment
 * mutation here because a lost response may follow a completed operation.
 */
export async function post(
  path: '/api/payment-session' | '/api/authorise' | '/api/verify-auth',
  body: unknown,
): Promise<unknown> {
  const response = await fetch(path, {
    method: 'POST',
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok)
    throw new ApiError(data.message || 'Checkout request failed.', data.code || 'REQUEST');
  return data;
}
