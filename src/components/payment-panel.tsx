'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CardElement,
  CityPayProvider,
  useElementsStatus,
  useElementInstances,
} from '@citypay/elements-react';
import { toast } from 'sonner';
import { post } from '@/lib/api';
import type { CheckoutSession } from '@/lib/contracts';
import { finishPayment, FlowError, verifiedSchema, type PaymentApi } from '@/lib/payment-flow';
import { money } from '@/lib/catalogue';
import { z } from 'zod';
import IndividualFields from './payment-methods/individual-fields';
import GooglePay from './payment-methods/google-pay';
import AppleWallet from './payment-methods/apple-pay';
export type Method = 'widget' | 'fields' | 'apple' | 'google';
export const layouts = [
  'stack',
  'stack-compact',
  'row',
  'row-compact',
  'row-minimal',
  'column',
  'column-compact',
] as const;
export type Layout = (typeof layouts)[number];
export type Theme = 'light' | 'dark';
export type PaymentProps = {
  checkout: CheckoutSession;
  method: Method;
  layout: Layout;
  theme: Theme;
  onLocked: (locked: boolean) => void;
  onRestart: () => void;
};
const middleware = { authorise: '/api/authorise', verifyAuth: '/api/verify-auth' };
type PanelProps = Omit<PaymentProps, 'checkout'> & {
  checkout: CheckoutSession | null;
  loadCheckout: () => Promise<CheckoutSession>;
  onRetry: () => void;
};
/** Mount immediately; the public provider requests the shared demo session on startup. */
export default function PaymentPanel(props: PanelProps) {
  const { loadCheckout } = props;
  const createServerIntent = useCallback(
    async () => (await loadCheckout()).session,
    [loadCheckout],
  );
  return (
    <CityPayProvider
      pubKey={process.env.NEXT_PUBLIC_CITYPAY_PUBLIC_KEY}
      createServerIntent={createServerIntent}
      middleware={middleware}
    >
      <WidgetLoading hasCheckout={!!props.checkout} onRetry={props.onRetry} />
      {props.checkout && <PaymentControls {...props} checkout={props.checkout} />}
    </CityPayProvider>
  );
}
function WidgetLoading({ hasCheckout, onRetry }: { hasCheckout: boolean; onRetry: () => void }) {
  const { status } = useElementsStatus();
  if (status === 'cpp:error')
    return (
      <div className="configuration-error" role="alert">
        <strong>The payment widget could not load</strong>
        <p>Check the sandbox settings and connection, then try loading again.</p>
        <button type="button" className="secondary" onClick={onRetry}>
          Retry loading widget
        </button>
      </div>
    );
  if (hasCheckout) return null;
  return (
    <p className="loading-state" role="status">
      Loading the payment widget…
    </p>
  );
}
const changeSchema = z.object({ complete: z.boolean().optional() });
/**
 * Owns payment UI state across method changes. Ref guards are immediate; state
 * controls the UI. Only verify() can announce success and close the checkout.
 */
