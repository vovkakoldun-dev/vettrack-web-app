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
  },
  {
    selector: '[data-tour="nav-my-portal"]',
    title: 'My Portal',
    description: 'Your personal schedule, time off, and patients assigned to you.',
    placement: 'right',
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
