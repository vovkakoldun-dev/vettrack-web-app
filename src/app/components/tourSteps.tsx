import { FlaskConical, FileText, Image as ImageIcon, Paperclip } from 'lucide-react';
import type { TourStep } from './TourOverlay';
import { ReactionShowcase } from './ReactionShowcase';

/** Small icon-bullet list shown in the "Type your message" tour step. */
function AttachmentList() {
  const items = [
    { icon: FlaskConical, label: 'Lab results' },
    { icon: FileText,     label: 'Medical records' },
    { icon: ImageIcon,    label: 'Images' },
    { icon: Paperclip,    label: 'Documents' },
  ];
  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
      {items.map(({ icon: Icon, label }) => (
        <li
          key={label}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 10px',
            borderRadius: 9,
            backgroundColor: 'color-mix(in srgb, var(--text-primary) 4%, transparent)',
            border: '1px solid var(--border-color)',
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--text-primary)',
          }}
        >
          <span
            style={{
              width: 22,
              height: 22,
              borderRadius: 7,
              backgroundColor: 'color-mix(in srgb, var(--brand-green-text) 14%, transparent)',
              color: 'var(--brand-green-text)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Icon style={{ width: 12, height: 12 }} />
          </span>
          {label}
        </li>
      ))}
    </ul>
  );
}

/** Find the first client row in the table and build a profile path from
 *  its data-* attributes. Returns null if there are no clients yet. */
function firstClientPath(): string | null {
  const row = document.querySelector('[data-tour="clients-first-row"]') as HTMLElement | null;
  if (!row) return null;
  const cid = row.getAttribute('data-client-id');
  const pid = row.getAttribute('data-pet-id');
  if (!cid) return null;
  return `/clients/${cid}${pid ? `?petId=${pid}` : ''}`;
}

/** Drill-down sub-tour for the Appointments page (and the New Appointment
 *  dialog, which is auto-opened via the `?new=1` query string). */
export const APPOINTMENTS_TOUR_STEPS: TourStep[] = [
  {
    navigateTo: '/appointments',
    selector: '[data-tour="appt-new"]',
    title: 'Create a booking',
    description: 'Open the New Appointment form to schedule a returning patient or register a brand-new one.',
    placement: 'bottom',
  },
  {
    navigateTo: '/appointments',
    selector: '[data-tour="appt-view-toggle"]',
    title: 'List, schedule, or month',
    description: 'Switch between a quick list, a 30-min schedule grid, or a full month calendar.',
    placement: 'bottom',
  },
  {
    navigateTo: '/appointments',
    selector: '[data-tour="appt-filters"]',
    title: 'Filter by status',
    description: 'Show All, Scheduled, In Progress, Completed, or Cancelled — your queue filtered in one tap.',
    placement: 'bottom',
  },
  {
    navigateTo: '/appointments',
    selector: '[data-tour="appt-search"]',
    title: 'Find by pet',
    description: 'Quick search through the visible day\'s appointments — no need to scroll.',
    placement: 'bottom',
  },
  {
    // Auto-open the New Appointment dialog so the next steps can land
    // inside it without forcing the user to click.
    navigateTo: '/appointments?new=1',
    selector: '[data-tour="appt-dialog-visit-type"]',
    title: 'Returning vs. new patient',
    description: 'Pick a returning patient to autofill their details, or "New Patient" to capture pet + owner info on the spot.',
    placement: 'bottom',
    pad: 6,
  },
  {
    navigateTo: '/appointments?new=1',
    selector: '[data-tour="appt-dialog-patient"]',
    title: 'Pick the patient',
    description: 'Search by owner name, phone, or email. Pick the owner first, then choose which of their pets is coming in.',
    placement: 'right',
    pad: 6,
  },
  {
    navigateTo: '/appointments?new=1',
    selector: '[data-tour="appt-dialog-service-type"]',
    title: 'Service type',
    description: 'Tag the visit — checkup, vaccination, dental, surgery, follow-up, emergency, or other. Filters and reports use this.',
    placement: 'right',
    pad: 6,
  },
  {
    navigateTo: '/appointments?new=1',
    selector: '[data-tour="appt-dialog-vet"]',
    title: 'Assign a vet',
    description: 'Each chip shows a vet and their day load. Pick first so the calendar shows their actual availability.',
    placement: 'right',
    pad: 6,
  },
  {
    navigateTo: '/appointments?new=1',
    selector: '[data-tour="appt-dialog-date"]',
    title: 'Pick a date',
    description: 'Use the calendar shortcut, type a date, or step day-by-day with the arrows.',
    placement: 'right',
    pad: 6,
  },
  {
    navigateTo: '/appointments?new=1',
    selector: '[data-tour="appt-dialog-time"]',
    title: 'Pick a time slot',
    description: 'Greyed-out slots are already booked or blocked. Need an unusual hour? Toggle "Show all hours" for a 6 AM – 9:30 PM grid.',
    placement: 'right',
    pad: 6,
  },
  {
    navigateTo: '/appointments?new=1',
    selector: '[data-tour="appt-dialog-submit"]',
    title: 'Schedule it',
    description: 'When everything looks right, hit Schedule Appointment. The assigned vet gets a notification automatically.',
    placement: 'top',
    pad: 6,
  },
  {
    title: 'Bookings made simple 📅',
    description: 'Create, filter, and search bookings, plus a clean form for new visits.',
  },
];

