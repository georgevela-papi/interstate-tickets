'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, getSession, clearSession } from '@/lib/supabase';
// TEAM MANAGEMENT: Import new unified TeamManager (replaces TechnicianManager)
import TeamManager from '@/components/TeamManager';
import type { TeamMember } from '@/components/TeamManager';
import { SERVICE_TYPE_LABELS } from '@/lib/types';
import Image from 'next/image';

interface KPIData {
  totalToday: number;
  totalThisWeek: number;
  avgTimeMinutes: number;
  pendingCount: number;
}

interface ServiceBreakdown { service_type: string; count: number; }
interface TechPerformance { name: string; count: number; avg_minutes: number; }
interface CompletedTicket {
  id: string;
  ticket_number: number;
  service_type: string;
  vehicle: string;
  customer_name: string | null;
  completed_at: string;
  excluded_from_metrics: boolean;
}

export default function AdminPage() {
  const [session, setSession] = useState<any>(null);
  // TEAM MANAGEMENT: Renamed state — now holds both technicians and front desk
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [kpis, setKpis] = useState<KPIData | null>(null);
  // TEAM MANAGEMENT: Tab key renamed for clarity (value still 'team' internally)
  const [activeTab, setActiveTab] = useState<'team' | 'reports' | 'tickets'>('team');
  const [reportPeriod, setReportPeriod] = useState<'today' | 'week' | 'month' | 'all'>('week');
  const [serviceBreakdown, setServiceBreakdown] = useState<ServiceBreakdown[]>([]);
  const [techPerformance, setTechPerformance] = useState<TechPerformance[]>([]);
  const [totalCompleted, setTotalCompleted] = useState(0);
  const [completedTickets, setCompletedTickets] = useState<CompletedTicket[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const currentSession = getSession();
    if (!currentSession || currentSession.role !== 'MANAGER') {
      router.push('/');
      return;
    }
    setSession(currentSession);
    // TEAM MANAGEMENT: Load all team members on mount
    loadTeamMembers();
    loadKPIs();
  }, [router]);

  useEffect(() => {
    if (activeTab === 'reports') loadDetailedReports();
    if (activeTab === 'tickets') loadCompletedTickets();
  }, [activeTab, reportPeriod]);

  // ── TEAM MANAGEMENT: Unified loader for Technicians + Front Desk ──
  // Fetches all staff with role TECHNICIAN or SERVICE_WRITER,
  // then left-joins technicians table for techs.
  const loadTeamMembers = async () => {
    // 1. Get ALL non-manager staff (includes inactive for management)
    const { data: staffData } = await supabase
      .from('staff')
      .select('id, id_code, name, role, active')
      .in('role', ['TECHNICIAN', 'SERVICE_WRITER'])
      .order('active', { ascending: false })
      .order('name');

    if (!staffData) {
      setTeamMembers([]);
      return;
    }

    // 2. Get technician records to link tech staff → technician.id
    const techStaffIds = staffData
      .filter(s => s.role === 'TECHNICIAN')
      .map(s => s.id);

    let techMap: Record<string, string> = {}; // staff_id → technician.id
    if (techStaffIds.length > 0) {
      const { data: techRows } = await supabase
        .from('technicians')
        .select('id, staff_id')
        .in('staff_id', techStaffIds);

      if (techRows) {
        techMap = Object.fromEntries(techRows.map(t => [t.staff_id, t.id]));
      }
    }

    // 3. Build unified TeamMember list
    const members: TeamMember[] = staffData.map(s => ({
      id: s.role === 'TECHNICIAN' && techMap[s.id]
        ? techMap[s.id]   // use technician.id as primary key for techs
        : s.id,           // use staff.id for front desk
      staff_id: s.id,
      technician_id: techMap[s.id] || null,
      name: s.name,
      role: s.role as 'TECHNICIAN' | 'SERVICE_WRITER',
      active: s.active,
      id_code: s.id_code,
    }));

    setTeamMembers(members);
  };

  // ── Everything below this line is UNCHANGED from the previous version ──

  const loadKPIs = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());

      // FIX 4A: Exclude test tickets from all KPI queries
      const { count: todayCount } = await supabase
        .from('tickets')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'COMPLETED')
        .eq('excluded_from_metrics', false)
        .gte('completed_at', today);

      const { count: weekCount } = await supabase
        .from('tickets')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'COMPLETED')
        .eq('excluded_from_metrics', false)
        .gte('completed_at', weekStart.toISOString());

      const { data: avgData } = await supabase.rpc('get_avg_completion_time');

      const { count: pendingCount } = await supabase
        .from('tickets')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'PENDING')
        .eq('excluded_from_metrics', false);

      setKpis({
        totalToday: todayCount || 0,
        totalThisWeek: weekCount || 0,
        avgTimeMinutes: avgData?.[0]?.avg_minutes || 0,
        pendingCount: pendingCount || 0,
      });
    } catch (error) {
      console.error('Error loading KPIs:', error);
    }
  };

  const getDateFilter = () => {
    const now = new Date();
    switch (reportPeriod) {
      case 'today': return now.toISOString().split('T')[0];
      case 'week': {
        const ws = new Date(now);
        ws.setDate(ws.getDate() - ws.getDay());
        return ws.toISOString();
      }
      case 'month': {
        const ms = new Date(now.getFullYear(), now.getMonth(), 1);
        return ms.toISOString();
      }
      default: return null;
    }
  };

  const loadDetailedReports = async () => {
    setReportsLoading(true);
    try {
      const dateFilter = getDateFilter();

      // Service breakdown
      let svcQuery = supabase
        .from('tickets')
        .select('service_type')
        .eq('status', 'COMPLETED')
        .eq('excluded_from_metrics', false);
      if (dateFilter) svcQuery = svcQuery.gte('completed_at', dateFilter);
      const { data: svcData } = await svcQuery;

      if (svcData) {
        const counts: Record<string, number> = {};
        svcData.forEach(t => {
          counts[t.service_type] = (counts[t.service_type] || 0) + 1;
        });
        const breakdown = Object.entries(counts)
          .map(([service_type, count]) => ({ service_type, count }))
          .sort((a, b) => b.count - a.count);
        setServiceBreakdown(breakdown);
        setTotalCompleted(svcData.length);
      }

      // Tech performance
      let techQuery = supabase
        .from('tickets')
        .select('completed_by, created_at, completed_at')
        .eq('status', 'COMPLETED')
        .eq('excluded_from_metrics', false)
        .not('completed_by', 'is', null);
      if (dateFilter) techQuery = techQuery.gte('completed_at', dateFilter);
      const { data: techTickets } = await techQuery;

      if (techTickets) {
        const { data: allTechs } = await supabase
          .from('technicians')
          .select('id, name');

        const techMap: Record<string, string> = {};
        allTechs?.forEach(t => { techMap[t.id] = t.name; });

        const perf: Record<string, { count: number; totalMinutes: number }> = {};
        techTickets.forEach(t => {
          const name = techMap[t.completed_by] || 'Unknown';
          if (!perf[name]) perf[name] = { count: 0, totalMinutes: 0 };
          perf[name].count++;
          const mins = (new Date(t.completed_at).getTime() - new Date(t.created_at).getTime()) / 60000;
          perf[name].totalMinutes += mins;
        });

        setTechPerformance(
          Object.entries(perf)
            .map(([name, d]) => ({
              name,
              count: d.count,
              avg_minutes: Math.round(d.totalMinutes / d.count),
            }))
            .sort((a, b) => b.count - a.count)
        );
      }
    } catch (error) {
      console.error('Error loading reports:', error);
    } finally {
      setReportsLoading(false);
    }
  };

  // FIX 4A: Load completed tickets for exclusion management
  const loadCompletedTickets = async () => {
    const { data } = await supabase
      .from('tickets')
      .select('id, ticket_number, service_type, vehicle, customer_name, completed_at, excluded_from_metrics')
      .eq('status', 'COMPLETED')
      .order('completed_at', { ascending: false })
      .limit(100);

    setCompletedTickets(data || []);
  };

  // FIX 4A: Toggle exclude from metrics
  const handleToggleExclude = async (ticketId: string, currentlyExcluded: boolean) => {
    const { error } = await supabase
      .from('tickets')
      .update({ excluded_from_metrics: !currentlyExcluded })
      .eq('id', ticketId);

    if (error) {
      alert('Failed to update ticket.');
      return;
    }
    loadCompletedTickets();
    loadKPIs();
  };

  // FIX 4A: Bulk exclude
  const handleExcludeAll = async () => {
    if (!confirm('Mark ALL completed tickets as excluded from metrics? This is useful for removing test data.')) return;
    const { error } = await supabase
      .from('tickets')
      .update({ excluded_from_metrics: true })
      .eq('status', 'COMPLETED')
      .eq('excluded_from_metrics', false);

    if (error) {
      alert('Failed to update tickets.');
      return;
    }
    loadCompletedTickets();
    loadKPIs();
  };

  const handleLogout = () => {
    clearSession();
    router.push('/');
  };

  const exportCSV = () => {
    const headers = ['Service Type', 'Count'];
    const rows = serviceBreakdown.map(s => [
      (SERVICE_TYPE_LABELS as any)[s.service_type] || s.service_type,
      s.count,
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `interstate-report-${reportPeriod}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!session) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header — Desktop */}
      <header className="bg-sky-500 text-white shadow-lg">
        <div className="container mx-auto px-4 py-4">
          {/* Desktop header */}
          <div className="hidden md:flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="relative w-16 h-12">
                <Image src="https://interstatetire.online/logo.png" alt="Interstate Tires" fill className="object-contain" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Admin Dashboard</h1>
                <p className="text-sm text-sky-100">Logged in as {session.name}</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              {/* FIX 5: Correct routing */}
              <button onClick={() => router.push('/intake')} className="bg-white bg-opacity-20 hover:bg-opacity-30 text-white px-4 py-2 rounded-lg font-semibold transition-colors">
                Create Ticket
              </button>
              <button onClick={() => router.push('/queue')} className="bg-white bg-opacity-20 hover:bg-opacity-30 text-white px-4 py-2 rounded-lg font-semibold transition-colors">
                View Queue
              </button>
              <button onClick={handleLogout} className="bg-white text-sky-600 px-4 py-2 rounded-lg font-semibold hover:bg-sky-50 transition-colors">
                Logout
              </button>
            </div>
          </div>
          {/* Mobile header */}
          <div className="md:hidden space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="relative w-12 h-10">
                  <Image src="https://interstatetire.online/logo.png" alt="Interstate Tires" fill className="object-contain" />
                </div>
                <div>
                  <h1 className="text-lg font-bold leading-tight">Admin Dashboard</h1>
                  <p className="text-xs text-sky-100">Logged in as {session.name}</p>
                </div>
              </div>
              <button onClick={handleLogout} className="bg-white text-sky-600 px-3 py-1.5 rounded-lg text-sm font-semibold">
                Logout
              </button>
            </div>
            <div className="flex space-x-2">
              {/* FIX 5: Correct routing */}
              <button onClick={() => router.push('/intake')} className="flex-1 bg-white bg-opacity-20 hover:bg-opacity-30 text-white py-2 rounded-lg text-sm font-semibold text-center">
                Create Ticket
              </button>
              <button onClick={() => router.push('/queue')} className="flex-1 bg-white bg-opacity-20 hover:bg-opacity-30 text-white py-2 rounded-lg text-sm font-semibold text-center">
                View Queue
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Tabs — TEAM MANAGEMENT: "Manage Technicians" → "Team" */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-4">
          <div className="flex space-x-6 overflow-x-auto">
            {(['team', 'reports', 'tickets'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-4 px-2 border-b-2 font-semibold transition-colors whitespace-nowrap ${
                  activeTab === tab
                    ? 'border-sky-500 text-sky-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab === 'team' ? 'Team' : tab === 'reports' ? 'Reports & KPIs' : 'Manage Tickets'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="container mx-auto px-4 py-6 md:py-8">
        <div className="max-w-5xl mx-auto">
          {/* ── TAB: Team (TEAM MANAGEMENT) ── */}
          {activeTab === 'team' && (
            <div className="card">
              <TeamManager members={teamMembers} onUpdate={loadTeamMembers} />
            </div>
          )}

          {/* ── TAB: Reports ── */}
          {activeTab === 'reports' && (
            <div className="space-y-6">
              {/* KPI Cards */}
              {kpis && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="card bg-gradient-to-br from-sky-500 to-sky-600 text-white">
                    <p className="text-xs font-semibold opacity-90 mb-1">TODAY</p>
                    <p className="text-3xl font-bold">{kpis.totalToday}</p>
                    <p className="text-xs opacity-80">Jobs Completed</p>
                  </div>
                  <div className="card bg-gradient-to-br from-green-500 to-green-600 text-white">
                    <p className="text-xs font-semibold opacity-90 mb-1">THIS WEEK</p>
                    <p className="text-3xl font-bold">{kpis.totalThisWeek}</p>
                    <p className="text-xs opacity-80">Jobs Completed</p>
                  </div>
                  <div className="card bg-gradient-to-br from-orange-500 to-orange-600 text-white">
                    <p className="text-xs font-semibold opacity-90 mb-1">AVG TIME</p>
                    <p className="text-3xl font-bold">{Math.round(kpis.avgTimeMinutes)}</p>
                    <p className="text-xs opacity-80">Minutes</p>
                  </div>
                  <div className="card bg-gradient-to-br from-red-500 to-red-600 text-white">
                    <p className="text-xs font-semibold opacity-90 mb-1">PENDING</p>
                    <p className="text-3xl font-bold">{kpis.pendingCount}</p>
                    <p className="text-xs opacity-80">In Queue</p>
                  </div>
                </div>
              )}

              {/* Period Filter */}
              <div className="card">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-gray-800">Detailed Reports</h2>
                    <p className="text-sm text-gray-500 mt-1">{totalCompleted} completed job{totalCompleted !== 1 ? 's' : ''} in period</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {(['today', 'week', 'month', 'all'] as const).map((p) => (
                      <button
                        key={p}
                        onClick={() => setReportPeriod(p)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                          reportPeriod === p
                            ? 'bg-sky-500 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {p === 'today' ? 'Today' : p === 'week' ? 'Week' : p === 'month' ? 'Month' : 'All Time'}
                      </button>
                    ))}
                    <button onClick={exportCSV} className="px-3 py-1.5 bg-green-100 text-green-800 hover:bg-green-200 rounded-lg text-sm font-semibold ml-2">
                      Export CSV
                    </button>
                  </div>
                </div>
              </div>

              {reportsLoading ? (
                <div className="text-center py-12 text-gray-500">Loading reports...</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Service Breakdown */}
                  <div className="card">
                    <h3 className="text-lg font-bold text-gray-800 mb-4">Jobs by Service Type</h3>
                    {serviceBreakdown.length > 0 ? (
                      <div className="space-y-3">
                        {serviceBreakdown.map((item) => {
                          const maxCount = Math.max(...serviceBreakdown.map(s => s.count));
                          const pct = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
                          return (
                            <div key={item.service_type}>
                              <div className="flex justify-between text-sm mb-1">
                                <span className="text-gray-700">{(SERVICE_TYPE_LABELS as any)[item.service_type] || item.service_type}</span>
                                <span className="font-bold">{item.count}</span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-4">
                                <div className="bg-sky-500 h-4 rounded-full transition-all" style={{ width: `${Math.max(pct, 5)}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-center py-4">No data for this period.</p>
                    )}
                  </div>

                  {/* Tech Performance */}
                  <div className="card">
                    <h3 className="text-lg font-bold text-gray-800 mb-4">Technician Performance</h3>
                    {techPerformance.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left py-2 text-gray-600">Technician</th>
                              <th className="text-right py-2 text-gray-600">Jobs</th>
                              <th className="text-right py-2 text-gray-600">Avg Time</th>
                            </tr>
                          </thead>
                          <tbody>
                            {techPerformance.map((tp) => (
                              <tr key={tp.name} className="border-b last:border-0">
                                <td className="py-2 font-semibold">{tp.name}</td>
                                <td className="py-2 text-right">{tp.count}</td>
                                <td className="py-2 text-right">{tp.avg_minutes}m</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-gray-500 text-center py-4">No data for this period.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── TAB: Manage Tickets (FIX 4A) ── */}
          {activeTab === 'tickets' && (
            <div className="space-y-4">
              <div className="card">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-gray-800">Manage Completed Tickets</h2>
                    <p className="text-sm text-gray-500 mt-1">
                      Exclude test tickets from KPI calculations
                    </p>
                  </div>
                  <button
                    onClick={handleExcludeAll}
                    className="px-4 py-2 bg-red-100 text-red-800 hover:bg-red-200 rounded-lg font-semibold text-sm"
                  >
                    Exclude All From Metrics
                  </button>
                </div>
              </div>

              <div className="card">
                <div className="space-y-2">
                  {completedTickets.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">No completed tickets.</p>
                  ) : (
                    completedTickets.map((t) => (
                      <div
                        key={t.id}
                        className={`flex items-center justify-between p-3 rounded-lg border ${
                          t.excluded_from_metrics ? 'bg-gray-100 border-gray-300 opacity-60' : 'bg-white border-gray-200'
                        }`}
                      >
                        <div>
                          <span className="font-bold text-gray-800">#{t.ticket_number}</span>
                          <span className="mx-2 text-gray-400">•</span>
                          <span className="text-gray-600">{(SERVICE_TYPE_LABELS as any)[t.service_type] || t.service_type}</span>
                          <span className="mx-2 text-gray-400">•</span>
                          <span className="text-sm text-gray-500">{t.vehicle}</span>
                          {t.customer_name && (
                            <>
                              <span className="mx-2 text-gray-400">•</span>
                              <span className="text-sm text-gray-500">{t.customer_name}</span>
                            </>
                          )}
                        </div>
                        <button
                          onClick={() => handleToggleExclude(t.id, t.excluded_from_metrics)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                            t.excluded_from_metrics
                              ? 'bg-green-100 text-green-800 hover:bg-green-200'
                              : 'bg-red-100 text-red-800 hover:bg-red-200'
                          }`}
                        >
                          {t.excluded_from_metrics ? 'Include in KPIs' : 'Exclude from KPIs'}
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
