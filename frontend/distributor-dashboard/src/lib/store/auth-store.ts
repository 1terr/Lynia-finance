import { create } from 'zustand';
import { signOut as cognitoSignOut } from '@/lib/auth/cognito';
import type { Distributor } from '@/types/distributor';

interface AuthState {
  distributor: Distributor | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  setDistributor: (distributor: Distributor | null) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  distributor: null,
  isLoading: true,
  isAuthenticated: false,
  setDistributor: (distributor) => set({ distributor, isAuthenticated: !!distributor }),
  setLoading: (isLoading) => set({ isLoading }),
  logout: () => {
    cognitoSignOut();
    try { sessionStorage.removeItem('lynia-demo-distributor'); } catch { /* private browsing */ }
    set({ distributor: null, isAuthenticated: false });
  },
}));
