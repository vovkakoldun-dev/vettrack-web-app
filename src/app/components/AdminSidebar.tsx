import { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { supabase } from '../../lib/supabase';
import { useTenantDb } from '../context/TenantContext';
import { useAuth } from '../context/AuthContext';
import { useProfile } from '../hooks/useProfile';
import { getOrgContext } from '../hooks/useOrgContext';
import { showToast } from './ToastNotification';
import {
  Home, Calendar, CreditCard, MessageSquare, MessageCircle, Users, FileText, UserCircle, Clock,
  PawPrint, Sun, Moon, ChevronLeft, ChevronRight, LogOut, ChevronUp, Settings, CheckSquare,
  Bell, FlaskConical,
} from 'lucide-react';

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

const NAV_SECTIONS: NavSection[] = [
  {
    id: 'overview',
    label: 'Overview',
    items: [
      { name: 'Dashboard',      icon: Home,            path: '/admin' },
      { name: 'My Portal',      icon: UserCircle,      path: '/admin/my-portal' },
      { name: 'HugoChat',       icon: MessageCircle,   path: '/admin/chat' },
      { name: 'Communications', icon: MessageSquare,    path: '/admin/communications' },
      { name: 'Tasks',          icon: CheckSquare,      path: '/admin/tasks' },
      { name: 'Shifts',         icon: Clock,            path: '/admin/shifts' },
      { name: 'Notifications',  icon: Bell,             path: '/admin/notifications' },
    ],
  },
  {
    id: 'management',
    label: 'Management',
    items: [
      { name: 'Bookings', icon: Calendar,      path: '/admin/bookings' },
      { name: 'Payments', icon: CreditCard,     path: '/admin/payments' },
      { name: 'Clients',  icon: Users,          path: '/admin/clients' },
      { name: 'Records',  icon: FileText,       path: '/admin/records' },
      { name: 'Lab',      icon: FlaskConical,   path: '/admin/lab' },
    ],
  },
];

export function AdminSidebar({ isDark, onToggleTheme }: { isDark: boolean; onToggleTheme: () => void }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();

  const db = useTenantDb();
  const [collapsed, setCollapsed]     = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const { profile: adminProfile } = useProfile('admin');
  const [sections, setSections]       = useState<NavSection[]>(NAV_SECTIONS);

  // ── Notification unread badge ──────────────────────────────────
  const [notifUnread, setNotifUnread] = useState(0);
  const prevNotifCountRef = useRef(-1);
  const justLeftNotifRef = useRef(false);
  const prevPathnameRef = useRef(pathname);

  useEffect(() => {
    if (!user) return;
    let mounted = true;

    async function computeNotifCount() {
      try {
        const { organizationId } = await getOrgContext();
        const sevenDaysAgoISO = new Date(Date.now() - 7 * 86400000).toISOString();
        const now = new Date();
        const today = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
        const weekAgoStr = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

        // Parallel: appointments, clients, vaccines, notification_events, notification_state
        const [apptTodayRes, completedRes, cancelledRes, clientRes, vacRes, notifEvtRes, stateRes] = await Promise.all([
          db.from('appointments').select('id').eq('organization_id', organizationId)
            .gte('scheduled_at', new Date(`${today}T00:00:00`).toISOString()).lte('scheduled_at', new Date(`${today}T23:59:59`).toISOString())
            .in('status', ['Scheduled', 'Confirmed']),
          db.from('appointments').select('id').eq('organization_id', organizationId)
            .gte('scheduled_at', `${weekAgoStr}T00:00:00`).eq('status', 'Completed'),
          db.from('appointments').select('id').eq('organization_id', organizationId)
            .gte('scheduled_at', `${weekAgoStr}T00:00:00`).eq('status', 'Cancelled'),
          db.from('clients').select('id').eq('organization_id', organizationId)
            .gte('created_at', `${weekAgoStr}T00:00:00`),
          db.from('vaccinations').select('id, pets!inner(organization_id)')
            .eq('pets.organization_id', organizationId).lte('next_due_date', today),
          db.from('notification_events').select('id, data').eq('organization_id', organizationId)
            .gte('timestamp', sevenDaysAgoISO),
          db.from('notification_state').select('notification_id, status').eq('organization_id', organizationId).eq('user_id', user.id),
        ]);

        const allIds: string[] = [];
        (apptTodayRes.data || []).forEach((a: any) => allIds.push(`appt-today-${a.id}`));
        (completedRes.data || []).forEach((a: any) => allIds.push(`appt-done-${a.id}`));
        (cancelledRes.data || []).forEach((a: any) => allIds.push(`appt-cancel-${a.id}`));
        (clientRes.data || []).forEach((c: any) => allIds.push(`client-${c.id}`));
        (vacRes.data || []).forEach((v: any) => allIds.push(`vax-${v.id}`));
        for (const evt of (notifEvtRes.data || []) as any[]) {
          allIds.push(evt.id);
        }

        const readSet = new Set<string>();
        const dismissedSet = new Set<string>();
        for (const row of ((stateRes.data || []) as any[])) {
          if (row.status === 'read') readSet.add(row.notification_id);
          if (row.status === 'dismissed') dismissedSet.add(row.notification_id);
        }
        const unread = allIds.filter(id => !dismissedSet.has(id) && !readSet.has(id)).length;

        if (mounted && unread > 0 && prevNotifCountRef.current === 0 && pathname !== '/admin/notifications') {
          showToast({
            type: 'notification',
            title: 'New notification',
            message: `You have ${unread} unread notification${unread > 1 ? 's' : ''}`,
            link: '/admin/notifications',
          });
        }
        if (mounted) { prevNotifCountRef.current = unread; setNotifUnread(unread); }
      } catch {}
    }

    // Track whether we just left the notifications page
    const wasOnNotif = prevPathnameRef.current === '/admin/notifications';
    prevPathnameRef.current = pathname;

    if (pathname === '/admin/notifications') {
      // On notifications page — mark ALL sidebar notification IDs as read directly
      setNotifUnread(0);
      justLeftNotifRef.current = true;
      // The sidebar knows what IDs it generates — mark them all read now
      (async () => {
        try {
          const { organizationId } = await getOrgContext();
          const sevenDaysAgoISO = new Date(Date.now() - 7 * 86400000).toISOString();
          const now = new Date();
          const today = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
          const weekAgoStr = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
          const [a1, a2, a3, c1, v1, e1] = await Promise.all([
            db.from('appointments').select('id').eq('organization_id', organizationId)
              .gte('scheduled_at', new Date(`${today}T00:00:00`).toISOString()).lte('scheduled_at', new Date(`${today}T23:59:59`).toISOString())
              .in('status', ['Scheduled', 'Confirmed']),
            db.from('appointments').select('id').eq('organization_id', organizationId)
              .gte('scheduled_at', `${weekAgoStr}T00:00:00`).eq('status', 'Completed'),
            db.from('appointments').select('id').eq('organization_id', organizationId)
              .gte('scheduled_at', `${weekAgoStr}T00:00:00`).eq('status', 'Cancelled'),
            db.from('clients').select('id').eq('organization_id', organizationId)
              .gte('created_at', `${weekAgoStr}T00:00:00`),
            db.from('vaccinations').select('id, pets!inner(organization_id)')
              .eq('pets.organization_id', organizationId).lte('next_due_date', today),
            db.from('notification_events').select('id').eq('organization_id', organizationId)
              .gte('timestamp', sevenDaysAgoISO),
          ]);
          const allIds: string[] = [];
          (a1.data || []).forEach((a: any) => allIds.push(`appt-today-${a.id}`));
          (a2.data || []).forEach((a: any) => allIds.push(`appt-done-${a.id}`));
          (a3.data || []).forEach((a: any) => allIds.push(`appt-cancel-${a.id}`));
          (c1.data || []).forEach((c: any) => allIds.push(`client-${c.id}`));
          (v1.data || []).forEach((v: any) => allIds.push(`vax-${v.id}`));
          (e1.data || []).forEach((e: any) => allIds.push(e.id));
          if (allIds.length > 0 && user) {
            // Don't overwrite dismissed entries — only mark non-dismissed as read
            const { data: alreadyDismissed } = await db.from('notification_state')
              .select('notification_id').eq('organization_id', organizationId).eq('user_id', user.id)
              .eq('status', 'dismissed').in('notification_id', allIds);
            const dismissedSet = new Set((alreadyDismissed || []).map(r => r.notification_id));
            const rows = allIds.filter(id => !dismissedSet.has(id)).map(id => ({
              notification_id: id, status: 'read' as const,
              updated_at: new Date().toISOString(),
              organization_id: organizationId, user_id: user.id,
            }));
            if (rows.length > 0) await db.from('notification_state').upsert(rows);
          }
        } catch (e) { console.error('Sidebar auto-read failed:', e); }
      })();
    } else if (wasOnNotif || justLeftNotifRef.current) {
      // Just left notifications — everything was marked read above, skip re-compute briefly
      justLeftNotifRef.current = false;
      setNotifUnread(0);
      const timer = setTimeout(() => { if (mounted) computeNotifCount(); }, 2000);
      return () => { mounted = false; clearTimeout(timer); };
    } else {
      computeNotifCount();
    }

    // Listen for explicit broadcasts from NotificationsPage
    const handler = (e: Event) => {
      const count = (e as CustomEvent).detail?.count;
      if (typeof count === 'number') setNotifUnread(count);
      else computeNotifCount();
    };
    window.addEventListener('notifCountChanged', handler);
    return () => { mounted = false; window.removeEventListener('notifCountChanged', handler); };
  }, [pathname, user]);

  // ── Chat unread badge from Supabase (all conversations) ──────────
  const [chatUnread, setChatUnread] = useState(0);
  const prevChatCountRef = useRef(-1);

  useEffect(() => {
    if (!user) return;
    let mounted = true;
    let interval: ReturnType<typeof setInterval>;

    async function checkChatUnread() {
      if (!mounted) return;
      const { organizationId: chatOrgId } = await getOrgContext();
      const { data: parts } = await supabase
        .from('conversation_participants')
        .select('conversation_id, last_read_at')
        .eq('organization_id', chatOrgId)
        .eq('profile_id', user!.id);
      if (!parts || parts.length === 0) { if (mounted) setChatUnread(0); return; }

      // Compute cutoff from earliest last_read_at — single batched query instead of N loops
      const convIds = parts.map(p => p.conversation_id);
      const earliestLastRead = parts.reduce((min, p) => {
        const lr = p.last_read_at || '1970-01-01T00:00:00Z';
        return lr < min ? lr : min;
      }, new Date().toISOString());

      const { data: unreadMsgs } = await supabase
        .from('messages')
        .select('id, conversation_id, created_at, sender_id, content, profiles:profiles!messages_sender_id_fkey(first_name, last_name)')
        .eq('organization_id', chatOrgId)
        .in('conversation_id', convIds)
        .neq('sender_id', user!.id)
        .gt('created_at', earliestLastRead)
        .order('created_at', { ascending: false })
        .limit(50);

      // Build per-conversation last_read_at map and count truly unread
      const lastReadMap = new Map(parts.map(p => [p.conversation_id, p.last_read_at || '1970-01-01T00:00:00Z']));
      let totalUnread = 0;
      for (const m of (unreadMsgs || [])) {
        const convLastRead = lastReadMap.get(m.conversation_id) || '1970-01-01T00:00:00Z';
        if (m.created_at > convLastRead) totalUnread++;
      }

      const c = totalUnread > 0 ? totalUnread : 0;
      if (mounted && c > 0 && prevChatCountRef.current === 0 && pathname !== '/admin/chat') {
        // Show toast for the most recent unread message
        const newest = (unreadMsgs || [])[0];
        if (newest && mounted) {
          const p = (newest as any).profiles;
          const senderName = p ? `${p.first_name || ''} ${p.last_name || ''}`.trim() : 'New message';
          showToast({
            type: 'chat',
            title: senderName,
            message: newest.content || 'Sent a message',
            link: '/admin/chat',
          });
        }
      }
      if (mounted) { prevChatCountRef.current = c; setChatUnread(c); }
    }

    checkChatUnread();
    interval = setInterval(checkChatUnread, 15000);

    return () => { mounted = false; if (interval) clearInterval(interval); };
  }, [pathname, user]);

  // Listen for chat read events from AdminChatPage
  useEffect(() => {
    const handler = () => {
      setChatUnread(0);
    };
    window.addEventListener('adminChatRead', handler);
    return () => window.removeEventListener('adminChatRead', handler);
  }, []);

  // ── Email unread badge from Gmail API ──────────
  const [emailUnread, setEmailUnread] = useState(0);
  const prevEmailCountRef = useRef(-1);

  useEffect(() => {
    if (!user) return;
    let mounted = true;
    let interval: ReturnType<typeof setInterval>;

    async function checkEmailUnread() {
      if (!mounted) return;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        // Check if user has an active email integration first
        const { data: integrations } = await supabase
          .from('email_integrations')
          .select('id, provider, status')
          .eq('user_id', user!.id)
          .eq('status', 'active');

        if (!integrations || integrations.length === 0) {
          if (mounted) setEmailUnread(0);
          return;
        }

        // Fetch inbox unread count from Gmail labels API
        const FUNCTIONS_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
        const resp = await fetch(`${FUNCTIONS_BASE}/gmail-api?action=labels`, {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
        });
        if (!resp.ok) return;
        const data = await resp.json();
        const labels = data.labels || [];
        const inbox = labels.find((l: any) => l.id === 'INBOX');
        const unread = inbox?.messagesUnread || 0;

        if (mounted && unread > 0 && prevEmailCountRef.current >= 0 && unread > prevEmailCountRef.current && pathname !== '/admin/communications') {
          showToast({
            type: 'info',
            title: 'New Email',
            message: `You have ${unread} unread email${unread > 1 ? 's' : ''} in your inbox`,
            link: '/admin/communications',
          });
        }
        if (mounted) { prevEmailCountRef.current = unread; setEmailUnread(unread); }
      } catch (err) {
        // Silently fail — email badge is non-critical
      }
    }

    checkEmailUnread();
    interval = setInterval(checkEmailUnread, 30000); // Check every 30 seconds

    return () => { mounted = false; if (interval) clearInterval(interval); };
  }, [pathname, user]);

  // Listen for email read events from Communications page — decrement badge
  useEffect(() => {
    const handler = () => {
      setEmailUnread(prev => {
        const next = Math.max(0, prev - 1);
        prevEmailCountRef.current = next;
        return next;
      });
    };
    window.addEventListener('adminEmailRead', handler);
    return () => window.removeEventListener('adminEmailRead', handler);
  }, []);

  // ── Task pending badge from Supabase ──────────
  const [taskPending, setTaskPending] = useState(0);

  useEffect(() => {
    if (!user) return;
    let mounted = true;
    let interval: ReturnType<typeof setInterval>;

    async function checkTaskPending() {
      if (!mounted) return;
      try {
        const { organizationId } = await getOrgContext();
        const { count } = await supabase
          .from('tasks')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', organizationId)
          .in('status', ['Pending', 'In Progress']);
        if (mounted) setTaskPending(count || 0);
      } catch { /* silent */ }
    }

    checkTaskPending();
    interval = setInterval(checkTaskPending, 30000);

    return () => { mounted = false; if (interval) clearInterval(interval); };
  }, [user]);

  // Listen for task status changes from AdminTasksPage
  useEffect(() => {
    const handler = (e: Event) => {
      const count = (e as CustomEvent).detail?.count;
      if (typeof count === 'number') setTaskPending(count);
    };
    window.addEventListener('taskCountChanged', handler);
    return () => window.removeEventListener('taskCountChanged', handler);
  }, []);

  // Update sections when chatUnread, emailUnread, notifUnread, or taskPending changes
  useEffect(() => {
    setSections(NAV_SECTIONS.map(s => {
      if (s.id === 'overview') return {
        ...s,
        items: s.items.map(item => {
          if (item.path === '/admin/chat') return { ...item, badge: chatUnread || undefined };
          if (item.path === '/admin/communications') {
            const showBadge = pathname !== '/admin/communications' ? emailUnread : undefined;
            return { ...item, badge: showBadge || undefined };
          }
          if (item.path === '/admin/tasks') return { ...item, badge: taskPending || undefined };
          if (item.path === '/admin/notifications') {
            const showBadge = pathname !== '/admin/notifications' ? notifUnread : undefined;
            return { ...item, badge: showBadge || undefined };
          }
          return item;
        }),
      };
      return s;
    }));
  }, [chatUnread, emailUnread, notifUnread, taskPending, pathname]);

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

  return (
    <div
      className="h-screen bg-[var(--surface-white)] border-r border-[var(--border-color)] flex flex-col relative flex-shrink-0"
      style={{
        width: collapsed ? '72px' : '256px',
        transition: 'width 0.25s cubic-bezier(0.4,0,0.2,1)',
      }}
    >
      {/* ── Logo ── */}
      <div
        className="border-b border-[var(--border-color)] flex flex-col items-center justify-center overflow-hidden flex-shrink-0"
        style={{
          height: '72px',
          padding: collapsed ? '0' : '0 24px',
          alignItems: collapsed ? 'center' : 'flex-start',
          transition: 'padding 0.25s',
        }}
      >
        <Link to="/admin" className="flex items-center gap-2 flex-shrink-0">
          {collapsed ? (
            <img src="/logo-mini.svg" alt="HugoIT" className="flex-shrink-0" style={{ width: '32px', height: '32px' }} />
          ) : (
            <img src={isDark ? '/logo-admin-dark.svg' : '/logo-admin.svg'} alt="HugoIT Admin" className="flex-shrink-0" style={{ height: '52px' }} />
          )}
        </Link>
      </div>

      {/* ── Collapse toggle ── */}
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

      {/* ── Navigation ── */}
      <nav className="flex-1" style={{ padding: '12px 8px 12px 14px', overflowY: 'auto' }}>
        {sections.map((section, si) => (
          <div key={section.id} style={{ marginTop: si === 0 ? 0 : '8px' }}>

            {/* Section divider + label */}
            {si > 0 && (
              <div
                className="flex items-center gap-2 overflow-hidden"
                style={{ margin: '4px 0 6px', padding: '0 4px' }}
              >
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
                    <div className="flex-1 border-t border-[var(--border-color)]" />
                  </>
                )}
              </div>
            )}

            {/* Nav items */}
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = item.path === '/admin'
                  ? pathname === '/admin' || pathname === '/admin/'
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
                        {isDark && <span style={{
                          position: 'absolute',
                          left: 0,
                          top: 0,
                          bottom: 0,
                          width: '40%',
                          background: 'radial-gradient(ellipse at -5% 50%, var(--brand-green-text) 0%, transparent 65%)',
                          opacity: 0.15,
                          pointerEvents: 'none',
                          borderRadius: '8px 0 0 8px',
                          zIndex: 1,
                        }} />}
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
                        padding:        collapsed ? '10px 0' : '9px 12px',
                        justifyContent: collapsed ? 'center' : 'flex-start',
                        gap:            collapsed ? 0 : '10px',
                        overflow: 'hidden',
                      }}
                    >
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
        ))}
      </nav>

      {/* ── Footer ── */}
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

        {/* Profile row */}
        <div ref={profileRef} style={{ position: 'relative' }}>

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
                  {adminProfile.avatarUrl ? (
                    <img
                      src={adminProfile.avatarUrl}
                      alt={adminProfile.fullName}
                      className="flex-shrink-0 object-cover"
                      style={{ width: '40px', height: '40px', borderRadius: '50%' }}
                    />
                  ) : (
                    <div
                      className="flex items-center justify-center text-white font-bold flex-shrink-0"
                      style={{
                        width: '40px', height: '40px', borderRadius: '50%',
                        background: 'linear-gradient(135deg, #3B82F6, #6366F1)',
                        fontSize: '14px',
                      }}
                    >
                      {adminProfile.initials}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-[var(--text-primary)] truncate" style={{ fontSize: '14px', fontWeight: 600 }}>
                      {adminProfile.fullName}
                    </p>
                    <p className="text-[var(--text-secondary)] truncate" style={{ fontSize: '12px' }}>
                      {adminProfile.email}
                    </p>
                  </div>
                </div>
              </div>

              {/* Settings + Log out */}
              <div style={{ padding: '6px' }}>
                <button
                  onClick={() => { setProfileOpen(false); navigate('/admin/settings'); }}
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
            title={collapsed ? adminProfile.fullName : undefined}
            className={`w-full flex items-center transition-colors overflow-hidden ${profileOpen ? 'bg-[var(--surface-elevated)]' : 'hover:bg-[var(--surface-elevated)]'}`}
            style={{
              borderRadius: '8px',
              padding:        collapsed ? '6px 0' : '6px 10px',
              justifyContent: collapsed ? 'center' : 'flex-start',
              gap:            collapsed ? 0 : '10px',
            }}
          >
            {adminProfile.avatarUrl ? (
              <img
                src={adminProfile.avatarUrl}
                alt={adminProfile.fullName}
                className="flex-shrink-0 object-cover"
                style={{ width: '36px', height: '36px', borderRadius: '50%' }}
              />
            ) : (
              <div
                className="flex items-center justify-center text-white font-bold flex-shrink-0"
                style={{
                  width: '36px', height: '36px', borderRadius: '50%',
                  background: 'linear-gradient(135deg, #3B82F6, #6366F1)',
                  fontSize: '13px',
                }}
              >
                {adminProfile.initials}
              </div>
            )}
            {!collapsed && (
              <>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-[var(--text-primary)] truncate" style={{ fontSize: '14px', fontWeight: 600 }}>
                    {adminProfile.fullName}
                  </p>
                  <p className="text-[var(--text-secondary)] truncate" style={{ fontSize: '12px', fontWeight: 400 }}>
                    {adminProfile.role === 'clinic_manager' ? 'Clinic Manager'
                      : adminProfile.role === 'front_desk_manager' ? 'Front Desk Manager'
                      : adminProfile.role === 'receptionist' ? 'Receptionist'
                      : adminProfile.role === 'superadmin' ? 'Super Administrator'
                      : 'Staff'}
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
