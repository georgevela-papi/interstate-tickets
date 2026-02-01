'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, getSession, clearSession } from '@/lib/supabase';
import TechnicianManager from '@/components/TechnicianManager';
import type { Technician } from '@/lib/types';
import Image from 'next/image';

interface KPIData {
  totalToday: number;
  totalThisWeek: number;
  avgTimeMinutes: number;
  pendingCount: number;
}

export default function AdminPage() {
  const [session, setSession] = useState<any>(null);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [kpis, setKpis] = useState<KPIData | null>(null);
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
    loadKPIs();
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

  const loadKPIs = async () => {
    try {
      // Total completed today
      const { data: todayData, error: todayError } = await supabase
        .from('tickets')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'COMPLETED')
        .gte('completed_at', new Date().toISOString().split('T')[0]);

      // Total completed this week
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const { data: weekData, error: weekError } = await supabase
        .from('tickets')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'COMPLETED')
        .gte('completed_at', weekStart.toISOString());

      // Average time in system (last 7 days)
      const { data: avgData } = await supabase.rpc('get_avg_completion_time');

      // Pending count
      const { data: pendingData, error: pendingError } = await supabase
        .from('tickets')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'PENDING');

      setKpis({
        totalToday: todayData?.length || 0,
        totalThisWeek: weekData?.length || 0,
        avgTimeMinutes: avgData?.[0]?.avg_minutes || 0,
        pendingCount: pendingData?.length || 0,
      });
    } catch (error) {
      console.error('Error loading KPIs:', error);
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
            <div className="space-y-6">
              {/* KPI Cards */}
              {kpis && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="card bg-gradient-to-br from-sky-500 to-sky-600 text-white">
                    <p className="text-sm font-semibold opacity-90 mb-1">TODAY</p>
                    <p className="text-4xl font-bold">{kpis.totalToday}</p>
                    <p className="text-sm opacity-80">Jobs Completed</p>
                  </div>

                  <div className="card bg-gradient-to-br from-green-500 to-green-600 text-white">
                    <p className="text-sm font-semibold opacity-90 mb-1">THIS WEEK</p>
                    <p className="text-4xl font-bold">{kpis.totalThisWeek}</p>
                    <p className="text-sm opacity-80">Jobs Completed</p>
                  </div>

                  <div className="card bg-gradient-to-br from-orange-500 to-orange-600 text-white">
                    <p className="text-sm font-semibold opacity-90 mb-1">AVG TIME</p>
                    <p className="text-4xl font-bold">{Math.round(kpis.avgTimeMinutes)}</p>
                    <p className="text-sm opacity-80">Minutes</p>
                  </div>

                  <div className="card bg-gradient-to-br from-red-500 to-red-600 text-white">
                    <p className="text-sm font-semibold opacity-90 mb-1">PENDING</p>
                    <p className="text-4xl font-bold">{kpis.pendingCount}</p>
                    <p className="text-sm opacity-80">In Queue</p>
                  </div>
                </div>
              )}

              {/* Coming Soon */}
              <div className="card">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">
                  Detailed Reports (Coming Soon)
                </h2>
                <p className="text-gray-600 mb-4">
                  Full reporting dashboard with the following features:
                </p>
                <ul className="space-y-2 text-gray-700">
                  <li>• Jobs by service type breakdown</li>
                  <li>• Jobs completed per technician</li>
                  <li>• Busiest hours analysis</li>
                  <li>• Priority distribution</li>
                  <li>• Export to CSV for accounting</li>
                  <li>• Date range filters (Today/Week/Month/Custom)</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
