'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { CustomerSearchResult, ServiceType } from '@/lib/types';
import { SERVICE_TYPE_LABELS, formatPhone } from '@/lib/types';
import { formatDateTime } from '@/lib/utils';

interface CustomerTicket {
  id: string;
  ticket_number: number;
  service_type: ServiceType;
  vehicle: string;
  created_at: string;
  status: string;
  completed_at: string | null;
}

export default function CustomerSearch() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CustomerSearchResult[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerSearchResult | null>(null);
  const [customerTickets, setCustomerTickets] = useState<CustomerTicket[]>([]);
  const [loading, setLoading] = useState(false);
  const [ticketsLoading, setTicketsLoading] = useState(false);

  // Debounced search
  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.rpc('search_customers', {
          query_text: query,
        });
        if (error) throw error;
        setResults(data || []);
      } catch (error) {
        console.error('Search error:', error);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const handleSelectCustomer = useCallback(async (customer: CustomerSearchResult) => {
    setSelectedCustomer(customer);
    setTicketsLoading(true);
    try {
      const { data } = await supabase
        .from('tickets')
        .select('id, ticket_number, service_type, vehicle, created_at, status, completed_at')
        .eq('customer_id', customer.id)
        .order('created_at', { ascending: false })
        .limit(5);
      setCustomerTickets(data || []);
    } catch (error) {
      console.error('Error loading tickets:', error);
      setCustomerTickets([]);
    } finally {
      setTicketsLoading(false);
    }
  }, []);

  const handleBackToSearch = () => {
    setSelectedCustomer(null);
    setCustomerTickets([]);
  };

  const handleCreateTicket = () => {
    if (selectedCustomer) {
      router.push(`/intake?customer_id=${selectedCustomer.id}`);
    }
  };

  // Detail view when a customer is selected
  if (selectedCustomer) {
    return (
      <div className="space-y-6">
        <button
          onClick={handleBackToSearch}
          className="text-sky-600 hover:text-sky-800 font-medium flex items-center gap-1"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to Search
        </button>

        {/* Customer Info Card */}
        <div className="bg-white rounded-xl shadow p-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-800">{selectedCustomer.name}</h2>
              <p className="text-gray-600 mt-1">
                {selectedCustomer.phone_raw ? formatPhone(selectedCustomer.phone_raw) : 'No phone'}
              </p>
              {selectedCustomer.last_vehicle_text && (
                <p className="text-gray-500 text-sm mt-2">
                  Last vehicle: {selectedCustomer.last_vehicle_text}
                </p>
              )}
              <p className="text-gray-400 text-sm mt-1">
                {selectedCustomer.total_visits} visit{selectedCustomer.total_visits !== 1 ? 's' : ''}
                {selectedCustomer.last_visit_date && (
                  <> · Last visit: {formatDateTime(selectedCustomer.last_visit_date)}</>
                )}
              </p>
            </div>
            <button
              onClick={handleCreateTicket}
              className="btn-primary whitespace-nowrap"
            >
              + Create Ticket
            </button>
          </div>
        </div>

        {/* Recent Tickets */}
        <div className="bg-white rounded-xl shadow p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Recent Tickets</h3>
          {ticketsLoading ? (
            <div className="flex justify-center py-8">
              <div className="spinner"></div>
            </div>
          ) : customerTickets.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No tickets found for this customer</p>
          ) : (
            <div className="space-y-3">
              {customerTickets.map((ticket) => (
                <div
                  key={ticket.id}
                  className={`p-4 rounded-lg border-l-4 ${
                    ticket.status === 'COMPLETED'
                      ? 'bg-gray-50 border-green-500'
                      : 'bg-yellow-50 border-yellow-500'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-gray-800">#{ticket.ticket_number}</span>
                      <span className="ml-2 text-gray-600">
                        {SERVICE_TYPE_LABELS[ticket.service_type]}
                      </span>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded ${
                      ticket.status === 'COMPLETED'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {ticket.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{ticket.vehicle}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {formatDateTime(ticket.created_at)}
                    {ticket.completed_at && ` · Completed ${formatDateTime(ticket.completed_at)}`}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Search view
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Customer Lookup</h2>
        <p className="text-gray-600">Search by phone number or name to view customer history</p>
      </div>

      {/* Search Input */}
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search phone or name..."
          className="input w-full pl-10"
          autoFocus
        />
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="spinner"></div>
        </div>
      ) : query.length < 2 ? (
        <div className="text-center text-gray-500 py-8">
          <p>Enter at least 2 characters to search</p>
        </div>
      ) : results.length === 0 ? (
        <div className="text-center text-gray-500 py-8">
          <p>No customers found matching "{query}"</p>
        </div>
      ) : (
        <div className="space-y-2">
          {results.map((customer) => (
            <button
              key={customer.id}
              onClick={() => handleSelectCustomer(customer)}
              className="w-full text-left bg-white rounded-lg shadow p-4 border-l-4 border-sky-500 hover:bg-sky-50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-800">{customer.name}</p>
                  <p className="text-sm text-gray-600">
                    {customer.phone_raw ? formatPhone(customer.phone_raw) : 'No phone'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">
                    {customer.total_visits} visit{customer.total_visits !== 1 ? 's' : ''}
                  </p>
                  {customer.last_visit_date && (
                    <p className="text-xs text-gray-400">
                      Last: {formatDateTime(customer.last_visit_date)}
                    </p>
                  )}
                </div>
              </div>
              {customer.last_vehicle_text && (
                <p className="text-xs text-gray-400 mt-1">
                  Vehicle: {customer.last_vehicle_text}
                </p>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
