import { useState } from 'react';
import {
  Bell, Calendar, FlaskConical, User, Syringe, AlertTriangle,
  Check, CheckCheck, Trash2, Clock, ChevronRight,
} from 'lucide-react';
import { Button } from '../components/ui/button';

// ─── Types ───────────────────────────────────────────────────

type NotifCategory = 'Appointment' | 'Lab Result' | 'Patient' | 'Vaccine' | 'System';

interface Notification {
  id: number;
  category: NotifCategory;
  title: string;
  description: string;
  time: string;
  timeISO: string;
  read: boolean;
  petName?: string;
  ownerName?: string;
  actionLabel?: string;
  actionPath?: string;
  urgent?: boolean;
}

// ─── Color Maps ──────────────────────────────────────────────

// `hex` is the raw hex used for gradients/shadows (CSS vars can't be appended with alpha)
const categoryConfig: Record<NotifCategory, { bg: string; text: string; hex: string; icon: React.ElementType }> = {
  Appointment: { bg: '#2D6A4F20', text: 'var(--brand-green-text)', hex: '#2D6A4F', icon: Calendar },
  'Lab Result': { bg: '#8B5CF620', text: '#8B5CF6',                hex: '#8B5CF6', icon: FlaskConical },
  Patient:      { bg: '#3B82F620', text: '#3B82F6',                hex: '#3B82F6', icon: User },
  Vaccine:      { bg: '#06B6D420', text: '#06B6D4',                hex: '#06B6D4', icon: Syringe },
  System:       { bg: '#F4A26120', text: '#F4A261',                hex: '#F4A261', icon: AlertTriangle },
};

// ─── Mock Data ───────────────────────────────────────────────

