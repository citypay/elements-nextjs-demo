import Checkout from '@/components/checkout';
import { getCheckoutConfiguration } from '@/lib/server/configuration';

// Check deployment runtime settings on every page request, not during prerendering.
export const dynamic = 'force-dynamic';

export default function Page() {
  return <Checkout configuration={getCheckoutConfiguration()} />;
}
