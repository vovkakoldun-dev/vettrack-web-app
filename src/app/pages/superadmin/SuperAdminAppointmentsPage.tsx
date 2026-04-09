import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Calendar, Clock, Loader2, Activity, TrendingUp, Users,
} from 'lucide-react';
import { useAppointments } from '../../hooks/useAppointments';
import { getOrgContext } from '../../hooks/useOrgContext';
import { supabase } from '../../../lib/supabase';
import { ConnectionStatusBadge } from '../../components/ConnectionStatusBadge';
import AdminBookingsPage from '../admin/AdminBookingsPage';

// ─── Types ──────────────────────────────────────────────────────────────────
interface StaffMember {
  id: string;
  role: string;
  profiles: { first_name: string; last_name: string } | null;
}

// ─── Constants ──────────────────────────────────────────────────────────────
const VET_COLORS = ['#818CF8', '#38BDF8', '#4ADE80', '#F4A261', '#F472B6', '#A78BFA', '#EF4444'];

const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  Confirmed:     { bg: '#74C69D20', color: 'var(--brand-green-text)' },
  Pending:       { bg: '#F4A26120', color: '#F4A261' },
  Completed:     { bg: '#6B728020', color: 'var(--text-secondary)' },
  Cancelled:     { bg: '#d4183d20', color: '#d4183d' },
  'In Progress': { bg: '#3B82F620', color: '#3B82F6' },
  Scheduled:     { bg: '#3B82F620', color: '#3B82F6' },
  'No Show':     { bg: '#6B728020', color: 'var(--text-secondary)' },
};

type PageTab = 'schedule' | 'overview';

