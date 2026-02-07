'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, getSession, clearSession, subscribeToQueue } from '@/lib/supabase';
import { useTenant } from '@/lib/tenant-context';
import QueueList from '@/components/QueueList';
import TicketDetailModal from '@/components/TicketDetailModal';
import type { Ticket } from '@/lib/types';

export default function QueuePage() {
  const { tenant } = useTenant();
  const [session, setSession] = useState<any>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const currentSession = getSession();
    if (!currentSession || (currentSession.role !== 'TECHNICIAN' && currentSession.role !== 'MANAGER')) {
      router.push('/');
      return;
    }
    setSession(currentSession);
  }, [router]);

  const loadTickets = useCallback(async () => {
    const { data, error } = await supabase
      .from('active_queue')
      .select('*');

    if (!error && data) {
      setTickets(data as Ticket[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!session) return;
    loadTickets();

    const channel = subscribeToQueue(() => {
      loadTickets();
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session, loadTickets]);

  const handleComplete = async (ticketId: string) => {
    try {
      // Get technician ID from staff code
      const { data: techId } = await supabase
        .rpc('get_technician_id_by_code', { p_id_code: session.idCode });

      const { error } = await supabase
        .from('tickets')
        .update({
          status: 'COMPLETED',
          completed_by: techId,
          completed_at: new Date().toISOString(),
        })
        .eq('id', ticketId);

      if (error) throw error;

      setSelectedTicket(null);
      loadTickets();
    } catch (error) {
      console.error('Error completing ticket:', error);
      alert('Failed to complete ticket.');
    }
  };

  const handleLogout = async () => {
    clearSession();
    await supabase.auth.signOut();
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith('sb-')) localStorage.removeItem(key);
    });
    window.location.href = '/login';
  };

  if (!session) return null;

  const primaryColor = tenant?.primary_color || '#0EA5E9';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="text-white shadow-lg" style={{ backgroundColor: primaryColor }}>
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {tenant?.logo_url && (
                <img src={tenant.logo_url} alt={tenant.name} className="w-12 h-10 object-contain" />
              )}
              <div>
                <h1 className="text-lg md:text-2xl font-bold">Service Queue</h1>
                <p className="text-xs md:text-sm opacity-80">
                  {session.name} • {tickets.length} ticket{tickets.length !== 1 ? 's' : ''} pending
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {session.role === 'MANAGER' && (
                <>
                  <button onClick={() => router.push('/admin')} className="bg-white bg-opacity-20 hover:bg-opacity-30 text-white px-3 py-1.5 rounded-lg text-sm font-semibold">
                    Admin
                  </button>
                  <button onClick={() => router.push('/intake')} className="bg-white bg-opacity-20 hover:bg-opacity-30 text-white px-3 py-1.5 rounded-lg text-sm font-semibold">
                    Create
                  </button>
                </>
              )}
              <button onClick={handleLogout} className="bg-white px-3 py-1.5 rounded-lg text-sm font-semibold" style={{ color: primaryColor }}>
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Queue */}
      <main className="container mx-auto px-4 py-6">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="spinner" />
          </div>
        ) : tickets.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">✅</div>
            <h2 className="text-2xl font-bold text-gray-700 mb-2">Queue is Clear!</h2>
            <p className="text-gray-500">No pending tickets. Great work!</p>
          </div>
        ) : (
          <QueueList tickets={tickets} onSelect={setSelectedTicket} />
        )}
      </main>

      {/* Ticket Detail Modal */}
      {selectedTicket && (
        <TicketDetailModal
          ticket={selectedTicket}
          onClose={() => setSelectedTicket(null)}
          onComplete={handleComplete}
          canComplete={session.role === 'TECHNICIAN' || session.role === 'MANAGER'}
        />
      )}
    </div>
  );
}
