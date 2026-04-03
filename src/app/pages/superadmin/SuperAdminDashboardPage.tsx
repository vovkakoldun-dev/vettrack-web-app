import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { supabase } from '../../../lib/supabase';
import { getOrgContext } from '../../hooks/useOrgContext';
import { ConnectionStatusBadge } from '../../components/ConnectionStatusBadge';
import {
  Crown, PawPrint, Calendar, DollarSign, Users,
  AlertTriangle, MoreHorizontal, Plus, FileText, Settings, BarChart2,
  CheckCircle2, ClipboardList, BookOpen, Lock, UserPlus, RefreshCw,
  ArrowUpRight, Bell, Umbrella, AlertCircle, X, Check, ChevronLeft, ChevronRight,
} from 'lucide-react';

// ─── Sparkline helpers ────────────────────────────────────────

function buildSplinePath(points: { x: number; y: number }[]): string {
  if (points.length < 2) return '';
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const cpx = prev.x + (curr.x - prev.x) * 0.5;
    d += ` C ${cpx} ${prev.y}, ${cpx} ${curr.y}, ${curr.x} ${curr.y}`;
  }
  return d;
}

function useDarkMode(): boolean {
  const [dark, setDark] = useState(() =>
    document.documentElement.classList.contains('dark')
  );
  useEffect(() => {
    const obs = new MutationObserver(() =>
      setDark(document.documentElement.classList.contains('dark'))
    );
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

// ─── Notifications Panel ──────────────────────────────────────

type NotifStatus = 'pending' | 'approved' | 'declined';

interface Notification {
  id: string;
  type: 'pto' | 'shift_swap' | 'overdue' | 'reassign';
  avatar: string;
  avatarColor: string;
  title: string;
  detail: string;
  meta: string;
  status: NotifStatus;
}

const NOTIF_TYPE_CFG = {
  pto:        { icon: Umbrella,     color: '#8B5CF6', bg: '#8B5CF615', label: 'PTO Request' },
  shift_swap: { icon: RefreshCw,    color: '#3B82F6', bg: '#3B82F615', label: 'Shift Swap' },
  reassign:   { icon: Calendar,     color: '#F4A261', bg: '#F4A26115', label: 'Coverage Needed' },
  overdue:    { icon: AlertCircle,  color: '#EF4444', bg: '#EF444415', label: 'Finance Alert' },
};

function NotificationsPanel() {
  const navigate = useNavigate();
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const pending = notifs.filter(n => n.status === 'pending');

  // Build notifications from REAL data sources + manual pending_requests
  useEffect(() => {
    (async () => {
      try {
        const { organizationId } = await getOrgContext();
        const built: Notification[] = [];

        // 1. Manual pending requests (PTO, shift swaps, etc.)
        const { data: manualReqs } = await supabase
          .from('pending_requests')
          .select('*')
          .eq('organization_id', organizationId)
          .eq('status', 'pending')
          .order('created_at', { ascending: false });
        if (manualReqs) {
          manualReqs.forEach((r: any) => built.push({
            id: r.id,
            type: r.type as Notification['type'],
            avatar: r.avatar || '?',
            avatarColor: r.avatar_color || '#6B7280',
            title: r.title,
            detail: r.detail || '',
            meta: r.meta || '',
            status: 'pending',
          }));
        }

        // 2. Overdue invoices → Finance Alert
        const { data: overdueInv } = await supabase
          .from('invoices')
          .select('id, total, due_date, clients(first_name, last_name)')
          .eq('organization_id', organizationId)
          .eq('status', 'Overdue')
          .order('due_date');
        if (overdueInv && overdueInv.length > 0) {
          const names = overdueInv.map((inv: any) => {
            const c = inv.clients;
            return `${c?.first_name || ''} ${c?.last_name || ''}`.trim() + ` $${Number(inv.total).toFixed(0)}`;
          }).join(' · ');
          const totalAmt = overdueInv.reduce((s: number, inv: any) => s + Number(inv.total), 0);
          const oldest = overdueInv[0]?.due_date ? new Date(overdueInv[0].due_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
          built.push({
            id: `overdue-invoices`,
            type: 'overdue',
            avatar: '!',
            avatarColor: '#EF4444',
            title: `${overdueInv.length} Invoice${overdueInv.length > 1 ? 's' : ''} Overdue`,
            detail: names,
            meta: `$${totalAmt.toLocaleString()} total${oldest ? ` · Oldest: ${oldest}` : ''}`,
            status: 'pending',
          });
        }

        // 3. Unpaid/Sent invoices → reminder
        const { data: sentInv } = await supabase
          .from('invoices')
          .select('id, total, due_date, clients(first_name, last_name)')
          .eq('organization_id', organizationId)
          .eq('status', 'Sent')
          .order('due_date');
        if (sentInv && sentInv.length > 0) {
          const totalAmt = sentInv.reduce((s: number, inv: any) => s + Number(inv.total), 0);
          built.push({
            id: `sent-invoices`,
            type: 'overdue',
            avatar: '$',
            avatarColor: '#F4A261',
            title: `${sentInv.length} Unpaid Invoice${sentInv.length > 1 ? 's' : ''}`,
            detail: sentInv.map((inv: any) => {
              const c = inv.clients;
              return `${c?.first_name || ''} ${c?.last_name || ''}`.trim();
            }).join(', '),
            meta: `$${totalAmt.toLocaleString()} awaiting payment`,
            status: 'pending',
          });
        }

        // 4. Urgent pending tasks → action needed
        const { data: urgentTasks } = await supabase
          .from('tasks')
          .select('id, type, priority, due_date, pet:pets!tasks_pet_id_fkey(name), assignedByStaff:staff!tasks_assigned_by_id_fkey(profiles:profiles!staff_profile_id_fkey(first_name, last_name))')
          .eq('organization_id', organizationId)
          .eq('status', 'Pending')
          .eq('priority', 'Urgent')
          .order('due_date');
        if (urgentTasks && urgentTasks.length > 0) {
          urgentTasks.forEach((t: any) => {
            const byProfile = t.assignedByStaff?.profiles;
            const byName = byProfile ? `Dr. ${byProfile.last_name}` : 'Unknown';
            const initials = byProfile ? `${(byProfile.first_name?.[0] || '').toUpperCase()}${(byProfile.last_name?.[0] || '').toUpperCase()}` : '??';
            built.push({
              id: `task-${t.id}`,
              type: 'reassign',
              avatar: initials,
              avatarColor: '#d4183d',
              title: `${t.type} — ${t.pet?.name || 'Unknown'}`,
              detail: `Urgent task assigned by ${byName}`,
              meta: `Due ${new Date(t.due_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
              status: 'pending',
            });
          });
        }

        setNotifs(built);
      } catch {} finally {
        setLoading(false);
      }
    })();
  }, []);

  async function approve(id: string) {
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, status: 'approved' } : n));
    // Only persist for real pending_requests rows (UUIDs)
    if (!id.includes('-invoices') && !id.startsWith('task-')) {
      await supabase.from('pending_requests').update({ status: 'approved', resolved_at: new Date().toISOString() }).eq('id', id);
    }
  }
  async function decline(id: string) {
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, status: 'declined' } : n));
    if (!id.includes('-invoices') && !id.startsWith('task-')) {
      await supabase.from('pending_requests').update({ status: 'declined', resolved_at: new Date().toISOString() }).eq('id', id);
    }
  }
  async function dismiss(id: string) {
    setNotifs(prev => prev.filter(n => n.id !== id));
    if (!id.includes('-invoices') && !id.startsWith('task-')) {
      await supabase.from('pending_requests').delete().eq('id', id);
    }
  }

  if (loading || notifs.length === 0) return null;

  return (
    <div style={{
      backgroundColor: 'var(--surface-white)',
      border: '1px solid var(--border-color)',
      borderRadius: '14px',
      overflow: 'hidden',
      marginBottom: '24px',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 18px',
        borderBottom: '1px solid var(--border-color)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '32px', height: '32px', borderRadius: '9px',
            backgroundColor: '#F4A26115',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Bell style={{ width: '15px', height: '15px', color: '#C2671A' }} />
          </div>
          <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
            Pending Requests
          </span>
          {pending.length > 0 && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              minWidth: '22px', height: '22px', borderRadius: '9999px',
              backgroundColor: '#EF4444', color: '#fff',
              fontSize: '11px', fontWeight: 700, padding: '0 6px',
            }}>
              {pending.length}
            </span>
          )}
        </div>
        <button style={{
          fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)',
          background: 'none', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: '4px',
        }}>
          View all <ChevronRight style={{ width: '13px', height: '13px' }} />
        </button>
      </div>

      {/* Notification rows */}
      {notifs.map((n, idx) => {
        const cfg = NOTIF_TYPE_CFG[n.type];
        const TypeIcon = cfg.icon;
        const isDone = n.status !== 'pending';

        return (
          <div
            key={n.id}
            style={{
              display: 'flex', alignItems: 'center', gap: '14px',
              padding: '14px 18px',
              borderBottom: idx < notifs.length - 1 ? '1px solid var(--border-color)' : 'none',
              opacity: isDone ? 0.5 : 1,
              transition: 'opacity 0.2s',
            }}
          >
            {/* Avatar */}
            <div style={{
              width: '40px', height: '40px', borderRadius: '50%',
              background: `linear-gradient(135deg, ${n.avatarColor}dd, ${n.avatarColor}88)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
              fontSize: '13px', fontWeight: 700, color: '#fff',
            }}>
              {n.avatar}
            </div>

            {/* Type badge + text */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '4px',
                  padding: '2px 8px', borderRadius: '9999px',
                  backgroundColor: cfg.bg, color: cfg.color,
                  fontSize: '11px', fontWeight: 700,
                }}>
                  <TypeIcon style={{ width: '10px', height: '10px' }} />
                  {cfg.label}
                </span>
                {isDone && (
                  <span style={{
                    fontSize: '11px', fontWeight: 700,
                    color: n.status === 'approved' ? '#22C55E' : '#EF4444',
                  }}>
                    {n.status === 'approved' ? '✓ Approved' : '✕ Declined'}
                  </span>
                )}
              </div>
              <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {n.title}
              </p>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '1px 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {n.detail}
              </p>
              <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: '2px 0 0', opacity: 0.7 }}>
                {n.meta}
              </p>
            </div>

            {/* Actions */}
            {!isDone ? (
              <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                {n.type !== 'overdue' && (
                  <button
                    onClick={() => approve(n.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '5px',
                      padding: '7px 14px', borderRadius: '8px',
                      backgroundColor: '#22C55E15', color: '#16A34A',
                      border: '1px solid #22C55E30',
                      fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                    }}
                  >
                    <Check style={{ width: '12px', height: '12px' }} />
                    Approve
                  </button>
                )}
                {n.type === 'overdue' && (
                  <button
                    onClick={() => approve(n.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '5px',
                      padding: '7px 14px', borderRadius: '8px',
                      backgroundColor: '#EF444415', color: '#DC2626',
                      border: '1px solid #EF444430',
                      fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                    }}
                  >
                    <ChevronRight style={{ width: '12px', height: '12px' }} />
                    Review
                  </button>
                )}
                {n.type !== 'overdue' && (
                  <button
                    onClick={() => decline(n.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '5px',
                      padding: '7px 14px', borderRadius: '8px',
                      backgroundColor: 'var(--surface-elevated)', color: 'var(--text-secondary)',
                      border: '1px solid var(--border-color)',
                      fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    <X style={{ width: '12px', height: '12px' }} />
                    Decline
                  </button>
                )}
              </div>
            ) : (
              <button
                onClick={() => dismiss(n.id)}
                style={{
                  width: '28px', height: '28px', borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--surface-elevated)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', flexShrink: 0, color: 'var(--text-secondary)',
                }}
              >
                <X style={{ width: '13px', height: '13px' }} />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Glow Card Data ───────────────────────────────────────────

const GLOW_CARDS = [
  {
    title: 'Total Patients',
    subtitle: 'Active',
    metricLabel: 'Patient Growth',
    value: '0',
    trendLabel: '+12 this week',
    trendPositive: true,
    color: '#818CF8',
    shadowColor: 'rgba(129,140,248,0.35)',
    icon: PawPrint,
    data: [1080, 1110, 1140, 1175, 1210, 1240, 1265, 1284],
    labels: ['Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'],
    unit: 'patients',
    annotationStart: '1,080',
    annotationEnd: '1,284',
    path: '/superadmin/staff',
  },
  {
    title: 'Appointments',
    subtitle: 'Today',
    metricLabel: 'Daily Volume',
    value: '0',
    trendLabel: '6 in progress',
    trendPositive: true,
    color: '#F4A261',
    shadowColor: 'rgba(244,162,97,0.35)',
    icon: Calendar,
    data: [28, 31, 26, 34, 29, 36, 33, 38],
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Mon', 'Tue', 'Today'],
    unit: 'appts',
    annotationStart: '28',
    annotationEnd: '38',
    path: '/superadmin/appointments',
  },
  {
    title: 'Monthly Revenue',
    subtitle: '',
    metricLabel: 'Revenue Growth',
    value: '$48,920',
    trendLabel: '+8% vs last month',
    trendPositive: true,
    color: '#4ADE80',
    shadowColor: 'rgba(74,222,128,0.35)',
    icon: DollarSign,
    data: [38200, 40100, 42800, 41500, 43900, 45200, 47300, 48920],
    labels: ['Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'],
    unit: 'USD',
    annotationStart: '$38k',
    annotationEnd: '$48.9k',
    path: '/superadmin/billing',
  },
  {
    title: 'Active Staff',
    subtitle: 'On Roster',
    metricLabel: 'Headcount',
    value: '0',
    trendLabel: '3 doctors, 9 admin',
    trendPositive: true,
    color: '#38BDF8',
    shadowColor: 'rgba(56,189,248,0.35)',
    icon: Users,
    data: [8, 9, 9, 10, 10, 11, 12, 12],
    labels: ['Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'],
    unit: 'staff',
    annotationStart: '8',
    annotationEnd: '12',
    path: '/superadmin/staff',
  },
];

// ─── GlowStatCard ─────────────────────────────────────────────

function GlowStatCard({
  title, subtitle, metricLabel, value, trendLabel, trendPositive,
  color, shadowColor, icon: Icon, data, labels, unit,
  annotationStart, annotationEnd, path, onPrev, onNext,
}: (typeof GLOW_CARDS)[0] & { onPrev?: () => void; onNext?: () => void }) {
  const navigate = useNavigate();
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const VW = 320;
  const VH = 100;
  const PX = 24;
  const PY = 18;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const pts = data.map((val, i) => ({
    x: PX + (i / (data.length - 1)) * (VW - PX * 2),
    y: VH - PY - ((val - min) / range) * (VH - PY * 2),
  }));

  const linePath = buildSplinePath(pts);
  const first = pts[0];
  const last  = pts[pts.length - 1];
  const areaPath = linePath + ` L ${last.x} ${VH} L ${first.x} ${VH} Z`;
  const midY = VH / 2;
  const uid  = title.replace(/\s+/g, '');

  const cs = typeof window !== 'undefined' ? getComputedStyle(document.documentElement) : null;
  const v = (name: string, fallback: string) => cs?.getPropertyValue(name).trim() || fallback;

  const cardBg = `linear-gradient(145deg, ${v('--stat-card-bg-from','#0D1B2A')} 0%, ${v('--stat-card-bg-mid','#0A1520')} 60%, ${v('--stat-card-bg-to','#0D1B2A')} 100%)`;
  const borderAlpha = parseFloat(v('--stat-card-border-alpha', '0.07'));
  const cardBorder = `${color}${Math.round(borderAlpha * 255).toString(16).padStart(2, '0')}`;
  const cardShadow = `0 0 0 1px ${cardBorder}, 0 20px 60px -10px ${shadowColor}`;
  const cornerGlow = `${color}18`;
  const subtitleColor = v('--stat-card-text-muted', 'rgba(255,255,255,0.35)');
  const titleColor = v('--stat-card-text', '#ffffff');
  const metricLabelColor = v('--stat-card-text-label', 'rgba(255,255,255,0.3)');
  const valueColor = v('--stat-card-text', '#ffffff');
  const btnBorder = v('--stat-card-btn-border', 'rgba(255,255,255,0.1)');
  const btnBg = v('--stat-card-btn-bg', 'rgba(255,255,255,0.04)');
  const btnIconColor = v('--stat-card-btn-icon', 'rgba(255,255,255,0.35)');
  const dotHoleFill = v('--stat-card-dot-fill', '#0D1B2A');
  const midLineStroke = v('--stat-card-midline', 'rgba(255,255,255,0.07)');
  const annoStartFill = v('--stat-card-anno-start', 'rgba(255,255,255,0.45)');
  const annoEndFill = v('--stat-card-anno-end', 'rgba(255,255,255,0.9)');
  const areaOpacity = parseFloat(v('--stat-card-area-opacity', '0.22'));
  const useAccentLine = parseFloat(v('--stat-card-use-accent-line', '0'));
  const lineWhiteStop = useAccentLine ? color : '#ffffff';
  const lineWhiteOpacity = parseFloat(v('--stat-card-line-white-opacity', '0.9'));
  const glowOpacity1 = parseFloat(v('--stat-card-glow1', '0.35'));
  const glowOpacity2 = parseFloat(v('--stat-card-glow2', '0.5'));

  return (
    <div
      onClick={() => navigate(path)}
      style={{
        background: cardBg,
        border: `1px solid ${cardBorder}`,
        borderRadius: '18px',
        overflow: 'hidden',
        position: 'relative',
        boxShadow: cardShadow,
        cursor: 'pointer',
        transition: 'transform 0.15s, box-shadow 0.15s',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
        (e.currentTarget as HTMLElement).style.boxShadow = dark
          ? `0 0 0 1px rgba(255,255,255,0.07), 0 24px 70px -10px ${shadowColor}`
          : `0 8px 40px -6px ${shadowColor}, 0 0 0 1px ${color}30`;
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
        (e.currentTarget as HTMLElement).style.boxShadow = cardShadow;
      }}
    >
      {/* Corner glow */}
      <div style={{
        position: 'absolute', top: '-40px', right: '-40px',
        width: '140px', height: '140px', borderRadius: '50%',
        background: `radial-gradient(circle, ${cornerGlow} 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />

      <div style={{ padding: '20px 20px 0' }}>
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '42px', height: '42px', borderRadius: '12px',
              background: `linear-gradient(135deg, ${color}25 0%, ${color}12 100%)`,
              border: `1px solid ${color}35`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 0 14px ${color}25`,
            }}>
              <Icon style={{ width: '19px', height: '19px', color }} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '3px' }}>
                {onPrev && (
                  <button onClick={e => { e.stopPropagation(); onPrev(); }} style={{
                    background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                    display: 'flex', alignItems: 'center', color: subtitleColor,
                  }}>
                    <ChevronLeft style={{ width: '12px', height: '12px' }} />
                  </button>
                )}
                <p style={{ fontSize: '10px', color: subtitleColor, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' as const, margin: 0 }}>
                  {subtitle}
                </p>
                {onNext && (
                  <button onClick={e => { e.stopPropagation(); onNext(); }} style={{
                    background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                    display: 'flex', alignItems: 'center', color: subtitleColor,
                  }}>
                    <ChevronRight style={{ width: '12px', height: '12px' }} />
                  </button>
                )}
              </div>
              <p style={{ fontSize: '14px', color: titleColor, fontWeight: 700, lineHeight: 1 }}>
                {title}
              </p>
            </div>
          </div>
          <button
            onClick={e => { e.stopPropagation(); navigate(path); }}
            style={{
              width: '30px', height: '30px', borderRadius: '8px',
              border: `1px solid ${btnBorder}`,
              backgroundColor: btnBg,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <ArrowUpRight style={{ width: '14px', height: '14px', color: btnIconColor }} />
          </button>
        </div>

        {/* Metric label */}
        <p style={{ fontSize: '10px', color: metricLabelColor, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' as const, marginBottom: '6px' }}>
          {metricLabel}
        </p>

        {/* Value + trend badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
          <span style={{ fontSize: '32px', fontWeight: 800, color: valueColor, letterSpacing: '-0.02em', lineHeight: 1 }}>
            {value}
          </span>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '4px',
            padding: '4px 9px', borderRadius: '7px',
            background: trendPositive ? 'rgba(74,222,128,0.15)' : 'rgba(251,113,133,0.15)',
            color: trendPositive ? '#22c55e' : '#ef4444',
            fontSize: '11px', fontWeight: 700,
            border: `1px solid ${trendPositive ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
          }}>
            {trendPositive ? '↑' : '↓'} {trendLabel}
          </span>
        </div>
      </div>

      {/* Sparkline chart */}
      <div style={{ position: 'relative' }} onMouseLeave={() => setHoveredIdx(null)}>
        <svg
          viewBox={`0 0 ${VW} ${VH}`}
          preserveAspectRatio="none"
          style={{ width: '100%', height: '100px', display: 'block', cursor: 'crosshair' }}
          onMouseMove={e => {
            e.stopPropagation();
            const rect = e.currentTarget.getBoundingClientRect();
            const mouseX = ((e.clientX - rect.left) / rect.width) * VW;
            let nearestIdx = 0;
            let minDist = Infinity;
            pts.forEach((pt, i) => {
              const dist = Math.abs(pt.x - mouseX);
              if (dist < minDist) { minDist = dist; nearestIdx = i; }
            });
            setHoveredIdx(nearestIdx);
          }}
        >
          <defs>
            <filter id={`bloom-${uid}`} x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
            </filter>
            <linearGradient id={`area-${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={color} stopOpacity={areaOpacity} />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
            <linearGradient id={`line-${uid}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%"   stopColor={color}          stopOpacity="0.6" />
              <stop offset="45%"  stopColor={lineWhiteStop}  stopOpacity={lineWhiteOpacity} />
              <stop offset="100%" stopColor={color}          stopOpacity="1" />
            </linearGradient>
          </defs>

          <line x1={PX} y1={midY} x2={VW - PX} y2={midY}
            stroke={midLineStroke} strokeWidth="1" strokeDasharray="5 5" />
          <path d={areaPath} fill={`url(#area-${uid})`} />
          <path d={linePath} fill="none" stroke={color} strokeWidth="10"
            strokeLinecap="round" opacity={glowOpacity1} filter={`url(#bloom-${uid})`} />
          <path d={linePath} fill="none" stroke={color} strokeWidth="5"
            strokeLinecap="round" opacity={glowOpacity2} filter={`url(#bloom-${uid})`} />
          <path d={linePath} fill="none" stroke={`url(#line-${uid})`} strokeWidth="2.5"
            strokeLinecap="round" strokeLinejoin="round" />
          <circle cx={first.x} cy={first.y} r="4.5" fill={dotHoleFill} stroke={color} strokeWidth="2" />
          <circle cx={last.x}  cy={last.y}  r="5"   fill={color} filter={`url(#bloom-${uid})`} />
          <circle cx={last.x}  cy={last.y}  r="4"   fill="#ffffff" opacity="0.9" />
          {annotationStart && (
            <text x={first.x + 8} y={first.y - 9}
              fill={annoStartFill} fontSize="9.5" fontWeight="700" fontFamily="system-ui">
              {annotationStart}
            </text>
          )}
          {annotationEnd && (
            <text x={last.x - 8} y={last.y - 9}
              fill={annoEndFill} fontSize="9.5" fontWeight="700" fontFamily="system-ui" textAnchor="end">
              {annotationEnd}
            </text>
          )}
          {hoveredIdx !== null && (() => {
            const hx = pts[hoveredIdx].x;
            const hy = pts[hoveredIdx].y;
            return (
              <>
                <line x1={hx} y1={0} x2={hx} y2={VH}
                  stroke={color} strokeWidth="1" strokeDasharray="3 3" opacity="0.5" />
                <circle cx={hx} cy={hy} r="8" fill={color} opacity="0.18" />
                <circle cx={hx} cy={hy} r="5" fill={color} filter={`url(#bloom-${uid})`} opacity="0.8" />
                <circle cx={hx} cy={hy} r="4" fill={color} />
                <circle cx={hx} cy={hy} r="2" fill="#fff" />
              </>
            );
          })()}
        </svg>

        {/* Hover tooltip */}
        {hoveredIdx !== null && (() => {
          const hx = pts[hoveredIdx].x;
          const hy = pts[hoveredIdx].y;
          const dotFromBottom = VH - hy;
          const tooltipBg = v('--stat-card-dot-fill', '#0D1B2A');
          const tooltipBorder = `${color}55`;
          const tooltipShadow = `0 4px 20px rgba(0,0,0,0.4), 0 0 12px ${color}30`;
          const labelCol = v('--stat-card-text-muted', 'rgba(255,255,255,0.45)');
          const unitCol = v('--stat-card-text-label', 'rgba(255,255,255,0.4)');
          return (
            <div style={{
              position: 'absolute',
              left: `${(hx / VW) * 100}%`,
              bottom: `${dotFromBottom + 14}px`,
              transform: 'translateX(-50%)',
              pointerEvents: 'none', zIndex: 20,
              backgroundColor: tooltipBg,
              border: `1px solid ${tooltipBorder}`,
              borderRadius: '10px', padding: '7px 11px',
              boxShadow: tooltipShadow,
              whiteSpace: 'nowrap', backdropFilter: 'blur(8px)',
            }}>
              <div style={{ fontSize: '10px', color: labelCol, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '2px' }}>
                {labels[hoveredIdx]}
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                <span style={{ fontSize: '18px', fontWeight: 800, color, lineHeight: 1 }}>
                  {data[hoveredIdx].toLocaleString()}
                </span>
                <span style={{ fontSize: '10px', fontWeight: 600, color: unitCol }}>
                  {unit}
                </span>
              </div>
              <div style={{
                position: 'absolute', bottom: '-5px', left: '50%',
                width: '9px', height: '9px',
                backgroundColor: tooltipBg,
                borderRight: `1px solid ${tooltipBorder}`,
                borderBottom: `1px solid ${tooltipBorder}`,
                transform: 'translateX(-50%) rotate(45deg)',
              }} />
            </div>
          );
        })()}
      </div>
    </div>
  );
}

// ─── Staff rows ───────────────────────────────────────────────

type StaffDisplayStatus = 'On Duty' | 'On Leave' | 'Active' | 'Off Today' | 'Inactive' | 'Probation';

interface StaffRow {
  id: string;
  name: string;
  role: string;
  appts: string;
  status: StaffDisplayStatus;
  lastActive: string;
}

const DB_ROLE_DISPLAY: Record<string, string> = {
  veterinarian: 'Veterinarian',
  senior_veterinarian: 'Sr. Veterinarian',
  specialist: 'Specialist',
  vet_technician: 'Vet Tech',
  lead_vet_tech: 'Lead Vet Tech',
  receptionist: 'Receptionist',
  front_desk_manager: 'Front Desk',
  clinic_manager: 'Clinic Manager',
  groomer: 'Groomer',
  lab_technician: 'Lab Tech',
  superadmin: 'Super Admin',
  owner: 'Owner',
};

const VET_ROLES = ['veterinarian', 'senior_veterinarian', 'specialist'];

function formatLastActive(dateStr: string | null): string {
  if (!dateStr) return '—';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const STATUS_DOT: Record<StaffDisplayStatus, { dot: string; bg: string; color: string }> = {
  'On Duty':   { dot: '#22C55E', bg: '#22C55E18', color: '#15803D' },
  'On Leave':  { dot: '#F59E0B', bg: '#F59E0B18', color: '#92400E' },
  'Active':    { dot: '#22C55E', bg: '#22C55E18', color: '#15803D' },
  'Off Today': { dot: '#EF4444', bg: '#EF444418', color: '#B91C1C' },
  'Inactive':  { dot: '#6B7280', bg: '#6B728018', color: '#4B5563' },
  'Probation': { dot: '#8B5CF6', bg: '#8B5CF618', color: '#6D28D9' },
};

// ─── Activity feed types ──────────────────────────────────────

interface ActivityItem {
  icon: typeof CheckCircle2;
  iconColor: string;
  text: string;
  time: string;
  sortKey: number; // timestamp for sorting
}

// ─── Quick actions ────────────────────────────────────────────

const QUICK_ACTIONS = [
  { icon: Plus,      label: 'Add Staff Member', primary: true,  path: '/superadmin/staff' },
  { icon: FileText,  label: 'Create Invoice',   primary: false, path: '/superadmin/invoices' },
  { icon: Settings,  label: 'System Settings',  primary: false, path: '/superadmin/settings' },
  { icon: BarChart2, label: 'Generate Report',  primary: false, path: '/superadmin/analytics' },
];

// ─── Component ────────────────────────────────────────────────

export default function SuperAdminDashboardPage() {
  const navigate = useNavigate();
  const [staffRows, setStaffRows] = useState<StaffRow[]>([]);
  const [staffLoading, setStaffLoading] = useState(true);
  const [kpiPatients, setKpiPatients] = useState('0');
  const [kpiPatientsTrend, setKpiPatientsTrend] = useState('+0 this week');
  const [kpiApptsToday, setKpiApptsToday] = useState('0');
  const [kpiApptsTrend, setKpiApptsTrend] = useState('0 in progress');
  const [kpiRevenue, setKpiRevenue] = useState('$0');
  const [kpiRevenueTrend, setKpiRevenueTrend] = useState('+0% vs last month');
  const [kpiRevenueTrendPositive, setKpiRevenueTrendPositive] = useState(true);
  const [kpiStaffCount, setKpiStaffCount] = useState('0');
  const [kpiStaffTrend, setKpiStaffTrend] = useState('0 doctors, 0 admin');
  const [revenueMonth, setRevenueMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() }; // 0-indexed month
  });
  const [finSnap, setFinSnap] = useState({ thisMonth: 0, lastMonth: 0, paid: 0, pending: 0, overdue: 0 });
  const [activityFeed, setActivityFeed] = useState<ActivityItem[]>([]);

  // ── Fetch Today's Activity Feed ──
  useEffect(() => {
    (async () => {
      try {
        const { organizationId } = await getOrgContext();
        const todayStr = new Date().toISOString().slice(0, 10);
        const todayStart = `${todayStr}T00:00:00`;
        const items: ActivityItem[] = [];
        const fmtTime = (ts: string) => new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

        // 1. Payments received today
        const { data: payments } = await supabase
          .from('payments')
          .select('amount, created_at, invoices(clients(first_name, last_name))')
          .eq('organization_id', organizationId)
          .gte('created_at', todayStart)
          .order('created_at', { ascending: false })
          .limit(5);
        (payments || []).forEach((p: any) => {
          const c = p.invoices?.clients;
          const name = c ? `${c.first_name || ''} ${c.last_name || ''}`.trim() : 'Unknown';
          items.push({
            icon: CheckCircle2, iconColor: '#22C55E',
            text: `Payment received — ${name} $${Number(p.amount).toLocaleString()}`,
            time: fmtTime(p.created_at), sortKey: new Date(p.created_at).getTime(),
          });
        });

        // 2. Appointments booked today
        const { data: newAppts } = await supabase
          .from('appointments')
          .select('created_at, pets(name), services(name)')
          .eq('organization_id', organizationId)
          .gte('created_at', todayStart)
          .order('created_at', { ascending: false })
          .limit(5);
        (newAppts || []).forEach((a: any) => {
          const petName = (a.pets as any)?.name || 'Unknown';
          const svcName = (a.services as any)?.name || 'Appointment';
          items.push({
            icon: BookOpen, iconColor: '#8B5CF6',
            text: `New booking — ${petName} · ${svcName}`,
            time: fmtTime(a.created_at), sortKey: new Date(a.created_at).getTime(),
          });
        });

        // 3. Medical records created today
        const { data: newRecords } = await supabase
          .from('medical_records')
          .select('created_at, pets(name), staff:staff!medical_records_vet_id_fkey(profiles:profiles!staff_profile_id_fkey(last_name))')
          .eq('organization_id', organizationId)
          .gte('created_at', todayStart)
          .order('created_at', { ascending: false })
          .limit(5);
        (newRecords || []).forEach((r: any) => {
          const petName = (r.pets as any)?.name || 'Unknown';
          const vetName = r.staff?.profiles?.last_name ? `Dr. ${r.staff.profiles.last_name}` : '';
          items.push({
            icon: ClipboardList, iconColor: '#3B82F6',
            text: `Record created — ${petName}${vetName ? ` (${vetName})` : ''}`,
            time: fmtTime(r.created_at), sortKey: new Date(r.created_at).getTime(),
          });
        });

        // 4. Overdue invoices (any time — important alerts)
        const { data: overdueInv } = await supabase
          .from('invoices')
          .select('total, updated_at, clients(first_name, last_name)')
          .eq('organization_id', organizationId)
          .eq('status', 'Overdue')
          .order('updated_at', { ascending: false })
          .limit(3);
        (overdueInv || []).forEach((inv: any) => {
          const c = inv.clients;
          const name = c ? `${c.first_name || ''} ${c.last_name || ''}`.trim() : 'Unknown';
          items.push({
            icon: AlertTriangle, iconColor: '#EF4444',
            text: `Invoice overdue — ${name} $${Number(inv.total).toLocaleString()}`,
            time: fmtTime(inv.updated_at), sortKey: new Date(inv.updated_at).getTime(),
          });
        });

        // 5. New pets registered today
        const { data: newPets } = await supabase
          .from('pets')
          .select('name, created_at, clients(first_name, last_name)')
          .eq('organization_id', organizationId)
          .gte('created_at', todayStart)
          .order('created_at', { ascending: false })
          .limit(3);
        (newPets || []).forEach((pet: any) => {
          const c = pet.clients;
          const ownerName = c ? `${c.first_name?.[0] || ''}. ${c.last_name || ''}`.trim() : '';
          items.push({
            icon: UserPlus, iconColor: '#6B7280',
            text: `New patient registered — ${pet.name}${ownerName ? ` (${ownerName})` : ''}`,
            time: fmtTime(pet.created_at), sortKey: new Date(pet.created_at).getTime(),
          });
        });

        // Sort by most recent first, limit to 8
        items.sort((a, b) => b.sortKey - a.sortKey);
        setActivityFeed(items.slice(0, 8));
      } catch {}
    })();
  }, []);

  // ── Fetch Financial Snapshot ──
  useEffect(() => {
    (async () => {
      try {
        const { organizationId } = await getOrgContext();
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();
        const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
        const prevEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString();

        // This month invoices by status
        const { data: thisMonthInv } = await supabase
          .from('invoices')
          .select('total, status')
          .eq('organization_id', organizationId)
          .gte('created_at', startOfMonth)
          .lte('created_at', endOfMonth);

        const thisMonthTotal = (thisMonthInv || []).reduce((s: number, i: any) => s + (Number(i.total) || 0), 0);
        const paid = (thisMonthInv || []).filter((i: any) => i.status === 'Paid').reduce((s: number, i: any) => s + (Number(i.total) || 0), 0);
        const pending = (thisMonthInv || []).filter((i: any) => i.status === 'Sent' || i.status === 'Draft').reduce((s: number, i: any) => s + (Number(i.total) || 0), 0);
        const overdue = (thisMonthInv || []).filter((i: any) => i.status === 'Overdue').reduce((s: number, i: any) => s + (Number(i.total) || 0), 0);

        // Last month total
        const { data: lastMonthInv } = await supabase
          .from('invoices')
          .select('total')
          .eq('organization_id', organizationId)
          .gte('created_at', prevStart)
          .lte('created_at', prevEnd);

        const lastMonthTotal = (lastMonthInv || []).reduce((s: number, i: any) => s + (Number(i.total) || 0), 0);

        setFinSnap({ thisMonth: thisMonthTotal, lastMonth: lastMonthTotal, paid, pending, overdue });
      } catch {}
    })();
  }, []);

  // ── Fetch staff overview data ──
  useEffect(() => {
    (async () => {
      try {
        const { organizationId } = await getOrgContext();

        // 1. Fetch all non-inactive staff with profile names
        const { data: staffData } = await supabase
          .from('staff')
          .select('id, role, status, profiles:profiles!staff_profile_id_fkey(first_name, last_name)')
          .eq('organization_id', organizationId)
          .neq('status', 'Inactive')
          .order('role');

        if (!staffData || staffData.length === 0) {
          setStaffRows([]);
          setStaffLoading(false);
          return;
        }

        // 2. Count today's appointments per vet
        const todayStr = new Date().toISOString().slice(0, 10);
        const { data: todayAppts } = await supabase
          .from('appointments')
          .select('vet_id')
          .eq('organization_id', organizationId)
          .gte('scheduled_at', `${todayStr}T00:00:00`)
          .lt('scheduled_at', `${todayStr}T23:59:59`);

        const apptCounts: Record<string, number> = {};
        (todayAppts || []).forEach((a: any) => {
          if (a.vet_id) apptCounts[a.vet_id] = (apptCounts[a.vet_id] || 0) + 1;
        });

        // 3. Get last active time per staff member from user_sessions
        const staffIds = staffData.map((s: any) => s.id);
        const { data: sessions } = await supabase
          .from('user_sessions')
          .select('user_id, last_active_at')
          .in('user_id', staffIds)
          .order('last_active_at', { ascending: false });

        const lastLoginMap: Record<string, string> = {};
        (sessions || []).forEach((s: any) => {
          if (!lastLoginMap[s.user_id] && s.last_active_at) lastLoginMap[s.user_id] = s.last_active_at;
        });

        // 4. Check today's shifts to determine On Duty vs Off Today
        const { data: todayShifts } = await supabase
          .from('shifts')
          .select('staff_id')
          .eq('organization_id', organizationId)
          .eq('date', todayStr)
          .in('status', ['Active', 'Swap Pending']);

        const onDutySet = new Set((todayShifts || []).map((s: any) => s.staff_id));

        // 5. Build rows
        const rows: StaffRow[] = staffData.map((s: any) => {
          const profile = s.profiles as { first_name: string; last_name: string } | null;
          const firstName = profile?.first_name || '';
          const lastName = profile?.last_name || '';
          const isVet = VET_ROLES.includes(s.role);
          const displayName = isVet ? `Dr. ${firstName} ${lastName}`.trim() : `${firstName} ${lastName}`.trim();

          let displayStatus: StaffDisplayStatus;
          if (s.status === 'On Leave') {
            displayStatus = 'On Leave';
          } else if (s.status === 'Probation') {
            displayStatus = 'Probation';
          } else if (isVet) {
            displayStatus = onDutySet.has(s.id) ? 'On Duty' : 'Off Today';
          } else {
            displayStatus = onDutySet.has(s.id) ? 'Active' : 'Off Today';
          }

          return {
            id: s.id,
            name: displayName || 'Unknown',
            role: DB_ROLE_DISPLAY[s.role] || s.role,
            appts: isVet ? String(apptCounts[s.id] || 0) : '—',
            status: displayStatus,
            lastActive: formatLastActive(lastLoginMap[s.id] || null),
          };
        });

        // Sort: On Duty/Active first, then On Leave, then Off Today
        const statusOrder: Record<StaffDisplayStatus, number> = {
          'On Duty': 0, 'Active': 0, 'Probation': 1, 'On Leave': 2, 'Off Today': 3, 'Inactive': 4,
        };
        rows.sort((a, b) => (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9));

        setStaffRows(rows);
        setKpiStaffCount(String(rows.length));
      } catch (err) {
        console.error('Failed to load staff overview:', err);
      } finally {
        setStaffLoading(false);
      }
    })();
  }, []);

  // ── KPI: All card metrics ──
  useEffect(() => {
    (async () => {
      try {
        const { organizationId } = await getOrgContext();
        const todayStr = new Date().toISOString().slice(0, 10);

        // ── Total Patients ──
        const { count: petCount } = await supabase
          .from('pets')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', organizationId);
        if (petCount !== null) setKpiPatients(petCount.toLocaleString());

        // Pets added this week
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const { count: newPets } = await supabase
          .from('pets')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', organizationId)
          .gte('created_at', weekAgo.toISOString());
        setKpiPatientsTrend(`+${newPets || 0} this week`);

        // ── Appointments Today ──
        const { count: apptCount } = await supabase
          .from('appointments')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', organizationId)
          .gte('scheduled_at', `${todayStr}T00:00:00`)
          .lt('scheduled_at', `${todayStr}T23:59:59`);
        if (apptCount !== null) setKpiApptsToday(String(apptCount));

        // In-progress appointments
        const { count: inProgress } = await supabase
          .from('appointments')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', organizationId)
          .eq('status', 'In Progress');
        setKpiApptsTrend(`${inProgress || 0} in progress`);

        // ── Staff breakdown ──
        const { data: staffBreakdown } = await supabase
          .from('staff')
          .select('role')
          .eq('organization_id', organizationId)
          .neq('status', 'Inactive');
        if (staffBreakdown) {
          const vetRoles = ['veterinarian', 'senior_veterinarian', 'specialist'];
          const docs = staffBreakdown.filter((s: any) => vetRoles.includes(s.role)).length;
          const admin = staffBreakdown.length - docs;
          setKpiStaffTrend(`${docs} doctor${docs !== 1 ? 's' : ''}, ${admin} admin`);
        }
      } catch {}
    })();
  }, []);

  // ── KPI: Monthly Revenue (re-fetches on month change) ──
  useEffect(() => {
    (async () => {
      try {
        const { organizationId } = await getOrgContext();
        const { year, month } = revenueMonth;
        const startOfMonth = new Date(year, month, 1).toISOString();
        const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59).toISOString();

        // Current month revenue
        const { data: monthInvoices } = await supabase
          .from('invoices')
          .select('total')
          .eq('organization_id', organizationId)
          .gte('created_at', startOfMonth)
          .lte('created_at', endOfMonth)
          .in('status', ['Paid', 'Sent', 'Overdue']);

        const currentTotal = (monthInvoices || []).reduce((sum: number, inv: any) => sum + (Number(inv.total) || 0), 0);
        setKpiRevenue(`$${currentTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}`);

        // Previous month revenue for comparison
        const prevStart = new Date(year, month - 1, 1).toISOString();
        const prevEnd = new Date(year, month, 0, 23, 59, 59).toISOString();
        const { data: prevInvoices } = await supabase
          .from('invoices')
          .select('total')
          .eq('organization_id', organizationId)
          .gte('created_at', prevStart)
          .lte('created_at', prevEnd)
          .in('status', ['Paid', 'Sent', 'Overdue']);

        const prevTotal = (prevInvoices || []).reduce((sum: number, inv: any) => sum + (Number(inv.total) || 0), 0);
        if (prevTotal > 0) {
          const pctChange = ((currentTotal - prevTotal) / prevTotal * 100).toFixed(0);
          const positive = currentTotal >= prevTotal;
          setKpiRevenueTrend(`${positive ? '+' : ''}${pctChange}% vs last month`);
          setKpiRevenueTrendPositive(positive);
        } else {
          setKpiRevenueTrend(currentTotal > 0 ? 'New revenue' : 'No data');
          setKpiRevenueTrendPositive(currentTotal > 0);
        }
      } catch {}
    })();
  }, [revenueMonth]);

  return (
    <div className="max-w-[1440px] mx-auto p-8">

      {/* ── Page Header ── */}
      <div
        style={{
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          marginBottom: '28px', flexWrap: 'wrap', gap: '16px',
        }}
      >
        <div>
          <div className="flex items-center gap-2" style={{ marginBottom: '4px' }}>
            <div
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: '28px', height: '28px', borderRadius: '8px',
                backgroundColor: '#F4A26118',
                border: '1px solid #F4A26140',
              }}
            >
              <Crown style={{ width: '14px', height: '14px', color: '#C2671A' }} />
            </div>
            <h1
              style={{
                fontSize: '26px', fontWeight: 700,
                color: 'var(--text-primary)', margin: 0,
              }}
            >
              Good morning, Victoria 👋
            </h1>
          </div>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: 0 }}>
            Sunday, March 15, 2026
          </p>
        </div>

        <div className="flex items-center gap-3">
          <ConnectionStatusBadge />
          <button
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '8px 16px', borderRadius: '8px',
              backgroundColor: '#F4A261', color: '#fff',
              border: 'none', cursor: 'pointer',
              fontSize: '13px', fontWeight: 600,
            }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = '#E07B2A'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = '#F4A261'}
          >
            <BarChart2 style={{ width: '14px', height: '14px' }} />
            Export Report
          </button>
        </div>
      </div>

      {/* ── KPI Row ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '20px',
          marginBottom: '28px',
        }}
      >
        {GLOW_CARDS.map(card => {
          let dynamicValue = card.value;
          let dynamicTrend = card.trendLabel;
          let dynamicTrendPositive = card.trendPositive;
          let dynamicSubtitle = card.subtitle;
          if (card.title === 'Total Patients') {
            dynamicValue = kpiPatients;
            dynamicTrend = kpiPatientsTrend;
          } else if (card.title === 'Appointments') {
            dynamicValue = kpiApptsToday;
            dynamicTrend = kpiApptsTrend;
          } else if (card.title === 'Monthly Revenue') {
            dynamicValue = kpiRevenue;
            dynamicTrend = kpiRevenueTrend;
            dynamicTrendPositive = kpiRevenueTrendPositive;
            const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
            dynamicSubtitle = `${monthNames[revenueMonth.month]} ${revenueMonth.year}`;
          } else if (card.title === 'Active Staff') {
            dynamicValue = kpiStaffCount;
            dynamicTrend = kpiStaffTrend;
          }
          const isRevenue = card.title === 'Monthly Revenue';
          return (
            <GlowStatCard
              key={card.title}
              {...card}
              value={dynamicValue}
              trendLabel={dynamicTrend}
              trendPositive={dynamicTrendPositive}
              subtitle={dynamicSubtitle}
              onPrev={isRevenue ? () => setRevenueMonth(prev => {
                const m = prev.month - 1;
                return m < 0 ? { year: prev.year - 1, month: 11 } : { year: prev.year, month: m };
              }) : undefined}
              onNext={isRevenue ? () => {
                const now = new Date();
                const currentMonth = now.getFullYear() * 12 + now.getMonth();
                const selectedMonth = revenueMonth.year * 12 + revenueMonth.month;
                if (selectedMonth < currentMonth) {
                  setRevenueMonth(prev => {
                    const m = prev.month + 1;
                    return m > 11 ? { year: prev.year + 1, month: 0 } : { year: prev.year, month: m };
                  });
                }
              } : undefined}
            />
          );
        })}
      </div>

      {/* ── Pending Requests ── */}
      <NotificationsPanel />

      {/* ── Two-column main area ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '60% 40%',
          gap: '20px',
          marginBottom: '24px',
        }}
      >
        {/* ── Left: Staff Overview ── */}
        <div
          style={{
            backgroundColor: 'var(--surface-white)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between"
            style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)' }}
          >
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              Staff Overview
            </h2>
            <button
              onClick={() => navigate('/superadmin/staff')}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)',
                padding: 0, display: 'flex', alignItems: 'center', gap: '4px',
              }}
            >
              View all <ChevronRight style={{ width: '13px', height: '13px' }} />
            </button>
          </div>

          {/* Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--surface-elevated)' }}>
                  {['Name', 'Role', "Today's Appts", 'Status', 'Last Active'].map((col) => (
                    <th
                      key={col}
                      style={{
                        padding: '10px 16px',
                        textAlign: 'left',
                        fontSize: '11px',
                        fontWeight: 700,
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                        color: 'var(--text-secondary)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {staffLoading ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '32px 16px', textAlign: 'center', fontSize: '13px', color: 'var(--text-secondary)' }}>
                      Loading staff…
                    </td>
                  </tr>
                ) : staffRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '32px 16px', textAlign: 'center', fontSize: '13px', color: 'var(--text-secondary)' }}>
                      No staff found
                    </td>
                  </tr>
                ) : (
                  staffRows.map((row, i) => {
                    const s = STATUS_DOT[row.status];
                    return (
                      <tr
                        key={row.id}
                        style={{
                          borderTop: i === 0 ? 'none' : '1px solid var(--border-color)',
                          cursor: 'pointer',
                        }}
                        onClick={() => navigate('/superadmin/staff')}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--surface-elevated)'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'}
                      >
                        <td style={{ padding: '12px 16px', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                          {row.name}
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                          {row.role}
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: '14px', color: 'var(--text-primary)', textAlign: 'center' }}>
                          {row.appts}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: '5px',
                              padding: '3px 10px', borderRadius: '9999px',
                              fontSize: '12px', fontWeight: 600,
                              backgroundColor: s.bg, color: s.color,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: s.dot, flexShrink: 0 }} />
                            {row.status}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                          {row.lastActive}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Right column ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* ── Financial Snapshot ── */}
          <div
            style={{
              backgroundColor: 'var(--surface-white)',
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
              padding: '20px',
            }}
          >
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 16px' }}>
              Financial Snapshot
            </h2>

            {/* Bar rows */}
            {(() => {
              const maxVal = Math.max(finSnap.thisMonth, finSnap.lastMonth, 1);
              const fmt = (n: number) => `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
                  {/* This month */}
                  <div>
                    <div className="flex items-center justify-between" style={{ marginBottom: '4px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>This month</span>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>{fmt(finSnap.thisMonth)}</span>
                    </div>
                    <div style={{ height: '8px', backgroundColor: 'var(--surface-elevated)', borderRadius: '9999px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.min((finSnap.thisMonth / maxVal) * 100, 100)}%`, backgroundColor: '#22C55E', borderRadius: '9999px', transition: 'width 0.5s' }} />
                    </div>
                  </div>

                  {/* Last month */}
                  <div>
                    <div className="flex items-center justify-between" style={{ marginBottom: '4px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>Last month</span>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>{fmt(finSnap.lastMonth)}</span>
                    </div>
                    <div style={{ height: '8px', backgroundColor: 'var(--surface-elevated)', borderRadius: '9999px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.min((finSnap.lastMonth / maxVal) * 100, 100)}%`, backgroundColor: '#94A3B8', borderRadius: '9999px', transition: 'width 0.5s' }} />
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Chips row */}
            <div className="flex items-center gap-2" style={{ flexWrap: 'wrap' }}>
              {finSnap.paid > 0 && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '4px',
                  padding: '4px 10px', borderRadius: '9999px', fontSize: '12px', fontWeight: 600,
                  backgroundColor: '#22C55E18', color: '#15803D',
                }}>
                  Paid ${finSnap.paid.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
              )}
              {finSnap.pending > 0 && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '4px',
                  padding: '4px 10px', borderRadius: '9999px', fontSize: '12px', fontWeight: 600,
                  backgroundColor: '#F4A26118', color: '#C2671A',
                }}>
                  Pending ${finSnap.pending.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
              )}
              {finSnap.overdue > 0 && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '4px',
                  padding: '4px 10px', borderRadius: '9999px', fontSize: '12px', fontWeight: 600,
                  backgroundColor: '#EF444418', color: '#B91C1C',
                }}>
                  Overdue ${finSnap.overdue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
              )}
              {finSnap.paid === 0 && finSnap.pending === 0 && finSnap.overdue === 0 && (
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>No invoice data</span>
              )}
            </div>
          </div>

          {/* ── Today's Activity Feed ── */}
          <div
            style={{
              backgroundColor: 'var(--surface-white)',
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
              padding: '20px',
              flex: 1,
            }}
          >
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 16px' }}>
              Today's Activity
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
              {activityFeed.length === 0 ? (
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', padding: '16px 0', textAlign: 'center' }}>
                  No activity today
                </p>
              ) : activityFeed.map((item, i) => {
                const Icon = item.icon;
                return (
                  <div
                    key={i}
                    className="flex items-start gap-3"
                    style={{
                      padding: '10px 0',
                      borderBottom: i < activityFeed.length - 1 ? '1px solid var(--border-color)' : 'none',
                    }}
                  >
                    <div
                      style={{
                        width: '28px', height: '28px', borderRadius: '8px',
                        backgroundColor: `${item.iconColor}15`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Icon style={{ width: '14px', height: '14px', color: item.iconColor }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: '13px', color: 'var(--text-primary)', margin: '0 0 2px', fontWeight: 500, lineHeight: 1.4 }}>
                        {item.text}
                      </p>
                      <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: 0 }}>
                        {item.time}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Quick Actions ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '12px',
        }}
      >
        {QUICK_ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.label}
              onClick={() => navigate(action.path)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                padding: '14px 16px',
                borderRadius: '10px',
                border: action.primary ? 'none' : '1px solid var(--border-color)',
                backgroundColor: action.primary ? '#F4A261' : 'var(--surface-white)',
                color: action.primary ? '#fff' : 'var(--text-primary)',
                fontSize: '14px', fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLElement;
                if (action.primary) {
                  el.style.backgroundColor = '#E07B2A';
                } else {
                  el.style.backgroundColor = 'var(--surface-elevated)';
                }
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLElement;
                if (action.primary) {
                  el.style.backgroundColor = '#F4A261';
                } else {
                  el.style.backgroundColor = 'var(--surface-white)';
                }
              }}
            >
              <Icon style={{ width: '16px', height: '16px' }} />
              {action.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
