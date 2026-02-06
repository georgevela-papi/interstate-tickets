'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { SERVICE_LABELS, SERVICE_ICONS } from '@/lib/utils';

interface CompletedTicket {
  id: string;
  ticket_number: number;
  service_type: string;
  vehicle: string;
  customer_name: string | null;
  customer_phone: string | null;
  notes: string | null;
  completed_at: string;
  created_at: string;
  completed_by: string | null;
  technician_name?: string;
  excluded_from_metrics: boolean;
}

interface EditState {
  customer_name: string;
  vehicle: string;
  notes: string;
  completed_at_date: string;
  completed_at_time: string;
}

export default function CompletedJobsManager() {
  const [tickets, setTickets] = useState<CompletedTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    loadCompleted();
  }, []);

  const loadCompleted = async () => {
    const { data, error } = await supabase
      .from('tickets')
      .select('id, ticket_number, service_type, vehicle, customer_name, customer_phone, notes, completed_at, created_at, completed_by, excluded_from_metrics')
      .eq('status', 'COMPLETED')
      .order('completed_at', { ascending: false })
      .limit(50);

    if (!error && data) {
      const techIds = data.filter((t) => t.completed_by).map((t) => t.completed_by);
      let techMap: Record<string, string> = {};
      if (techIds.length > 0) {
        const { data: techs } = await supabase
          .from('technicians')
          .select('id, name')
          .in('id', techIds);
        if (techs) {
          techMap = Object.fromEntries(techs.map((t) => [t.id, t.name]));
        }
      }

      setTickets(
        data.map((t) => ({
          ...t,
          technician_name: t.completed_by ? techMap[t.completed_by] || 'Unknown' : undefined,
        }))
      );
    }
    setLoading(false);
  };

  const handleToggleExclude = async (id: string, currentExcluded: boolean) => {
    await supabase.from('tickets').update({ excluded_from_metrics: !currentExcluded }).eq('id', id);
    loadCompleted();
  };

  const startEdit = (ticket: CompletedTicket) => {
    const dt = new Date(ticket.completed_at);
    setEditingId(ticket.id);
    setEditState({
      customer_name: ticket.customer_name || '',
      vehicle: ticket.vehicle || '',
      notes: ticket.notes || '',
      completed_at_date: dt.toISOString().slice(0, 10),
      completed_at_time: dt.toTimeString().slice(0, 5),
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditState(null);
  };

  const saveEdit = async () => {
    if (!editingId || !editState) return;
    setSaving(true);

    const completedAt = new Date(`${editState.completed_at_date}T${editState.completed_at_time}:00`).toISOString();

    await supabase
      .from('tickets')
      .update({
        customer_name: editState.customer_name || null,
        vehicle: editState.vehicle,
        notes: editState.notes || null,
        completed_at: completedAt,
      })
      .eq('id', editingId);

    setSaving(false);
    cancelEdit();
    loadCompleted();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('tickets').delete().eq('id', id);
    setDeleteConfirmId(null);
    loadCompleted();
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-800 mb-1">Completed Jobs</h2>
      <p className="text-gray-500 mb-6 text-sm">
        Edit job details, exclude test tickets from metrics, or delete records.
      </p>

      {tickets.length === 0 ? (
        <p className="text-center text-gray-400 py-12">No completed tickets yet.</p>
      ) : (
        <div className="space-y-3">
          {tickets.map((t) => (
            <div
              key={t.id}
              className={`card ${t.excluded_from_metrics ? 'opacity-50' : ''}`}
            >
              {/* Edit Mode */}
              {editingId === t.id && editState ? (
                <div className="space-y-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <span>{SERVICE_ICONS[t.service_type as keyof typeof SERVICE_ICONS]}</span>
                    <span className="font-bold text-gray-800">#{t.ticket_number}</span>
                    <span className="text-gray-600">
                      {SERVICE_LABELS[t.service_type as keyof typeof SERVICE_LABELS]}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Customer Name</label>
                      <input
                        type="text"
                        value={editState.customer_name}
                        onChange={(e) => setEditState({ ...editState, customer_name: e.target.value })}
                        className="input-field w-full"
                        placeholder="Customer name"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Vehicle</label>
                      <input
                        type="text"
                        value={editState.vehicle}
                        onChange={(e) => setEditState({ ...editState, vehicle: e.target.value })}
                        className="input-field w-full"
                        placeholder="Year Make Model"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Completed Date</label>
                      <input
                        type="date"
                        value={editState.completed_at_date}
                        onChange={(e) => setEditState({ ...editState, completed_at_date: e.target.value })}
                        className="input-field w-full"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Completed Time</label>
                      <input
                        type="time"
                        value={editState.completed_at_time}
                        onChange={(e) => setEditState({ ...editState, completed_at_time: e.target.value })}
                        className="input-field w-full"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Notes</label>
                    <textarea
                      value={editState.notes}
                      onChange={(e) => setEditState({ ...editState, notes: e.target.value })}
                      className="input-field w-full"
                      rows={2}
                      placeholder="Notes..."
                    />
                  </div>

                  <div className="flex justify-end space-x-2 pt-1">
                    <button
                      onClick={cancelEdit}
                      className="px-4 py-2 rounded-lg text-sm font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={saveEdit}
                      disabled={saving}
                      className="px-4 py-2 rounded-lg text-sm font-semibold bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </div>
              ) : (
                /* View Mode */
                <div>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <span>{SERVICE_ICONS[t.service_type as keyof typeof SERVICE_ICONS]}</span>
                        <span className="font-bold text-gray-800">#{t.ticket_number}</span>
                        <span className="text-gray-600">
                          {SERVICE_LABELS[t.service_type as keyof typeof SERVICE_LABELS]}
                        </span>
                      </div>
                      {t.customer_name && (
                        <p className="text-gray-700 mt-1 font-medium">{t.customer_name}</p>
                      )}
                      <p className="text-gray-700 mt-0.5">{t.vehicle}</p>
                      {t.notes && (
                        <p className="text-gray-500 text-sm mt-0.5 italic">{t.notes}</p>
                      )}
                      <p className="text-sm text-gray-400 mt-1">
                        {t.technician_name && `Completed by ${t.technician_name} · `}
                        {new Date(t.completed_at).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-100">
                    <button
                      onClick={() => startEdit(t)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-sky-50 text-sky-700 hover:bg-sky-100"
                    >
                      ✏️ Edit
                    </button>
                    <button
                      onClick={() => handleToggleExclude(t.id, t.excluded_from_metrics)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                        t.excluded_from_metrics
                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {t.excluded_from_metrics ? '✅ Include in Metrics' : '⊘ Exclude from Metrics'}
                    </button>

                    {deleteConfirmId === t.id ? (
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-red-600 font-semibold">Delete this ticket?</span>
                        <button
                          onClick={() => handleDelete(t.id)}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-600 text-white hover:bg-red-700"
                        >
                          Yes, Delete
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(null)}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirmId(t.id)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-50 text-red-600 hover:bg-red-100"
                      >
                        🗑️ Delete
                      </button>
                    )}
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
