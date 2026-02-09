'use client';

import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

interface AccessDeniedProps {
  message: string;
}

export function AccessDenied({ message }: AccessDeniedProps) {
  const router = useRouter();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <div className="bg-white p-8 rounded-xl shadow-lg max-w-md text-center">
        <div className="text-red-500 text-6xl mb-4">🚫</div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Access Denied</h1>
        <p className="text-gray-600 mb-6">{message}</p>
        <button
          onClick={handleSignOut}
          className="w-full bg-sky-500 hover:bg-sky-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}
