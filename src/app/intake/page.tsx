'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase, getSession, clearSession } from '@/lib/supabase';
import ServicePicker from '@/components/ServicePicker';
import DynamicServiceForm from '@/components/DynamicServiceForm';
import type { ServiceType } from '@/lib/types';
import { formatPhone } from '@/lib/types';
import { normalizePhone } from '@/lib/utils';
import Image from 'next/image';

function IntakeContent() {
  const [selectedService, setSelectedService] = useState<ServiceType | null>(null);
  const [session, setSession] = useState<any>(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState<string | null>(null);
  const [customerPhone, setCustomerPhone] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const currentSession = getSession();
    if (!currentSession || !['SERVICE_WRITER', 'MANAGER'].includes(currentSession.role)) {
      router.push('/');
      return;
    }
    setSession(currentSession);
  }, [router]);

  // Load customer from query param
  useEffect(() => {
    const cid = searchParams.get('customer_id');
    if (cid) {
      setCustomerId(cid);
      supabase
        .from('customers')
        .select('name, phone_raw, last_vehicle_text')
        .eq('id', cid)
        .single()
        .then(({ data }) => {
          if (data) {
            setCustomerName(data.name);
            setCustomerPhone(data.phone_raw);
          }
        });
    }
  }, [searchParams]);

  const handleLogout = () => {
    clearSession();
    router.push('/');
  };

  const handleRemoveCustomer = () => {
    setCustomerId(null);
    setCustomerName(null);
    setCustomerPhone(null);
    // Remove query param from URL without navigation
    router.replace('/intake');
  };

  const handleSubmit = async (data: {
    vehicle: string;
    priority: any;
    serviceData: any;
    scheduledTime: string | null;
    notes: string;
    customerName: string;
    customerPhone: string;
  }) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const { data: staff } = await supabase
        .from('staff')
        .select('id')
        .eq('id_code', session.idCode)
        .single();

      let finalCustomerId = customerId;

      // Auto-create customer from appointment data if no customer linked
      if (!finalCustomerId && data.serviceData.customer_name && data.serviceData.phone) {
        const phoneNormalized = normalizePhone(data.serviceData.phone);

        // Try to find existing customer by phone
        const { data: existing } = await supabase
          .from('customers')
          .select('id')
          .eq('phone_normalized', phoneNormalized)
          .maybeSingle();

        if (existing) {
          finalCustomerId = existing.id;
          // Update their last_vehicle_text
          await supabase
            .from('customers')
            .update({ last_vehicle_text: data.vehicle })
            .eq('id', existing.id);
        } else {
          // Create new customer
          const { data: newCustomer } = await supabase
            .from('customers')
            .insert({
              name: data.serviceData.customer_name,
              phone_raw: data.serviceData.phone,
              phone_normalized: phoneNormalized,
              last_vehicle_text: data.vehicle,
            })
            .select('id')
            .single();
          if (newCustomer) finalCustomerId = newCustomer.id;
        }
      }

      const { data: ticket, error } = await supabase
        .from('tickets')
        .insert({
          service_type: selectedService,
          priority: data.priority,
          vehicle: data.vehicle,
          service_data: data.serviceData,
          notes: data.notes,
          scheduled_time: data.scheduledTime,
          customer_name: data.customerName,
          customer_phone: data.customerPhone,
          created_by: staff?.id,
          customer_id: finalCustomerId || null,
        })
        .select('ticket_number')
        .single();

      if (error) throw error;

      // Update customer's last_vehicle_text if we have a linked customer
      if (finalCustomerId && !data.serviceData.customer_name) {
        await supabase
          .from('customers')
          .update({ last_vehicle_text: data.vehicle })
          .eq('id', finalCustomerId);
      }

      // Show success toast
      setToastMessage(`Ticket #${ticket.ticket_number} created!`);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
      setSelectedService(null);
      // Clear customer if it came from query params
      if (searchParams.get('customer_id')) {
        handleRemoveCustomer();
      }
    } catch (error) {
      console.error('Error creating ticket:', error);
      alert('Failed to create ticket. Please try again.');
    } finally {
      setSubmitting(false);
    }
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
                <h1 className="text-2xl font-bold">Create Ticket</h1>
                <p className="text-sm text-sky-100">Logged in as {session.name}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="bg-white text-sky-600 px-4 py-2 rounded-lg font-semibold hover:bg-sky-50 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Customer Banner */}
          {customerName && (
            <div className="mb-4 bg-sky-50 border border-sky-200 rounded-lg p-3 flex items-center justify-between">
              <div>
                <span className="text-sky-800 font-semibold">
                  Customer: {customerName}
                </span>
                {customerPhone && (
                  <span className="text-sky-600 ml-2 text-sm">
                    ({formatPhone(customerPhone)})
                  </span>
                )}
              </div>
              <button
                onClick={handleRemoveCustomer}
                className="text-sky-600 text-sm hover:underline"
              >
                Remove
              </button>
            </div>
          )}

          <div className="card">
            {!selectedService ? (
              <ServicePicker
                selectedService={selectedService}
                onSelect={setSelectedService}
              />
            ) : (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-gray-800">
                    {selectedService.replace(/_/g, ' ')}
                  </h2>
                  <button
                    onClick={() => setSelectedService(null)}
                    className="text-gray-600 hover:text-gray-800 font-semibold"
                  >
                    ← Change Service
                  </button>
                </div>
                <DynamicServiceForm
                  serviceType={selectedService}
                  onSubmit={handleSubmit}
                  onCancel={() => setSelectedService(null)}
                />
              </div>
              <DynamicServiceForm
                serviceType={selectedService}
                onSubmit={handleSubmit}
                onCancel={() => setSelectedService(null)}
              />
            </div>
          )}
        </div>
      </main>

      {showToast && (
        <div className="fixed top-4 right-4 z-50 toast-enter">
          <div className="bg-green-600 text-white px-6 py-4 rounded-lg shadow-xl flex items-center space-x-3">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="font-semibold">{toastMessage}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function IntakePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="spinner"></div></div>}>
      <IntakeContent />
    </Suspense>
  );
}
