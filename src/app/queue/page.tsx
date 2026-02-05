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
  const router = useRouter();

  useEffect(() => {
    const currentSession = getSession();
    if (!currentSession || !['TECHNICIAN', 'MANAGER'].includes(currentSession.role)) {
      router.push('/');
      return;
    }
    setSession(currentSession);
    loadTickets();

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

  const handleLogout = () => {
    clearSession();
    router.push('/');
  };

  if (!session) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-sky-500 text-white shadow-lg">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="relative w-16 h-12">
                <Image
                  src="https://interstatetire.online/logo.png"
                  alt="Interstate Tires"
                  fill
                  className="object-contain"
                />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Job Queue ({tickets.length})</h1>
                <p className="text-sm text-sky-100">
                  {session.name} • Updated {lastUpdate.toLocaleTimeString()}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
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
                className="bg-white text-sky-600 px-4 py-2 rounded-lg font-semibold hover:bg-sky-50 transition-colors"
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
        />
      )}
    </div>
  );
}
