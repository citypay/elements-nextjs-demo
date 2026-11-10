import 'server-only';
import { products, deliveries } from '../catalogue';
import { orderSchema, type Order, type Quote } from '../contracts';
/**
 * Authoritative demo pricing in integer GBP pence. Validate again on the server
 * even when the browser uses the same schema. The returned total funds the intent.
 */
export function quoteOrder(input: unknown): { order: Order; quote: Quote } {
  const order = orderSchema.parse(input);
  const subtotal = order.items.reduce(
    (sum, item) => sum + products.find((p) => p.id === item.productId)!.price * item.quantity,
    0,
  );
  const shipping = deliveries.find((d) => d.id === order.delivery)!.price;
  // Illustrative demo tax only: 8% of goods + delivery, rounded once to pence.
  const tax = Math.round(((subtotal + shipping) * 8) / 100);
  return {
    order,
    quote: { subtotal, shipping, tax, total: subtotal + shipping + tax, currency: 'GBP' },
  };
}
