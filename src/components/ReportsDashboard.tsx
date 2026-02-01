'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { ServiceType, PriorityLevel } from '@/lib/types';
import { SERVICE_TYPE_LABELS, PRIORITY_LABELS } from '@/lib/types';

type DateRange = 'today' | 'week' | 'month' | 'custom';

interface TicketRow {
  id: string;
  ticket_number: number;
  service_type: ServiceType;
  priority: PriorityLevel;
  status: string;
  vehicle: string;
  notes: string | null;
  completed_at: string | null;
  created_at: string;
  technician_name: string | null;
}

interface KPIData {
  totalToday: number;
  totalThisWeek: number;
  avgTimeMinutes: number;
  pendingCount: number;
}

interface ServiceBreakdown {
  type: ServiceType;
  label: string;
  count: number;
}

interface TechBreakdown {
  name: string;
  count: number;
}

interface HourBreakdown {
  hour: number;
  label: string;
  count: number;
}

interface PriorityBreakdownItem {
  priority: PriorityLevel;
  label: string;
  count: number;
  color: string;
}

export default function ReportsDashboard() {
  const [dateRange, setDateRange] = useState<DateRange>('week');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<KPIData | null>(null);
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [serviceBreakdown, setServiceBreakdown] = useState<ServiceBreakdown[]>([]);
  const [techBreakdown, setTechBreakdown] = useState<TechBreakdown[]>([]);
  const [hourBreakdown, setHourBreakdown] = useState<HourBreakdown[]>([]);
  const [priorityBreakdown, setPriorityBreakdown] = useState<PriorityBreakdownItem[]>([]);

  const getDateRangeStart = useCallback((): string => {
    const now = new Date();
    switch (dateRange) {
      case 'today':
        return now.toISOString().split('T')[0];
      case 'week': {
        const weekStart = new Date(now);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        return weekStart.toISOString().split('T')[0];
      }
      case 'month': {
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        return monthStart.toISOString().split('T')[0];
      }
      case 'custom':
        return customStart || now.toISOString().split('T')[0];
    }
  }, [dateRange, customStart]);

  const getDateRangeEnd = useCallback((): string => {
    if (dateRange === 'custom' && customEnd) {
      const end = new Date(customEnd);
      end.setDate(end.getDate() + 1);
      return end.toISOString().split('T')[0];
    }
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  }, [dateRange, customEnd]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const rangeStart = getDateRangeStart();
      const rangeEnd = getDateRangeEnd();

      // Fetch completed tickets with technician names
      const { data: completedTickets } = await supabase
        .from('tickets')
        .select('id, ticket_number, service_type, priority, status, vehicle, notes, completed_at, created_at, completed_by')
        .eq('status', 'COMPLETED')
        .gte('completed_at', rangeStart)
        .lt('completed_at', rangeEnd)
        .order('completed_at', { ascending: false });

      // Fetch technicians for name lookup
      const { data: technicians } = await supabase
        .from('technicians')
        .select('id, name');

      const techMap = new Map<string, string>();
      if (technicians) {
        technicians.forEach((t: { id: string; name: string }) => {
          techMap.set(t.id, t.name);
        });
      }

      const rows: TicketRow[] = (completedTickets || []).map((t: any) => ({
        id: t.id,
        ticket_number: t.ticket_number,
        service_type: t.service_type,
        priority: t.priority,
        status: t.status,
        vehicle: t.vehicle,
        notes: t.notes,
        completed_at: t.completed_at,
        created_at: t.created_at,
        technician_name: t.completed_by ? techMap.get(t.completed_by) || 'Unknown' : null,
      }));

      setTickets(rows);
      processBreakdowns(rows);

      // Load KPIs
      await loadKPIs();
    } catch (error) {
      console.error('Error loading report data:', error);
    } finally {
      setLoading(false);
    }
  }, [getDateRangeStart, getDateRangeEnd]);

  const loadKPIs = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());

      const [todayRes, weekRes, avgRes, pendingRes] = await Promise.all([
        supabase
          .from('tickets')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'COMPLETED')
          .gte('completed_at', today),
        supabase
          .from('tickets')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'COMPLETED')
          .gte('completed_at', weekStart.toISOString()),
        supabase.rpc('get_avg_completion_time'),
        supabase
          .from('tickets')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'PENDING'),
      ]);

      setKpis({
        totalToday: todayRes.count || 0,
        totalThisWeek: weekRes.count || 0,
        avgTimeMinutes: avgRes.data?.[0]?.avg_minutes || 0,
        pendingCount: pendingRes.count || 0,
      });
    } catch (error) {
      console.error('Error loading KPIs:', error);
    }
  };

  const processBreakdowns = (rows: TicketRow[]) => {
    // Service type breakdown
    const serviceMap = new Map<ServiceType, number>();
    rows.forEach((t) => {
      serviceMap.set(t.service_type, (serviceMap.get(t.service_type) || 0) + 1);
    });
    const serviceBd: ServiceBreakdown[] = Array.from(serviceMap.entries())
      .map(([type, count]) => ({
        type,
        label: SERVICE_TYPE_LABELS[type] || type,
        count,
      }))
      .sort((a, b) => b.count - a.count);
    setServiceBreakdown(serviceBd);

    // Technician breakdown
    const techMap = new Map<string, number>();
    rows.forEach((t) => {
      const name = t.technician_name || 'Unknown';
      techMap.set(name, (techMap.get(name) || 0) + 1);
    });
    const techBd: TechBreakdown[] = Array.from(techMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
    setTechBreakdown(techBd);

    // Hourly breakdown
    const hourMap = new Map<number, number>();
    rows.forEach((t) => {
      if (t.completed_at) {
        const hour = new Date(t.completed_at).getHours();
        hourMap.set(hour, (hourMap.get(hour) || 0) + 1);
      }
    });
    const hourBd: HourBreakdown[] = [];
    for (let h = 6; h <= 20; h++) {
      const count = hourMap.get(h) || 0;
      const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
      const ampm = h < 12 ? 'AM' : 'PM';
      hourBd.push({ hour: h, label: `${displayHour}${ampm}`, count });
    }
    setHourBreakdown(hourBd);

    // Priority breakdown
    const priorityMap = new Map<PriorityLevel, number>();
    rows.forEach((t) => {
      priorityMap.set(t.priority, (priorityMap.get(t.priority) || 0) + 1);
    });
    const priorityColors: Record<PriorityLevel, string> = {
      HIGH: 'bg-red-500',
      NORMAL: 'bg-sky-500',
      LOW: 'bg-gray-400',
    };
    const priorityBd: PriorityBreakdownItem[] = (['HIGH', 'NORMAL', 'LOW'] as PriorityLevel[]).map(
      (p) => ({
        priority: p,
        label: PRIORITY_LABELS[p],
        count: priorityMap.get(p) || 0,
        color: priorityColors[p],
      })
    );
    setPriorityBreakdown(priorityBd);
  };

  const exportCSV = () => {
    if (tickets.length === 0) return;

    const headers = [
      'Ticket #',
      'Service Type',
      'Vehicle',
      'Priority',
      'Technician',
      'Notes',
      'Created',
      'Completed',
    ];

    const csvRows = [headers.join(',')];
    tickets.forEach((t) => {
      const row = [
        t.ticket_number,
        SERVICE_TYPE_LABELS[t.service_type] || t.service_type,
        `"${(t.vehicle || '').replace(/"/g, '""')}"`,
        PRIORITY_LABELS[t.priority] || t.priority,
        t.technician_name || '',
        `"${(t.notes || '').replace(/"/g, '""')}"`,
        t.created_at ? new Date(t.created_at).toLocaleString() : '',
        t.completed_at ? new Date(t.completed_at).toLocaleString() : '',
      ];
      csvRows.push(row.join(','));
    });

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const rangeLabel = dateRange === 'custom'
      ? `${customStart}_to_${customEnd}`
      : dateRange;
    link.download = `interstate_tickets_${rangeLabel}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    if (dateRange !== 'custom') {
      loadData();
    }
  }, [dateRange, loadData]);

  useEffect(() => {
    if (dateRange === 'custom' && customStart && customEnd) {
      loadData();
    }
  }, [dateRange, customStart, customEnd, loadData]);

  const maxServiceCount = Math.max(...serviceBreakdown.map((s) => s.count), 1);
  const maxTechCount = Math.max(...techBreakdown.map((t) => t.count), 1);
  const maxHourCount = Math.max(...hourBreakdown.map((h) => h.count), 1);
  const totalPriority = priorityBreakdown.reduce((sum, p) => sum + p.count, 0) || 1;

  const serviceColors: Record<string, string> = {
    MOUNT_BALANCE: 'bg-sky-500',
    FLAT_REPAIR: 'bg-orange-500',
    ROTATION: 'bg-green-500',
    NEW_TIRES: 'bg-purple-500',
    USED_TIRES: 'bg-indigo-500',
    DETAILING: 'bg-pink-500',
    APPOINTMENT: 'bg-amber-500',
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      {kpis && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-xl p-4 bg-gradient-to-br from-sky-500 to-sky-600 text-white shadow">
            <p className="text-sm font-semibold opacity-90 mb-1">TODAY</p>
            <p className="text-4xl font-bold">{kpis.totalToday}</p>
            <p className="text-sm opacity-80">Jobs Completed</p>
          </div>
          <div className="rounded-xl p-4 bg-gradient-to-br from-green-500 to-green-600 text-white shadow">
            <p className="text-sm font-semibold opacity-90 mb-1">THIS WEEK</p>
            <p className="text-4xl font-bold">{kpis.totalThisWeek}</p>
            <p className="text-sm opacity-80">Jobs Completed</p>
          </div>
          <div className="rounded-xl p-4 bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow">
            <p className="text-sm font-semibold opacity-90 mb-1">AVG TIME</p>
            <p className="text-4xl font-bold">{Math.round(kpis.avgTimeMinutes)}</p>
            <p className="text-sm opacity-80">Minutes</p>
          </div>
          <div className="rounded-xl p-4 bg-gradient-to-br from-red-500 to-red-600 text-white shadow">
            <p className="text-sm font-semibold opacity-90 mb-1">PENDING</p>
            <p className="text-4xl font-bold">{kpis.pendingCount}</p>
            <p className="text-sm opacity-80">In Queue</p>
          </div>
        </div>
      )}

      {/* Date Range Filter + Export */}
      <div className="bg-white rounded-xl shadow p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-gray-600 mr-1">Date Range:</span>
            {(['today', 'week', 'month', 'custom'] as DateRange[]).map((range) => (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  dateRange === range
                    ? 'bg-sky-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {range === 'today' ? 'Today' : range === 'week' ? 'This Week' : range === 'month' ? 'This Month' : 'Custom'}
              </button>
            ))}
          </div>
          <button
            onClick={exportCSV}
            disabled={tickets.length === 0}
            className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export CSV
          </button>
        </div>

        {dateRange === 'custom' && (
          <div className="flex flex-wrap items-center gap-3 mt-3 pt-3 border-t">
            <label className="text-sm text-gray-600">From:</label>
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="border rounded-lg px-3 py-1.5 text-sm"
            />
            <label className="text-sm text-gray-600">To:</label>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="border rounded-lg px-3 py-1.5 text-sm"
            />
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="spinner"></div>
        </div>
      ) : tickets.length === 0 ? (
        <div className="bg-white rounded-xl shadow p-8 text-center text-gray-500">
          <p className="text-lg font-medium">No completed jobs in this date range</p>
          <p className="text-sm mt-1">Try selecting a different date range</p>
        </div>
      ) : (
        <>
          {/* Summary line */}
          <p className="text-sm text-gray-500 text-right">
            {tickets.length} completed job{tickets.length !== 1 ? 's' : ''} in selected range
          </p>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Jobs by Service Type */}
            <div className="bg-white rounded-xl shadow p-5">
              <h3 className="text-lg font-bold text-gray-800 mb-4">Jobs by Service Type</h3>
              <div className="space-y-3">
                {serviceBreakdown.map((s) => (
                  <div key={s.type}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-700 font-medium">{s.label}</span>
                      <span className="text-gray-500">{s.count}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-3">
                      <div
                        className={`h-3 rounded-full transition-all ${serviceColors[s.type] || 'bg-gray-500'}`}
                        style={{ width: `${(s.count / maxServiceCount) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
                {serviceBreakdown.length === 0 && (
                  <p className="text-sm text-gray-400">No data</p>
                )}
              </div>
            </div>

            {/* Jobs per Technician */}
            <div className="bg-white rounded-xl shadow p-5">
              <h3 className="text-lg font-bold text-gray-800 mb-4">Jobs per Technician</h3>
              <div className="space-y-3">
                {techBreakdown.map((t) => (
                  <div key={t.name}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-700 font-medium">{t.name}</span>
                      <span className="text-gray-500">{t.count}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-3">
                      <div
                        className="h-3 rounded-full bg-sky-500 transition-all"
                        style={{ width: `${(t.count / maxTechCount) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
                {techBreakdown.length === 0 && (
                  <p className="text-sm text-gray-400">No data</p>
                )}
              </div>
            </div>

            {/* Busiest Hours */}
            <div className="bg-white rounded-xl shadow p-5">
              <h3 className="text-lg font-bold text-gray-800 mb-4">Busiest Hours</h3>
              <div className="flex items-end gap-1 h-40">
                {hourBreakdown.map((h) => (
                  <div key={h.hour} className="flex-1 flex flex-col items-center justify-end h-full">
                    <span className="text-xs text-gray-500 mb-1">
                      {h.count > 0 ? h.count : ''}
                    </span>
                    <div
                      className={`w-full rounded-t transition-all ${
                        h.count > 0 ? 'bg-amber-400' : 'bg-gray-100'
                      }`}
                      style={{
                        height: h.count > 0 ? `${Math.max((h.count / maxHourCount) * 100, 8)}%` : '4px',
                      }}
                    />
                    <span className="text-[10px] text-gray-400 mt-1 leading-none">{h.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Priority Distribution */}
            <div className="bg-white rounded-xl shadow p-5">
              <h3 className="text-lg font-bold text-gray-800 mb-4">Priority Distribution</h3>
              {/* Stacked bar */}
              <div className="w-full h-8 rounded-full overflow-hidden flex bg-gray-100 mb-4">
                {priorityBreakdown.map((p) =>
                  p.count > 0 ? (
                    <div
                      key={p.priority}
                      className={`${p.color} transition-all`}
                      style={{ width: `${(p.count / totalPriority) * 100}%` }}
                    />
                  ) : null
                )}
              </div>
              <div className="space-y-2">
                {priorityBreakdown.map((p) => (
                  <div key={p.priority} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${p.color}`} />
                      <span className="text-sm text-gray-700">{p.label}</span>
                    </div>
                    <span className="text-sm text-gray-500">
                      {p.count} ({totalPriority > 0 ? Math.round((p.count / totalPriority) * 100) : 0}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
