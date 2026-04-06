import { useState, useRef, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const handle = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handle);
    return () => window.removeEventListener('resize', handle);
  }, []);
  return isMobile;
}
import { Link, useLocation, useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import {
  Home, BarChart2, Users, Building2, Calendar, CreditCard, Clock,
  Settings, Sun, Moon, ChevronLeft, ChevronRight,
  LogOut, ChevronUp, Crown, MessageSquare, Tag, MonitorSmartphone, PawPrint,
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
      { name: 'Dashboard',  icon: Home,       path: '/superadmin' },
      { name: 'Analytics',  icon: BarChart2,  path: '/superadmin/analytics' },
    ],
  },
  {
    id: 'operations',
    label: 'Operations',
    items: [
      { name: 'Staff',            icon: Users,             path: '/superadmin/staff' },
      { name: 'Shifts',           icon: Clock,             path: '/superadmin/shifts' },
      { name: 'Clinics',          icon: Building2,         path: '/superadmin/clinics' },
      { name: 'Appointments',     icon: Calendar,          path: '/superadmin/appointments' },
      { name: 'Patient Portals',  icon: MonitorSmartphone, path: '/superadmin/portals' },
      { name: 'Clients',          icon: PawPrint,          path: '/superadmin/clients' },
    ],
  },
  {
    id: 'communication',
    label: 'Communication',
    items: [
      { name: 'Team Chat', icon: MessageSquare, path: '/superadmin/chat' },
    ],
  },
  {
    id: 'finance',
    label: 'Finance',
    items: [
      { name: 'Billing',   icon: CreditCard, path: '/superadmin/billing' },
      { name: 'Services',  icon: Tag,        path: '/superadmin/services' },
    ],
  },
];

const BRAND = '#F4A261';
const BRAND_TEXT = '#C2671A';
const LOGO_BG = '#1C1208';

