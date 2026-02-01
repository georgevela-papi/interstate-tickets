'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, getSession, clearSession } from '@/lib/supabase';
import TechnicianManager from '@/components/TechnicianManager';
import ReportsDashboard from '@/components/ReportsDashboard';
import type { Technician } from '@/lib/types';
import Image from 'next/image';

export default function AdminPage() {
  const [session, setSession] = useState<any>(null);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [activeTab, setActiveTab] = useState<'technicians' | 'reports'>('technicians');
  const router = useRouter();

  useEffect(() => {
    const currentSession = getSession();
    if (!currentSession || currentSession.role !== 'MANAGER') {
      router.push('/');
      return;
    }
    setSession(currentSession);
    loadTechnicians();
  }, [router]);

  const loadTechnicians = async () => {
    const { data } = await supabase
      .from('technicians')
      .select('*')
      .order('name');

    if (data) {
      setTechnicians(data);
    }
  };

  const handleLogout = () => {
    clearSession();
    router.push('/');
  };

  if (!session) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
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
                <h1 className="text-2xl font-bold">Admin Dashboard</h1>
                <p className="text-sm text-sky-100">Logged in as {session.name}</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/intake')}
                className="bg-white bg-opacity-20 hover:bg-opacity-30 text-white px-4 py-2 rounded-lg font-semibold transition-colors"
              >
                Create Ticket
              </button>
              <button
                onClick={() => router.push('/queue')}
                className="bg-white bg-opacity-20 hover:bg-opacity-30 text-white px-4 py-2 rounded-lg font-semibold transition-colors"
              >
                View Queue
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

      {/* Tabs */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-4">
          <div className="flex space-x-8">
            <button
              onClick={() => setActiveTab('technicians')}
              className={`
                py-4 px-2 border-b-2 font-semibold transition-colors
                ${
                  activeTab === 'technicians'
                    ? 'border-sky-500 text-sky-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }
              `}
            >
              Manage Technicians
            </button>
            <button
              onClick={() => setActiveTab('reports')}
              className={`
                py-4 px-2 border-b-2 font-semibold transition-colors
                ${
                  activeTab === 'reports'
                    ? 'border-sky-500 text-sky-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }
              `}
            >
              Reports & KPIs
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-5xl mx-auto">
          {activeTab === 'technicians' ? (
            <div className="card">
              <TechnicianManager
                technicians={technicians}
                onUpdate={loadTechnicians}
              />
            </div>
          ) : (
            <ReportsDashboard />
          )}
        </div>
      </main>
    </div>
  );
}
