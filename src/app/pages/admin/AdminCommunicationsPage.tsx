import { useState } from 'react';
import {
  Search, Send, Paperclip, Plus, Star, StarOff, Inbox, MailOpen,
  Trash2, FileText, ChevronDown, Reply, ReplyAll, Forward,
  Phone, Mail, Copy, Check, AlertCircle, RefreshCw,
  Users, ExternalLink, MoreHorizontal, Archive,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { Avatar, AvatarFallback } from '../../components/ui/avatar';

// ─── Types ────────────────────────────────────────────────────

type MainTab = 'email' | 'contacts';
type EmailFolder = 'inbox' | 'sent' | 'drafts' | 'starred' | 'trash';

interface Email {
  id: number;
  folder: EmailFolder | 'inbox';
  from: string;
  fromEmail: string;
  fromInitials: string;
  fromColor: string;
  to: string;
  subject: string;
  preview: string;
  body: string;
  date: string;
  time: string;
  read: boolean;
  starred: boolean;
  hasAttachment?: boolean;
}

interface Contact {
  id: number;
  name: string;
  initials: string;
  color: string;
  email: string;
  phone: string;
  altPhone?: string;
  pet: string;
  species: string;
  role: string;
  lastContact: string;
  notes?: string;
}

// ─── Mock Data ────────────────────────────────────────────────

const CONTACTS: Contact[] = [
  { id: 1,  name: 'John Smith',      initials: 'JS', color: '#3B82F6', email: 'john.smith@email.com',      phone: '(555) 201-4432', pet: 'Max',      species: 'Dog',    role: 'Client',  lastContact: 'Mar 11, 2026', notes: 'Prefers morning appointments.' },
  { id: 2,  name: 'Emily Johnson',   initials: 'EJ', color: '#8B5CF6', email: 'emily.johnson@email.com',   phone: '(555) 334-8821', pet: 'Luna',     species: 'Cat',    role: 'Client',  lastContact: 'Mar 11, 2026', notes: 'Allergic to latex gloves — inform vet.' },
  { id: 3,  name: 'Michael Brown',   initials: 'MB', color: '#2D6A4F', email: 'michael.brown@email.com',   phone: '(555) 109-6654', altPhone: '(555) 109-7700', pet: 'Cooper',   species: 'Dog',    role: 'Client',  lastContact: 'Mar 9, 2026' },
  { id: 4,  name: 'Sarah Williams',  initials: 'SW', color: '#F4A261', email: 'sarah.williams@email.com',  phone: '(555) 882-3310', pet: 'Bella',    species: 'Dog',    role: 'Client',  lastContact: 'Mar 8, 2026' },
  { id: 5,  name: 'David Miller',    initials: 'DM', color: '#d4183d', email: 'david.miller@email.com',    phone: '(555) 774-5501', pet: 'Charlie',  species: 'Dog',    role: 'Client',  lastContact: 'Mar 7, 2026', notes: 'Emergency contact: Lisa Miller (555) 774-5502.' },
  { id: 6,  name: 'James Wilson',    initials: 'JW', color: '#0EA5E9', email: 'james.wilson@email.com',    phone: '(555) 443-9920', pet: 'Rocky',    species: 'Dog',    role: 'Client',  lastContact: 'Mar 7, 2026' },
  { id: 7,  name: 'Jessica Taylor',  initials: 'JT', color: '#10B981', email: 'jessica.taylor@email.com',  phone: '(555) 661-0034', pet: 'Milo',     species: 'Cat',    role: 'Client',  lastContact: 'Mar 6, 2026' },
  { id: 8,  name: 'Robert Anderson', initials: 'RA', color: '#6366F1', email: 'robert.anderson@email.com', phone: '(555) 228-7741', pet: 'Daisy',    species: 'Rabbit', role: 'Client',  lastContact: 'Mar 5, 2026' },
  { id: 9,  name: 'Dr. Sarah Chen',  initials: 'SC', color: '#2D6A4F', email: 'dr.chen@vettrack.clinic',   phone: '(555) 100-0001', altPhone: '(555) 100-0011', pet: '—', species: '—', role: 'Veterinarian', lastContact: 'Mar 11, 2026' },
  { id: 10, name: 'Dr. Raj Patel',   initials: 'RP', color: '#3B82F6', email: 'dr.patel@vettrack.clinic',  phone: '(555) 100-0002', pet: '—', species: '—', role: 'Veterinarian', lastContact: 'Mar 11, 2026' },
  { id: 11, name: 'Dr. Maria Garcia',initials: 'MG', color: '#8B5CF6', email: 'dr.garcia@vettrack.clinic', phone: '(555) 100-0003', pet: '—', species: '—', role: 'Veterinarian', lastContact: 'Mar 10, 2026' },
  { id: 12, name: 'Linda Park',      initials: 'LP', color: '#EC4899', email: 'linda.park@email.com',      phone: '(555) 556-2278', pet: 'Coco',     species: 'Bird',   role: 'Client',  lastContact: 'Mar 3, 2026' },
];

const EMAILS: Email[] = [
  { id: 1,  folder: 'inbox',   from: 'John Smith',      fromEmail: 'john.smith@email.com',      fromInitials: 'JS', fromColor: '#3B82F6', to: 'clinic@vettrack.com', subject: "Max's lab results & appointment reschedule", preview: "Hi, I wanted to check on Max's lab results from last week's checkup...", body: "Hi,\n\nI wanted to check on Max's lab results from last week's checkup. Are they ready? Also, something came up at work and I need to reschedule his Friday appointment if possible.\n\nCould we move it to Monday or Tuesday next week?\n\nThanks,\nJohn Smith", date: 'Mar 11', time: '9:42 AM', read: false, starred: true, hasAttachment: false },
  { id: 2,  folder: 'inbox',   from: 'Emily Johnson',   fromEmail: 'emily.johnson@email.com',   fromInitials: 'EJ', fromColor: '#8B5CF6', to: 'clinic@vettrack.com', subject: 'Luna sneezing — should I be concerned?', preview: 'Luna has been sneezing a lot lately, multiple times a day. Started about 3 days ago...', body: "Hello,\n\nLuna has been sneezing a lot lately — multiple times a day. It started about 3 days ago. She's still eating and drinking normally but the sneezing is quite frequent.\n\nShould I bring her in? Is this something I can monitor at home?\n\nBest,\nEmily Johnson", date: 'Mar 11', time: '8:15 AM', read: false, starred: true },
  { id: 3,  folder: 'inbox',   from: 'David Miller',    fromEmail: 'david.miller@email.com',    fromInitials: 'DM', fromColor: '#d4183d', to: 'clinic@vettrack.com', subject: 'URGENT: Charlie still limping after visit', preview: "He's still limping on his front right leg. It's been 5 days since the appointment...", body: "Hi,\n\nCharlie is still limping on his front right leg. It's been 5 days since our appointment and Dr. Garcia said it should improve within 48–72 hours.\n\nI'm getting very worried. Should I bring him back in? This seems to be getting worse, not better.\n\nPlease call me as soon as possible: (555) 774-5501.\n\nDavid Miller", date: 'Mar 10', time: '3:55 PM', read: false, starred: false },
  { id: 4,  folder: 'inbox',   from: 'Jessica Taylor',  fromEmail: 'jessica.taylor@email.com',  fromInitials: 'JT', fromColor: '#10B981', to: 'clinic@vettrack.com', subject: "Request for Milo's medical records", preview: "Hi, I'd like to request Milo's full medical records to share with a specialist...", body: "Hi there,\n\nI'd like to request Milo's complete medical records. I'm taking him to a specialist next week and they need his full history including vaccinations, bloodwork, and any diagnoses.\n\nCould you send them to jessica.taylor@email.com or provide a download link?\n\nThank you,\nJessica Taylor", date: 'Mar 9', time: '11:20 AM', read: true, starred: false },
  { id: 5,  folder: 'inbox',   from: 'Michael Brown',   fromEmail: 'michael.brown@email.com',   fromInitials: 'MB', fromColor: '#2D6A4F', to: 'clinic@vettrack.com', subject: "Cooper's dental appointment — date confirmation", preview: "When is Cooper's dental cleaning scheduled? I don't see it in my calendar...", body: "Hello,\n\nI booked a dental cleaning for Cooper last month but I can't find the confirmation email. Could you let me know the date and time?\n\nThanks,\nMichael Brown", date: 'Mar 9', time: '9:05 AM', read: true, starred: false },
  { id: 6,  folder: 'inbox',   from: 'Sarah Williams',  fromEmail: 'sarah.williams@email.com',  fromInitials: 'SW', fromColor: '#F4A261', to: 'clinic@vettrack.com', subject: 'Thank you for the wonderful care!', preview: 'Just wanted to say thank you for taking such good care of Bella during her surgery...', body: "Dear Team,\n\nI just wanted to write to say how grateful I am for the wonderful care Bella received during her spay surgery. Dr. Patel and the entire staff were so kind and professional.\n\nBella is recovering beautifully. Thank you so much!\n\nWith gratitude,\nSarah Williams", date: 'Mar 8', time: '2:30 PM', read: true, starred: false },
  { id: 7,  folder: 'sent',    from: 'VetTrack Clinic', fromEmail: 'clinic@vettrack.com',        fromInitials: 'VC', fromColor: '#2D6A4F', to: 'john.smith@email.com', subject: "Re: Max's lab results & appointment reschedule", preview: "Hi John! Yes, Max's lab results are back. All within normal ranges...", body: "Hi John!\n\nMax's lab results are back — his CBC and chemistry panel look great, all within normal ranges. Nothing to worry about.\n\nFor the reschedule, we have Monday March 18 at 10:00 AM or Tuesday March 19 at 2:00 PM available with Dr. Chen. Which works better for you?\n\nBest,\nVetTrack Clinic", date: 'Mar 11', time: '9:36 AM', read: true, starred: false },
  { id: 8,  folder: 'sent',    from: 'VetTrack Clinic', fromEmail: 'clinic@vettrack.com',        fromInitials: 'VC', fromColor: '#2D6A4F', to: 'all-clients@vettrack.com', subject: 'Spring Vaccine Reminder — Action Required', preview: "Dear valued clients, this is a reminder that spring vaccinations are now due...", body: "Dear valued clients,\n\nThis is a friendly reminder that spring vaccinations are now due for your pet. Staying up to date on vaccines is essential to keeping your furry family member healthy.\n\nPlease call us at (555) 100-0000 or book online to schedule your appointment.\n\nVetTrack Clinic", date: 'Mar 12', time: '10:00 AM', read: true, starred: false },
  { id: 9,  folder: 'drafts',  from: 'VetTrack Clinic', fromEmail: 'clinic@vettrack.com',        fromInitials: 'VC', fromColor: '#2D6A4F', to: 'david.miller@email.com', subject: "Re: URGENT: Charlie still limping after visit", preview: "Hi David, thank you for reaching out. We're sorry to hear Charlie...", body: "Hi David,\n\nThank you for reaching out. We're sorry to hear Charlie is still experiencing discomfort. Please bring him in today — we will fit you in as an urgent appointment.\n\nPlease call (555) 100-0000 when you arrive and we will see you immediately.\n\nDr. Garcia\nVetTrack Clinic", date: 'Mar 11', time: 'Draft', read: true, starred: false },
  { id: 10, folder: 'trash',   from: 'no-reply@labsystem.com', fromEmail: 'no-reply@labsystem.com', fromInitials: 'LS', fromColor: '#6B7280', to: 'clinic@vettrack.com', subject: 'Lab System Maintenance Notice', preview: 'Scheduled maintenance window: Sunday March 8, 2:00–4:00 AM...', body: "This is an automated notice.\n\nScheduled maintenance window: Sunday March 8, 2:00–4:00 AM EST.\n\nThe lab portal will be unavailable during this time.", date: 'Mar 7', time: '9:00 AM', read: true, starred: false },
];

const FOLDERS: { id: EmailFolder; label: string; icon: typeof Inbox; count?: number }[] = [
  { id: 'inbox',   label: 'Inbox',   icon: Inbox,    count: 3 },
  { id: 'sent',    label: 'Sent',    icon: Send },
  { id: 'drafts',  label: 'Drafts',  icon: FileText, count: 1 },
  { id: 'starred', label: 'Starred', icon: Star },
  { id: 'trash',   label: 'Trash',   icon: Trash2 },
];

// ─── Helpers ─────────────────────────────────────────────────

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
}

