'use client';

import { useState, useEffect, useCallback } from 'react';
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

// Fallback icons for legacy service slugs (matches ServicePicker)
const LEGACY_ICONS: Record<string, string> = {
  MOUNT_BALANCE: '\u2699\uFE0F',
  FLAT_REPAIR: '\uD83D\uDD27',
  ROTATION: '\uD83D\uDD04',
  NEW_TIRES: '\uD83C\uDD95',
  USED_TIRES: '\u267B\uFE0F',
  DETAILING: '\u2728',
  MAINTENANCE: '\uD83D\uDEE0\uFE0F',
  APPOINTMENT: '\uD83D\uDCC5',
};

type RangeMode = 'today' | 'week' | 'custom';

function getStartOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function getStartOfWeek() {
  const d = new Date();
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatMins(totalMins: number) {
  if (totalMins < 60) return `${totalMins}m`;
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function toLocalDateStr(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default function ReportsDashboard() {
  const [rangeMode, setRangeMode] = useState<RangeMode>('today');
  const [customStart, setCustomStart] = useState(toLocalDateStr(getStartOfToday()));
  const [customEnd, setCustomEnd] = useState(toLocalDateStr(new Date()));

  // Service icon map from database
  const [serviceIcons, setServiceIcons] = useState<Record<string, string>>({});

  const [stats, setStats] = useState({
    total: 0,
    completed: 0,
    pending: 0,
    avgTimeMins: 0,
    totalHours: 0,
    byService: [] as { service_type: string; count: number; hours: number }[],
    byTech: [] as { name: string; count: number; hours: number }[],
  });
  const [loading, setLoading] = useState(true);

  // Load service icons from DB
  useEffect(() => {
    async function loadIcons() {
      const { data } = await supabase
        .from('service_types')
        .select('slug, icon, name');
      if (data) {
        const iconMap: Record<string, string> = {};
        const nameMap: Record<string, string> = {};
        data.forEach((s: any) => {
          if (s.icon) iconMap[s.slug] = s.icon;
          if (s.name) nameMap[s.slug] = s.name;
        });
        setServiceIcons(iconMap);
        // Also update SERVICE_LABELS with DB names for dynamic services
        data.forEach((s: any) => {
          if (s.name && !SERVICE_LABELS[s.slug]) {
            SERVICE_LABELS[s.slug] = s.name;
          }
        });
      }
    }
    loadIcons();
  }, []);

  function getIcon(slug: string): string {
    return serviceIcons[slug] || LEGACY_ICONS[slug] || '\uD83D\uDCCB';
  }

  const loadStats = useCallback(async () => {
    setLoading(true);
    let startDate: Date;
    let endDate: Date;

    if (rangeMode === 'today') {
      startDate = getStartOfToday();
      endDate = new Date();
    } else if (rangeMode === 'week') {
      startDate = getStartOfWeek();
      endDate = new Date();
    } else {
      startDate = new Date(customStart + 'T00:00:00');
      endDate = new Date(customEnd + 'T23:59:59');
    }

    const startISO = startDate.toISOString();
    const endISO = endDate.toISOString();

    const { data: tickets } = await supabase
      .from('tickets')
      .select('id, status, service_type, completed_by, created_at, completed_at, excluded_from_metrics')
      .gte('created_at', startISO)
      .lte('created_at', endISO);

    const all = tickets || [];
    const total = all.length;
    const completed = all.filter((t) => t.status === 'COMPLETED').length;
    const pending = total - completed;

    const validCompleted = all.filter(
      (t) => t.status === 'COMPLETED' && t.completed_at && !t.excluded_from_metrics
    );

    let totalMinutes = 0;
    validCompleted.forEach((t) => {
      const mins =
        (new Date(t.completed_at).getTime() - new Date(t.created_at).getTime()) / 60000;
      totalMinutes += mins;
    });

    const avgTimeMins =
      validCompleted.length > 0 ? Math.round(totalMinutes / validCompleted.length) : 0;
    const totalHours = Math.round((totalMinutes / 60) * 10) / 10;

    const serviceMap: Record<string, { count: number; mins: number }> = {};
    all.forEach((t) => {
      if (!serviceMap[t.service_type])
        serviceMap[t.service_type] = { count: 0, mins: 0 };
      serviceMap[t.service_type].count++;
      if (t.status === 'COMPLETED' && t.completed_at && !t.excluded_from_metrics) {
        serviceMap[t.service_type].mins +=
          (new Date(t.completed_at).getTime() - new Date(t.created_at).getTime()) / 60000;
      }
    });

    const byService = Object.entries(serviceMap)
      .map(([service_type, v]) => ({
        service_type,
        count: v.count,
        hours: Math.round((v.mins / 60) * 10) / 10,
      }))
      .sort((a, b) => b.count - a.count);

    const completedWithTech = all.filter(
      (t) => t.completed_by && t.status === 'COMPLETED'
    );
    const techIds = Array.from(new Set(completedWithTech.map((t) => t.completed_by)));

    let byTech: { name: string; count: number; hours: number }[] = [];
    if (techIds.length > 0) {
      const { data: techs } = await supabase
        .from('technicians')
        .select('id, name')
        .in('id', techIds);

      const techMap: Record<string, { name: string; count: number; mins: number }> = {};
      completedWithTech.forEach((t) => {
        const tech = techs?.find((tc) => tc.id === t.completed_by);
        const name = tech?.name || 'Unknown';
        if (!techMap[name]) techMap[name] = { name, count: 0, mins: 0 };
        techMap[name].count++;
        if (t.completed_at && !t.excluded_from_metrics) {
          techMap[name].mins +=
            (new Date(t.completed_at).getTime() - new Date(t.created_at).getTime()) / 60000;
        }
      });

      byTech = Object.values(techMap)
        .map((v) => ({
          name: v.name,
          count: v.count,
          hours: Math.round((v.mins / 60) * 10) / 10,
        }))
        .sort((a, b) => b.count - a.count);
    }

    setStats({ total, completed, pending, avgTimeMins, totalHours, byService, byTech });
    setLoading(false);
  }, [rangeMode, customStart, customEnd]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const rangeLabel =
    rangeMode === 'today' ? 'Today' : rangeMode === 'week' ? 'This Week' : 'Custom Range';

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-semibold text-gray-600">Period:</span>
          {(['today', 'week', 'custom'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setRangeMode(mode)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                rangeMode === mode
                  ? 'bg-sky-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {mode === 'today' ? 'Today' : mode === 'week' ? 'This Week' : 'Date Range'}
            </button>
          ))}
        </div>
        {rangeMode === 'custom' && (
          <div className="flex flex-wrap items-center gap-3 mt-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Start Date</label>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="input-field text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">End Date</label>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="input-field text-sm"
              />
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="spinner" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="card text-center">
              <p className="text-3xl font-bold text-gray-800">{stats.total}</p>
              <p className="text-sm text-gray-500">{rangeLabel} Tickets</p>
            </div>
            <div className="card text-center">
              <p className="text-3xl font-bold text-green-600">{stats.completed}</p>
              <p className="text-sm text-gray-500">Completed</p>
            </div>
            <div className="card text-center">
              <p className="text-3xl font-bold text-orange-500">{stats.pending}</p>
              <p className="text-sm text-gray-500">Pending</p>
            </div>
            <div className="card text-center">
              <p className="text-3xl font-bold text-sky-600">
                {formatMins(stats.avgTimeMins)}
              </p>
              <p className="text-sm text-gray-500">Avg Completion</p>
            </div>
            <div className="card text-center col-span-2 md:col-span-1">
              <p className="text-3xl font-bold text-purple-600">{stats.totalHours}h</p>
              <p className="text-sm text-gray-500">Total Hours</p>
            </div>
          </div>

          <div className="card">
            <h3 className="text-lg font-bold text-gray-800 mb-4">
              {rangeLabel} by Service Type
            </h3>
            {stats.byService.length === 0 ? (
              <p className="text-gray-400 text-center py-4">No tickets in this period</p>
            ) : (
              <div className="space-y-2">
                {stats.byService.map((s) => (
                  <div
                    key={s.service_type}
                    className="flex items-center justify-between py-2"
                  >
                    <div className="flex items-center space-x-3">
                      <span className="text-2xl">{getIcon(s.service_type)}</span>
                      <span className="text-gray-700">
                        {SERVICE_LABELS[s.service_type] || s.service_type.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className="text-xs text-gray-400">{s.hours}h logged</span>
                      <span className="font-bold text-gray-800 bg-gray-100 px-3 py-1 rounded-full text-sm">
                        {s.count}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <h3 className="text-lg font-bold text-gray-800 mb-4">
              Technician Performance ({rangeLabel})
            </h3>
            {stats.byTech.length === 0 ? (
              <p className="text-gray-400 text-center py-4">
                No completed tickets in this period
              </p>
            ) : (
              <div className="space-y-2">
                {stats.byTech.map((t, i) => (
                  <div
                    key={t.name}
                    className="flex items-center justify-between py-2"
                  >
                    <div className="flex items-center space-x-3">
                      <span
                        className={`text-lg font-bold ${
                          i === 0 ? 'text-yellow-500' : 'text-gray-400'
                        }`}
                      >
                        #{i + 1}
                      </span>
                      <span className="text-gray-700 font-medium">{t.name}</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className="text-xs text-gray-400">{t.hours}h</span>
                      <span className="font-bold text-gray-800 bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm">
                        {t.count} completed
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
