import { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { useTenantDb } from '../context/TenantContext';
import { useAuth } from '../context/AuthContext';
import { useProfile } from '../hooks/useProfile';
import { getOrgContext } from '../hooks/useOrgContext';
import { showToast } from './ToastNotification';
import {
  Home, Users, Calendar, FileText, Settings,
  UserCircle, Bell, FlaskConical, Sun, Moon, Syringe, Clock,
  ChevronLeft, ChevronRight, LogOut, ChevronUp, MessageSquare,
} from 'lucide-react';

export const UNREAD_NOTIFICATION_COUNT = 0; // updated dynamically

type NavItem = {
  name: string;
  icon: React.ElementType;
  path: string;
  badge?: number;
};

type NavSection = {
  id: string;
  label: string;
  items: NavItem[];
};

const INITIAL_SECTIONS: NavSection[] = [
  {
    id: 'overview',
    label: 'Overview',
    items: [
      { name: 'Dashboard',     icon: Home,          path: '/' },
      { name: 'My Portal',     icon: UserCircle,    path: '/my-portal' },
      { name: 'Shifts',        icon: Clock,         path: '/shifts' },
      { name: 'Team Chat',     icon: MessageSquare, path: '/chat' },
      { name: 'Notifications', icon: Bell,          path: '/notifications', badge: UNREAD_NOTIFICATION_COUNT },
    ],
  },
  {
    id: 'clients',
    label: 'Clients',
    items: [
      { name: 'Clients',      icon: Users,    path: '/clients' },
      { name: 'Appointments', icon: Calendar, path: '/appointments' },
    ],
  },
  {
    id: 'medical',
    label: 'Medical',
    items: [
      { name: 'Records',  icon: FileText,     path: '/records' },
      { name: 'Vaccines', icon: Syringe,      path: '/vaccines' },
      { name: 'Lab',      icon: FlaskConical, path: '/lab' },
    ],
  },
];

export function Sidebar({ isDark, onToggleTheme }: { isDark: boolean; onToggleTheme: () => void }) {
  const db = useTenantDb();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();

  const [collapsed, setCollapsed]     = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [sections, setSections]       = useState<NavSection[]>(INITIAL_SECTIONS);

  // Selected clinic context from system admin
  const [clinicName] = useState(() => {
    try {
      const c = JSON.parse(localStorage.getItem('selected_clinic') || '{}');
      return c.name || '';
    } catch { return ''; }
  });

  // Dynamic notification badge count
  const [notifCount, setNotifCount] = useState(0);

  // Compute notification count from Supabase
  const computeNotifCount = async () => {
    try {
      const { organizationId } = await getOrgContext();
      const n = new Date();
      const today = `${n.getFullYear()}-${(n.getMonth() + 1).toString().padStart(2, '0')}-${n.getDate().toString().padStart(2, '0')}`;
      const weekAgo = new Date(Date.now() - 7 * 86400000);
      const weekAgoStr = `${weekAgo.getFullYear()}-${(weekAgo.getMonth() + 1).toString().padStart(2, '0')}-${weekAgo.getDate().toString().padStart(2, '0')}`;

      const uid = user?.id;
      const [apptTodayRes, clientRes, vacRes, completedRes, cancelledRes] = await Promise.all([
        (() => {
          let q = db.from('appointments').select('id, scheduled_at')
            .eq('organization_id', organizationId)
            .gte('scheduled_at', new Date(`${today}T00:00:00`).toISOString()).lte('scheduled_at', new Date(`${today}T23:59:59`).toISOString())
            .in('status', ['Scheduled', 'Confirmed']);
          if (uid) q = q.eq('vet_id', uid);
          return q;
        })(),
        db.from('clients').select('id, created_at')
          .eq('organization_id', organizationId)
          .gte('created_at', `${weekAgoStr}T00:00:00`),
        db.from('vaccinations').select('id, next_due_date, pets!inner(organization_id)')
          .eq('pets.organization_id', organizationId)
          .lte('next_due_date', today),
        (() => {
          let q = db.from('appointments').select('id')
            .eq('organization_id', organizationId)
            .gte('scheduled_at', `${weekAgoStr}T00:00:00`).eq('status', 'Completed');
          if (uid) q = q.eq('vet_id', uid);
          return q;
        })(),
        (() => {
          let q = db.from('appointments').select('id')
            .eq('organization_id', organizationId)
            .gte('scheduled_at', `${weekAgoStr}T00:00:00`).eq('status', 'Cancelled');
          if (uid) q = q.eq('vet_id', uid);
          return q;
        })(),
      ]);

      // Collect all notification IDs (must match NotificationsPage)
      const allIds: string[] = [];

      (apptTodayRes.data || []).forEach((a) => allIds.push(`appt-today-${a.id}`));
      (completedRes.data || []).forEach((a) => allIds.push(`appt-done-${a.id}`));
      (cancelledRes.data || []).forEach((a) => allIds.push(`appt-cancel-${a.id}`));
      (vacRes.data || []).forEach((v) => allIds.push(`vax-${v.id}`));
      (clientRes.data || []).forEach((c) => allIds.push(`client-${c.id}`));

      // Count notification events from Supabase (filter by vet for doctor portal)
      const sevenDaysAgoISO = new Date(Date.now() - 7 * 86400000).toISOString();
      const { data: notifEvts } = await db
        .from('notification_events')
        .select('id, data')
        .eq('organization_id', organizationId)
        .gte('timestamp', sevenDaysAgoISO);
      for (const evt of (notifEvts || [])) {
        const d = (evt as any).data;
        // Skip admin-only events (pto_coverage_needed, etc.)
        if (d?.adminOnly) continue;
        // Skip events targeting a different vet
        if (uid && d?.vetId && d.vetId !== uid) continue;
        allIds.push(evt.id);
      }

      const { data: stateRows } = await db
        .from('notification_state')
        .select('notification_id, status')
        .eq('organization_id', organizationId)
        .eq('user_id', uid);
      const readSet = new Set<string>();
      const dismissedSet = new Set<string>();
      for (const row of (stateRows || [])) {
        if (row.status === 'read') readSet.add(row.notification_id);
        if (row.status === 'dismissed') dismissedSet.add(row.notification_id);
      }

      const unread = allIds.filter(id => !dismissedSet.has(id) && !readSet.has(id)).length;

      // Show toast when notification count increases
      if (prevNotifCountRef.current >= 0 && unread > prevNotifCountRef.current && pathname !== '/notifications') {
        showToast({
          type: 'notification',
          title: 'New notification',
          message: `You have ${unread} unread notification${unread > 1 ? 's' : ''}`,
          link: '/notifications',
        });
      }
      prevNotifCountRef.current = unread;
      setNotifCount(unread);
    } catch {}
  };

  // Compute on mount (skip if already on notifications page — it broadcasts its own count)
  useEffect(() => {
    if (pathname !== '/notifications') computeNotifCount();
  }, []);

  // Listen for count changes — either with explicit count or re-compute
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && typeof detail.count === 'number') {
        setNotifCount(detail.count);
      } else {
        // Re-compute from DB (e.g. after adding a client)
        computeNotifCount();
      }
    };
    window.addEventListener('notifCountChanged', handler);
    return () => window.removeEventListener('notifCountChanged', handler);
  }, []);

  // ── Chat unread badge from Supabase (all conversations) ──────────
  const [chatUnread, setChatUnread] = useState(0);
  const prevChatCountRef = useRef(-1);
  const prevNotifCountRef = useRef(-1);

  useEffect(() => {
    if (!user) return;
    let mounted = true;
    let interval: ReturnType<typeof setInterval>;

    async function checkChatUnread() {
      if (!mounted) return;
      const { organizationId: chatOrgId } = await getOrgContext();
      // Get all conversations where user is a participant
      const { data: parts } = await db
        .from('conversation_participants')
        .select('conversation_id, last_read_at')
        .eq('organization_id', chatOrgId)
        .eq('profile_id', user!.id);
      if (!parts || parts.length === 0) { if (mounted) setChatUnread(0); return; }

      let totalUnread = 0;
      for (const part of parts) {
        const readAt = part.last_read_at || '1970-01-01T00:00:00Z';
        const { count } = await db
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', chatOrgId)
          .eq('conversation_id', part.conversation_id)
          .neq('sender_id', user!.id)
          .gt('created_at', readAt);
        totalUnread += (count || 0);
      }

      const c = totalUnread > 0 ? totalUnread : 0;
      // Show toast when new message detected
      if (mounted && c > 0 && prevChatCountRef.current === 0 && pathname !== '/chat') {
        // Fetch latest unread message across all conversations
        for (const part of parts) {
          const readAt = part.last_read_at || '1970-01-01T00:00:00Z';
          const { data: latest } = await db
            .from('messages')
            .select('sender_id, content, profiles:profiles!messages_sender_id_fkey(first_name, last_name)')
            .eq('organization_id', chatOrgId)
            .eq('conversation_id', part.conversation_id)
            .neq('sender_id', user!.id)
            .gt('created_at', readAt)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
          if (latest && mounted) {
            const p = (latest as any).profiles;
            const senderName = p ? `${p.first_name || ''} ${p.last_name || ''}`.trim() : 'New message';
            showToast({
              type: 'chat',
              title: senderName,
              message: latest.content || 'Sent a message',
              link: '/chat',
            });
            break; // Only show one toast
          }
        }
      }
      if (mounted) { prevChatCountRef.current = c; setChatUnread(c); }
    }

    checkChatUnread();
    interval = setInterval(checkChatUnread, 3000);

    return () => { mounted = false; if (interval) clearInterval(interval); };
  }, [pathname, user]);

  // Listen for chat read events from ChatPage
  useEffect(() => {
    const handler = () => {
      setChatUnread(0);
    };
    window.addEventListener('doctorChatRead', handler);
    return () => window.removeEventListener('doctorChatRead', handler);
  }, []);

  // Update sections when notifCount or chatUnread changes
  useEffect(() => {
    setSections(prev => prev.map(s => s.id === 'overview' ? {
      ...s,
      items: s.items.map(item => {
        if (item.path === '/notifications') return { ...item, badge: notifCount };
        if (item.path === '/chat') return { ...item, badge: chatUnread || undefined };
        return item;
      }),
    } : s));
  }, [notifCount, chatUnread]);

  // Staff profile from hook
  const { profile: doctorProfile } = useProfile('doctor');

  // Drag state for sections
  const dragSectionIndex = useRef<number | null>(null);
  const [dragOverSection, setDragOverSection] = useState<number | null>(null);
  const [isDraggingSection, setIsDraggingSection] = useState(false);

  // Close profile popup on outside click
  const profileRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    if (profileOpen) document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [profileOpen]);

  // ── Section drag handlers ──────────────────────────────────────────────────
  function onSectionDragStart(e: React.DragEvent, idx: number) {
    dragSectionIndex.current = idx;
    setIsDraggingSection(true);
    e.dataTransfer.effectAllowed = 'move';
  }

  function onSectionDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault();
    if (dragSectionIndex.current !== null && dragSectionIndex.current !== idx) {
      setDragOverSection(idx);
    }
  }

  function onSectionDrop(e: React.DragEvent, dropIdx: number) {
    e.preventDefault();
    const from = dragSectionIndex.current;
    if (from === null || from === dropIdx) return;
    const reordered = [...sections];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(dropIdx, 0, moved);
    setSections(reordered);
    dragSectionIndex.current = null;
    setDragOverSection(null);
    setIsDraggingSection(false);
  }

  function onSectionDragEnd() {
    dragSectionIndex.current = null;
    setDragOverSection(null);
    setIsDraggingSection(false);
  }

  return (
    <div
      className="h-screen bg-[var(--surface-white)] border-r border-[var(--border-color)] flex flex-col relative flex-shrink-0"
      style={{
        width: collapsed ? '72px' : '256px',
        transition: 'width 0.25s cubic-bezier(0.4,0,0.2,1)',
      }}
    >
      {/* ── Logo ────────────────────────────────────────────────────────────── */}
      <div
        className="border-b border-[var(--border-color)] flex items-center overflow-hidden flex-shrink-0"
        style={{
          height: '72px',
          padding: collapsed ? '0' : '0 24px',
          justifyContent: collapsed ? 'center' : 'flex-start',
          transition: 'padding 0.25s',
        }}
      >
        <Link to="/" className="flex items-center gap-2 flex-shrink-0">
          {collapsed ? (
            <img src="/logo-mini.svg" alt="HugoIT" className="flex-shrink-0" style={{ width: '32px', height: '32px' }} />
          ) : (
            <img src={isDark ? '/logo-full-dark.svg' : '/logo-full.svg'} alt="HugoIT" className="flex-shrink-0" style={{ height: '52px' }} />
          )}
        </Link>
      </div>

      {/* ── Clinic name indicator ──────────────────────────────────────────── */}
      {clinicName && !collapsed && (
        <div
          className="flex items-center gap-2 border-b border-[var(--border-color)]"
          style={{ padding: '8px 24px', minHeight: '36px' }}
        >
          <div style={{
            width: 6, height: 6, borderRadius: '50%',
            backgroundColor: '#22c55e', flexShrink: 0,
          }} />
          <span className="text-[var(--text-secondary)] truncate" style={{ fontSize: 12, fontWeight: 600 }}>
            {clinicName}
          </span>
        </div>
      )}

      {/* ── Collapse toggle ──────────────────────────────────────────────────── */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className="absolute z-20 flex items-center justify-center bg-[var(--surface-white)] border border-[var(--border-color)] hover:bg-[var(--surface-elevated)] transition-colors"
        style={{
          width: '22px', height: '22px', borderRadius: '50%',
          top: '60px', right: '-11px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
        }}
      >
        {collapsed
          ? <ChevronRight className="w-3 h-3 text-[var(--text-secondary)]" />
          : <ChevronLeft  className="w-3 h-3 text-[var(--text-secondary)]" />
        }
      </button>

      {/* ── Navigation ──────────────────────────────────────────────────────── */}
      <nav className="flex-1" style={{ padding: '12px 8px 12px 14px', overflowY: 'auto' }}>
        {sections.map((section, si) => {
          const isBeingDragged = dragSectionIndex.current === si && isDraggingSection;
          const isDropTarget   = dragOverSection === si && !isBeingDragged;

          return (
            <div
              key={section.id}
              draggable={!collapsed}
              onDragStart={(e) => onSectionDragStart(e, si)}
              onDragOver={(e)  => onSectionDragOver(e, si)}
              onDrop={(e)      => onSectionDrop(e, si)}
              onDragEnd={onSectionDragEnd}
              style={{
                marginTop: si === 0 ? 0 : '8px',
                opacity: isBeingDragged ? 0.35 : 1,
                transition: 'opacity 0.15s',
                borderRadius: '8px',
                // drop indicator bar above the target
                boxShadow: isDropTarget ? 'inset 0 2px 0 0 var(--brand-green-text)' : undefined,
                paddingTop: isDropTarget ? '3px' : undefined,
              }}
            >
              {/* Section header (divider + label + grip) */}
              {si > 0 && (
                <div
                  className="flex items-center gap-2 overflow-hidden group"
                  style={{ margin: '4px 0 6px', padding: '0 4px' }}
                >
                  {/* left rule */}
                  <div
                    className="flex-shrink-0 border-t border-[var(--border-color)]"
                    style={{ width: collapsed ? '100%' : '10px' }}
                  />

                  {!collapsed && (
                    <>
                      <span
                        className="text-[var(--text-secondary)] whitespace-nowrap flex-shrink-0 uppercase"
                        style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em' }}
                      >
                        {section.label}
                      </span>

                      {/* right rule */}
                      <div className="flex-1 border-t border-[var(--border-color)]" />
                    </>
                  )}
                </div>
              )}

              {/* Nav items */}
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {section.items.map((item) => {
                  const Icon     = item.icon;
                  const isActive = item.path === '/'
                    ? pathname === '/'
                    : pathname.startsWith(item.path);

                  return (
                    <li key={item.name} style={{ position: 'relative', marginBottom: '2px' }}>
                      {isActive && (
                        <>
                          <span style={{
                            position: 'absolute',
                            left: '-6px',
                            top: '18%',
                            bottom: '18%',
                            width: '4px',
                            borderRadius: '3px',
                            backgroundColor: 'var(--brand-green-text)',
                            boxShadow: isDark ? '0 0 12px 3px var(--brand-green-text)' : 'none',
                            zIndex: 2,
                          }} />
                          <span style={{
                            position: 'absolute',
                            left: 0,
                            top: 0,
                            bottom: 0,
                            width: '40%',
                            background: isDark ? 'radial-gradient(ellipse at -5% 50%, var(--brand-green-text) 0%, transparent 65%)' : 'none',
                            opacity: isDark ? 0.15 : 0,
                            pointerEvents: 'none',
                            borderRadius: '8px 0 0 8px',
                            zIndex: 1,
                          }} />
                        </>
                      )}
                      <Link
                        to={item.path}
                        draggable={false}
                        title={collapsed ? item.name : undefined}
                        className={`flex items-center transition-colors ${
                          isActive
                            ? 'bg-[var(--surface-elevated)] text-[var(--brand-green-text)]'
                            : 'text-[var(--text-secondary)] hover:bg-[var(--surface-elevated)] hover:text-[var(--text-primary)]'
                        }`}
                        style={{
                          borderRadius: '8px',
                          fontSize: '15px',
                          fontWeight: 600,
                          padding:         collapsed ? '10px 0' : '9px 12px',
                          justifyContent:  collapsed ? 'center' : 'flex-start',
                          gap:             collapsed ? 0 : '10px',
                          overflow: 'hidden',
                        }}
                      >
                        {/* Icon (+ red dot when collapsed & has badge) */}
                        <span style={{ position: 'relative', flexShrink: 0, display: 'flex' }}>
                          <Icon className="w-5 h-5" />
                          {collapsed && item.badge != null && item.badge > 0 && (
                            <span style={{
                              position: 'absolute', top: '-3px', right: '-3px',
                              width: '8px', height: '8px',
                              backgroundColor: '#d4183d', borderRadius: '50%',
                              border: '1.5px solid var(--surface-white)',
                            }} />
                          )}
                        </span>

                        {!collapsed && (
                          <>
                            <span className="flex-1 whitespace-nowrap">{item.name}</span>
                            {item.badge != null && item.badge > 0 && (
                              <span
                                className="inline-flex items-center justify-center flex-shrink-0"
                                style={{
                                  backgroundColor: isActive ? 'var(--brand-green-text)' : '#d4183d',
                                  color: isActive ? '#000' : '#fff',
                                  borderRadius: '9999px', fontSize: '11px', fontWeight: 700,
                                  minWidth: '20px', height: '20px', padding: '0 6px',
                                }}
                              >
                                {item.badge > 99 ? '99+' : item.badge}
                              </span>
                            )}
                          </>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <div className="border-t border-[var(--border-color)] flex-shrink-0" style={{ padding: '12px 8px' }}>

        {/* Dark / Light toggle */}
        <button
          onClick={onToggleTheme}
          title={collapsed ? (isDark ? 'Light mode' : 'Dark mode') : undefined}
          className="w-full flex items-center transition-colors hover:bg-[var(--surface-elevated)]"
          style={{
            borderRadius: '8px',
            padding:        collapsed ? '8px 0' : '8px 10px',
            justifyContent: collapsed ? 'center' : 'flex-start',
            gap:            collapsed ? 0 : '10px',
            marginBottom: '4px',
          }}
        >
          <div
            className="flex items-center justify-center flex-shrink-0"
            style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: 'var(--surface-elevated)' }}
          >
            {isDark
              ? <Sun  className="w-4 h-4 text-[#F4A261]" />
              : <Moon className="w-4 h-4 text-[#6B7280]" />
            }
          </div>

          {!collapsed && (
            <>
              <span className="flex-1 text-left text-[var(--text-secondary)] whitespace-nowrap" style={{ fontSize: '14px', fontWeight: 500 }}>
                {isDark ? 'Light mode' : 'Dark mode'}
              </span>
              <div className="ml-auto flex-shrink-0 relative" style={{ width: '36px', height: '20px', backgroundColor: isDark ? 'var(--brand-green-text)' : 'var(--border-color)', borderRadius: '9999px', transition: 'background-color 0.2s' }}>
                <div style={{ position: 'absolute', top: '3px', left: isDark ? '19px' : '3px', width: '14px', height: '14px', backgroundColor: '#fff', borderRadius: '9999px', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
              </div>
            </>
          )}
        </button>

        {/* Profile row — click opens popup */}
        <div ref={profileRef} style={{ position: 'relative' }}>

          {/* Popup — fixed when collapsed so it never clips off-screen */}
          {profileOpen && (
            <div
              data-slot="dropdown-menu-content"
              role="menu"
              className="bg-[var(--surface-white)] border border-[var(--border-color)]"
              style={collapsed ? {
                position: 'fixed',
                bottom: '12px',
                left: '80px',
                borderRadius: '12px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                overflow: 'hidden',
                zIndex: 50,
                width: '220px',
              } : {
                position: 'absolute',
                bottom: 'calc(100% + 8px)',
                left: 0,
                borderRadius: '12px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                overflow: 'hidden',
                zIndex: 50,
                width: '220px',
              }}
            >
              {/* Mini header */}
              <div className="border-b border-[var(--border-color)]" style={{ padding: '14px 16px' }}>
                <div className="flex items-center gap-3">
                  {doctorProfile.avatarUrl ? (
                    <img
                      src={doctorProfile.avatarUrl}
                      alt={doctorProfile.fullName}
                      className="w-10 h-10 object-cover flex-shrink-0"
                      style={{ borderRadius: '50%' }}
                    />
                  ) : (
                    <div
                      className="w-10 h-10 flex-shrink-0 flex items-center justify-center"
                      style={{ borderRadius: '50%', backgroundColor: 'color-mix(in srgb, var(--brand-green-text) 12%, transparent)', color: 'var(--brand-green-text)', fontSize: '14px', fontWeight: 700 }}
                    >
                      {doctorProfile.initials}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-[var(--text-primary)] truncate" style={{ fontSize: '14px', fontWeight: 600 }}>
                      {doctorProfile.fullName}
                    </p>
                    <p className="text-[var(--text-secondary)] truncate" style={{ fontSize: '12px' }}>
                      {doctorProfile.email}
                    </p>
                  </div>
                </div>
              </div>

              {/* Settings + Log out */}
              <div style={{ padding: '6px' }}>
                <button
                  onClick={() => { setProfileOpen(false); navigate('/settings'); }}
                  className="w-full flex items-center gap-3 hover:bg-[var(--surface-elevated)] transition-colors"
                  style={{ borderRadius: '8px', padding: '9px 10px', fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}
                >
                  <Settings className="w-4 h-4 flex-shrink-0 text-[var(--text-secondary)]" />
                  Settings
                </button>
                <div style={{ height: '1px', backgroundColor: 'var(--border-color)', margin: '4px 0' }} />
                <button
                  onClick={async () => { setProfileOpen(false); await signOut(); navigate('/login'); }}
                  className="w-full flex items-center gap-3 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                  style={{ borderRadius: '8px', padding: '9px 10px', fontSize: '14px', fontWeight: 500, color: '#d4183d' }}
                >
                  <LogOut className="w-4 h-4 flex-shrink-0" />
                  Log out
                </button>
              </div>
            </div>
          )}

          {/* Trigger */}
          <button
            onClick={() => setProfileOpen(!profileOpen)}
            title={collapsed ? doctorProfile.fullName : undefined}
            className={`w-full flex items-center transition-colors overflow-hidden ${profileOpen ? 'bg-[var(--surface-elevated)]' : 'hover:bg-[var(--surface-elevated)]'}`}
            style={{
              borderRadius: '8px',
              padding:        collapsed ? '6px 0' : '6px 10px',
              justifyContent: collapsed ? 'center' : 'flex-start',
              gap:            collapsed ? 0 : '10px',
            }}
          >
            {doctorProfile.avatarUrl ? (
              <img
                src={doctorProfile.avatarUrl}
                alt={doctorProfile.fullName}
                className="w-9 h-9 object-cover flex-shrink-0"
                style={{ borderRadius: '50%' }}
              />
            ) : (
              <div
                className="w-9 h-9 flex-shrink-0 flex items-center justify-center"
                style={{ borderRadius: '50%', backgroundColor: 'color-mix(in srgb, var(--brand-green-text) 12%, transparent)', color: 'var(--brand-green-text)', fontSize: '13px', fontWeight: 700 }}
              >
                {doctorProfile.initials}
              </div>
            )}
            {!collapsed && (
              <>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-[var(--text-primary)] truncate" style={{ fontSize: '14px', fontWeight: 600 }}>
                    {doctorProfile.fullName}
                  </p>
                  <p className="text-[var(--text-secondary)] truncate" style={{ fontSize: '12px', fontWeight: 400 }}>
                    {doctorProfile.role ? doctorProfile.role.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()) : 'Veterinarian'}
                  </p>
                </div>
                <ChevronUp
                  className="w-4 h-4 text-[var(--text-secondary)] flex-shrink-0 transition-transform"
                  style={{ transform: profileOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
