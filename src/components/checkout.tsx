'use client';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import CityPayLogo from './citypay-logo';
import { useCallback, useRef, useState } from 'react';
import { Toaster } from 'sonner';
import { z } from 'zod';
import { products, deliveries, money, demoOrder } from '@/lib/catalogue';
import {
  paymentSessionSchema,
  type CheckoutSession,
  type CheckoutConfiguration,
} from '@/lib/contracts';
import { post } from '@/lib/api';
import type { Method, Layout, Theme } from './payment-panel';
// A client component may still be prerendered. Keep DOM-dependent payment code
// behind this explicit no-SSR boundary while the storefront renders normally.
const PaymentPanel = dynamic(() => import('./payment-panel'), {
  ssr: false,
  loading: () => (
    <div className="loading-state" role="status">
      Loading secure payment components…
    </div>
  ),
});
const layoutOptions: Layout[] = [
  'stack',
  'stack-compact',
  'row',
  'row-compact',
  'row-minimal',
  'column',
  'column-compact',
];
const methods: { id: Method; label: string; icon: string }[] = [
  { id: 'widget', label: 'Card widget', icon: '▤' },
  { id: 'fields', label: 'Card fields', icon: '▥' },
  { id: 'apple', label: 'Apple Pay', icon: '◉' },
  { id: 'google', label: 'Google Pay', icon: 'G' },
];
const checkoutSchema = z.object({
  session: paymentSessionSchema,
  quote: z.object({
    subtotal: z.number().int(),
    shipping: z.number().int(),
    tax: z.number().int(),
    total: z.number().int(),
    currency: z.literal('GBP'),
  }),
});
/** Widget-first demo: the provider requests one shared session for a fixed basket. */
export default function Checkout({ configuration }: { configuration: CheckoutConfiguration }) {
  const delivery = demoOrder.delivery;
  const quantities: Record<string, number> = Object.fromEntries(
    demoOrder.items.map((item) => [item.productId, item.quantity]),
  );
  const [method, setMethod] = useState<Method>('widget');
  const [layout, setLayout] = useState<Layout>('stack');
  const [theme, setTheme] = useState<Theme>('light');
  const [checkout, setCheckout] = useState<CheckoutSession | null>(null);
  const [locked, setLocked] = useState(false);
  const [generation, setGeneration] = useState(0);
  const sessionRequest = useRef<Promise<CheckoutSession> | null>(null);
  // Display preview only. Keep it aligned with server/order.ts, whose calculation
  // is authoritative and is the only source for creating the payment intent.
  const subtotal = products.reduce((sum, p) => sum + p.price * quantities[p.id], 0);
  const shipping = subtotal === 0 ? 0 : deliveries.find((d) => d.id === delivery)!.price;
  const tax = Math.round((subtotal + shipping) * 0.08);
  const quote = checkout?.quote ?? { subtotal, shipping, tax, total: subtotal + shipping + tax };
  // The SDK calls this when its provider initialises. Share the in-flight promise
  // across callback repeats and widget/layout changes; never create from our own effect.
  const loadCheckout = useCallback(() => {
    if (!sessionRequest.current) {
      sessionRequest.current = (async () => {
        let checkoutId = sessionStorage.getItem('citypay-checkout-id');
        if (!checkoutId) {
          checkoutId = crypto.randomUUID();
          sessionStorage.setItem('citypay-checkout-id', checkoutId);
        }
        const result = checkoutSchema.parse(
          await post('/api/payment-session', { checkoutId, order: demoOrder }),
        );
        setCheckout(result);
        return result;
      })();
    }
    return sessionRequest.current;
  }, []);
  function reloadWidget(newCheckout = false) {
    // Only a known decline starts a new checkout. Loading retries keep the same key.
    if (newCheckout) sessionStorage.removeItem('citypay-checkout-id');
    sessionRequest.current = null;
    setCheckout(null);
    setLocked(false);
    setGeneration((value) => value + 1);
  }
  function chooseMethod(next: Method) {
    setMethod(next);
  }
  return (
    <>
      <Toaster position="top-right" richColors closeButton />
      <header className="site-header">
        <Link href="/" className="brand" aria-label="CityPay checkout home">
          <CityPayLogo className="brand-logo" />
          <span className="brand-divider" /> <span className="brand-subtitle">Elements</span>
        </Link>
        <span className="sandbox-badge">
          <i />
          Sandbox demo
        </span>
      </header>
      <main className="checkout-shell">
        <div className="page-heading">
          <div>
            <p className="eyebrow">THE DEMO STORE</p>
            <h1>A better way to checkout.</h1>
            <p className="intro">A few essentials. One seamless payment.</p>
          </div>
          <span className="secure-label">
            <Lock /> Secure checkout
          </span>
        </div>
        <div className="checkout-grid">
          <div className="checkout-main">
            <details className="demo-details">
              <summary>Example contact and shipping fields</summary>
              <p className="section-description">
                Layout examples only. These details are not required or sent with the demo payment.
              </p>
              <fieldset>
                <section className="checkout-section">
                  <SectionTitle number="01" title="Contact information" />
                  <div className="form-grid">
                    <Field
                      label="Email address"
                      name="email"
                      type="email"
                      autoComplete="email"
                      wide
                      placeholder="you@example.com"
                    />
                  </div>
                </section>
                <section className="checkout-section">
                  <SectionTitle number="02" title="Shipping information" />
                  <div className="form-grid">
                    <Field name="firstName" label="First name" autoComplete="given-name" />
                    <Field name="lastName" label="Last name" autoComplete="family-name" />
                    <Field name="address" label="Address" autoComplete="address-line1" wide />
                    <Field
                      name="apartment"
                      label="Apartment, suite, etc."
                      autoComplete="address-line2"
                      wide
                      optional
                    />
                    <Field name="city" label="City" autoComplete="address-level2" />
                    <label>
                      Country
                      <select name="country" autoComplete="country" defaultValue="GB">
                        <option value="GB">United Kingdom</option>
                        <option value="JE">Jersey</option>
                        <option value="GG">Guernsey</option>
                      </select>
                    </label>
                    <Field
                      name="region"
                      label="County / region"
                      autoComplete="address-level1"
                      optional
                    />
                    <Field name="postcode" label="Postal code" autoComplete="postal-code" />
                    <Field name="phone" label="Phone" type="tel" autoComplete="tel" wide optional />
                  </div>
                </section>
              </fieldset>
              <section className="checkout-section">
                <SectionTitle number="03" title="Delivery method" />
                <fieldset className="delivery-grid" disabled>
                  <legend className="sr-only">Delivery method</legend>
                  {deliveries.map((d) => (
                    <label
                      className={`delivery-option ${delivery === d.id ? 'selected' : ''}`}
                      key={d.id}
                    >
                      <div>
                        <strong>{d.name}</strong>
                        <input
                          type="radio"
                          name="delivery-choice"
                          checked={delivery === d.id}
                          readOnly
                        />
                      </div>
                      <span>{d.estimate}</span>
                      <b>{money(d.price)}</b>
                    </label>
                  ))}
                </fieldset>
              </section>
            </details>
            <section className="checkout-section payment-section">
              <SectionTitle number="04" title="Payment widget" />
              <p className="section-description">
                Try the widget straight away. No contact or shipping details needed.
              </p>
              <fieldset className="method-grid" disabled={locked || !configuration.ready}>
                <legend className="sr-only">Payment method</legend>
                {methods.map((m) => (
                  <label
                    key={m.id}
                    className={`method-option ${method === m.id ? 'selected' : ''}`}
                  >
                    <input
                      type="radio"
                      name="payment-method"
                      checked={method === m.id}
                      onChange={() => chooseMethod(m.id)}
                    />
                    <span aria-hidden className="method-icon">
                      {m.icon}
                    </span>
                    {m.label}
                  </label>
                ))}
              </fieldset>
              {(method === 'widget' || method === 'fields') && (
                <div className="display-options">
                  <label>
                    Widget layout
                    <select
                      aria-label="Widget layout"
                      disabled={locked || !configuration.ready || method === 'fields'}
                      value={layout}
                      onChange={(e) => setLayout(e.target.value as Layout)}
                    >
                      {layoutOptions.map((l) => (
                        <option key={l} value={l}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Theme
                    <select
                      disabled={locked || !configuration.ready || method === 'fields'}
                      value={theme}
                      onChange={(e) => setTheme(e.target.value as Theme)}
                    >
                      <option value="light">Light</option>
                      <option value="dark">Dark</option>
                    </select>
                  </label>
                </div>
              )}
              {!configuration.ready ? (
                <div
                  className="configuration-error"
                  role="alert"
                  aria-labelledby="configuration-error-title"
                >
                  <strong id="configuration-error-title">Payment is not configured</strong>
                  <p>The server is missing required checkout settings:</p>
                  <ul>
                    {configuration.issues.map((issue) => (
                      <li key={issue}>{issue}</li>
                    ))}
                  </ul>
                  <p>
                    Configure the settings in .env.local for local development or in your deployment
                    environment, then restart or redeploy and reload this page. Public-key changes
                    require a rebuild.
                  </p>
                </div>
              ) : (
                <PaymentPanel
                  key={generation}
                  checkout={checkout}
                  loadCheckout={loadCheckout}
                  method={method}
                  layout={layout}
                  theme={theme}
                  onLocked={setLocked}
                  onRetry={() => reloadWidget()}
                  onRestart={() => reloadWidget(true)}
                />
              )}
            </section>
          </div>
          <aside className="summary-column">
            <div className="order-card">
              <div className="summary-title">
                <h2>Order summary</h2>
                <span>{Object.values(quantities).reduce((a, b) => a + b, 0)} items</span>
              </div>
              <ul className="product-list">
                {products.map((p) => (
                  <li key={p.id}>
                    <div className="product-art">
                      <Shirt color={p.swatch} />
                    </div>
                    <div className="product-details">
                      <strong>{p.name}</strong>
                      <span>
                        {p.color} <i /> {p.size}
                      </span>
                      <div className="product-bottom">
                        <b>{money(p.price)}</b>
                        <label className="quantity">
                          <span className="sr-only">{p.color} tee quantity</span>
                          <select
                            aria-label={`${p.color} tee quantity`}
                            disabled
                            value={quantities[p.id]}
                          >
                            {Array.from({ length: 9 }, (_, i) => (
                              <option key={i} value={i}>
                                {i === 0 ? 'Remove' : i}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
              <dl className="totals">
                <div>
                  <dt>Subtotal</dt>
                  <dd>{money(quote.subtotal)}</dd>
                </div>
                <div>
                  <dt>Shipping</dt>
                  <dd>{money(quote.shipping)}</dd>
                </div>
                <div>
                  <dt>
                    Demo tax <span>(8%)</span>
                  </dt>
                  <dd>{money(quote.tax)}</dd>
                </div>
                <div className="grand-total">
                  <dt>Total</dt>
                  <dd>
                    <small>GBP</small>
                    {money(quote.total)}
                  </dd>
                </div>
              </dl>
              <p className="summary-ready">
                Fixed demo basket · the payment amount is calculated on the server.
              </p>
            </div>
            <div className="sandbox-note">
              <span className="note-icon">i</span>
              <div>
                <strong>A little demo. No real purchases.</strong>
                <p>
                  Use CityPay sandbox payment details. Products and the 8% tax rate are for
                  demonstration only.
                </p>
              </div>
            </div>
            <p className="powered-by">
              Payments powered by <CityPayLogo className="powered-by-logo" />
            </p>
          </aside>
        </div>
      </main>
      <footer>
        CityPay Elements <span>Next.js integration demo</span>
      </footer>
    </>
  );
}
function SectionTitle({ number, title }: { number: string; title: string }) {
  return (
    <h2 className="section-title">
      <span>{number}</span>
      {title}
    </h2>
  );
}
function Field({
  name,
  label,
  type = 'text',
  autoComplete,
  wide,
  optional = true,
  placeholder,
}: {
  name: string;
  label: string;
  type?: string;
  autoComplete?: string;
  wide?: boolean;
  optional?: boolean;
  placeholder?: string;
}) {
  return (
    <label className={wide ? 'wide' : ''}>
      {label}
      {optional && <span className="optional"> (optional)</span>}
      <input
        name={name}
        type={type}
        autoComplete={autoComplete}
        maxLength={name === 'email' ? 254 : 150}
        placeholder={placeholder}
      />
    </label>
  );
}
function Lock() {
  return (
    <svg aria-hidden="true" width="15" height="17" viewBox="0 0 20 22" fill="none">
      <rect x="3" y="9" width="14" height="11" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M6 9V6a4 4 0 018 0v3" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="10" cy="14" r="1.3" fill="currentColor" />
    </svg>
  );
}
function Shirt({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 120 140" role="img" aria-label="Cotton T-shirt">
      <path
        d="M37 22L21 29 5 56 25 68 34 53 32 119Q60 128 88 119L86 53 95 68 115 56 99 29 83 22Q60 35 37 22Z"
        fill={color}
      />
      <path
        d="M44 23Q60 43 76 23"
        fill="none"
        stroke="#ffffff"
        strokeOpacity=".24"
        strokeWidth="3"
      />
      <path
        d="M35 54L38 113M85 54L82 113M36 116Q60 122 84 116"
        fill="none"
        stroke="#000"
        strokeOpacity=".12"
        strokeWidth="2"
      />
    </svg>
  );
}
