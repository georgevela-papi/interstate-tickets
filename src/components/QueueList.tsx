'use client';

import type { ActiveQueueItem, PriorityLevel } from '@/lib/types';
import { SERVICE_TYPE_LABELS } from '@/lib/types';
import { getTimeElapsed, getServiceDataText } from '@/lib/utils';

interface QueueListProps {
  tickets: ActiveQueueItem[];
  onTicketClick: (ticket: ActiveQueueItem) => void;
}

const PRIORITY_COLORS: Record<PriorityLevel, string> = {
  HIGH: 'bg-red-50 border-l-red-600',
  NORMAL: 'bg-white border-l-gray-400',
  LOW: 'bg-blue-50 border-l-blue-600',
};

const PRIORITY_ICONS: Record<PriorityLevel, string> = {
  HIGH: '🔴',
  NORMAL: '⚪',
  LOW: '🔵',
};

export default function QueueList({ tickets, onTicketClick }: QueueListProps) {
  const grouped = {
    HIGH: tickets.filter((t) => t.priority === 'HIGH'),
    NORMAL: tickets.filter((t) => t.priority === 'NORMAL'),
    LOW: tickets.filter((t) => t.priority === 'LOW'),
  };

  if (tickets.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="text-6xl mb-4">✅</div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">All Caught Up!</h2>
        <p className="text-gray-600">No pending jobs at the moment.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {(['HIGH', 'NORMAL', 'LOW'] as PriorityLevel[]).map((priority) => {
        const priorityTickets = grouped[priority];
        if (priorityTickets.length === 0) return null;

        return (
          <div key={priority}>
            <div className="flex items-center space-x-2 mb-4">
              <span className="text-2xl">{PRIORITY_ICONS[priority]}</span>
              <h3 className="text-xl font-bold text-gray-800">
                {priority} PRIORITY ({priorityTickets.length})
              </h3>
            </div>

            <div className="space-y-3">
              {priorityTickets.map((ticket) => (
                <button
                  key={ticket.id}
                  onClick={() => onTicketClick(ticket)}
                  className={`w-full text-left p-4 rounded-lg border-l-4 shadow-sm hover:shadow-md transition-all ${PRIORITY_COLORS[priority]}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-lg text-gray-800">
                      #{ticket.ticket_number}
                    </span>
                    <span className="text-sm text-gray-500">
                      {getTimeElapsed(ticket.created_at)} ago
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-gray-700">{ticket.vehicle}</p>
                      {ticket.customer_name && (
                        <p className="text-sm text-gray-600">
                          👤 {ticket.customer_name}
                          {ticket.customer_phone ? ` • ${ticket.customer_phone}` : ''}
                        </p>
                      )}
                      <p className="text-sm text-gray-500">
                        {SERVICE_TYPE_LABELS[ticket.service_type]} •{' '}
                        {getServiceDataText(ticket.service_type, ticket.service_data)}
                      </p>
                    </div>
                    <span className="text-sky-500 font-semibold text-sm">View →</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
