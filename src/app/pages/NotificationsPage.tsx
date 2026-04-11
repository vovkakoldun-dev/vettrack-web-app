import { useState, useEffect } from 'react';
import { useLocation } from 'react-router';
import {
  Bell, Calendar, FlaskConical, User, Syringe, AlertTriangle,
  Check, CheckCheck, Trash2, Clock, ChevronRight, Loader2,
  ListTodo, CheckCircle2,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { useTenantDb } from '../context/TenantContext';
import { getOrgContext } from '../hooks/useOrgContext';
import { useAuth } from '../context/AuthContext';

// ─── Types ───────────────────────────────────────────────────

type NotifCategory = 'Appointment' | 'Lab Result' | 'Patient' | 'Vaccine' | 'System';

interface Notification {
  id: string;
  category: NotifCategory;
  title: string;
  description: string;
  time: string;
  timeISO: string;
  read: boolean;
  petName?: string;
  petId?: string;
  ownerName?: string;
  clientId?: string;
  actionLabel?: string;
  actionPath?: string;
  actionType?: 'link' | 'create-task';
  urgent?: boolean;
}

// ─── Color Maps ──────────────────────────────────────────────

const categoryConfig: Record<NotifCategory, { bg: string; text: string; hex: string; icon: React.ElementType }> = {
  Appointment: { bg: 'color-mix(in srgb, var(--brand-green-text) 12%, transparent)', text: 'var(--brand-green-text)', hex: 'var(--brand-green-text)', icon: Calendar },
  'Lab Result': { bg: '#8B5CF620', text: '#8B5CF6',                hex: '#8B5CF6', icon: FlaskConical },
  Patient:      { bg: '#3B82F620', text: '#3B82F6',                hex: '#3B82F6', icon: User },
  Vaccine:      { bg: '#06B6D420', text: '#06B6D4',                hex: '#06B6D4', icon: Syringe },
  System:       { bg: '#F4A26120', text: '#F4A261',                hex: '#F4A261', icon: AlertTriangle },
};

// ─── Helpers ─────────────────────────────────────────────────

function localDateString(d: Date = new Date()): string {
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
}

function formatRelativeTime(isoString: string): string {
  const now = new Date();
  const date = new Date(isoString);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMin < 0) {
    // Future — upcoming appointment
    const minsUntil = Math.abs(diffMin);
    if (minsUntil < 60) return `in ${minsUntil} minute${minsUntil !== 1 ? 's' : ''}`;
    const hoursUntil = Math.floor(minsUntil / 60);
    return `in ${hoursUntil} hour${hoursUntil !== 1 ? 's' : ''}`;
  }
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin} minute${diffMin !== 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  if (diffDays === 1) {
    return `Yesterday, ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime12(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

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

// ─── Data Fetching ───────────────────────────────────────────

async function fetchNotificationsFromSupabase(db: any, isAdmin: boolean, userId?: string): Promise<Notification[]> {
  const { organizationId } = await getOrgContext();
  const now = new Date();
  const today = localDateString(now);

  // 7 days ago
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sevenDaysAgoStr = localDateString(sevenDaysAgo);

  // 30 days from now (for upcoming vaccine due dates)
  const thirtyDaysFromNow = new Date(now);
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
  const thirtyDaysFromNowStr = localDateString(thirtyDaysFromNow);

  const notifications: Notification[] = [];
  // IDs use DB record IDs for stability (must match Sidebar computation)

  // ── Fire all queries in parallel ───────────────────────────
  const [
    { data: todayAppointments },
    { data: completedAppointments },
    { data: cancelledAppointments },
    { data: vaccinesDue },
    { data: newClients },
    { data: noShowAppointments },
    ...rest
  ] = await Promise.all([
    (() => {
      let q = db.from('appointments')
        .select('id, scheduled_at, duration_minutes, status, reason, pets(id, name, species, breed), clients(id, first_name, last_name), staff(id, profiles:profiles!staff_profile_org_fkey(first_name, last_name))')
        .eq('organization_id', organizationId)
        .gte('scheduled_at', `${today}T00:00:00`).lte('scheduled_at', `${today}T23:59:59`)
        .in('status', ['Scheduled', 'Confirmed']).order('scheduled_at', { ascending: true });
      if (!isAdmin && userId) q = q.eq('vet_id', userId);
      return q;
    })(),
    (() => {
      let q = db.from('appointments')
        .select('id, scheduled_at, status, reason, pets(id, name, species, breed), clients(id, first_name, last_name)')
        .eq('organization_id', organizationId)
        .gte('scheduled_at', `${sevenDaysAgoStr}T00:00:00`).lt('scheduled_at', `${today}T00:00:00`)
        .eq('status', 'Completed').order('scheduled_at', { ascending: false }).limit(50);
      if (!isAdmin && userId) q = q.eq('vet_id', userId);
      return q;
    })(),
    (() => {
      let q = db.from('appointments')
        .select('id, scheduled_at, reason, pets(id, name), clients(id, first_name, last_name)')
        .eq('organization_id', organizationId)
        .gte('scheduled_at', `${sevenDaysAgoStr}T00:00:00`).eq('status', 'Cancelled')
        .order('scheduled_at', { ascending: false }).limit(50);
      if (!isAdmin && userId) q = q.eq('vet_id', userId);
      return q;
    })(),
    db.from('vaccinations')
      .select('id, vaccine_name, next_due_date, administered_date, pets!inner(id, name, species, breed, organization_id, client_id, clients:clients!pets_client_org_fkey(id, first_name, last_name, phone))')
      .eq('pets.organization_id', organizationId)
      .not('next_due_date', 'is', null).lte('next_due_date', thirtyDaysFromNowStr)
      .order('next_due_date', { ascending: true }).limit(50),
    db.from('clients')
      .select('id, first_name, last_name, created_at')
      .eq('organization_id', organizationId)
      .gte('created_at', `${sevenDaysAgoStr}T00:00:00`)
      .order('created_at', { ascending: false }).limit(50),
    (() => {
      let q = db.from('appointments')
        .select('id, scheduled_at, reason, pets(id, name), clients(id, first_name, last_name)')
        .eq('organization_id', organizationId)
        .gte('scheduled_at', `${sevenDaysAgoStr}T00:00:00`).eq('status', 'No Show')
        .order('scheduled_at', { ascending: false }).limit(50);
      if (!isAdmin && userId) q = q.eq('vet_id', userId);
      return q;
    })(),
    ...(userId ? [
      db.from('notification_events').select('*')
        .eq('organization_id', organizationId)
        .gte('timestamp', new Date(now.getTime() - 7 * 86400000).toISOString()),
    ] : []),
  ]);
  const rawNotifEvents = userId ? (rest[0] as any)?.data : null;
  // Filter notification events — admins see all org events, vets only see their own
  const notifEvents = rawNotifEvents
    ? (rawNotifEvents as any[]).filter((evt: any) => {
        if (isAdmin) return true; // Admins see all notifications for the org
        const d = evt.data as any;
        // Skip admin-only events for non-admin users
        if (d?.adminOnly) return false;
        // Only show appt_assign / vet_assign / vet_unassign if vetId matches current user
        if (d?.vetId && d.vetId !== userId) return false;
        return true;
      })
    : null;

  // ── 1. Today's upcoming appointments ──────────────────────
  if (todayAppointments) {
    for (const appt of todayAppointments) {
      const pet = appt.pets as { id: string; name: string; species: string; breed: string | null } | null;
      const client = appt.clients as { id: string; first_name: string; last_name: string } | null;
      const vet = appt.staff as { id: string; profiles: { first_name: string; last_name: string } | null } | null;
      const apptTime = new Date(appt.scheduled_at);
      const diffMin = Math.round((apptTime.getTime() - now.getTime()) / 60000);
      const isFuture = diffMin > 0;
      const isUrgent = isFuture && diffMin <= 30;

      const petLabel = pet ? `${pet.name}${pet.species ? ` (${pet.species})` : ''}` : 'Unknown pet';
      const ownerLabel = client ? `${client.first_name} ${client.last_name}` : '';
      const vetLabel = vet?.profiles ? `Dr. ${vet.profiles.first_name} ${vet.profiles.last_name}` : '';
      const reasonLabel = appt.reason || 'General visit';

      let title: string;
      if (isFuture) {
        if (diffMin <= 60) {
          title = `Upcoming appointment in ${diffMin} minute${diffMin !== 1 ? 's' : ''}`;
        } else {
          const hours = Math.floor(diffMin / 60);
          title = `Upcoming appointment in ${hours} hour${hours !== 1 ? 's' : ''}`;
        }
      } else {
        title = `Appointment scheduled at ${formatTime12(appt.scheduled_at)}`;
      }

      notifications.push({
        id: `appt-today-${appt.id}`,
        category: 'Appointment',
        title,
        description: `${petLabel} with ${ownerLabel}${vetLabel ? ` — ${vetLabel}` : ''} — ${reasonLabel} at ${formatTime12(appt.scheduled_at)}.`,
        time: formatRelativeTime(appt.scheduled_at),
        timeISO: appt.scheduled_at,
        read: false,
        petName: pet?.name,
        ownerName: ownerLabel,
        actionLabel: 'View Appointment',
        actionPath: '/appointments',
        urgent: isUrgent,
      });
    }
  }

  // ── 2. Recently completed appointments (last 7 days) ──────
  if (completedAppointments) {
    for (const appt of completedAppointments) {
      const pet = appt.pets as { id: string; name: string; species: string; breed: string | null } | null;
      const client = appt.clients as { id: string; first_name: string; last_name: string } | null;
      const ownerLabel = client ? `${client.first_name} ${client.last_name}` : '';
      const reasonLabel = appt.reason || 'General visit';

      notifications.push({
        id: `appt-done-${appt.id}`,
        category: 'Appointment',
        title: `Appointment completed — ${pet?.name || 'Unknown'}`,
        description: `${reasonLabel} for ${pet?.name || 'Unknown'}${pet?.species ? ` (${pet.species})` : ''} completed on ${new Date(appt.scheduled_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}. Record updated.`,
        time: formatRelativeTime(appt.scheduled_at),
        timeISO: appt.scheduled_at,
        read: false,
        petName: pet?.name,
        ownerName: ownerLabel,
        actionLabel: 'View Appointment',
        actionPath: '/appointments',
      });
    }
  }

  // ── 3. Cancelled appointments (last 7 days) ───────────────
  if (cancelledAppointments) {
    for (const appt of cancelledAppointments) {
      const pet = appt.pets as { id: string; name: string } | null;
      const client = appt.clients as { id: string; first_name: string; last_name: string } | null;
      const ownerLabel = client ? `${client.first_name} ${client.last_name}` : '';

      notifications.push({
        id: `appt-cancel-${appt.id}`,
        category: 'Appointment',
        title: 'Appointment cancelled',
        description: `${pet?.name || 'Unknown'}'s ${appt.reason || 'appointment'} with ${ownerLabel} on ${new Date(appt.scheduled_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} has been cancelled.`,
        time: formatRelativeTime(appt.scheduled_at),
        timeISO: appt.scheduled_at,
        read: false,
        petName: pet?.name,
        ownerName: ownerLabel,
        actionLabel: 'Reschedule',
        actionPath: '/appointments',
      });
    }
  }

  // ── 4. Vaccines due / overdue ─────────────────────────────
  if (vaccinesDue) {
    for (const vax of vaccinesDue) {
      const pet = vax.pets as { id: string; name: string; species: string; breed: string | null; client_id?: string; clients?: { id: string; first_name: string; last_name: string; phone: string | null } | null } | null;
      const client = pet?.clients;
      const dueDate = new Date(vax.next_due_date!);
      const daysUntilDue = Math.round((dueDate.getTime() - now.getTime()) / 86400000);
      const isOverdue = daysUntilDue < 0;
      const petLabel = pet ? `${pet.name}${pet.breed ? ` (${pet.breed})` : ''}` : 'Unknown pet';
      const ownerLabel = client ? `${client.first_name} ${client.last_name}` : '';

      let title: string;
      let description: string;

      if (isOverdue) {
        title = `Vaccine overdue — ${pet?.name || 'Unknown'}`;
        description = `${petLabel} is overdue for ${vax.vaccine_name}. Was due ${dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}. Contact owner to schedule.`;
      } else if (daysUntilDue <= 7) {
        title = `Vaccine due in ${daysUntilDue} day${daysUntilDue !== 1 ? 's' : ''} — ${pet?.name || 'Unknown'}`;
        description = `${petLabel} is due for ${vax.vaccine_name} on ${dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}.`;
      } else {
        title = `Vaccine due in ${daysUntilDue} days — ${pet?.name || 'Unknown'}`;
        description = `${petLabel} is due for ${vax.vaccine_name} booster on ${dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}. Schedule reminder sent.`;
      }

      notifications.push({
        id: `vax-${vax.id}`,
        category: 'Vaccine',
        title,
        description,
        time: isOverdue
          ? `Due ${dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
          : `Due in ${daysUntilDue} day${daysUntilDue !== 1 ? 's' : ''}`,
        timeISO: vax.next_due_date!,
        read: false,
        petName: pet?.name,
        petId: pet?.id,
        ownerName: ownerLabel,
        clientId: client?.id,
        actionLabel: isOverdue ? 'Create Follow-up Task' : 'Schedule Visit',
        actionPath: isOverdue ? undefined : '/appointments',
        actionType: isOverdue ? 'create-task' : 'link',
        urgent: isOverdue,
      });
    }
  }

  // ── 5. New clients registered (last 7 days) ───────────────
  if (newClients) {
    for (const client of newClients) {
      const ownerLabel = `${client.first_name} ${client.last_name}`;

      notifications.push({
        id: `client-${client.id}`,
        category: 'Patient',
        title: `New client registered — ${ownerLabel}`,
        description: `${ownerLabel} has been added to the system on ${new Date(client.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}. Review their profile and assign to a veterinarian.`,
        time: formatRelativeTime(client.created_at),
        timeISO: client.created_at,
        read: false,
        ownerName: ownerLabel,
        actionLabel: 'View Client',
        actionPath: `/clients/${client.id}`,
      });
    }
  }

  // ── 6. No-show appointments (last 7 days) ─────────────────
  if (noShowAppointments) {
    for (const appt of noShowAppointments) {
      const pet = appt.pets as { id: string; name: string } | null;
      const client = appt.clients as { id: string; first_name: string; last_name: string } | null;
      const ownerLabel = client ? `${client.first_name} ${client.last_name}` : '';

      notifications.push({
        id: `noshow-${appt.id}`,
        category: 'System',
        title: `No-show: ${pet?.name || 'Unknown'}'s appointment`,
        description: `${pet?.name || 'Unknown'} with ${ownerLabel} did not attend their ${appt.reason || 'appointment'} on ${new Date(appt.scheduled_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}. Consider reaching out to reschedule.`,
        time: formatRelativeTime(appt.scheduled_at),
        timeISO: appt.scheduled_at,
        read: false,
        petName: pet?.name,
        ownerName: ownerLabel,
        actionLabel: 'Reschedule',
        actionPath: '/appointments',
      });
    }
  }

  // ── 7. Notification events (vet assignments, request decisions, etc.) ──
  if (notifEvents) {
  for (const evt of notifEvents) {
    const d = evt.data as any;
    if (evt.type === 'vet_assign') {
      const petLabel = `${d.petName}${d.breed ? ` (${d.breed})` : ''}`;
      notifications.push({
        id: evt.id,
        category: 'Patient',
        title: `New patient assigned — ${d.petName}`,
        description: `${petLabel} owned by ${d.ownerName} has been assigned to you. Review the patient profile and upcoming appointments.`,
        time: formatRelativeTime(evt.timestamp),
        timeISO: evt.timestamp,
        read: false,
        petName: d.petName,
        ownerName: d.ownerName,
        actionLabel: 'View Patient',
        actionPath: `/clients/${d.clientId || ''}`,
        urgent: false,
      });
    } else if (evt.type === 'vet_unassign') {
      notifications.push({
        id: evt.id,
        category: 'Patient',
        title: `Patient unassigned — ${d.petName}`,
        description: `${d.petName} owned by ${d.ownerName} has been unassigned from ${isAdmin ? d.vetName : 'you'}. The patient may be reassigned to another veterinarian.`,
        time: formatRelativeTime(evt.timestamp),
        timeISO: evt.timestamp,
        read: false,
        petName: d.petName,
        ownerName: d.ownerName,
        actionLabel: 'View Patient',
        actionPath: `/clients/${d.clientId || ''}`,
        urgent: false,
      });
    } else if (evt.type === 'request_resolved') {
      const decision = d.decision === 'approved' ? 'Approved' : 'Declined';
      const typeLabel = d.requestType === 'pto' ? 'PTO request' : d.requestType === 'shift_swap' ? 'Shift swap request' : d.requestType === 'overtime' ? 'Overtime request' : 'Request';
      const isMyRequest = d.vetId === userId;
      // For admins viewing someone else's request, show it differently
      if (isAdmin && !isMyRequest) {
        const doctorName = d.title ? d.title.split(' — ')[0] : 'Staff member';
        notifications.push({
          id: evt.id,
          category: 'System',
          title: `${doctorName} — ${typeLabel} ${decision.toLowerCase()}`,
          description: `${doctorName}'s ${typeLabel.toLowerCase()} has been ${decision.toLowerCase()}. ${d.detail || ''}`,
          time: formatRelativeTime(evt.timestamp),
          timeISO: evt.timestamp,
          read: false,
          actionLabel: 'View My Portal',
          actionPath: isAdmin ? '/admin/my-portal' : '/my-portal',
          urgent: d.decision === 'declined',
        });
      } else {
        notifications.push({
          id: evt.id,
          category: 'System',
          title: `${typeLabel} ${decision.toLowerCase()}`,
          description: `Your ${typeLabel.toLowerCase()} has been ${decision.toLowerCase()} by management. ${d.detail || ''}`,
          time: formatRelativeTime(evt.timestamp),
          timeISO: evt.timestamp,
          read: false,
          actionLabel: 'View My Portal',
          actionPath: isAdmin ? '/admin/my-portal' : '/my-portal',
          urgent: d.decision === 'declined',
        });
      }
    } else if (evt.type === 'pto_coverage_needed') {
      // Only show to admins — this notification is about reassigning appointments
      if (isAdmin) {
        const appts = (d.appointments || []) as { petName: string; ownerName: string; date: string; time: string; reason: string }[];
        const hasAppts = appts.length > 0;
        const apptLines = appts.map((a: any) => `${a.petName} (${a.ownerName}) — ${a.date} at ${a.time}${a.reason ? `, ${a.reason}` : ''}`).join('; ');
        notifications.push({
          id: evt.id,
          category: 'System',
          title: hasAppts
            ? `${d.doctorName} on ${d.blockType || 'PTO'} — ${d.appointmentCount} appointment${d.appointmentCount > 1 ? 's' : ''} need reassignment`
            : `${d.doctorName} — ${d.blockType || 'PTO'} approved`,
          description: hasAppts
            ? `${d.doctorName} is on ${(d.blockType || 'PTO').toLowerCase()} ${d.dateRange}. Appointments that need reassignment: ${apptLines}`
            : `${d.doctorName} is on approved ${(d.blockType || 'PTO').toLowerCase()} ${d.dateRange}. No appointments need reassignment.`,
          time: formatRelativeTime(evt.timestamp),
          timeISO: evt.timestamp,
          read: false,
          actionLabel: hasAppts ? 'View Appointments' : 'View Schedule',
          actionPath: hasAppts ? (isAdmin ? '/admin/bookings' : '/appointments') : (isAdmin ? '/admin/shifts' : '/shifts'),
          urgent: hasAppts,
        });
      }
    } else if (evt.type === 'appt_assign') {
      const dateLabel = d.date ? ` on ${d.date}` : '';
      const timeLabel = d.time ? ` at ${d.time}` : '';
      notifications.push({
        id: evt.id,
        category: 'Appointment',
        title: `New appointment scheduled — ${d.petName}`,
        description: `${d.petName} owned by ${d.ownerName} has a ${d.service || 'appointment'} scheduled${dateLabel}${timeLabel}. You have been assigned as the attending veterinarian.`,
        time: formatRelativeTime(evt.timestamp),
        timeISO: evt.timestamp,
        read: false,
        petName: d.petName,
        ownerName: d.ownerName,
        actionLabel: 'View Appointment',
        actionPath: `/appointments`,
        urgent: false,
      });
    } else if (evt.type === 'lab_ready') {
      notifications.push({
        id: evt.id,
        category: 'Lab Result',
        title: `Lab results ready — ${d.petName}`,
        description: `${d.testPanel || 'Lab'} results for ${d.petName}${d.ownerName ? ` (owner: ${d.ownerName})` : ''} have been uploaded and are awaiting your review. File: ${d.fileName || 'N/A'}.`,
        time: formatRelativeTime(evt.timestamp),
        timeISO: evt.timestamp,
        read: false,
        petName: d.petName,
        ownerName: d.ownerName,
        actionLabel: 'View Lab Results',
        actionPath: '/lab',
        urgent: false,
      });
    } else if (evt.type === 'task_reminder') {
      // Only show reminder if the snooze time has arrived
      const reminderTime = new Date(evt.timestamp);
      if (reminderTime <= now) {
        notifications.push({
          id: evt.id,
          category: 'System',
          title: `Task reminder — ${d.taskType}`,
          description: `Reminder: "${d.taskType}" for ${d.petName}${d.ownerName ? ` (${d.ownerName})` : ''}${d.notes ? `. Notes: ${d.notes}` : ''}.${d.snoozedBy ? ` Snoozed by ${d.snoozedBy}.` : ''}`,
          time: formatRelativeTime(evt.timestamp),
          timeISO: evt.timestamp,
          read: false,
          petName: d.petName,
          ownerName: d.ownerName,
          actionLabel: 'View Tasks',
          actionPath: isAdmin ? '/admin/tasks' : '/tasks',
          urgent: false,
        });
      }
    }
  }
  }

  // Sort all notifications: unread first, then by date descending
  notifications.sort((a, b) => {
    if (a.read !== b.read) return a.read ? 1 : -1;
    return new Date(b.timeISO).getTime() - new Date(a.timeISO).getTime();
  });

  return notifications;
}

