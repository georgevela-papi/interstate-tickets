// Supabase client setup for Interstate Tires

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

// Helper to set current user in RLS context
export async function setRLSContext(idCode: string) {
  const { error } = await supabase.rpc('set_config', {
    setting: 'app.current_user_id',
    value: idCode,
  });
  
  if (error) {
    console.error('Failed to set RLS context:', error);
  }
}

// Session management
export function saveSession(idCode: string, name: string, role: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('interstate_session', JSON.stringify({
      idCode,
      name,
      role,
      timestamp: Date.now(),
    }));
  }
}

export function getSession() {
  if (typeof window === 'undefined') return null;
  
  const session = localStorage.getItem('interstate_session');
  if (!session) return null;
  
  try {
    const parsed = JSON.parse(session);
    
    // Session expires after 8 hours
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

// Realtime subscription helper
export function subscribeToQueue(
  callback: (payload: any) => void
) {
  return supabase
    .channel('tickets-queue')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'tickets',
        filter: 'status=eq.PENDING',
      },
      callback
    )
    .subscribe();
}
