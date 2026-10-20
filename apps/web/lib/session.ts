import { getTokens } from '@/lib/api';

export function commitSession(token: string | null) {
  if (typeof document === 'undefined') return;
  const value = token ? `?access_token=${encodeURIComponent(token)}` : '';
  document.cookie = `hotelops_token=${value}; path=/; max-age=${token ? 60 * 60 * 24 * 7 : 0}; SameSite=Lax`;
}

export { getTokens };