// ─── Component ───────────────────────────────────────────────

export default function NotificationsPage() {
  const db = useTenantDb();
  const { pathname } = useLocation();
  const { user } = useAuth();
  const isAdmin = pathname.startsWith('/admin');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const data = await fetchNotificationsFromSupabase(db, isAdmin, user?.id);
        if (cancelled) return;

        // Apply persisted read/dismissed state (do NOT auto-mark as read)
        const { organizationId } = await getOrgContext();
        const { data: stateRows } = await db.from('notification_state').select('notification_id, status').eq('organization_id', organizationId).eq('user_id', user?.id);
        const readSet = new Set<string>();
        const dismissedSet = new Set<string>();
        for (const row of (stateRows || [])) {
          if (row.status === 'read') readSet.add(row.notification_id);
          if (row.status === 'dismissed') dismissedSet.add(row.notification_id);
        }
        const afterPersist = data
          .filter(n => !dismissedSet.has(n.id))
          .map(n => readSet.has(n.id) ? { ...n, read: true } : n);

        if (!cancelled) {
          setNotifications(afterPersist);

          // Auto-mark all unread as read when the user visits the page (clears sidebar badge)
          const unreadIds = afterPersist.filter(n => !n.read).map(n => n.id);
          if (unreadIds.length > 0) {
            const readRows = unreadIds.map(id => ({ notification_id: id, status: 'read' as const, updated_at: new Date().toISOString(), organization_id: organizationId, user_id: user?.id }));
            db.from('notification_state').upsert(readRows).then(() => {
              // Also mark sidebar-generated IDs (completed appts, vax, etc.)
              const todayStr = `${new Date().getFullYear()}-${(new Date().getMonth() + 1).toString().padStart(2, '0')}-${new Date().getDate().toString().padStart(2, '0')}`;
              const weekAgoDate = new Date(Date.now() - 7 * 86400000);
              const weekAgoStr = `${weekAgoDate.getFullYear()}-${(weekAgoDate.getMonth() + 1).toString().padStart(2, '0')}-${weekAgoDate.getDate().toString().padStart(2, '0')}`;
              Promise.all([
                db.from('appointments').select('id').eq('organization_id', organizationId)
                  .gte('scheduled_at', `${todayStr}T00:00:00`).lte('scheduled_at', `${todayStr}T23:59:59`)
                  .in('status', ['Scheduled', 'Confirmed']),
                db.from('appointments').select('id').eq('organization_id', organizationId)
                  .gte('scheduled_at', `${weekAgoStr}T00:00:00`).eq('status', 'Completed'),
                db.from('appointments').select('id').eq('organization_id', organizationId)
                  .gte('scheduled_at', `${weekAgoStr}T00:00:00`).eq('status', 'Cancelled'),
                db.from('vaccinations').select('id, pets!inner(organization_id)')
                  .eq('pets.organization_id', organizationId).lte('next_due_date', todayStr),
                db.from('clients').select('id').eq('organization_id', organizationId)
                  .gte('created_at', `${weekAgoStr}T00:00:00`),
                db.from('notification_events').select('id').eq('organization_id', organizationId)
                  .gte('timestamp', weekAgoDate.toISOString()),
              ]).then(([apptToday, completed, cancelled, vacs, clients, notifEvts]) => {
                const extraIds: string[] = [];
                (apptToday.data || []).forEach(a => extraIds.push(`appt-today-${a.id}`));
                (completed.data || []).forEach(a => extraIds.push(`appt-done-${a.id}`));
                (cancelled.data || []).forEach(a => extraIds.push(`appt-cancel-${a.id}`));
                (vacs.data || []).forEach(v => extraIds.push(`vax-${v.id}`));
                (clients.data || []).forEach(c => extraIds.push(`client-${c.id}`));
                (notifEvts.data || []).forEach(e => extraIds.push(e.id));
                const allToMark = [...new Set([...unreadIds, ...extraIds])];
                const markRows = allToMark.map(id => ({ notification_id: id, status: 'read' as const, updated_at: new Date().toISOString(), organization_id: organizationId, user_id: user?.id }));
                if (markRows.length > 0) db.from('notification_state').upsert(markRows);
              });
            });
            // Update local state to show as read
            setNotifications(prev => prev.map(n => ({ ...n, read: true })));
          }
        }
      } catch {}
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  // Broadcast unread count so sidebar can pick it up
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('notifCountChanged', { detail: { count: unreadCount } }));
  }, [unreadCount]);

  const filtered = notifications.filter((n) => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'unread') return !n.read;
    return n.category === activeFilter;
  });

  const saveReadState = async (ids: string[]) => {
    try {
      if (!user?.id) return;
      const { organizationId } = await getOrgContext();
      const rows = ids.map(id => ({ notification_id: id, status: 'read', updated_at: new Date().toISOString(), organization_id: organizationId, user_id: user.id }));
      if (rows.length > 0) await db.from('notification_state').upsert(rows);
    } catch {}
  };
  const saveDismissedState = async (ids: string[]) => {
    try {
      if (!user?.id) return;
      const { organizationId } = await getOrgContext();
      const rows = ids.map(id => ({ notification_id: id, status: 'dismissed', updated_at: new Date().toISOString(), organization_id: organizationId, user_id: user.id }));
      if (rows.length > 0) await db.from('notification_state').upsert(rows);
    } catch {}
  };


  const markAsRead = (id: string) => {
    setNotifications((prev) => {
      const updated = prev.map((n) => n.id === id ? { ...n, read: true } : n);
      saveReadState(updated.filter(n => n.read).map(n => n.id));
      return updated;
    });
  };

  const markAllRead = async () => {
    setNotifications((prev) => {
      const updated = prev.map((n) => ({ ...n, read: true }));
      saveReadState(updated.map(n => n.id));
      return updated;
    });
    // Also mark sidebar-generated notification IDs so the badge clears
    try {
      const { organizationId } = await getOrgContext();
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
      const weekAgo = new Date(Date.now() - 7 * 86400000);
      const weekAgoStr = `${weekAgo.getFullYear()}-${(weekAgo.getMonth() + 1).toString().padStart(2, '0')}-${weekAgo.getDate().toString().padStart(2, '0')}`;
      const [apptToday, completed, cancelled, vacs, clients, notifEvts] = await Promise.all([
        db.from('appointments').select('id').eq('organization_id', organizationId)
          .gte('scheduled_at', `${todayStr}T00:00:00`).lte('scheduled_at', `${todayStr}T23:59:59`)
          .in('status', ['Scheduled', 'Confirmed']),
        db.from('appointments').select('id').eq('organization_id', organizationId)
          .gte('scheduled_at', `${weekAgoStr}T00:00:00`).eq('status', 'Completed'),
        db.from('appointments').select('id').eq('organization_id', organizationId)
          .gte('scheduled_at', `${weekAgoStr}T00:00:00`).eq('status', 'Cancelled'),
        db.from('vaccinations').select('id, pets!inner(organization_id)')
          .eq('pets.organization_id', organizationId)
          .lte('next_due_date', todayStr),
        db.from('clients').select('id').eq('organization_id', organizationId)
          .gte('created_at', `${weekAgoStr}T00:00:00`),
        db.from('notification_events').select('id').eq('organization_id', organizationId)
          .gte('timestamp', weekAgo.toISOString()),
      ]);
      const sidebarIds: string[] = [];
      (apptToday.data || []).forEach(a => sidebarIds.push(`appt-today-${a.id}`));
      (completed.data || []).forEach(a => sidebarIds.push(`appt-done-${a.id}`));
      (cancelled.data || []).forEach(a => sidebarIds.push(`appt-cancel-${a.id}`));
      (vacs.data || []).forEach(v => sidebarIds.push(`vax-${v.id}`));
      (clients.data || []).forEach(c => sidebarIds.push(`client-${c.id}`));
      (notifEvts.data || []).forEach(e => sidebarIds.push(e.id));
      if (sidebarIds.length > 0 && user?.id) {
        const { data: existing } = await db.from('notification_state')
          .select('notification_id').eq('organization_id', organizationId).eq('user_id', user.id)
          .in('notification_id', sidebarIds);
        const existingSet = new Set((existing || []).map(r => r.notification_id));
        const toMark = sidebarIds.filter(id => !existingSet.has(id));
        if (toMark.length > 0) await saveReadState(toMark);
      }
    } catch {}
    window.dispatchEvent(new CustomEvent('notifCountChanged', { detail: { count: 0 } }));
  };

  const dismiss = (id: string) => {
    setNotifications((prev) => {
      const updated = prev.filter((n) => n.id !== id);
      saveDismissedState([id]);
      return updated;
    });
    window.dispatchEvent(new Event('notifCountChanged'));
  };

  const dismissAll = async () => {
    const allIds = notifications.map(n => n.id);
    saveDismissedState(allIds);
    setNotifications([]);
    // Also dismiss all synthetic sidebar IDs so the badge clears
    try {
      const { organizationId } = await getOrgContext();
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
      const weekAgo = new Date(Date.now() - 7 * 86400000);
      const weekAgoStr = `${weekAgo.getFullYear()}-${(weekAgo.getMonth() + 1).toString().padStart(2, '0')}-${weekAgo.getDate().toString().padStart(2, '0')}`;
      const [apptToday, completed, cancelled, vacs, clients] = await Promise.all([
        db.from('appointments').select('id').eq('organization_id', organizationId)
          .gte('scheduled_at', `${todayStr}T00:00:00`).lte('scheduled_at', `${todayStr}T23:59:59`)
          .in('status', ['Scheduled', 'Confirmed']),
        db.from('appointments').select('id').eq('organization_id', organizationId)
          .gte('scheduled_at', `${weekAgoStr}T00:00:00`).eq('status', 'Completed'),
        db.from('appointments').select('id').eq('organization_id', organizationId)
          .gte('scheduled_at', `${weekAgoStr}T00:00:00`).eq('status', 'Cancelled'),
        db.from('vaccinations').select('id, pets!inner(organization_id)')
          .eq('pets.organization_id', organizationId).lte('next_due_date', todayStr),
        db.from('clients').select('id').eq('organization_id', organizationId)
          .gte('created_at', `${weekAgoStr}T00:00:00`),
      ]);
      const sidebarIds: string[] = [];
      (apptToday.data || []).forEach(a => sidebarIds.push(`appt-today-${a.id}`));
      (completed.data || []).forEach(a => sidebarIds.push(`appt-done-${a.id}`));
      (cancelled.data || []).forEach(a => sidebarIds.push(`appt-cancel-${a.id}`));
      (vacs.data || []).forEach(v => sidebarIds.push(`vax-${v.id}`));
      (clients.data || []).forEach(c => sidebarIds.push(`client-${c.id}`));
      if (sidebarIds.length > 0) await saveDismissedState(sidebarIds);
    } catch {}
    window.dispatchEvent(new CustomEvent('notifCountChanged', { detail: { count: 0 } }));
  };

  // ── Create Follow-up Task for front desk ──────────────────
  const [creatingTaskIds, setCreatingTaskIds] = useState<Set<string>>(new Set());
  const [createdTaskIds, setCreatedTaskIds] = useState<Set<string>>(new Set());
  const [taskToast, setTaskToast] = useState<string | null>(null);

  const handleCreateTask = async (notif: Notification) => {
    if (creatingTaskIds.has(notif.id) || createdTaskIds.has(notif.id)) return;
    setCreatingTaskIds((prev) => new Set(prev).add(notif.id));
    try {
      const { organizationId } = await getOrgContext();
      const todayStr = localDateString();
      const { error } = await db.from('tasks').insert({
        organization_id: organizationId,
        type: 'Follow-up Call',
        priority: 'High',
        status: 'Pending',
        due_date: todayStr,
        due_time: null,
        pet_id: notif.petId || null,
        client_id: notif.clientId || null,
        assigned_by_id: user?.id || null,
        visit_date: todayStr,
        doctor_notes: `Vaccine overdue for ${notif.petName || 'patient'}${notif.ownerName ? ` (owner: ${notif.ownerName})` : ''}. Contact owner to schedule vaccination appointment.`,
        tags: ['vaccine', 'overdue', 'auto-created'],
      });
      if (error) throw error;
      setCreatedTaskIds((prev) => new Set(prev).add(notif.id));
      setTaskToast(`Follow-up task created for ${notif.petName || 'patient'} — assigned to front desk.`);
      setTimeout(() => setTaskToast(null), 4000);
      // Mark the notification as read since action was taken
      markAsRead(notif.id);
    } catch (err) {
      console.error('Failed to create task:', err);
      setTaskToast('Failed to create task. Please try again.');
      setTimeout(() => setTaskToast(null), 4000);
    } finally {
      setCreatingTaskIds((prev) => {
        const next = new Set(prev);
        next.delete(notif.id);
        return next;
      });
    }
  };

  return (
    <div className="max-w-[1000px] mx-auto p-8">
      {/* Task creation toast */}
      {taskToast && (
        <div
          className="fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-3 shadow-lg animate-in slide-in-from-top-2 fade-in"
          style={{
            backgroundColor: taskToast.startsWith('Failed') ? '#d4183d' : 'var(--brand-green-text)',
            color: taskToast.startsWith('Failed') ? '#fff' : '#000',
            borderRadius: '12px',
            fontSize: '14px',
            fontWeight: 600,
            maxWidth: '440px',
            boxShadow: taskToast.startsWith('Failed')
              ? '0 4px 24px rgba(212,24,61,0.3)'
              : '0 4px 24px color-mix(in srgb, var(--brand-green-text) 40%, transparent)',
          }}
        >
          {taskToast.startsWith('Failed') ? (
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          ) : (
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          )}
          {taskToast}
        </div>
      )}

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
        {notifications.length > 0 && (
          unreadCount > 0 ? (
            <Button variant="outline" className="gap-2" onClick={markAllRead}>
              <CheckCheck className="w-4 h-4" />
              Mark all as read
            </Button>
          ) : (
            <Button variant="outline" className="gap-2 text-red-400 border-red-400/30 hover:bg-red-400/10" onClick={dismissAll}>
              <Trash2 className="w-4 h-4" />
              Delete all
            </Button>
          )
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
                color: isActive ? 'var(--on-brand-green)' : 'var(--text-secondary)',
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

      {/* Loading State */}
      {loading && (
        <div className="bg-[var(--surface-white)] border border-[var(--border-color)] p-12 text-center" style={{ borderRadius: '12px' }}>
          <div className="w-14 h-14 mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: 'var(--surface-elevated)', borderRadius: '9999px' }}>
            <Loader2 className="w-7 h-7 text-[var(--text-secondary)] animate-spin" />
          </div>
          <p className="text-[var(--text-primary)]" style={{ fontSize: '16px', fontWeight: 600 }}>Loading notifications...</p>
          <p className="text-[var(--text-secondary)] mt-1" style={{ fontSize: '14px' }}>
            Fetching latest updates from your clinic data.
          </p>
        </div>
      )}

      {/* Notifications List */}
      {!loading && (
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
                          {notif.actionType === 'create-task' && notif.actionLabel && (
                            createdTaskIds.has(notif.id) ? (
                              <span
                                className="inline-flex items-center gap-1.5 px-3 py-1.5"
                                style={{
                                  backgroundColor: 'color-mix(in srgb, var(--brand-green-text) 12%, transparent)',
                                  color: 'var(--brand-green-text)',
                                  borderRadius: '8px',
                                  fontSize: '13px',
                                  fontWeight: 600,
                                }}
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Task Created
                              </span>
                            ) : (
                              <button
                                onClick={() => handleCreateTask(notif)}
                                disabled={creatingTaskIds.has(notif.id)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 transition-colors"
                                style={{
                                  backgroundColor: '#F4A26118',
                                  color: '#F4A261',
                                  borderRadius: '8px',
                                  fontSize: '13px',
                                  fontWeight: 600,
                                  border: 'none',
                                  cursor: creatingTaskIds.has(notif.id) ? 'wait' : 'pointer',
                                  opacity: creatingTaskIds.has(notif.id) ? 0.6 : 1,
                                }}
                              >
                                {creatingTaskIds.has(notif.id) ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <ListTodo className="w-3.5 h-3.5" />
                                )}
                                {creatingTaskIds.has(notif.id) ? 'Creating...' : notif.actionLabel}
                              </button>
                            )
                          )}
                          {notif.actionType !== 'create-task' && notif.actionLabel && notif.actionPath && (
                            <a
                              href={notif.actionPath}
                              className="inline-flex items-center gap-1 px-3 py-1.5 transition-colors"
                              style={{
                                backgroundColor: 'color-mix(in srgb, var(--brand-green-text) 6%, transparent)',
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
      )}

      {/* Footer count */}
      {!loading && filtered.length > 0 && (
        <p className="text-center text-[var(--text-secondary)] mt-6" style={{ fontSize: '13px' }}>
          Showing {filtered.length} notification{filtered.length !== 1 ? 's' : ''}
          {activeFilter !== 'all' && ` · ${FILTER_TABS.find(t => t.value === activeFilter)?.label}`}
        </p>
      )}
    </div>
  );
}
