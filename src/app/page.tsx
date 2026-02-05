'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTenant } from '@/lib/tenant-context';

/**
 * Root page - redirects based on authentication state.
 *
 * - Authenticated users → role-based dashboard
 * - Unauthenticated users → /login
 */
export default function HomePage() {
  const { profile, loading, isAuthenticated } = useTenant();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    if (!isAuthenticated) {
      router.push('/login');
      return;
    }

    // Route based on role
    switch (profile?.role) {
      case 'SERVICE_WRITER':
        router.push('/intake');
        break;
      case 'TECHNICIAN':
        router.push('/queue');
        break;
      case 'MANAGER':
        router.push('/admin');
        break;
      default:
        router.push('/login');
    }
  }, [loading, isAuthenticated, profile, router]);

  // Show loading spinner during redirect
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="spinner" />
    </div>
  );
}
