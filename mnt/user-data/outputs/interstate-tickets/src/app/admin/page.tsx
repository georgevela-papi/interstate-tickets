'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, getSession, clearSession } from '@/lib/supabase';
import TechnicianManager from '@/components/TechnicianManager';
import type { Technician } from '@/lib/types';
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
interface HourlyData { hour: number; count: number; }
interface PriorityData { priority: string; count: number; }
interface DailyData { date: string; count: number; }

export default function AdminPage() {
  const [session, setSession] = useState<any>(null);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [kpis, setKpis] = useState<KPIData | null>(null);
  const [activeTab, setActiveTab] = useState<'technicians' | 'reports'>('technicians');
  const [reportPeriod, setReportPeriod] = useState<'today' | 'week' | 'month' | 'all'>('week');
  const [serviceBreakdown, setServiceBreakdown] = useState<ServiceBreakdown[]>([]);
  const [techPerformance, setTechPerformance] = useState<TechPerformance[]>([]);
  const [hourlyData, setHourlyData] = useState<HourlyData[]>([]);
  const [priorityData, setPriorityData] = useState<PriorityData[]>([]);
  const [dailyData, setDailyData] = useState<DailyData[]>([]);
  const [totalCompleted, setTotalCompleted] = useState(0);
  const [reportsLoading, setReportsLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const currentSession = getSession();
    if (!currentSession || currentSession.role !== 'MANAGER') {
      router.push('/');
      return;
    }
    setSession(currentSession);
    loadTechnicians();
    loadKPIs();
  }, [router]);

  useEffect(() => {
    if (activeTab === 'reports') loadDetailedReports();
  }, [activeTab, reportPeriod]);

  const loadTechnicians = async () => {
    const { data } = await supabase.from('technicians').select('*').order('name');
    if (data) setTechnicians(data);
  };

  const loadKPIs = async () => {
    try {
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - weekStart.getDay()); weekStart.setHours(0, 0, 0, 0);

      const { count: todayCount } = await supabase.from('tickets').select('id', { count: 'exact', head: true }).eq('status', 'COMPLETED').gte('completed_at', todayStart.toISOString());
      const { count: weekCount } = await supabase.from('tickets').select('id', { count: 'exact', head: true }).eq('status', 'COMPLETED').gte('completed_at', weekStart.toISOString());
      const { data: avgData } = await supabase.rpc('get_avg_completion_time');
      const { count: pendingCount } = await supabase.from('tickets').select('id', { count: 'exact', head: true }).eq('status', 'PENDING');

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
      case 'today': { const s = new Date(now); s.setHours(0,0,0,0); return s.toISOString(); }
      case 'week': { const s = new Date(now); s.setDate(s.getDate() - s.getDay()); s.setHours(0,0,0,0); return s.toISOString(); }
      case 'month': { return new Date(now.getFullYear(), now.getMonth(), 1).toISOString(); }
      case 'all': return null;
    }
  };

  const loadDetailedReports = async () => {
    setReportsLoading(true);
    try {
      const dateFilter = getDateFilter();
      let query = supabase.from('tickets').select('*').eq('status', 'COMPLETED');
      if (dateFilter) query = query.gte('completed_at', dateFilter);
      const { data: tickets } = await query;

      if (!tickets) { setReportsLoading(false); return; }
      setTotalCompleted(tickets.length);

      // Service breakdown
      const serviceMap: Record<string, number> = {};
      tickets.forEach(t => { serviceMap[t.service_type] = (serviceMap[t.service_type] || 0) + 1; });
      setServiceBreakdown(Object.entries(serviceMap).map(([service_type, count]) => ({ service_type, count })).sort((a, b) => b.count - a.count));

      // Tech performance
      const techMap: Record<string, { count: number; totalMinutes: number }> = {};
      tickets.forEach(t => {
        const techId = t.completed_by || 'Unknown';
        if (!techMap[techId]) techMap[techId] = { count: 0, totalMinutes: 0 };
        techMap[techId].count++;
        if (t.created_at && t.completed_at) {
          techMap[techId].totalMinutes += (new Date(t.completed_at).getTime() - new Date(t.created_at).getTime()) / 60000;
        }
      });
      const techIds = Object.keys(techMap).filter(id => id !== 'Unknown');
      let techNameMap: Record<string, string> = {};
      if (techIds.length > 0) {
        const { data: techData } = await supabase.from('technicians').select('id, name').in('id', techIds);
        if (techData) techData.forEach(t => { techNameMap[t.id] = t.name; });
      }
      setTechPerformance(Object.entries(techMap).map(([id, data]) => ({
        name: techNameMap[id] || 'Unknown', count: data.count,
        avg_minutes: data.count > 0 ? data.totalMinutes / data.count : 0,
      })).sort((a, b) => b.count - a.count));

      // Hourly
      const hourMap: Record<number, number> = {};
      tickets.forEach(t => { const h = new Date(t.created_at).getHours(); hourMap[h] = (hourMap[h] || 0) + 1; });
      setHourlyData(Object.entries(hourMap).map(([hour, count]) => ({ hour: parseInt(hour), count })).sort((a, b) => a.hour - b.hour));

      // Priority
      const prioMap: Record<string, number> = {};
      tickets.forEach(t => { prioMap[t.priority] = (prioMap[t.priority] || 0) + 1; });
      setPriorityData(Object.entries(prioMap).map(([priority, count]) => ({ priority, count })).sort((a, b) => b.count - a.count));

      // Daily
      const dayMap: Record<string, number> = {};
      tickets.forEach(t => { const d = new Date(t.completed_at || t.created_at).toISOString().split('T')[0]; dayMap[d] = (dayMap[d] || 0) + 1; });
      setDailyData(Object.entries(dayMap).map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date)));
    } catch (error) {
      console.error('Error loading reports:', error);
    } finally {
      setReportsLoading(false);
    }
  };

  const exportCSV = () => {
    if (serviceBreakdown.length === 0 && techPerformance.length === 0) return;
    const lines: string[] = [
      'Interstate Tires - Job Report',
      `Period: ${reportPeriod.charAt(0).toUpperCase() + reportPeriod.slice(1)}`,
      `Generated: ${new Date().toLocaleString()}`,
      `Total Completed: ${totalCompleted}`, '',
      'SERVICE TYPE BREAKDOWN', 'Service Type,Count,Percentage',
    ];
    serviceBreakdown.forEach(s => {
      const label = SERVICE_TYPE_LABELS[s.service_type as keyof typeof SERVICE_TYPE_LABELS] || s.service_type;
      lines.push(`${label},${s.count},${totalCompleted > 0 ? ((s.count / totalCompleted) * 100).toFixed(1) : '0'}%`);
    });
    lines.push('', 'TECHNICIAN PERFORMANCE', 'Technician,Jobs Completed,Avg Time (min)');
    techPerformance.forEach(t => lines.push(`${t.name},${t.count},${Math.round(t.avg_minutes)}`));
    lines.push('', 'PRIORITY DISTRIBUTION', 'Priority,Count');
    priorityData.forEach(p => lines.push(`${p.priority},${p.count}`));
    lines.push('', 'DAILY TREND', 'Date,Jobs Completed');
    dailyData.forEach(d => lines.push(`${d.date},${d.count}`));

    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `interstate-report-${reportPeriod}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const handleLogout = () => { clearSession(); router.push('/'); };

  const formatHour = (h: number) => {
    if (h === 0) return '12 AM'; if (h < 12) return `${h} AM`;
    if (h === 12) return '12 PM'; return `${h - 12} PM`;
  };

  const prioColors: Record<string, string> = { HIGH: 'bg-red-500', NORMAL: 'bg-gray-400', LOW: 'bg-blue-500' };

  if (!session) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-sky-500 text-white shadow-lg">
        <div className="container mx-auto px-4 py-4">
          {/* Desktop */}
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
              <button onClick={() => router.push('/intake')} className="bg-white bg-opacity-20 hover:bg-opacity-30 text-white px-4 py-2 rounded-lg font-semibold transition-colors">Create Ticket</button>
              <button onClick={() => router.push('/queue')} className="bg-white bg-opacity-20 hover:bg-opacity-30 text-white px-4 py-2 rounded-lg font-semibold transition-colors">View Queue</button>
              <button onClick={handleLogout} className="bg-white text-sky-600 px-4 py-2 rounded-lg font-semibold hover:bg-sky-50 transition-colors">Logout</button>
            </div>
          </div>
          {/* Mobile */}
          <div className="md:hidden">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-3">
                <div className="relative w-10 h-8">
                  <Image src="https://interstatetire.online/logo.png" alt="Interstate Tires" fill className="object-contain" />
                </div>
                <div>
                  <h1 className="text-lg font-bold leading-tight">Admin Dashboard</h1>
                  <p className="text-xs text-sky-100">Logged in as {session.name}</p>
                </div>
              </div>
              <button onClick={handleLogout} className="bg-white text-sky-600 px-3 py-1.5 rounded-lg text-sm font-semibold hover:bg-sky-50 transition-colors">Logout</button>
            </div>
            <div className="flex space-x-2">
              <button onClick={() => router.push('/intake')} className="flex-1 bg-white bg-opacity-20 hover:bg-opacity-30 text-white py-2 rounded-lg text-sm font-semibold transition-colors text-center">Create Ticket</button>
              <button onClick={() => router.push('/queue')} className="flex-1 bg-white bg-opacity-20 hover:bg-opacity-30 text-white py-2 rounded-lg text-sm font-semibold transition-colors text-center">View Queue</button>
            </div>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-4">
          <div className="flex space-x-8">
            <button onClick={() => setActiveTab('technicians')} className={`py-4 px-2 border-b-2 font-semibold transition-colors ${activeTab === 'technicians' ? 'border-sky-500 text-sky-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              Manage Technicians
            </button>
            <button onClick={() => setActiveTab('reports')} className={`py-4 px-2 border-b-2 font-semibold transition-colors ${activeTab === 'reports' ? 'border-sky-500 text-sky-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              Reports & KPIs
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="container mx-auto px-4 py-6 md:py-8">
        <div className="max-w-5xl mx-auto">
          {activeTab === 'technicians' ? (
            <div className="card">
              <TechnicianManager technicians={technicians} onUpdate={loadTechnicians} />
            </div>
          ) : (
            <div className="space-y-6">
              {/* KPI Cards */}
              {kpis && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                  <div className="card bg-gradient-to-br from-sky-500 to-sky-600 text-white">
                    <p className="text-xs md:text-sm font-semibold opacity-90 mb-1">TODAY</p>
                    <p className="text-3xl md:text-4xl font-bold">{kpis.totalToday}</p>
                    <p className="text-xs md:text-sm opacity-80">Jobs Completed</p>
                  </div>
                  <div className="card bg-gradient-to-br from-green-500 to-green-600 text-white">
                    <p className="text-xs md:text-sm font-semibold opacity-90 mb-1">THIS WEEK</p>
                    <p className="text-3xl md:text-4xl font-bold">{kpis.totalThisWeek}</p>
                    <p className="text-xs md:text-sm opacity-80">Jobs Completed</p>
                  </div>
                  <div className="card bg-gradient-to-br from-orange-500 to-orange-600 text-white">
                    <p className="text-xs md:text-sm font-semibold opacity-90 mb-1">AVG TIME</p>
                    <p className="text-3xl md:text-4xl font-bold">{Math.round(kpis.avgTimeMinutes)}</p>
                    <p className="text-xs md:text-sm opacity-80">Minutes</p>
                  </div>
                  <div className="card bg-gradient-to-br from-red-500 to-red-600 text-white">
                    <p className="text-xs md:text-sm font-semibold opacity-90 mb-1">PENDING</p>
                    <p className="text-3xl md:text-4xl font-bold">{kpis.pendingCount}</p>
                    <p className="text-xs md:text-sm opacity-80">In Queue</p>
                  </div>
                </div>
              )}

              {/* Period Filter & Export */}
              <div className="card">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-gray-800">Detailed Reports</h2>
                    <p className="text-sm text-gray-500 mt-1">{totalCompleted} completed job{totalCompleted !== 1 ? 's' : ''} in selected period</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {(['today', 'week', 'month', 'all'] as const).map(period => (
                      <button key={period} onClick={() => setReportPeriod(period)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${reportPeriod === period ? 'bg-sky-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                        {period === 'all' ? 'All Time' : period.charAt(0).toUpperCase() + period.slice(1)}
                      </button>
                    ))}
                    <button onClick={exportCSV} disabled={totalCompleted === 0}
                      className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                      📥 Export CSV
                    </button>
                  </div>
                </div>
              </div>

              {reportsLoading ? (
                <div className="text-center py-12"><div className="spinner mx-auto mb-4"></div><p className="text-gray-500">Loading reports...</p></div>
              ) : totalCompleted === 0 ? (
                <div className="card text-center py-12">
                  <p className="text-4xl mb-3">📊</p>
                  <p className="text-xl font-semibold text-gray-700">No completed jobs yet</p>
                  <p className="text-gray-500 mt-1">Complete some tickets and the reports will populate here.</p>
                </div>
              ) : (
                <>
                  {/* Jobs by Service Type */}
                  <div className="card">
                    <h3 className="text-lg font-bold text-gray-800 mb-4">Jobs by Service Type</h3>
                    <div className="space-y-3">
                      {serviceBreakdown.map(item => {
                        const pct = (item.count / totalCompleted) * 100;
                        const label = SERVICE_TYPE_LABELS[item.service_type as keyof typeof SERVICE_TYPE_LABELS] || item.service_type;
                        return (
                          <div key={item.service_type}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium text-gray-700">{label}</span>
                              <span className="text-sm text-gray-500">{item.count} ({pct.toFixed(1)}%)</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-3">
                              <div className="bg-sky-500 h-3 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Technician Performance */}
                  <div className="card">
                    <h3 className="text-lg font-bold text-gray-800 mb-4">Jobs Completed per Technician</h3>
                    {techPerformance.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-200">
                              <th className="text-left py-3 px-2 font-semibold text-gray-600">Technician</th>
                              <th className="text-center py-3 px-2 font-semibold text-gray-600">Jobs</th>
                              <th className="text-center py-3 px-2 font-semibold text-gray-600">Avg Time</th>
                              <th className="text-right py-3 px-2 font-semibold text-gray-600">Share</th>
                            </tr>
                          </thead>
                          <tbody>
                            {techPerformance.map((tech, i) => (
                              <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                                <td className="py-3 px-2 font-medium text-gray-800">{tech.name}</td>
                                <td className="py-3 px-2 text-center">
                                  <span className="inline-flex items-center justify-center bg-sky-100 text-sky-700 font-bold rounded-full w-10 h-10">{tech.count}</span>
                                </td>
                                <td className="py-3 px-2 text-center text-gray-600">{Math.round(tech.avg_minutes)} min</td>
                                <td className="py-3 px-2 text-right text-gray-500">{((tech.count / totalCompleted) * 100).toFixed(1)}%</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : <p className="text-gray-500 text-center py-4">No technician data available yet.</p>}
                  </div>

                  {/* Busiest Hours */}
                  <div className="card">
                    <h3 className="text-lg font-bold text-gray-800 mb-4">Busiest Hours</h3>
                    {hourlyData.length > 0 ? (
                      <div className="space-y-2">
                        {hourlyData.map(item => {
                          const maxCount = Math.max(...hourlyData.map(h => h.count));
                          const pct = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
                          return (
                            <div key={item.hour} className="flex items-center gap-3">
                              <span className="text-sm text-gray-600 w-16 text-right shrink-0">{formatHour(item.hour)}</span>
                              <div className="flex-1 bg-gray-200 rounded-full h-5">
                                <div className="bg-orange-400 h-5 rounded-full transition-all duration-500 flex items-center justify-end pr-2" style={{ width: `${Math.max(pct, 8)}%` }}>
                                  <span className="text-xs font-bold text-white">{item.count}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : <p className="text-gray-500 text-center py-4">No hourly data available yet.</p>}
                  </div>

                  {/* Priority Distribution */}
                  <div className="card">
                    <h3 className="text-lg font-bold text-gray-800 mb-4">Priority Distribution</h3>
                    {priorityData.length > 0 ? (
                      <div className="flex flex-wrap gap-4">
                        {priorityData.map(item => (
                          <div key={item.priority} className="flex-1 min-w-[120px] bg-gray-50 rounded-xl p-4 text-center border border-gray-200">
                            <div className={`inline-block w-4 h-4 rounded-full mb-2 ${prioColors[item.priority] || 'bg-gray-400'}`} />
                            <p className="text-2xl font-bold text-gray-800">{item.count}</p>
                            <p className="text-sm text-gray-500">{item.priority} ({totalCompleted > 0 ? ((item.count / totalCompleted) * 100).toFixed(1) : '0'}%)</p>
                          </div>
                        ))}
                      </div>
                    ) : <p className="text-gray-500 text-center py-4">No priority data available yet.</p>}
                  </div>

                  {/* Daily Trend */}
                  {dailyData.length > 1 && (
                    <div className="card">
                      <h3 className="text-lg font-bold text-gray-800 mb-4">Daily Completion Trend</h3>
                      <div className="space-y-2">
                        {dailyData.slice(-14).map(item => {
                          const maxCount = Math.max(...dailyData.map(d => d.count));
                          const pct = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
                          const dateLabel = new Date(item.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                          return (
                            <div key={item.date} className="flex items-center gap-3">
                              <span className="text-sm text-gray-600 w-24 text-right shrink-0">{dateLabel}</span>
                              <div className="flex-1 bg-gray-200 rounded-full h-5">
                                <div className="bg-green-500 h-5 rounded-full transition-all duration-500 flex items-center justify-end pr-2" style={{ width: `${Math.max(pct, 8)}%` }}>
                                  <span className="text-xs font-bold text-white">{item.count}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
