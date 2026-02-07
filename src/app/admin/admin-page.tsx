'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSession, clearSession, supabase } from '@/lib/supabase';
import { useTenant } from '@/lib/tenant-context';
import TeamManager from '@/components/TeamManager';
import ReportsDashboard from '@/components/ReportsDashboard';
import CompletedJobsManager from '@/components/CompletedJobsManager';
import CustomerSearch from '@/components/CustomerSearch';

export default function AdminPage() {
  const { tenant } = useTenant();
  const [session, setSession] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'team' | 'reports' | 'completed' | 'customers'>('team');
  const router = useRouter();

  useEffect(() => {
    const currentSession = getSession();
    if (!currentSession || currentSession.role !== 'MANAGER') {
      router.push('/login');
      return;
    }
    setSession(currentSession);
  }, [router]);

  const handleLogout = async () => {
    clearSession();
    await supabase.auth.signOut();
    // Belt-and-suspenders: clear any Supabase auth tokens from storage
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith('sb-')) localStorage.removeItem(key);
    });
    window.location.href = '/login';
  };

  if (!session) return null;

  const primaryColor = tenant?.primary_color || '#0EA5E9';

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="text-white shadow-lg" style={{ backgroundColor: primaryColor }}>
        <div className="container mx-auto px-4 py-4">
          <div className="hidden md:flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {tenant?.logo_url && (
                <img src={tenant.logo_url} alt={tenant.name} className="w-16 h-12 object-contain" />
              )}
              <div>
                <h1 className="text-2xl font-bold">Admin Dashboard</h1>
                <p className="text-sm opacity-80">Logged in as {session.name}</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <button onClick={() => router.push('/intake')} className="bg-white bg-opacity-20 hover:bg-opacity-30 text-white px-4 py-2 rounded-lg font-semibold transition-colors">
                Create Ticket
              </button>
              <button onClick={() => router.push('/queue')} className="bg-white bg-opacity-20 hover:bg-opacity-30 text-white px-4 py-2 rounded-lg font-semibold transition-colors">
                View Queue
              </button>
              <button onClick={handleLogout} className="bg-white px-4 py-2 rounded-lg font-semibold hover:bg-opacity-90 transition-colors" style={{ color: primaryColor }}>
                Logout
              </button>
            </div>
          </div>
          <div className="md:hidden space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {tenant?.logo_url && (
                  <img src={tenant.logo_url} alt={tenant.name} className="w-12 h-10 object-contain" />
                )}
                <div>
                  <h1 className="text-lg font-bold leading-tight">Admin Dashboard</h1>
                  <p className="text-xs opacity-80">Logged in as {session.name}</p>
                </div>
              </div>
              <button onClick={handleLogout} className="bg-white px-3 py-1.5 rounded-lg text-sm font-semibold" style={{ color: primaryColor }}>
                Logout
              </button>
            </div>
            <div className="flex space-x-2">
              <button onClick={() => router.push('/intake')} className="flex-1 bg-white bg-opacity-20 hover:bg-opacity-30 text-white py-2 rounded-lg text-sm font-semibold text-center">
                Create Ticket
              </button>
              <button onClick={() => router.push('/queue')} className="flex-1 bg-white bg-opacity-20 hover:bg-opacity-30 text-white py-2 rounded-lg text-sm font-semibold text-center">
                View Queue
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="bg-white border-b">
        <div className="container mx-auto px-4">
          <div className="flex space-x-6 overflow-x-auto">
            {(['team', 'reports', 'completed', 'customers'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-4 px-2 border-b-2 font-semibold transition-colors whitespace-nowrap ${
                  activeTab === tab ? '' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
                style={activeTab === tab ? { borderColor: primaryColor, color: primaryColor } : undefined}
              >
                {tab === 'team' ? 'Team' : tab === 'reports' ? 'Reports & KPIs' : tab === 'completed' ? 'Completed Jobs' : 'Customers'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <main className="container mx-auto px-4 py-6 md:py-8">
        <div className="max-w-5xl mx-auto">
          {activeTab === 'team' && <div className="card"><TeamManager /></div>}
          {activeTab === 'reports' && <ReportsDashboard />}
          {activeTab === 'completed' && <CompletedJobsManager />}
          {activeTab === 'customers' && <CustomerSearch />}
        </div>
      </main>
    </div>
  );
}
