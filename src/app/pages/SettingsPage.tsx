import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  User, Building2, Bell, Palette, Shield, CreditCard,
  Camera, Save, Eye, EyeOff, Trash2, LogOut,
  CheckCircle2, AlertTriangle, Info, ChevronRight,
  Monitor, Moon, Sun, Globe, Clock, Calendar,
  Smartphone, Mail, MessageSquare, Lock, Key,
  ChevronsUpDown, Check, Plug, RefreshCw, ExternalLink,
  Copy, RotateCcw, Webhook, Zap, FlaskConical,
  Leaf, Sunrise,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { hashSessionToken } from '../../lib/hashToken';
import { useTheme as useThemeHook, LIGHT_THEMES, DARK_THEMES, type ThemeStyle } from '../hooks/useTheme';
import { updateProfile, uploadAvatar, removeAvatar } from '../hooks/useProfile';
import { getOrgContext } from '../hooks/useOrgContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';

import { Switch } from '../components/ui/switch';
import { Separator } from '../components/ui/separator';
import { Badge } from '../components/ui/badge';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '../components/ui/select';
import { Avatar, AvatarImage, AvatarFallback } from '../components/ui/avatar';

// ─── Types ────────────────────────────────────────────────────────────────────

type SettingsSection =
  | 'profile'
  | 'clinic'
  | 'notifications'
  | 'appearance'
  | 'security'
  | 'session'
  | 'billing'
  | 'integrations';

interface NavItem {
  id: SettingsSection;
  label: string;
  icon: React.ElementType;
  badge?: string;
}

// ─── Nav items ────────────────────────────────────────────────────────────────

const NAV_ITEMS: NavItem[] = [
  { id: 'profile',       label: 'Profile',       icon: User },
  { id: 'notifications', label: 'Notifications',  icon: Bell },
  { id: 'appearance',    label: 'Appearance',     icon: Palette },
  { id: 'security',      label: 'Security',       icon: Shield },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Map frontend notification keys to DB column names
const NOTIF_DB_MAP: Record<string, string> = {
  apptNew: 'appt_new', apptCancel: 'appt_cancel', apptReminder: 'appt_reminder', apptReschedule: 'appt_reschedule',
  labReady: 'lab_ready', labCritical: 'lab_critical',
  invoiceGen: 'invoice_gen', paymentRecv: 'payment_recv', planExpiry: 'plan_expiry',
  systemUpdates: 'system_updates',
};

function SectionCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`bg-[var(--surface-white)] border border-[var(--border-color)] p-6 ${className}`}
      style={{ borderRadius: '12px' }}
    >
      {children}
    </div>
  );
}

function FieldRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[200px_1fr] gap-6 items-start py-5 border-b border-[var(--border-color)] last:border-0">
      <div>
        <p className="text-[var(--text-primary)]" style={{ fontSize: '14px', fontWeight: 600 }}>
          {label}
        </p>
        {hint && (
          <p className="text-[var(--text-secondary)] mt-0.5" style={{ fontSize: '12px' }}>
            {hint}
          </p>
        )}
      </div>
      <div>{children}</div>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-4 border-b border-[var(--border-color)] last:border-0">
      <div className="pr-6">
        <p className="text-[var(--text-primary)]" style={{ fontSize: '14px', fontWeight: 600 }}>
          {label}
        </p>
        <p className="text-[var(--text-secondary)] mt-0.5" style={{ fontSize: '13px' }}>
          {description}
        </p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function SaveBar({ onSave, saved }: { onSave: () => void; saved: boolean }) {
  return (
    <div className="flex items-center justify-end gap-3 pt-4">
      {saved && (
        <span className="flex items-center gap-1.5 text-[var(--brand-green-text)]" style={{ fontSize: '14px' }}>
          <CheckCircle2 className="w-4 h-4" />
          Saved successfully
        </span>
      )}
      <Button variant="outline" size="sm">Discard</Button>
      <Button size="sm" onClick={onSave}>
        <Save className="w-4 h-4" />
        Save changes
      </Button>
    </div>
  );
}

// ─── Integration data ─────────────────────────────────────────────────────────

type IntegrationStatus = 'connected' | 'error' | 'available';

interface Integration {
  id: string;
  name: string;
  description: string;
  category: string;
  status: IntegrationStatus;
  lastSync?: string;
  iconBg: string;
  iconText: string;
  iconColor: string;
  docsUrl?: string;
}

const ALL_INTEGRATIONS: Integration[] = [
  // Lab
  {
    id: 'idexx',
    name: 'IDEXX Laboratories',
    description: 'Import CBC, chemistry, urinalysis, and pathology results directly into patient records.',
    category: 'Lab Services',
    status: 'connected',
    lastSync: '2 minutes ago',
    iconBg: '#EF444415',
    iconText: 'IDEXX',
    iconColor: '#EF4444',
  },
  {
    id: 'antech',
    name: 'Antech Diagnostics',
    description: 'Sync diagnostic lab results automatically for real-time patient updates.',
    category: 'Lab Services',
    status: 'error',
    lastSync: '3 days ago',
    iconBg: '#3B82F615',
    iconText: 'ATC',
    iconColor: '#3B82F6',
  },
  {
    id: 'zoetis',
    name: 'Zoetis Reference Labs',
    description: 'Connect to Zoetis reference lab portal for specialty and reference panel results.',
    category: 'Lab Services',
    status: 'available',
    iconBg: '#8B5CF615',
    iconText: 'ZRL',
    iconColor: '#8B5CF6',
  },
  // Payments
  {
    id: 'stripe',
    name: 'Stripe',
    description: 'Accept card payments, set up recurring billing, and manage invoices from the dashboard.',
    category: 'Payments',
    status: 'connected',
    lastSync: '5 minutes ago',
    iconBg: '#6366F115',
    iconText: 'STR',
    iconColor: '#6366F1',
  },
  {
    id: 'square',
    name: 'Square',
    description: 'In-person and online payments with automatic invoice reconciliation.',
    category: 'Payments',
    status: 'available',
    iconBg: '#1A1A2E15',
    iconText: 'SQ',
    iconColor: 'var(--text-primary)',
  },
  {
    id: 'quickbooks',
    name: 'QuickBooks Online',
    description: 'Sync invoices, payments, and client records with your accounting software automatically.',
    category: 'Payments',
    status: 'available',
    iconBg: '#22C55E15',
    iconText: 'QB',
    iconColor: '#22C55E',
  },
  // Communications
  {
    id: 'twilio',
    name: 'Twilio SMS',
    description: 'Send appointment reminders, vaccination alerts, and follow-up messages via SMS.',
    category: 'Communications',
    status: 'connected',
    lastSync: '1 hour ago',
    iconBg: '#F4A26115',
    iconText: 'TW',
    iconColor: '#F4A261',
  },
  {
    id: 'sendgrid',
    name: 'SendGrid',
    description: 'Transactional email delivery for invoices, records, and automated client communications.',
    category: 'Communications',
    status: 'connected',
    lastSync: '30 minutes ago',
    iconBg: '#06B6D415',
    iconText: 'SG',
    iconColor: '#06B6D4',
  },
  {
    id: 'mailchimp',
    name: 'Mailchimp',
    description: 'Build client mailing lists and send newsletters, seasonal promotions, and wellness reminders.',
    category: 'Communications',
    status: 'available',
    iconBg: '#F4A26115',
    iconText: 'MC',
    iconColor: '#F4A261',
  },
  // Calendar
  {
    id: 'gcal',
    name: 'Google Calendar',
    description: 'Two-way sync of appointments to your personal or clinic Google Calendar.',
    category: 'Calendar',
    status: 'connected',
    lastSync: '10 minutes ago',
    iconBg: '#3B82F615',
    iconText: 'GCal',
    iconColor: '#3B82F6',
  },
  {
    id: 'outlook',
    name: 'Outlook Calendar',
    description: 'Sync appointments with Microsoft Outlook and Teams for your entire clinic team.',
    category: 'Calendar',
    status: 'available',
    iconBg: '#6366F115',
    iconText: 'OL',
    iconColor: '#6366F1',
  },
  // Storage
  {
    id: 'gdrive',
    name: 'Google Drive',
    description: 'Export patient records, X-rays, and reports directly to a linked Google Drive folder.',
    category: 'Storage & Files',
    status: 'available',
    iconBg: '#22C55E15',
    iconText: 'GD',
    iconColor: '#22C55E',
  },
  {
    id: 'dropbox',
    name: 'Dropbox',
    description: 'Automatically back up medical records, images, and documents to Dropbox.',
    category: 'Storage & Files',
    status: 'available',
    iconBg: '#3B82F615',
    iconText: 'DB',
    iconColor: '#3B82F6',
  },
];

// ─── Integrations Section ─────────────────────────────────────────────────────

