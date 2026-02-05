'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { StaffRole } from '@/lib/types';

interface TechWithStaff {
  id: string;
  staff_id: string | null;
  name: string;
  active: boolean;
  created_at: string;
  staff?: {
    id: string;
    id_code: string;
    role: StaffRole;
  } | null;
}

export default function TechnicianManager() {
  const [technicians, setTechnicians] = useState<TechWithStaff[]>([]);
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<StaffRole>('TECHNICIAN');
  const [newIdCode, setNewIdCode] = useState('');
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editIdCode, setEditIdCode] = useState('');

  useEffect(() => {
    loadTechnicians();
    generateIdCode('TECHNICIAN').then(setNewIdCode);
  }, []);

  const loadTechnicians = async () => {
    const { data } = await supabase
      .from('technicians')
      .select('*, staff:staff_id(id, id_code, role)')
      .order('name');
    if (data) setTechnicians(data as TechWithStaff[]);
  };

  const generateIdCode = async (role: string) => {
    const prefix = role === 'TECHNICIAN' ? 'T' : role === 'SERVICE_WRITER' ? 'SW' : 'M';
    const { data: existing } = await supabase
      .from('staff')
      .select('id_code')
      .like('id_code', `${prefix}%`);
    const num = (existing?.length || 0) + 1;
    return `${prefix}${String(num).padStart(2, '0')}`;
  };

  const handleRoleChange = async (role: StaffRole) => {
    setNewRole(role);
    const code = await generateIdCode(role);
    setNewIdCode(code);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newIdCode.trim()) return;
    setAdding(true);
    try {
      // Create staff record first
      const { data: staffRecord, error: staffError } = await supabase
        .from('staff')
        .insert({
          name: newName.trim(),
          role: newRole,
          id_code: newIdCode.trim(),
          active: true,
        })
        .select('id')
        .single();
      if (staffError) throw staffError;

      // Create technician record linked to staff
      const { error: techError } = await supabase
        .from('technicians')
        .insert({
          name: newName.trim(),
          staff_id: staffRecord.id,
          active: true,
        });
      if (techError) throw techError;

      setNewName('');
      setNewRole('TECHNICIAN');
      const code = await generateIdCode('TECHNICIAN');
      setNewIdCode(code);
      loadTechnicians();
    } catch (error: any) {
      console.error('Error adding staff member:', error);
      alert(error.message || 'Failed to add staff member');
    } finally {
      setAdding(false);
    }
  };

  const handleSaveIdCode = async (staffId: string) => {
    if (!editIdCode.trim()) return;
    try {
      const { error } = await supabase
        .from('staff')
        .update({ id_code: editIdCode.trim() })
        .eq('id', staffId);
      if (error) throw error;
      setEditingId(null);
      loadTechnicians();
    } catch (error: any) {
      console.error('Error updating ID code:', error);
      alert(error.message || 'Failed to update ID code');
    }
  };

  const handleToggleActive = async (tech: TechWithStaff) => {
    try {
      const newActive = !tech.active;
      const { error: techError } = await supabase
        .from('technicians')
        .update({ active: newActive })
        .eq('id', tech.id);
      if (techError) throw techError;

      if (tech.staff_id) {
        await supabase
          .from('staff')
          .update({ active: newActive })
          .eq('id', tech.staff_id);
      }
      loadTechnicians();
    } catch (error) {
      console.error('Error toggling technician:', error);
      alert('Failed to update technician status.');
    }
  };

  const handleDelete = async (tech: TechWithStaff) => {
    if (!confirm(`Deactivate ${tech.name}? They will no longer appear in active lists.`)) return;
    try {
      const { error: techError } = await supabase
        .from('technicians')
        .update({ active: false })
        .eq('id', tech.id);
      if (techError) throw techError;

      if (tech.staff_id) {
        await supabase
          .from('staff')
          .update({ active: false })
          .eq('id', tech.staff_id);
      }
      loadTechnicians();
    } catch (error) {
      console.error('Error deactivating technician:', error);
      alert('Failed to deactivate technician');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Manage Technicians</h2>
        <p className="text-gray-600 mb-6">
          Add, edit, or deactivate staff members who use the system.
        </p>
      </div>

      {/* Add New */}
      <form onSubmit={handleAdd} className="bg-gray-50 rounded-lg p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Name"
            className="input"
          />
          <select
            value={newRole}
            onChange={(e) => handleRoleChange(e.target.value as StaffRole)}
            className="input"
          >
            <option value="TECHNICIAN">Technician</option>
            <option value="SERVICE_WRITER">Service Writer</option>
            <option value="MANAGER">Manager</option>
          </select>
          <input
            type="text"
            value={newIdCode}
            onChange={(e) => setNewIdCode(e.target.value)}
            placeholder="ID Code (e.g. T04)"
            className="input"
          />
        </div>
        <button
          type="submit"
          disabled={adding || !newName.trim() || !newIdCode.trim()}
          className="btn-primary"
        >
          {adding ? 'Adding...' : '+ Add Staff Member'}
        </button>
      </form>

      {/* List */}
      <div className="space-y-3">
        {technicians.length === 0 ? (
          <p className="text-center text-gray-500 py-8">No staff members yet. Add one above.</p>
        ) : (
          technicians.map((tech) => (
            <div
              key={tech.id}
              className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border ${
                tech.active ? 'bg-white border-gray-200' : 'bg-gray-100 border-gray-300 opacity-60'
              }`}
            >
              <div className="flex items-center space-x-4">
                <div
                  className={`w-3 h-3 rounded-full ${
                    tech.active ? 'bg-green-500' : 'bg-gray-400'
                  }`}
                />
                <div>
                  <p className={`text-lg font-semibold ${tech.active ? 'text-gray-800' : 'text-gray-500'}`}>
                    {tech.name}
                  </p>
                  <div className="flex items-center gap-2">
                    {editingId === tech.id && tech.staff_id ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          value={editIdCode}
                          onChange={(e) => setEditIdCode(e.target.value)}
                          className="border rounded px-2 py-0.5 text-sm w-20"
                          autoFocus
                        />
                        <button
                          onClick={() => handleSaveIdCode(tech.staff_id!)}
                          className="text-green-600 text-sm font-semibold"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="text-gray-400 text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className="text-sm text-gray-500">
                          {tech.staff?.id_code || 'No ID'} · {tech.staff?.role?.replace('_', ' ') || 'TECHNICIAN'} · {tech.active ? 'Active' : 'Inactive'}
                        </span>
                        {tech.staff_id && (
                          <button
                            onClick={() => {
                              setEditingId(tech.id);
                              setEditIdCode(tech.staff?.id_code || '');
                            }}
                            className="text-sky-500 text-xs hover:underline"
                          >
                            Edit Code
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleToggleActive(tech)}
                  className={`
                    px-4 py-2 rounded-lg font-semibold transition-colors
                    ${
                      tech.active
                        ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                        : 'bg-green-100 text-green-800 hover:bg-green-200'
                    }
                  `}
                >
                  {tech.active ? 'Deactivate' : 'Activate'}
                </button>
                {tech.active && (
                  <button
                    onClick={() => handleDelete(tech)}
                    className="px-4 py-2 bg-red-100 text-red-800 hover:bg-red-200 rounded-lg font-semibold transition-colors"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