// ─── Helpers ────────────────────────────────────────────────────────────────
function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatDisplayDate(d: Date): string {
  return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function getInitials(first: string, last: string): string {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
}

function startOfWeek(d: Date): Date {
  const copy = new Date(d);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function endOfWeek(d: Date): Date {
  const s = startOfWeek(d);
  s.setDate(s.getDate() + 6);
  s.setHours(23, 59, 59, 999);
  return s;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

function getStatusStyle(status: string) {
  return STATUS_STYLES[status] ?? { bg: '#6B728020', color: 'var(--text-secondary)' };
}

// ─── Component ──────────────────────────────────────────────────────────────
export default function SuperAdminAppointmentsPage() {
  const [activeTab, setActiveTab] = useState<PageTab>('schedule');

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════
  return (
    <div style={{ padding: '32px 32px 0', maxWidth: 1440, margin: '0 auto' }}>
      {/* ── Header ────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        marginBottom: activeTab === 'schedule' ? 12 : 28, flexWrap: 'wrap', gap: 12,
      }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Appointments
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 4 }}>
            {formatDisplayDate(new Date())}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Tab switch */}
          <div style={{
            display: 'flex', borderRadius: 10, overflow: 'hidden',
            border: '1px solid var(--border-color)', background: 'var(--surface-elevated)',
          }}>
            {(['schedule', 'overview'] as PageTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: '8px 20px', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer',
                  background: activeTab === tab ? '#F4A261' : 'transparent',
                  color: activeTab === tab ? '#fff' : 'var(--text-secondary)',
                  transition: 'all 0.2s',
                }}
              >
                {tab === 'schedule' ? 'Schedule' : 'Overview'}
              </button>
            ))}
          </div>
          <ConnectionStatusBadge />
        </div>
      </div>

      {activeTab === 'schedule' ? (
        /* ── Schedule tab: reuse the full AdminBookingsPage experience ── */
        <AdminBookingsPage hideHeader wrapperClassName="" />
      ) : (
        <OverviewTab />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// OVERVIEW TAB
// ═══════════════════════════════════════════════════════════════════════
function OverviewTab() {
  const { appointments, loading } = useAppointments();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);

  const fetchStaff = useCallback(async () => {
    setStaffLoading(true);
    try {
      const { organizationId } = await getOrgContext();
      const { data } = await supabase
        .from('staff')
        .select('id, role, profiles:profiles!staff_profile_org_fkey(first_name, last_name)')
        .eq('organization_id', organizationId)
        .in('role', ['veterinarian', 'senior_veterinarian', 'specialist'])
        .eq('status', 'Active');
      if (data) setStaff(data as StaffMember[]);
    } catch {
      // Silently fail — staff list will be empty
    }
    setStaffLoading(false);
  }, []);

  useEffect(() => { fetchStaff(); }, [fetchStaff]);

  // ─── KPIs ─────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const today = new Date();
    const todayStr = formatDate(today);
    const weekStart = startOfWeek(today);
    const weekEnd = endOfWeek(today);
    const monthStart = startOfMonth(today);
    const monthEnd = endOfMonth(today);

    const todayCount = appointments.filter((a) => a.scheduled_at.startsWith(todayStr)).length;

    const weekCount = appointments.filter((a) => {
      const d = new Date(a.scheduled_at);
      return d >= weekStart && d <= weekEnd;
    }).length;

    const monthAppts = appointments.filter((a) => {
      const d = new Date(a.scheduled_at);
      return d >= monthStart && d <= monthEnd;
    });
    const completedMonth = monthAppts.filter((a) => a.status === 'Completed').length;
    const completionRate = monthAppts.length > 0 ? Math.round((completedMonth / monthAppts.length) * 100) : 0;

    const withDuration = appointments.filter((a) => a.duration_minutes && a.duration_minutes > 0);
    const avgDuration = withDuration.length > 0
      ? Math.round(withDuration.reduce((sum, a) => sum + (a.duration_minutes ?? 0), 0) / withDuration.length)
      : 0;

    return { todayCount, weekCount, completionRate, avgDuration };
  }, [appointments]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 400 }}>
        <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: '#F4A261' }} />
        <span style={{ marginLeft: 12, color: 'var(--text-secondary)', fontSize: 15 }}>Loading appointments...</span>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    );
  }

  const today = new Date();
  const todayStr = formatDate(today);
  const weekStart = startOfWeek(today);
  const weekEnd = endOfWeek(today);
  const next7Start = new Date(today); next7Start.setHours(0, 0, 0, 0);
  const next7End = new Date(today); next7End.setDate(next7End.getDate() + 7); next7End.setHours(23, 59, 59, 999);

  const upcomingAll = appointments
    .filter((a) => {
      const d = new Date(a.scheduled_at);
      return d >= next7Start && d <= next7End;
    })
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());

  return (
    <div style={{ paddingBottom: 32 }}>
      {/* ── KPI Cards ────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
        <KPICard icon={<Calendar size={20} />} label="Today's Appointments" value={kpis.todayCount} color="#F4A261" />
        <KPICard icon={<TrendingUp size={20} />} label="This Week" value={kpis.weekCount} color="#3B82F6" />
        <KPICard icon={<Activity size={20} />} label="Completion Rate" value={`${kpis.completionRate}%`} color="var(--brand-green-text)" />
        <KPICard icon={<Clock size={20} />} label="Avg Duration" value={`${kpis.avgDuration} min`} color="#818CF8" />
      </div>

      {/* ── Staff Workload ───────────────────────────────────────────── */}
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>
          Staff Workload
        </h2>

        {staffLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 40, justifyContent: 'center' }}>
            <Loader2 size={20} style={{ animation: 'spin 1s linear infinite', color: '#F4A261' }} />
            <span style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Loading staff...</span>
          </div>
        ) : staff.length === 0 ? (
          <div style={{
            padding: '40px 20px', textAlign: 'center', background: 'var(--surface-white)',
            borderRadius: 14, border: '1px solid var(--border-color)',
          }}>
            <Users size={32} style={{ color: 'var(--text-secondary)', opacity: 0.4, marginBottom: 8 }} />
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0 }}>No active veterinary staff found.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
            {staff.map((vet, idx) => {
              const vetName = vet.profiles ? `${vet.profiles.first_name} ${vet.profiles.last_name}` : 'Unknown';
              const initials = vet.profiles ? getInitials(vet.profiles.first_name, vet.profiles.last_name) : '??';
              const accentColor = VET_COLORS[idx % VET_COLORS.length];

              const vetAppts = appointments.filter((a) => a.staff?.id === vet.id);
              const vetToday = vetAppts.filter((a) => a.scheduled_at.startsWith(todayStr));
              const vetWeek = vetAppts.filter((a) => {
                const d = new Date(a.scheduled_at);
                return d >= weekStart && d <= weekEnd;
              });
              const monthStart = startOfMonth(today);
              const monthEnd = endOfMonth(today);
              const vetMonth = vetAppts.filter((a) => {
                const d = new Date(a.scheduled_at);
                return d >= monthStart && d <= monthEnd;
              });

              return (
                <div key={vet.id} style={{
                  background: 'var(--surface-white)', borderRadius: 14, border: '1px solid var(--border-color)',
                  padding: 20, transition: 'box-shadow 0.15s',
                }}
                  onMouseEnter={(e) => (e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.06)')}
                  onMouseLeave={(e) => (e.currentTarget.style.boxShadow = 'none')}
                >
                  {/* Vet header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                    <div style={{
                      width: 42, height: 42, borderRadius: '50%', background: accentColor + '20',
                      color: accentColor, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 15, fontWeight: 700, flexShrink: 0,
                    }}>
                      {initials}
                    </div>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                        Dr. {vetName}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
                        {vet.role.replace(/_/g, ' ')}
                      </div>
                    </div>
                  </div>

                  {/* Counts */}
                  <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                    <CountChip label="Today" value={vetToday.length} color="#F4A261" />
                    <CountChip label="Week" value={vetWeek.length} color="#3B82F6" />
                    <CountChip label="Month" value={vetMonth.length} color="var(--brand-green-text)" />
                  </div>

                  {/* Today's appointments */}
                  {vetToday.length === 0 ? (
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', fontStyle: 'italic', margin: 0 }}>
                      No appointments today
                    </p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {vetToday.map((a) => {
                        const ss = getStatusStyle(a.status);
                        return (
                          <div key={a.id} style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '8px 10px', borderRadius: 8, background: 'var(--surface-elevated)',
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                              <span style={{ fontSize: 12, fontWeight: 600, color: '#F4A261', whiteSpace: 'nowrap' }}>
                                {formatTime(a.scheduled_at)}
                              </span>
                              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {a.pets?.name ?? 'Unknown'}
                              </span>
                              <span style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                                {a.services?.name ?? ''}
                              </span>
                            </div>
                            <span style={{
                              padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600,
                              background: ss.bg, color: ss.color, whiteSpace: 'nowrap', flexShrink: 0,
                            }}>
                              {a.status}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Upcoming Appointments Table ──────────────────────────────── */}
      <div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>
          Upcoming Appointments (Next 7 Days)
        </h2>

        {upcomingAll.length === 0 ? (
          <div style={{
            padding: '40px 20px', textAlign: 'center', background: 'var(--surface-white)',
            borderRadius: 14, border: '1px solid var(--border-color)',
          }}>
            <Calendar size={32} style={{ color: 'var(--text-secondary)', opacity: 0.4, marginBottom: 8 }} />
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0 }}>No upcoming appointments in the next 7 days.</p>
          </div>
        ) : (
          <div style={{
            background: 'var(--surface-white)', borderRadius: 14, border: '1px solid var(--border-color)',
            overflow: 'hidden',
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--surface-elevated)' }}>
                  {['Date', 'Time', 'Pet', 'Owner', 'Service', 'Assigned Vet', 'Status'].map((h) => (
                    <th key={h} style={{
                      padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600,
                      color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5,
                      borderBottom: '1px solid var(--border-color)',
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {upcomingAll.map((appt) => {
                  const ss = getStatusStyle(appt.status);
                  const d = new Date(appt.scheduled_at);
                  return (
                    <tr key={appt.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '12px 16px', fontSize: 14, color: 'var(--text-primary)', fontWeight: 500 }}>
                        {d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' })}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 14, color: 'var(--text-primary)' }}>
                        {formatTime(appt.scheduled_at)}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>
                        {appt.pets?.name ?? '—'}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 14, color: 'var(--text-primary)' }}>
                        {appt.clients ? `${appt.clients.first_name} ${appt.clients.last_name}` : '—'}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 14, color: 'var(--text-primary)' }}>
                        {appt.services?.name ?? '—'}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 14, color: 'var(--text-primary)' }}>
                        {appt.staff?.profiles
                          ? `Dr. ${appt.staff.profiles.first_name} ${appt.staff.profiles.last_name}`
                          : '—'}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          display: 'inline-block', padding: '4px 12px', borderRadius: 20, fontSize: 12,
                          fontWeight: 600, background: ss.bg, color: ss.color,
                        }}>
                          {appt.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function KPICard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number | string; color: string }) {
  return (
    <div style={{
      background: 'var(--surface-white)', borderRadius: 14, border: '1px solid var(--border-color)',
      padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 16,
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 12, background: color + '18',
        display: 'flex', alignItems: 'center', justifyContent: 'center', color, flexShrink: 0,
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>{value}</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>{label}</div>
      </div>
    </div>
  );
}

function CountChip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{
      flex: 1, textAlign: 'center', padding: '8px 4px', borderRadius: 8,
      background: 'var(--surface-elevated)',
    }}>
      <div style={{ fontSize: 18, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{label}</div>
    </div>
  );
}
