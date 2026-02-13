import { create } from 'zustand';
import type { AdminUser, AdminRole, Permission } from '@/types/auth';
import { ROLE_PERMISSIONS, isValidAdminRole } from '@/types/auth';
import {
  userPool,
  CognitoUser,
  AuthenticationDetails,
  getSession,
  signOut as cognitoSignOut,
  isCognitoConfigured,
} from '@/lib/auth/cognito';
import type { CognitoUserSession } from '@/lib/auth/cognito';

interface AuthState {
  user: AdminUser | null;
  isLoading: boolean;
  setUser: (user: AdminUser | null) => void;
  setLoading: (loading: boolean) => void;
  hasPermission: (permission: Permission) => boolean;
  hasAnyPermission: (permissions: Permission[]) => boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signOutUser: () => void;
  initialize: () => Promise<void>;
}

/** Extract an AdminUser from Cognito JWT claims. */
function buildAdminUserFromSession(session: CognitoUserSession): AdminUser | null {
  const idToken = session.getIdToken();
  const payload = idToken.decodePayload();

  // Extract role from cognito:groups claim
  const groups: string[] = payload['cognito:groups'] || [];
  const role = groups.find((g) => isValidAdminRole(g)) as AdminRole | undefined;

  if (!role) return null;

  return {
    id: payload.sub as string,
    email: (payload.email as string) || '',
    first_name: (payload.given_name as string) || '',
    last_name: (payload.family_name as string) || '',
    role,
    is_active: true,
    department: (payload['custom:department'] as string) || null,
    last_login_at: null,
    login_count: 0,
    created_at: '',
    updated_at: '',
  };
}

// ── Demo mode helpers ──

const DEMO_ADMIN: AdminUser = {
  id: 'demo-admin-001',
  email: 'admin@lynia.co.zw',
  first_name: 'Demo',
  last_name: 'Admin',
  role: 'super_admin',
  is_active: true,
  department: 'Operations',
  last_login_at: null,
  login_count: 1,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const DEMO_CREDENTIALS: Record<string, AdminUser> = {
  'admin@lynia.co.zw': DEMO_ADMIN,
  'demo@lynia.co.zw': DEMO_ADMIN,
};

const DEMO_SESSION_KEY = 'lynia-demo-admin';

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: true,
  setUser: (user) => set({ user }),
  setLoading: (isLoading) => set({ isLoading }),
  hasPermission: (permission) => {
    const { user } = get();
    if (!user) return false;
    const perms = ROLE_PERMISSIONS[user.role];
    if (!perms) return false;
    return perms.includes(permission);
  },
  hasAnyPermission: (permissions) => {
    const { user } = get();
    if (!user) return false;
    const perms = ROLE_PERMISSIONS[user.role];
    if (!perms) return false;
    return permissions.some((p) => perms.includes(p));
  },

  signIn: async (email: string, password: string) => {
    // ── Demo mode: accept known demo credentials ──
    if (!isCognitoConfigured()) {
      const demoUser = DEMO_CREDENTIALS[email.toLowerCase()];
      if (demoUser && password.length >= 4) {
        const user = { ...demoUser, email };
        document.cookie = 'lynia-auth-active=1; path=/; SameSite=Lax';
        try { sessionStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(user)); } catch { /* private browsing */ }
        set({ user });
        return {};
      }
      return { error: 'Invalid email or password' };
    }

    // ── Cognito authentication ──
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
          const adminUser = buildAdminUserFromSession(session);
          if (!adminUser) {
            cognitoSignOut();
            resolve({ error: 'Invalid email or password' });
            return;
          }
          // Set a marker cookie so middleware can detect an active session
          document.cookie = 'lynia-auth-active=1; path=/; SameSite=Lax';
          set({ user: adminUser });
          resolve({});
        },
        onFailure: () => {
          // MED-01: Generic error to avoid leaking account information
          resolve({ error: 'Invalid email or password' });
        },
      });
    });
  },

  signOutUser: () => {
    cognitoSignOut();
    document.cookie = 'lynia-auth-active=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    try { sessionStorage.removeItem(DEMO_SESSION_KEY); } catch { /* private browsing */ }
    set({ user: null });
  },

  initialize: async () => {
    // Demo mode: restore session from sessionStorage
    if (!isCognitoConfigured()) {
      try {
        const stored = sessionStorage.getItem(DEMO_SESSION_KEY);
        if (stored) {
          set({ user: JSON.parse(stored), isLoading: false });
          return;
        }
      } catch { /* private browsing or corrupt data */ }
      set({ isLoading: false });
      return;
    }

    try {
      const session = await getSession();
      if (session && session.isValid()) {
        const adminUser = buildAdminUserFromSession(session);
        if (adminUser) {
          // Ensure marker cookie is present
          document.cookie = 'lynia-auth-active=1; path=/; SameSite=Lax';
          set({ user: adminUser });
        } else {
          cognitoSignOut();
          document.cookie = 'lynia-auth-active=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
        }
      }
    } catch {
      // Session expired or invalid
    } finally {
      set({ isLoading: false });
    }
  },
}));
