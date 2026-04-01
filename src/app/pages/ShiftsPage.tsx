import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ChevronLeft, ChevronRight, Clock, CalendarDays,
  ArrowLeftRight, Users, Sun, Moon,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Avatar, AvatarImage, AvatarFallback } from '../components/ui/avatar';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '../components/ui/dialog';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '../components/ui/select';
import { supabase } from '../../lib/supabase';
import { getOrgContext } from '../hooks/useOrgContext';
import { useAuth } from '../context/AuthContext';

// ─── Types ──────────────────────────────────────────────────

interface StaffProfile {
  first_name: string;
  last_name: string;
  avatar_url: string | null;
}

interface StaffRow {
  id: string;
  profile_id: string;
  role: string;
  profiles: StaffProfile;
}

interface Shift {
  id: string;
  organization_id: string;
  staff_id: string;
  date: string;
  start_time: string;
  end_time: string;
  label: string | null;
  status: string;
  swap_with_staff_id: string | null;
  staff?: {
    id: string;
    role: string;
    profiles: StaffProfile;
  };
}

interface TeamMember {
  id: string;
  role: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  shifts: Record<string, Shift | null>; // keyed by date string 'YYYY-MM-DD'
}

// ─── Helpers ────────────────────────────────────────────────

function fmt24to12(t: string): string {
  let [h, m] = t.split(':').map(Number);
  const ap = h >= 12 ? 'PM' : 'AM';
  if (h > 12) h -= 12;
  if (h === 0) h = 12;
  return `${h}:${m.toString().padStart(2, '0')} ${ap}`;
}