function PaymentControls({ checkout, method, layout, theme, onLocked, onRestart }: PaymentProps) {
  const instances = useElementInstances();
  const { status } = useElementsStatus();
  const fieldsApi = useRef<PaymentApi | null>(null);
  const busyRef = useRef(false);
  const completedRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [paid, setPaid] = useState(false);
  const [declined, setDeclined] = useState(false);
  const [completeKey, setCompleteKey] = useState('');
  // Published widgets read options at mount. The key forces a fresh instance;
  // completion from another layout/method must never enable this one's Pay button.
  const activeKey = `${method}-${layout}-${theme}`;
  const intentId = checkout.session.paymentIntentId;
  // Keep the SDK's 3DS container interactive while busy. Only paid/uncertain
  // states make the payment surface inert; submission/method controls use locked.
  const locked = busy || uncertain || paid;
  useEffect(() => {
    onLocked(locked);
  }, [locked, onLocked]);
  useEffect(() => {
    if (status === 'cpp:error')
      toast.error('Payment services could not load. Reload this checkout to try again.', {
        id: 'provider-error',
      });
  }, [status]);
  // Client success is presentation only; the backend checks the owned intent's
  // gateway result and order amount before this response is accepted.
  const verify = useCallback(async () => {
    const result = verifiedSchema.parse(await post('/api/verify-auth', { intentId }));
    if (!completedRef.current) {
      completedRef.current = true;
      setPaid(true);
      setUncertain(false);
      toast.success('Payment verified', {
        description: `${money(checkout.quote.total)} authorised. Reference ${result.auth.authcode}.`,
        duration: 10000,
      });
    }
    return result;
  }, [intentId, checkout.quote.total]);
  async function run(api: PaymentApi, wallet = false) {
    if (busyRef.current || completedRef.current || uncertain) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await finishPayment(api, intentId, wallet, {
        authorise: () => post('/api/authorise', { intentId }),
        verify,
      });
    } catch (error) {
      if (error instanceof FlowError && error.uncertain) setUncertain(true);
      if (error instanceof FlowError && error.declined) setDeclined(true);
      toast.error(
        error instanceof FlowError
          ? error.message
          : 'Payment could not be completed. Check the details and try again.',
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  const onChange = (state: unknown) => {
    if (changeSchema.safeParse(state).data?.complete) setCompleteKey(activeKey);
    else setCompleteKey('');
  };
  const onError = () =>
    toast.error(
      'This payment method could not complete. Check its status or choose another method.',
      { id: 'element-error' },
    );
  async function checkStatus() {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await verify();
    } catch {
      toast.error(
        'Payment has not been verified. Try checking again or contact the demo operator.',
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  const widgetTheme =
    theme === 'dark'
      ? {
          '--cpe-bg': '#18232e',
          '--cpe-input-bg': '#243443',
          '--cpe-input-fg': '#ffffff',
          '--cpe-fg': '#f1f5f9',
          '--cpe-input-border': '#607080',
          '--cpe-radius': '6px',
        }
      : {
          '--cpe-input-bg': '#ffffff',
          '--cpe-fg': '#475569',
          '--cpe-input-border': '#cbd5e1',
          '--cpe-radius': '6px',
        };
  return (
    <div className="payment-panel">
      {status !== 'cpp:ready' && (
        <p role="status" className="muted">
          {status === 'cpp:error'
            ? 'Payment service unavailable. Reload to check again.'
            : 'Loading secure payment services…'}
        </p>
      )}
      <div inert={paid || uncertain} className={paid || uncertain ? 'payment-locked' : ''}>
        {method === 'widget' && (
          <CardElement
            key={activeKey}
            identifier={activeKey}
            visible
            language="en"
            layout={layout}
            width="100%"
            theme={widgetTheme}
            cardSchemesDisplay="dynamic-inline"
            onChange={onChange}
            onError={onError}
          />
        )}
        {method === 'fields' && (
          <IndividualFields
            key={activeKey}
            apiRef={fieldsApi}
            onChange={onChange}
            onError={onError}
          />
        )}
        {method === 'google' && (
          <GooglePay
            amount={checkout.quote.total}
            onPay={(api) => run(api, true)}
            onError={onError}
            onCancel={() => toast.info('Google Pay cancelled. No new payment was submitted.')}
          />
        )}
        {method === 'apple' && (
          <AppleWallet
            amount={checkout.quote.total}
            onStart={() => {
              busyRef.current = true;
              setBusy(true);
            }}
            onEnd={async () => {
              setUncertain(true);
              try {
                await verify();
              } catch {
                toast.error('Apple Pay is not verified. Check payment status before trying again.');
              } finally {
                busyRef.current = false;
                setBusy(false);
              }
            }}
            onCancel={() => {
              if (busyRef.current) setUncertain(true);
              busyRef.current = false;
              setBusy(false);
              toast.info('Apple Pay cancelled.');
            }}
            onError={() => {
              if (busyRef.current) setUncertain(true);
              busyRef.current = false;
              setBusy(false);
              onError();
            }}
          />
        )}
      </div>
      {(method === 'widget' || method === 'fields') && (
        <button
          className="primary pay-button"
          type="button"
          disabled={locked || status !== 'cpp:ready' || completeKey !== activeKey}
          onClick={() => {
            const api =
              method === 'fields'
                ? fieldsApi.current
                : (instances.get(activeKey)?.api as PaymentApi | undefined);
            if (api) void run(api);
            else onError();
          }}
        >
          {paid
            ? 'Payment complete'
            : busy
              ? 'Processing securely…'
              : `Pay ${money(checkout.quote.total)}`}
          <span aria-hidden>→</span>
        </button>
      )}
      {uncertain && !paid && (
        <button type="button" className="secondary" disabled={busy} onClick={checkStatus}>
          Check payment status
        </button>
      )}
      {declined && !paid && (
        <button type="button" className="secondary" disabled={busy} onClick={onRestart}>
          Start a new checkout
        </button>
      )}
      <p className="payment-note">
        {paid
          ? 'This checkout is closed.'
          : busy
            ? 'Please keep this page open while your payment is processed.'
            : 'Your card details are handled securely by CityPay.'}
      </p>
    </div>
  );
}
