'use client';

import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { useAuth } from '@/store/auth';
import { get, getTokens, clearTokens } from '@/lib/api';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 15_000 },
        },
      })
  );
  const setUser = useAuth((s) => s.setUser);
  const setHotels = useAuth((s) => s.setHotels);
  const clear = useAuth((s) => s.clear);

  // Fetch current user + hotels when a token exists
  useEffect(() => {
    const { access } = getTokens();
    if (!access) return;
    get('/auth/me')
      .then(async (me: any) => {
        setUser(me);
        sessionStorage.setItem('hotelops.session', JSON.stringify({ user: me }));
        const hotels: any[] = await get('/hotels');
        setHotels(hotels);
      })
      .catch(() => {
        clearTokens();
        clear();
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onUnauthorized = () => {
      clearTokens();
      useAuth.getState().clear();
      window.location.href = '/login';
    };
    window.addEventListener('hotelops:unauthorized', onUnauthorized);
    return () => window.removeEventListener('hotelops:unauthorized', onUnauthorized);
  }, [clear]);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  );
}