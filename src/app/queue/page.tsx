'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, getSession, clearSession, subscribeToQueue } from '@/lib/supabase';
import QueueList from '@/components/QueueList';
import TicketDetailModal from '@/components/TicketDetailModal';
import type { ActiveQueueItem } from '@/lib/types';
import Image from 'next/image';

export default function QueuePage() {
  const [tickets, setTickets] = useState<ActiveQueueItem[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<ActiveQueueItem | null>(null);
  const [session, setSession] = useState<any>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [tenant, setTenant] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    const currentSession = getSession();

    // Allow SERVICE_WRITER, TECHNICIAN, and MANAGER to view queue
    if (!currentSession || !['SERVICE_WRITER', 'TECHNICIAN', 'MANAGER'].includes(currentSession.role)) {
      router.push('/');
      return;
    }

    setSession(currentSession);
    loadTickets();

    // Load tenant branding
    supabase
      .from('tenants_public')
      .select('name, logo_url, primary_color, secondary_color')
      .single()
      .then(({ data }: { data: any }) => {
        if (data) setTenant(data);
      });

    const channel = subscribeToQueue(() => {
      setLastUpdate(new Date());
      loadTickets();
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [router]);

  const loadTickets = async () => {
    const { data, error } = await supabase
      .from('active_queue')
      .select('*');

    if (error) {
      console.error('Error loading queue:', error);
      return;
    }

    setTickets(data || []);
    setLastUpdate(new Date());
  };

  const handleLogout = async () => {
    clearSession();
    await supabase.auth.signOut();
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith('sb-')) localStorage.removeItem(key);
    });
    router.push('/');
  };

  if (!session) return null;

  // SERVICE_WRITER can view queue but not complete jobs
  const canComplete = session.role !== 'SERVICE_WRITER';

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="text-white shadow-lg" style={{ backgroundColor: tenant?.primary_color || '#6B7280' }}>
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {tenant?.logo_url && (
                <div className="relative w-16 h-12">
                  <Image
                    src={tenant.logo_url}
                    alt={tenant?.name || 'Logo'}
                    fill
                    className="object-contain"
                  />
                </div>
              )}
              <div>
                <h1 className="text-2xl font-bold">Job Queue ({tickets.length})</h1>
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>
                  {session.name} {'\u2022'} Updated {lastUpdate.toLocaleTimeString()}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {session?.role === 'MANAGER' && (
                <>
                  <button
                    onClick={() => router.push('/admin')}
                    className="bg-white bg-opacity-20 hover:bg-opacity-30 text-white px-4 py-2 rounded-lg font-semibold transition-colors"
                  >
                    Admin
                  </button>
                  <button
                    onClick={() => router.push('/intake')}
                    className="bg-white bg-opacity-20 hover:bg-opacity-30 text-white px-4 py-2 rounded-lg font-semibold transition-colors"
                  >
                    Intake
                  </button>
                </>
              )}
              {session?.role === 'SERVICE_WRITER' && (
                <button
                  onClick={() => router.push('/intake')}
                  className="bg-white bg-opacity-20 hover:bg-opacity-30 text-white px-4 py-2 rounded-lg font-semibold transition-colors"
                >
                  Intake
                </button>
              )}
              <button
                onClick={loadTickets}
                className="bg-white bg-opacity-20 hover:bg-opacity-30 text-white px-4 py-2 rounded-lg font-semibold transition-colors flex items-center space-x-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>Refresh</span>
              </button>
              <button
                onClick={handleLogout}
                className="bg-white px-4 py-2 rounded-lg font-semibold transition-colors"
                style={{ color: tenant?.primary_color || '#6B7280' }}
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <QueueList tickets={tickets} onTicketClick={setSelectedTicket} />
      </main>

      {selectedTicket && (
        <TicketDetailModal
          ticket={selectedTicket}
          onClose={() => setSelectedTicket(null)}
          onComplete={() => {
            setSelectedTicket(null);
            loadTickets();
          }}
          canComplete={canComplete}
        />
      )}
    </div>
  );
}
