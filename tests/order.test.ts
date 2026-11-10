import { describe, expect, it } from 'vitest';
import { quoteOrder } from '../src/lib/server/order';
import { orderSchema, sessionRequestSchema } from '../src/lib/contracts';
const order = {
  items: [
    { productId: 'tee-black', quantity: 1 },
    { productId: 'tee-sienna', quantity: 1 },
  ],
  delivery: 'standard',
  customer: {
    email: 'buyer@example.com',
    firstName: 'Demo',
    lastName: 'Buyer',
    address: '1 Test Street',
    apartment: '',
    city: 'St Helier',
    region: '',
    country: 'JE',
    postcode: 'JE2 3AA',
    phone: '',
  },
};
describe('server catalogue and validation', () => {
  it('matches the reference basket using integer pence', () =>
    expect(quoteOrder(order).quote).toEqual({
      subtotal: 6400,
      shipping: 500,
      tax: 552,
      total: 7452,
      currency: 'GBP',
    }));
  it('recalculates quantities and express delivery', () =>
    expect(
      quoteOrder({
        ...order,
        delivery: 'express',
        items: [{ productId: 'tee-black', quantity: 3 }],
      }).quote.total,
    ).toBe(12096));
  it.each([0, -1, 1.5, 9, Infinity])('rejects quantity %s', (quantity) =>
    expect(
      orderSchema.safeParse({ ...order, items: [{ productId: 'tee-black', quantity }] }).success,
    ).toBe(false),
  );
  it('rejects unknown products, extra prices, duplicate lines and invalid contacts', () => {
    for (const invalid of [
      { ...order, amount: 1 },
      { ...order, items: [{ productId: 'fake', quantity: 1 }] },
      { ...order, items: [order.items[0], order.items[0]] },
      { ...order, customer: { ...order.customer, email: 'bad' } },
    ])
      expect(orderSchema.safeParse(invalid).success).toBe(false);
    expect(sessionRequestSchema.safeParse({ checkoutId: 'bad', order }).success).toBe(false);
  });
});
