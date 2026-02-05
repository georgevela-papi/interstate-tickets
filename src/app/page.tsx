'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, saveSession, getSession } from '@/lib/supabase';
import Image from 'next/image';

export default function LoginPage() {
  const [idCode, setIdCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const session = getSession();
    if (session) {
      if (session.role === 'SERVICE_WRITER') router.push('/intake');
      else if (session.role === 'TECHNICIAN') router.push('/queue');
      else if (session.role === 'MANAGER') router.push('/admin');
    }
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // FIX 2B: Query ALL staff (including inactive) to differentiate
      // "account deactivated" from "invalid code"
      const { data, error: dbError } = await supabase
        .from('staff')
        .select('*')
        .eq('id_code', idCode.toUpperCase())
        .maybeSingle();

      if (dbError) {
        setError('Login failed. Please try again.');
        setLoading(false);
        return;
      }

      if (!data) {
        setError('Invalid ID code');
        setLoading(false);
        return;
      }

      // FIX 2B: Block inactive/deleted staff
      if (!data.active) {
        setError('This account has been deactivated. Contact your manager.');
        setLoading(false);
        return;
      }

      saveSession(data.id_code, data.name, data.role);

      if (data.role === 'SERVICE_WRITER') router.push('/intake');
      else if (data.role === 'TECHNICIAN') router.push('/queue');
      else if (data.role === 'MANAGER') router.push('/admin');
    } catch (err) {
      setError('Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-500 to-sky-700 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="relative w-32 h-24 mx-auto mb-4">
            <Image
              src="https://interstatetire.online/logo.png"
              alt="Interstate Tires"
              fill
              className="object-contain"
            />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Interstate Tires</h1>
          <p className="text-gray-500 mt-1">Job Ticket System</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Enter Your ID Code
            </label>
            <input
              type="text"
              value={idCode}
              onChange={(e) => {
                setIdCode(e.target.value.toUpperCase());
                setError('');
              }}
              className="w-full px-4 py-4 text-center text-2xl font-bold border-2 border-gray-300 rounded-xl focus:border-sky-500 focus:ring-2 focus:ring-sky-200 outline-none transition-all"
              placeholder="e.g. SW01"
              maxLength={10}
              autoFocus
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-center">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !idCode.trim()}
            className="w-full py-4 bg-sky-500 hover:bg-sky-600 disabled:bg-gray-300 text-white rounded-xl text-xl font-bold transition-colors"
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <span className="spinner mr-3"></span>
                Signing In...
              </span>
            ) : (
              'Sign In'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
