import { useState, useEffect, lazy, Suspense } from 'react';
import { supabase } from '../lib/supabase';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router';
import { Sidebar } from './components/Sidebar';
import { AdminSidebar } from './components/AdminSidebar';
import { useTheme } from './hooks/useTheme';
import { AuthProvider, useAuth } from './context/AuthContext';
import { TenantProvider, TenantGate } from './context/TenantContext';
import { PortalGuard } from './components/PortalGuard';
const LoginPage = lazy(() => import('./pages/LoginPage'));
import ToastNotification from './components/ToastNotification';
import { OwnerSidebar } from './components/OwnerSidebar';
import { SuperAdminSidebar } from './components/SuperAdminSidebar';
import { ActiveVisitProvider, useActiveVisit } from './context/ActiveVisitContext';

// ─── Lazy-loaded pages (code-split per portal) ────────────────
// Doctor portal
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const ClientsPage = lazy(() => import('./pages/ClientsPage'));
const ClientDetailPage = lazy(() => import('./pages/ClientDetailPage'));
const AppointmentsPage = lazy(() => import('./pages/AppointmentsPage'));
const MyPortalPage = lazy(() => import('./pages/MyPortalPage'));
const MyPatientsPage = lazy(() => import('./pages/MyPatientsPage'));
const RecordsPage = lazy(() => import('./pages/RecordsPage'));
const RecordDetailPage = lazy(() => import('./pages/RecordDetailPage'));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'));
const LabPage = lazy(() => import('./pages/LabPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const VaccinesPage = lazy(() => import('./pages/VaccinesPage'));
const PetsPage = lazy(() => import('./pages/PetsPage'));
const ChatPage = lazy(() => import('./pages/ChatPage'));
const SupabaseTestPage = lazy(() => import('./pages/SupabaseTestPage'));
const VisitPage = lazy(() => import('./pages/VisitPage'));
const CheckoutPage = lazy(() => import('./pages/CheckoutPage'));
const ShiftsPage = lazy(() => import('./pages/ShiftsPage'));
// Owner portal
const OwnerDashboardPage = lazy(() => import('./pages/owner/OwnerDashboardPage'));
const OwnerContactPage = lazy(() => import('./pages/owner/OwnerContactPage'));
const OwnerSettingsPage = lazy(() => import('./pages/owner/OwnerSettingsPage'));
const OwnerPetProfilePage = lazy(() => import('./pages/owner/OwnerPetProfilePage'));
const OwnerPetsPage = lazy(() => import('./pages/owner/OwnerPetsPage'));
const OwnerAppointmentsPage = lazy(() => import('./pages/owner/OwnerAppointmentsPage'));
const OwnerRecordsPage = lazy(() => import('./pages/owner/OwnerRecordsPage'));
const OwnerRecordDetailPage = lazy(() => import('./pages/owner/OwnerRecordDetailPage'));
const OwnerInvoicesPage = lazy(() => import('./pages/owner/OwnerInvoicesPage'));
// Admin portal
const AdminDashboardPage = lazy(() => import('./pages/admin/AdminDashboardPage'));
const AdminBookingsPage = lazy(() => import('./pages/admin/AdminBookingsPage'));
const AdminPaymentsPage = lazy(() => import('./pages/admin/AdminPaymentsPage'));
const AdminCommunicationsPage = lazy(() => import('./pages/admin/AdminCommunicationsPage'));
const AdminClientsPage = lazy(() => import('./pages/admin/AdminClientsPage'));
const AdminMyPortalPage = lazy(() => import('./pages/admin/AdminMyPortalPage'));
const AdminTasksPage = lazy(() => import('./pages/admin/AdminTasksPage'));
const AdminSettingsPage = lazy(() => import('./pages/admin/AdminSettingsPage'));
const AdminChatPage = lazy(() => import('./pages/admin/AdminChatPage'));
// SuperAdmin portal
const SuperAdminDashboardPage = lazy(() => import('./pages/superadmin/SuperAdminDashboardPage'));
const SuperAdminAnalyticsPage = lazy(() => import('./pages/superadmin/SuperAdminAnalyticsPage'));
const SuperAdminSettingsPage = lazy(() => import('./pages/superadmin/SuperAdminSettingsPage'));
const SuperAdminChatPage = lazy(() => import('./pages/superadmin/SuperAdminChatPage'));
const SuperAdminBillingPage = lazy(() => import('./pages/superadmin/SuperAdminBillingPage'));
const SuperAdminServicesPage = lazy(() => import('./pages/superadmin/SuperAdminServicesPage'));
const SuperAdminStaffPage = lazy(() => import('./pages/superadmin/SuperAdminStaffPage'));
const SuperAdminAppointmentsPage = lazy(() => import('./pages/superadmin/SuperAdminAppointmentsPage'));
const SuperAdminPatientPortalsPage = lazy(() => import('./pages/superadmin/SuperAdminPatientPortalsPage'));
const SuperAdminShiftsPage = lazy(() => import('./pages/superadmin/SuperAdminShiftsPage'));
const SuperAdminClientsPage = lazy(() => import('./pages/superadmin/SuperAdminClientsPage'));
const SuperAdminClinicsPage = lazy(() => import('./pages/superadmin/SuperAdminClinicsPage'));
// System admin
const SystemAdminPage = lazy(() => import('./pages/sysadmin/SystemAdminPage'));
import { AppointmentStatusProvider } from './context/AppointmentStatusContext';
import { Avatar, AvatarImage, AvatarFallback } from './components/ui/avatar';
import { ClipboardList, Receipt, ArrowRight, X, Clock, Menu, PawPrint, Crown } from 'lucide-react';

// ─── Lazy loading fallback (skeleton) ─────────────────────────
function PageLoader() {
  return (
    <div style={{ padding: '32px', width: '100%', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Title skeleton */}
      <div style={{ height: 24, width: 180, backgroundColor: 'var(--border-color)', borderRadius: 8, marginBottom: 8, opacity: 0.5, animation: 'pulse 1.5s ease-in-out infinite' }} />
      <div style={{ height: 14, width: 260, backgroundColor: 'var(--border-color)', borderRadius: 6, marginBottom: 28, opacity: 0.35, animation: 'pulse 1.5s ease-in-out 0.1s infinite' }} />
      {/* Stat cards skeleton */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 28 }}>
        {[0,1,2,3].map(i => (
          <div key={i} style={{ height: 88, backgroundColor: 'var(--surface-white)', border: '1px solid var(--border-color)', borderRadius: 12, opacity: 0.6, animation: `pulse 1.5s ease-in-out ${i * 0.1}s infinite` }} />
        ))}
      </div>
      {/* Table skeleton */}
      <div style={{ backgroundColor: 'var(--surface-white)', border: '1px solid var(--border-color)', borderRadius: 12, overflow: 'hidden' }}>
        {[0,1,2,3,4,5].map(i => (
          <div key={i} style={{ height: 52, borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 16, padding: '0 20px' }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', backgroundColor: 'var(--border-color)', opacity: 0.4, animation: `pulse 1.5s ease-in-out ${i * 0.08}s infinite` }} />
            <div style={{ height: 12, flex: 1, maxWidth: 140, backgroundColor: 'var(--border-color)', borderRadius: 6, opacity: 0.35, animation: `pulse 1.5s ease-in-out ${i * 0.08 + 0.05}s infinite` }} />
            <div style={{ height: 12, width: 80, backgroundColor: 'var(--border-color)', borderRadius: 6, opacity: 0.25, animation: `pulse 1.5s ease-in-out ${i * 0.08 + 0.1}s infinite` }} />
          </div>
        ))}
      </div>
    </div>
  );
}

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
        border: '1.5px solid color-mix(in srgb, var(--brand-green-text) 25%, transparent)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.18), 0 0 0 1px color-mix(in srgb, var(--brand-green-text) 3%, transparent)',
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
            : 'linear-gradient(90deg, var(--brand-green-text), #74C69D)',
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
              backgroundColor: isOvertime ? '#DC2626' : progressPct >= 80 ? '#D97706' : 'var(--brand-green-text)',
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
                backgroundColor: done ? '#74C69D' : active ? 'var(--brand-green-text)' : 'var(--border-color)',
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
            backgroundColor: 'var(--brand-green-text)', color: 'var(--on-brand-green)', border: 'none',
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
        <Suspense fallback={<PageLoader />}>
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
        </Suspense>
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
        <Suspense fallback={<PageLoader />}>
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
          <Route path="/lab" element={<LabPage />} />
          <Route path="/my-portal" element={<AdminMyPortalPage />} />
          <Route path="/shifts" element={<ShiftsPage />} />
          <Route path="/chat" element={<AdminChatPage />} />
          <Route path="/tasks" element={<AdminTasksPage />} />
          <Route path="/settings" element={<AdminSettingsPage />} />
        </Routes>
        </Suspense>
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
            <div className="w-7 h-7 bg-[var(--brand-green-text)] rounded-lg flex items-center justify-center">
              <PawPrint className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-[var(--text-primary)]" style={{ fontSize: '16px' }}>Hugory</span>
            <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--brand-green-text)' }}>Client</span>
          </div>
        </div>
        <main className="flex-1 overflow-auto">
          <Suspense fallback={<PageLoader />}>
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
            <Route path="/settings" element={<OwnerSettingsPage />} />
          </Routes>
          </Suspense>
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
    <div className="portal-superadmin flex h-screen overflow-hidden bg-[var(--bg-base)]">
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
          <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<SuperAdminDashboardPage />} />
            <Route path="/staff" element={<SuperAdminStaffPage />} />
            <Route path="/shifts" element={<SuperAdminShiftsPage />} />
            <Route path="/analytics" element={<SuperAdminAnalyticsPage />} />
            <Route path="/clinics" element={<SuperAdminClinicsPage />} />
            <Route path="/appointments" element={<SuperAdminAppointmentsPage />} />
            <Route path="/portals" element={<SuperAdminPatientPortalsPage />} />
            <Route path="/clients" element={<SuperAdminClientsPage />} />
            <Route path="/clients/:id" element={<ClientDetailPage />} />
            <Route path="/billing" element={<SuperAdminBillingPage />} />
            <Route path="/invoices" element={<SuperAdminDashboardPage />} />
            <Route path="/settings" element={<SuperAdminSettingsPage />} />
            <Route path="/audit" element={<SuperAdminDashboardPage />} />
            <Route path="/chat" element={<SuperAdminChatPage />} />
            <Route path="/services" element={<SuperAdminServicesPage />} />
            <Route path="/records" element={<RecordsPage />} />
            <Route path="/records/:id" element={<RecordDetailPage />} />
          </Routes>
          </Suspense>
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
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              width: 5, height: 5, borderRadius: '50%',
              backgroundColor: textPrimary,
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

  // While LoginPage is validating the user's role against the selected portal
  // card, we must NOT redirect — otherwise the dashboard flashes briefly before
  // the mismatch signOut kicks in and the error message is lost.
  const isValidatingPortal = sessionStorage.getItem('vettrack_portal_validating') === 'true';

  useEffect(() => {
    if (!user || isValidatingPortal) return;
    // Try sessionStorage cache first for instant redirect (no DB hit)
    const cachedRole = sessionStorage.getItem('vettrack_user_role');
    const resolve = (role: string) => {
      if (['front_desk_manager', 'receptionist', 'clinic_manager'].includes(role)) {
        setRedirectPath('/admin');
      } else if (role === 'superadmin') {
        setRedirectPath('/superadmin');
      } else if (role === 'pet_owner') {
        setRedirectPath('/owner');
      } else {
        setRedirectPath('/');
      }
    };
    if (cachedRole) {
      resolve(cachedRole);
      return;
    }
    // Fallback: fetch from profiles (only on first login)
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      const role = data?.role || '';
      try { sessionStorage.setItem('vettrack_user_role', role); } catch {}
      resolve(role);
    })();
  }, [user, isValidatingPortal]);

  if (loading) return <AuthLoading />;
  // Keep rendering login form while portal validation is in progress
  if (isValidatingPortal) return <>{children}</>;
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
        <Route path="/login" element={<PublicRoute><Suspense fallback={<AuthLoading />}><LoginPage /></Suspense></PublicRoute>} />
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
