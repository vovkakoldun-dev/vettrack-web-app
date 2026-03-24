import { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useProfile } from '../hooks/useProfile';
import {
  Home, Calendar, CreditCard, MessageSquare, MessageCircle, Users, FileText, UserCircle,
  PawPrint, Sun, Moon, ChevronLeft, ChevronRight, LogOut, ChevronUp, Settings, CheckSquare,
  Bell,
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
      { name: 'My Portal',      icon: UserCircle,     path: '/admin/my-portal' },
      { name: 'Team Chat',      icon: MessageCircle,  path: '/admin/chat' },
      { name: 'Communications', icon: MessageSquare,  path: '/admin/communications', badge: 5 },
      { name: 'Notifications',  icon: Bell,           path: '/admin/notifications' },
    ],
  },
  {
    id: 'management',
    label: 'Management',
    items: [
      { name: 'Bookings', icon: Calendar,    path: '/admin/bookings' },
      { name: 'Payments', icon: CreditCard,  path: '/admin/payments' },
      { name: 'Clients',  icon: Users,        path: '/admin/clients' },
      { name: 'Records',  icon: FileText,    path: '/admin/records' },
      { name: 'Tasks',    icon: CheckSquare, path: '/admin/tasks' },
    ],
  },
];

export function AdminSidebar({ isDark, onToggleTheme }: { isDark: boolean; onToggleTheme: () => void }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const [collapsed, setCollapsed]     = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const { profile: adminProfile } = useProfile('admin');
  const [sections, setSections]       = useState<NavSection[]>(NAV_SECTIONS);

  // ── Chat unread badge from Supabase (timestamp-based) ─────
  const [chatUnread, setChatUnread] = useState(0);
  const adminStaffIdRef = useRef('');
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
        .eq('sender_name', 'Dr. Volodymyr Koldun')
        .gt('created_at', chatReadAtRef.current);
      // Show 1 if any unread messages exist (1 conversation), not total message count
      if (mounted) setChatUnread((count && count > 0) ? 1 : 0);
    }

    // Fetch admin staff ID + chat_read_at FIRST, then start polling
    (async () => {
      const { data } = await supabase
        .from('staff')
        .select('id, chat_read_at')
        .in('role', ['front_desk_manager', 'receptionist', 'clinic_manager', 'superadmin'])
        .limit(1)
        .single();
      if (data && mounted) {
        adminStaffIdRef.current = data.id;
        chatReadAtRef.current = data.chat_read_at || '1970-01-01T00:00:00Z';
      }
      if (!mounted) return;
      checkChatUnread();
      interval = setInterval(checkChatUnread, 3000);
    })();

    return () => { mounted = false; if (interval) clearInterval(interval); };
  }, [pathname]);

  // Listen for chat read events from AdminChatPage
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.chat_read_at) {
        chatReadAtRef.current = detail.chat_read_at;
        setChatUnread(0);
      }
    };
    window.addEventListener('adminChatRead', handler);
    return () => window.removeEventListener('adminChatRead', handler);
  }, []);

  // Update sections when chatUnread changes
  useEffect(() => {
    setSections(NAV_SECTIONS.map(s => s.id === 'overview' ? {
      ...s,
      items: s.items.map(item =>
        item.path === '/admin/chat' ? { ...item, badge: chatUnread || undefined } : item
      ),
    } : s));
  }, [chatUnread]);

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
      <nav className="flex-1 overflow-y-auto overflow-x-hidden" style={{ padding: '12px 8px' }}>
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
                    Front Desk Admin
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
