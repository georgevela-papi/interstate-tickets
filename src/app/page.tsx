'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTenant } from '@/lib/tenant-context';
import { saveSession, getSession } from '@/lib/supabase';

/**
 * Root page - redirects based on authentication state.
 *
 * Priority:
 * 1. If tenant context has staff → save session + route by role
 * 2. If localStorage has valid session → route by role (PIN pad login)
 * 3. Otherwise → /login
 */
export default function HomePage() {
  const { staff, loading, isAuthenticated } = useTenant();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    // Path 1: Full Supabase auth + staff context
    if (isAuthenticated && staff) {
      saveSession(staff.id, staff.name, staff.role);
      routeByRole(staff.role);
      return;
    }

    // Path 2: localStorage session from PIN pad login
    const localSession = getSession();
    if (localSession) {
      routeByRole(localSession.role);
      return;
    }

    // Path 3: Not authenticated at all
    router.push('/login');
  }, [loading, isAuthenticated, staff, router]);

  function routeByRole(role: string) {
    switch (role) {
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
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-sky-500" />
    </div>
  );
}
