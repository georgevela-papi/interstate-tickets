'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useTenant } from '@/lib/tenant-context';

type LoginState =
  | 'idle'
  | 'sending'
  | 'sent'
  | 'error'
  | 'verifying'
  | 'access_denied';

interface StaffInfo {
  id: string;
  tenant_id: string;
  role: string;
  name: string;
}

export default function LoginPage() {
  const { tenant, loading: tenantLoading, isAuthenticated } = useTenant();

  const [email, setEmail] = useState('');
  const [state, setState] = useState<LoginState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      window.location.href = '/queue';
    }
  }, [isAuthenticated]);

  // Handle magic link callback
  useEffect(() => {
    const handleAuthCallback = async () => {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      const hashError = hashParams.get('error');
      const errorDescription = hashParams.get('error_description');

      if (hashError) {
        setState('error');
        setError(errorDescription || 'Authentication failed');
        return;
      }

      if (accessToken && refreshToken) {
        setState('verifying');

        // Set session
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (sessionError) {
          setState('error');
          setError(sessionError.message);
          return;
        }

        // Verify user has an active staff record (allowlist check)
        const { data: staffData, error: staffError } = await supabase
          .rpc('get_my_staff')
          .single() as { data: StaffInfo | null; error: Error | null };

        if (staffError || !staffData) {
          // No active staff record = not authorized
          await supabase.auth.signOut();
          setState('access_denied');
          setError('You are not authorized to access this system. Contact your administrator.');
          return;
        }

        // Verify tenant match (boot guard)
        if (tenant && staffData.tenant_id !== tenant.id) {
          await supabase.auth.signOut();
          setState('access_denied');
          setError('You do not have access to this business.');
          return;
        }

        // Success - redirect to app
        window.location.href = '/queue';
      }
    };

    handleAuthCallback();
  }, [tenant]);

  // Cooldown timer for resend
  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(c => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  const handleSendMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim() || cooldown > 0) return;

    setState('sending');
    setError(null);

    try {
      // Send magic link (INVITE-ONLY: user must already exist in auth.users)
      const redirectUrl = `${window.location.origin}/login`;

      const { error: authError } = await supabase.auth.signInWithOtp({
        email: email.toLowerCase().trim(),
        options: {
          emailRedirectTo: redirectUrl,
          shouldCreateUser: true, // Allow auto-creation, staff check happens after login
        },
      });

      if (authError) {
        setState('error');
        // Handle "user not found" error from shouldCreateUser: false
        if (authError.message.includes('Signups not allowed') ||
            authError.message.includes('User not found') ||
            authError.message.includes('Email not confirmed')) {
          setError('Your account must be created by an administrator.');
        } else {
          setError(authError.message);
        }
        return;
      }

      setState('sent');
      setCooldown(60); // 60 second cooldown for resend
    } catch (err) {
      setState('error');
      setError('An unexpected error occurred. Please try again.');
    }
  };

  if (tenantLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full">
        {/* Logo */}
        <div className="text-center mb-8">
          {tenant?.logo_url ? (
            <img
              src={tenant.logo_url}
              alt={tenant.name}
              className="mx-auto mb-4 h-20 object-contain"
            />
          ) : (
            <div
              className="mx-auto mb-4 w-20 h-20 rounded-full flex items-center justify-center text-white text-2xl font-bold"
              style={{ backgroundColor: tenant?.primary_color || '#0EA5E9' }}
            >
              {tenant?.name?.charAt(0) || 'T'}
            </div>
          )}
          <h1 className="text-2xl font-bold text-gray-800">
            {tenant?.name || 'Job Tickets'}
          </h1>
          <p className="text-gray-600 mt-2">Sign in to continue</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-xl shadow-lg p-8">
          {state === 'access_denied' ? (
            <div className="text-center">
              <div className="text-red-500 text-5xl mb-4">&#128683;</div>
              <h2 className="text-xl font-bold text-gray-800 mb-2">Access Denied</h2>
              <p className="text-gray-600 mb-6">{error}</p>
              <button
                onClick={() => {
                  setState('idle');
                  setError(null);
                  setEmail('');
                }}
                className="w-full bg-sky-500 hover:bg-sky-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
              >
                Try Another Email
              </button>
            </div>
          ) : state === 'sent' ? (
            <div className="text-center">
              <div className="text-green-500 text-5xl mb-4">&#9993;</div>
              <h2 className="text-xl font-bold text-gray-800 mb-2">Check Your Email</h2>
              <p className="text-gray-600 mb-2">
                We sent a login link to:
              </p>
              <p className="font-semibold text-gray-800 mb-6">{email}</p>
              <p className="text-sm text-gray-500 mb-6">
                Click the link in the email to sign in. The link expires in 1 hour.
              </p>

              <button
                onClick={handleSendMagicLink}
                disabled={cooldown > 0}
                className={`w-full py-3 rounded-lg font-semibold transition-colors ${
                  cooldown > 0
                    ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend Link'}
              </button>

              <button
                onClick={() => {
                  setState('idle');
                  setEmail('');
                }}
                className="mt-4 text-sm text-sky-500 hover:underline"
              >
                Use a different email
              </button>
            </div>
          ) : state === 'verifying' ? (
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-500 mx-auto mb-4" />
              <p className="text-gray-600">Verifying your login...</p>
            </div>
          ) : (
            <form onSubmit={handleSendMagicLink}>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none mb-4"
                required
                autoFocus
                autoComplete="email"
              />

              {error && state === 'error' && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={state === 'sending' || !email.trim()}
                className={`w-full py-3 rounded-lg font-semibold transition-colors ${
                  state === 'sending' || !email.trim()
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-sky-500 hover:bg-sky-600 text-white'
                }`}
                style={email.trim() && state !== 'sending' ? { backgroundColor: tenant?.primary_color } : undefined}
              >
                {state === 'sending' ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    Sending...
                  </span>
                ) : (
                  'Send Login Link'
                )}
              </button>

              <p className="mt-4 text-xs text-gray-500 text-center">
                A secure login link will be sent to your email.
                <br />
                No password required.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
