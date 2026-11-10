import { z } from 'zod';
// Application boundary schemas: no ambient replacement of the SDK's missing types.
/** Optional UI fields are explicit empty strings in the JSON contract. */
export const customerSchema = z
  .object({
    email: z.email().max(254),
    firstName: z.string().trim().min(1).max(60),
    lastName: z.string().trim().min(1).max(60),
    address: z.string().trim().min(1).max(150),
    apartment: z.string().trim().max(150),
    city: z.string().trim().min(1).max(80),
    region: z.string().trim().max(80),
    postcode: z.string().trim().min(2).max(16),
    country: z.enum(['GB', 'JE', 'GG']),
    phone: z.string().trim().max(30),
  })
  .strict();
/** Requested catalogue IDs/quantities only; price and amount overrides are rejected. */
export const orderSchema = z
  .object({
    items: z
      .array(
        z
          .object({
            productId: z.enum(['tee-black', 'tee-sienna']),
            quantity: z.number().int().min(1).max(8),
          })
          .strict(),
      )
      .min(1)
      .max(2)
      .refine(
        (items) => new Set(items.map((item) => item.productId)).size === items.length,
        'Duplicate product',
      ),
    delivery: z.enum(['standard', 'express']),
    customer: customerSchema.optional(),
  })
  .strict();
export const sessionRequestSchema = z.object({ checkoutId: z.uuid(), order: orderSchema }).strict();
export const intentRequestSchema = z
  .object({
    intentId: z
      .string()
      .min(1)
      .max(200)
      .regex(/^[A-Za-z0-9_-]+$/),
  })
  .strict();
/**
 * Allowlist of browser session capabilities returned by CityPay. Unlike input
 * schemas, this strips unknown response fields rather than forwarding them.
 * Session tokens may reach this checkout's browser, but must not be logged.
 */
export const paymentSessionSchema = z.object({
  paymentIntentId: z.string().min(1),
  sessionToken: z.string().min(1),
  opaqueKey: z.string().min(1),
  // Other documented public session fields are explicitly allowlisted below.
  exp: z.number().optional(),
  merchantid: z.number().optional(),
  cardSchemes: z.number().optional(),
  licencedServices: z.number().optional(),
});
export type Order = z.infer<typeof orderSchema>;
export type PaymentSession = z.infer<typeof paymentSessionSchema>;
/** Monetary fields are integer GBP pence; format with money() only for display. */
export type Quote = {
  subtotal: number;
  shipping: number;
  tax: number;
  total: number;
  currency: 'GBP';
};
export type CheckoutSession = { session: PaymentSession; quote: Quote };

/** Sanitised configuration state rendered by the server; contains no credentials. */
export type CheckoutConfiguration = { ready: boolean; issues: string[] };
