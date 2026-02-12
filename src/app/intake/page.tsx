'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase, getSession, clearSession } from '@/lib/supabase';
import ServicePicker from '@/components/ServicePicker';
import DynamicServiceForm from '@/components/DynamicServiceForm';
import type { DbServiceType, DbServiceField } from '@/lib/types';
import { SERVICE_TYPE_LABELS, formatPhone } from '@/lib/types';
import { normalizePhone } from '@/lib/utils';
import Image from 'next/image';

function IntakeContent() {
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [session, setSession] = useState<any>(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState<string | null>(null);
  const [customerPhone, setCustomerPhone] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  // Dynamic service data from DB
  const [serviceTypes, setServiceTypes] = useState<DbServiceType[]>([]);
  const [serviceFields, setServiceFields] = useState<DbServiceField[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);

  useEffect(() => {
    const currentSession = getSession();
    if (!currentSession || !['SERVICE_WRITER', 'MANAGER'].includes(currentSession.role)) {
      router.push('/');
      return;
    }
    setSession(currentSession);
  }, [router]);

  // Fetch service_types and service_fields from the database
  useEffect(() => {
    async function loadServices() {
      try {
        const [typesRes, fieldsRes] = await Promise.all([
          supabase
            .from('service_types')
            .select('*')
            .eq('active', true)
            .order('display_order', { ascending: true }),
          supabase
            .from('service_fields')
            .select('*')
            .order('display_order', { ascending: true }),
        ]);

        if (typesRes.data && typesRes.data.length > 0) {
          setServiceTypes(typesRes.data);
        }
        if (fieldsRes.data) {
          setServiceFields(fieldsRes.data);
        }
      } catch (err) {
        console.error('Error loading services:', err);
      } finally {
        setLoadingServices(false);
      }
    }
    loadServices();
  }, []);

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

  const handleLogout = async () => {
    clearSession();
    await supabase.auth.signOut();
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith('sb-')) localStorage.removeItem(key);
    });
    router.push('/');
  };

  const handleRemoveCustomer = () => {
    setCustomerId(null);
    setCustomerName(null);
    setCustomerPhone(null);
    router.replace('/intake');
  };

  // Look up the DbServiceType record and its fields for the selected slug
  const selectedServiceRecord = serviceTypes.find((s) => s.slug === selectedService);
  const selectedServiceFields = selectedServiceRecord
    ? serviceFields.filter((f) => f.service_type_id === selectedServiceRecord.id)
    : [];

  // Build a display name for the selected service
  const selectedServiceName =
    selectedServiceRecord?.name ||
    SERVICE_TYPE_LABELS[selectedService || ''] ||
    (selectedService || '').replace(/_/g, ' ');

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

      // Auto-create customer from form data if no customer linked
      if (!finalCustomerId && data.customerName && data.customerPhone) {
        const phoneNormalized = normalizePhone(data.customerPhone);

        const { data: existing } = await supabase
          .from('customers')
          .select('id')
          .eq('phone_normalized', phoneNormalized)
          .maybeSingle();

        if (existing) {
          finalCustomerId = existing.id;
          await supabase
            .from('customers')
            .update({ last_vehicle_text: data.vehicle })
            .eq('id', existing.id);
        } else {
          const { data: newCustomer } = await supabase
            .from('customers')
            .insert({
              name: data.customerName,
              phone_raw: data.customerPhone,
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

      if (customerId && finalCustomerId === customerId) {
        await supabase
          .from('customers')
          .update({ last_vehicle_text: data.vehicle })
          .eq('id', finalCustomerId);
      }

      setToastMessage(`Ticket #${ticket.ticket_number} created!`);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
      setSelectedService(null);

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
            <div className="flex items-center space-x-2">
              <button
                onClick={() => router.push('/queue')}
                className="bg-white bg-opacity-20 hover:bg-opacity-30 text-white px-4 py-2 rounded-lg font-semibold transition-colors"
              >
                Queue
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
            {loadingServices ? (
              <div className="flex justify-center py-12">
                <div className="spinner"></div>
              </div>
            ) : !selectedService ? (
              <ServicePicker
                selectedService={selectedService}
                onSelect={setSelectedService}
                services={serviceTypes}
              />
            ) : (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-gray-800">
                    {selectedServiceName}
                  </h2>
                  <button
                    onClick={() => setSelectedService(null)}
                    className="text-gray-600 hover:text-gray-800 font-semibold"
                  >
                    â Change Service
                  </button>
                </div>
                <DynamicServiceForm
                  serviceType={selectedService}
                  serviceRecord={selectedServiceRecord}
                  dbFields={selectedServiceFields}
                  onSubmit={handleSubmit}
                  onCancel={() => setSelectedService(null)}
                />
              </div>
            )}
          </div>
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
