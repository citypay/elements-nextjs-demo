import 'server-only';
import { CityPay } from '@citypay/sdk';
import { CheckoutError } from './errors';
import { readCityPayCredentials } from './configuration';
/**
 * Load credentials only inside a server request, allowing unconfigured builds.
 * Never return this SDK instance or its credential-bearing options to a client.
 */
export function getCityPay() {
  const { clientId, licence, merchantId, valid } = readCityPayCredentials();
  if (!valid || !clientId || !licence) {
    throw new CheckoutError(
      503,
      'CONFIGURATION',
      'Sandbox checkout is not configured. Add the server environment variables.',
    );
  }
  return { sdk: new CityPay(clientId, licence, { sandbox: true }), merchantId };
}
