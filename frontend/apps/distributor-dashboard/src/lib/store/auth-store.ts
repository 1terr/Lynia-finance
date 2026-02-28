import { create } from 'zustand';
import type { Distributor } from '@/types/distributor';
import {
  userPool,
  CognitoUser,
  AuthenticationDetails,
  getSession,
  signOut as cognitoSignOut,
  isCognitoConfigured,
  buildDistributorFromSession,
  forgotPassword as cognitoForgotPassword,
  confirmForgotPassword as cognitoConfirmForgotPassword,
  changePassword as cognitoChangePassword,
} from '@lynia/auth';
import type { CognitoUserSession } from '@lynia/auth';

type AuthChallenge =
  | { type: 'NEW_PASSWORD_REQUIRED'; userAttributes: Record<string, string> }
  | { type: 'SOFTWARE_TOKEN_MFA' }
  | null;

interface AuthState {
  distributor: Distributor | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  challenge: AuthChallenge;
  setDistributor: (distributor: Distributor | null) => void;
  setLoading: (loading: boolean) => void;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  completeNewPassword: (newPassword: string) => Promise<{ error?: string }>;
  completeMfaChallenge: (code: string) => Promise<{ error?: string }>;
  forgotPassword: (email: string) => Promise<{ error?: string }>;
  confirmForgotPassword: (email: string, code: string, newPassword: string) => Promise<{ error?: string }>;
  changePassword: (oldPassword: string, newPassword: string) => Promise<{ error?: string }>;
  signOutUser: () => void;
  initialize: () => Promise<void>;
}

const DEMO_SESSION_KEY = 'lynia-demo-distributor';

const DEMO_DISTRIBUTOR: Distributor = {
  id: 'demo-dist-001',
  user_id: 'demo-user-001',
  name: 'Kudzai Moyo',
  phone_number: '+263771234567',
  email: 'kudzai@distributor.co.zw',
  national_id: '63-123456A78',
  business_name: 'Kudzai Mobile Solutions',
  province: 'Harare',
  city: 'Harare',
  address: '42 Samora Machel Ave, Harare',
  latitude: null,
  longitude: null,
  bank_name: 'CBZ Bank',
  account_number: '1234567890',
  mobile_money_number: '+263771234567',
  commission_rate: 5,
  total_commissions_earned: 1250.00,
  total_commissions_paid: 1000.00,
  pending_commissions: 250.00,
  total_loans_disbursed: 25,
  total_devices_distributed: 25,
  current_inventory_count: 8,
  average_rating: 4.6,
  status: 'active',
  kyc_status: 'approved',
  kyc_verified_at: '2024-06-15T10:00:00Z',
  onboarded_at: '2024-01-10T08:00:00Z',
  created_at: '2024-01-10T08:00:00Z',
};

// Stores the CognitoUser instance while a challenge is in progress
let pendingCognitoUser: InstanceType<typeof CognitoUser> | null = null;