const INITIAL_NOTIFICATIONS: Notification[] = [
  {
    id: 1,
    category: 'Lab Result',
    title: "Rocky's cardiac lab results are ready",
    description: 'NT-proBNP and Cardiac Troponin I results require urgent review. Critical values flagged.',
    time: '5 minutes ago',
    timeISO: '2026-03-13T09:25:00',
    read: false,
    petName: 'Rocky',
    ownerName: 'James Wilson',
    actionLabel: 'View Record',
    actionPath: '/records/8',
    urgent: true,
  },
  {
    id: 2,
    category: 'Appointment',
    title: 'Upcoming appointment in 30 minutes',
    description: 'Luna (Tabby) with Emily Johnson — Annual Wellness Exam at 10:00 AM.',
    time: '30 minutes ago',
    timeISO: '2026-03-13T09:00:00',
    read: false,
    petName: 'Luna',
    ownerName: 'Emily Johnson',
    actionLabel: 'View Appointment',
    actionPath: '/appointments',
  },
  {
    id: 3,
    category: 'Patient',
    title: "Follow-up overdue: Charlie",
    description: "Charlie (Corgi) was due for a joint pain follow-up check on Mar 12. Contact David Miller to reschedule.",
    time: '2 hours ago',
    timeISO: '2026-03-13T07:30:00',
    read: false,
    petName: 'Charlie',
    ownerName: 'David Miller',
    actionLabel: 'View Patient',
    actionPath: '/clients/5',
    urgent: true,
  },
  {
    id: 4,
    category: 'Appointment',
    title: 'Appointment cancelled',
    description: "Buddy's grooming & wellness check with Karen Thomas at 3:00 PM today has been cancelled by the owner.",
    time: '3 hours ago',
    timeISO: '2026-03-13T06:30:00',
    read: false,
    petName: 'Buddy',
    ownerName: 'Karen Thomas',
    actionLabel: 'Reschedule',
    actionPath: '/appointments',
  },
  {
    id: 5,
    category: 'Vaccine',
    title: 'Vaccine due in 7 days — Max',
    description: "Max (Golden Retriever) is due for his Rabies 3-year booster on Mar 20, 2026. Owner notification sent.",
    time: '4 hours ago',
    timeISO: '2026-03-13T05:30:00',
    read: true,
    petName: 'Max',
    ownerName: 'John Smith',
    actionLabel: 'Schedule Visit',
    actionPath: '/appointments',
  },
  {
    id: 6,
    category: 'Lab Result',
    title: "Luna's urinalysis results pending review",
    description: 'Trace crystalluria detected. Results awaiting your review before sending report to owner.',
    time: 'Yesterday, 4:15 PM',
    timeISO: '2026-03-12T16:15:00',
    read: false,
    petName: 'Luna',
    ownerName: 'Emily Johnson',
    actionLabel: 'View Record',
    actionPath: '/records/15',
  },
  {
    id: 7,
    category: 'Appointment',
    title: 'New appointment request',
    description: "Sarah Williams has requested an appointment for Bella's post-surgery follow-up on Mar 17.",
    time: 'Yesterday, 2:00 PM',
    timeISO: '2026-03-12T14:00:00',
    read: true,
    petName: 'Bella',
    ownerName: 'Sarah Williams',
    actionLabel: 'Confirm',
    actionPath: '/appointments',
  },
  {
    id: 8,
    category: 'Patient',
    title: 'Prescription refill request — Charlie',
    description: 'David Miller has requested a refill for Carprofen 75mg (14-day supply). Last prescribed Mar 5.',
    time: 'Yesterday, 11:30 AM',
    timeISO: '2026-03-12T11:30:00',
    read: true,
    petName: 'Charlie',
    ownerName: 'David Miller',
    actionLabel: 'View Record',
    actionPath: '/records/7',
  },
  {
    id: 9,
    category: 'System',
    title: 'Rocky — echocardiogram referral due',
    description: "Echocardiogram referral for Rocky was sent to Dr. Amanda Torres on Mar 3. Appointment scheduled for Mar 14. Confirm attendance.",
    time: 'Yesterday, 9:00 AM',
    timeISO: '2026-03-12T09:00:00',
    read: true,
    petName: 'Rocky',
    ownerName: 'James Wilson',
    actionLabel: 'View Record',
    actionPath: '/records/9',
  },
  {
    id: 10,
    category: 'Vaccine',
    title: 'Vaccine overdue — Simba',
    description: "Simba (Maine Coon) is overdue for FVRCP booster. Was due Feb 28. Owner has not responded to reminder.",
    time: 'Mar 11, 2026',
    timeISO: '2026-03-11T10:00:00',
    read: true,
    petName: 'Simba',
    ownerName: 'Lisa Martinez',
    actionLabel: 'Contact Owner',
    actionPath: '/clients/9',
  },
  {
    id: 11,
    category: 'Appointment',
    title: 'Appointment completed — Bella',
    description: "Post-surgery follow-up for Bella completed on Mar 10. Incision healing well. Record updated.",
    time: 'Mar 10, 2026',
    timeISO: '2026-03-10T15:00:00',
    read: true,
    petName: 'Bella',
    ownerName: 'Sarah Williams',
    actionLabel: 'View Record',
    actionPath: '/records/6',
  },
  {
    id: 12,
    category: 'Patient',
    title: 'Weight alert — Simba',
    description: "Simba weighed in at 14.2 lbs at last visit — 1.5 lbs above target. Diet plan reminder sent to owner.",
    time: 'Mar 10, 2026',
    timeISO: '2026-03-10T11:00:00',
    read: true,
    petName: 'Simba',
    ownerName: 'Lisa Martinez',
    actionLabel: 'View Patient',
    actionPath: '/clients/9',
  },
  {
    id: 13,
    category: 'System',
    title: 'Monthly records summary ready',
    description: "Your March 2026 activity summary is ready: 13 records created, 3 pending review, 5 follow-ups scheduled.",
    time: 'Mar 9, 2026',
    timeISO: '2026-03-09T08:00:00',
    read: true,
    actionLabel: 'View Records',
    actionPath: '/records',
  },
  {
    id: 14,
    category: 'Vaccine',
    title: 'Vaccine due in 14 days — Cooper',
    description: "Cooper (Beagle) is due for DHPP booster on Mar 27, 2026. Schedule reminder sent to Michael Brown.",
    time: 'Mar 8, 2026',
    timeISO: '2026-03-08T09:00:00',
    read: true,
    petName: 'Cooper',
    ownerName: 'Michael Brown',
    actionLabel: 'Schedule Visit',
    actionPath: '/appointments',
  },
  {
    id: 15,
    category: 'Lab Result',
    title: "Cooper's post-dental bloodwork — all clear",
    description: "CBC results following Cooper's dental procedure are within normal limits. No concerns.",
    time: 'Mar 8, 2026',
    timeISO: '2026-03-08T14:30:00',
    read: true,
    petName: 'Cooper',
    ownerName: 'Michael Brown',
    actionLabel: 'View Record',
    actionPath: '/records/4',
  },
];