/** Drill-down sub-tour for the My Portal page. */
export const MY_PORTAL_TOUR_STEPS: TourStep[] = [
  {
    navigateTo: '/my-portal',
    selector: '[data-tour="myportal-profile"]',
    title: 'Your profile card',
    description: 'Photo, name, role, and quick performance numbers — this is how teammates see you across the app.',
    placement: 'bottom',
    pad: 6,
  },
  {
    navigateTo: '/my-portal',
    selector: '[data-tour="myportal-schedule"]',
    title: 'Day schedule',
    description: 'Every 30-minute slot for the selected day — appointments, lunch breaks, PTO. Click an empty slot to add a block, or a booking to open it.',
    placement: 'right',
    pad: 6,
  },
  {
    navigateTo: '/my-portal',
    selector: '[data-tour="myportal-patients"]',
    title: 'My Patients',
    description: 'Patients assigned to you with their last visit and status. Tap "View all" for the full list.',
    placement: 'top',
    pad: 6,
  },
  {
    navigateTo: '/my-portal',
    selector: '[data-tour="myportal-activity"]',
    title: 'Recent activity',
    description: 'A live feed of what\'s happening on your roster — completed visits, new vaccinations, scheduled bookings.',
    placement: 'left',
    pad: 6,
  },
  {
    navigateTo: '/my-portal',
    selector: '[data-tour="myportal-timeoff"]',
    title: 'Time off & shifts',
    description: 'PTO and sick days at a glance, plus a "Request Time Off" shortcut. Approved blocks show up automatically on your schedule.',
    placement: 'left',
    pad: 6,
  },
  {
    title: 'My Portal in a nutshell ✨',
    description: 'Profile, schedule, patients, activity, and time off — your shift, organized.',
  },
];

/** Drill-down sub-tour for the Dashboard. */
export const DASHBOARD_TOUR_STEPS: TourStep[] = [
  {
    navigateTo: '/',
    selector: '[data-tour="dash-search"]',
    title: 'Universal search',
    description: 'Find anything in the clinic — clients, pets, appointments, services — without leaving the dashboard.',
    placement: 'bottom',
  },
  {
    navigateTo: '/',
    selector: '[data-tour="dash-stats"]',
    title: 'Live KPIs',
    description: 'Total clients, today\'s bookings, vaccines due this week, and registered pets — each card shows the live number with a sparkline trend.',
    placement: 'bottom',
    pad: 6,
  },
  {
    navigateTo: '/',
    selector: '[data-tour="dash-recent-clients"]',
    title: 'Recent clients',
    description: 'Your latest registered patients with breed, owner, and health status. Click any row to jump straight into the profile.',
    placement: 'top',
    pad: 6,
  },
  {
    navigateTo: '/',
    selector: '[data-tour="dash-today-appts"]',
    title: 'Today\'s appointments',
    description: 'A quick read of what\'s on your schedule for today. Tap "View all" to open the full calendar.',
    placement: 'left',
    pad: 6,
  },
  {
    title: 'That\'s your home base 🏠',
    description: 'Search, KPIs, recent clients, and today\'s schedule — all one glance away.',
  },
];

/** Drill-down sub-tour for the Clients page (and one client's profile).
 *  Every step that targets DOM on /clients carries `navigateTo: '/clients'`
 *  so the tour returns to the list when the user steps Back from the
 *  profile-tabs step. */
