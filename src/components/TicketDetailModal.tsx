'use client';

import { useState } from 'react';
import { supabase, getSession } from '@/lib/supabase';
import type { ActiveQueueItem } from '@/lib/types';
import { SERVICE_TYPE_LABELS, PRIORITY_LABELS } from '@/lib/types';
import { formatDateTime, getServiceDataText } from '@/lib/utils';

function getServiceLabel(slug: string): string {
  return SERVICE_TYPE_LABELS[slug] || slug.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

interface TicketDetailModalProps {
  ticket: ActiveQueueItem;
  onClose: () => void;
  onComplete: () => void;
  canComplete?: boolean;
}

export default function TicketDetailModal({
  ticket,
  onClose,
  onComplete,
  canComplete = true,
}: TicketDetailModalProps) {
  const [loading, setLoading] = useState(false);
  const [confirmStep, setConfirmStep] = useState(false);

  const handleComplete = async () => {
    // First click shows confirmation, second click actually completes
    if (!confirmStep) {
      setConfirmStep(true);
      return;
    }

    setLoading(true);
    try {
      const session = getSession();
      if (!session) {
        alert('Session expired. Please log in again.');
        return;
      }

      const { data: staffData } = await supabase
        .from('staff')
        .select('id')
        .eq('id_code', session.idCode)
        .eq('active', true)
        .single();

      if (!staffData) {
        alert('Your account was not found or is inactive.');
        return;
      }

      const { data: techData } = await supabase
        .from('technicians')
        .select('id')
        .eq('staff_id', staffData.id)
        .eq('active', true)
        .single();

      if (!techData) {
        alert('No active technician profile found for your account.');
        return;
      }

      const { error } = await supabase
        .from('tickets')
        .update({
          status: 'COMPLETED',
          completed_by: techData.id,
          completed_at: new Date().toISOString(),
        })
        .eq('id', ticket.id);

      if (error) throw error;

      onComplete();
      onClose();
    } catch (error) {
      console.error('Error completing ticket:', error);
      alert('Failed to complete ticket. Please try again.');
    } finally {
      setLoading(false);
      setConfirmStep(false);
    }
  };

  const serviceDetailText = getServiceDataText(ticket.service_type, ticket.service_data);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content p-6" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-800">
            Ticket #{ticket.ticket_number}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none p-1">
            \u2715
          </button>
        </div>

        {/* Details */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-lg font-semibold text-sky-600">
              {getServiceLabel(ticket.service_type)}
            </span>
            <span
              className={`px-3 py-1 rounded-full text-sm font-bold ${
                ticket.priority === 'HIGH'
                  ? 'bg-red-100 text-red-900'
                  : ticket.priority === 'NORMAL'
                  ? 'bg-gray-100 text-gray-900'
                  : 'bg-blue-100 text-blue-900'
              }`}
            >
              {PRIORITY_LABELS[ticket.priority]}
            </span>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg space-y-2">
            <div>
              <span className="text-sm text-gray-500">Vehicle</span>
              <p className="font-semibold">{ticket.vehicle}</p>
            </div>

            {ticket.customer_name && (
              <div>
                <span className="text-sm text-gray-500">Customer</span>
                <p className="font-semibold">
                  {ticket.customer_name}
                  {ticket.customer_phone ? ` \u2022 ${ticket.customer_phone}` : ''}
                </p>
              </div>
            )}

            {serviceDetailText ? (
              <div>
                <span className="text-sm text-gray-500">Service Details</span>
                <p className="font-semibold">{serviceDetailText}</p>
              </div>
            ) : ticket.service_data && typeof ticket.service_data === 'object' && Object.keys(ticket.service_data).length > 0 ? (
              <div>
                <span className="text-sm text-gray-500">Service Details</span>
                <div className="mt-1 space-y-1">
                  {Object.entries(ticket.service_data).map(([key, value]) => (
                    <p key={key} className="font-semibold">
                      <span className="text-gray-600 capitalize">{key.replace(/_/g, ' ')}:</span>{' '}
                      {String(value)}
                    </p>
                  ))}
                </div>
              </div>
            ) : null}

            {ticket.notes && (
              <div>
                <span className="text-sm text-gray-500">Notes</span>
                <p className="font-semibold">{ticket.notes}</p>
              </div>
            )}

            {ticket.scheduled_time && (
              <div>
                <span className="text-sm text-gray-500">Scheduled</span>
                <p className="font-semibold">{formatDateTime(ticket.scheduled_time)}</p>
              </div>
            )}

            <div>
              <span className="text-sm text-gray-500">Created</span>
              <p className="font-semibold">{formatDateTime(ticket.created_at)}</p>
            </div>
          </div>

          {canComplete && (
            <div className="pt-4 space-y-3">
              {confirmStep ? (
                <div className="space-y-2">
                  <p className="text-center text-sm text-gray-600 font-medium">
                    Complete ticket #{ticket.ticket_number} for {ticket.customer_name || 'this customer'}?
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setConfirmStep(false)}
                      className="flex-1 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-lg font-bold transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleComplete}
                      disabled={loading}
                      className="flex-1 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg text-lg font-bold transition-colors"
                    >
                      {loading ? (
                        <span className="flex items-center justify-center">
                          <span className="spinner mr-3"></span>
                          Completing...
                        </span>
                      ) : (
                        'Yes, Complete'
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={handleComplete}
                  className="w-full py-4 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xl font-bold transition-colors"
                >
                  \u2713 Complete Job
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
