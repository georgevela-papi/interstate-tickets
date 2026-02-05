'use client';

import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

interface SwitchUserButtonProps {
  className?: string;
  variant?: 'icon' | 'full';
}

/**
 * Switch User button for shared iPad deployments.
 *
 * Intended for shift changes where multiple staff share a device.
 * - Calls supabase.auth.signOut() to clear session
 * - Redirects to /login for next user to authenticate
 *
 * Place this in the header/nav area of protected pages.
 */
export function SwitchUserButton({ className = '', variant = 'full' }: SwitchUserButtonProps) {
  const router = useRouter();

  const handleSwitchUser = async () => {
    // Clear the current session
    await supabase.auth.signOut();

    // Redirect to login page
    router.push('/login');
  };

  if (variant === 'icon') {
    return (
      <button
        onClick={handleSwitchUser}
        className={`p-2 rounded-lg hover:bg-gray-100 transition-colors ${className}`}
        title="Switch User"
        aria-label="Switch User"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="w-6 h-6"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9"
          />
        </svg>
      </button>
    );
  }

  return (
    <button
      onClick={handleSwitchUser}
      className={`flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors ${className}`}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
        className="w-5 h-5"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9"
        />
      </svg>
      Switch User
    </button>
  );
}
