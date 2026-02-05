import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

export function saveSession(idCode: string, name: string, role: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(
      'interstate_session',
      JSON.stringify({ idCode, name, role, timestamp: Date.now() })
    );
  }
}

export function getSession() {
  if (typeof window === 'undefined') return null;
  const session = localStorage.getItem('interstate_session');
  if (!session) return null;
  try {
    const parsed = JSON.parse(session);
    const eightHours = 8 * 60 * 60 * 1000;
    if (Date.now() - parsed.timestamp > eightHours) {
      clearSession();
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearSession() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('interstate_session');
  }
}

export function subscribeToQueue(callback: (payload: any) => void) {
  return supabase
    .channel('tickets-queue')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'tickets' },
      callback
    )
    .subscribe();
}