type FilterTab = 'all' | 'unread' | 'Appointment' | 'Lab Result' | 'Patient' | 'Vaccine' | 'System';

const FILTER_TABS: { label: string; value: FilterTab }[] = [
  { label: 'All', value: 'all' },
  { label: 'Unread', value: 'unread' },
  { label: 'Appointments', value: 'Appointment' },
  { label: 'Lab Results', value: 'Lab Result' },
  { label: 'Patients', value: 'Patient' },
  { label: 'Vaccines', value: 'Vaccine' },
  { label: 'System', value: 'System' },
];

// ─── Component ───────────────────────────────────────────────

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>(INITIAL_NOTIFICATIONS);
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');

  const unreadCount = notifications.filter((n) => !n.read).length;

  const filtered = notifications.filter((n) => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'unread') return !n.read;
    return n.category === activeFilter;
  });

  const markAsRead = (id: number) => {
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
  };

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const dismiss = (id: number) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  return (
    <div className="max-w-[1000px] mx-auto p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-[var(--text-primary)]" style={{ fontSize: '32px', fontWeight: 700 }}>Notifications</h1>
            {unreadCount > 0 && (
              <span
                className="inline-flex items-center justify-center text-white"
                style={{
                  backgroundColor: '#d4183d',
                  borderRadius: '9999px',
                  fontSize: '13px',
                  fontWeight: 700,
                  minWidth: '26px',
                  height: '26px',
                  padding: '0 8px',
                }}
              >
                {unreadCount}
              </span>
            )}
          </div>
          <p className="text-[var(--text-secondary)]" style={{ fontSize: '16px', fontWeight: 400 }}>
            Stay on top of patient care, appointments, and alerts.
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" className="gap-2" onClick={markAllRead}>
            <CheckCheck className="w-4 h-4" />
            Mark all as read
          </Button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        {FILTER_TABS.map((tab) => {
          const isActive = activeFilter === tab.value;
          const tabUnread = tab.value === 'unread'
            ? unreadCount
            : tab.value === 'all'
            ? 0
            : notifications.filter((n) => !n.read && n.category === tab.value).length;

          return (
            <button
              key={tab.value}
              onClick={() => setActiveFilter(tab.value)}
              className="flex items-center gap-1.5 px-4 py-2 transition-colors"
              style={{
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 600,
                backgroundColor: isActive ? 'var(--brand-green-text)' : 'var(--surface-white)',
                color: isActive ? '#fff' : 'var(--text-secondary)',
                border: `1px solid ${isActive ? 'var(--brand-green-text)' : 'var(--border-color)'}`,
              }}
            >
              {tab.label}
              {tabUnread > 0 && (
                <span
                  className="inline-flex items-center justify-center"
                  style={{
                    backgroundColor: isActive ? 'rgba(255,255,255,0.3)' : '#d4183d',
                    color: '#fff',
                    borderRadius: '9999px',
                    fontSize: '11px',
                    fontWeight: 700,
                    minWidth: '18px',
                    height: '18px',
                    padding: '0 5px',
                  }}
                >
                  {tabUnread}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Notifications List */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="bg-[var(--surface-white)] border border-[var(--border-color)] p-12 text-center" style={{ borderRadius: '12px' }}>
            <div className="w-14 h-14 mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: 'var(--surface-elevated)', borderRadius: '9999px' }}>
              <Bell className="w-7 h-7 text-[var(--text-secondary)]" />
            </div>
            <p className="text-[var(--text-primary)]" style={{ fontSize: '16px', fontWeight: 600 }}>No notifications</p>
            <p className="text-[var(--text-secondary)] mt-1" style={{ fontSize: '14px' }}>
              {activeFilter === 'unread' ? "You're all caught up!" : 'Nothing here yet.'}
            </p>
          </div>
        ) : (
          filtered.map((notif) => {
            const config = categoryConfig[notif.category];
            const CategoryIcon = config.icon;

            return (
              <div
                key={notif.id}
                className="bg-[var(--surface-white)] border p-5 transition-all"
                style={{
                  borderRadius: '12px',
                  borderColor: notif.read
                    ? 'var(--border-color)'
                    : notif.urgent ? '#d4183d40' : `${config.hex}35`,
                  borderLeftWidth: notif.read ? undefined : '3px',
                  borderLeftColor: notif.read ? undefined : notif.urgent ? '#d4183d' : config.hex,
                  opacity: notif.read ? 0.82 : 1,
                  boxShadow: notif.read
                    ? undefined
                    : notif.urgent
                      ? '0 0 18px rgba(212,24,61,0.12), 0 2px 8px rgba(0,0,0,0.06)'
                      : `0 0 18px ${config.hex}18, 0 2px 8px rgba(0,0,0,0.06)`,
                }}
              >
                <div className="flex items-start gap-4">
                  {/* Icon — rounded square, My Portal style */}
                  <div
                    className="w-10 h-10 flex-shrink-0 flex items-center justify-center mt-0.5"
                    style={{
                      borderRadius: '10px',
                      background: `linear-gradient(135deg, ${config.hex}22 0%, ${config.hex}10 100%)`,
                      border: `1px solid ${config.hex}30`,
                      boxShadow: notif.read ? undefined : `0 0 12px ${config.hex}30`,
                    }}
                  >
                    <CategoryIcon className="w-5 h-5" style={{ color: config.text }} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          {/* Unread dot */}
                          {!notif.read && (
                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: notif.urgent ? '#d4183d' : 'var(--brand-green-text)' }} />
                          )}
                          <span
                            className="text-[var(--text-primary)]"
                            style={{ fontSize: '15px', fontWeight: notif.read ? 500 : 700 }}
                          >
                            {notif.title}
                          </span>
                          {notif.urgent && !notif.read && (
                            <span
                              className="inline-block px-2 py-0.5"
                              style={{
                                backgroundColor: '#d4183d20',
                                color: '#d4183d',
                                borderRadius: '9999px',
                                fontSize: '11px',
                                fontWeight: 700,
                              }}
                            >
                              Urgent
                            </span>
                          )}
                          <span
                            className="inline-block px-2 py-0.5"
                            style={{
                              backgroundColor: config.bg,
                              color: config.text,
                              borderRadius: '9999px',
                              fontSize: '11px',
                              fontWeight: 600,
                            }}
                          >
                            {notif.category}
                          </span>
                        </div>
                        <p className="text-[var(--text-secondary)] mb-2" style={{ fontSize: '14px', lineHeight: 1.5 }}>
                          {notif.description}
                        </p>
                        <div className="flex items-center gap-4 flex-wrap">
                          {(notif.petName || notif.ownerName) && (
                            <span className="text-[var(--text-secondary)]" style={{ fontSize: '13px' }}>
                              {notif.petName && <strong className="text-[var(--text-primary)]">{notif.petName}</strong>}
                              {notif.petName && notif.ownerName && ' — '}
                              {notif.ownerName}
                            </span>
                          )}
                          <span className="flex items-center gap-1 text-[var(--text-secondary)]" style={{ fontSize: '12px' }}>
                            <Clock className="w-3 h-3" />
                            {notif.time}
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {notif.actionLabel && notif.actionPath && (
                          <a
                            href={notif.actionPath}
                            className="inline-flex items-center gap-1 px-3 py-1.5 transition-colors"
                            style={{
                              backgroundColor: '#2D6A4F10',
                              color: 'var(--brand-green-text)',
                              borderRadius: '8px',
                              fontSize: '13px',
                              fontWeight: 600,
                              textDecoration: 'none',
                            }}
                          >
                            {notif.actionLabel}
                            <ChevronRight className="w-3.5 h-3.5" />
                          </a>
                        )}
                        {!notif.read && (
                          <button
                            onClick={() => markAsRead(notif.id)}
                            title="Mark as read"
                            className="w-8 h-8 flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--brand-green-text)] hover:bg-[var(--surface-elevated)] transition-colors"
                            style={{ borderRadius: '8px' }}
                          >
                            <Check className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => dismiss(notif.id)}
                          title="Dismiss"
                          className="w-8 h-8 flex items-center justify-center text-[var(--text-secondary)] hover:text-[#d4183d] hover:bg-[var(--surface-elevated)] transition-colors"
                          style={{ borderRadius: '8px' }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer count */}
      {filtered.length > 0 && (
        <p className="text-center text-[var(--text-secondary)] mt-6" style={{ fontSize: '13px' }}>
          Showing {filtered.length} notification{filtered.length !== 1 ? 's' : ''}
          {activeFilter !== 'all' && ` · ${FILTER_TABS.find(t => t.value === activeFilter)?.label}`}
        </p>
      )}
    </div>
  );
}
