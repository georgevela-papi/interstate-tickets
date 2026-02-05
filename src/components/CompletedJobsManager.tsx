'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { ServiceType, PriorityLevel } from '@/lib/types';
import { SERVICE_TYPE_LABELS, PRIORITY_LABELS } from '@/lib/types';
import { formatDateTime } from '@/lib/utils';

interface CompletedTicket {
  id: string;
  ticket_number: number;
  service_type: ServiceType;
  priority: PriorityLevel;
  vehicle: string;
  notes: string | null;
  completed_at: string | null;
  created_at: string;
  completed_by: string | null;
  excluded_from_metrics: boolean;
  technician_name?: string;
  customer_name: string | null;
}

export default function CompletedJobsManager() {
  const [tickets, setTickets] = useState<CompletedTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editVehicle, setEditVehicle] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editCustomerName, setEditCustomerName] = useState('');
  const [editCompletedAt, setEditCompletedAt] = useState('');

  const loadTickets = useCallback(async () => {
    setLoading(true);
    try {
      const { data: completedTickets } = await supabase
        .from('tickets')
        .select('id, ticket_number, service_type, priority, vehicle, notes, completed_at, created_at, completed_by, excluded_from_metrics, customer_name')
        .eq('status', 'COMPLETED')
        .order('completed_at', { ascending: false })
        .limit(100);

      const { data: technicians } = await supabase
        .from('technicians')
        .select('id, name');

      const techMap = new Map<string, string>();
      if (technicians) {
        technicians.forEach((t: { id: string; name: string }) => {
          techMap.set(t.id, t.name);
        });
      }

      const rows: CompletedTicket[] = (completedTickets || []).map((t: any) => ({
        ...t,
        excluded_from_metrics: t.excluded_from_metrics || false,
        technician_name: t.completed_by ? techMap.get(t.completed_by) || 'Unknown' : 'N/A',
        customer_name: t.customer_name || null,
      }));

      setTickets(rows);
    } catch (error) {
      console.error('Error loading completed tickets:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  const handleToggleExcluded = async (ticket: CompletedTicket) => {
    try {
      const { error } = await supabase
        .from('tickets')
        .update({ excluded_from_metrics: !ticket.excluded_from_metrics })
        .eq('id', ticket.id);
      if (error) throw error;
      setTickets((prev) =>
        prev.map((t) =>
          t.id === ticket.id ? { ...t, excluded_from_metrics: !t.excluded_from_metrics } : t
        )
      );
    } catch (error) {
      console.error('Error toggling exclusion:', error);
      alert('Failed to update ticket');
    }
  };

  const handleStartEdit = (ticket: CompletedTicket) => {
    setEditingId(ticket.id);
    setEditVehicle(ticket.vehicle);
    setEditNotes(ticket.notes || '');
    setEditCustomerName(ticket.customer_name || '');
    // Format datetime for datetime-local input (YYYY-MM-DDTHH:mm)
    if (ticket.completed_at) {
      const dt = new Date(ticket.completed_at);
      const formatted = dt.toISOString().slice(0, 16);
      setEditCompletedAt(formatted);
    } else {
      setEditCompletedAt('');
    }
  };

  const handleSaveEdit = async (ticketId: string) => {
    try {
      const { error } = await supabase
        .from('tickets')
        .update({
          vehicle: editVehicle.trim(),
          notes: editNotes.trim() || null,
          customer_name: editCustomerName.trim() || null,
          completed_at: editCompletedAt ? new Date(editCompletedAt).toISOString() : null,
        })
        .eq('id', ticketId);
      if (error) throw error;
      setEditingId(null);
      loadTickets();
    } catch (error) {
      console.error('Error updating ticket:', error);
      alert('Failed to update ticket');
    }
  };

  const handleDeleteTicket = async (ticket: CompletedTicket) => {
    if (!confirm(`Delete ticket #${ticket.ticket_number}? This cannot be undone.`)) return;
    try {
      const { error } = await supabase
        .from('tickets')
        .delete()
        .eq('id', ticket.id);
      if (error) throw error;
      setTickets((prev) => prev.filter((t) => t.id !== ticket.id));
    } catch (error) {
      console.error('Error deleting ticket:', error);
      alert('Failed to delete ticket');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-gray-800 mb-1">Completed Jobs</h2>
        <p className="text-gray-600 text-sm">
          Edit, delete, or exclude completed tickets from KPI metrics. Excluded tickets show with a strikethrough.
        </p>
      </div>

      {tickets.length === 0 ? (
        <div className="bg-white rounded-xl shadow p-8 text-center text-gray-500">
          <p className="text-lg font-medium">No completed jobs yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tickets.map((ticket) => (
            <div
              key={ticket.id}
              className={`bg-white rounded-lg shadow p-4 border-l-4 ${
                ticket.excluded_from_metrics
                  ? 'border-gray-300 opacity-60'
                  : 'border-green-500'
              }`}
            >
              {editingId === ticket.id ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <span className="font-bold text-gray-800">#{ticket.ticket_number}</span>
                    <span>{SERVICE_TYPE_LABELS[ticket.service_type]}</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Customer Name</label>
                      <input
                        type="text"
                        value={editCustomerName}
                        onChange={(e) => setEditCustomerName(e.target.value)}
                        className="input"
                        placeholder="Customer name"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Completed At</label>
                      <input
                        type="datetime-local"
                        value={editCompletedAt}
                        onChange={(e) => setEditCompletedAt(e.target.value)}
                        className="input"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Vehicle</label>
                    <input
                      type="text"
                      value={editVehicle}
                      onChange={(e) => setEditVehicle(e.target.value)}
                      className="input"
                      placeholder="Vehicle"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Notes</label>
                    <textarea
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      className="input min-h-[60px]"
                      placeholder="Notes (optional)"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSaveEdit(ticket.id)}
                      className="btn-primary text-sm"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="btn-secondary text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-gray-800">#{ticket.ticket_number}</span>
                      <span className={`text-sm px-2 py-0.5 rounded ${
                        ticket.priority === 'HIGH' ? 'bg-red-100 text-red-800' :
                        ticket.priority === 'LOW' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {PRIORITY_LABELS[ticket.priority]}
                      </span>
                      <span className="text-sm text-gray-500">
                        {SERVICE_TYPE_LABELS[ticket.service_type]}
                      </span>
                      {ticket.excluded_from_metrics && (
                        <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">
                          Excluded from KPIs
                        </span>
                      )}
                    </div>
                    <p className={`text-gray-700 ${ticket.excluded_from_metrics ? 'line-through' : ''}`}>
                      {ticket.customer_name && <span className="font-medium">{ticket.customer_name} — </span>}
                      {ticket.vehicle}
                    </p>
                    <p className="text-xs text-gray-400">
                      {ticket.technician_name} · {ticket.completed_at ? formatDateTime(ticket.completed_at) : 'N/A'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 ml-4 flex-shrink-0">
                    <button
                      onClick={() => handleToggleExcluded(ticket)}
                      className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
                        ticket.excluded_from_metrics
                          ? 'bg-green-100 text-green-800 hover:bg-green-200'
                          : 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                      }`}
                      title={ticket.excluded_from_metrics ? 'Include in KPIs' : 'Exclude from KPIs'}
                    >
                      {ticket.excluded_from_metrics ? 'Include' : 'Exclude'}
                    </button>
                    <button
                      onClick={() => handleStartEdit(ticket)}
                      className="px-3 py-1.5 rounded text-xs font-semibold bg-sky-100 text-sky-800 hover:bg-sky-200 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteTicket(ticket)}
                      className="px-3 py-1.5 rounded text-xs font-semibold bg-red-100 text-red-800 hover:bg-red-200 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
