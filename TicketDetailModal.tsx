'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { ActiveQueueItem, Technician } from '@/lib/types';
import { SERVICE_TYPE_LABELS, PRIORITY_LABELS } from '@/lib/types';
import { formatDateTime, getServiceDataText } from '@/lib/utils';

interface TicketDetailModalProps {
  ticket: ActiveQueueItem;
  onClose: () => void;
  onComplete: () => void;
}

export default function TicketDetailModal({
  ticket,
  onClose,
  onComplete,
}: TicketDetailModalProps) {
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [selectedTech, setSelectedTech] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadTechnicians();
  }, []);

  const loadTechnicians = async () => {
    const { data } = await supabase
      .from('technicians')
      .select('*')
      .eq('active', true)
      .order('name');
    if (data) setTechnicians(data);
  };

  const handleComplete = async () => {
    if (!selectedTech) {
      alert('Please select a technician');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase
        .from('tickets')
        .update({
          status: 'COMPLETED',
          completed_by: selectedTech,
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
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-800">
            Ticket #{ticket.ticket_number}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">
            ✕
          </button>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-lg font-semibold text-sky-600">
              {SERVICE_TYPE_LABELS[ticket.service_type]}
            </span>
            <span className={`px-3 py-1 rounded-full text-sm font-bold ${
              ticket.priority === 'HIGH'
                ? 'bg-red-100 text-red-900'
                : ticket.priority === 'NORMAL'
                ? 'bg-gray-100 text-gray-900'
                : 'bg-blue-100 text-blue-900'
            }`}>
              {PRIORITY_LABELS[ticket.priority]}
            </span>
          </div>

          <div>
            <p className="text-sm text-gray-600 font-semibold mb-2">VEHICLE</p>
            <p className="text-xl font-semibold text-gray-800">{ticket.vehicle}</p>
          </div>

          <div>
            <p className="text-sm text-gray-600 font-semibold mb-2">SERVICE DETAILS</p>
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-lg">
                {getServiceDataText(ticket.service_type, ticket.service_data)}
              </p>
            </div>
          </div>

          {ticket.notes && (
            <div>
              <p className="text-sm text-gray-600 font-semibold mb-2">NOTES</p>
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
                <p className="text-gray-800">{ticket.notes}</p>
              </div>
            </div>
          )}

          <div className="border-t pt-6">
            <label className="label">Completed By</label>
            <select
              value={selectedTech}
              onChange={(e) => setSelectedTech(e.target.value)}
              className="input"
            >
              <option value="">Select Technician</option>
              {technicians.map((tech) => (
                <option key={tech.id} value={tech.id}>{tech.name}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-4">
            <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button
              onClick={handleComplete}
              disabled={loading || !selectedTech}
              className="btn-success flex-1 text-xl"
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <span className="spinner mr-3"></span>
                  Completing...
                </span>
              ) : (
                '✓ Complete Job'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
