import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router';
import { Sidebar } from './components/Sidebar';
import { AdminSidebar } from './components/AdminSidebar';
import { useTheme } from './hooks/useTheme';
import { AuthProvider, useAuth } from './context/AuthContext';
import { TenantProvider, TenantGate } from './context/TenantContext';
import { PortalGuard } from './components/PortalGuard';
import DashboardPage from './pages/DashboardPage';
import ClientsPage from './pages/ClientsPage';
import ClientDetailPage from './pages/ClientDetailPage';
import AppointmentsPage from './pages/AppointmentsPage';
import MyPortalPage from './pages/MyPortalPage';
import MyPatientsPage from './pages/MyPatientsPage';
import RecordsPage from './pages/RecordsPage';
import RecordDetailPage from './pages/RecordDetailPage';
import NotificationsPage from './pages/NotificationsPage';
import LabPage from './pages/LabPage';
import SettingsPage from './pages/SettingsPage';
import VaccinesPage from './pages/VaccinesPage';
import PetsPage from './pages/PetsPage';
import ChatPage from './pages/ChatPage';
import LoginPage from './pages/LoginPage';
import ToastNotification from './components/ToastNotification';
import SupabaseTestPage from './pages/SupabaseTestPage';
import VisitPage from './pages/VisitPage';
import CheckoutPage from './pages/CheckoutPage';
import OwnerDashboardPage from './pages/owner/OwnerDashboardPage';
import OwnerContactPage from './pages/owner/OwnerContactPage';
import OwnerPetProfilePage from './pages/owner/OwnerPetProfilePage';
import OwnerPetsPage from './pages/owner/OwnerPetsPage';
import OwnerAppointmentsPage from './pages/owner/OwnerAppointmentsPage';
import OwnerRecordsPage from './pages/owner/OwnerRecordsPage';
import OwnerRecordDetailPage from './pages/owner/OwnerRecordDetailPage';
import OwnerInvoicesPage from './pages/owner/OwnerInvoicesPage';
import { OwnerSidebar } from './components/OwnerSidebar';
import { SuperAdminSidebar } from './components/SuperAdminSidebar';
import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import SuperAdminDashboardPage from './pages/superadmin/SuperAdminDashboardPage';
import SuperAdminAnalyticsPage from './pages/superadmin/SuperAdminAnalyticsPage';
import SuperAdminSettingsPage from './pages/superadmin/SuperAdminSettingsPage';
import SuperAdminChatPage from './pages/superadmin/SuperAdminChatPage';
import SuperAdminBillingPage from './pages/superadmin/SuperAdminBillingPage';
import SuperAdminServicesPage from './pages/superadmin/SuperAdminServicesPage';
import SuperAdminStaffPage from './pages/superadmin/SuperAdminStaffPage';
import SuperAdminAppointmentsPage from './pages/superadmin/SuperAdminAppointmentsPage';
import SuperAdminPatientPortalsPage from './pages/superadmin/SuperAdminPatientPortalsPage';
import AdminBookingsPage from './pages/admin/AdminBookingsPage';
import AdminPaymentsPage from './pages/admin/AdminPaymentsPage';
import AdminCommunicationsPage from './pages/admin/AdminCommunicationsPage';
import AdminClientsPage from './pages/admin/AdminClientsPage';
import AdminMyPortalPage from './pages/admin/AdminMyPortalPage';
import AdminTasksPage from './pages/admin/AdminTasksPage';
import AdminSettingsPage from './pages/admin/AdminSettingsPage';
import AdminChatPage from './pages/admin/AdminChatPage';
import ShiftsPage from './pages/ShiftsPage';
import SuperAdminShiftsPage from './pages/superadmin/SuperAdminShiftsPage';
import SystemAdminPage from './pages/sysadmin/SystemAdminPage';
import { ActiveVisitProvider, useActiveVisit } from './context/ActiveVisitContext';
import { AppointmentStatusProvider } from './context/AppointmentStatusContext';
import { Avatar, AvatarImage, AvatarFallback } from './components/ui/avatar';
import { ClipboardList, Receipt, ArrowRight, X, Clock, Menu, PawPrint, Crown } from 'lucide-react';

