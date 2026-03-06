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
  user: AdminUser | null;
  isLoading: boolean;
  challenge: AuthChallenge;
  setUser: (user: AdminUser | null) => void;
  setLoading: (loading: boolean) => void;
  hasPermission: (permission: Permission) => boolean;
  hasAnyPermission: (permissions: Permission[]) => boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  completeNewPassword: (newPassword: string) => Promise<{ error?: string }>;
  completeMfaChallenge: (code: string) => Promise<{ error?: string }>;
  forgotPassword: (email: string) => Promise<{ error?: string }>;
  confirmForgotPassword: (email: string, code: string, newPassword: string) => Promise<{ error?: string }>;
  changePassword: (oldPassword: string, newPassword: string) => Promise<{ error?: string }>;
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

  const firstName = (payload.given_name as string) || '';
  const lastName = (payload.family_name as string) || '';
  return {
    id: payload.sub as string,
    email: (payload.email as string) || '',
    first_name: firstName,
    last_name: lastName,
    full_name: `${firstName} ${lastName}`.trim() || 'Admin',
    role,
    is_active: true,
    department: (payload['custom:department'] as string) || null,
    last_login_at: null,
    login_count: 0,
    created_at: '',
    updated_at: '',
  };
}

/** Map Cognito error codes to user-friendly messages. */
function getCognitoErrorMessage(err: Error & { code?: string }): string {
  switch (err.code) {
    case 'NotAuthorizedException':
    case 'UserNotFoundException':
      return 'Invalid email or password';
    case 'UserNotConfirmedException':
      return 'Your account is not confirmed. Contact your administrator.';
    case 'TooManyRequestsException':
      return 'Too many login attempts. Please wait before trying again.';
    case 'PasswordResetRequiredException':
      return 'You must reset your password before signing in.';
    case 'InvalidParameterException':
      return 'Invalid input. Please check your credentials.';
    default:
      return 'Invalid email or password';
  }
}

// Stores the CognitoUser instance while a challenge is in progress
let pendingCognitoUser: InstanceType<typeof CognitoUser> | null = null;

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: true,
  challenge: null,
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
    if (!isCognitoConfigured()) {
      return { error: 'Cognito is not configured. Contact your administrator.' };
    }

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
          const adminUser = buildAdminUserFromSession(session);
          if (!adminUser) {
            cognitoSignOut();
            resolve({ error: 'Your account does not have an admin role assigned. Contact your administrator.' });
            return;
          }
          document.cookie = 'lynia-auth-active=1; path=/; SameSite=Lax';
          set({ user: adminUser, challenge: null });
          resolve({});
        },
        onFailure: (err: Error & { code?: string }) => {
          pendingCognitoUser = null;
          resolve({ error: getCognitoErrorMessage(err) });
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
          const adminUser = buildAdminUserFromSession(session);
          if (!adminUser) {
            cognitoSignOut();
            resolve({ error: 'Account setup failed. Contact your administrator.' });
            return;
          }
          document.cookie = 'lynia-auth-active=1; path=/; SameSite=Lax';
          set({ user: adminUser, challenge: null });
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
            const adminUser = buildAdminUserFromSession(session);
            if (!adminUser) {
              cognitoSignOut();
              resolve({ error: 'Authentication failed. Contact your administrator.' });
              return;
            }
            document.cookie = 'lynia-auth-active=1; path=/; SameSite=Lax';
            set({ user: adminUser, challenge: null });
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
      return { error: 'Cognito is not configured. Contact your administrator.' };
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
      return { error: 'Cognito is not configured. Contact your administrator.' };
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
      return { error: 'Cognito is not configured. Contact your administrator.' };
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
    document.cookie = 'lynia-auth-active=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    set({ user: null });
  },

  initialize: async () => {
    if (!isCognitoConfigured()) {
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
