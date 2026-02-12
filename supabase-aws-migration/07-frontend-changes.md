# 07 - Frontend Changes

## Scope

Two frontend applications need updates:
1. **Admin Portal** (`frontend/admin-portal/`) -- Next.js 14, used by staff
2. **Distributor Dashboard** (`frontend/distributor-dashboard/`) -- Next.js 14, used by field agents

Both currently use `@supabase/supabase-js` and `@supabase/ssr` for:
- Authentication (login, session, logout)
- Direct database queries (some pages query Supabase directly)
- Realtime subscriptions (KYC queue updates)

## Migration Principle

**Frontends should NOT query the database directly.** After migration, all data
access goes through the API Gateway Lambda endpoints. This is better practice
regardless of the migration -- it centralizes authorization and validation.

## Files to Modify

### Admin Portal

| File | Current Usage | Change |
|------|--------------|--------|
| `src/lib/supabase/client.ts` | Creates browser Supabase client | Replace with Cognito + API client |
| `src/lib/supabase/server.ts` | Creates SSR Supabase client | Replace with Cognito session check |
| `src/lib/supabase/middleware.ts` | Refreshes Supabase session | Replace with Cognito token check |
| `src/lib/auth/context.tsx` | Zustand store with Supabase auth | Replace with Cognito auth |
| `src/lib/hooks/useKYCReview.ts` | Supabase realtime subscription | Replace with polling/WebSocket |
| `src/middleware.ts` | Uses Supabase middleware | Replace with Cognito middleware |
| Any component using `supabase.from()` | Direct DB queries | Replace with API calls |

### Distributor Dashboard

| File | Current Usage | Change |
|------|--------------|--------|
| `src/lib/supabase/client.ts` | Creates browser Supabase client | Replace with Cognito + API client |
| `src/components/layout/auth-provider.tsx` | Supabase auth + realtime | Replace with Cognito auth |
| Any component using `supabase.from()` | Direct DB queries | Replace with API calls |

## Step-by-Step Changes

### Step 1: Create API Client

Replace direct Supabase database calls with API calls through API Gateway.

```typescript
// frontend/admin-portal/src/lib/api/client.ts

const API_BASE = process.env.NEXT_PUBLIC_API_URL; // API Gateway URL

interface ApiResponse<T> {
  data: T | null;
  error: { code: string; message: string } | null;
}

async function getToken(): Promise<string | null> {
  // Get Cognito JWT token from session
  const { getSession } = await import('./auth');
  const session = await getSession();
  return session?.getIdToken().getJwtToken() ?? null;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<ApiResponse<T>> {
  const token = await getToken();
  if (!token) {
    return { data: null, error: { code: 'AUTH_TOKEN_001', message: 'Not authenticated' } };
  }

  try {
    const response = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const json = await response.json();

    if (!response.ok) {
      return { data: null, error: json.error };
    }

    return { data: json.data ?? json, error: null };
  } catch (err) {
    return {
      data: null,
      error: { code: 'NETWORK_ERROR', message: 'Network request failed' },
    };
  }
}

// Convenience methods matching common Supabase patterns
export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body: unknown) => request<T>('PUT', path, body),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
};
```

### Step 2: Replace Auth Context (Admin Portal)

**Current** (`src/lib/auth/context.tsx`):
```typescript
const { error } = await supabase.auth.signInWithPassword({ email, password });
```

**New** (`src/lib/auth/context.tsx`):
```typescript
import { create } from 'zustand';
import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
  CognitoUserSession,
} from 'amazon-cognito-identity-js';

const userPool = new CognitoUserPool({
  UserPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID!,
  ClientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID!,
});

interface AuthState {
  user: { email: string; roles: string[]; userId: string } | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => void;
  checkSession: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,

  signIn: async (email: string, password: string) => {
    const cognitoUser = new CognitoUser({ Username: email, Pool: userPool });
    const authDetails = new AuthenticationDetails({
      Username: email,
      Password: password,
    });

    return new Promise((resolve, reject) => {
      cognitoUser.authenticateUser(authDetails, {
        onSuccess: (session: CognitoUserSession) => {
          const payload = session.getIdToken().decodePayload();
          set({
            user: {
              email: payload.email,
              roles: payload['cognito:groups'] || [],
              userId: payload.sub,
            },
            isLoading: false,
          });
          resolve();
        },
        onFailure: (err) => reject(err),
        newPasswordRequired: () => {
          // Handle forced password change (first login after migration)
          reject(new Error('NEW_PASSWORD_REQUIRED'));
        },
      });
    });
  },

  signOut: () => {
    const currentUser = userPool.getCurrentUser();
    if (currentUser) currentUser.signOut();
    set({ user: null, isLoading: false });
  },

  checkSession: async () => {
    const currentUser = userPool.getCurrentUser();
    if (!currentUser) {
      set({ user: null, isLoading: false });
      return;
    }

    return new Promise<void>((resolve) => {
      currentUser.getSession(
        (err: Error | null, session: CognitoUserSession | null) => {
          if (err || !session?.isValid()) {
            set({ user: null, isLoading: false });
          } else {
            const payload = session.getIdToken().decodePayload();
            set({
              user: {
                email: payload.email,
                roles: payload['cognito:groups'] || [],
                userId: payload.sub,
              },
              isLoading: false,
            });
          }
          resolve();
        }
      );
    });
  },
}));
```

