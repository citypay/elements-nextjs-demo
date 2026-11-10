/** Demo catalogue shared for display and trusted server lookup. Prices are pence. */
export const products = [
  {
    id: 'tee-black',
    name: 'Basic Tee',
    color: 'Black',
    size: 'Large',
    price: 3200,
    swatch: '#24252a',
  },
  {
    id: 'tee-sienna',
    name: 'Basic Tee',
    color: 'Sienna',
    size: 'Large',
    price: 3200,
    swatch: '#a85b42',
  },
] as const;
export const deliveries = [
  { id: 'standard', name: 'Standard', estimate: '4–10 business days', price: 500 },
  { id: 'express', name: 'Express', estimate: '2–5 business days', price: 1600 },
] as const;
export type Delivery = (typeof deliveries)[number]['id'];
export const money = (pence: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(pence / 100);

/** Fixed showcase basket: no customer details are needed to initialise Elements. */
export const demoOrder = {
  items: [
    { productId: 'tee-black', quantity: 1 },
    { productId: 'tee-sienna', quantity: 1 },
  ],
  delivery: 'standard',
} as const;
