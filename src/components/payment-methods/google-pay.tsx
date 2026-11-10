'use client';
import { useEffect, useRef, useState } from 'react';
import { useElements } from '@citypay/elements-react';
import { walletTotal, type PaymentApi } from '@/lib/payment-flow';
/** Public SDK adapter: React 1.0.6 has no GooglepayElement export. Amount is pence. */
export default function GooglePay({
  amount,
  onPay,
  onError,
  onCancel,
}: {
  amount: number;
  onPay: (api: PaymentApi) => Promise<void>;
  onError: () => void;
  onCancel: () => void;
}) {
  const elements = useElements();
  const host = useRef<HTMLDivElement>(null);
  const callbacks = useRef({ onPay, onError, onCancel });
  const [state, setState] = useState<'loading' | 'ready' | 'unavailable'>('loading');
  const merchantId = process.env.NEXT_PUBLIC_GOOGLE_PAY_MERCHANT_ID;
  useEffect(() => {
    callbacks.current = { onPay, onError, onCancel };
  });
  useEffect(() => {
    if (!elements || !host.current || !merchantId || !window.isSecureContext) return;
    const api = elements.googlePay({
      identifier: 'checkout-google',
      element: host.current,
      environment: 'TEST',
      merchantId,
      merchantName: process.env.NEXT_PUBLIC_GOOGLE_PAY_MERCHANT_NAME || 'CityPay Demo Store',
      total: walletTotal(amount),
    }) as PaymentApi;
    let cancelled = false;
    api.onTokeniseEnd(() => {
      if (!cancelled) void callbacks.current.onPay(api);
    });
    api.onCancel(() => {
      if (!cancelled) callbacks.current.onCancel();
    });
    api.onError(() => {
      if (!cancelled) {
        setState('unavailable');
        callbacks.current.onError();
      }
    });
    void (async () => {
      await api.init();
      await api.awaitReady();
      if (!cancelled) setState('ready');
      else api.destroy();
    })().catch(() => {
      if (!cancelled) setState('unavailable');
    });
    return () => {
      cancelled = true;
      api.destroy();
    };
  }, [elements, amount, merchantId]);
  return (
    <div className="wallet-area">
      <div ref={host} />
      <p>
        {!merchantId
          ? 'Google Pay needs a configured merchant ID. Please use a card.'
          : state === 'unavailable'
            ? 'Google Pay is unavailable. Please use a card.'
            : state === 'loading'
              ? 'Checking Google Pay availability…'
              : 'Use the Google Pay button to continue. If no button appears, choose a card instead.'}
      </p>
    </div>
  );
}
