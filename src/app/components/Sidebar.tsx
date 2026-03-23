import { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { supabase } from '../../lib/supabase';
import {
  Home, Users, Calendar, FileText, Settings, PawPrint,
  UserCircle, Bell, FlaskConical, Sun, Moon, Syringe,
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
      { name: 'Pets',     icon: PawPrint,     path: '/pets' },
      { name: 'Lab',      icon: FlaskConical, path: '/lab' },
    ],
  },
];

export function Sidebar({ isDark, onToggleTheme }: { isDark: boolean; onToggleTheme: () => void }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const [collapsed, setCollapsed]     = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [sections, setSections]       = useState<NavSection[]>(INITIAL_SECTIONS);

  // Dynamic notification badge count
  const [notifCount, setNotifCount] = useState(() => {
    try { return parseInt(localStorage.getItem('notif_unread_count') || '0', 10); } catch { return 0; }
  });

  // Compute notification count from Supabase
  const computeNotifCount = async () => {
    try {
      const n = new Date();
      const today = `${n.getFullYear()}-${(n.getMonth() + 1).toString().padStart(2, '0')}-${n.getDate().toString().padStart(2, '0')}`;
      const weekAgo = new Date(Date.now() - 7 * 86400000);
      const weekAgoStr = `${weekAgo.getFullYear()}-${(weekAgo.getMonth() + 1).toString().padStart(2, '0')}-${weekAgo.getDate().toString().padStart(2, '0')}`;

      const [apptTodayRes, clientRes, vacRes, completedRes, cancelledRes] = await Promise.all([
        supabase.from('appointments').select('id, scheduled_at')
          .gte('scheduled_at', `${today}T00:00:00`).lte('scheduled_at', `${today}T23:59:59`)
          .in('status', ['Scheduled', 'Confirmed']),
        supabase.from('clients').select('id, created_at')
          .gte('created_at', `${weekAgoStr}T00:00:00`),
        supabase.from('vaccinations').select('id, next_due_date')
          .lte('next_due_date', today),
        supabase.from('appointments').select('id')
          .gte('scheduled_at', `${weekAgoStr}T00:00:00`).eq('status', 'Completed'),
        supabase.from('appointments').select('id')
          .gte('scheduled_at', `${weekAgoStr}T00:00:00`).eq('status', 'Cancelled'),
      ]);

      // Collect all notification IDs (must match NotificationsPage)
      const allIds: string[] = [];

      (apptTodayRes.data || []).forEach((a) => allIds.push(`appt-today-${a.id}`));
      (completedRes.data || []).forEach((a) => allIds.push(`appt-done-${a.id}`));
      (cancelledRes.data || []).forEach((a) => allIds.push(`appt-cancel-${a.id}`));
      (vacRes.data || []).forEach((v) => allIds.push(`vax-${v.id}`));
      (clientRes.data || []).forEach((c) => allIds.push(`client-${c.id}`));

      // Count assignment events from localStorage
      try {
        const assignEvents = JSON.parse(localStorage.getItem('vet_assign_events') || '[]');
        const sevenDaysAgoMs = Date.now() - 7 * 86400000;
        for (const evt of assignEvents) {
          if (new Date(evt.timestamp).getTime() >= sevenDaysAgoMs) {
            allIds.push(evt.id);
          }
        }
      } catch {}

      // Count vet unassignment events
      try {
        const unassignEvents = JSON.parse(localStorage.getItem('vet_unassign_events') || '[]');
        const sevenDaysAgoMs = Date.now() - 7 * 86400000;
        for (const evt of unassignEvents) {
          if (new Date(evt.timestamp).getTime() >= sevenDaysAgoMs) {
            allIds.push(evt.id);
          }
        }
      } catch {}

      // Count appointment assignment events
      try {
        const apptEvents = JSON.parse(localStorage.getItem('appt_assign_events') || '[]');
        const sevenDaysAgoMs = Date.now() - 7 * 86400000;
        for (const evt of apptEvents) {
          if (new Date(evt.timestamp).getTime() >= sevenDaysAgoMs) {
            allIds.push(evt.id);
          }
        }
      } catch {}

      const readIds: string[] = JSON.parse(localStorage.getItem('notif_read') || '[]');
      const dismissedIds: string[] = JSON.parse(localStorage.getItem('notif_dismissed') || '[]');
      const readSet = new Set(readIds);
      const dismissedSet = new Set(dismissedIds);

      const unread = allIds.filter(id => !dismissedSet.has(id) && !readSet.has(id)).length;

      setNotifCount(unread);
      localStorage.setItem('notif_unread_count', String(unread));
    } catch {}
  };

  // Compute on mount
  useEffect(() => { computeNotifCount(); }, []);

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

  // ── Chat unread badge from Supabase (timestamp-based) ─────
  const [chatUnread, setChatUnread] = useState(0);
  const doctorStaffIdRef = useRef('');
  const chatReadAtRef = useRef('1970-01-01T00:00:00Z');

  useEffect(() => {
    let mounted = true;
    let interval: ReturnType<typeof setInterval>;

    async function checkChatUnread() {
      if (!mounted) return;
      const { count } = await supabase
        .from('chat_messages')
        .select('id', { count: 'exact', head: true })
        .eq('conversation', 'admin-doctor')
        .neq('sender_name', 'Dr. Volodymyr Koldun')
        .gt('created_at', chatReadAtRef.current);
      // Show 1 if any unread messages exist (1 conversation), not total message count
      if (mounted) setChatUnread((count && count > 0) ? 1 : 0);
    }

    // Fetch doctor staff ID + chat_read_at FIRST, then start polling
    (async () => {
      const { data } = await supabase
        .from('staff')
        .select('id, chat_read_at')
        .in('role', ['veterinarian', 'senior_veterinarian', 'lead_vet_tech'])
        .limit(1)
        .single();
      if (data && mounted) {
        doctorStaffIdRef.current = data.id;
        chatReadAtRef.current = data.chat_read_at || '1970-01-01T00:00:00Z';
      }
      if (!mounted) return;
      checkChatUnread();
      interval = setInterval(checkChatUnread, 3000);
    })();

    return () => { mounted = false; if (interval) clearInterval(interval); };
  }, [pathname]);

  // Listen for chat read events from ChatPage
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.chat_read_at) {
        chatReadAtRef.current = detail.chat_read_at;
        setChatUnread(0);
      }
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

  // Fetch staff profile from Supabase
  const [staffName, setStaffName] = useState('Dr. Sarah Chen');
  const [staffRole, setStaffRole] = useState('Veterinarian');
  const [staffEmail, setStaffEmail] = useState('sarah.chen@vettrack.com');
  const [staffPhoto, setStaffPhoto] = useState('');
  useEffect(() => {
    supabase.from('staff').select('first_name, last_name, role, email, photo_url').in('role', ['veterinarian', 'senior_veterinarian', 'lead_vet_tech']).limit(1).single().then(({ data }) => {
      if (data) {
        setStaffName(`Dr. ${data.first_name} ${data.last_name}`);
        setStaffRole((data.role || 'veterinarian').replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()));
        setStaffEmail(data.email || '—');
        setStaffPhoto(data.photo_url || '');
      }
    });
  }, []);

  // Listen for instant photo change events from My Portal
  useEffect(() => {
    const handlePhotoChanged = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setStaffPhoto(detail?.photo_url || '');
    };
    window.addEventListener('staffPhotoChanged', handlePhotoChanged);
    return () => window.removeEventListener('staffPhotoChanged', handlePhotoChanged);
  }, []);

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
      <nav className="flex-1 overflow-y-auto overflow-x-hidden" style={{ padding: '12px 8px' }}>
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
                boxShadow: isDropTarget ? 'inset 0 2px 0 0 #2D6A4F' : undefined,
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
                                className="inline-flex items-center justify-center text-white flex-shrink-0"
                                style={{
                                  backgroundColor: isActive ? 'var(--brand-green-text)' : '#d4183d',
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
                  {staffPhoto ? (
                    <img
                      src={staffPhoto}
                      alt={staffName}
                      className="w-10 h-10 object-cover flex-shrink-0"
                      style={{ borderRadius: '50%' }}
                    />
                  ) : (
                    <div
                      className="w-10 h-10 flex-shrink-0 flex items-center justify-center"
                      style={{ borderRadius: '50%', backgroundColor: '#2D6A4F20', color: '#2D6A4F', fontSize: '14px', fontWeight: 700 }}
                    >
                      {staffName.split(' ').filter(w => w[0] && w[0] === w[0].toUpperCase()).map(w => w[0]).join('').slice(0, 2)}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-[var(--text-primary)] truncate" style={{ fontSize: '14px', fontWeight: 600 }}>
                      {staffName}
                    </p>
                    <p className="text-[var(--text-secondary)] truncate" style={{ fontSize: '12px' }}>
                      {staffEmail}
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
                  onClick={() => { setProfileOpen(false); navigate('/login'); }}
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
            title={collapsed ? staffName : undefined}
            className={`w-full flex items-center transition-colors overflow-hidden ${profileOpen ? 'bg-[var(--surface-elevated)]' : 'hover:bg-[var(--surface-elevated)]'}`}
            style={{
              borderRadius: '8px',
              padding:        collapsed ? '6px 0' : '6px 10px',
              justifyContent: collapsed ? 'center' : 'flex-start',
              gap:            collapsed ? 0 : '10px',
            }}
          >
            {staffPhoto ? (
              <img
                src={staffPhoto}
                alt={staffName}
                className="w-9 h-9 object-cover flex-shrink-0"
                style={{ borderRadius: '50%' }}
              />
            ) : (
              <div
                className="w-9 h-9 flex-shrink-0 flex items-center justify-center"
                style={{ borderRadius: '50%', backgroundColor: '#2D6A4F20', color: '#2D6A4F', fontSize: '13px', fontWeight: 700 }}
              >
                {staffName.split(' ').filter(w => w[0] && w[0] === w[0].toUpperCase()).map(w => w[0]).join('').slice(0, 2)}
              </div>
            )}
            {!collapsed && (
              <>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-[var(--text-primary)] truncate" style={{ fontSize: '14px', fontWeight: 600 }}>
                    {staffName}
                  </p>
                  <p className="text-[var(--text-secondary)] truncate" style={{ fontSize: '12px', fontWeight: 400 }}>
                    {staffRole}
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