export const CLIENTS_TOUR_STEPS: TourStep[] = [
  {
    navigateTo: '/clients',
    selector: '[data-tour="clients-search"]',
    title: 'Find a client',
    description: 'Search by pet name, owner name, or breed — fuzzy matches work too.',
    placement: 'bottom',
  },
  {
    navigateTo: '/clients',
    selector: '[data-tour="clients-add"]',
    title: 'Add a new client',
    description: 'Open a quick form to register a pet and its owner in one go.',
    placement: 'bottom',
  },
  {
    navigateTo: '/clients',
    selector: '[data-tour="clients-first-row"]',
    title: 'Browse the list',
    description: 'Each row shows the pet, owner, breed, and status at a glance. Click any row to open the profile.',
    placement: 'top',
  },
  {
    // Auto-navigate into the first client's profile so the user sees the tabs.
    navigateTo: firstClientPath,
    selector: '[data-tour="client-tabs"]',
    title: 'Patient profile tabs',
    description: 'Everything about a patient lives here: Overview, Visits, Injections, X-Ray, Surgery, Plan, Diet, Lab, Notes, Photos, and Reports.',
    placement: 'bottom',
    pad: 6,
  },
  {
    navigateTo: firstClientPath,
    selector: '[data-tour="client-overview"]',
    title: 'Overview at a glance',
    description: 'Pet info on the left — name, species, breed, DOB, sex, weight, microchip, color, assigned doctor. Owner info on the right — contact, address, emergency contact. Click Edit to update anything inline.',
    placement: 'top',
    pad: 6,
  },
  {
    title: 'Clients made easy 🐾',
    description: 'That\'s the gist — list, search, profiles, and 11 medical tabs per patient.',
  },
];

/** Drill-down sub-tour for the HugoChat page. */
export const CHAT_TOUR_STEPS: TourStep[] = [
  {
    selector: '[data-tour="chat-search"]',
    title: 'Find anyone fast',
    description: 'Search by name to start a 1:1, or jump into an existing conversation.',
    placement: 'bottom',
  },
  {
    selector: '[data-tour="chat-new-group"]',
    title: 'Start a group chat',
    description: 'Spin up a new group thread for a case, a shift, or any team huddle.',
    placement: 'bottom',
  },
  {
    selector: '[data-tour="chat-hugo-channel"]',
    title: 'News from HugoIT',
    description: 'This is your direct line from the team — product updates, new features, and announcements land here. The rainbow stripe is how you\'ll spot it in the list.',
    placement: 'right',
  },
  {
    selector: '[data-tour="chat-input"]',
    title: 'Type your message',
    description: 'Write a note, hit send, done. You can also attach:',
    extra: <AttachmentList />,
    placement: 'top',
  },
  {
    title: 'React to messages',
    description: 'Hover any message to drop a reaction — quick acks for the team without flooding the thread.',
    extra: <ReactionShowcase />,
  },
  {
    title: 'You\'re a chat pro now 💬',
    description: 'Back to the main tour — there\'s still more to explore.',
  },
];

/**
 * Default product tour for the doctor portal — fired right after the
 * onboarding wizard. Each step targets a sidebar nav link by its
 * `data-tour` attribute (set in Sidebar.tsx).
 */
export const DOCTOR_TOUR_STEPS: TourStep[] = [
  {
    selector: '[data-tour="nav-dashboard"]',
    title: 'Your Dashboard',
    description: 'Start every day here — today\'s appointments, urgent tasks, and patients that need attention, all in one snapshot.',
    placement: 'right',
    action: {
      label: 'Show me more',
      path: '/',
      steps: DASHBOARD_TOUR_STEPS,
    },
  },
  {
    selector: '[data-tour="nav-my-portal"]',
    title: 'My Portal',
    description: 'Your personal schedule, time off, and patients assigned to you.',
    placement: 'right',
    action: {
      label: 'Show me more',
      path: '/my-portal',
      steps: MY_PORTAL_TOUR_STEPS,
    },
  },
  {
    selector: '[data-tour="nav-clients"]',
    title: 'Clients & Pets',
    description: 'Browse clients, see their pets, and add new ones in seconds.',
    placement: 'right',
    action: {
      label: 'Show me more',
      path: '/clients',
      steps: CLIENTS_TOUR_STEPS,
    },
  },
  {
    selector: '[data-tour="nav-appointments"]',
    title: 'Appointments',
    description: 'Calendar view of bookings — start visits, check rooms, and manage your day.',
    placement: 'right',
    action: {
      label: 'Show me more',
      path: '/appointments',
      steps: APPOINTMENTS_TOUR_STEPS,
    },
  },
  {
    selector: '[data-tour="nav-records"]',
    title: 'Medical records',
    description: 'Diagnoses, treatments, and chart history for every patient.',
    placement: 'right',
  },
  {
    selector: '[data-tour="nav-chat"]',
    title: 'HugoChat',
    description: 'Message your team — coordinate with vets, techs, and the front desk without leaving the app.',
    placement: 'right',
    action: {
      label: 'Show me more',
      path: '/chat',
      steps: CHAT_TOUR_STEPS,
    },
  },
  {
    selector: '[data-tour="nav-notifications"]',
    title: 'Notifications',
    description: 'Patient arrivals, lab results, and reminders — all in one place.',
    placement: 'right',
  },
  {
    title: 'Have a great first day 👋',
    description: 'You can revisit this tour anytime from Settings → Help. Welcome aboard!',
  },
];
