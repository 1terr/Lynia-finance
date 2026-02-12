import { create } from 'zustand';
import type { AdminUser, AdminRole, Permission } from '@/types/auth';
import { ROLE_PERMISSIONS, isValidAdminRole } from '@/types/auth';
import {
  userPool,
  CognitoUser,
  AuthenticationDetails,
  getSession,
  signOut as cognitoSignOut,
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
    const cognitoUser = new CognitoUser({
      Username: email,
      Pool: userPool,
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
    set({ user: null });
  },

  initialize: async () => {
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
