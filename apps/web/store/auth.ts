'use client';

import { create } from 'zustand';
import { commitSession } from '@/lib/session';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  hotelId: string | null;
  organizationId: string;
  avatar?: string | null;
}

interface AuthState {
  user: User | null;
  token: string | null;
  hotels: any[];
  activeHotelId: string | null;
  setSession: (user: User, token: string) => void;
  setUser: (user: User) => void;
  setHotels: (hotels: any[]) => void;
  setActiveHotelId: (id: string | null) => void;
  setToken: (token: string) => void;
  clear: () => void;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  token: null,
  hotels: [],
  activeHotelId: null,
  setSession: (user, token) => {
    set({ user, token });
    commitSession(token);
  },
  setUser: (user) => set({ user }),
  setHotels: (hotels) =>
    set((state) => {
      const stored = typeof window !== 'undefined' ? localStorage.getItem('hotelops.active_hotel') : null;
      const valid = hotels.find((h) => h.id === stored);
      return {
        hotels,
        activeHotelId: valid ? valid.id : state.activeHotelId && hotels.some((h) => h.id === state.activeHotelId) ? state.activeHotelId : hotels[0]?.id || null,
      };
    }),
  setActiveHotelId: (id) => {
    if (typeof window !== 'undefined' && id) localStorage.setItem('hotelops.active_hotel', id);
    set({ activeHotelId: id });
  },
  setToken: (token) => {
    set({ token });
    commitSession(token);
  },
  clear: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('hotelops.active_hotel');
      sessionStorage.removeItem('hotelops.session');
      document.cookie = 'hotelops_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    }
    set({ user: null, token: null, hotels: [], activeHotelId: null });
  },
}));