### Step 3: Replace Direct Database Queries

Find every instance of `supabase.from('table').select()` in frontend code and
replace with API calls.

**Before:**
```typescript
const { data: loans } = await supabase
  .from('loans')
  .select('*')
  .eq('status', 'pending')
  .order('created_at', { ascending: false });
```

**After:**
```typescript
const { data: loans } = await api.get('/loans?status=pending&sort=created_at&order=desc');
```

This requires corresponding API endpoints to exist in Lambda. Most already do
via the API Gateway routes defined in `template.yaml`. If any are missing,
add them.

### Step 4: Replace Realtime Hooks

**Before** (`src/lib/hooks/useKYCReview.ts`):
```typescript
const channel = supabase
  .channel('kyc-submissions-changes')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'kyc_submissions' },
    () => fetchQueue()
  )
  .subscribe();
```

**After** (polling approach):
```typescript
import { useEffect, useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';

export function useKYCReview() {
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: ['kyc-queue'],
    queryFn: () => api.get('/kyc/queue'),
    refetchInterval: 5000,  // Poll every 5 seconds
    refetchIntervalInBackground: false,
  });

  return {
    queue: data?.data ?? [],
    isLoading,
    error,
    refresh: refetch,
  };
}
```

### Step 5: Update Middleware

**Before** (`src/middleware.ts`):
```typescript
import { updateSession } from './lib/supabase/middleware';
export async function middleware(request) {
  return await updateSession(request);
}
```

**After** (`src/middleware.ts`):
```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Cognito tokens are stored in localStorage (client-side)
  // For SSR pages, check for a cookie-based indicator
  const hasSession = request.cookies.has('lynia-auth-active');

  const isAuthPage = request.nextUrl.pathname.startsWith('/login');

  if (!hasSession && !isAuthPage) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (hasSession && isAuthPage) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
};
```

### Step 6: Update Dependencies

```bash
# Remove Supabase packages
cd frontend/admin-portal
pnpm remove @supabase/supabase-js @supabase/ssr

# Add Cognito SDK
pnpm add amazon-cognito-identity-js

# Repeat for distributor dashboard
cd ../distributor-dashboard
pnpm remove @supabase/supabase-js @supabase/ssr
pnpm add amazon-cognito-identity-js
```

### Step 7: Update Environment Variables

**Remove from `.env` / `.env.local`:**
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

**Add:**
```
NEXT_PUBLIC_API_URL=https://api.lyniafinance.com
NEXT_PUBLIC_COGNITO_USER_POOL_ID=eu-west-2_XXXXXXXXX
NEXT_PUBLIC_COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
NEXT_PUBLIC_COGNITO_REGION=eu-west-2
```

### Step 8: Delete Supabase Client Files

After migration is validated:

```
DELETE: frontend/admin-portal/src/lib/supabase/client.ts
DELETE: frontend/admin-portal/src/lib/supabase/server.ts
DELETE: frontend/admin-portal/src/lib/supabase/middleware.ts
DELETE: frontend/distributor-dashboard/src/lib/supabase/client.ts
```

## Testing Checklist

- [ ] Admin login works with Cognito credentials
- [ ] Admin logout clears session properly
- [ ] Session persists across page refresh
- [ ] Session expires after configured timeout
- [ ] Role-based navigation works (admin sees admin pages, support sees limited pages)
- [ ] KYC review queue loads and updates
- [ ] All data tables load correctly via API
- [ ] All forms submit correctly via API
- [ ] Error states display properly (network errors, auth errors)
- [ ] Distributor login/logout works
- [ ] Distributor sees only their own data

## Bundle Size Impact

| Package | Size (gzipped) |
|---------|---------------|
| `@supabase/supabase-js` (removed) | -42 KB |
| `@supabase/ssr` (removed) | -8 KB |
| `amazon-cognito-identity-js` (added) | +30 KB |
| **Net change** | **-20 KB** |

Slightly smaller bundle after migration.