function IntegrationsSection() {
  const [statuses, setStatuses] = useState<Record<string, IntegrationStatus>>(
    () => Object.fromEntries(ALL_INTEGRATIONS.map((i) => [i.id, i.status]))
  );
  const [apiKeyCopied, setApiKeyCopied] = useState(false);
  const [webhookCopied, setWebhookCopied] = useState(false);
  const [webhookSecret, setWebhookSecret] = useState('whsec_••••••••••••••••••••••••••••');
  const [showSecret, setShowSecret] = useState(false);

  const connected = ALL_INTEGRATIONS.filter((i) => statuses[i.id] === 'connected');
  const errorItems = ALL_INTEGRATIONS.filter((i) => statuses[i.id] === 'error');

  const categories = [...new Set(ALL_INTEGRATIONS.map((i) => i.category))];

  const connect = (id: string) =>
    setStatuses((prev) => ({ ...prev, [id]: 'connected' }));
  const disconnect = (id: string) =>
    setStatuses((prev) => ({ ...prev, [id]: 'available' }));

  const copyToClipboard = (text: string, setCopied: (v: boolean) => void) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      {/* Summary banner */}
      <SectionCard>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-[var(--text-primary)] mb-1">Connected integrations</h3>
            <p className="text-[var(--text-secondary)]" style={{ fontSize: '14px' }}>
              {connected.length} active · {errorItems.length > 0 ? `${errorItems.length} need attention` : 'all healthy'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {errorItems.length > 0 && (
              <span
                className="flex items-center gap-1.5 px-3 py-1.5"
                style={{ backgroundColor: '#d4183d15', color: '#d4183d', borderRadius: '8px', fontSize: '13px', fontWeight: 600 }}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                {errorItems.length} error{errorItems.length > 1 ? 's' : ''}
              </span>
            )}
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--surface-elevated)]" style={{ borderRadius: '8px' }}>
              <div className="w-2 h-2 rounded-full bg-[#2D6A4F]" />
              <span className="text-[var(--text-secondary)]" style={{ fontSize: '13px' }}>{connected.length} connected</span>
            </div>
          </div>
        </div>

        {/* Connected tiles */}
        {connected.length > 0 && (
          <div className="grid grid-cols-3 gap-3 mt-5">
            {connected.map((intg) => (
              <div
                key={intg.id}
                className="flex items-center gap-3 p-3 border border-[var(--border-color)] bg-[var(--surface-elevated)]"
                style={{ borderRadius: '10px' }}
              >
                <div
                  className="w-9 h-9 flex items-center justify-center flex-shrink-0"
                  style={{ borderRadius: '8px', backgroundColor: intg.iconBg }}
                >
                  <span style={{ fontSize: '9px', fontWeight: 800, color: intg.iconColor, letterSpacing: '-0.5px' }}>
                    {intg.iconText}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="text-[var(--text-primary)] truncate" style={{ fontSize: '13px', fontWeight: 600 }}>
                    {intg.name}
                  </p>
                  <p className="text-[var(--text-secondary)]" style={{ fontSize: '11px' }}>
                    Synced {intg.lastSync}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Error banner if any */}
      {errorItems.map((intg) => (
        <div
          key={intg.id}
          className="flex items-start gap-4 p-4 border"
          style={{ borderRadius: '12px', borderColor: '#d4183d40', backgroundColor: '#d4183d08' }}
        >
          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#d4183d' }} />
          <div className="flex-1">
            <p className="text-[var(--text-primary)]" style={{ fontSize: '14px', fontWeight: 600 }}>
              {intg.name} — connection error
            </p>
            <p className="text-[var(--text-secondary)] mt-0.5" style={{ fontSize: '13px' }}>
              Last successful sync {intg.lastSync}. Re-authenticate to restore the connection.
            </p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <Button variant="outline" size="sm" onClick={() => connect(intg.id)}>
              <RefreshCw className="w-3.5 h-3.5" />
              Reconnect
            </Button>
            <Button variant="ghost" size="sm" onClick={() => disconnect(intg.id)} className="text-[#d4183d] hover:text-[#d4183d]">
              Dismiss
            </Button>
          </div>
        </div>
      ))}

      {/* Integrations by category */}
      {categories.map((cat) => {
        const items = ALL_INTEGRATIONS.filter((i) => i.category === cat);
        return (
          <SectionCard key={cat}>
            <div className="flex items-center gap-2 mb-1">
              {cat === 'Lab Services' && <FlaskConical className="w-4 h-4 text-[#8B5CF6]" />}
              {cat === 'Payments' && <CreditCard className="w-4 h-4 text-[#22C55E]" />}
              {cat === 'Communications' && <MessageSquare className="w-4 h-4 text-[#06B6D4]" />}
              {cat === 'Calendar' && <Calendar className="w-4 h-4 text-[#3B82F6]" />}
              {cat === 'Storage & Files' && <Globe className="w-4 h-4 text-[#F4A261]" />}
              <h3 className="text-[var(--text-primary)]">{cat}</h3>
            </div>
            <Separator className="mb-4" />

            <div className="space-y-3">
              {items.map((intg) => {
                const status = statuses[intg.id];
                return (
                  <div
                    key={intg.id}
                    className="flex items-center gap-4 p-4 border border-[var(--border-color)] transition-colors"
                    style={{
                      borderRadius: '10px',
                      backgroundColor: status === 'connected' ? 'var(--surface-elevated)' : 'transparent',
                      borderColor: status === 'error' ? '#d4183d40' : undefined,
                    }}
                  >
                    {/* Logo */}
                    <div
                      className="w-12 h-12 flex items-center justify-center flex-shrink-0"
                      style={{ borderRadius: '10px', backgroundColor: intg.iconBg, border: '1px solid var(--border-color)' }}
                    >
                      <span style={{ fontSize: '10px', fontWeight: 800, color: intg.iconColor, letterSpacing: '-0.5px' }}>
                        {intg.iconText}
                      </span>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-[var(--text-primary)]" style={{ fontSize: '15px', fontWeight: 600 }}>
                          {intg.name}
                        </p>
                        {status === 'connected' && (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5"
                            style={{ backgroundColor: '#74C69D20', color: 'var(--brand-green-text)', borderRadius: '9999px', fontSize: '11px', fontWeight: 700 }}
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-[#2D6A4F]" />
                            Connected
                          </span>
                        )}
                        {status === 'error' && (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5"
                            style={{ backgroundColor: '#d4183d15', color: '#d4183d', borderRadius: '9999px', fontSize: '11px', fontWeight: 700 }}
                          >
                            <AlertTriangle className="w-3 h-3" />
                            Error
                          </span>
                        )}
                        <span
                          className="inline-flex px-2 py-0.5 bg-[var(--surface-elevated)] text-[var(--text-secondary)]"
                          style={{ borderRadius: '9999px', fontSize: '11px', border: '1px solid var(--border-color)' }}
                        >
                          {intg.category}
                        </span>
                      </div>
                      <p className="text-[var(--text-secondary)]" style={{ fontSize: '13px', lineHeight: 1.5 }}>
                        {intg.description}
                      </p>
                      {status === 'connected' && intg.lastSync && (
                        <p className="text-[var(--text-secondary)] mt-1" style={{ fontSize: '12px' }}>
                          Last synced: {intg.lastSync}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {status === 'available' && (
                        <Button size="sm" onClick={() => connect(intg.id)}>
                          <Plug className="w-3.5 h-3.5" />
                          Connect
                        </Button>
                      )}
                      {status === 'error' && (
                        <>
                          <Button size="sm" onClick={() => connect(intg.id)}>
                            <RefreshCw className="w-3.5 h-3.5" />
                            Reconnect
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => disconnect(intg.id)} className="text-[#d4183d] hover:text-[#d4183d]">
                            Remove
                          </Button>
                        </>
                      )}
                      {status === 'connected' && (
                        <>
                          <Button variant="outline" size="sm">
                            Configure
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => disconnect(intg.id)}
                            className="text-[#d4183d] hover:text-[#d4183d]"
                          >
                            Disconnect
                          </Button>
                        </>
                      )}
                      <a
                        href="#"
                        className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                        title="View docs"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          </SectionCard>
        );
      })}

      {/* API Access */}
      <SectionCard>
        <div className="flex items-center gap-2 mb-1">
          <Zap className="w-4 h-4 text-[#F4A261]" />
          <h3 className="text-[var(--text-primary)]">API access</h3>
        </div>
        <p className="text-[var(--text-secondary)] mb-2" style={{ fontSize: '14px' }}>
          Use the Hugory REST API to build custom integrations. Keep your API key secret — it grants full access to your account.
        </p>
        <Separator className="mb-4" />

        <FieldRow label="API key" hint="Treat this like a password">
          <div className="flex gap-2">
            <Input
              readOnly
              value="vtk_live_••••••••••••••••••••••••••••••••"
              className="font-mono"
              style={{ fontSize: '13px' }}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => copyToClipboard('vtk_live_sk_1234567890abcdef', setApiKeyCopied)}
            >
              {apiKeyCopied ? <Check className="w-4 h-4 text-[var(--brand-green-text)]" /> : <Copy className="w-4 h-4" />}
              {apiKeyCopied ? 'Copied' : 'Copy'}
            </Button>
            <Button variant="outline" size="sm">
              <RotateCcw className="w-4 h-4" />
              Rotate
            </Button>
          </div>
          <p className="text-[var(--text-secondary)] mt-1.5" style={{ fontSize: '12px' }}>
            Generated March 1, 2026 · Last used 2 hours ago
          </p>
        </FieldRow>

        <FieldRow label="API docs" hint="REST, webhooks, SDKs">
          <a
            href="#"
            className="inline-flex items-center gap-1.5 text-[var(--brand-green-text)] hover:underline"
            style={{ fontSize: '14px', fontWeight: 600 }}
          >
            docs.vettrack.com/api
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </FieldRow>
      </SectionCard>

      {/* Webhooks */}
      <SectionCard>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Webhook className="w-4 h-4 text-[#6366F1]" />
            <h3 className="text-[var(--text-primary)]">Webhooks</h3>
          </div>
          <Button size="sm" variant="outline">
            <Plug className="w-3.5 h-3.5" />
            Add endpoint
          </Button>
        </div>
        <p className="text-[var(--text-secondary)] mb-2" style={{ fontSize: '14px' }}>
          Send real-time event data to your own servers when things happen in Hugory.
        </p>
        <Separator className="mb-4" />

        {/* Existing endpoint */}
        <div
          className="p-4 border border-[var(--border-color)] bg-[var(--surface-elevated)] mb-4"
          style={{ borderRadius: '10px' }}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2 h-2 rounded-full bg-[#2D6A4F]" />
                <p className="text-[var(--text-primary)] font-mono truncate" style={{ fontSize: '13px', fontWeight: 600 }}>
                  https://api.myhospital.com/webhooks/vettrack
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {['appointment.created', 'appointment.cancelled', 'record.updated', 'lab.result_ready', 'invoice.paid'].map((evt) => (
                  <span
                    key={evt}
                    className="px-2 py-0.5 bg-[var(--surface-white)] border border-[var(--border-color)] text-[var(--text-secondary)] font-mono"
                    style={{ borderRadius: '6px', fontSize: '11px' }}
                  >
                    {evt}
                  </span>
                ))}
              </div>
              <p className="text-[var(--text-secondary)] mt-2" style={{ fontSize: '12px' }}>
                Last delivery: Mar 14, 2026 8:47 AM · 200 OK · 142ms
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button variant="outline" size="sm">Edit</Button>
              <Button variant="ghost" size="sm" className="text-[#d4183d] hover:text-[#d4183d]">
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Webhook signing secret */}
        <FieldRow label="Signing secret" hint="Verify webhook payloads came from Hugory">
          <div className="flex gap-2">
            <Input
              readOnly
              value={showSecret ? 'whsec_8f3kLp2mNqR9xTvW4yZaB6cD1eF7gH0i' : webhookSecret}
              className="font-mono"
              style={{ fontSize: '13px' }}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSecret(!showSecret)}
            >
              {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => copyToClipboard('whsec_8f3kLp2mNqR9xTvW4yZaB6cD1eF7gH0i', setWebhookCopied)}
            >
              {webhookCopied ? <Check className="w-4 h-4 text-[var(--brand-green-text)]" /> : <Copy className="w-4 h-4" />}
              {webhookCopied ? 'Copied' : 'Copy'}
            </Button>
          </div>
        </FieldRow>
      </SectionCard>
    </>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { user } = useAuth();
  const [activeSection, setActiveSection] = useState<SettingsSection>('profile');
  const [savedSection, setSavedSection] = useState<SettingsSection | null>(null);

  const [saving, setSaving] = useState(false);

  const [pwError, setPwError] = useState<string | null>(null);

  const handleSave = async (section: SettingsSection) => {
    if (section === 'profile' && staffId) {
      setSaving(true);
      // Profile data → profiles table
      await updateProfile(staffId, { first_name: firstName, last_name: lastName, email, phone });
      // Staff-specific data → staff table
      const { organizationId } = await getOrgContext();
      const { error } = await supabase.from('staff').update({
        job_title: jobTitle,
        specialization,
        license_no: licenseNo,
      }).eq('id', staffId).eq('organization_id', organizationId);
      setSaving(false);
      if (error) {
        alert('Failed to save: ' + error.message);
        return;
      }
      // Update sidebar + all useProfile('doctor') consumers instantly
      window.dispatchEvent(new CustomEvent('doctorProfileChanged', { detail: { firstName, lastName, email, phone } }));
    }

    if (section === 'security') {
      if (!currentPw || !newPw || newPw !== confirmPw || newPw.length < 12) return;
      setSaving(true);
      setPwError(null);
      // Verify current password by re-authenticating
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) { setSaving(false); setPwError('Unable to verify user.'); return; }
      const { error: signInErr } = await supabase.auth.signInWithPassword({ email: user.email, password: currentPw });
      if (signInErr) { setSaving(false); setPwError('Current password is incorrect.'); return; }
      // Update to new password
      const { error: updateErr } = await supabase.auth.updateUser({ password: newPw });
      setSaving(false);
      if (updateErr) { setPwError(updateErr.message); return; }
      // Clear fields on success
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
    }

    if (section === 'session') {
      setSaving(true);
      try {
        const { organizationId } = await getOrgContext();
        await supabase
          .from('organization_settings')
          .upsert({ organization_id: organizationId, key: 'session_timeout', value: sessionTimeout, updated_at: new Date().toISOString() }, { onConflict: 'organization_id,key' });
      } catch {}
      setSaving(false);
    }

    if (section === 'notifications' && user) {
      setSaving(true);
      const dbRow: Record<string, any> = { user_id: user.id, updated_at: new Date().toISOString() };
      for (const [key, col] of Object.entries(NOTIF_DB_MAP)) {
        dbRow[col] = notifs[key as keyof typeof notifs];
      }
      await supabase.from('notification_preferences').upsert(dbRow, { onConflict: 'user_id' });
      setSaving(false);
    }

    setSavedSection(section);
    setTimeout(() => setSavedSection(null), 3000);
  };

  // ── Profile state ──────────────────────────────────────────────────────────
  const [staffId, setStaffId] = useState<string | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [licenseNo, setLicenseNo] = useState('');
  const [profilePhoto, setProfilePhoto] = useState('');

  // Load profile from Supabase
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email, phone, avatar_url')
        .eq('id', user.id)
        .single();
      if (profileData) {
        setStaffId(profileData.id);
        setFirstName(profileData.first_name || '');
        setLastName(profileData.last_name || '');
        setEmail(profileData.email || '');
        setPhone(profileData.phone || '');
        setProfilePhoto(profileData.avatar_url || '');
        // Fetch staff-specific fields
        const { data: staffData } = await supabase
          .from('staff')
          .select('job_title, specialization, license_no')
          .eq('id', profileData.id)
          .single();
        if (staffData) {
          setJobTitle(staffData.job_title || '');
          setSpecialization(staffData.specialization || '');
          setLicenseNo(staffData.license_no || '');
        }
      }
    })();
  }, [user]);

  // ── Clinic state ───────────────────────────────────────────────────────────
  const [clinicName, setClinicName] = useState('Hugory Animal Hospital');
  const [clinicAddress, setClinicAddress] = useState('1247 Maple Street');
  const [clinicCity, setClinicCity] = useState('Austin');
  const [clinicState, setClinicState] = useState('TX');
  const [clinicZip, setClinicZip] = useState('78701');
  const [clinicPhone, setClinicPhone] = useState('(512) 555-0192');
  const [clinicEmail, setClinicEmail] = useState('info@vettrack-hospital.com');
  const [clinicWebsite, setClinicWebsite] = useState('www.vettrack-hospital.com');
  const [clinicTax, setClinicTax] = useState('47-2891034');
  const [timezone, setTimezone] = useState('America/Chicago');

  // ── Hours state ────────────────────────────────────────────────────────────
  const [hours, setHours] = useState([
    { day: 'Monday',    open: true,  from: '08:00', to: '18:00' },
    { day: 'Tuesday',   open: true,  from: '08:00', to: '18:00' },
    { day: 'Wednesday', open: true,  from: '08:00', to: '18:00' },
    { day: 'Thursday',  open: true,  from: '08:00', to: '18:00' },
    { day: 'Friday',    open: true,  from: '08:00', to: '17:00' },
    { day: 'Saturday',  open: true,  from: '09:00', to: '13:00' },
    { day: 'Sunday',    open: false, from: '09:00', to: '13:00' },
  ]);

  // ── Notification state ─────────────────────────────────────────────────────
  const [notifs, setNotifs] = useState({
    apptNew:        true,
    apptCancel:     true,
    apptReminder:   true,
    apptReschedule: true,
    labReady:       true,
    labCritical:    true,
    invoiceGen:     false,
    paymentRecv:    true,
    planExpiry:     true,
    systemUpdates:  true,
  });


  const toggleNotif = (key: keyof typeof notifs) => {
    setNotifs((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Load notification preferences from Supabase
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single();
      if (data) {
        setNotifs({
          apptNew: data.appt_new,
          apptCancel: data.appt_cancel,
          apptReminder: data.appt_reminder,
          apptReschedule: data.appt_reschedule,
          labReady: data.lab_ready,
          labCritical: data.lab_critical,
          invoiceGen: data.invoice_gen,
          paymentRecv: data.payment_recv,
          planExpiry: data.plan_expiry,
          systemUpdates: data.system_updates,
        });
      }
    })();
  }, [user]);

  // ── Appearance state ───────────────────────────────────────────────────────
  const { themeStyle: currentTheme, setThemeStyle: applyTheme, selectedLightTheme, selectedDarkTheme } = useThemeHook();
  const [dateFormat, setDateFormat] = useState('MM/DD/YYYY');
  const [timeFormat, setTimeFormat] = useState('12h');
  const [language, setLanguage] = useState('en-US');
  const [defaultPage, setDefaultPage] = useState('/');
  const [compactMode, setCompactMode] = useState(false);
  const [animationsEnabled, setAnimationsEnabled] = useState(true);

  // ── Security state ─────────────────────────────────────────────────────────
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [twoFaEnabled, setTwoFaEnabled] = useState(true);
  const [sessionTimeout, setSessionTimeout] = useState('8h');

  // Load session timeout from DB
  useEffect(() => {
    (async () => {
      try {
        const { organizationId } = await getOrgContext();
        const { data } = await supabase
          .from('organization_settings')
          .select('value')
          .eq('organization_id', organizationId)
          .eq('key', 'session_timeout')
          .single();
        if (data) setSessionTimeout(data.value);
      } catch {}
    })();
  }, []);

  // ── Sessions & Login Activity (real Supabase data) ───────────────────────
  interface SessionRow { id: string; device: string; browser: string; location: string; is_current: boolean; last_active_at: string; }
  interface ActivityRow { id: string; device: string; browser: string; location: string; status: string; created_at: string; }
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loginActivity, setLoginActivity] = useState<ActivityRow[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);

  // Parse user-agent into device + browser
  const parseUserAgent = useCallback(() => {
    const ua = navigator.userAgent;
    let device = 'Unknown Device';
    let browser = 'Unknown Browser';
    // Device
    if (/Macintosh|MacIntel/.test(ua)) device = 'Mac';
    else if (/Windows/.test(ua)) device = 'Windows PC';
    else if (/iPad/.test(ua)) device = 'iPad';
    else if (/iPhone/.test(ua)) device = 'iPhone';
    else if (/Android/.test(ua) && /Mobile/.test(ua)) device = 'Android Phone';
    else if (/Android/.test(ua)) device = 'Android Tablet';
    else if (/Linux/.test(ua)) device = 'Linux PC';
    // Browser
    if (/Edg\/(\d+)/.test(ua)) browser = `Edge ${RegExp.$1}`;
    else if (/Chrome\/(\d+)/.test(ua)) browser = `Chrome ${RegExp.$1}`;
    else if (/Firefox\/(\d+)/.test(ua)) browser = `Firefox ${RegExp.$1}`;
    else if (/Version\/(\d+).*Safari/.test(ua)) browser = `Safari ${RegExp.$1}`;
    return { device, browser };
  }, []);

  // Format relative time
  const formatRelativeTime = (dateStr: string) => {
    const now = new Date();
    const d = new Date(dateStr);
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Now';
    if (diffMin < 60) return `${diffMin} min ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr} hour${diffHr > 1 ? 's' : ''} ago`;
    const diffDays = Math.floor(diffHr / 24);
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 30) return `${diffDays} days ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Register current session + fetch all sessions & activity
  const loadSessions = useCallback(async () => {
    if (!user) return;
    setSessionsLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const rawToken = sessionData?.session?.access_token?.slice(-16) || 'current';
      const tokenHash = await hashSessionToken(rawToken);
      const { device, browser } = parseUserAgent();

      // Upsert current session (only the hash is stored, never the raw token)
      await supabase.from('user_sessions').upsert(
        {
          user_id: user.id,
          session_token_hash: tokenHash,
          device,
          browser,
          location: 'Current Location',
          is_current: true,
          last_active_at: new Date().toISOString(),
        },
        { onConflict: 'session_token_hash' }
      );

      // Mark all other sessions as not current
      await supabase
        .from('user_sessions')
        .update({ is_current: false })
        .eq('user_id', user.id)
        .neq('session_token_hash', tokenHash);

      // Fetch all sessions
      const { data: allSessions } = await supabase
        .from('user_sessions')
        .select('*')
        .eq('user_id', user.id)
        .order('last_active_at', { ascending: false });

      setSessions(allSessions || []);

      // Log this login in activity (only if no recent entry in last 5 min)
      const fiveMinAgo = new Date(Date.now() - 5 * 60000).toISOString();
      const { data: recentLog } = await supabase
        .from('login_activity')
        .select('id')
        .eq('user_id', user.id)
        .gte('created_at', fiveMinAgo)
        .limit(1);

      if (!recentLog || recentLog.length === 0) {
        await supabase.from('login_activity').insert({
          user_id: user.id,
          device,
          browser,
          location: 'Current Location',
          status: 'success',
        });
      }

      // Fetch recent login activity
      const { data: activity } = await supabase
        .from('login_activity')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);

      setLoginActivity(activity || []);
    } catch (e) {
      console.error('Error loading sessions:', e);
    }
    setSessionsLoading(false);
  }, [user, parseUserAgent]);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  // Revoke a single session
  const revokeSession = async (sessionId: string) => {
    await supabase.from('user_sessions').delete().eq('id', sessionId);
    setSessions(prev => prev.filter(s => s.id !== sessionId));
  };

  // Sign out all sessions
  const signOutAll = async () => {
    if (!user) return;
    await supabase.from('user_sessions').delete().eq('user_id', user.id);
    await supabase.auth.signOut({ scope: 'global' });
  };

  return (
    <div className="max-w-[1440px] mx-auto p-8">
      {/* ── Page Header ── */}
      <div className="mb-8">
        <h1 className="text-[var(--text-primary)] mb-2">Settings</h1>
        <p className="text-[var(--text-secondary)]" style={{ fontSize: '16px', fontWeight: 400 }}>
          Manage your account, clinic, and preferences.
        </p>
      </div>

      {/* ── Layout: Left nav + Right content ── */}
      <div className="flex gap-8 items-start">

        {/* ── Left navigation ── */}
        <aside className="w-56 flex-shrink-0 sticky top-8">
          <nav className="bg-[var(--surface-white)] border border-[var(--border-color)] p-2" style={{ borderRadius: '12px' }}>
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 mb-0.5 last:mb-0 transition-colors ${
                    isActive
                      ? 'bg-[var(--surface-elevated)] text-[var(--brand-green-text)]'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--surface-elevated)] hover:text-[var(--text-primary)]'
                  }`}
                  style={{ borderRadius: '8px', textAlign: 'left' }}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" style={{ color: isActive ? 'var(--brand-green-text)' : undefined }} />
                  <span style={{ fontSize: '14px', fontWeight: isActive ? 600 : 400 }}>{item.label}</span>
                  {item.badge && (
                    <span
                      className="ml-auto text-white"
                      style={{
                        backgroundColor: '#d4183d',
                        borderRadius: '9999px',
                        fontSize: '11px',
                        fontWeight: 700,
                        minWidth: '18px',
                        height: '18px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '0 5px',
                      }}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* ── Right content ── */}
        <div className="flex-1 min-w-0 space-y-6">

          {/* ════════════════════════════════════════════════════════ PROFILE */}
          {activeSection === 'profile' && (
            <>
              {/* Avatar */}
              <SectionCard>
                <h3 className="text-[var(--text-primary)] mb-1">Profile photo</h3>
                <p className="text-[var(--text-secondary)] mb-5" style={{ fontSize: '14px' }}>
                  This is shown on your appointments, records, and client portal.
                </p>
                <div className="flex items-center gap-5">
                  {profilePhoto ? (
                    <img src={profilePhoto} alt="Profile" className="w-20 h-20 object-cover" style={{ borderRadius: '9999px' }} />
                  ) : (
                    <div className="w-20 h-20 bg-[var(--brand-green-bg)] text-[var(--brand-green-text)] flex items-center justify-center" style={{ borderRadius: '9999px', fontSize: '24px', fontWeight: 700 }}>
                      {(firstName?.[0] || '').toUpperCase()}{(lastName?.[0] || '').toUpperCase()}
                    </div>
                  )}
                  <div className="space-y-2">
                    <Button variant="outline" size="sm" onClick={() => {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.accept = 'image/*';
                      input.onchange = async (ev: any) => {
                        const file = ev.target.files?.[0];
                        if (!file || !staffId) return;
                        try {
                          const publicUrl = await uploadAvatar(staffId, file, 'doctor');
                          setProfilePhoto(publicUrl);
                        } catch (err: any) {
                          alert(err.message);
                        }
                      };
                      input.click();
                    }}>
                      <Camera className="w-4 h-4" />
                      Upload new photo
                    </Button>
                    {profilePhoto && (
                      <Button variant="ghost" size="sm" className="text-[#d4183d] hover:text-[#d4183d]" onClick={async () => {
                        if (!staffId || !confirm('Remove your profile photo?')) return;
                        try {
                          await removeAvatar(staffId, 'doctor');
                          setProfilePhoto('');
                        } catch (err: any) {
                          console.error('Delete error:', err);
                        }
                      }}>
                        <Trash2 className="w-4 h-4" />
                        Remove photo
                      </Button>
                    )}
                  </div>
                  <div className="ml-auto text-right">
                    <p className="text-[var(--text-secondary)]" style={{ fontSize: '12px' }}>
                      JPG, GIF or PNG · Max 2 MB
                    </p>
                    <p className="text-[var(--text-secondary)]" style={{ fontSize: '12px', marginTop: '2px' }}>
                      Recommended: 400×400 px
                    </p>
                  </div>
                </div>
              </SectionCard>

              {/* Personal Info */}
              <SectionCard>
                <h3 className="text-[var(--text-primary)] mb-1">Personal information</h3>
                <p className="text-[var(--text-secondary)] mb-2" style={{ fontSize: '14px' }}>
                  Update your name, contact details, and professional credentials.
                </p>
                <Separator className="mb-2" />

                <FieldRow label="Full name">
                  <div className="grid grid-cols-2 gap-3">
                    <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First name" />
                    <Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last name" />
                  </div>
                </FieldRow>

                <FieldRow label="Email address" hint="Used for login and notifications">
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </FieldRow>

                <FieldRow label="Phone number">
                  <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </FieldRow>

                <FieldRow label="Job title">
                  <Input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
                </FieldRow>

                <FieldRow label="Specialization">
                  <Select value={specialization} onValueChange={setSpecialization}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[
                        'Small Animal Medicine',
                        'Large Animal Medicine',
                        'Exotic Animal Medicine',
                        'Surgery',
                        'Dermatology',
                        'Oncology',
                        'Cardiology',
                        'Neurology',
                        'Emergency & Critical Care',
                        'General Practice',
                      ].map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FieldRow>

                <FieldRow label="License number" hint="Your state veterinary license">
                  <Input value={licenseNo} onChange={(e) => setLicenseNo(e.target.value)} />
                </FieldRow>

                <SaveBar onSave={() => handleSave('profile')} saved={savedSection === 'profile'} />
              </SectionCard>
            </>
          )}

          {/* ═══════════════════════════════════════════════════════ CLINIC */}
          {activeSection === 'clinic' && (
            <>
              {/* Clinic logo */}
              <SectionCard>
                <h3 className="text-[var(--text-primary)] mb-1">Clinic branding</h3>
                <p className="text-[var(--text-secondary)] mb-5" style={{ fontSize: '14px' }}>
                  Your clinic logo appears on invoices, records, and the client portal.
                </p>
                <div className="flex items-center gap-5">
                  <div
                    className="w-20 h-20 bg-[var(--surface-elevated)] border border-[var(--border-color)] flex items-center justify-center"
                    style={{ borderRadius: '12px' }}
                  >
                    <Building2 className="w-8 h-8 text-[var(--text-secondary)]" />
                  </div>
                  <div className="space-y-2">
                    <Button variant="outline" size="sm">
                      <Camera className="w-4 h-4" />
                      Upload logo
                    </Button>
                    <Button variant="ghost" size="sm" className="text-[#d4183d] hover:text-[#d4183d]">
                      <Trash2 className="w-4 h-4" />
                      Remove logo
                    </Button>
                  </div>
                  <p className="ml-auto text-right text-[var(--text-secondary)]" style={{ fontSize: '12px' }}>
                    PNG or SVG recommended<br />Min 200×200 px · Max 2 MB
                  </p>
                </div>
              </SectionCard>

              {/* Clinic details */}
              <SectionCard>
                <h3 className="text-[var(--text-primary)] mb-1">Clinic details</h3>
                <p className="text-[var(--text-secondary)] mb-2" style={{ fontSize: '14px' }}>
                  This information is used on patient records, invoices, and your public profile.
                </p>
                <Separator className="mb-2" />

                <FieldRow label="Clinic name">
                  <Input value={clinicName} onChange={(e) => setClinicName(e.target.value)} />
                </FieldRow>

                <FieldRow label="Street address">
                  <Input value={clinicAddress} onChange={(e) => setClinicAddress(e.target.value)} placeholder="Address line 1" />
                </FieldRow>

                <FieldRow label="City / State / ZIP">
                  <div className="grid grid-cols-[1fr_80px_100px] gap-3">
                    <Input value={clinicCity} onChange={(e) => setClinicCity(e.target.value)} placeholder="City" />
                    <Input value={clinicState} onChange={(e) => setClinicState(e.target.value)} placeholder="State" />
                    <Input value={clinicZip} onChange={(e) => setClinicZip(e.target.value)} placeholder="ZIP" />
                  </div>
                </FieldRow>

                <FieldRow label="Phone">
                  <Input type="tel" value={clinicPhone} onChange={(e) => setClinicPhone(e.target.value)} />
                </FieldRow>

                <FieldRow label="Email">
                  <Input type="email" value={clinicEmail} onChange={(e) => setClinicEmail(e.target.value)} />
                </FieldRow>

                <FieldRow label="Website">
                  <Input value={clinicWebsite} onChange={(e) => setClinicWebsite(e.target.value)} placeholder="www.example.com" />
                </FieldRow>

                <FieldRow label="Tax ID / EIN" hint="Used on invoices">
                  <Input value={clinicTax} onChange={(e) => setClinicTax(e.target.value)} />
                </FieldRow>

                <FieldRow label="Timezone">
                  <Select value={timezone} onValueChange={setTimezone}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="America/New_York">Eastern Time (ET)</SelectItem>
                      <SelectItem value="America/Chicago">Central Time (CT)</SelectItem>
                      <SelectItem value="America/Denver">Mountain Time (MT)</SelectItem>
                      <SelectItem value="America/Los_Angeles">Pacific Time (PT)</SelectItem>
                      <SelectItem value="America/Anchorage">Alaska Time (AKT)</SelectItem>
                      <SelectItem value="Pacific/Honolulu">Hawaii Time (HT)</SelectItem>
                    </SelectContent>
                  </Select>
                </FieldRow>

                <SaveBar onSave={() => handleSave('clinic')} saved={savedSection === 'clinic'} />
              </SectionCard>

              {/* Business Hours */}
              <SectionCard>
                <h3 className="text-[var(--text-primary)] mb-1">Business hours</h3>
                <p className="text-[var(--text-secondary)] mb-5" style={{ fontSize: '14px' }}>
                  Set your clinic's operating hours. Clients will only see available slots within these times.
                </p>

                <div className="space-y-1">
                  {/* Header */}
                  <div className="grid grid-cols-[140px_48px_1fr] gap-4 pb-2 border-b border-[var(--border-color)]">
                    <span className="text-[var(--text-secondary)]" style={{ fontSize: '12px', fontWeight: 600 }}>DAY</span>
                    <span className="text-[var(--text-secondary)]" style={{ fontSize: '12px', fontWeight: 600 }}>OPEN</span>
                    <span className="text-[var(--text-secondary)]" style={{ fontSize: '12px', fontWeight: 600 }}>HOURS</span>
                  </div>

                  {hours.map((h, idx) => (
                    <div key={h.day} className="grid grid-cols-[140px_48px_1fr] gap-4 items-center py-3 border-b border-[var(--border-color)] last:border-0">
                      <span className="text-[var(--text-primary)]" style={{ fontSize: '14px', fontWeight: h.open ? 600 : 400 }}>
                        {h.day}
                      </span>
                      <Switch
                        checked={h.open}
                        onCheckedChange={(v) =>
                          setHours((prev) => prev.map((x, i) => (i === idx ? { ...x, open: v } : x)))
                        }
                      />
                      {h.open ? (
                        <div className="flex items-center gap-2">
                          <Input
                            type="time"
                            value={h.from}
                            onChange={(e) =>
                              setHours((prev) => prev.map((x, i) => (i === idx ? { ...x, from: e.target.value } : x)))
                            }
                            className="w-32"
                          />
                          <span className="text-[var(--text-secondary)]" style={{ fontSize: '14px' }}>to</span>
                          <Input
                            type="time"
                            value={h.to}
                            onChange={(e) =>
                              setHours((prev) => prev.map((x, i) => (i === idx ? { ...x, to: e.target.value } : x)))
                            }
                            className="w-32"
                          />
                        </div>
                      ) : (
                        <span className="text-[var(--text-secondary)]" style={{ fontSize: '14px' }}>Closed</span>
                      )}
                    </div>
                  ))}
                </div>

                <SaveBar onSave={() => handleSave('clinic')} saved={savedSection === 'clinic'} />
              </SectionCard>
            </>
          )}

          {/* ══════════════════════════════════════════════ NOTIFICATIONS */}
          {activeSection === 'notifications' && (
            <>
              {/* Channel legend */}
              <SectionCard>
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-[#3B82F6] flex-shrink-0 mt-0.5" />
                  <p className="text-[var(--text-secondary)]" style={{ fontSize: '14px' }}>
                    Choose which in-app notifications you'd like to receive.
                    Notifications appear in the bell icon in the sidebar.
                  </p>
                </div>
              </SectionCard>

              {/* Helper to render a notification group */}
              {(
                [
                  {
                    title: 'Appointments',
                    rows: [
                      { key: 'apptNew'       as const, label: 'New booking',      desc: 'When a client books a new appointment' },
                      { key: 'apptCancel'    as const, label: 'Cancellation',      desc: 'When a client cancels their appointment' },
                      { key: 'apptReminder'  as const, label: 'Reminder (1 hr)',   desc: 'Reminder 1 hour before each appointment' },
                      { key: 'apptReschedule'as const, label: 'Rescheduled',       desc: 'When an appointment time is changed' },
                    ],
                  },
                  {
                    title: 'Lab Results',
                    rows: [
                      { key: 'labReady'    as const, label: 'Lab result ready',    desc: 'When lab results are available for review' },
                      { key: 'labCritical' as const, label: 'Critical value alert', desc: 'Immediate alert for out-of-range critical values' },
                    ],
                  },
                  {
                    title: 'Billing',
                    rows: [
                      { key: 'invoiceGen'  as const, label: 'Invoice generated',   desc: 'When an invoice is created for a visit' },
                      { key: 'paymentRecv' as const, label: 'Payment received',    desc: 'When a client completes a payment' },
                      { key: 'planExpiry'  as const, label: 'Plan expiring soon',  desc: '30 days before subscription renewal' },
                    ],
                  },
                  {
                    title: 'System',
                    rows: [
                      { key: 'systemUpdates' as const, label: 'Software updates', desc: 'Notifications about new features and updates' },
                    ],
                  },
                ] as Array<{ title: string; rows: Array<{ key: keyof typeof notifs; label: string; desc: string }> }>
              ).map((group) => (
                <SectionCard key={group.title}>
                  <h3 className="text-[var(--text-primary)] mb-1">{group.title}</h3>
                  <Separator className="mb-4" />

                  {/* Column headers */}
                  <div className="grid grid-cols-[1fr_80px] gap-4 pb-2 border-b border-[var(--border-color)]">
                    <span />
                    <span className="text-center text-[var(--text-secondary)]" style={{ fontSize: '12px', fontWeight: 600 }}>
                      In-app
                    </span>
                  </div>

                  {group.rows.map(({ key, label, desc }) => (
                    <div key={key} className="grid grid-cols-[1fr_80px] gap-4 items-center py-3.5 border-b border-[var(--border-color)] last:border-0">
                      <div>
                        <p className="text-[var(--text-primary)]" style={{ fontSize: '14px', fontWeight: 600 }}>{label}</p>
                        <p className="text-[var(--text-secondary)]" style={{ fontSize: '12px' }}>{desc}</p>
                      </div>
                      <div className="flex justify-center">
                        <Switch checked={notifs[key]} onCheckedChange={() => toggleNotif(key)} />
                      </div>
                    </div>
                  ))}
                </SectionCard>
              ))}

              <div className="flex justify-end">
                <Button onClick={() => handleSave('notifications')}>
                  <Save className="w-4 h-4" />
                  Save preferences
                </Button>
                {savedSection === 'notifications' && (
                  <span className="flex items-center gap-1.5 text-[var(--brand-green-text)] ml-3" style={{ fontSize: '14px' }}>
                    <CheckCircle2 className="w-4 h-4" />
                    Saved
                  </span>
                )}
              </div>
            </>
          )}

          {/* ══════════════════════════════════════════════ APPEARANCE */}
          {activeSection === 'appearance' && (
            <>
              {/* Theme */}
              <SectionCard>
                <h3 className="text-[var(--text-primary)] mb-1">Theme</h3>
                <p className="text-[var(--text-secondary)] mb-4" style={{ fontSize: '14px' }}>
                  Pick a theme for each mode. The sidebar toggle switches between them.
                </p>

                {/* ── Light Themes ── */}
                <div className="flex items-center gap-2 mb-3">
                  <Sun className="w-4 h-4 text-[var(--text-secondary)]" />
                  <span className="text-[var(--text-primary)]" style={{ fontSize: '13px', fontWeight: 600 }}>Light Themes</span>
                </div>
                <div className="grid gap-3 mb-6" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
                  {LIGHT_THEMES.map(({ value, label, description, preview }) => {
                    const isSelected = selectedLightTheme === value;
                    const _isActive = currentTheme === value; void _isActive;
                    const iconMap: Record<string, typeof Sun> = {
                      light: Sun, pastel: Palette, sage: Leaf, sand: Sunrise,
                    };
                    const Icon = iconMap[value] || Palette;
                    return (
                      <button
                        key={value}
                        onClick={() => applyTheme(value as ThemeStyle)}
                        className="p-3 border transition-all text-left group"
                        style={{
                          borderRadius: '12px',
                          borderColor: isSelected ? 'var(--brand-green-text)' : 'var(--border-color)',
                          backgroundColor: isSelected ? 'color-mix(in srgb, var(--brand-green-text) 6%, var(--surface-elevated))' : 'var(--surface-elevated)',
                          boxShadow: isSelected ? '0 0 0 1px var(--brand-green-text)' : 'none',
                        }}
                      >
                        <div
                          className="w-full mb-3 border border-[var(--border-color)] overflow-hidden"
                          style={{ borderRadius: '8px', background: preview, height: 56, position: 'relative' }}
                        >
                          <div style={{ position: 'absolute', bottom: 6, left: 6, display: 'flex', gap: 3 }}>
                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,255,255,0.4)' }} />
                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,255,255,0.25)' }} />
                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,255,255,0.15)' }} />
                          </div>
                        </div>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <Icon className="w-3.5 h-3.5" style={{ color: isSelected ? 'var(--brand-green-text)' : 'var(--text-secondary)' }} />
                            <span style={{ fontSize: '13px', fontWeight: 600, color: isSelected ? 'var(--brand-green-text)' : 'var(--text-primary)' }}>
                              {label}
                            </span>
                          </div>
                          {isSelected && <Check className="w-3.5 h-3.5 text-[var(--brand-green-text)]" />}
                        </div>
                        <p style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.3, margin: 0 }}>
                          {description}
                        </p>
                      </button>
                    );
                  })}
                </div>

                {/* ── Dark Themes ── */}
                <div className="flex items-center gap-2 mb-3">
                  <Moon className="w-4 h-4 text-[var(--text-secondary)]" />
                  <span className="text-[var(--text-primary)]" style={{ fontSize: '13px', fontWeight: 600 }}>Dark Themes</span>
                </div>
                <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
                  {DARK_THEMES.map(({ value, label, description, preview }) => {
                    const isSelected = selectedDarkTheme === value;
                    const _isActive = currentTheme === value; void _isActive;
                    const iconMap: Record<string, typeof Sun> = {
                      dark: Moon, midnight: Moon, glass: Zap, contrast: Eye,
                    };
                    const Icon = iconMap[value] || Moon;
                    return (
                      <button
                        key={value}
                        onClick={() => applyTheme(value as ThemeStyle)}
                        className="p-3 border transition-all text-left group"
                        style={{
                          borderRadius: '12px',
                          borderColor: isSelected ? 'var(--brand-green-text)' : 'var(--border-color)',
                          backgroundColor: isSelected ? 'color-mix(in srgb, var(--brand-green-text) 6%, var(--surface-elevated))' : 'var(--surface-elevated)',
                          boxShadow: isSelected ? '0 0 0 1px var(--brand-green-text)' : 'none',
                        }}
                      >
                        <div
                          className="w-full mb-3 border border-[var(--border-color)] overflow-hidden"
                          style={{ borderRadius: '8px', background: preview, height: 56, position: 'relative' }}
                        >
                          <div style={{ position: 'absolute', bottom: 6, left: 6, display: 'flex', gap: 3 }}>
                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,255,255,0.4)' }} />
                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,255,255,0.25)' }} />
                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,255,255,0.15)' }} />
                          </div>
                        </div>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <Icon className="w-3.5 h-3.5" style={{ color: isSelected ? 'var(--brand-green-text)' : 'var(--text-secondary)' }} />
                            <span style={{ fontSize: '13px', fontWeight: 600, color: isSelected ? 'var(--brand-green-text)' : 'var(--text-primary)' }}>
                              {label}
                            </span>
                          </div>
                          {isSelected && <Check className="w-3.5 h-3.5 text-[var(--brand-green-text)]" />}
                        </div>
                        <p style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.3, margin: 0 }}>
                          {description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </SectionCard>

              {/* Regional */}
              <SectionCard>
                <h3 className="text-[var(--text-primary)] mb-1">Regional & format</h3>
                <p className="text-[var(--text-secondary)] mb-2" style={{ fontSize: '14px' }}>
                  Control how dates, times, and language are displayed throughout the app.
                </p>
                <Separator className="mb-2" />

                <FieldRow label="Language">
                  <Select value={language} onValueChange={setLanguage}>
                    <SelectTrigger>
                      <Globe className="w-4 h-4 mr-2 text-[var(--text-secondary)]" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en-US">English (United States)</SelectItem>
                      <SelectItem value="en-GB">English (United Kingdom)</SelectItem>
                      <SelectItem value="es-ES">Español (España)</SelectItem>
                      <SelectItem value="fr-FR">Français (France)</SelectItem>
                      <SelectItem value="de-DE">Deutsch (Deutschland)</SelectItem>
                      <SelectItem value="pt-BR">Português (Brasil)</SelectItem>
                    </SelectContent>
                  </Select>
                </FieldRow>

                <FieldRow label="Date format">
                  <Select value={dateFormat} onValueChange={setDateFormat}>
                    <SelectTrigger>
                      <Calendar className="w-4 h-4 mr-2 text-[var(--text-secondary)]" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MM/DD/YYYY">MM/DD/YYYY (Mar 14, 2026)</SelectItem>
                      <SelectItem value="DD/MM/YYYY">DD/MM/YYYY (14/03/2026)</SelectItem>
                      <SelectItem value="YYYY-MM-DD">YYYY-MM-DD (2026-03-14)</SelectItem>
                    </SelectContent>
                  </Select>
                </FieldRow>

                <FieldRow label="Time format">
                  <Select value={timeFormat} onValueChange={setTimeFormat}>
                    <SelectTrigger>
                      <Clock className="w-4 h-4 mr-2 text-[var(--text-secondary)]" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="12h">12-hour (2:30 PM)</SelectItem>
                      <SelectItem value="24h">24-hour (14:30)</SelectItem>
                    </SelectContent>
                  </Select>
                </FieldRow>

                <FieldRow label="Default landing page" hint="Page shown after login">
                  <Select value={defaultPage} onValueChange={setDefaultPage}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="/">Dashboard</SelectItem>
                      <SelectItem value="/appointments">Appointments</SelectItem>
                      <SelectItem value="/clients">Clients</SelectItem>
                      <SelectItem value="/my-portal">My Portal</SelectItem>
                    </SelectContent>
                  </Select>
                </FieldRow>
              </SectionCard>

              {/* Display */}
              <SectionCard>
                <h3 className="text-[var(--text-primary)] mb-1">Display preferences</h3>
                <Separator className="mb-2" />
                <ToggleRow
                  label="Compact mode"
                  description="Reduce spacing in tables and lists to show more content on screen"
                  checked={compactMode}
                  onChange={setCompactMode}
                />
                <ToggleRow
                  label="Animations"
                  description="Enable transitions and animated effects throughout the app"
                  checked={animationsEnabled}
                  onChange={setAnimationsEnabled}
                />
                <SaveBar onSave={() => handleSave('appearance')} saved={savedSection === 'appearance'} />
              </SectionCard>
            </>
          )}

          {/* ═══════════════════════════════════════════════════ SECURITY */}
          {activeSection === 'security' && (
            <>
              {/* Password */}
              <SectionCard>
                <h3 className="text-[var(--text-primary)] mb-1">Change password</h3>
                <p className="text-[var(--text-secondary)] mb-2" style={{ fontSize: '14px' }}>
                  Use a strong password of at least 12 characters. We recommend including uppercase, lowercase, numbers, and symbols.
                </p>
                <Separator className="mb-2" />

                <FieldRow label="Current password">
                  <div className="relative">
                    <Input
                      type={showCurrentPw ? 'text' : 'password'}
                      value={currentPw}
                      onChange={(e) => setCurrentPw(e.target.value)}
                      placeholder="Enter current password"
                      className="pr-10"
                    />
                    <button
                      onClick={() => setShowCurrentPw(!showCurrentPw)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]"
                    >
                      {showCurrentPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </FieldRow>

                <FieldRow label="New password">
                  <div className="relative">
                    <Input
                      type={showNewPw ? 'text' : 'password'}
                      value={newPw}
                      onChange={(e) => setNewPw(e.target.value)}
                      placeholder="At least 12 characters"
                      className="pr-10"
                    />
                    <button
                      onClick={() => setShowNewPw(!showNewPw)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]"
                    >
                      {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {newPw.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {[
                        { label: 'At least 12 characters', met: newPw.length >= 12 },
                        { label: 'Uppercase letter',       met: /[A-Z]/.test(newPw) },
                        { label: 'Number',                 met: /\d/.test(newPw) },
                        { label: 'Special character',      met: /[^A-Za-z0-9]/.test(newPw) },
                      ].map(({ label, met }) => (
                        <div key={label} className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5" style={{ color: met ? 'var(--brand-green-text)' : 'var(--text-secondary)' }} />
                          <span style={{ fontSize: '12px', color: met ? 'var(--brand-green-text)' : 'var(--text-secondary)' }}>{label}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </FieldRow>

                <FieldRow label="Confirm new password">
                  <div className="relative">
                    <Input
                      type={showConfirmPw ? 'text' : 'password'}
                      value={confirmPw}
                      onChange={(e) => setConfirmPw(e.target.value)}
                      placeholder="Repeat new password"
                      className="pr-10"
                    />
                    <button
                      onClick={() => setShowConfirmPw(!showConfirmPw)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]"
                    >
                      {showConfirmPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {confirmPw.length > 0 && newPw !== confirmPw && (
                    <p className="text-[#d4183d] mt-1.5" style={{ fontSize: '12px' }}>Passwords do not match</p>
                  )}
                </FieldRow>

                {pwError && (
                  <p className="text-[#d4183d] mt-2" style={{ fontSize: '13px' }}>{pwError}</p>
                )}
                <div className="pt-4 flex justify-end">
                  <Button
                    disabled={!currentPw || !newPw || newPw !== confirmPw || newPw.length < 12 || saving}
                    onClick={() => handleSave('security')}
                  >
                    <Key className="w-4 h-4" />
                    {saving ? 'Updating…' : 'Update password'}
                  </Button>
                </div>
              </SectionCard>

              {/* 2FA */}
              <SectionCard>
                <div className="flex items-start justify-between gap-6">
                  <div>
                    <h3 className="text-[var(--text-primary)] mb-1">Two-factor authentication</h3>
                    <p className="text-[var(--text-secondary)] mt-1" style={{ fontSize: '14px' }}>
                      Add an extra layer of security to your account. When enabled, you'll need to enter a code from your authenticator app when logging in from a new device.
                    </p>
                    {twoFaEnabled && (
                      <div className="flex items-center gap-2 mt-3">
                        <span
                          className="inline-flex items-center gap-1.5 px-2.5 py-1"
                          style={{ backgroundColor: '#74C69D20', color: 'var(--brand-green-text)', borderRadius: '9999px', fontSize: '13px', fontWeight: 600 }}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Enabled — Authenticator app
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <Switch checked={twoFaEnabled} onCheckedChange={setTwoFaEnabled} />
                    {twoFaEnabled && (
                      <Button variant="outline" size="sm">Manage</Button>
                    )}
                  </div>
                </div>
              </SectionCard>

              {/* Session timeout */}
              <SectionCard>
                <h3 className="text-[var(--text-primary)] mb-1">Session settings</h3>
                <Separator className="mb-2" />
                <FieldRow label="Auto-logout after" hint="Idle sessions are signed out automatically">
                  <Select value={sessionTimeout} onValueChange={setSessionTimeout}>
                    <SelectTrigger className="max-w-[200px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1h">1 hour</SelectItem>
                      <SelectItem value="4h">4 hours</SelectItem>
                      <SelectItem value="8h">8 hours</SelectItem>
                      <SelectItem value="24h">24 hours</SelectItem>
                      <SelectItem value="never">Never</SelectItem>
                    </SelectContent>
                  </Select>
                </FieldRow>
                <SaveBar onSave={() => handleSave('session')} saved={savedSection === 'session'} />
              </SectionCard>

              {/* Active sessions */}
              <SectionCard>
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-[var(--text-primary)]">Active sessions</h3>
                  <Button variant="outline" size="sm" className="text-[#d4183d] border-[#d4183d] hover:bg-[#d4183d10] hover:text-[#d4183d]" onClick={signOutAll}>
                    <LogOut className="w-4 h-4" />
                    Sign out all
                  </Button>
                </div>
                <p className="text-[var(--text-secondary)] mb-5" style={{ fontSize: '14px' }}>
                  These devices are currently logged into your account.
                </p>

                <div className="space-y-3">
                  {sessionsLoading ? (
                    <p className="text-[var(--text-secondary)] text-center py-6" style={{ fontSize: '14px' }}>Loading sessions...</p>
                  ) : sessions.length === 0 ? (
                    <p className="text-[var(--text-secondary)] text-center py-6" style={{ fontSize: '14px' }}>No active sessions found.</p>
                  ) : sessions.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between p-4 border border-[var(--border-color)] bg-[var(--surface-elevated)]"
                      style={{ borderRadius: '10px' }}
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className="w-10 h-10 bg-[var(--surface-white)] border border-[var(--border-color)] flex items-center justify-center flex-shrink-0"
                          style={{ borderRadius: '8px' }}
                        >
                          <Smartphone className="w-5 h-5 text-[var(--text-secondary)]" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-[var(--text-primary)]" style={{ fontSize: '14px', fontWeight: 600 }}>
                              {s.device}
                            </p>
                            {s.is_current && (
                              <Badge variant="outline" className="border-[#2D6A4F] text-[var(--brand-green-text)]" style={{ fontSize: '11px' }}>
                                Current
                              </Badge>
                            )}
                          </div>
                          <p className="text-[var(--text-secondary)]" style={{ fontSize: '12px' }}>
                            {s.browser} · {s.location} · {formatRelativeTime(s.last_active_at)}
                          </p>
                        </div>
                      </div>
                      {!s.is_current && (
                        <Button variant="ghost" size="sm" className="text-[#d4183d] hover:text-[#d4183d]" onClick={() => revokeSession(s.id)}>
                          Revoke
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </SectionCard>

              {/* Login activity */}
              <SectionCard>
                <h3 className="text-[var(--text-primary)] mb-1">Recent login activity</h3>
                <p className="text-[var(--text-secondary)] mb-5" style={{ fontSize: '14px' }}>
                  Your last 5 login attempts.
                </p>
                <div className="overflow-hidden border border-[var(--border-color)]" style={{ borderRadius: '10px' }}>
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[var(--border-color)] bg-[var(--surface-elevated)]">
                        {['Date & Time', 'Device', 'Location', 'Status'].map((h) => (
                          <th key={h} className="px-4 py-3 text-left text-[var(--text-secondary)]" style={{ fontSize: '12px', fontWeight: 600 }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {loginActivity.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-4 py-6 text-center text-[var(--text-secondary)]" style={{ fontSize: '13px' }}>No login activity recorded yet.</td>
                        </tr>
                      ) : loginActivity.map((row) => (
                        <tr key={row.id} className="border-b border-[var(--border-color)] last:border-0">
                          <td className="px-4 py-3 text-[var(--text-secondary)]" style={{ fontSize: '13px' }}>
                            {new Date(row.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} — {new Date(row.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                          </td>
                          <td className="px-4 py-3 text-[var(--text-primary)]" style={{ fontSize: '13px' }}>{row.device}</td>
                          <td className="px-4 py-3 text-[var(--text-secondary)]" style={{ fontSize: '13px' }}>{row.location}</td>
                          <td className="px-4 py-3">
                            <span
                              className="inline-flex items-center gap-1.5 px-2.5 py-0.5"
                              style={{
                                backgroundColor: row.status === 'success' ? '#74C69D20' : '#d4183d20',
                                color: row.status === 'success' ? 'var(--brand-green-text)' : '#d4183d',
                                borderRadius: '9999px',
                                fontSize: '12px',
                                fontWeight: 600,
                              }}
                            >
                              {row.status === 'success' ? (
                                <><CheckCircle2 className="w-3 h-3" /> Success</>
                              ) : (
                                <><AlertTriangle className="w-3 h-3" /> Failed</>
                              )}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </SectionCard>
            </>
          )}

          {/* ══════════════════════════════════════════════ INTEGRATIONS */}
          {activeSection === 'integrations' && (
            <IntegrationsSection />
          )}

          {/* ════════════════════════════════════════════════════ BILLING */}
          {activeSection === 'billing' && (
            <>
              {/* Current plan */}
              <SectionCard>
                <div className="flex items-start justify-between gap-6">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-[var(--text-primary)]">Hugory Pro</h3>
                      <span
                        className="px-2.5 py-0.5 text-white"
                        style={{ backgroundColor: 'var(--brand-green-text)', borderRadius: '9999px', fontSize: '12px', fontWeight: 700 }}
                      >
                        Current plan
                      </span>
                    </div>
                    <p className="text-[var(--text-secondary)]" style={{ fontSize: '14px' }}>
                      $149 / month · Renews on April 14, 2026
                    </p>
                    <div className="flex flex-wrap gap-2 mt-4">
                      {[
                        'Unlimited clients',
                        'Unlimited records',
                        'Lab integration',
                        'PDF export',
                        'Email & SMS alerts',
                        '5 staff accounts',
                        'Priority support',
                      ].map((f) => (
                        <span
                          key={f}
                          className="flex items-center gap-1 px-2.5 py-1 bg-[var(--surface-elevated)] text-[var(--text-secondary)]"
                          style={{ borderRadius: '9999px', fontSize: '13px' }}
                        >
                          <Check className="w-3 h-3 text-[var(--brand-green-text)]" />
                          {f}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 flex-shrink-0">
                    <Button variant="outline" size="sm">Upgrade plan</Button>
                    <Button variant="ghost" size="sm" className="text-[#d4183d] hover:text-[#d4183d]">
                      Cancel subscription
                    </Button>
                  </div>
                </div>
              </SectionCard>

              {/* Usage */}
              <SectionCard>
                <h3 className="text-[var(--text-primary)] mb-1">Usage this month</h3>
                <p className="text-[var(--text-secondary)] mb-5" style={{ fontSize: '14px' }}>
                  Billing period: March 1 – March 31, 2026
                </p>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: 'Active clients',     used: 248,   limit: null,   unit: 'clients'     },
                    { label: 'Appointments',        used: 187,   limit: null,   unit: 'this month'  },
                    { label: 'Medical records',     used: 1_542, limit: null,   unit: 'total'       },
                    { label: 'File storage',        used: 4.2,   limit: 20,     unit: 'GB'          },
                    { label: 'SMS messages sent',   used: 312,   limit: 500,    unit: 'messages'    },
                    { label: 'Staff accounts',      used: 3,     limit: 5,      unit: 'accounts'    },
                  ].map(({ label, used, limit, unit }) => {
                    const pct = limit ? Math.round((used / limit) * 100) : null;
                    return (
                      <div key={label} className="p-4 border border-[var(--border-color)] bg-[var(--surface-elevated)]" style={{ borderRadius: '10px' }}>
                        <p className="text-[var(--text-secondary)] mb-1" style={{ fontSize: '12px', fontWeight: 600 }}>{label.toUpperCase()}</p>
                        <p className="text-[var(--text-primary)]" style={{ fontSize: '22px', fontWeight: 700 }}>
                          {used.toLocaleString()}
                          {limit && <span className="text-[var(--text-secondary)]" style={{ fontSize: '14px', fontWeight: 400 }}> / {limit.toLocaleString()}</span>}
                          <span className="text-[var(--text-secondary)]" style={{ fontSize: '13px', fontWeight: 400, marginLeft: '4px' }}>{unit}</span>
                        </p>
                        {pct !== null && (
                          <div className="mt-2">
                            <div className="h-1.5 bg-[var(--border-color)]" style={{ borderRadius: '9999px' }}>
                              <div
                                className="h-full transition-all"
                                style={{
                                  width: `${pct}%`,
                                  borderRadius: '9999px',
                                  backgroundColor: pct > 80 ? '#F4A261' : 'var(--brand-green-text)',
                                }}
                              />
                            </div>
                            <p className="text-[var(--text-secondary)] mt-1" style={{ fontSize: '11px' }}>{pct}% used</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </SectionCard>

              {/* Payment method */}
              <SectionCard>
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h3 className="text-[var(--text-primary)] mb-1">Payment method</h3>
                    <p className="text-[var(--text-secondary)]" style={{ fontSize: '14px' }}>
                      Manage your billing card and address.
                    </p>
                  </div>
                  <Button variant="outline" size="sm">Add new card</Button>
                </div>

                <div
                  className="flex items-center justify-between p-4 border border-[var(--border-color)] bg-[var(--surface-elevated)]"
                  style={{ borderRadius: '10px' }}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className="w-12 h-8 bg-[#1A1A2E] flex items-center justify-center"
                      style={{ borderRadius: '6px' }}
                    >
                      <span style={{ color: '#fff', fontSize: '10px', fontWeight: 700 }}>VISA</span>
                    </div>
                    <div>
                      <p className="text-[var(--text-primary)]" style={{ fontSize: '14px', fontWeight: 600 }}>
                        Visa ending in 4242
                      </p>
                      <p className="text-[var(--text-secondary)]" style={{ fontSize: '12px' }}>
                        Expires 09/2028 · Dr. Sarah Chen
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="border-[#2D6A4F] text-[var(--brand-green-text)]" style={{ fontSize: '11px' }}>Default</Badge>
                    <Button variant="ghost" size="sm">Edit</Button>
                    <Button variant="ghost" size="sm" className="text-[#d4183d] hover:text-[#d4183d]">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </SectionCard>

              {/* Billing history */}
              <SectionCard>
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h3 className="text-[var(--text-primary)] mb-1">Billing history</h3>
                    <p className="text-[var(--text-secondary)]" style={{ fontSize: '14px' }}>
                      Download past invoices for your records.
                    </p>
                  </div>
                </div>

                <div className="overflow-hidden border border-[var(--border-color)]" style={{ borderRadius: '10px' }}>
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[var(--border-color)] bg-[var(--surface-elevated)]">
                        {['Invoice', 'Date', 'Amount', 'Status', ''].map((h, i) => (
                          <th
                            key={i}
                            className="px-4 py-3 text-left text-[var(--text-secondary)]"
                            style={{ fontSize: '12px', fontWeight: 600 }}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { invoice: 'INV-2026-003', date: 'Mar 14, 2026', amount: '$149.00', status: 'Paid' },
                        { invoice: 'INV-2026-002', date: 'Feb 14, 2026', amount: '$149.00', status: 'Paid' },
                        { invoice: 'INV-2026-001', date: 'Jan 14, 2026', amount: '$149.00', status: 'Paid' },
                        { invoice: 'INV-2025-012', date: 'Dec 14, 2025', amount: '$149.00', status: 'Paid' },
                        { invoice: 'INV-2025-011', date: 'Nov 14, 2025', amount: '$149.00', status: 'Paid' },
                        { invoice: 'INV-2025-010', date: 'Oct 14, 2025', amount: '$99.00',  status: 'Paid' },
                      ].map((row) => (
                        <tr key={row.invoice} className="border-b border-[var(--border-color)] last:border-0 hover:bg-[var(--surface-elevated)] transition-colors">
                          <td className="px-4 py-3 text-[var(--text-primary)]" style={{ fontSize: '14px', fontWeight: 600 }}>
                            {row.invoice}
                          </td>
                          <td className="px-4 py-3 text-[var(--text-secondary)]" style={{ fontSize: '14px' }}>
                            {row.date}
                          </td>
                          <td className="px-4 py-3 text-[var(--text-primary)]" style={{ fontSize: '14px', fontWeight: 600 }}>
                            {row.amount}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className="inline-flex items-center gap-1 px-2.5 py-0.5"
                              style={{
                                backgroundColor: '#74C69D20',
                                color: 'var(--brand-green-text)',
                                borderRadius: '9999px',
                                fontSize: '12px',
                                fontWeight: 600,
                              }}
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              {row.status}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <Button variant="ghost" size="sm" className="text-[var(--brand-green-text)] hover:text-[var(--brand-green-text)]">
                              Download
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </SectionCard>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
