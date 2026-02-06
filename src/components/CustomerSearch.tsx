'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

const SERVICE_LABELS: Record<string, string> = {
  MOUNT_BALANCE: 'Mount & Balance',
  FLAT_REPAIR: 'Flat Repair',
  ROTATION: 'Rotation',
  NEW_TIRES: 'New Tires',
  USED_TIRES: 'Used Tires',
  DETAILING: 'Detailing',
  APPOINTMENT: 'Appointment',
  MAINTENANCE: 'Maintenance',
};

interface CustomerResult {
  name: string;
  phone: string | null;
  vehicles: string[];
  total_visits: number;
  last_visit: string | null;
  tickets: {
    id: string;
    ticket_number: number;
    service_type: string;
    vehicle: string;
    status: string;
    created_at: string;
  }[];
}

export default function CustomerSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CustomerResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [expandedName, setExpandedName] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setSearched(true);

    const searchTerm = query.trim();
    const phoneDigits = searchTerm.replace(/[^0-9]/g, '');

    let ticketQuery = supabase
      .from('tickets')
      .select('id, ticket_number, service_type, vehicle, status, created_at, customer_name, customer_phone')
      .order('created_at', { ascending: false });

    if (phoneDigits.length >= 4) {
      ticketQuery = ticketQuery.or(`customer_name.ilike.%${searchTerm}%,customer_phone.ilike.%${phoneDigits}%`);
    } else {
      ticketQuery = ticketQuery.ilike('customer_name', `%${searchTerm}%`);
    }

    const { data: tickets, error } = await ticketQuery.limit(100);

    if (error || !tickets) {
      setResults([]);
      setLoading(false);
      return;
    }

    // Also try the customers table RPC
    let rpcResults: any[] = [];
    try {
      const { data: rpcData } = await supabase.rpc('search_customers', { query_text: searchTerm });
      if (rpcData) rpcResults = rpcData;
    } catch {
      // RPC might fail, that's fine
    }

    const customerMap: Record<string, CustomerResult> = {};

    rpcResults.forEach((c: any) => {
      const key = (c.name || '').toLowerCase().trim();
      if (!key) return;
      if (!customerMap[key]) {
        customerMap[key] = {
          name: c.name,
          phone: c.phone_raw || null,
          vehicles: c.last_vehicle_text ? [c.last_vehicle_text] : [],
          total_visits: c.total_visits || 0,
          last_visit: c.last_visit_date || null,
          tickets: [],
        };
      }
    });

    tickets.forEach((t) => {
      const name = t.customer_name || 'Unknown';
      const key = name.toLowerCase().trim();
      if (!key || key === 'unknown') return;

      if (!customerMap[key]) {
        customerMap[key] = {
          name,
          phone: t.customer_phone || null,
          vehicles: [],
          total_visits: 0,
          last_visit: null,
          tickets: [],
        };
      }

      const cust = customerMap[key];
      cust.total_visits++;
      if (t.customer_phone && !cust.phone) cust.phone = t.customer_phone;
      if (t.vehicle && !cust.vehicles.includes(t.vehicle)) cust.vehicles.push(t.vehicle);
      if (!cust.last_visit || t.created_at > cust.last_visit) cust.last_visit = t.created_at;

      cust.tickets.push({
        id: t.id,
        ticket_number: t.ticket_number,
        service_type: t.service_type,
        vehicle: t.vehicle,
        status: t.status,
        created_at: t.created_at,
      });
    });

    const sorted = Object.values(customerMap).sort((a, b) => {
      if (a.last_visit && b.last_visit) return b.last_visit.localeCompare(a.last_visit);
      if (a.last_visit) return -1;
      if (b.last_visit) return 1;
      return a.name.localeCompare(b.name);
    });

    setResults(sorted);
    setLoading(false);
  };

  const formatPhone = (phone: string) => {
    const d = phone.replace(/\D/g, '');
    if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
    return phone;
  };

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-800 mb-1">Customer Search</h2>
      <p className="text-gray-500 mb-6 text-sm">Search by name or phone number across all tickets.</p>

      <div className="flex gap-3 mb-6">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="Name or phone number..."
          className="input-field flex-1"
          autoFocus
        />
        <button
          onClick={handleSearch}
          disabled={!query.trim() || loading}
          className="btn-primary disabled:opacity-50"
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
      </div>

      {searched && results.length === 0 && !loading && (
        <p className="text-center text-gray-400 py-8">No customers found matching &ldquo;{query}&rdquo;.</p>
      )}

      {results.length > 0 && (
        <div className="space-y-3">
          {results.map((c) => (
            <div key={c.name} className="card">
              <div
                className="flex items-start justify-between cursor-pointer"
                onClick={() => setExpandedName(expandedName === c.name ? null : c.name)}
              >
                <div>
                  <p className="font-bold text-gray-800 text-lg">{c.name}</p>
                  {c.phone && <p className="text-gray-600">{formatPhone(c.phone)}</p>}
                  {c.vehicles.length > 0 && (
                    <p className="text-gray-500 text-sm mt-0.5">
                      {c.vehicles.length === 1 ? 'Vehicle' : 'Vehicles'}: {c.vehicles.join(', ')}
                    </p>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-2xl font-bold text-sky-600">{c.total_visits}</p>
                  <p className="text-xs text-gray-400">{c.total_visits === 1 ? 'visit' : 'visits'}</p>
                  {c.last_visit && (
                    <p className="text-xs text-gray-400 mt-1">
                      Last: {new Date(c.last_visit).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>

              {expandedName === c.name && c.tickets.length > 0 && (
                <div className="mt-4 pt-3 border-t border-gray-100">
                  <p className="text-xs font-semibold text-gray-500 mb-2">TICKET HISTORY</p>
                  <div className="space-y-2">
                    {c.tickets.map((ticket) => (
                      <div
                        key={ticket.id}
                        className="flex items-center justify-between py-1.5 px-2 rounded bg-gray-50"
                      >
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold text-gray-700 text-sm">#{ticket.ticket_number}</span>
                          <span className="text-sm text-gray-600">
                            {SERVICE_LABELS[ticket.service_type] || ticket.service_type}
                          </span>
                          <span className="text-xs text-gray-400">{ticket.vehicle}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span
                            className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                              ticket.status === 'COMPLETED'
                                ? 'bg-green-100 text-green-700'
                                : ticket.status === 'IN_PROGRESS'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-orange-100 text-orange-700'
                            }`}
                          >
                            {ticket.status.replace('_', ' ')}
                          </span>
                          <span className="text-xs text-gray-400">
                            {new Date(ticket.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    ))}
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
