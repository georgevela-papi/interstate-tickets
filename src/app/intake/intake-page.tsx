'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, getSession, clearSession } from '@/lib/supabase';
import { useTenant } from '@/lib/tenant-context';
import ServicePicker from '@/components/ServicePicker';
import DynamicServiceForm from '@/components/DynamicServiceForm';
import type { ServiceType } from '@/lib/types';

export default function IntakePage() {
  const { tenant } = useTenant();
  const [selectedService, setSelectedService] = useState<ServiceType | null>(null);
  const [session, setSession] = useState<any>(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const router = useRouter();

  useEffect(() => {
    const currentSession = getSession();
    if (!currentSession || (currentSession.role !== 'SERVICE_WRITER' && currentSession.role !== 'MANAGER')) {
      router.push('/');
      return;
    }
    setSession(currentSession);
  }, [router]);

  const handleLogout = async () => {
    clearSession();
    await supabase.auth.signOut();
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith('sb-')) localStorage.removeItem(key);
    });
    window.location.href = '/login';
  };

  const handleSubmit = async (data: {
    vehicle: string;
    priority: any;
    serviceData: any;
    scheduledTime: string | null;
    notes: string;
    customerName?: string;
    customerPhone?: string;
  }) => {
    try {
      const { data: staff } = await supabase
        .from('staff')
        .select('id, tenant_id')
        .eq('id_code', session.idCode)
        .single();

      const { data: ticket, error } = await supabase
        .from('tickets')
        .insert({
          service_type: selectedService,
          priority: data.priority,
          vehicle: data.vehicle,
          service_data: data.serviceData,
          notes: data.notes,
          scheduled_time: data.scheduledTime,
          created_by: staff?.id,
          customer_name: data.customerName || null,
          customer_phone: data.customerPhone || null,
          tenant_id: staff?.tenant_id,
        })
        .select('ticket_number')
        .single();

      if (error) throw error;

      setToastMessage(`Ticket #${ticket.ticket_number} created!`);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
      setSelectedService(null);
    } catch (error) {
      console.error('Error creating ticket:', error);
      alert('Failed to create ticket. Please try again.');
    }
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
                <h1 className="text-lg md:text-2xl font-bold">{tenant?.name || 'Job Tickets'}</h1>
                <p className="text-xs md:text-sm opacity-80">Service Writer: {session.name}</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {session.role === 'MANAGER' && (
                <button onClick={() => router.push('/admin')} className="bg-white bg-opacity-20 hover:bg-opacity-30 text-white px-3 py-1.5 rounded-lg text-sm font-semibold">
                  Admin
                </button>
              )}
              <button onClick={() => router.push('/queue')} className="bg-white bg-opacity-20 hover:bg-opacity-30 text-white px-3 py-1.5 rounded-lg text-sm font-semibold">
                Queue
              </button>
              <button onClick={handleLogout} className="bg-white px-3 py-1.5 rounded-lg text-sm font-semibold" style={{ color: primaryColor }}>
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-6 md:py-8">
        <div className="max-w-4xl mx-auto">
          {!selectedService ? (
            <ServicePicker onSelect={setSelectedService} />
          ) : (
            <DynamicServiceForm
              serviceType={selectedService}
              onSubmit={handleSubmit}
              onBack={() => setSelectedService(null)}
            />
          )}
        </div>
      </main>

      {/* Toast */}
      {showToast && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-green-500 text-white px-6 py-3 rounded-xl shadow-lg font-semibold text-lg z-50 animate-bounce">
          ✓ {toastMessage}
        </div>
      )}
    </div>
  );
}
