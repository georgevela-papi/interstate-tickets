'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, saveSession } from '@/lib/supabase';
import { useTenant } from '@/lib/tenant-context';

type LoginMode = 'pin' | 'email';
type EmailState =
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
  const { tenant, staff, loading: tenantLoading, isAuthenticated } = useTenant();
  const router = useRouter();

  // --- Shared ---
  const [mode, setMode] = useState<LoginMode>('pin');
  const [error, setError] = useState<string | null>(null);

  // --- PIN pad ---
  const [pinCode, setPinCode] = useState('');
  const [pinLoading, setPinLoading] = useState(false);
  const [pinSuccess, setPinSuccess] = useState<string | null>(null);

  // --- Email / Magic Link ---
  const [email, setEmail] = useState('');
  const [emailState, setEmailState] = useState<EmailState>('idle');
  const [cooldown, setCooldown] = useState(0);

  // Check if device is already activated (has a valid Supabase auth session)
  const [deviceActivated, setDeviceActivated] = useState(false);

  useEffect(() => {
    async function checkDevice() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setDeviceActivated(true);
      }
    }
    checkDevice();
  }, []);

  // If fully authenticated with staff context, redirect
  useEffect(() => {
    if (isAuthenticated && staff) {
      saveSession(staff.id, staff.name, staff.role);
      const route =
        staff.role === 'SERVICE_WRITER' ? '/intake' :
        staff.role === 'TECHNICIAN' ? '/queue' :
        staff.role === 'MANAGER' ? '/admin' :
        '/login';
      router.push(route);
    }
  }, [isAuthenticated, staff]);

  // Handle magic link callback (hash fragment tokens)
  useEffect(() => {
    const handleAuthCallback = async () => {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      const hashError = hashParams.get('error');
      const errorDescription = hashParams.get('error_description');

      if (hashError) {
        setEmailState('error');
        setError(errorDescription || 'Authentication failed');
        return;
      }

      if (accessToken && refreshToken) {
        setMode('email');
        setEmailState('verifying');

        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (sessionError) {
          setEmailState('error');
          setError(sessionError.message);
          return;
        }

        // Verify staff record
        const { data: staffData, error: staffError } = await supabase
          .rpc('get_my_staff')
          .single() as { data: StaffInfo | null; error: Error | null };

        if (staffError || !staffData) {
          await supabase.auth.signOut();
          setEmailState('access_denied');
          setError('You are not authorized. Contact your administrator.');
          return;
        }

        if (tenant && staffData.tenant_id !== tenant.id) {
          await supabase.auth.signOut();
          setEmailState('access_denied');
          setError('You do not have access to this business.');
          return;
        }

        // Device is now activated -- save session and redirect
        setDeviceActivated(true);
        saveSession(staffData.id, staffData.name, staffData.role);
        const route =
          staffData.role === 'SERVICE_WRITER' ? '/intake' :
          staffData.role === 'TECHNICIAN' ? '/queue' :
          staffData.role === 'MANAGER' ? '/admin' :
          '/login';
        router.push(route);
      }
    };

    handleAuthCallback();
  }, [tenant]);

  // Cooldown timer
  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(c => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  // --- PIN PAD HANDLER ---
  const handlePinLogin = useCallback(async (code: string) => {
    if (!code.trim()) return;
    setError(null);
    setPinLoading(true);
    setPinSuccess(null);

    try {
      let query = supabase
        .from('staff')
        .select('id, id_code, name, role, tenant_id')
        .eq('id_code', code.toUpperCase())
        .eq('active', true);

      if (tenant) {
        query = query.eq('tenant_id', tenant.id);
      }

      const { data, error: dbError } = await query.single();

      if (dbError || !data) {
        setError('Invalid ID code');
        setPinLoading(false);
        setPinCode('');
        return;
      }

      saveSession(data.id_code, data.name, data.role);
      setPinSuccess(data.name);

      setTimeout(() => {
        const route =
          data.role === 'SERVICE_WRITER' ? '/intake' :
          data.role === 'TECHNICIAN' ? '/queue' :
          data.role === 'MANAGER' ? '/admin' :
          '/login';
        router.push(route);
      }, 400);
    } catch (err) {
      setError('Login failed. Try again.');
      setPinCode('');
    } finally {
      setPinLoading(false);
    }
  }, [tenant]);

  // PIN pad button press
  const handlePinPress = (digit: string) => {
    setError(null);
    if (digit === 'clear') {
      setPinCode('');
      return;
    }
    if (digit === 'back') {
      setPinCode(prev => prev.slice(0, -1));
      return;
    }
    const newCode = pinCode + digit;
    setPinCode(newCode);
  };

  // --- EMAIL HANDLER ---
  const handleSendMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || cooldown > 0) return;

    setEmailState('sending');
    setError(null);

    try {
      const redirectUrl = `${window.location.origin}/login`;
      const { error: authError } = await supabase.auth.signInWithOtp({
        email: email.toLowerCase().trim(),
        options: {
          emailRedirectTo: redirectUrl,
          shouldCreateUser: true,
        },
      });

      if (authError) {
        setEmailState('error');
        if (authError.message.includes('Signups not allowed') || authError.message.includes('User not found')) {
          setError('Your account must be created by an administrator.');
        } else {
          setError(authError.message);
        }
        return;
      }

      setEmailState('sent');
      setCooldown(60);
    } catch (err) {
      setEmailState('error');
      setError('An unexpected error occurred.');
    }
  };

  // --- LOADING STATE ---
  if (tenantLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-sky-50/30">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-500" />
      </div>
    );
  }

  const primaryColor = tenant?.primary_color || '#0EA5E9';

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 via-white to-sky-50/30 px-4 py-8">
      {/* Logo & Business Name */}
      <div className="text-center mb-6">
        {tenant?.logo_url ? (
          <img
            src={tenant.logo_url}
            alt={tenant.name}
            className="mx-auto mb-3 h-16 object-contain"
          />
        ) : (
          <div
            className="mx-auto mb-3 w-16 h-16 rounded-full flex items-center justify-center text-white text-xl font-bold shadow-lg"
            style={{ backgroundColor: primaryColor }}
          >
            {tenant?.name?.charAt(0) || 'T'}
          </div>
        )}
        <h1 className="text-xl font-bold text-gray-800 tracking-tight">
          {tenant?.name || 'Job Tickets'}
        </h1>
      </div>

      {/* ============== PIN PAD MODE ============== */}
      {mode === 'pin' && (
        <div className="w-full max-w-sm">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200/60 p-6">
            <p className="text-center text-gray-500 text-sm mb-6">
              Enter your ID code to clock in
            </p>

            {/* Primary Text Input - Large & Prominent */}
            {!pinSuccess ? (
              <div className="relative mb-6">
                <input
                  type="text"
                  value={pinCode}
                  onChange={(e) => {
                    setError(null);
                    setPinCode(e.target.value.toUpperCase());
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && pinCode.trim()) {
                      handlePinLogin(pinCode);
                    }
                  }}
                  placeholder="Enter ID code"
                  autoFocus
                  maxLength={10}
                  className="w-full text-center text-3xl font-mono font-bold tracking-[0.3em] py-4 px-4 rounded-xl border-2 transition-colors"
                  style={{
                    borderColor: error ? '#EF4444' : pinCode ? primaryColor : '#D1D5DB',
                    backgroundColor: '#F9FAFB',
                    color: '#1F2937',
                  }}
                />
              </div>
            ) : (
              /* Success State Display */
              <div className="relative mb-6">
                <div
                  className="w-full text-center text-3xl font-mono font-bold tracking-[0.3em] py-4 px-4 rounded-xl border-2"
                  style={{
                    borderColor: '#22C55E',
                    backgroundColor: '#F0FDF4',
                    color: '#16A34A',
                  }}
                >
                  <span className="text-xl">{'\u2713'} {pinSuccess}</span>
                </div>
              </div>
            )}

            {/* Error */}
            {error && mode === 'pin' && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-3 py-2 rounded-lg text-sm text-center mb-4">
                {error}
              </div>
            )}

            {/* Number Pad - Convenience Helper */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                <button
                  key={digit}
                  onClick={() => handlePinPress(digit)}
                  disabled={pinLoading || !!pinSuccess}
                  className="py-4 text-2xl font-semibold rounded-xl bg-gray-50 hover:bg-gray-100 active:bg-gray-200 active:scale-95 transition-all text-gray-800 shadow-sm disabled:opacity-50"
                >
                  {digit}
                </button>
              ))}
              <button
                onClick={() => handlePinPress('clear')}
                disabled={pinLoading || !!pinSuccess}
                className="py-4 text-sm font-semibold rounded-xl bg-gray-100 hover:bg-gray-200 active:bg-gray-300 transition-all text-gray-500 disabled:opacity-50"
              >
                Clear
              </button>
              <button
                onClick={() => handlePinPress('0')}
                disabled={pinLoading || !!pinSuccess}
                className="py-4 text-2xl font-semibold rounded-xl bg-gray-50 hover:bg-gray-100 active:bg-gray-200 active:scale-95 transition-all text-gray-800 shadow-sm disabled:opacity-50"
              >
                0
              </button>
              <button
                onClick={() => handlePinPress('back')}
                disabled={pinLoading || !!pinSuccess}
                className="py-4 text-xl font-semibold rounded-xl bg-gray-100 hover:bg-gray-200 active:bg-gray-300 transition-all text-gray-500 disabled:opacity-50"
              >
                {'\u232B'}
              </button>
            </div>

            {/* GO Button */}
            <button
              onClick={() => handlePinLogin(pinCode)}
              disabled={!pinCode.trim() || pinLoading || !!pinSuccess}
              className="w-full py-4 rounded-xl text-white text-lg font-bold transition-all shadow-sm hover:shadow-md active:scale-[0.98] disabled:opacity-40"
              style={{ backgroundColor: primaryColor }}
            >
              {pinLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                  Checking...
                </span>
              ) : (
                'Sign In'
              )}
            </button>
          </div>

          {/* Switch to email login */}
          <div className="text-center mt-5">
            <button
              onClick={() => {
                setMode('email');
                setError(null);
              }}
              className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
            >
              Manager / First-time setup {'\u2192'}
            </button>
          </div>
        </div>
      )}

      {/* ============== EMAIL MODE ============== */}
      {mode === 'email' && (
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-lg p-8">
            {emailState === 'access_denied' ? (
              <div className="text-center">
                <div className="text-red-500 text-5xl mb-4">{'\uD83D\uDEAB'}</div>
                <h2 className="text-xl font-bold text-gray-800 mb-2">Access Denied</h2>
                <p className="text-gray-600 mb-6">{error}</p>
                <button
                  onClick={() => {
                    setEmailState('idle');
                    setError(null);
                    setEmail('');
                  }}
                  className="w-full text-white font-semibold py-3 px-4 rounded-lg transition-colors"
                  style={{ backgroundColor: primaryColor }}
                >
                  Try Another Email
                </button>
              </div>
            ) : emailState === 'sent' ? (
              <div className="text-center">
                <div className="text-green-500 text-5xl mb-4">{'\u2709\uFE0F'}</div>
                <h2 className="text-xl font-bold text-gray-800 mb-2">Check Your Email</h2>
                <p className="text-gray-600 mb-1">We sent a login link to:</p>
                <p className="font-semibold text-gray-800 mb-5">{email}</p>
                <p className="text-sm text-gray-500 mb-5">
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
                    setEmailState('idle');
                    setEmail('');
                  }}
                  className="mt-3 text-sm text-sky-500 hover:underline"
                >
                  Use a different email
                </button>
              </div>
            ) : emailState === 'verifying' ? (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-500 mx-auto mb-4" />
                <p className="text-gray-600">Verifying your login...</p>
              </div>
            ) : (
              <form onSubmit={handleSendMagicLink}>
                <h2 className="text-lg font-bold text-gray-800 mb-1">Manager Sign In</h2>
                <p className="text-sm text-gray-500 mb-5">
                  Use email to activate this device or sign in as manager.
                </p>
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
                {error && emailState === 'error' && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
                    {error}
                  </div>
                )}
                <button
                  type="submit"
                  disabled={emailState === 'sending' || !email.trim()}
                  className={`w-full py-3 rounded-lg font-semibold transition-colors text-white ${
                    emailState === 'sending' || !email.trim()
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : ''
                  }`}
                  style={email.trim() && emailState !== 'sending' ? { backgroundColor: primaryColor } : undefined}
                >
                  {emailState === 'sending' ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                      Sending...
                    </span>
                  ) : (
                    'Send Login Link'
                  )}
                </button>
                <p className="mt-3 text-xs text-gray-400 text-center">
                  A secure login link will be sent to your email.
                </p>
              </form>
            )}
          </div>

          {/* Back to PIN pad */}
          <div className="text-center mt-5">
            <button
              onClick={() => {
                setMode('pin');
                setError(null);
                setEmailState('idle');
              }}
              className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
            >
              {'\u2190'} Back to ID code login
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
