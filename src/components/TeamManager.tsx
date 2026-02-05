'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

// ── TEAM MANAGEMENT ──
// Unified component managing both Technicians and Front Desk (SERVICE_WRITER) users.
// Replaces the old TechnicianManager component.
//
// Key differences from TechnicianManager:
// - Adds a role picker when creating new team members
// - Front Desk users only get a `staff` record (no `technicians` row)
// - Technicians get both `staff` + `technicians` rows (unchanged behavior)
// - List shows a role badge (Technician / Front Desk) on each member
// - Activate/deactivate works the same for both roles

type TeamRole = 'TECHNICIAN' | 'SERVICE_WRITER';

interface TeamMember {
  id: string;            // staff.id for front desk, technician.id for techs
  staff_id: string;      // staff.id (always present)
  technician_id: string | null; // technician.id if role=TECHNICIAN, null for front desk
  name: string;
  role: TeamRole;
  active: boolean;
  id_code: string;
}

interface TeamManagerProps {
  members: TeamMember[];
  onUpdate: () => void;
}

const ROLE_LABELS: Record<TeamRole, string> = {
  TECHNICIAN: 'Technician',
  SERVICE_WRITER: 'Front Desk',
};

export type { TeamMember };

export default function TeamManager({ members, onUpdate }: TeamManagerProps) {
  const [newName, setNewName] = useState('');
  const [newIdCode, setNewIdCode] = useState('');
  const [newRole, setNewRole] = useState<TeamRole>('TECHNICIAN');
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editIdCode, setEditIdCode] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // ── CREATE ──
  const handleAdd = async () => {
    if (!newName.trim() || !newIdCode.trim()) {
      alert('Name and ID Code are required');
      return;
    }

    setAdding(true);
    try {
      // Check if id_code already exists across ALL roles
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

      // Create staff record (same for both roles)
      const { data: staff, error: staffError } = await supabase
        .from('staff')
        .insert({
          id_code: newIdCode.toUpperCase(),
          name: newName.trim(),
          role: newRole,
        })
        .select()
        .single();

      if (staffError) throw staffError;

      // Technicians also need a row in the `technicians` table
      if (newRole === 'TECHNICIAN') {
        const { error: techError } = await supabase
          .from('technicians')
          .insert({
            staff_id: staff.id,
            name: newName.trim(),
          });

        if (techError) throw techError;
      }

      setNewName('');
      setNewIdCode('');
      onUpdate();
    } catch (error) {
      console.error('Error adding team member:', error);
      alert('Failed to add team member.');
    } finally {
      setAdding(false);
    }
  };

  // ── ACTIVATE / DEACTIVATE ──
  const handleToggleActive = async (member: TeamMember) => {
    try {
      const newActive = !member.active;

      // Always update staff (controls login)
      const { error: staffError } = await supabase
        .from('staff')
        .update({ active: newActive })
        .eq('id', member.staff_id);

      if (staffError) throw staffError;

      // Also update technicians table if this is a tech
      if (member.technician_id) {
        const { error: techError } = await supabase
          .from('technicians')
          .update({ active: newActive })
          .eq('id', member.technician_id);

        if (techError) throw techError;
      }

      onUpdate();
    } catch (error) {
      console.error('Error toggling team member:', error);
      alert('Failed to update status.');
    }
  };

  // ── SOFT DELETE (deactivate) ──
  const handleDelete = async (member: TeamMember) => {
    if (!confirm(`Deactivate ${member.name}? They will no longer be able to log in.`)) {
      return;
    }

    try {
      const { error: staffError } = await supabase
        .from('staff')
        .update({ active: false })
        .eq('id', member.staff_id);

      if (staffError) throw staffError;

      if (member.technician_id) {
        const { error: techError } = await supabase
          .from('technicians')
          .update({ active: false })
          .eq('id', member.technician_id);

        if (techError) throw techError;
      }

      onUpdate();
    } catch (error) {
      console.error('Error deleting team member:', error);
      alert('Failed to deactivate team member.');
    }
  };

  // ── EDIT ID CODE ──
  const handleStartEdit = (memberId: string, currentCode: string) => {
    setEditingId(memberId);
    setEditIdCode(currentCode);
  };

  const handleSaveIdCode = async (staffId: string) => {
    if (!editIdCode.trim()) {
      alert('ID Code cannot be empty');
      return;
    }

    setSavingEdit(true);
    try {
      // Check uniqueness across all roles
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

  // Unique key for each member row
  const memberKey = (m: TeamMember) => `${m.role}-${m.id}`;

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-800 mb-6">Team</h2>

      {/* ── Add New Member ── */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Name"
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
        {/* Role picker */}
        <select
          value={newRole}
          onChange={(e) => setNewRole(e.target.value as TeamRole)}
          className="input w-full sm:w-44"
        >
          <option value="TECHNICIAN">Technician</option>
          <option value="SERVICE_WRITER">Front Desk</option>
        </select>
        <button
          onClick={handleAdd}
          disabled={adding || !newName.trim() || !newIdCode.trim()}
          className="btn-primary whitespace-nowrap disabled:opacity-50"
        >
          {adding ? 'Adding...' : '+ Add Member'}
        </button>
      </div>

      {/* ── Member List ── */}
      <div className="space-y-3">
        {members.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No team members configured yet.</p>
        ) : (
          members.map((member) => (
            <div
              key={memberKey(member)}
              className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border ${
                member.active ? 'bg-white border-gray-200' : 'bg-gray-100 border-gray-300 opacity-60'
              }`}
            >
              <div className="mb-3 sm:mb-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-gray-800">{member.name}</p>
                  {/* Role badge */}
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    member.role === 'TECHNICIAN'
                      ? 'bg-sky-100 text-sky-800'
                      : 'bg-purple-100 text-purple-800'
                  }`}>
                    {ROLE_LABELS[member.role]}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  {editingId === member.id ? (
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
                        onClick={() => handleSaveIdCode(member.staff_id)}
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
                      <span className="text-sm text-gray-500">Code: {member.id_code}</span>
                      <button
                        onClick={() => handleStartEdit(member.id, member.id_code)}
                        className="text-xs text-sky-600 hover:text-sky-800 font-semibold"
                      >
                        Edit
                      </button>
                    </>
                  )}
                  <span className={`text-xs px-2 py-0.5 rounded-full ${member.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {member.active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleToggleActive(member)}
                  className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                    member.active
                      ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                      : 'bg-green-100 text-green-800 hover:bg-green-200'
                  }`}
                >
                  {member.active ? 'Deactivate' : 'Activate'}
                </button>
                <button
                  onClick={() => handleDelete(member)}
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
