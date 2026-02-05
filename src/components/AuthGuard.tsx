'use client';

import { ReactNode } from 'react';
import { useTenant } from '@/lib/tenant-context';
import { AccessDenied } from './AccessDenied';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

interface AuthGuardProps {
  children: ReactNode;
  requiredRole?: 'SERVICE_WRITER' | 'TECHNICIAN' | 'MANAGER';
}

export function AuthGuard({ children, requiredRole }: AuthGuardProps) {
  const { tenant, profile, loading, error, isAuthenticated } = useTenant();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isAuthenticated && !error) {
      router.push('/login');
    }
  }, [loading, isAuthenticated, error, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-500" />
      </div>
    );
  }

  if (error) {
    return <AccessDenied message={error} />;
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-500" />
      </div>
    );
  }

  // Role check
  if (requiredRole && profile?.role !== requiredRole && profile?.role !== 'MANAGER') {
    return <AccessDenied message="You do not have permission to access this page." />;
  }

  return <>{children}</>;
}
