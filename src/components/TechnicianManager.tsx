'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

interface StaffTech {
  id: string;         // technician.id
  staff_id: string;
  name: string;
  active: boolean;
  id_code: string;    // from staff table
}

interface TechnicianManagerProps {
  technicians: StaffTech[];
  onUpdate: () => void;
}

export default function TechnicianManager({ technicians, onUpdate }: TechnicianManagerProps) {
  const [newName, setNewName] = useState('');
  const [newIdCode, setNewIdCode] = useState('');
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editIdCode, setEditIdCode] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const handleAdd = async () => {
    if (!newName.trim() || !newIdCode.trim()) {
      alert('Name and ID Code are required');
      return;
    }

    setAdding(true);
    try {
      // Check if id_code already exists
      const { data: existing } = await supabase
        .from('staff')
        .select('id')
        .eq('id_code', newIdCode.toUpperCase())
        .maybeSingle();

      if (existing) {
        alert(`ID Code "${newIdCode.toUpperCase()}" is already in use.`);
        setAdding(false);
        return;
      }

      // Create staff record
      const { data: staff, error: staffError } = await supabase
        .from('staff')
        .insert({
          id_code: newIdCode.toUpperCase(),
          name: newName.trim(),
          role: 'TECHNICIAN',
        })
        .select()
        .single();

      if (staffError) throw staffError;

      // Create technician record linked to staff
      const { error: techError } = await supabase
        .from('technicians')
        .insert({
          staff_id: staff.id,
          name: newName.trim(),
        });

      if (techError) throw techError;

      setNewName('');
      setNewIdCode('');
      onUpdate();
    } catch (error) {
      console.error('Error adding technician:', error);
      alert('Failed to add technician.');
    } finally {
      setAdding(false);
    }
  };

  // FIX 3B: Soft delete — set active = false on both staff and technician
  const handleToggleActive = async (techId: string, staffId: string, currentlyActive: boolean) => {
    try {
      const newActive = !currentlyActive;

      // Update technician
      const { error: techError } = await supabase
        .from('technicians')
        .update({ active: newActive })
        .eq('id', techId);

      if (techError) throw techError;

      // Update staff (so login is blocked too) — FIX 2B
      if (staffId) {
        const { error: staffError } = await supabase
          .from('staff')
          .update({ active: newActive })
          .eq('id', staffId);

        if (staffError) throw staffError;
      }

      onUpdate();
    } catch (error) {
      console.error('Error toggling technician:', error);
      alert('Failed to update technician status.');
    }
  };

  // FIX 3B: "Delete" performs soft delete (deactivate) to preserve history
  const handleDelete = async (techId: string, staffId: string, name: string) => {
    if (!confirm(`Deactivate ${name}? They will no longer be able to log in. Historical job data will be preserved.`)) {
      return;
    }

    try {
      // Soft delete: set active = false
      const { error: techError } = await supabase
        .from('technicians')
        .update({ active: false })
        .eq('id', techId);

      if (techError) throw techError;

      if (staffId) {
        const { error: staffError } = await supabase
          .from('staff')
          .update({ active: false })
          .eq('id', staffId);

        if (staffError) throw staffError;
      }

      onUpdate();
    } catch (error) {
      console.error('Error deleting technician:', error);
      alert('Failed to delete technician.');
    }
  };

  // FIX 3A: Edit ID Code
  const handleStartEdit = (techId: string, currentCode: string) => {
    setEditingId(techId);
    setEditIdCode(currentCode);
  };

  const handleSaveIdCode = async (staffId: string) => {
    if (!editIdCode.trim()) {
      alert('ID Code cannot be empty');
      return;
    }

    setSavingEdit(true);
    try {
      // Check uniqueness
      const { data: existing } = await supabase
        .from('staff')
        .select('id')
        .eq('id_code', editIdCode.toUpperCase())
        .neq('id', staffId)
        .maybeSingle();

      if (existing) {
        alert(`ID Code "${editIdCode.toUpperCase()}" is already in use.`);
        setSavingEdit(false);
        return;
      }

      const { error } = await supabase
        .from('staff')
        .update({ id_code: editIdCode.toUpperCase() })
        .eq('id', staffId);

      if (error) throw error;

      setEditingId(null);
      setEditIdCode('');
      onUpdate();
    } catch (error) {
      console.error('Error updating ID code:', error);
      alert('Failed to update ID code.');
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-800 mb-6">Manage Technicians</h2>

      {/* Add New */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Technician name"
          className="input flex-1"
          maxLength={50}
        />
        <input
          type="text"
          value={newIdCode}
          onChange={(e) => setNewIdCode(e.target.value.toUpperCase())}
          placeholder="ID Code (e.g. T04)"
          className="input w-full sm:w-40"
          maxLength={10}
        />
        <button
          onClick={handleAdd}
          disabled={adding || !newName.trim() || !newIdCode.trim()}
          className="btn-primary whitespace-nowrap disabled:opacity-50"
        >
          {adding ? 'Adding...' : '+ Add Technician'}
        </button>
      </div>

      {/* List */}
      <div className="space-y-3">
        {technicians.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No technicians configured yet.</p>
        ) : (
          technicians.map((tech) => (
            <div
              key={tech.id}
              className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border ${
                tech.active ? 'bg-white border-gray-200' : 'bg-gray-100 border-gray-300 opacity-60'
              }`}
            >
              <div className="mb-3 sm:mb-0">
                <p className="font-semibold text-gray-800">{tech.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  {editingId === tech.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={editIdCode}
                        onChange={(e) => setEditIdCode(e.target.value.toUpperCase())}
                        className="input w-28 text-sm py-1"
                        maxLength={10}
                        autoFocus
                      />
                      <button
                        onClick={() => handleSaveIdCode(tech.staff_id)}
                        disabled={savingEdit}
                        className="text-sm text-green-600 hover:text-green-800 font-semibold"
                      >
                        {savingEdit ? '...' : 'Save'}
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="text-sm text-gray-500 hover:text-gray-700"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className="text-sm text-gray-500">Code: {tech.id_code}</span>
                      <button
                        onClick={() => handleStartEdit(tech.id, tech.id_code)}
                        className="text-xs text-sky-600 hover:text-sky-800 font-semibold"
                      >
                        Edit
                      </button>
                    </>
                  )}
                  <span className={`text-xs px-2 py-0.5 rounded-full ${tech.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {tech.active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleToggleActive(tech.id, tech.staff_id, tech.active)}
                  className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                    tech.active
                      ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                      : 'bg-green-100 text-green-800 hover:bg-green-200'
                  }`}
                >
                  {tech.active ? 'Deactivate' : 'Activate'}
                </button>
                <button
                  onClick={() => handleDelete(tech.id, tech.staff_id, tech.name)}
                  className="px-4 py-2 bg-red-100 text-red-800 hover:bg-red-200 rounded-lg font-semibold transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
