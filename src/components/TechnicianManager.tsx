'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Technician } from '@/lib/types';

interface TechnicianManagerProps {
  technicians: Technician[];
  onUpdate: () => void;
}

export default function TechnicianManager({ technicians, onUpdate }: TechnicianManagerProps) {
  const [newTechName, setNewTechName] = useState('');
  const [adding, setAdding] = useState(false);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTechName.trim()) return;

    setAdding(true);
    try {
      const { error } = await supabase
        .from('technicians')
        .insert({
          name: newTechName.trim(),
          active: true,
        });

      if (error) throw error;

      setNewTechName('');
      onUpdate();
    } catch (error) {
      console.error('Error adding technician:', error);
      alert('Failed to add technician');
    } finally {
      setAdding(false);
    }
  };

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    try {
      const { error } = await supabase
        .from('technicians')
        .update({ active: !currentActive })
        .eq('id', id);

      if (error) throw error;
      onUpdate();
    } catch (error) {
      console.error('Error updating technician:', error);
      alert('Failed to update technician');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete ${name}?`)) return;

    try {
      const { error } = await supabase
        .from('technicians')
        .delete()
        .eq('id', id);

      if (error) throw error;
      onUpdate();
    } catch (error) {
      console.error('Error deleting technician:', error);
      alert('Failed to delete technician');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Manage Technicians</h2>
        <p className="text-gray-600 mb-6">
          Add, remove, or deactivate technicians who can complete jobs.
        </p>
      </div>

      {/* Add New Technician */}
      <form onSubmit={handleAdd} className="flex gap-3">
        <input
          type="text"
          value={newTechName}
          onChange={(e) => setNewTechName(e.target.value)}
          placeholder="Enter technician name..."
          className="input flex-1"
        />
        <button type="submit" disabled={adding || !newTechName.trim()} className="btn-primary">
          {adding ? 'Adding...' : '+ Add Technician'}
        </button>
      </form>

      {/* Technicians List */}
      <div className="space-y-3">
        {technicians.length === 0 ? (
          <p className="text-center text-gray-500 py-8">No technicians yet. Add one above.</p>
        ) : (
          technicians.map((tech) => (
            <div
              key={tech.id}
              className={`
                flex items-center justify-between p-4 rounded-lg border-2
                ${tech.active ? 'bg-white border-gray-200' : 'bg-gray-100 border-gray-300'}
              `}
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
                  <p className="text-sm text-gray-500">
                    {tech.active ? 'Active' : 'Inactive'}
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => handleToggleActive(tech.id, tech.active)}
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
                <button
                  onClick={() => handleDelete(tech.id, tech.name)}
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