// ─── Active Visit Floating Widget ────────────────────────────

function ActiveVisitWidget() {
  const { activeVisit, elapsedMin, clearVisit } = useActiveVisit();
  const location = useLocation();
  const navigate = useNavigate();

  if (!activeVisit) return null;

  // Hide while already on this visit's pages
  const apptPath = `/appointments/${activeVisit.apptId}`;
  if (
    location.pathname === `${apptPath}/visit` ||
    location.pathname === `${apptPath}/checkout`
  ) return null;

  const resumePath = activeVisit.step === 'checkout'
    ? `${apptPath}/checkout`
    : `${apptPath}/visit`;

  const stepLabel = activeVisit.step === 'checkout' ? 'Checkout' : 'Visit Notes';
  const StepIcon = activeVisit.step === 'checkout' ? Receipt : ClipboardList;
  const totalMin = activeVisit.durationMinutes ?? 30;
  const remainingMin = Math.max(0, totalMin - elapsedMin);
  const isOvertime = elapsedMin > totalMin;
  const timeDisplay = isOvertime
    ? `+${elapsedMin - totalMin} min over`
    : remainingMin === 0
      ? 'Time up'
      : `${remainingMin} min left`;
  const progressPct = Math.min(100, (elapsedMin / totalMin) * 100);

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 100,
        width: 320,
        borderRadius: 16,
        backgroundColor: 'var(--surface-white)',
        border: '1.5px solid #2D6A4F40',
        boxShadow: '0 8px 32px rgba(0,0,0,0.18), 0 0 0 1px rgba(45,106,79,0.08)',
        overflow: 'hidden',
        animation: 'slideUp 0.25s cubic-bezier(0.4,0,0.2,1)',
      }}
    >
      {/* ── Coloured top bar ── */}
      <div
        style={{
          height: 4,
          background: activeVisit.step === 'checkout'
            ? 'linear-gradient(90deg, #3B82F6, #8B5CF6)'
            : 'linear-gradient(90deg, #2D6A4F, #74C69D)',
        }}
      />

      {/* ── Header ── */}
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 14px 8px',
          borderBottom: '1px solid var(--border-color)',
          backgroundColor: 'var(--surface-elevated)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <StepIcon style={{ width: 14, height: 14, color: 'var(--brand-green-text)', flexShrink: 0 }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--brand-green-text)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Visit In Progress
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 600, color: isOvertime ? '#DC2626' : remainingMin <= 5 ? '#D97706' : 'var(--text-secondary)' }}>
            <Clock style={{ width: 11, height: 11 }} />
            {timeDisplay}
          </span>
          <button
            onClick={clearVisit}
            style={{
              width: 20, height: 20, borderRadius: 6, border: 'none', cursor: 'pointer',
              backgroundColor: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-secondary)',
            }}
            className="hover:bg-[var(--border-color)] transition-colors"
            title="Dismiss"
          >
            <X style={{ width: 12, height: 12 }} />
          </button>
        </div>
      </div>

      {/* ── Pet info ── */}
      <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <Avatar style={{ width: 44, height: 44, flexShrink: 0 }}>
          <AvatarImage src={activeVisit.petImage} alt={activeVisit.petName} style={{ objectFit: 'cover' }} />
          <AvatarFallback style={{ fontSize: 14, fontWeight: 700 }}>{activeVisit.petName.slice(0, 2)}</AvatarFallback>
        </Avatar>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>
            {activeVisit.petName}
          </p>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {activeVisit.ownerName} · {activeVisit.service}
          </p>
          <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
            {elapsedMin} / {totalMin} min
          </p>
        </div>
      </div>

      {/* ── Time progress bar ── */}
      <div style={{ padding: '0 14px 8px' }}>
        <div style={{ height: 4, borderRadius: 999, backgroundColor: 'var(--border-color)', overflow: 'hidden' }}>
          <div
            style={{
              height: '100%',
              width: `${progressPct}%`,
              borderRadius: 999,
              backgroundColor: isOvertime ? '#DC2626' : progressPct >= 80 ? '#D97706' : '#2D6A4F',
              transition: 'width 0.5s ease, background-color 0.3s',
            }}
          />
        </div>
      </div>

      {/* ── Step indicator ── */}
      <div style={{ padding: '0 14px 12px', display: 'flex', gap: 6 }}>
        {(['visit', 'checkout'] as const).map((step, i) => {
          const done = (activeVisit.step === 'checkout' && step === 'visit');
          const active = activeVisit.step === step;
          return (
            <div
              key={step}
              style={{
                flex: 1, height: 4, borderRadius: 999,
                backgroundColor: done ? '#74C69D' : active ? '#2D6A4F' : 'var(--border-color)',
                transition: 'background-color 0.2s',
              }}
            />
          );
        })}
      </div>

      {/* ── Resume button ── */}
      <div style={{ padding: '0 14px 14px' }}>
        <button
          onClick={() => navigate(resumePath)}
          style={{
            width: '100%', padding: '9px 14px', borderRadius: 10,
            backgroundColor: '#2D6A4F', color: '#fff', border: 'none',
            fontSize: 13, fontWeight: 700, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            transition: 'opacity 0.15s',
          }}
          className="hover:opacity-90"
        >
          Resume — {stepLabel}
          <ArrowRight style={{ width: 14, height: 14 }} />
        </button>
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────