// ─── Page ─────────────────────────────────────────────────────

export default function AdminCommunicationsPage() {
  const [mainTab, setMainTab] = useState<MainTab>('email');
  const [folder, setFolder] = useState<EmailFolder>('inbox');
  const [selectedEmailId, setSelectedEmailId] = useState<number | null>(1);
  const [emailSearch, setEmailSearch] = useState('');
  const [contactSearch, setContactSearch] = useState('');
  const [selectedContactId, setSelectedContactId] = useState<number | null>(1);
  const [replyText, setReplyText] = useState('');
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeTo, setComposeTo] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [emails, setEmails] = useState<Email[]>(EMAILS);
  const [copiedPhone, setCopiedPhone] = useState<string | null>(null);
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);
  const [integration, setIntegration] = useState<'none' | 'gmail' | 'outlook'>('gmail');
  const [contactFilter, setContactFilter] = useState<'all' | 'clients' | 'vets'>('all');

  const selectedEmail = emails.find(e => e.id === selectedEmailId) ?? null;
  const selectedContact = CONTACTS.find(c => c.id === selectedContactId) ?? null;

  const folderEmails = emails.filter(e => {
    if (folder === 'starred') return e.starred;
    return e.folder === folder;
  });

  const filteredEmails = folderEmails.filter(e => {
    if (!emailSearch) return true;
    const q = emailSearch.toLowerCase();
    return e.from.toLowerCase().includes(q) || e.subject.toLowerCase().includes(q) || e.preview.toLowerCase().includes(q);
  });

  const filteredContacts = CONTACTS.filter(c => {
    const q = contactSearch.toLowerCase();
    const matchQ = !q || c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || c.phone.includes(q) || c.pet.toLowerCase().includes(q);
    const matchFilter =
      contactFilter === 'all' ? true :
      contactFilter === 'clients' ? c.role === 'Client' :
      c.role === 'Veterinarian';
    return matchQ && matchFilter;
  });

  const unreadCount = emails.filter(e => e.folder === 'inbox' && !e.read).length;

  const toggleStar = (id: number) => {
    setEmails(prev => prev.map(e => e.id === id ? { ...e, starred: !e.starred } : e));
  };

  const markRead = (id: number) => {
    setEmails(prev => prev.map(e => e.id === id ? { ...e, read: true } : e));
  };

  const deleteEmail = (id: number) => {
    setEmails(prev => prev.map(e => e.id === id ? { ...e, folder: 'trash' } : e));
    if (selectedEmailId === id) setSelectedEmailId(null);
  };

  const archiveEmail = (id: number) => {
    setEmails(prev => prev.filter(e => e.id !== id));
    if (selectedEmailId === id) setSelectedEmailId(null);
  };

  const handleSelectEmail = (id: number) => {
    setSelectedEmailId(id);
    markRead(id);
  };

  const copyToClipboard = (text: string, type: 'phone' | 'email') => {
    navigator.clipboard.writeText(text).catch(() => {});
    if (type === 'phone') { setCopiedPhone(text); setTimeout(() => setCopiedPhone(null), 2000); }
    else { setCopiedEmail(text); setTimeout(() => setCopiedEmail(null), 2000); }
  };

  const handleReply = () => {
    if (!replyText.trim()) return;
    setReplyText('');
  };

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* ─── Header ───────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[var(--text-primary)]" style={{ fontSize: '32px', fontWeight: 700 }}>Communications</h1>
          <p className="text-[var(--text-secondary)] mt-1" style={{ fontSize: '16px' }}>
            Email, contacts, and client outreach in one place.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Integration status */}
          <div className="flex items-center gap-2 px-4 py-2 border border-[var(--border-color)] bg-[var(--surface-white)]" style={{ borderRadius: '10px' }}>
            {integration === 'gmail' && (
              <>
                <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'linear-gradient(135deg, #EA4335 25%, #FBBC05 50%, #34A853 75%, #4285F4 100%)', flexShrink: 0 }} />
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Gmail</span>
                <span style={{ fontSize: '12px', color: '#2D6A4F', fontWeight: 600, backgroundColor: '#2D6A4F15', padding: '2px 7px', borderRadius: '9999px' }}>Connected</span>
              </>
            )}
            {integration === 'outlook' && (
              <>
                <div style={{ width: 18, height: 18, borderRadius: 4, background: '#0078D4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ color: '#fff', fontSize: '10px', fontWeight: 900 }}>O</span>
                </div>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Outlook</span>
                <span style={{ fontSize: '12px', color: '#2D6A4F', fontWeight: 600, backgroundColor: '#2D6A4F15', padding: '2px 7px', borderRadius: '9999px' }}>Connected</span>
              </>
            )}
            {integration === 'none' && (
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>No email connected</span>
            )}
          </div>
          <Button variant="outline" style={{ gap: 6 }}>
            <RefreshCw style={{ width: 14, height: 14 }} /> Sync
          </Button>
          <Button onClick={() => setComposeOpen(true)} style={{ backgroundColor: '#2D6A4F', color: '#fff', gap: 6 }}>
            <Plus style={{ width: 14, height: 14 }} /> Compose
          </Button>
        </div>
      </div>

      {/* ─── Integration Connect Bar (if not connected) ─── */}
      {integration === 'none' && (
        <div className="border border-[var(--border-color)] bg-[var(--surface-white)] p-4 flex items-center justify-between" style={{ borderRadius: '12px' }}>
          <div className="flex items-center gap-3">
            <AlertCircle style={{ width: 18, height: 18, color: '#F4A261' }} />
            <div>
              <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>Connect your email to get started</p>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Sync your inbox directly from Gmail or Outlook</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setIntegration('gmail')} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 9, border: '1px solid var(--border-color)', background: 'var(--surface-elevated)', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
              <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'linear-gradient(135deg, #EA4335 25%, #FBBC05 50%, #34A853 75%, #4285F4 100%)' }} />
              Connect Gmail
            </button>
            <button onClick={() => setIntegration('outlook')} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 9, border: '1px solid var(--border-color)', background: 'var(--surface-elevated)', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
              <div style={{ width: 18, height: 18, borderRadius: 4, background: '#0078D4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ color: '#fff', fontSize: 10, fontWeight: 900 }}>O</span>
              </div>
              Connect Outlook
            </button>
          </div>
        </div>
      )}

      {/* ─── Main Tabs ────────────────────────────────── */}
      <div className="flex gap-1 p-1 bg-[var(--surface-elevated)] self-start" style={{ borderRadius: '10px' }}>
        {([
          { id: 'email' as const,    label: 'Email',    icon: Mail,  badge: unreadCount },
          { id: 'contacts' as const, label: 'Contacts', icon: Users },
        ]).map(tab => {
          const active = mainTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setMainTab(tab.id)}
              style={{
                padding: '8px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                fontSize: '14px', fontWeight: active ? 700 : 500,
                backgroundColor: active ? 'var(--surface-white)' : 'transparent',
                color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                boxShadow: active ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                display: 'flex', alignItems: 'center', gap: 7,
                transition: 'all 0.15s',
              }}
            >
              <Icon style={{ width: 15, height: 15 }} />
              {tab.label}
              {tab.badge ? (
                <span style={{ minWidth: 18, height: 18, borderRadius: 9999, backgroundColor: '#d4183d', color: '#fff', fontSize: 10, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>
                  {tab.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* ══════════════════════════════════════════════ */}
      {/*                 EMAIL VIEW                    */}
      {/* ══════════════════════════════════════════════ */}
      {mainTab === 'email' && (
        <div className="border border-[var(--border-color)] bg-[var(--surface-white)]" style={{ borderRadius: '14px', overflow: 'hidden', display: 'flex', height: 'calc(100vh - 100px)', minHeight: 680 }}>

          {/* ── Left: Folder Sidebar ── */}
          <div style={{ width: 200, flexShrink: 0, borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', padding: '16px 10px', gap: 2 }}>
            {FOLDERS.map(f => {
              const Icon = f.icon;
              const active = folder === f.id;
              const cnt = f.id === 'inbox' ? emails.filter(e => e.folder === 'inbox' && !e.read).length
                        : f.id === 'drafts' ? emails.filter(e => e.folder === 'drafts').length
                        : f.id === 'starred' ? emails.filter(e => e.starred).length
                        : 0;
              return (
                <button
                  key={f.id}
                  onClick={() => { setFolder(f.id); setSelectedEmailId(null); }}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '9px 12px', borderRadius: 9, border: 'none', cursor: 'pointer',
                    backgroundColor: active ? '#2D6A4F12' : 'transparent',
                    color: active ? 'var(--brand-green-text)' : 'var(--text-secondary)',
                    fontWeight: active ? 700 : 500, fontSize: 14,
                    transition: 'all 0.12s',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <Icon style={{ width: 15, height: 15, flexShrink: 0 }} />
                    {f.label}
                  </span>
                  {cnt > 0 && (
                    <span style={{ minWidth: 18, height: 18, borderRadius: 9999, backgroundColor: active ? '#2D6A4F' : '#6B7280', color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>
                      {cnt}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* ── Middle: Email List ── */}
          <div style={{ width: 320, flexShrink: 0, borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
            {/* Search */}
            <div style={{ padding: '12px 12px 10px', borderBottom: '1px solid var(--border-color)' }}>
              <div style={{ position: 'relative' }}>
                <Search style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: 'var(--text-secondary)' }} />
                <input
                  type="text"
                  placeholder="Search emails…"
                  value={emailSearch}
                  onChange={e => setEmailSearch(e.target.value)}
                  style={{ width: '100%', padding: '7px 10px 7px 30px', backgroundColor: 'var(--surface-elevated)', border: '1px solid var(--border-color)', borderRadius: 8, fontSize: 13, color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            {/* Email rows */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {filteredEmails.length === 0 ? (
                <div style={{ padding: 32, textAlign: 'center' }}>
                  <MailOpen style={{ width: 32, height: 32, color: 'var(--border-color)', margin: '0 auto 8px' }} />
                  <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>No emails found</p>
                </div>
              ) : filteredEmails.map(email => (
                <button
                  key={email.id}
                  onClick={() => handleSelectEmail(email.id)}
                  style={{
                    width: '100%', textAlign: 'left', padding: '12px 14px',
                    borderBottom: '1px solid var(--border-color)',
                    backgroundColor: selectedEmailId === email.id ? '#2D6A4F08' : 'transparent',
                    borderLeft: `3px solid ${selectedEmailId === email.id ? '#2D6A4F' : 'transparent'}`,
                    border: 'none', cursor: 'pointer', display: 'block',
                    transition: 'background-color 0.1s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    {/* Unread dot */}
                    <div style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: email.read ? 'transparent' : '#3B82F6', flexShrink: 0, marginTop: 6 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                        <span style={{ fontSize: 13, fontWeight: email.read ? 500 : 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, marginRight: 6 }}>
                          {email.folder === 'sent' || email.folder === 'drafts' ? `To: ${email.to.replace('@vettrack.com','').replace('@email.com','').replace('all-clients','All Clients')}` : email.from}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--text-secondary)', flexShrink: 0 }}>{email.date}</span>
                      </div>
                      <p style={{ fontSize: 12, fontWeight: email.read ? 400 : 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 2 }}>
                        {email.subject}
                      </p>
                      <p style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {email.preview}
                      </p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                        {email.starred && <Star style={{ width: 11, height: 11, color: '#F4A261', fill: '#F4A261' }} />}
                        {email.hasAttachment && <Paperclip style={{ width: 11, height: 11, color: 'var(--text-secondary)' }} />}
                        {email.folder === 'drafts' && <span style={{ fontSize: 10, color: '#F4A261', fontWeight: 700, backgroundColor: '#F4A26115', padding: '1px 5px', borderRadius: 4 }}>DRAFT</span>}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* ── Right: Email Detail ── */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            {!selectedEmail ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                <MailOpen style={{ width: 48, height: 48, color: 'var(--border-color)' }} />
                <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>Select an email to read</p>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{filteredEmails.length} email{filteredEmails.length !== 1 ? 's' : ''} in {folder}</p>
              </div>
            ) : (
              <>
                {/* Email header toolbar */}
                <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button onClick={() => toggleStar(selectedEmail.id)} style={{ width: 30, height: 30, borderRadius: 7, border: '1px solid var(--border-color)', backgroundColor: 'var(--surface-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                      {selectedEmail.starred
                        ? <Star style={{ width: 14, height: 14, color: '#F4A261', fill: '#F4A261' }} />
                        : <StarOff style={{ width: 14, height: 14, color: 'var(--text-secondary)' }} />}
                    </button>
                    <button onClick={() => archiveEmail(selectedEmail.id)} style={{ width: 30, height: 30, borderRadius: 7, border: '1px solid var(--border-color)', backgroundColor: 'var(--surface-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                      <Archive style={{ width: 14, height: 14 }} />
                    </button>
                    <button onClick={() => deleteEmail(selectedEmail.id)} style={{ width: 30, height: 30, borderRadius: 7, border: '1px solid var(--border-color)', backgroundColor: 'var(--surface-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                      <Trash2 style={{ width: 14, height: 14 }} />
                    </button>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border-color)', backgroundColor: 'var(--surface-elevated)', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                      <Reply style={{ width: 13, height: 13 }} /> Reply
                    </button>
                    <button style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border-color)', backgroundColor: 'var(--surface-elevated)', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                      <Forward style={{ width: 13, height: 13 }} /> Forward
                    </button>
                    <button style={{ width: 30, height: 30, borderRadius: 7, border: '1px solid var(--border-color)', backgroundColor: 'var(--surface-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                      <MoreHorizontal style={{ width: 14, height: 14 }} />
                    </button>
                  </div>
                </div>

                {/* Email body */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
                  <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16, lineHeight: 1.3 }}>{selectedEmail.subject}</h2>

                  {/* Sender info */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, padding: '12px 16px', backgroundColor: 'var(--surface-elevated)', borderRadius: 10 }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', backgroundColor: `${selectedEmail.fromColor}20`, border: `2px solid ${selectedEmail.fromColor}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: selectedEmail.fromColor, flexShrink: 0 }}>
                      {selectedEmail.fromInitials}
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>{selectedEmail.from}</p>
                      <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>From: </span>{selectedEmail.fromEmail}
                        <span style={{ margin: '0 6px', color: 'var(--border-color)' }}>·</span>
                        <span style={{ color: 'var(--text-secondary)' }}>To: </span>{selectedEmail.to}
                      </p>
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)', flexShrink: 0 }}>{selectedEmail.date} at {selectedEmail.time}</span>
                  </div>

                  {/* Body */}
                  <div style={{ fontSize: 15, color: 'var(--text-primary)', lineHeight: 1.7, whiteSpace: 'pre-line' }}>
                    {selectedEmail.body}
                  </div>
                </div>

                {/* Reply area */}
                {selectedEmail.folder !== 'trash' && (
                  <div style={{ borderTop: '1px solid var(--border-color)', padding: '14px 20px', flexShrink: 0 }}>
                    <div style={{ border: '1px solid var(--border-color)', borderRadius: 10, overflow: 'hidden', backgroundColor: 'var(--surface-elevated)' }}>
                      <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Reply style={{ width: 13, height: 13, color: 'var(--text-secondary)' }} />
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Reply to <strong style={{ color: 'var(--text-primary)' }}>{selectedEmail.folder === 'sent' || selectedEmail.folder === 'drafts' ? selectedEmail.to : selectedEmail.fromEmail}</strong></span>
                      </div>
                      <textarea
                        value={replyText}
                        onChange={e => setReplyText(e.target.value)}
                        placeholder="Write a reply…"
                        rows={3}
                        style={{ width: '100%', padding: '10px 14px', resize: 'none', backgroundColor: 'transparent', border: 'none', fontSize: 14, color: 'var(--text-primary)', outline: 'none', fontFamily: 'inherit', lineHeight: 1.5, boxSizing: 'border-box' }}
                      />
                      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '8px 12px', gap: 8, borderTop: '1px solid var(--border-color)' }}>
                        <button style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, border: '1px solid var(--border-color)', backgroundColor: 'var(--surface-white)', cursor: 'pointer', fontSize: 13, color: 'var(--text-secondary)' }}>
                          <Paperclip style={{ width: 13, height: 13 }} /> Attach
                        </button>
                        <button onClick={handleReply} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: 8, border: 'none', backgroundColor: '#2D6A4F', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#fff' }}>
                          <Send style={{ width: 13, height: 13 }} /> Send Reply
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════ */}
      {/*               CONTACTS VIEW                   */}
      {/* ══════════════════════════════════════════════ */}
      {mainTab === 'contacts' && (
        <div className="border border-[var(--border-color)] bg-[var(--surface-white)]" style={{ borderRadius: '14px', overflow: 'hidden', display: 'flex', height: 'calc(100vh - 100px)', minHeight: 680 }}>

          {/* ── Left: Contact List ── */}
          <div style={{ width: 320, flexShrink: 0, borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
            {/* Search + filter */}
            <div style={{ padding: '12px 12px 10px', borderBottom: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ position: 'relative' }}>
                <Search style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: 'var(--text-secondary)' }} />
                <input
                  type="text"
                  placeholder="Search name, email, phone, pet…"
                  value={contactSearch}
                  onChange={e => setContactSearch(e.target.value)}
                  style={{ width: '100%', padding: '7px 10px 7px 30px', backgroundColor: 'var(--surface-elevated)', border: '1px solid var(--border-color)', borderRadius: 8, fontSize: 13, color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ display: 'flex', gap: 4, backgroundColor: 'var(--surface-elevated)', borderRadius: 8, padding: 3 }}>
                {(['all', 'clients', 'vets'] as const).map(f => (
                  <button key={f} onClick={() => setContactFilter(f)} style={{ flex: 1, padding: '5px 4px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: contactFilter === f ? 700 : 500, backgroundColor: contactFilter === f ? 'var(--surface-white)' : 'transparent', color: contactFilter === f ? 'var(--text-primary)' : 'var(--text-secondary)', boxShadow: contactFilter === f ? '0 1px 2px rgba(0,0,0,0.06)' : 'none', transition: 'all 0.12s', textTransform: 'capitalize' }}>
                    {f === 'vets' ? 'Vets' : f === 'clients' ? 'Clients' : 'All'}
                  </button>
                ))}
              </div>
            </div>

            {/* Contact rows */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <div style={{ padding: '8px 12px 4px', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {filteredContacts.length} contact{filteredContacts.length !== 1 ? 's' : ''}
              </div>
              {filteredContacts.map(contact => (
                <button
                  key={contact.id}
                  onClick={() => setSelectedContactId(contact.id)}
                  style={{
                    width: '100%', textAlign: 'left', padding: '10px 14px',
                    borderBottom: '1px solid var(--border-color)',
                    backgroundColor: selectedContactId === contact.id ? '#2D6A4F08' : 'transparent',
                    borderLeft: `3px solid ${selectedContactId === contact.id ? '#2D6A4F' : 'transparent'}`,
                    border: 'none', cursor: 'pointer', display: 'flex', gap: 10, alignItems: 'center',
                    transition: 'background-color 0.1s',
                  }}
                >
                  <div style={{ width: 36, height: 36, borderRadius: '50%', backgroundColor: `${contact.color}20`, border: `2px solid ${contact.color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: contact.color, flexShrink: 0 }}>
                    {contact.initials}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>{contact.name}</p>
                    <p style={{ fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {contact.phone}
                    </p>
                    <p style={{ fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {contact.email}
                    </p>
                  </div>
                  {contact.role === 'Veterinarian' && (
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#2D6A4F', backgroundColor: '#2D6A4F15', padding: '2px 6px', borderRadius: 4, flexShrink: 0 }}>VET</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* ── Right: Contact Detail ── */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflowY: 'auto' }}>
            {!selectedContact ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                <Users style={{ width: 48, height: 48, color: 'var(--border-color)' }} />
                <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>Select a contact</p>
              </div>
            ) : (
              <div style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 20 }}>

                {/* Contact header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ width: 64, height: 64, borderRadius: '50%', backgroundColor: `${selectedContact.color}20`, border: `3px solid ${selectedContact.color}50`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, color: selectedContact.color, flexShrink: 0 }}>
                    {selectedContact.initials}
                  </div>
                  <div style={{ flex: 1 }}>
                    <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>{selectedContact.name}</h2>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: selectedContact.role === 'Veterinarian' ? '#2D6A4F' : '#3B82F6', backgroundColor: selectedContact.role === 'Veterinarian' ? '#2D6A4F15' : '#3B82F615', padding: '3px 8px', borderRadius: 6 }}>
                        {selectedContact.role}
                      </span>
                      {selectedContact.pet !== '—' && (
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                          🐾 {selectedContact.pet} · {selectedContact.species}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => {
                        setMainTab('email');
                        setComposeOpen(true);
                        setComposeTo(selectedContact.email);
                      }}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 9, border: 'none', backgroundColor: '#2D6A4F', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#fff' }}
                    >
                      <Mail style={{ width: 13, height: 13 }} /> Send Email
                    </button>
                  </div>
                </div>

                {/* Contact info cards */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

                  {/* Phone */}
                  <div style={{ padding: '16px 18px', border: '1px solid var(--border-color)', borderRadius: 12, backgroundColor: 'var(--surface-elevated)' }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Phone</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Phone style={{ width: 14, height: 14, color: 'var(--brand-green-text)', flexShrink: 0 }} />
                          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{selectedContact.phone}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <a href={`tel:${selectedContact.phone}`} style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid var(--border-color)', backgroundColor: 'var(--surface-white)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#2D6A4F', textDecoration: 'none' }}>
                            <Phone style={{ width: 13, height: 13 }} />
                          </a>
                          <button onClick={() => copyToClipboard(selectedContact.phone, 'phone')} style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid var(--border-color)', backgroundColor: 'var(--surface-white)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                            {copiedPhone === selectedContact.phone ? <Check style={{ width: 13, height: 13, color: '#2D6A4F' }} /> : <Copy style={{ width: 13, height: 13 }} />}
                          </button>
                        </div>
                      </div>
                      {selectedContact.altPhone && (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Phone style={{ width: 14, height: 14, color: 'var(--text-secondary)', flexShrink: 0 }} />
                            <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{selectedContact.altPhone}</span>
                          </div>
                          <button onClick={() => copyToClipboard(selectedContact.altPhone!, 'phone')} style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid var(--border-color)', backgroundColor: 'var(--surface-white)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                            {copiedPhone === selectedContact.altPhone ? <Check style={{ width: 13, height: 13, color: '#2D6A4F' }} /> : <Copy style={{ width: 13, height: 13 }} />}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Email */}
                  <div style={{ padding: '16px 18px', border: '1px solid var(--border-color)', borderRadius: 12, backgroundColor: 'var(--surface-elevated)' }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Email</p>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                        <Mail style={{ width: 14, height: 14, color: '#3B82F6', flexShrink: 0 }} />
                        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selectedContact.email}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0, marginLeft: 8 }}>
                        <button
                          onClick={() => { setMainTab('email'); setComposeOpen(true); setComposeTo(selectedContact.email); }}
                          style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid var(--border-color)', backgroundColor: 'var(--surface-white)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#3B82F6' }}
                        >
                          <Mail style={{ width: 13, height: 13 }} />
                        </button>
                        <button onClick={() => copyToClipboard(selectedContact.email, 'email')} style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid var(--border-color)', backgroundColor: 'var(--surface-white)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                          {copiedEmail === selectedContact.email ? <Check style={{ width: 13, height: 13, color: '#2D6A4F' }} /> : <Copy style={{ width: 13, height: 13 }} />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Activity + Notes */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div style={{ padding: '16px 18px', border: '1px solid var(--border-color)', borderRadius: 12, backgroundColor: 'var(--surface-elevated)' }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Last Contact</p>
                    <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{selectedContact.lastContact}</p>
                  </div>
                  {selectedContact.notes && (
                    <div style={{ padding: '16px 18px', border: '1px solid #F4A26140', borderRadius: 12, backgroundColor: '#F4A26108' }}>
                      <p style={{ fontSize: 11, fontWeight: 700, color: '#F4A261', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>⚠ Notes</p>
                      <p style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5 }}>{selectedContact.notes}</p>
                    </div>
                  )}
                </div>

                {/* Quick compose */}
                <div style={{ border: '1px solid var(--border-color)', borderRadius: 12, overflow: 'hidden' }}>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--surface-elevated)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Mail style={{ width: 13, height: 13, color: 'var(--text-secondary)' }} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Quick email to <strong style={{ color: 'var(--text-primary)' }}>{selectedContact.name}</strong></span>
                  </div>
                  <div style={{ padding: '0 14px', borderBottom: '1px solid var(--border-color)' }}>
                    <input
                      placeholder="Subject…"
                      style={{ width: '100%', padding: '10px 0', backgroundColor: 'transparent', border: 'none', fontSize: 14, color: 'var(--text-primary)', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
                    />
                  </div>
                  <textarea
                    placeholder="Write a message…"
                    rows={3}
                    style={{ width: '100%', padding: '10px 14px', resize: 'none', backgroundColor: 'transparent', border: 'none', fontSize: 14, color: 'var(--text-primary)', outline: 'none', fontFamily: 'inherit', lineHeight: 1.5, boxSizing: 'border-box' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '8px 14px', borderTop: '1px solid var(--border-color)', backgroundColor: 'var(--surface-elevated)' }}>
                    <button style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: 8, border: 'none', backgroundColor: '#2D6A4F', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#fff' }}>
                      <Send style={{ width: 13, height: 13 }} /> Send
                    </button>
                  </div>
                </div>

              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Compose Modal ────────────────────────────── */}
      {composeOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 300, display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end', padding: 24 }}>
          <div style={{ width: 520, borderRadius: 14, overflow: 'hidden', backgroundColor: 'var(--surface-white)', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <div style={{ background: '#2D6A4F', padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Mail style={{ width: 14, height: 14, color: '#fff' }} />
                </div>
                <span style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>New Message</span>
              </div>
              <button onClick={() => setComposeOpen(false)} style={{ width: 24, height: 24, borderRadius: 6, border: 'none', backgroundColor: 'rgba(255,255,255,0.15)', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700 }}>×</button>
            </div>
            {/* Fields */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid var(--border-color)', gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', width: 42, flexShrink: 0 }}>To</span>
                <input value={composeTo} onChange={e => setComposeTo(e.target.value)} placeholder="recipient@email.com" style={{ flex: 1, border: 'none', backgroundColor: 'transparent', fontSize: 14, color: 'var(--text-primary)', outline: 'none', fontFamily: 'inherit' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid var(--border-color)', gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', width: 42, flexShrink: 0 }}>Subject</span>
                <input value={composeSubject} onChange={e => setComposeSubject(e.target.value)} placeholder="Subject" style={{ flex: 1, border: 'none', backgroundColor: 'transparent', fontSize: 14, color: 'var(--text-primary)', outline: 'none', fontFamily: 'inherit' }} />
              </div>
              <textarea
                value={composeBody}
                onChange={e => setComposeBody(e.target.value)}
                placeholder="Write your message…"
                rows={7}
                style={{ padding: '14px 16px', resize: 'none', border: 'none', fontSize: 14, color: 'var(--text-primary)', outline: 'none', fontFamily: 'inherit', lineHeight: 1.6, backgroundColor: 'transparent' }}
              />
            </div>
            {/* Footer */}
            <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--surface-elevated)' }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <button style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border-color)', backgroundColor: 'var(--surface-white)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                  <Paperclip style={{ width: 14, height: 14 }} />
                </button>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setComposeOpen(false)} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid var(--border-color)', backgroundColor: 'var(--surface-white)', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Discard
                </button>
                <button onClick={() => setComposeOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 18px', borderRadius: 8, border: 'none', backgroundColor: '#2D6A4F', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#fff' }}>
                  <Send style={{ width: 13, height: 13 }} /> Send
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
