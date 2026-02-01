'use client';

import { useState, useEffect } from 'react';
import type { ActiveQueueItem, PriorityLevel } from '@/lib/types';
import { SERVICE_TYPE_LABELS } from '@/lib/types';
import { formatTime, formatMinutes, getServiceDataText } from '@/lib/utils';

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
  // Group by priority
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
                  className={`
                    w-full text-left p-4 rounded-lg border-l-4 shadow-md transition-all
                    hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]
                    ${PRIORITY_COLORS[priority]}
                  `}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-1">
                        <span className="text-2xl font-bold text-gray-800">
                          #{ticket.ticket_number}
                        </span>
                        <span className="px-3 py-1 bg-sky-500 text-white text-sm font-semibold rounded-full">
                          {SERVICE_TYPE_LABELS[ticket.service_type]}
                        </span>
                      </div>
                      <p className="text-lg font-semibold text-gray-700">
                        {ticket.vehicle}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-500">
                        {formatTime(ticket.created_at)}
                      </p>
                      <p className="text-xs font-semibold text-gray-600">
                        ⏱ {formatMinutes(ticket.minutes_waiting)}
                      </p>
                    </div>
                  </div>

                  {/* Service Details */}
                  <p className="text-gray-600">
                    {getServiceDataText(ticket.service_type, ticket.service_data)}
                  </p>

                  {/* Notes */}
                  {ticket.notes && (
                    <p className="mt-2 text-sm text-gray-500 italic">
                      Note: {ticket.notes}
                    </p>
                  )}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