function getMonday(d: Date): Date {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const mon = new Date(d);
  mon.setDate(diff);
  mon.setHours(0, 0, 0, 0);
  return mon;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function fmtDate(d: Date): string {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function fmtShortDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function getWeekLabel(monday: Date): string {
  const now = new Date();
  const thisMon = getMonday(now);
  if (fmtDate(monday) === fmtDate(thisMon)) return 'This Week';
  const nextMon = addDays(thisMon, 7);
  if (fmtDate(monday) === fmtDate(nextMon)) return 'Next Week';
  const prevMon = addDays(thisMon, -7);
  if (fmtDate(monday) === fmtDate(prevMon)) return 'Last Week';
  return `${fmtShortDate(monday)} – ${fmtShortDate(addDays(monday, 6))}`;
}

function getShiftHours(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  return (eh * 60 + em - sh * 60 - sm) / 60;
}

function getInitials(first: string, last: string): string {
  return `${(first || '')[0] || ''}${(last || '')[0] || ''}`.toUpperCase();
}

function formatRole(role: string): string {
  return role
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// ─── Component ──────────────────────────────────────────────

export default function ShiftsPage() {
  const { user } = useAuth();

  const [weekOffset, setWeekOffset] = useState(0);
  const [myStaff, setMyStaff] = useState<StaffRow | null>(null);
  const [myShifts, setMyShifts] = useState<Shift[]>([]);
  const [allShifts, setAllShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [swapOpen, setSwapOpen] = useState(false);
  const [swapMyShift, setSwapMyShift] = useState('');
  const [swapWithStaff, setSwapWithStaff] = useState('');
  const [swapTheirShift, setSwapTheirShift] = useState('');
  const [swapReason, setSwapReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const monday = useMemo(() => {
    const now = new Date();
    const mon = getMonday(now);
    return addDays(mon, weekOffset * 7);
  }, [weekOffset]);

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  }, [monday]);

  const weekStartStr = fmtDate(monday);
  const weekEndStr = fmtDate(addDays(monday, 6));

  // ─── Load Staff + Shifts ────────────────────────────────────

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { organizationId } = await getOrgContext();

      // Get current user's staff record
      const { data: staffRow } = await supabase
        .from('staff')
        .select('id, profile_id, role, profiles:profiles!staff_profile_id_fkey(first_name, last_name, avatar_url)')
        .eq('id', user.id)
        .single();

      if (staffRow) {
        setMyStaff(staffRow as unknown as StaffRow);
      }

      // Get my shifts
      const { data: myShiftData } = await supabase
        .from('shifts')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('staff_id', user.id)
        .gte('date', weekStartStr)
        .lte('date', weekEndStr)
        .order('date');

      setMyShifts((myShiftData as Shift[]) || []);

      // Get all team shifts
      const { data: allShiftData } = await supabase
        .from('shifts')
        .select('*, staff:staff!shifts_staff_id_fkey(id, role, profiles:profiles!staff_profile_id_fkey(first_name, last_name, avatar_url))')
        .eq('organization_id', organizationId)
        .gte('date', weekStartStr)
        .lte('date', weekEndStr)
        .order('date');

      setAllShifts((allShiftData as Shift[]) || []);
    } catch (err) {
      console.error('Error loading shifts:', err);
    } finally {
      setLoading(false);
    }
  }, [user, weekStartStr, weekEndStr]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ─── Derived: my shift map ──────────────────────────────────

  const myShiftMap = useMemo(() => {
    const map: Record<string, Shift> = {};
    myShifts.forEach((s) => {
      map[s.date] = s;
    });
    return map;
  }, [myShifts]);

  // ─── Derived: team members ──────────────────────────────────

  const teamMembers = useMemo(() => {
    const staffMap: Record<string, TeamMember> = {};
    allShifts.forEach((s) => {
      if (!s.staff) return;
      const prof = s.staff.profiles;
      if (!staffMap[s.staff.id]) {
        staffMap[s.staff.id] = {
          id: s.staff.id,
          role: s.staff.role,
          firstName: prof.first_name,
          lastName: prof.last_name,
          avatarUrl: prof.avatar_url,
          shifts: {},
        };
      }
      staffMap[s.staff.id].shifts[s.date] = s;
    });
    // Sort: my row first, then alphabetical
    const arr = Object.values(staffMap);
    arr.sort((a, b) => {
      if (a.id === user?.id) return -1;
      if (b.id === user?.id) return 1;
      return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
    });
    return arr;
  }, [allShifts, user]);

  // ─── Derived: stats ─────────────────────────────────────────

  const weekStats = useMemo(() => {
    let hours = 0;
    let shiftCount = 0;
    myShifts.forEach((s) => {
      hours += getShiftHours(s.start_time, s.end_time);
      shiftCount++;
    });
    return { hours: Math.round(hours * 10) / 10, shiftCount };
  }, [myShifts]);

  // ─── Derived: upcoming shifts for swap dropdown ─────────────

  const upcomingMyShifts = useMemo(() => {
    const today = fmtDate(new Date());
    return myShifts.filter((s) => s.date >= today && s.status !== 'Swap Pending');
  }, [myShifts]);

  // ─── Derived: other staff for swap ──────────────────────────

  const otherStaff = useMemo(() => {
    return teamMembers.filter((m) => m.id !== user?.id);
  }, [teamMembers, user]);

  // ─── Derived: their shifts for selected staff ───────────────

  const theirShifts = useMemo(() => {
    if (!swapWithStaff) return [];
    const member = teamMembers.find((m) => m.id === swapWithStaff);
    if (!member) return [];
    const today = fmtDate(new Date());
    return Object.values(member.shifts).filter(
      (s): s is Shift => s !== null && s.date >= today && s.status !== 'Swap Pending'
    );
  }, [swapWithStaff, teamMembers]);

  // ─── Submit Swap ────────────────────────────────────────────

  const handleSubmitSwap = useCallback(async () => {
    if (!swapMyShift || !swapWithStaff || !swapTheirShift || !myStaff) return;
    setSubmitting(true);
    try {
      const { organizationId } = await getOrgContext();
      const myShift = myShifts.find((s) => s.id === swapMyShift);
      const target = teamMembers.find((m) => m.id === swapWithStaff);
      if (!myShift || !target) return;

      const myName = `${myStaff.profiles.first_name} ${myStaff.profiles.last_name}`;
      const targetName = `${target.firstName} ${target.lastName}`;
      const myInitials = getInitials(myStaff.profiles.first_name, myStaff.profiles.last_name);
      const myRole = formatRole(myStaff.role);

      // Update shift status
      await supabase
        .from('shifts')
        .update({ status: 'Swap Pending', swap_with_staff_id: swapWithStaff })
        .eq('id', swapMyShift);

      // Create pending request for super admin
      await supabase.from('pending_requests').insert({
        organization_id: organizationId,
        type: 'shift_swap',
        avatar: myInitials,
        avatar_color: '#3B82F6',
        title: `${myName} — Shift Swap`,
        detail: `Swap ${myShift.date} with ${targetName}`,
        meta: `Submitted just now · ${myRole}`,
        status: 'pending',
      });

      setSwapOpen(false);
      setSwapMyShift('');
      setSwapWithStaff('');
      setSwapTheirShift('');
      setSwapReason('');
      loadData();
    } catch (err) {
      console.error('Error submitting swap:', err);
    } finally {
      setSubmitting(false);
    }
  }, [swapMyShift, swapWithStaff, swapTheirShift, myStaff, myShifts, teamMembers, loadData]);

  // ─── Render ─────────────────────────────────────────────────

  return (
    <div style={{ padding: '32px 32px 48px', maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Shifts
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
            View your schedule and team shifts
          </p>
        </div>
        <Button
          onClick={() => setSwapOpen(true)}
          style={{
            background: 'var(--brand-green)',
            color: '#fff',
            fontWeight: 600,
            fontSize: 13,
            borderRadius: 10,
            padding: '8px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: 7,
          }}
        >
          <ArrowLeftRight size={15} />
          Request Shift Swap
        </Button>
      </div>

      {/* ─── My Shifts Section ─────────────────────────────────── */}
      <div
        style={{
          background: 'var(--surface-white)',
          border: '1px solid var(--border-color)',
          borderRadius: 12,
          padding: '20px 24px 24px',
          marginBottom: 24,
        }}
      >
        {/* Section header + week nav */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <CalendarDays size={18} style={{ color: 'var(--brand-green-text)' }} />
            <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>My Shifts</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={() => setWeekOffset((w) => w - 1)}
              style={{
                background: 'var(--surface-elevated)',
                border: '1px solid var(--border-color)',
                borderRadius: 8,
                width: 32,
                height: 32,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: 'var(--text-primary)',
              }}
            >
              <ChevronLeft size={16} />
            </button>
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--text-primary)',
                minWidth: 110,
                textAlign: 'center',
              }}
            >
              {getWeekLabel(monday)}
            </span>
            <button
              onClick={() => setWeekOffset((w) => w + 1)}
              style={{
                background: 'var(--surface-elevated)',
                border: '1px solid var(--border-color)',
                borderRadius: 8,
                width: 32,
                height: 32,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: 'var(--text-primary)',
              }}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* 7-day grid */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)', fontSize: 14 }}>
            Loading shifts...
          </div>
        ) : (
          <>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                gap: 10,
              }}
            >
              {weekDays.map((day, i) => {
                const dateStr = fmtDate(day);
                const shift = myShiftMap[dateStr];
                const isWeekend = i >= 5;
                const isToday = fmtDate(new Date()) === dateStr;

                return (
                  <div
                    key={dateStr}
                    style={{
                      background: isWeekend ? 'var(--surface-elevated)' : 'var(--surface-white)',
                      border: isToday
                        ? '2px solid var(--brand-green-text)'
                        : '1px solid var(--border-color)',
                      borderRadius: 10,
                      padding: '14px 12px',
                      opacity: isWeekend ? 0.55 : 1,
                      minHeight: 100,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: isToday ? 'var(--brand-green-text)' : 'var(--text-secondary)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                        }}
                      >
                        {DAY_NAMES[i]}
                      </span>
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: isToday ? 'var(--brand-green-text)' : 'var(--text-primary)',
                        }}
                      >
                        {day.getDate()}
                      </span>
                    </div>

                    {shift ? (
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                          }}
                        >
                          <div
                            style={{
                              width: 3,
                              height: 28,
                              borderRadius: 2,
                              background: 'var(--brand-green-text)',
                              flexShrink: 0,
                            }}
                          />
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                              {fmt24to12(shift.start_time)}
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                              {fmt24to12(shift.end_time)}
                            </div>
                          </div>
                        </div>
                        {shift.label && (
                          <span
                            style={{
                              display: 'inline-block',
                              fontSize: 11,
                              fontWeight: 600,
                              color: 'var(--brand-green-text)',
                              background: '#74C69D20',
                              borderRadius: 6,
                              padding: '2px 8px',
                              width: 'fit-content',
                            }}
                          >
                            {shift.label}
                          </span>
                        )}
                        {shift.status === 'Swap Pending' && (
                          <span
                            style={{
                              display: 'inline-block',
                              fontSize: 11,
                              fontWeight: 600,
                              color: '#F4A261',
                              background: '#F4A26120',
                              borderRadius: 6,
                              padding: '2px 8px',
                              width: 'fit-content',
                            }}
                          >
                            Swap Pending
                          </span>
                        )}
                      </div>
                    ) : (
                      <div
                        style={{
                          flex: 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                          Day Off
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Summary stats */}
            <div
              style={{
                marginTop: 16,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 13,
                color: 'var(--text-secondary)',
              }}
            >
              <Clock size={14} style={{ color: 'var(--brand-green-text)' }} />
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{weekStats.hours} hours</span>
              <span>this week</span>
              <span style={{ margin: '0 4px' }}>&middot;</span>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{weekStats.shiftCount} shifts</span>
            </div>
          </>
        )}
      </div>

      {/* ─── Team Shifts Section ───────────────────────────────── */}
      <div
        style={{
          background: 'var(--surface-white)',
          border: '1px solid var(--border-color)',
          borderRadius: 12,
          padding: '20px 24px 24px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <Users size={18} style={{ color: 'var(--brand-green-text)' }} />
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>Team Shifts</span>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginLeft: 4 }}>
            {teamMembers.length} staff
          </span>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)', fontSize: 14 }}>
            Loading team shifts...
          </div>
        ) : teamMembers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)', fontSize: 14 }}>
            No team shifts found for this week.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
              <thead>
                <tr>
                  <th
                    style={{
                      textAlign: 'left',
                      padding: '10px 12px',
                      fontSize: 12,
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      borderBottom: '1px solid var(--border-color)',
                      width: 200,
                    }}
                  >
                    Staff
                  </th>
                  {weekDays.slice(0, 5).map((day, i) => (
                    <th
                      key={i}
                      style={{
                        textAlign: 'center',
                        padding: '10px 8px',
                        fontSize: 12,
                        fontWeight: 600,
                        color: fmtDate(new Date()) === fmtDate(day) ? 'var(--brand-green-text)' : 'var(--text-secondary)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        borderBottom: '1px solid var(--border-color)',
                      }}
                    >
                      {DAY_NAMES[i]}
                      <div style={{ fontSize: 11, fontWeight: 500, marginTop: 2 }}>
                        {fmtShortDate(day)}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {teamMembers.map((member) => {
                  const isMe = member.id === user?.id;
                  return (
                    <tr
                      key={member.id}
                      style={{
                        background: isMe ? '#74C69D0A' : 'transparent',
                      }}
                    >
                      <td
                        style={{
                          padding: '12px 12px',
                          borderBottom: '1px solid var(--border-color)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <Avatar style={{ width: 32, height: 32, fontSize: 12 }}>
                            {member.avatarUrl && <AvatarImage src={member.avatarUrl} />}
                            <AvatarFallback
                              style={{
                                background: isMe ? 'var(--brand-green)' : 'var(--surface-elevated)',
                                color: isMe ? '#fff' : 'var(--text-secondary)',
                                fontSize: 12,
                                fontWeight: 600,
                              }}
                            >
                              {getInitials(member.firstName, member.lastName)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div
                              style={{
                                fontSize: 13,
                                fontWeight: 600,
                                color: 'var(--text-primary)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                              }}
                            >
                              {member.firstName} {member.lastName}
                              {isMe && (
                                <span
                                  style={{
                                    fontSize: 10,
                                    fontWeight: 600,
                                    color: 'var(--brand-green-text)',
                                    background: '#74C69D20',
                                    borderRadius: 4,
                                    padding: '1px 6px',
                                  }}
                                >
                                  You
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                              {formatRole(member.role)}
                            </div>
                          </div>
                        </div>
                      </td>
                      {weekDays.slice(0, 5).map((day, i) => {
                        const dateStr = fmtDate(day);
                        const shift = member.shifts[dateStr];
                        const isTodayCol = fmtDate(new Date()) === dateStr;
                        return (
                          <td
                            key={i}
                            style={{
                              textAlign: 'center',
                              padding: '12px 8px',
                              borderBottom: '1px solid var(--border-color)',
                              background: isTodayCol ? '#74C69D06' : 'transparent',
                            }}
                          >
                            {shift ? (
                              <div>
                                <div
                                  style={{
                                    fontSize: 12,
                                    fontWeight: 600,
                                    color: 'var(--text-primary)',
                                    lineHeight: '18px',
                                  }}
                                >
                                  {fmt24to12(shift.start_time)}
                                </div>
                                <div
                                  style={{
                                    fontSize: 12,
                                    color: 'var(--text-secondary)',
                                    lineHeight: '18px',
                                  }}
                                >
                                  {fmt24to12(shift.end_time)}
                                </div>
                                {shift.status === 'Swap Pending' && (
                                  <span
                                    style={{
                                      display: 'inline-block',
                                      fontSize: 10,
                                      fontWeight: 600,
                                      color: '#F4A261',
                                      background: '#F4A26120',
                                      borderRadius: 4,
                                      padding: '1px 5px',
                                      marginTop: 3,
                                    }}
                                  >
                                    Swap
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                                Off
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── Swap Dialog ───────────────────────────────────────── */}
      <Dialog open={swapOpen} onOpenChange={setSwapOpen}>
        <DialogContent
          style={{
            background: 'var(--surface-white)',
            border: '1px solid var(--border-color)',
            borderRadius: 12,
            maxWidth: 480,
            padding: 0,
          }}
        >
          <DialogHeader style={{ padding: '20px 24px 0' }}>
            <DialogTitle
              style={{
                fontSize: 17,
                fontWeight: 700,
                color: 'var(--text-primary)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <ArrowLeftRight size={18} style={{ color: 'var(--brand-green-text)' }} />
              Request Shift Swap
            </DialogTitle>
          </DialogHeader>

          <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* My Shift */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  marginBottom: 6,
                }}
              >
                My Shift
              </label>
              <Select value={swapMyShift} onValueChange={setSwapMyShift}>
                <SelectTrigger
                  style={{
                    background: 'var(--surface-white)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 8,
                    fontSize: 13,
                    color: 'var(--text-primary)',
                    height: 40,
                  }}
                >
                  <SelectValue placeholder="Select one of your shifts" />
                </SelectTrigger>
                <SelectContent
                  style={{
                    background: 'var(--surface-white)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 8,
                  }}
                >
                  {upcomingMyShifts.map((s) => (
                    <SelectItem key={s.id} value={s.id} style={{ fontSize: 13 }}>
                      {s.date} &middot; {fmt24to12(s.start_time)} – {fmt24to12(s.end_time)}
                    </SelectItem>
                  ))}
                  {upcomingMyShifts.length === 0 && (
                    <div style={{ padding: '8px 12px', fontSize: 13, color: 'var(--text-secondary)' }}>
                      No upcoming shifts available
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Swap With */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  marginBottom: 6,
                }}
              >
                Swap With
              </label>
              <Select
                value={swapWithStaff}
                onValueChange={(v) => {
                  setSwapWithStaff(v);
                  setSwapTheirShift('');
                }}
              >
                <SelectTrigger
                  style={{
                    background: 'var(--surface-white)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 8,
                    fontSize: 13,
                    color: 'var(--text-primary)',
                    height: 40,
                  }}
                >
                  <SelectValue placeholder="Select a staff member" />
                </SelectTrigger>
                <SelectContent
                  style={{
                    background: 'var(--surface-white)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 8,
                  }}
                >
                  {otherStaff.map((m) => (
                    <SelectItem key={m.id} value={m.id} style={{ fontSize: 13 }}>
                      {m.firstName} {m.lastName} — {formatRole(m.role)}
                    </SelectItem>
                  ))}
                  {otherStaff.length === 0 && (
                    <div style={{ padding: '8px 12px', fontSize: 13, color: 'var(--text-secondary)' }}>
                      No other staff found
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Their Shift */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  marginBottom: 6,
                }}
              >
                Their Shift
              </label>
              <Select value={swapTheirShift} onValueChange={setSwapTheirShift}>
                <SelectTrigger
                  style={{
                    background: 'var(--surface-white)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 8,
                    fontSize: 13,
                    color: 'var(--text-primary)',
                    height: 40,
                  }}
                >
                  <SelectValue placeholder={swapWithStaff ? 'Select their shift' : 'Select a staff member first'} />
                </SelectTrigger>
                <SelectContent
                  style={{
                    background: 'var(--surface-white)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 8,
                  }}
                >
                  {theirShifts.map((s) => (
                    <SelectItem key={s.id} value={s.id} style={{ fontSize: 13 }}>
                      {s.date} &middot; {fmt24to12(s.start_time)} – {fmt24to12(s.end_time)}
                    </SelectItem>
                  ))}
                  {swapWithStaff && theirShifts.length === 0 && (
                    <div style={{ padding: '8px 12px', fontSize: 13, color: 'var(--text-secondary)' }}>
                      No available shifts for this staff member
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Reason */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  marginBottom: 6,
                }}
              >
                Reason
              </label>
              <Textarea
                value={swapReason}
                onChange={(e) => setSwapReason(e.target.value)}
                placeholder="Why do you need to swap this shift?"
                style={{
                  background: 'var(--surface-white)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 8,
                  fontSize: 13,
                  color: 'var(--text-primary)',
                  minHeight: 80,
                  resize: 'vertical',
                }}
              />
            </div>
          </div>

          <DialogFooter
            style={{
              padding: '16px 24px',
              borderTop: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 10,
            }}
          >
            <Button
              variant="outline"
              onClick={() => setSwapOpen(false)}
              style={{
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                background: 'var(--surface-white)',
                padding: '8px 18px',
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmitSwap}
              disabled={!swapMyShift || !swapWithStaff || !swapTheirShift || submitting}
              style={{
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                background: !swapMyShift || !swapWithStaff || !swapTheirShift || submitting
                  ? 'var(--surface-elevated)'
                  : 'var(--brand-green)',
                color: !swapMyShift || !swapWithStaff || !swapTheirShift || submitting
                  ? 'var(--text-secondary)'
                  : '#fff',
                padding: '8px 18px',
                cursor: !swapMyShift || !swapWithStaff || !swapTheirShift || submitting ? 'not-allowed' : 'pointer',
              }}
            >
              {submitting ? 'Submitting...' : 'Submit Request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
