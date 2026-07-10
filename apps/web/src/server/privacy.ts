import 'server-only';
import { cookies } from 'next/headers';

export const ANALYTICS_COOKIE = 'lrs_analytics';

export async function analyticsEnabled(): Promise<boolean> {
  return (await cookies()).get(ANALYTICS_COOKIE)?.value !== 'off';
}
