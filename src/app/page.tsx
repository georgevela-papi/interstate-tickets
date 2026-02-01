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
    // Check if already logged in
    const session = getSession();
    if (session) {
      // Route based on role
      if (session.role === 'SERVICE_WRITER') {
        router.push('/intake');
      } else if (session.role === 'TECHNICIAN') {
        router.push('/queue');
      } else if (session.role === 'MANAGER') {
        router.push('/admin');
      }
    }
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data, error: dbError } = await supabase
        .from('staff')
        .select('*')
        .eq('id_code', idCode.toUpperCase())
        .eq('active', true)
        .single();

      if (dbError || !data) {
        setError('Invalid ID code');
        setLoading(false);
        return;
      }

      // Save session
      saveSession(data.id_code, data.name, data.role);

      // Route based on role
      if (data.role === 'SERVICE_WRITER') {
        router.push('/intake');
      } else if (data.role === 'TECHNICIAN') {
        router.push('/queue');
      } else if (data.role === 'MANAGER') {
        router.push('/admin');
      }
    } catch (err) {
      setError('Login failed. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-400 via-sky-500 to-sky-600 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="relative w-48 h-32">
            <Image
              src="https://interstatetire.online/logo.png"
              alt="Interstate Tires"
              fill
              className="object-contain"
              priority
            />
          </div>
        </div>

        <h1 className="text-3xl font-bold text-center text-gray-800 mb-2">
          Job Ticket System
        </h1>
        <p className="text-center text-gray-600 mb-8">
          Enter your ID code to continue
        </p>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label htmlFor="idCode" className="label">
              ID Code
            </label>
            <input
              id="idCode"
              type="text"
              value={idCode}
              onChange={(e) => setIdCode(e.target.value.toUpperCase())}
              className="input text-center text-2xl font-mono tracking-wider"
              placeholder="SW01"
              autoComplete="off"
              autoFocus
              maxLength={10}
            />
            {error && (
              <p className="mt-2 text-sm text-red-600">{error}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || !idCode}
            className="btn-primary w-full text-xl"
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

        <div className="mt-8 p-4 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-600 text-center">
            <strong>Default ID Codes:</strong>
            <br />
            SW01 (Service Writer) • T01/T02/T03 (Technicians) • ADMIN (Manager)
          </p>
        </div>
      </div>
    </div>
  );
}
