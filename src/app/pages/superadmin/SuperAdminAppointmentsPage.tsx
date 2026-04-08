import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Calendar, List, LayoutGrid, ChevronLeft, ChevronRight, Search,
  Plus, Clock, User, Loader2, Activity, TrendingUp, Users, PawPrint,
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '../../components/ui/dialog';
import { useAppointments } from '../../hooks/useAppointments';
import { getOrgContext } from '../../hooks/useOrgContext';
import { supabase } from '../../../lib/supabase';
import { ConnectionStatusBadge } from '../../components/ConnectionStatusBadge';

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

type ViewMode = 'list' | 'schedule' | 'month';
type FilterTab = 'all' | 'upcoming' | 'completed' | 'cancelled';
type PageTab = 'schedule' | 'overview';

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
];

const TIME_SLOTS: string[] = [];
for (let h = 8; h <= 17; h++) {
  TIME_SLOTS.push(`${h}:00`);
  TIME_SLOTS.push(`${h}:30`);
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatDisplayDate(d: Date): string {
  return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function formatShortDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function getInitials(first: string, last: string): string {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
}

function isSameDay(d1: Date, d2: Date): boolean {
  return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
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
  const { appointments, loading } = useAppointments();

  // Page-level state
  const [activeTab, setActiveTab] = useState<PageTab>('schedule');

  // Schedule tab state
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAppt, setSelectedAppt] = useState<any>(null);

  // Overview tab state
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);

  // ─── Fetch staff for overview ──────────────────────────────────────────
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

  useEffect(() => {
    if (activeTab === 'overview') fetchStaff();
  }, [activeTab, fetchStaff]);

  // ─── Date navigation ──────────────────────────────────────────────────
  const navigateDate = (dir: -1 | 1) => {
    const d = new Date(selectedDate);
    if (viewMode === 'month') {
      d.setMonth(d.getMonth() + dir);
    } else {
      d.setDate(d.getDate() + dir);
    }
    setSelectedDate(d);
  };

  const goToday = () => setSelectedDate(new Date());

  // ─── Filtered appointments for schedule tab ────────────────────────────
  const filteredAppointments = useMemo(() => {
    const dateStr = formatDate(selectedDate);
    let list = appointments;

    // Date filter for schedule view only (list shows all, month has its own logic)
    if (viewMode === 'schedule') {
      list = list.filter((a) => a.scheduled_at.startsWith(dateStr));
    }

    // Status filter
    const now = new Date();
    if (filterTab === 'upcoming') {
      list = list.filter((a) => ['Scheduled', 'Confirmed', 'Pending'].includes(a.status) && new Date(a.scheduled_at) >= now);
    } else if (filterTab === 'completed') {
      list = list.filter((a) => a.status === 'Completed');
    } else if (filterTab === 'cancelled') {
      list = list.filter((a) => a.status === 'Cancelled');
    }

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((a) =>
        (a.pets?.name ?? '').toLowerCase().includes(q) ||
        (a.clients ? `${a.clients.first_name} ${a.clients.last_name}` : '').toLowerCase().includes(q) ||
        (a.services?.name ?? '').toLowerCase().includes(q) ||
        (a.staff?.profiles ? `${a.staff.profiles.first_name} ${a.staff.profiles.last_name}` : '').toLowerCase().includes(q)
      );
    }

    return list;
  }, [appointments, selectedDate, viewMode, filterTab, searchQuery]);

  // ─── Month view data ──────────────────────────────────────────────────
  const monthCalendar = useMemo(() => {
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    // Start from Monday
    let startDay = firstDay.getDay() - 1;
    if (startDay < 0) startDay = 6;

    const days: { date: Date; inMonth: boolean }[] = [];

    // Previous month padding
    for (let i = startDay - 1; i >= 0; i--) {
      const d = new Date(year, month, -i);
      days.push({ date: d, inMonth: false });
    }

    // Current month
    for (let d = 1; d <= lastDay.getDate(); d++) {
      days.push({ date: new Date(year, month, d), inMonth: true });
    }

    // Fill remaining (up to 42 for 6 rows)
    while (days.length < 42) {
      const nextDate = new Date(year, month + 1, days.length - lastDay.getDate() - startDay + 1);
      days.push({ date: nextDate, inMonth: false });
    }

    return days;
  }, [selectedDate]);

  const appointmentsByDate = useMemo(() => {
    const map: Record<string, typeof appointments> = {};
    for (const a of appointments) {
      const key = a.scheduled_at.slice(0, 10);
      if (!map[key]) map[key] = [];
      map[key].push(a);
    }
    return map;
  }, [appointments]);

  // ─── Overview KPIs ────────────────────────────────────────────────────
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

  // ─── Loading skeleton ─────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ padding: '32px', maxWidth: 1400, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 400 }}>
          <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: '#F4A261' }} />
          <span style={{ marginLeft: 12, color: 'var(--text-secondary)', fontSize: 15 }}>Loading appointments...</span>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════
  return (
    <div style={{ padding: '32px', maxWidth: 1400, margin: '0 auto' }}>
      {/* ── Header ────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Appointments</h1>
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

      {activeTab === 'schedule' ? renderScheduleTab() : renderOverviewTab()}

      {/* ── Appointment Detail Dialog ──────────────────────────────── */}
      <Dialog open={!!selectedAppt} onOpenChange={(open) => { if (!open) setSelectedAppt(null); }}>
        <DialogContent style={{
          backgroundColor: 'var(--surface-white)', border: '1px solid var(--border-color)',
          borderRadius: 12, maxWidth: 520, padding: 0,
        }}>
          {selectedAppt && (() => {
            const ss = getStatusStyle(selectedAppt.status);
            const petName = selectedAppt.pets?.name ?? 'Unknown';
            const ownerName = selectedAppt.clients ? `${selectedAppt.clients.first_name} ${selectedAppt.clients.last_name}` : '—';
            const vetName = selectedAppt.staff?.profiles ? `Dr. ${selectedAppt.staff.profiles.first_name} ${selectedAppt.staff.profiles.last_name}` : '—';
            const service = selectedAppt.services?.name ?? '—';
            const time = formatTime(selectedAppt.scheduled_at);
            const date = new Date(selectedAppt.scheduled_at).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
            return (
              <>
                <DialogHeader style={{ padding: '20px 24px 0' }}>
                  <DialogTitle style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
                    Appointment Details
                  </DialogTitle>
                </DialogHeader>
                <div style={{ padding: '16px 24px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {/* Status badge */}
                  <div>
                    <span style={{
                      display: 'inline-block', padding: '5px 14px', borderRadius: 20,
                      fontSize: 13, fontWeight: 600, background: ss.bg, color: ss.color,
                    }}>
                      {selectedAppt.status}
                    </span>
                  </div>

                  {/* Pet & Owner */}
                  <div style={{
                    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16,
                    padding: 16, borderRadius: 10, backgroundColor: 'var(--surface-elevated)',
                  }}>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Pet</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: '50%', overflow: 'hidden',
                          background: 'var(--surface-white)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        }}>
                          {selectedAppt.pets?.photo_url ? (
                            <img src={selectedAppt.pets.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <PawPrint size={14} style={{ color: 'var(--text-secondary)' }} />
                          )}
                        </div>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{petName}</div>
                          {selectedAppt.pets?.species && (
                            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{selectedAppt.pets.species}</div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Owner</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{ownerName}</div>
                    </div>
                  </div>

                  {/* Details grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Date</div>
                      <div style={{ fontSize: 14, color: 'var(--text-primary)' }}>{date}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Time</div>
                      <div style={{ fontSize: 14, color: 'var(--text-primary)' }}>
                        {time}{selectedAppt.duration_minutes ? ` (${selectedAppt.duration_minutes} min)` : ''}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Service</div>
                      <div style={{ fontSize: 14, color: 'var(--text-primary)' }}>{service}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Veterinarian</div>
                      <div style={{ fontSize: 14, color: 'var(--text-primary)' }}>{vetName}</div>
                    </div>
                  </div>

                  {/* Notes */}
                  {selectedAppt.notes && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Notes</div>
                      <div style={{
                        fontSize: 14, color: 'var(--text-primary)', padding: 12, borderRadius: 8,
                        backgroundColor: 'var(--surface-elevated)', lineHeight: 1.5,
                      }}>
                        {selectedAppt.notes}
                      </div>
                    </div>
                  )}
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════════
  // SCHEDULE TAB
  // ═══════════════════════════════════════════════════════════════════════
  function renderScheduleTab() {
    return (
      <div>
        {/* ── Toolbar ──────────────────────────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 20,
          padding: '16px 20px', background: 'var(--surface-white)', borderRadius: 14,
          border: '1px solid var(--border-color)',
        }}>
          {/* View mode toggle */}
          <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border-color)' }}>
            {([
              { mode: 'list' as ViewMode, icon: <List size={16} /> },
              { mode: 'schedule' as ViewMode, icon: <LayoutGrid size={16} /> },
              { mode: 'month' as ViewMode, icon: <Calendar size={16} /> },
            ]).map(({ mode, icon }) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                style={{
                  padding: '7px 12px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center',
                  background: viewMode === mode ? '#F4A261' : 'transparent',
                  color: viewMode === mode ? '#fff' : 'var(--text-secondary)',
                  transition: 'all 0.15s',
                }}
                title={mode.charAt(0).toUpperCase() + mode.slice(1)}
              >
                {icon}
              </button>
            ))}
          </div>

          {/* Date navigation */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button onClick={() => navigateDate(-1)} style={navBtnStyle}><ChevronLeft size={16} /></button>
            <button onClick={goToday} style={{
              ...navBtnStyle, padding: '6px 14px', fontSize: 13, fontWeight: 600, minWidth: 'auto',
            }}>
              Today
            </button>
            <button onClick={() => navigateDate(1)} style={navBtnStyle}><ChevronRight size={16} /></button>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginLeft: 8 }}>
              {viewMode === 'month'
                ? selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
                : formatShortDate(selectedDate)}
            </span>
          </div>

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {/* Filter tabs */}
          <div style={{ display: 'flex', gap: 4 }}>
            {FILTER_TABS.map((ft) => (
              <button
                key={ft.key}
                onClick={() => setFilterTab(ft.key)}
                style={{
                  padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  fontSize: 13, fontWeight: 500,
                  background: filterTab === ft.key ? '#F4A26118' : 'transparent',
                  color: filterTab === ft.key ? '#F4A261' : 'var(--text-secondary)',
                  transition: 'all 0.15s',
                }}
              >
                {ft.label}
              </button>
            ))}
          </div>

          {/* Search */}
          <div style={{ position: 'relative' }}>
            <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                padding: '7px 12px 7px 32px', borderRadius: 8, border: '1px solid var(--border-color)',
                background: 'var(--surface-elevated)', color: 'var(--text-primary)', fontSize: 13,
                outline: 'none', width: 180,
              }}
            />
          </div>

          {/* New appointment placeholder */}
          <button
            onClick={() => { /* placeholder */ }}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10,
              border: 'none', background: '#F4A261', color: '#fff', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', transition: 'opacity 0.15s',
            }}
          >
            <Plus size={15} /> New Appointment
          </button>
        </div>

        {/* ── View content ─────────────────────────────────────────────── */}
        {viewMode === 'list' && renderListView()}
        {viewMode === 'schedule' && renderScheduleView()}
        {viewMode === 'month' && renderMonthView()}
      </div>
    );
  }

  // ─── List View ────────────────────────────────────────────────────────
  function renderListView() {
    if (filteredAppointments.length === 0) {
      return (
        <div style={{
          padding: '60px 20px', textAlign: 'center', background: 'var(--surface-white)',
          borderRadius: 14, border: '1px solid var(--border-color)',
        }}>
          <Calendar size={40} style={{ color: 'var(--text-secondary)', opacity: 0.4, marginBottom: 12 }} />
          <p style={{ fontSize: 15, color: 'var(--text-secondary)', margin: 0 }}>No appointments found</p>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', opacity: 0.7, marginTop: 4 }}>
            Try adjusting your filters or selecting a different date.
          </p>
        </div>
      );
    }

    return (
      <div style={{
        background: 'var(--surface-white)', borderRadius: 14, border: '1px solid var(--border-color)',
        overflow: 'hidden',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--surface-elevated)' }}>
              {['Time', 'Pet', 'Owner', 'Service', 'Vet', 'Status', 'Actions'].map((h) => (
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
            {filteredAppointments.map((appt) => {
              const ss = getStatusStyle(appt.status);
              return (
                <tr
                  key={appt.id}
                  style={{ borderBottom: '1px solid var(--border-color)', cursor: 'pointer', transition: 'background 0.1s' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-elevated)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  onClick={() => setSelectedAppt(appt)}
                >
                  {/* Time */}
                  <td style={{ padding: '14px 16px', fontSize: 14, color: 'var(--text-primary)', fontWeight: 500, whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Clock size={14} style={{ color: 'var(--text-secondary)' }} />
                      {formatTime(appt.scheduled_at)}
                    </div>
                    {appt.duration_minutes && (
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                        {appt.duration_minutes} min
                      </div>
                    )}
                  </td>

                  {/* Pet */}
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 34, height: 34, borderRadius: '50%', overflow: 'hidden',
                        background: 'var(--surface-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                      }}>
                        {appt.pets?.photo_url ? (
                          <img src={appt.pets.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <PawPrint size={16} style={{ color: 'var(--text-secondary)' }} />
                        )}
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                          {appt.pets?.name ?? 'Unknown'}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                          {appt.pets?.species ?? ''}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Owner */}
                  <td style={{ padding: '14px 16px', fontSize: 14, color: 'var(--text-primary)' }}>
                    {appt.clients ? `${appt.clients.first_name} ${appt.clients.last_name}` : '—'}
                  </td>

                  {/* Service */}
                  <td style={{ padding: '14px 16px', fontSize: 14, color: 'var(--text-primary)' }}>
                    {appt.services?.name ?? '—'}
                  </td>

                  {/* Vet */}
                  <td style={{ padding: '14px 16px', fontSize: 14, color: 'var(--text-primary)' }}>
                    {appt.staff?.profiles
                      ? `Dr. ${appt.staff.profiles.first_name} ${appt.staff.profiles.last_name}`
                      : '—'}
                  </td>

                  {/* Status */}
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{
                      display: 'inline-block', padding: '4px 12px', borderRadius: 20, fontSize: 12,
                      fontWeight: 600, background: ss.bg, color: ss.color,
                    }}>
                      {appt.status}
                    </span>
                  </td>

                  {/* Actions */}
                  <td style={{ padding: '14px 16px' }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); setSelectedAppt(appt); }}
                      style={{
                        padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border-color)',
                        background: 'transparent', color: 'var(--text-secondary)', fontSize: 12,
                        cursor: 'pointer',
                      }}
                    >
                      View
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  // ─── Schedule View (time slots) ───────────────────────────────────────
  function renderScheduleView() {
    return (
      <div style={{
        background: 'var(--surface-white)', borderRadius: 14, border: '1px solid var(--border-color)',
        overflow: 'hidden',
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', minHeight: 600 }}>
          {/* Time labels */}
          <div style={{ borderRight: '1px solid var(--border-color)' }}>
            {TIME_SLOTS.map((slot) => (
              <div key={slot} style={{
                height: 60, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end',
                paddingRight: 12, paddingTop: 4, fontSize: 12, color: 'var(--text-secondary)',
                fontWeight: 500, borderBottom: '1px solid var(--border-color)',
              }}>
                {formatSlotLabel(slot)}
              </div>
            ))}
          </div>

          {/* Appointment blocks */}
          <div style={{ position: 'relative' }}>
            {/* Grid lines */}
            {TIME_SLOTS.map((slot, i) => (
              <div key={slot} style={{
                position: 'absolute', top: i * 60, left: 0, right: 0, height: 60,
                borderBottom: '1px solid var(--border-color)',
              }} />
            ))}

            {/* Appointments */}
            {filteredAppointments.map((appt) => {
              const d = new Date(appt.scheduled_at);
              const h = d.getHours();
              const m = d.getMinutes();
              const slotIndex = (h - 8) * 2 + (m >= 30 ? 1 : 0);
              if (slotIndex < 0 || slotIndex >= TIME_SLOTS.length) return null;

              const duration = appt.duration_minutes ?? 30;
              const heightPx = (duration / 30) * 60;
              const offsetMin = m % 30;
              const topPx = slotIndex * 60 + (offsetMin / 30) * 60;

              const ss = getStatusStyle(appt.status);

              return (
                <div key={appt.id} style={{
                  position: 'absolute', top: topPx, left: 8, right: 8, height: Math.max(heightPx - 4, 28),
                  background: ss.bg, borderRadius: 8, borderLeft: `4px solid ${ss.color}`,
                  padding: '6px 10px', overflow: 'hidden', cursor: 'pointer',
                  transition: 'box-shadow 0.15s',
                }}
                  onMouseEnter={(e) => (e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)')}
                  onMouseLeave={(e) => (e.currentTarget.style.boxShadow = 'none')}
                >
                  <div style={{ fontSize: 13, fontWeight: 600, color: ss.color, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {appt.pets?.name ?? 'Unknown'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {appt.services?.name ?? '—'} &middot;{' '}
                    {appt.staff?.profiles ? `Dr. ${appt.staff.profiles.last_name}` : 'Unassigned'} &middot;{' '}
                    {duration} min
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ─── Month View ───────────────────────────────────────────────────────
  function renderMonthView() {
    const today = new Date();
    const dayHeaders = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    return (
      <div style={{
        background: 'var(--surface-white)', borderRadius: 14, border: '1px solid var(--border-color)',
        overflow: 'hidden',
      }}>
        {/* Day headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--border-color)' }}>
          {dayHeaders.map((d) => (
            <div key={d} style={{
              padding: '10px 8px', textAlign: 'center', fontSize: 12, fontWeight: 600,
              color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5,
            }}>
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
          {monthCalendar.map(({ date, inMonth }, idx) => {
            const key = formatDate(date);
            const dayAppts = appointmentsByDate[key] ?? [];
            const isToday = isSameDay(date, today);
            const isSelected = isSameDay(date, selectedDate);

            return (
              <div
                key={idx}
                onClick={() => {
                  setSelectedDate(date);
                  setViewMode('list');
                }}
                style={{
                  minHeight: 90, padding: 8, borderRight: (idx + 1) % 7 !== 0 ? '1px solid var(--border-color)' : undefined,
                  borderBottom: '1px solid var(--border-color)',
                  cursor: 'pointer',
                  opacity: inMonth ? 1 : 0.4,
                  background: isSelected ? '#F4A26110' : isToday ? '#F4A26108' : 'transparent',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = 'var(--surface-elevated)'; }}
                onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = isToday ? '#F4A26108' : 'transparent'; }}
              >
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4,
                }}>
                  <span style={{
                    fontSize: 13, fontWeight: isToday ? 700 : 500,
                    color: isToday ? '#F4A261' : 'var(--text-primary)',
                    width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: isToday ? '#F4A26120' : 'transparent',
                  }}>
                    {date.getDate()}
                  </span>
                  {dayAppts.length > 0 && (
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>
                      {dayAppts.length}
                    </span>
                  )}
                </div>
                {/* Status dots */}
                <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                  {dayAppts.slice(0, 5).map((a) => {
                    const ss = getStatusStyle(a.status);
                    return (
                      <div key={a.id} style={{
                        width: 7, height: 7, borderRadius: '50%', background: ss.color,
                      }} />
                    );
                  })}
                  {dayAppts.length > 5 && (
                    <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>+{dayAppts.length - 5}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // OVERVIEW TAB
  // ═══════════════════════════════════════════════════════════════════════
  function renderOverviewTab() {
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
      <div>
        {/* ── KPI Cards ──────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
          <KPICard icon={<Calendar size={20} />} label="Today's Appointments" value={kpis.todayCount} color="#F4A261" />
          <KPICard icon={<TrendingUp size={20} />} label="This Week" value={kpis.weekCount} color="#3B82F6" />
          <KPICard icon={<Activity size={20} />} label="Completion Rate" value={`${kpis.completionRate}%`} color="var(--brand-green-text)" />
          <KPICard icon={<Clock size={20} />} label="Avg Duration" value={`${kpis.avgDuration} min`} color="#818CF8" />
        </div>

        {/* ── Staff Workload ─────────────────────────────────────────── */}
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

        {/* ── Upcoming Appointments Table ─────────────────────────────── */}
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

function formatSlotLabel(slot: string): string {
  const [h, m] = slot.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${hour12}:${m.toString().padStart(2, '0')} ${suffix}`;
}

// ─── Shared style ───────────────────────────────────────────────────────────
const navBtnStyle: React.CSSProperties = {
  width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border-color)',
  background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer', color: 'var(--text-secondary)',
};
