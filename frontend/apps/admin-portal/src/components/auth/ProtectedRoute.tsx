'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/auth/context';
import { hasPermission } from '@/lib/auth/permissions';
import type { AdminRole, PermissionAction } from '@/types';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredPermission?: {
    resource: string;
    action: PermissionAction;
  };
  allowedRoles?: AdminRole[];
}

export function ProtectedRoute({
  children,
  requiredPermission,
  allowedRoles,
}: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // Check role-based access
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <AccessDenied />;
  }

  // Check permission-based access
  if (
    requiredPermission &&
    !hasPermission(
      user.role,
      requiredPermission.resource,
      requiredPermission.action
    )
  ) {
    return <AccessDenied />;
  }

  return <>{children}</>;
}

function AccessDenied() {
  const router = useRouter();

  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 text-center">
      <div className="rounded-full bg-red-100 p-4">
        <svg
          className="h-8 w-8 text-red-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
          />
        </svg>
      </div>
      <h2 className="text-xl font-semibold text-foreground">Access Denied</h2>
      <p className="max-w-md text-sm text-muted-foreground">
        You don&apos;t have permission to access this page. Contact your
        administrator if you believe this is an error.
      </p>
      <button onClick={() => router.push('/')} className="btn-primary mt-2">
        Return to Dashboard
      </button>
    </div>
  );
}
