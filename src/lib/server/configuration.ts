import 'server-only';
import type { CheckoutConfiguration } from '../contracts';

/** Read on demand so runtime settings are checked, not captured at module/build time. */
export function readCityPayCredentials() {
  const clientId = process.env.CITYPAY_CLIENT_ID?.trim();
  const licence = process.env.CITYPAY_LICENCE_KEY?.trim();
  const merchantId = Number(process.env.CITYPAY_MERCHANT_ID);
  return {
    clientId,
    licence,
    merchantId,
    valid: !!clientId && !!licence && Number.isSafeInteger(merchantId) && merchantId > 0,
  };
}

/** Safe to serialise: only fixed descriptions leave the server, never environment values. */
export function getCheckoutConfiguration(): CheckoutConfiguration {
  const credentials = readCityPayCredentials();
  const issues: string[] = [];
  if (!credentials.clientId) issues.push('CityPay client ID is missing on the server.');
  if (!credentials.licence) issues.push('CityPay licence key is missing on the server.');
  if (!Number.isSafeInteger(credentials.merchantId) || credentials.merchantId <= 0) {
    issues.push('A valid CityPay merchant ID is required on the server.');
  }
  if (!process.env.NEXT_PUBLIC_CITYPAY_PUBLIC_KEY?.trim()) {
    issues.push('The CityPay public key is missing from this build.');
  }
  return { ready: issues.length === 0, issues };
}