export function SuperAdminSidebar({
  isDark, onToggleTheme, mobileOpen = false, onMobileClose,
}: {
  isDark: boolean;
  onToggleTheme: () => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();

  const isMobile = useIsMobile();
  const [collapsed, setCollapsed]     = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [chatUnread, setChatUnread]   = useState(0);

  // Superadmin profile from DB
  const [saProfile, setSaProfile] = useState<{ firstName: string; lastName: string; avatarUrl: string; role: string }>({
    firstName: '', lastName: '', avatarUrl: '', role: 'superadmin',
  });
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('first_name, last_name, avatar_url, role')
        .eq('role', 'superadmin')
        .single();
      if (data) setSaProfile({
        firstName: data.first_name || '', lastName: data.last_name || '',
        avatarUrl: data.avatar_url || '', role: data.role || 'superadmin',
      });
    })();
  }, []);
  const saFullName = (saProfile.role === 'doctor' || saProfile.role === 'veterinarian')
    ? `Dr. ${saProfile.firstName} ${saProfile.lastName}`.trim()
    : `${saProfile.firstName} ${saProfile.lastName}`.trim();
  const saInitials = `${(saProfile.firstName[0] || '').toUpperCase()}${(saProfile.lastName[0] || '').toUpperCase()}`;

  // Poll for unread chat messages
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    async function poll() {
      // Get all conversations for this user
      const { data: parts } = await supabase
        .from('conversation_participants')
        .select('conversation_id, last_read_at')
        .eq('profile_id', user!.id);
      if (!parts || cancelled) return;
      let total = 0;
      for (const p of parts) {
        const query = supabase
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('conversation_id', p.conversation_id)
          .neq('sender_id', user!.id);
        if (p.last_read_at) query.gt('created_at', p.last_read_at);
        const { count } = await query;
        total += count || 0;
      }
      if (!cancelled) setChatUnread(total);
    }
    poll();
    const interval = setInterval(poll, 10_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [user]);
  const effectiveCollapsed = isMobile ? false : collapsed;

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
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={onMobileClose}
        />
      )}
    <div
      className="h-screen bg-[var(--surface-white)] border-r border-[var(--border-color)] flex flex-col relative flex-shrink-0"
      style={{
        width: effectiveCollapsed ? '72px' : '256px',
        transition: 'width 0.25s cubic-bezier(0.4,0,0.2,1), transform 0.25s cubic-bezier(0.4,0,0.2,1)',
        ...(isMobile ? {
          position: 'fixed' as const,
          top: 0, left: 0, bottom: 0,
          zIndex: 50,
          transform: mobileOpen ? 'translateX(0)' : 'translateX(-100%)',
          width: '256px',
        } : {}),
      }}
    >
      {/* ── Logo ── */}
      <div
        className="border-b border-[var(--border-color)] flex flex-col items-center justify-center overflow-hidden flex-shrink-0"
        style={{
          height: '72px',
          padding: effectiveCollapsed ? '0' : '0 24px',
          alignItems: effectiveCollapsed ? 'center' : 'flex-start',
          transition: 'padding 0.25s',
        }}
      >
        <Link to="/superadmin" className="flex items-center gap-2 flex-shrink-0">
          {effectiveCollapsed ? (
            <img src="/logo-mini.svg" alt="HugoIT" className="flex-shrink-0" style={{ width: '32px', height: '32px' }} />
          ) : (
            <div className="flex flex-col items-start gap-0">
              <img src={isDark ? '/logo-full-dark.svg' : '/logo-full.svg'} alt="HugoIT" className="flex-shrink-0" style={{ height: '40px' }} />
              <span
                style={{
                  fontSize: '9px',
                  fontWeight: 700,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: BRAND_TEXT,
                  lineHeight: 1,
                  marginTop: '-2px',
                  marginLeft: '2px',
                }}
              >
                Super Admin
              </span>
            </div>
          )}
        </Link>
      </div>

      {/* ── Collapse toggle — desktop only ── */}
      {!isMobile && (
        <button
          onClick={() => setCollapsed(!collapsed)}
          title={effectiveCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="absolute z-20 flex items-center justify-center bg-[var(--surface-white)] border border-[var(--border-color)] hover:bg-[var(--surface-elevated)] transition-colors"
          style={{
            width: '22px', height: '22px', borderRadius: '50%',
            top: '60px', right: '-11px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
          }}
        >
          {effectiveCollapsed
            ? <ChevronRight className="w-3 h-3 text-[var(--text-secondary)]" />
            : <ChevronLeft  className="w-3 h-3 text-[var(--text-secondary)]" />
          }
        </button>
      )}

      {/* ── Navigation ── */}
      <nav className="flex-1" style={{ padding: '12px 8px 12px 14px', overflowY: 'auto' }}>
        {NAV_SECTIONS.map((section, si) => (
          <div key={section.id} style={{ marginTop: si === 0 ? 0 : '8px' }}>

            {/* Section divider + label */}
            {si > 0 && (
              <div
                className="flex items-center gap-2 overflow-hidden"
                style={{ margin: '4px 0 6px', padding: '0 4px' }}
              >
                <div
                  className="flex-shrink-0 border-t border-[var(--border-color)]"
                  style={{ width: effectiveCollapsed ? '100%' : '10px' }}
                />
                {!effectiveCollapsed && (
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
                const isActive = item.path === '/superadmin'
                  ? pathname === '/superadmin' || pathname === '/superadmin/'
                  : pathname.startsWith(item.path);
                const badge = item.name === 'Team Chat' ? chatUnread : (item.badge ?? 0);

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
                          backgroundColor: BRAND_TEXT,
                          boxShadow: isDark ? `0 0 12px 3px ${BRAND_TEXT}` : 'none',
                          zIndex: 2,
                        }} />
                        <span style={{
                          position: 'absolute',
                          left: 0,
                          top: 0,
                          bottom: 0,
                          width: '40%',
                          background: `radial-gradient(ellipse at -5% 50%, ${BRAND_TEXT} 0%, transparent 65%)`,
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
                      title={effectiveCollapsed ? item.name : undefined}
                      className="flex items-center transition-colors"
                      style={{
                        borderRadius: '8px',
                        fontSize: '15px',
                        fontWeight: 600,
                        padding:        effectiveCollapsed ? '10px 0' : '9px 12px',
                        justifyContent: effectiveCollapsed ? 'center' : 'flex-start',
                        gap:            effectiveCollapsed ? 0 : '10px',
                        overflow: 'hidden',
                        backgroundColor: isActive ? 'color-mix(in srgb, var(--brand-green-text) 9%, transparent)' : 'transparent',
                        color: isActive ? BRAND_TEXT : 'var(--text-secondary)',
                      }}
                      onMouseEnter={e => {
                        if (!isActive) {
                          (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--surface-elevated)';
                          (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)';
                        }
                      }}
                      onMouseLeave={e => {
                        if (!isActive) {
                          (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                          (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
                        }
                      }}
                    >
                      <span style={{ position: 'relative', flexShrink: 0, display: 'flex' }}>
                        <Icon className="w-5 h-5" />
                        {effectiveCollapsed && badge > 0 && (
                          <span style={{
                            position: 'absolute', top: '-3px', right: '-3px',
                            width: '8px', height: '8px',
                            backgroundColor: '#d4183d', borderRadius: '50%',
                            border: '1.5px solid var(--surface-white)',
                          }} />
                        )}
                      </span>

                      {!effectiveCollapsed && (
                        <>
                          <span className="flex-1 whitespace-nowrap">{item.name}</span>
                          {badge > 0 && (
                            <span
                              className="inline-flex items-center justify-center text-white flex-shrink-0"
                              style={{
                                backgroundColor: isActive ? BRAND : '#d4183d',
                                borderRadius: '9999px', fontSize: '11px', fontWeight: 700,
                                minWidth: '20px', height: '20px', padding: '0 6px',
                              }}
                            >
                              {badge > 99 ? '99+' : badge}
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
          title={effectiveCollapsed ? (isDark ? 'Light mode' : 'Dark mode') : undefined}
          className="w-full flex items-center transition-colors hover:bg-[var(--surface-elevated)]"
          style={{
            borderRadius: '8px',
            padding:        effectiveCollapsed ? '8px 0' : '8px 10px',
            justifyContent: effectiveCollapsed ? 'center' : 'flex-start',
            gap:            effectiveCollapsed ? 0 : '10px',
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

          {!effectiveCollapsed && (
            <>
              <span className="flex-1 text-left text-[var(--text-secondary)] whitespace-nowrap" style={{ fontSize: '14px', fontWeight: 500 }}>
                {isDark ? 'Light mode' : 'Dark mode'}
              </span>
              <div
                className="ml-auto flex-shrink-0 relative"
                style={{
                  width: '36px', height: '20px',
                  backgroundColor: isDark ? BRAND : 'var(--border-color)',
                  borderRadius: '9999px',
                  transition: 'background-color 0.2s',
                }}
              >
                <div style={{
                  position: 'absolute', top: '3px',
                  left: isDark ? '19px' : '3px',
                  width: '14px', height: '14px',
                  backgroundColor: '#fff', borderRadius: '9999px',
                  transition: 'left 0.2s',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                }} />
              </div>
            </>
          )}
        </button>

        {/* Profile row */}
        <div ref={profileRef} style={{ position: 'relative' }}>

          {profileOpen && (
            <div
              className="bg-[var(--surface-white)] border border-[var(--border-color)]"
              style={effectiveCollapsed ? {
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
                  {saProfile.avatarUrl ? (
                    <img src={saProfile.avatarUrl} alt={saFullName} style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                  ) : (
                    <div
                      className="flex items-center justify-center text-white font-bold flex-shrink-0"
                      style={{
                        width: '40px', height: '40px', borderRadius: '50%',
                        background: 'linear-gradient(135deg, #F4A261, #E07B2A)',
                        fontSize: '14px',
                      }}
                    >
                      {saInitials}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-[var(--text-primary)] truncate" style={{ fontSize: '14px', fontWeight: 600 }}>
                      {saFullName}
                    </p>
                    <p className="text-[var(--text-secondary)] truncate" style={{ fontSize: '12px' }}>
                      Super Administrator
                    </p>
                  </div>
                </div>
              </div>

              {/* Settings + Log out */}
              <div style={{ padding: '6px' }}>
                <button
                  onClick={() => { setProfileOpen(false); navigate('/superadmin/settings'); }}
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
            title={effectiveCollapsed ? saFullName : undefined}
            className={`w-full flex items-center transition-colors overflow-hidden ${profileOpen ? 'bg-[var(--surface-elevated)]' : 'hover:bg-[var(--surface-elevated)]'}`}
            style={{
              borderRadius: '8px',
              padding:        effectiveCollapsed ? '6px 0' : '6px 10px',
              justifyContent: effectiveCollapsed ? 'center' : 'flex-start',
              gap:            effectiveCollapsed ? 0 : '10px',
            }}
          >
            {saProfile.avatarUrl ? (
              <img src={saProfile.avatarUrl} alt={saFullName} style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
            ) : (
              <div
                className="flex items-center justify-center text-white font-bold flex-shrink-0"
                style={{
                  width: '36px', height: '36px', borderRadius: '50%',
                  background: 'linear-gradient(135deg, #F4A261, #E07B2A)',
                  fontSize: '13px',
                }}
              >
                {saInitials}
              </div>
            )}
            {!effectiveCollapsed && (
              <>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-[var(--text-primary)] truncate" style={{ fontSize: '14px', fontWeight: 600 }}>
                    {saFullName}
                  </p>
                  <p className="text-[var(--text-secondary)] truncate" style={{ fontSize: '12px', fontWeight: 400 }}>
                    Super Administrator
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
    </>
  );
}
