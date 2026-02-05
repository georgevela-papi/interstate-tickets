'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSession, clearSession } from '@/lib/supabase';
import TechnicianManager from '@/components/TechnicianManager';
import ReportsDashboard from '@/components/ReportsDashboard';
import CompletedJobsManager from '@/components/CompletedJobsManager';
import CustomerSearch from '@/components/CustomerSearch';
import Image from 'next/image';

export default function AdminPage() {
  const [session, setSession] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'technicians' | 'reports' | 'completed' | 'customers'>('technicians');
  const router = useRouter();

  useEffect(() => {
    const currentSession = getSession();
    if (!currentSession || currentSession.role !== 'MANAGER') {
      router.push('/');
      return;
    }
    setSession(currentSession);
  }, [router]);

  const handleLogout = () => {
    clearSession();
    router.push('/');
  };

  if (!session) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header — Desktop */}
      <header className="bg-sky-500 text-white shadow-lg">
        <div className="container mx-auto px-4 py-4">
          {/* Desktop header */}
          <div className="hidden md:flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="relative w-16 h-12">
                <Image src="https://interstatetire.online/logo.png" alt="Interstate Tires" fill className="object-contain" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Admin Dashboard</h1>
                <p className="text-sm text-sky-100">Logged in as {session.name}</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              {/* FIX 5: Correct routing */}
              <button onClick={() => router.push('/intake')} className="bg-white bg-opacity-20 hover:bg-opacity-30 text-white px-4 py-2 rounded-lg font-semibold transition-colors">
                Create Ticket
              </button>
              <button onClick={() => router.push('/queue')} className="bg-white bg-opacity-20 hover:bg-opacity-30 text-white px-4 py-2 rounded-lg font-semibold transition-colors">
                View Queue
              </button>
              <button onClick={handleLogout} className="bg-white text-sky-600 px-4 py-2 rounded-lg font-semibold hover:bg-sky-50 transition-colors">
                Logout
              </button>
            </div>
          </div>
          {/* Mobile header */}
          <div className="md:hidden space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="relative w-12 h-10">
                  <Image src="https://interstatetire.online/logo.png" alt="Interstate Tires" fill className="object-contain" />
                </div>
                <div>
                  <h1 className="text-lg font-bold leading-tight">Admin Dashboard</h1>
                  <p className="text-xs text-sky-100">Logged in as {session.name}</p>
                </div>
              </div>
              <button onClick={handleLogout} className="bg-white text-sky-600 px-3 py-1.5 rounded-lg text-sm font-semibold">
                Logout
              </button>
            </div>
            <div className="flex space-x-2">
              {/* FIX 5: Correct routing */}
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

      {/* Tabs */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-4">
          <div className="flex space-x-6 overflow-x-auto">
            <button
              onClick={() => setActiveTab('technicians')}
              className={`py-4 px-2 border-b-2 font-semibold transition-colors whitespace-nowrap ${
                activeTab === 'technicians'
                  ? 'border-sky-500 text-sky-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Manage Technicians
            </button>
            <button
              onClick={() => setActiveTab('reports')}
              className={`py-4 px-2 border-b-2 font-semibold transition-colors whitespace-nowrap ${
                activeTab === 'reports'
                  ? 'border-sky-500 text-sky-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Reports & KPIs
            </button>
            <button
              onClick={() => setActiveTab('completed')}
              className={`py-4 px-2 border-b-2 font-semibold transition-colors whitespace-nowrap ${
                activeTab === 'completed'
                  ? 'border-sky-500 text-sky-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Completed Jobs
            </button>
            <button
              onClick={() => setActiveTab('customers')}
              className={`py-4 px-2 border-b-2 font-semibold transition-colors whitespace-nowrap ${
                activeTab === 'customers'
                  ? 'border-sky-500 text-sky-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Customers
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="container mx-auto px-4 py-6 md:py-8">
        <div className="max-w-5xl mx-auto">
          {activeTab === 'technicians' && (
            <div className="card">
              <TechnicianManager />
            </div>
          )}
          {activeTab === 'reports' && <ReportsDashboard />}
          {activeTab === 'completed' && <CompletedJobsManager />}
          {activeTab === 'customers' && <CustomerSearch />}
        </div>
      </main>
    </div>
  );
}
