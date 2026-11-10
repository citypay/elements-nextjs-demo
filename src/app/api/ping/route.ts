import { json } from '@/lib/server/request';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export function GET() {
  return json({ status: 'ok', environment: 'sandbox' });
}
