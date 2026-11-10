'use client';
import { useEffect, useRef, useState } from 'react';
import { useElements } from '@citypay/elements-react';
import { z } from 'zod';
import type { PaymentApi } from '@/lib/payment-flow';
// Public SDK integration through the React provider; see the reproducible CardFields
// listener defect in LIBRARY-NOTES.md. No library source is copied or patched.
export default function IndividualFields({
  apiRef,
  onChange,
  onError,
}: {
  apiRef: React.RefObject<PaymentApi | null>;
  onChange: (value: unknown) => void;
  onError: () => void;
}) {
  const elements = useElements();
  const pan = useRef<HTMLDivElement>(null),
    name = useRef<HTMLDivElement>(null),
    expiry = useRef<HTMLDivElement>(null),
    csc = useRef<HTMLDivElement>(null);
  const callbacks = useRef({ onChange, onError });
  const [messages, setMessages] = useState<Record<string, string>>({});
  useEffect(() => {
    callbacks.current = { onChange, onError };
  });
  useEffect(() => {
    if (!elements) return;
    const api = elements.cardFieldsElement({
      identifier: 'checkout-fields',
      panElement: pan.current,
      nameElement: name.current,
      expiryElement: expiry.current,
      cscElement: csc.current,
      showCardIcon: true,
    }) as PaymentApi;
    let cancelled = false;
    api.onChange((value: unknown) => {
      if (cancelled) return;
      callbacks.current.onChange(value);
      const state = z.record(z.string(), z.unknown()).safeParse(value).data;
      const next: Record<string, string> = {};
      for (const key of ['pan', 'name', 'expiry', 'csc']) {
        const field = z
          .object({ valid: z.boolean().optional(), message: z.string().optional() })
          .safeParse(state?.[key]).data;
        if (field?.valid === false && field.message) next[key] = field.message;
      }
      setMessages(next);
    });
    api.onError(() => {
      if (!cancelled) callbacks.current.onError();
    });
    void (async () => {
      await api.init();
      await api.awaitReady();
      if (!cancelled) apiRef.current = api;
      else api.destroy();
    })().catch(() => {
      if (!cancelled) callbacks.current.onError();
    });
    return () => {
      cancelled = true;
      apiRef.current = null;
      api.destroy();
    };
  }, [elements, apiRef]);
  return (
    <div className="individual-fields">
      {(
        [
          ['name', 'Name on card', name],
          ['pan', 'Card number', pan],
          ['expiry', 'Expiry (MM/YY)', expiry],
          ['csc', 'Security code', csc],
        ] as const
      ).map(([key, label, ref]) => (
        <div key={key} className={`host-field field-${key}`}>
          <span id={`${key}-label`}>{label}</span>
          <div ref={ref} aria-labelledby={`${key}-label`} className="field-mount" />
          {messages[key] && <small role="alert">{messages[key]}</small>}
        </div>
      ))}
    </div>
  );
}
