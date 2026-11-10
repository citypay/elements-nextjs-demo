'use client';
import { ApplepayElement } from '@citypay/elements-react';
import { walletTotal } from '@/lib/payment-flow';
/** Apple Pay authorises inside the SDK; onEnd must verify, never authorise again. */
export default function AppleWallet({
  amount,
  onStart,
  onEnd,
  onCancel,
  onError,
}: {
  amount: number;
  onStart: () => void;
  onEnd: () => Promise<void>;
  onCancel: () => void;
  onError: () => void;
}) {
  // This file is loaded with ssr:false. The browser capability check never runs in SSR.
  const apple = (window as unknown as { ApplePaySession?: { canMakePayments(): boolean } })
    .ApplePaySession;
  let available = false;
  try {
    available = window.isSecureContext && !!apple?.canMakePayments();
  } catch {
    /* Unsupported browser. */
  }
  if (!available)
    return (
      <div className="wallet-area">
        <p>
          Apple Pay is unavailable in this browser. Use Safari on a supported device with a card in
          Wallet, or choose a card payment.
        </p>
      </div>
    );
  return (
    <div className="wallet-area">
      <ApplepayElement
        identifier="checkout-apple"
        visible
        total={walletTotal(amount)}
        appearance={{ type: 'buy', style: 'black' }}
        onAuthoriseStart={onStart}
        onAuthoriseEnd={onEnd}
        onCancel={onCancel}
        onError={onError}
      />
      <p>Complete your payment in the Apple Pay sheet.</p>
    </div>
  );
}