export const useAuthStore = create<AuthState>((set) => ({
  distributor: null,
  isLoading: true,
  isAuthenticated: false,
  challenge: null,
  setDistributor: (distributor) => set({ distributor, isAuthenticated: !!distributor }),
  setLoading: (isLoading) => set({ isLoading }),

  signIn: async (email: string, password: string) => {
    // Demo mode
    if (!isCognitoConfigured()) {
      if (email.toLowerCase() === 'kudzai@distributor.co.zw' && password.length >= 4) {
        const dist = { ...DEMO_DISTRIBUTOR, email };
        try { sessionStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(dist)); } catch { /* private browsing */ }
        set({ distributor: dist, isAuthenticated: true, challenge: null });
        return {};
      }
      return { error: 'Invalid email or password' };
    }

    // Cognito authentication
    const cognitoUser = new CognitoUser({
      Username: email,
      Pool: userPool!,
    });

    const authDetails = new AuthenticationDetails({
      Username: email,
      Password: password,
    });

    return new Promise<{ error?: string }>((resolve) => {
      cognitoUser.authenticateUser(authDetails, {
        onSuccess: (session: CognitoUserSession) => {
          pendingCognitoUser = null;
          const profile = buildDistributorFromSession(session);
          if (!profile) {
            cognitoSignOut();
            resolve({ error: 'Your account does not have distributor access.' });
            return;
          }
          set({ distributor: profile, isAuthenticated: true, challenge: null });
          resolve({});
        },
        onFailure: () => {
          pendingCognitoUser = null;
          resolve({ error: 'Invalid email or password' });
        },
        newPasswordRequired: (userAttributes: Record<string, string>) => {
          pendingCognitoUser = cognitoUser;
          set({ challenge: { type: 'NEW_PASSWORD_REQUIRED', userAttributes } });
          resolve({});
        },
        totpRequired: () => {
          pendingCognitoUser = cognitoUser;
          set({ challenge: { type: 'SOFTWARE_TOKEN_MFA' } });
          resolve({});
        },
        mfaRequired: () => {
          pendingCognitoUser = cognitoUser;
          set({ challenge: { type: 'SOFTWARE_TOKEN_MFA' } });
          resolve({});
        },
      });
    });
  },

  completeNewPassword: async (newPassword: string) => {
    if (!pendingCognitoUser) return { error: 'Session expired. Please sign in again.' };

    return new Promise<{ error?: string }>((resolve) => {
      pendingCognitoUser!.completeNewPasswordChallenge(newPassword, {}, {
        onSuccess: (session: CognitoUserSession) => {
          pendingCognitoUser = null;
          const profile = buildDistributorFromSession(session);
          if (!profile) {
            cognitoSignOut();
            resolve({ error: 'Account setup failed. Contact your administrator.' });
            return;
          }
          set({ distributor: profile, isAuthenticated: true, challenge: null });
          resolve({});
        },
        onFailure: (err: Error) => {
          resolve({ error: err.message || 'Failed to set new password' });
        },
        mfaRequired: () => {
          set({ challenge: { type: 'SOFTWARE_TOKEN_MFA' } });
          resolve({});
        },
        totpRequired: () => {
          set({ challenge: { type: 'SOFTWARE_TOKEN_MFA' } });
          resolve({});
        },
      });
    });
  },

  completeMfaChallenge: async (code: string) => {
    if (!pendingCognitoUser) return { error: 'Session expired. Please sign in again.' };

    return new Promise<{ error?: string }>((resolve) => {
      pendingCognitoUser!.sendMFACode(
        code,
        {
          onSuccess: (session: CognitoUserSession) => {
            pendingCognitoUser = null;
            const profile = buildDistributorFromSession(session);
            if (!profile) {
              cognitoSignOut();
              resolve({ error: 'Authentication failed. Contact your administrator.' });
              return;
            }
            set({ distributor: profile, isAuthenticated: true, challenge: null });
            resolve({});
          },
          onFailure: (err: Error) => {
            resolve({ error: err.message || 'Invalid verification code' });
          },
        },
        'SOFTWARE_TOKEN_MFA',
      );
    });
  },

  forgotPassword: async (email: string) => {
    if (!isCognitoConfigured()) {
      return { error: 'Password reset is not available in demo mode' };
    }
    try {
      await cognitoForgotPassword(email);
      return {};
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send reset code';
      return { error: message };
    }
  },

  confirmForgotPassword: async (email: string, code: string, newPassword: string) => {
    if (!isCognitoConfigured()) {
      return { error: 'Password reset is not available in demo mode' };
    }
    try {
      await cognitoConfirmForgotPassword(email, code, newPassword);
      return {};
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to reset password';
      return { error: message };
    }
  },

  changePassword: async (oldPassword: string, newPassword: string) => {
    if (!isCognitoConfigured()) {
      return { error: 'Password change is not available in demo mode' };
    }
    try {
      await cognitoChangePassword(oldPassword, newPassword);
      return {};
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to change password';
      return { error: message };
    }
  },

  signOutUser: () => {
    cognitoSignOut();
    try { sessionStorage.removeItem(DEMO_SESSION_KEY); } catch { /* private browsing */ }
    set({ distributor: null, isAuthenticated: false, challenge: null });
  },

  initialize: async () => {
    // Demo mode: restore session from sessionStorage
    if (!isCognitoConfigured()) {
      try {
        const stored = sessionStorage.getItem(DEMO_SESSION_KEY);
        if (stored) {
          const dist = JSON.parse(stored) as Distributor;
          set({ distributor: dist, isAuthenticated: true, isLoading: false });
          return;
        }
      } catch { /* private browsing or corrupt data */ }
      set({ isLoading: false });
      return;
    }

    try {
      const session = await getSession();
      if (session && session.isValid()) {
        const profile = buildDistributorFromSession(session);
        if (profile) {
          set({ distributor: profile, isAuthenticated: true });
        } else {
          cognitoSignOut();
        }
      }
    } catch {
      // Session expired or invalid
    } finally {
      set({ isLoading: false });
    }
  },
}));