function MainApp() {
  const { isDark, toggle } = useTheme();
  return (
    <div className="flex h-screen bg-[var(--bg-offwhite)]">
      <Sidebar isDark={isDark} onToggleTheme={toggle} />
      <main className="flex-1 overflow-auto">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/clients" element={<ClientsPage />} />
          <Route path="/clients/:id" element={<ClientDetailPage />} />
          <Route path="/appointments" element={<AppointmentsPage />} />
          <Route path="/appointments/:id/visit" element={<VisitPage />} />
          <Route path="/appointments/:id/checkout" element={<CheckoutPage />} />
          <Route path="/records" element={<RecordsPage />} />
          <Route path="/records/:id" element={<RecordDetailPage />} />
          <Route path="/lab" element={<LabPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/my-portal" element={<MyPortalPage />} />
          <Route path="/my-portal/patients" element={<MyPatientsPage />} />
          <Route path="/shifts" element={<ShiftsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/vaccines" element={<VaccinesPage />} />
          <Route path="/pets" element={<PetsPage />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/supabase-test" element={<SupabaseTestPage />} />
        </Routes>
      </main>
      {/* Floating active-visit widget — renders above everything */}
      <ActiveVisitWidget />
    </div>
  );
}

// ─── Admin App ────────────────────────────────────────────────

function AdminApp() {
  const { isDark, toggle } = useTheme();
  return (
    <div className="flex h-screen bg-[var(--bg-offwhite)]">
      <AdminSidebar isDark={isDark} onToggleTheme={toggle} />
      <main className="flex-1 overflow-auto">
        <Routes>
          <Route path="/" element={<AdminDashboardPage />} />
          <Route path="/bookings" element={<AdminBookingsPage />} />
          <Route path="/payments" element={<AdminPaymentsPage />} />
          <Route path="/communications" element={<AdminCommunicationsPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/clients" element={<AdminClientsPage />} />
          <Route path="/clients/:id" element={<ClientDetailPage />} />
          <Route path="/records" element={<RecordsPage />} />
          <Route path="/records/:id" element={<RecordDetailPage />} />
          <Route path="/my-portal" element={<AdminMyPortalPage />} />
          <Route path="/shifts" element={<ShiftsPage />} />
          <Route path="/chat" element={<AdminChatPage />} />
          <Route path="/tasks" element={<AdminTasksPage />} />
          <Route path="/settings" element={<AdminSettingsPage />} />
        </Routes>
      </main>
    </div>
  );
}

// ─── Owner App ────────────────────────────────────────────────

function OwnerApp() {
  const { isDark, toggle } = useTheme();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg-base)]">
      <OwnerSidebar
        isDark={isDark}
        onToggleTheme={toggle}
        mobileOpen={mobileNavOpen}
        onMobileClose={() => setMobileNavOpen(false)}
      />
      <div className="flex-1 overflow-auto flex flex-col min-w-0">
        {/* Mobile top bar — visible only on small screens */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 bg-[var(--surface-white)] border-b border-[var(--border-color)] flex-shrink-0 sticky top-0 z-10">
          <button
            onClick={() => setMobileNavOpen(true)}
            className="p-2 rounded-lg hover:bg-[var(--surface-elevated)] transition-colors"
          >
            <Menu className="w-5 h-5 text-[var(--text-primary)]" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-[#2D6A4F] rounded-lg flex items-center justify-center">
              <PawPrint className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-[var(--text-primary)]" style={{ fontSize: '16px' }}>Hugory</span>
            <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#2D6A4F' }}>Client</span>
          </div>
        </div>
        <main className="flex-1 overflow-auto">
          <Routes>
            <Route path="/" element={<OwnerDashboardPage />} />
            <Route path="/pets" element={<OwnerPetsPage />} />
            <Route path="/pets/:id" element={<OwnerPetProfilePage />} />
            <Route path="/appointments" element={<OwnerAppointmentsPage />} />
            <Route path="/records" element={<OwnerRecordsPage />} />
            <Route path="/records/:id" element={<OwnerRecordDetailPage />} />
            <Route path="/invoices" element={<OwnerInvoicesPage />} />
            <Route path="/messages" element={<OwnerDashboardPage />} />
            <Route path="/contact" element={<OwnerContactPage />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

// ─── Super Admin App ──────────────────────────────────────────

function SuperAdminApp() {
  const { isDark, toggle } = useTheme();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg-base)]">
      <SuperAdminSidebar
        isDark={isDark}
        onToggleTheme={toggle}
        mobileOpen={mobileNavOpen}
        onMobileClose={() => setMobileNavOpen(false)}
      />
      <div className="flex-1 overflow-auto flex flex-col min-w-0">
        {/* Mobile top bar */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 bg-[var(--surface-white)] border-b border-[var(--border-color)] flex-shrink-0 sticky top-0 z-10">
          <button
            onClick={() => setMobileNavOpen(true)}
            className="p-2 rounded-lg hover:bg-[var(--surface-elevated)] transition-colors"
          >
            <Menu className="w-5 h-5 text-[var(--text-primary)]" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#1C1208' }}>
              <Crown className="w-4 h-4" style={{ color: '#F4A261' }} />
            </div>
            <span className="font-bold text-[var(--text-primary)]" style={{ fontSize: '16px' }}>Hugory</span>
            <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#C2671A' }}>Super Admin</span>
          </div>
        </div>
        <main className="flex-1 overflow-auto">
          <Routes>
            <Route path="/" element={<SuperAdminDashboardPage />} />
            <Route path="/staff" element={<SuperAdminStaffPage />} />
            <Route path="/shifts" element={<SuperAdminShiftsPage />} />
            <Route path="/analytics" element={<SuperAdminAnalyticsPage />} />
            <Route path="/clinics" element={<SuperAdminDashboardPage />} />
            <Route path="/appointments" element={<SuperAdminAppointmentsPage />} />
            <Route path="/portals" element={<SuperAdminPatientPortalsPage />} />
            <Route path="/billing" element={<SuperAdminBillingPage />} />
            <Route path="/invoices" element={<SuperAdminDashboardPage />} />
            <Route path="/settings" element={<SuperAdminSettingsPage />} />
            <Route path="/audit" element={<SuperAdminDashboardPage />} />
            <Route path="/chat" element={<SuperAdminChatPage />} />
            <Route path="/services" element={<SuperAdminServicesPage />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

// ─── Auth Loading Screen ──────────────────────────────────────

function AuthLoading() {
  // Read saved theme mode directly from localStorage so we can match the user's
  // theme before CSS variables are available (theme hook hasn't run yet).
  const isDark = (() => {
    try {
      const path = typeof window !== 'undefined' ? window.location.pathname : '';
      const prefix = 'vettrack-theme';
      const portalKey = path.startsWith('/superadmin') ? `${prefix}-superadmin`
        : path.startsWith('/admin') ? `${prefix}-admin`
        : path.startsWith('/owner') ? `${prefix}-owner`
        : prefix;
      return localStorage.getItem(`${portalKey}-mode`) === 'dark';
    } catch { return false; }
  })();

  const bg = isDark ? '#000000' : '#F8F7F4';
  const textPrimary = isDark ? '#E2E8F0' : '#1A1A2E';
  const textSecondary = isDark ? '#64748B' : '#94A3B8';

  return (
    <div style={{
      height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      backgroundColor: bg,
    }}>
      <style>{`
        @keyframes logo-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        @keyframes logo-glow {
          0%, 100% { filter: drop-shadow(0 0 8px rgba(99,102,241,0.0)); }
          50% { filter: drop-shadow(0 0 18px rgba(99,102,241,0.35)); }
        }
        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes dot-wave {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.3; }
          30% { transform: translateY(-6px); opacity: 1; }
        }
      `}</style>
      <div style={{ textAlign: 'center' }}>
        <img
          src="/logo-mini.svg"
          alt="HugoIT"
          style={{
            width: 56, height: 56, marginBottom: 24,
            animation: 'logo-float 2s ease-in-out infinite, logo-glow 2s ease-in-out infinite',
          }}
        />
        <p style={{
          fontSize: 14, fontWeight: 500, letterSpacing: '0.08em',
          margin: '0 0 16px',
          background: `linear-gradient(90deg, ${textSecondary} 0%, ${textPrimary} 50%, ${textSecondary} 100%)`,
          backgroundSize: '200% auto',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          animation: 'shimmer 2.5s linear infinite',
        }}>
          Loading
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              width: 5, height: 5, borderRadius: '50%',
              backgroundColor: textSecondary,
              animation: `dot-wave 1.4s ease-in-out ${i * 0.15}s infinite`,
            }} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Protected Route ──────────────────────────────────────────

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) return <AuthLoading />;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <TenantGate fallback={<AuthLoading />}>
      {children}
    </TenantGate>
  );
}

// ─── Public Route (redirect if already logged in) ─────────────

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [redirectPath, setRedirectPath] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    // Redirect based on user's role in profiles table
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      const role = data?.role || '';
      if (['front_desk_manager', 'receptionist', 'clinic_manager'].includes(role)) {
        setRedirectPath('/admin');
      } else if (role === 'superadmin') {
        setRedirectPath('/superadmin');
      } else if (role === 'pet_owner') {
        setRedirectPath('/owner');
      } else {
        setRedirectPath('/');
      }
    })();
  }, [user]);

  if (loading) return <AuthLoading />;
  if (user && redirectPath) return <Navigate to={redirectPath} replace />;
  if (user) return <AuthLoading />;

  return <>{children}</>;
}

// ─── Root ─────────────────────────────────────────────────────

function AppRoutes() {
  return (
    <TenantProvider>
    <AppointmentStatusProvider>
    <ActiveVisitProvider>
      <Routes>
        <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
        <Route path="/sysadmin" element={<ProtectedRoute><PortalGuard portal="sysadmin"><SystemAdminPage /></PortalGuard></ProtectedRoute>} />
        <Route path="/superadmin/*" element={<ProtectedRoute><PortalGuard portal="superadmin"><SuperAdminApp /></PortalGuard></ProtectedRoute>} />
        <Route path="/admin/*" element={<ProtectedRoute><PortalGuard portal="admin"><AdminApp /></PortalGuard></ProtectedRoute>} />
        <Route path="/owner/*" element={<ProtectedRoute><PortalGuard portal="owner"><OwnerApp /></PortalGuard></ProtectedRoute>} />
        <Route path="/*" element={<ProtectedRoute><PortalGuard portal="doctor"><MainApp /></PortalGuard></ProtectedRoute>} />
      </Routes>
    </ActiveVisitProvider>
    </AppointmentStatusProvider>
    </TenantProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
      <ToastNotification />
    </AuthProvider>
  );
}
