import { useState, useRef, useEffect } from 'react';

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
  Home, Calendar, CreditCard, MessageCircle, FileText,
  PawPrint, Sun, Moon, ChevronLeft, ChevronRight, LogOut, ChevronUp, Settings,
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
      { name: 'Dashboard',  icon: Home,          path: '/owner' },
      { name: 'Contact Clinic', icon: MessageCircle, path: '/owner/contact' },
    ],
  },
  {
    id: 'my-pets',
    label: 'My Pets',
    items: [
      { name: 'My Pets',      icon: PawPrint,    path: '/owner/pets' },
      { name: 'Appointments', icon: Calendar,    path: '/owner/appointments', badge: 1 },
      { name: 'Records',      icon: FileText,    path: '/owner/records' },
      { name: 'Invoices',     icon: CreditCard,  path: '/owner/invoices' },
    ],
  },
];

const BRAND = '#2D6A4F';
const BRAND_TEXT = 'var(--brand-green-text)';

export function OwnerSidebar({
  isDark, onToggleTheme, mobileOpen = false, onMobileClose,
}: {
  isDark: boolean;
  onToggleTheme: () => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const isMobile = useIsMobile();
  const [collapsed, setCollapsed]     = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  // On mobile the sidebar is always a full-width drawer — never collapsed
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
        // On mobile: fixed overlay drawer; on desktop: normal sidebar
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
        <Link to="/owner" className="flex items-center gap-2 flex-shrink-0">
          <div
            className="w-10 h-10 flex items-center justify-center flex-shrink-0"
            style={{ borderRadius: '10px', backgroundColor: BRAND }}
          >
            <PawPrint className="w-6 h-6 text-white" />
          </div>
          {!effectiveCollapsed && (
            <div className="flex flex-col">
              <span
                className="text-[var(--text-primary)] whitespace-nowrap"
                style={{ fontSize: '20px', fontWeight: 700, lineHeight: 1.2 }}
              >
                Hugory
              </span>
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: BRAND_TEXT,
                  lineHeight: 1.2,
                }}
              >
                Client
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
      <nav className="flex-1 overflow-y-auto overflow-x-hidden" style={{ padding: '12px 8px' }}>
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
                const isActive = item.path === '/owner'
                  ? pathname === '/owner' || pathname === '/owner/'
                  : pathname.startsWith(item.path);

                return (
                  <li key={item.name} style={{ position: 'relative', marginBottom: '2px' }}>
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
                        backgroundColor: isActive ? `${BRAND}18` : 'transparent',
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
                        {effectiveCollapsed && item.badge != null && item.badge > 0 && (
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
                          {item.badge != null && item.badge > 0 && (
                            <span
                              className="inline-flex items-center justify-center text-white flex-shrink-0"
                              style={{
                                backgroundColor: isActive ? BRAND : '#d4183d',
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
                  <div
                    className="flex items-center justify-center text-white font-bold flex-shrink-0"
                    style={{
                      width: '40px', height: '40px', borderRadius: '50%',
                      background: 'linear-gradient(135deg, #3B82F6, #6366F1)',
                      fontSize: '14px',
                    }}
                  >
                    JS
                  </div>
                  <div className="min-w-0">
                    <p className="text-[var(--text-primary)] truncate" style={{ fontSize: '14px', fontWeight: 600 }}>
                      John Smith
                    </p>
                    <p className="text-[var(--text-secondary)] truncate" style={{ fontSize: '12px' }}>
                      john.smith@email.com
                    </p>
                  </div>
                </div>
              </div>

              {/* Settings + Log out */}
              <div style={{ padding: '6px' }}>
                <button
                  onClick={() => { setProfileOpen(false); navigate('/owner/settings'); }}
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
            title={effectiveCollapsed ? 'John Smith' : undefined}
            className={`w-full flex items-center transition-colors overflow-hidden ${profileOpen ? 'bg-[var(--surface-elevated)]' : 'hover:bg-[var(--surface-elevated)]'}`}
            style={{
              borderRadius: '8px',
              padding:        effectiveCollapsed ? '6px 0' : '6px 10px',
              justifyContent: effectiveCollapsed ? 'center' : 'flex-start',
              gap:            effectiveCollapsed ? 0 : '10px',
            }}
          >
            <div
              className="flex items-center justify-center text-white font-bold flex-shrink-0"
              style={{
                width: '36px', height: '36px', borderRadius: '50%',
                background: 'linear-gradient(135deg, #3B82F6, #6366F1)',
                fontSize: '13px',
              }}
            >
              JS
            </div>
            {!effectiveCollapsed && (
              <>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-[var(--text-primary)] truncate" style={{ fontSize: '14px', fontWeight: 600 }}>
                    John Smith
                  </p>
                  <p className="text-[var(--text-secondary)] truncate" style={{ fontSize: '12px', fontWeight: 400 }}>
                    Pet Owner
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
