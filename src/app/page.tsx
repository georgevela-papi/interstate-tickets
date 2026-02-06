'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTenant } from '@/lib/tenant-context';
import { saveSession } from '@/lib/supabase';

/**
 * Root page - redirects based on authentication state.
 *
 * - Authenticated users → role-based dashboard
 * - Unauthenticated users → /login
 */
export default function HomePage() {
  const { staff, loading, isAuthenticated } = useTenant();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    if (!isAuthenticated || !staff) {
      router.push('/login');
      return;
    }

    // Bridge: sync tenant-context auth into localStorage session
    // so that downstream pages (admin, intake, queue) that use getSession() work
    saveSession(staff.id, staff.name, staff.role);

    // Route based on role
    switch (staff.role) {
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
  }, [loading, isAuthenticated, staff, router]);

  // Show loading spinner during redirect
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="spinner" />
    </div>
  );
}
