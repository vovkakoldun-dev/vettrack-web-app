# HugoIT (VetTrack) Architecture

> Single source of truth for all development. Update this file **before** writing any code.

---

## 1. Platform Overview

HugoIT is a multi-tenant veterinary clinic management SaaS. One Supabase backend serves all clinics. Data is isolated by `organization_id` and `clinic_id`.

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite, React Router v6 |
| Styling | Tailwind CSS 4, Shadcn/UI (Radix), CSS variables |
| Backend | Supabase (PostgreSQL, Storage, Auth, RLS) |
| Hosting | Vercel |
| Project ID | `gxrdzwgitbsbfxtakpbr` |

---

## 2. Multi-Tenant Structure

```
Organization (org)
  └── Clinic (1:N)
        ├── Staff (1:N)
        ├── Clients (1:N)
        │     └── Pets (1:N)
        ├── Appointments
        ├── Records
        ├── Invoices
        └── Tasks
```

### Default IDs (dev)

| Entity | UUID |
|--------|------|
| Organization | `00000000-0000-0000-0000-000000000001` |
| Clinic | `00000000-0000-0000-0000-000000000002` |

### Rules

1. Every data table has `organization_id` (uuid, FK to `organizations`).
2. Clinic-scoped tables also carry `clinic_id` (FK to `clinics`).
3. RLS policies must filter by `organization_id` — currently permissive (`USING (true)`) for dev.
4. New clinics are created from the System Admin portal and inserted into the `clinics` table.
5. Cross-org data access is **never** allowed.

---

## 3. Portals & Routing

The app has **5 portal shells**, each with its own sidebar and route tree.

| Portal | Route Prefix | Shell Component | Sidebar | Login Role |
|--------|-------------|-----------------|---------|------------|
| Doctor / Vet | `/*` | `MainApp` | `Sidebar` | `doctor` |
| Front Desk / Admin | `/admin/*` | `AdminApp` | `AdminSidebar` | `admin` |
| Pet Owner | `/owner/*` | `OwnerApp` | `OwnerSidebar` | `patient` |
| Super Admin | `/superadmin/*` | `SuperAdminApp` | `SuperAdminSidebar` | `superadmin` |
| System Admin | `/sysadmin` | `SystemAdminPage` | none (standalone) | `sysadmin` |

### Full Route Map

**Doctor Portal (`/*`)**
| Route | Page |
|-------|------|
| `/` | DashboardPage |
| `/clients` | ClientsPage |
| `/clients/:id` | ClientDetailPage |
| `/appointments` | AppointmentsPage |
| `/appointments/:id/visit` | VisitPage |
| `/appointments/:id/checkout` | CheckoutPage |
| `/records` | RecordsPage |
| `/records/:id` | RecordDetailPage |
| `/lab` | LabPage |
| `/notifications` | NotificationsPage |
| `/my-portal` | MyPortalPage |
| `/my-portal/patients` | MyPatientsPage |
| `/settings` | SettingsPage |
| `/vaccines` | VaccinesPage |
| `/pets` | PetsPage |
| `/chat` | ChatPage |

**Admin Portal (`/admin/*`)**
| Route | Page |
|-------|------|
| `/admin` | AdminDashboardPage |
| `/admin/bookings` | AdminBookingsPage |
| `/admin/payments` | AdminPaymentsPage |
| `/admin/communications` | AdminCommunicationsPage |
| `/admin/notifications` | NotificationsPage (shared) |
| `/admin/clients` | AdminClientsPage |
| `/admin/clients/:id` | ClientDetailPage (shared) |
| `/admin/records` | RecordsPage (shared) |
| `/admin/records/:id` | RecordDetailPage (shared) |
| `/admin/lab` | LabPage (shared) |
| `/admin/my-portal` | AdminMyPortalPage |
| `/admin/chat` | AdminChatPage |
| `/admin/tasks` | AdminTasksPage |
| `/admin/settings` | AdminSettingsPage |

**Owner Portal (`/owner/*`)**
| Route | Page |
|-------|------|
| `/owner` | OwnerDashboardPage |
| `/owner/pets` | OwnerPetsPage |
| `/owner/pets/:id` | OwnerPetProfilePage |
| `/owner/appointments` | OwnerAppointmentsPage |
| `/owner/records` | OwnerRecordsPage |
| `/owner/records/:id` | OwnerRecordDetailPage |
| `/owner/invoices` | OwnerInvoicesPage |
| `/owner/messages` | OwnerDashboardPage |
| `/owner/contact` | OwnerContactPage |

**Super Admin Portal (`/superadmin/*`)**
| Route | Page |
|-------|------|
| `/superadmin` | SuperAdminDashboardPage |
| `/superadmin/staff` | SuperAdminStaffPage |
| `/superadmin/analytics` | SuperAdminAnalyticsPage |
| `/superadmin/portals` | SuperAdminPatientPortalsPage |
| `/superadmin/billing` | SuperAdminBillingPage |
| `/superadmin/settings` | SuperAdminSettingsPage |
| `/superadmin/chat` | SuperAdminChatPage |
| `/superadmin/services` | SuperAdminServicesPage |

**Standalone**
| Route | Page |
|-------|------|
| `/login` | LoginPage |
| `/sysadmin` | SystemAdminPage |

---

## 4. Roles

### `user_role` Enum (12 values)

| Role | Portal Access | Description |
|------|--------------|-------------|
| `superadmin` | Super Admin, Admin | Platform-wide admin |
| `clinic_manager` | Admin | Clinic-level management |
| `front_desk_manager` | Admin | Front desk supervisor |
| `receptionist` | Admin | Front desk staff |
| `veterinarian` | Doctor | Licensed veterinarian |
| `senior_veterinarian` | Doctor | Senior / lead vet |
| `lead_vet_tech` | Doctor | Lead veterinary technician |
| `vet_technician` | Doctor | Veterinary technician |
| `specialist` | Doctor | Specialist veterinarian |
| `groomer` | Doctor | Grooming specialist |
| `lab_technician` | Doctor | Lab analyst |
| `owner` | Owner | Pet owner / client |

### Role Filter Groups (used in queries)

```ts
// Doctor-side staff
const DOCTOR_ROLES = ['veterinarian', 'senior_veterinarian', 'lead_vet_tech', 'specialist'];

// Admin-side staff
const ADMIN_ROLES  = ['front_desk_manager', 'receptionist', 'clinic_manager', 'superadmin'];
```

**Critical rule:** Always filter `staff` queries by role group to prevent portals from showing each other's data.

---

## 5. Database Schema

### Core Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `organizations` | Top-level tenant | `id`, `name`, `slug`, `plan` |
| `clinics` | Physical locations | `id`, `organization_id`, `name`, `address`, `phone`, `email`, `is_dev`, `status`, `last_synced_at` |
| `staff` | All employees | `id`, `organization_id`, `clinic_id`, `first_name`, `last_name`, `email`, `phone`, `role`, `photo_url`, `chat_read_at`, `status`, `department` |
| `clients` | Pet owners | `id`, `organization_id`, `first_name`, `last_name`, `email`, `phone`, `created_at`, `is_active` |
| `pets` | Animals | `id`, `client_id`, `organization_id`, `name`, `species`, `breed`, `date_of_birth`, `sex`, `weight`, `microchip_id`, `photo_url`, `assigned_vet_id`, `is_active` |
| `appointments` | Scheduling | `id`, `organization_id`, `clinic_id`, `client_id`, `pet_id`, `vet_id`, `service_id`, `scheduled_at`, `duration_minutes`, `status`, `reason`, `notes`, `room` |
| `services` | Service catalog | `id`, `organization_id`, `name`, `category`, `base_price`, `duration_minutes`, `is_active` |

### Medical Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `medical_records` | Patient records | `id`, `organization_id`, `clinic_id`, `pet_id`, `vet_id`, `type`, `status`, `summary`, `created_at` |
| `record_vitals` | Vitals snapshot | `record_id`, `weight`, `temperature`, `heart_rate`, `respiratory_rate`, `blood_pressure` |
| `record_diagnoses` | Diagnoses | `record_id`, `type` (primary/secondary/differential), `name`, `icd_code` |
| `record_treatments` | Treatments | `record_id`, `procedure_name`, `notes` |
| `vaccinations` | Vaccine schedules | `id`, `pet_id`, `vaccine_name`, `administered_date`, `next_due_date`, `batch_number` |
| `imaging_studies` | Radiology / imaging studies (per-pet) | `id`, `organization_id`, `clinic_id`, `pet_id`, `performed_by` (FK staff), `radiologist`, `title`, `modality`, `region`, `study_date`, `findings`, `impression`, `status` (pending/reviewed), `created_at` |
| `imaging_study_files` | Images inside an imaging study | `id`, `study_id` (FK cascade), `file_url`, `storage_path`, `file_name`, `file_type`, `file_size`, `view_label`, `sort_order`, `uploaded_by`, `created_at` |
| `surgeries` | Surgical procedures (per-pet) | `id`, `organization_id`, `clinic_id`, `pet_id`, `surgeon_id` (FK staff), `assistant`, `name`, `surgery_date`, `duration_minutes`, `anesthesia`, `pre_op`, `procedure_notes`, `post_op`, `complications`, `follow_up`, `status` (Scheduled / In Progress / Recovered / Complications / Deceased) |
| `pet_allergies` | Allergies | `id`, `pet_id`, `allergen`, `severity` |
| `pet_conditions` | Problems / chronic conditions (rendered as the "Problems" section inside Medical Overview). Each row supports severity + SOAP notes. | `id`, `organization_id`, `pet_id`, `name`, `severity` (mild/moderate/severe), `status` (active/resolved), `date_diagnosed`, `resolved_date`, `soap_s`, `soap_o`, `soap_a`, `soap_p`, `notes`, `updated_at`, `created_at` |
| `pet_treatments` | Treatment history | `id`, `pet_id`, `treatment_name`, `date` |
| `lab_results` | Lab tests | `id`, `record_id`, `test_name`, `result`, `reference_range`, `unit`, `flag` |
| `medications` | Medication catalog | `id`, `name`, `dosage`, `route`, `frequency` |
| `treatment_plans` | Long-term treatment plans per pet. Rendered as the "Plan" tab in ClientDetailPage. | `id`, `organization_id`, `clinic_id`, `pet_id`, `title`, `status` (active/completed/paused/cancelled), `last_review_date`, `next_review_date`, `notes`, `created_by` (FK staff), `created_at`, `updated_at` |
| `treatment_plan_goals` | Goals inside a treatment plan (progress-tracked) | `id`, `plan_id` (FK cascade), `text`, `progress` (0–100), `status` (on-track/at-risk/off-track), `sort_order` |
| `treatment_plan_milestones` | Timeline milestones for a plan | `id`, `plan_id` (FK cascade), `milestone_date`, `title`, `note`, `status` (upcoming/done), `sort_order` |
| `treatment_plan_medications` | Medications in the plan's protocol | `id`, `plan_id` (FK cascade), `name`, `dose`, `purpose`, `sort_order` |
| `diet_plans` | Current feeding regimen per pet. Rendered as the "Diet" tab in ClientDetailPage. | `id`, `organization_id`, `clinic_id`, `pet_id`, `food_brand`, `food_name`, `food_type`, `daily_amount`, `meals`, `calories`, `water_note`, `treats_note`, `target_weight_kg`, `started_on`, `status` (active/archived), `notes`, `created_by` (FK staff), `created_at`, `updated_at` |
| `diet_restrictions` | Foods to avoid for a diet plan | `id`, `plan_id` (FK cascade), `item`, `reason`, `severity` (strict/moderate), `sort_order` |
| `pet_weight_history` | Weight log entries (used by Diet tab Weight Progress chart) | `id`, `organization_id`, `pet_id`, `weight_kg`, `recorded_at` (date), `recorded_by` (FK staff), `notes`, `created_at` |
| `pet_photos` | Photo gallery per pet. Rendered as the "Photos" tab in ClientDetailPage. Files stored in the `pet-photos` storage bucket. | `id`, `organization_id`, `clinic_id`, `pet_id`, `title`, `caption`, `category` (clinical/progress/general), `tags` (text[]), `photo_date`, `file_url`, `storage_path`, `file_name`, `file_type`, `file_size`, `uploaded_by` (FK staff), `created_at`, `updated_at` |
| `pet_reports` | Auto-generated full-patient-snapshot PDFs. Rendered as the "Reports" tab (last tab) in ClientDetailPage. A new row+PDF is created every time data is logged in any other tab (diet, photo, plan, problem, injection, surgery, xray, visit, note, weight), plus manual generations. PDFs stored in the `pet-reports` storage bucket. Generated server-side via `src/app/utils/generatePetReport.ts` using jsPDF. | `id`, `organization_id`, `clinic_id`, `pet_id`, `title`, `summary`, `trigger_source` (manual/diet/photo/injection/surgery/xray/plan/problem/weight/visit/note), `sections_count`, `file_url`, `storage_path`, `file_name`, `file_size`, `generated_by` (FK staff), `created_at` |

### Financial Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `invoices` | Client invoices | `id`, `organization_id`, `client_id`, `clinic_id`, `status`, `total`, `due_date` |
| `invoice_line_items` | Line items | `id`, `invoice_id`, `description`, `quantity`, `unit_price` |
| `payments` | Payment records | `id`, `invoice_id`, `amount`, `method`, `paid_at` |
| `organization_billing` | SaaS billing | `id`, `organization_id`, `plan`, `cycle`, `next_billing_date` |
| `platform_invoices` | Platform invoices | `id`, `organization_id`, `amount`, `period_start`, `period_end` |

### Communication Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `conversations` | Chat conversations | `id`, `organization_id`, `type` (direct/group), `title`, `created_by`, `created_at` |
| `conversation_participants` | Chat members | `id`, `conversation_id`, `profile_id`, `last_read_at`, `is_admin`, `joined_at` |
| `messages` | Chat messages | `id`, `conversation_id`, `sender_id` (FK profiles.id), `content`, `image_url`, `created_at` |

### Operations Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `tasks` | Front-desk tasks | `id`, `organization_id`, `type`, `priority`, `status`, `due_date`, `due_time`, `pet_name`, `owner_name`, `assigned_by`, `doctor_notes`, `tags[]`, `completed_at` |
| `notification_events` | Notification triggers | `id` (text PK), `type`, `timestamp`, `data` (jsonb), `organization_id` |
| `notification_state` | Per-user read/dismissed state | `notification_id` (text), `user_id` (uuid FK auth.users, NOT NULL), `status` (read/dismissed), `updated_at`, `organization_id` — PK: (notification_id, user_id) |
| `staff_time_blocks` | Staff scheduling | `id`, `staff_id`, `block_type`, `date_from`, `date_to`, `time_start`, `time_end` |
| `staff_ratings` | Performance | `id`, `staff_id`, `rating`, `review` |
| `staff_specializations` | Expertise | `id`, `staff_id`, `specialization` |
| `audit_logs` | Compliance trail | `id`, `organization_id`, `action`, `entity_type`, `entity_id`, `performed_by`, `details` |
| `profiles` | Supabase Auth link | `id` (= auth.uid), `role`, `organization_id` |

### User Settings Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `user_sessions` | Active device sessions | `id`, `user_id` (FK auth.users), `device`, `browser`, `location`, `ip_address`, `is_current`, `session_token` (unique), `last_active_at`, `created_at` |
| `login_activity` | Login audit log | `id`, `user_id` (FK auth.users), `device`, `browser`, `location`, `ip_address`, `status` (success/failed), `created_at` |
| `notification_preferences` | Per-user in-app notification toggles | `id`, `user_id` (FK auth.users, unique), `appt_new`, `appt_cancel`, `appt_reminder`, `appt_reschedule`, `lab_ready`, `lab_critical`, `invoice_gen`, `payment_recv`, `plan_expiry`, `system_updates`, `updated_at` |
| `user_theme_preferences` | Per-user theme preferences (all portals) | `user_id` (uuid PK, FK auth.users), `preferences` (jsonb — stores all portal theme keys), `updated_at` |

> All four tables use RLS scoped to `auth.uid() = user_id`. No `organization_id` needed — these are per-user settings, not tenant data.

### Database Views

| View | Purpose |
|------|---------|
| `v_appointment_cards` | Denormalized appointment data for card display |
| `v_invoice_summary` | Invoice totals with client info |
| `v_portal_users` | Client portal access summary |
| `v_record_cards` | Denormalized medical record display |

---

## 6. Enums Reference

| Enum | Values |
|------|--------|
| `appointment_status` | Scheduled, Confirmed, In Progress, Completed, Cancelled, No Show |
| `record_status` | Draft, Pending Review, Amended, Final |
| `record_type` | Visit, Vaccination, Lab Result, Surgery, Prescription, Dental, Imaging |
| `service_category` | Wellness, Vaccinations, Surgery, Dental, Lab & Imaging, Emergency, Prescriptions, Specialist |
| `invoice_status` | Draft, Sent, Paid, Partial, Overdue, Cancelled |
| `payment_method` | Credit Card, Debit Card, Cash, Check, Insurance, Financing, Other |
| `pet_sex` | Male, Female, Male (Neutered), Female (Spayed), Unknown |
| `lab_flag` | normal, high, low, critical |
| `medication_route` | Oral, Topical, Injectable, Ophthalmic, Otic, Nasal, Transdermal, Inhaled |
| `staff_status` | Active, On Leave, Inactive, Probation |
| `staff_department` | Clinical, Front Desk, Management, Support, Lab |
| `task_priority` | low, medium, high, urgent |
| `task_status` | todo, in_progress, done, cancelled |
| `org_plan` | starter, growth, enterprise |
| `billing_cycle` | monthly, annual |
| `conversation_type` | direct, group |
| `diagnosis_type` | primary, secondary, differential |
| `portal_account_status` | Active, Inactive, Warned, Suspended |
| `audit_action` | create, update, delete, login, logout, export, reminder_sent, account_deactivated |

---

## 7. Supabase Storage

### Buckets

| Bucket | Purpose | Path Convention | Public |
|--------|---------|----------------|--------|
| `avatars` | User profile avatars | `user-{profileId}.png` (upsert) | Yes |
| `pet-images` | Pet profile images | `{clientId}/{timestamp}.{ext}` | Yes |
| `chat-images` | Chat message attachments | `msg-{timestamp}.png` | No (private) |
| `lab-files` | Lab result files (PDF / images) | `{timestamp}-{rand}.{ext}` | Yes |
| `imaging-studies` | Radiology images (X-ray / US / CT / MRI) | `{petId}/{studyId}/{timestamp}-{i}-{rand}.{ext}` | Yes |

### Rules

1. **Never store images in the database.** Only the public/signed URL is saved (`avatar_url` in `profiles`, `photo_url` in `pets`, `image_url` in `messages`).
2. **Never store images as base64** or in localStorage.
3. Profile avatars use `upsert: true` — the old file is replaced automatically, no manual delete needed.
4. Pet photos use `upsert: true` — path: `{clientId}/{timestamp}.{ext}`.
5. Chat images use path: `msg-{timestamp}.png`. URL is stored in `messages.image_url`.
6. Append `?t={timestamp}` to URLs for cache-busting after upload.
7. Avatar upload/remove is centralised in `useProfile.ts` via `uploadAvatar()` and `removeAvatar()` functions.

---

## 8. Chat System

### Relational Structure

Uses three tables: `conversations`, `conversation_participants`, and `messages`.

| Table | Purpose |
|-------|---------|
| `conversations` | Each conversation has a type (`direct`/`group`) and belongs to an organization |
| `conversation_participants` | Links profiles to conversations, stores per-user `last_read_at` |
| `messages` | Each message has `sender_id` (FK to `profiles.id`), `conversation_id`, `content`, optional `image_url` |

### Default Conversation (dev)

| Conversation ID | Type | Participants |
|----------------|------|-------------|
| `11111111-1111-1111-1111-111111111111` | direct | Admin ↔ Doctor |

### How It Works

1. Messages stored with `sender_id = user.id` (from auth). Sender identity determined by UUID comparison, not string names.
2. **Sender display name**: Join `profiles` table on `sender_id` to get `first_name`, `last_name`.
3. **Image attachments**: Uploaded to `chat-images` bucket as `msg-{timestamp}.png`. URL stored in `messages.image_url`.
4. **Unread tracking**: `conversation_participants.last_read_at` per user per conversation. Messages after this timestamp are unread.
5. **Badge logic**: Sidebar shows `1` if any unread messages exist (binary, not count).
6. **Read receipt**: On opening chat, update `conversation_participants.last_read_at` to `now()` and dispatch custom event (`adminChatRead` / `doctorChatRead`).
7. Polling interval: 3 seconds for unread check.

### Race Condition Prevention

Load `last_read_at` from `conversation_participants` **before** starting the unread polling interval. Otherwise all messages appear unread against the default `1970` timestamp.

---

## 9. Notification System

### Architecture

```
Event Producers (pages that create events)
  → notification_events table (Supabase)
    → Consumers (NotificationsPage, Sidebar badge)
      → notification_state table (read/dismissed tracking)
```

### Event Types

| Type | Trigger | Producer Pages |
|------|---------|---------------|
| `vet_assign` | Vet assigned to a pet | AddClientDialog, ClientDetailPage, ClientsPage |
| `vet_unassign` | Vet unassigned from pet | ClientDetailPage, ClientsPage |
| `appt_assign` | Appointment assigned to vet | AppointmentsPage, AdminBookingsPage |
| `lab_ready` | Lab result uploaded for pet | LabPage |

### `notification_events` Table

```
id        text PK     -- e.g. "assign-{petId}-{timestamp}"
type      text        -- "vet_assign" | "vet_unassign" | "appt_assign"
timestamp timestamptz
data      jsonb       -- { petId, petName, ownerName, vetId, vetName, ... }
```

### `notification_state` Table

```
notification_id  text PK  -- matches notification_events.id or generated IDs
status           text     -- "read" | "dismissed"
updated_at       timestamptz
```

### Built-in Notifications (computed from Supabase data)

These are NOT stored in `notification_events` — they're computed live by `NotificationsPage`:

- Appointments today
- Completed appointments (7-day window)
- Cancelled appointments (7-day window)
- Overdue vaccinations
- New client registrations (7-day window)

### Cross-component Communication

Custom DOM events keep sidebar badges in sync without polling:

| Event | Dispatched By | Listened By |
|-------|--------------|-------------|
| `notifCountChanged` | NotificationsPage, assignment pages | Sidebar |
| `adminChatRead` | AdminChatPage | AdminSidebar |
| `doctorChatRead` | ChatPage | Sidebar |
| `adminPhotoChanged` | AdminSettingsPage | AdminSidebar |
| `adminProfileChanged` | AdminSettingsPage | AdminSidebar |
| `staffPhotoChanged` | SettingsPage | Sidebar |
| `showToast` | Sidebar, AdminSidebar (polling) | ToastNotification |

### Toast Notifications

A global `ToastNotification` component (mounted in `App.tsx`) shows bottom-right popups for new messages and notifications.

| Feature | Detail |
|---------|--------|
| Component | `src/app/components/ToastNotification.tsx` |
| Trigger | `showToast({ type, title, message, link })` custom event |
| Types | `chat` (blue icon) / `notification` (green icon) |
| Auto-dismiss | 5 seconds |
| Max visible | 3 toasts stacked |
| Navigation | Clicking a toast navigates to `link` and dismisses it |
| Suppression | Not shown when user is already on the target page |

**Usage from any component:**
```ts
import { showToast } from './components/ToastNotification';
showToast({ type: 'chat', title: 'Admin', message: 'New message', link: '/chat' });
```

---

## 10. Tasks System

### Table: `tasks`

Managed by the admin portal (`AdminTasksPage`). Tasks are created from:

1. **Visit completion** (`VisitPage`) — doctor creates follow-up tasks for front desk.
2. **Checkout** (`CheckoutPage`) — auto-creates billing notification task.
3. **Manual creation** (future) — admin creates tasks directly.

### Task Lifecycle

```
Pending → In Progress → Completed
                      → Deleted (hard delete)
```

Status changes and deletes are persisted to Supabase immediately.

---

## 11. Clinic Management (System Admin)

### `/sysadmin` Portal

- Shows all clinics from the `clinics` table.
- Dev clinic is marked with `is_dev = true` and cannot be deleted.
- "Add Clinic" creates a new row with `is_dev = false` and `status = 'active'`.
- "Update from Dev" sets `last_synced_at = now()` (placeholder for future data sync).
- "Remove" hard-deletes the clinic.
- Clicking a clinic card stores `{ id, name, is_dev }` in `localStorage('selected_clinic')` and navigates to `/` (doctor portal).

### Clinic Card in Doctor Portal

The selected clinic name is displayed in:
- Sidebar (below logo, with green status dot)
- Dashboard subtitle

---

## 12. Profile System

### Single Source of Truth: `profiles` table

All user identity data (name, email, phone, avatar) lives in the `profiles` table. No other table stores this data.

```
profiles
  ├── id (uuid PK) — same as staff.id for now (will be auth.uid later)
  ├── first_name, last_name, email, phone
  ├── avatar_url — profile photo URL from Supabase Storage
  ├── role — user_role enum
  ├── organization_id — FK to organizations
  └── is_active, created_at, updated_at
```

### Hook: `useProfile(portal)`

```ts
import { useProfile, updateProfile, updateProfileAvatar } from '../hooks/useProfile';

const { profile, loading, refetch } = useProfile('doctor'); // or 'admin'
// profile.id, .firstName, .lastName, .fullName, .displayName, .initials
// profile.email, .phone, .avatarUrl, .role

// Writes:
await updateProfile(profileId, { first_name, last_name, email, phone });
await updateProfileAvatar(profileId, url);  // or null to remove
```

### Rules

1. **All reads** go through `useProfile()` hook — never query `staff` for name/email/phone/photo.
2. **All writes** go through `updateProfile()` / `updateProfileAvatar()` — never update `staff` for profile fields.
3. The hook has a 30s in-memory cache and listens for custom events (`adminProfileChanged`, `doctorProfileChanged`, `adminPhotoChanged`, `staffPhotoChanged`) for instant cross-component sync.
4. `staff` table retains **operational fields only**: `clinic_id`, `department`, `status`, `chat_read_at`, `license_no`, `bio`, `schedule`, `job_title`, `specialization`.
5. `staff.profile_id` links to `profiles.id` (currently set to same UUID).
6. Vet dropdown lists (for assignment) still query `staff` for `id, first_name, last_name` — these list multiple staff, not the current user's profile.

### Relationship

```
profiles (1) ←──── staff (1)    via staff.profile_id = profiles.id
   │
   └── Identity: name, email, phone, avatar, role
         Staff: clinic, department, schedule, chat_read_at, license
```

---

## 14. Authentication

Supabase Auth with email/password sign-up and sign-in.

### Architecture

| Layer | File | Responsibility |
|-------|------|----------------|
| Context | `src/app/context/AuthContext.tsx` | Global `AuthProvider` wrapping the entire app. Exposes `session`, `user`, `loading`, `signUp`, `signIn`, `signOut` via `useAuth()` hook. |
| Route guards | `src/app/App.tsx` | `ProtectedRoute` — redirects to `/login` if no user. `PublicRoute` — redirects to `/` if already signed in. |
| Login UI | `src/app/pages/LoginPage.tsx` | Toggle between sign-in and sign-up modes. Uses `useAuth().signIn` / `signUp`. Portal picker preserved for post-login navigation. |
| Logout | All 4 sidebars | "Log out" button calls `await signOut()` then `navigate('/login')`. |

### Signup Flow

1. User enters email + password on `/login` in sign-up mode.
2. `supabase.auth.signUp()` creates a row in `auth.users`.
3. Database trigger `handle_new_user` auto-creates a `profiles` row with `id = auth.uid`, `role = 'clinic_manager'`, `organization_id = NULL`.
4. User is signed in automatically and redirected to the selected portal.

### Session Persistence

- `supabase.auth.getSession()` restores the session on page load.
- `supabase.auth.onAuthStateChange()` keeps `session` / `user` state in sync across tabs and token refreshes.
- Loading spinner with PawPrint logo shown while session is being resolved.

### Future Work

- RLS policies using `auth.uid()` and `profiles.organization_id` for tenant isolation.
- Role-based route guards (e.g., only `clinic_manager` can access `/admin/*`).

---

## 13. Cross-Page Data Synchronisation

### Principle

**Single source of truth = Supabase.** Every data mutation writes to Supabase first, then dispatches a custom DOM event so all mounted components re-fetch fresh data. No stale caches, no local copies — the UI always reflects the database.

### Custom Events

| Event | Dispatched By | Listened By |
|-------|---------------|-------------|
| `clientDataChanged` | `useClients` (add/update/delete), `ClientsPage` (status change), `AdminClientsPage`, `ClientDetailPage` (save) | `useClients`, `usePets`, `useAppointments`, `useDashboardStats`, `ClientDetailPage` |
| `petDataChanged` | `usePets` (add/update/deactivate), `ClientDetailPage` (add pet, vet assign/unassign), `ClientsPage` (vet assign/unassign), `AppointmentsPage`, `AdminBookingsPage` | `useClients`, `usePets`, `useAppointments`, `useDashboardStats`, `ClientDetailPage` |
| `appointmentDataChanged` | `useAppointments` (add/updateStatus/delete) | `useDashboardStats`, `ClientDetailPage` |
| `doctorProfileChanged` | `SettingsPage` (profile save) | `useProfile('doctor')` → Sidebar, Dashboard, Chat, MyPortal |
| `adminProfileChanged` | `AdminSettingsPage` (profile save) | `useProfile('admin')` → AdminSidebar, AdminDashboard, AdminChat, AdminMyPortal |
| `staffPhotoChanged` | `uploadAvatar()` / `removeAvatar()` (doctor) | `useProfile('doctor')` → all doctor portal UI |
| `adminPhotoChanged` | `uploadAvatar()` / `removeAvatar()` (admin) | `useProfile('admin')` → all admin portal UI |
| `doctorChatRead` | `ChatPage` (on open) | `Sidebar` (clears chat badge) |
| `adminChatRead` | `AdminChatPage` (on open) | `AdminSidebar` (clears chat badge) |
| `notifCountChanged` | `NotificationsPage`, `ClientsPage`, `AdminClientsPage`, `ClientDetailPage`, `MyPortalPage` | `Sidebar` (updates notification badge) |

### Rules

1. **Every Supabase mutation must dispatch the corresponding event** after successful write.
2. **Hooks re-fetch from Supabase** on event — no optimistic-only updates.
3. **Events are fire-and-forget** — dispatched once per mutation, never during reads (prevents infinite loops).
4. **Profile data** uses `useProfile()` hook with 30s cache + event listeners for instant sync.
5. **Operational data** (chat_read_at, time_blocks) stays on `staff` table — not profile events.

---

## 15. Active Visit System

### Context: `ActiveVisitProvider`

Tracks an in-progress veterinary visit across pages.

```ts
interface ActiveVisit {
  apptId: string;
  petName: string;
  petImage: string;
  ownerName: string;
  service: string;
  startedAt: number; // Date.now()
  step: 'visit' | 'checkout';
}
```

### Flow

1. Doctor starts a visit from AppointmentsPage → navigates to `/appointments/:id/visit`.
2. `ActiveVisitWidget` (floating bottom-right card) shows on all pages except the active visit's own pages.
3. Widget displays pet info, elapsed time, and a "Resume" button.
4. Progresses: `visit` → `checkout` via `advanceToCheckout()`.
5. Cleared on visit completion or manual dismiss.

---

## 16. Theme System

### Hook: `useTheme()`

```ts
// Returns
{ isDark: boolean; toggle: () => void }
```

- Persisted in `localStorage('vettrack-theme')` — this is the **only** allowed persistent localStorage key besides `selected_clinic`.
- Applies/removes `.dark` class on `document.documentElement`.
- Falls back to system preference via `prefers-color-scheme`.

### CSS Variables (defined in `src/styles/theme.css`)

| Token | Light | Dark |
|-------|-------|------|
| `--bg-offwhite` | `#F8F7F4` | `#0F172A` |
| `--surface-white` | `#FFFFFF` | `#1E293B` |
| `--surface-elevated` | `#F4F3EF` | `#283548` |
| `--text-primary` | `#1A1A2E` | `#E2E8F0` |
| `--text-secondary` | `#6B7280` | `#94A3B8` |
| `--border-color` | `#E5E7EB` | `#334155` |
| `--brand-green` | `#2D6A4F` | `#2D6A4F` |
| `--brand-green-text` | `#2D6A4F` | `#21C55E` |
| `--brand-amber` | `#F4A261` | `#F4A261` |

---

## 17. Custom Hooks

| Hook | File | Purpose | Returns |
|------|------|---------|---------|
| `useProfile` | `hooks/useProfile.ts` | **Profile (single source of truth)** | `{ profile, loading, refetch }` + `updateProfile()`, `updateProfileAvatar()` |
| `useTheme` | `hooks/useTheme.ts` | Dark/light mode | `{ isDark, toggle }` |
| `useAppointments` | `hooks/useAppointments.ts` | Appointment CRUD | `{ appointments, loading, error, refetch, addAppointment, updateStatus, deleteAppointment }` |
| `useClients` | `hooks/useClients.ts` | Client CRUD | `{ clients, loading, error, refetch, addClient, updateClient, deleteClient }` |
| `usePets` | `hooks/usePets.ts` | Pet CRUD | `{ pets, loading, error, refetch, addPet, updatePet, deactivatePet }` |
| `useDashboardStats` | `hooks/useDashboardStats.ts` | Dashboard metrics | `{ totalClients, appointmentsToday, vaccinesDueThisWeek, activePets }` |
| `useMessages` | `hooks/useMessages.ts` | Chat messages | `{ messages, loading, fetchMessages, sendMessage }` |

---

## 18. Context Providers

| Provider | File | Wraps | Purpose |
|----------|------|-------|---------|
| `ActiveVisitProvider` | `context/ActiveVisitContext.tsx` | Entire app | Tracks in-progress vet visit |
| `AppointmentStatusProvider` | `context/AppointmentStatusContext.tsx` | Entire app | Shared appointment status overrides |

---

## 19. localStorage Policy

**Only 2 keys are allowed in localStorage:**

| Key | Purpose | Type |
|-----|---------|------|
| `vettrack-theme` | UI theme preference | `'dark'` \| `'light'` |
| `selected_clinic` | Current clinic session | `{ id, name, is_dev }` |

Everything else must be fetched from Supabase. No profile caching, no notification state, no task data, no event storage in localStorage.

---

## 20. Environment Variables

| Variable | Purpose |
|----------|---------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous key |

Set in Vercel dashboard for production. `.env` file for local dev.

---

## 21. File Structure

```
src/
  app/
    App.tsx                    # Root router, portal shells
    components/
      Sidebar.tsx              # Doctor portal sidebar
      AdminSidebar.tsx         # Admin portal sidebar
      OwnerSidebar.tsx         # Owner portal sidebar
      SuperAdminSidebar.tsx    # SuperAdmin portal sidebar
      ToastNotification.tsx     # Global toast popup system
      AddClientDialog.tsx      # Client creation modal
      AppointmentCard.tsx      # Appointment card component
      ClientRow.tsx            # Client list row
      StatCard.tsx             # Dashboard stat card
      ui/                      # 50+ Shadcn/UI components
    context/
      ActiveVisitContext.tsx    # Visit-in-progress state
      AppointmentStatusContext.tsx  # Appointment status state
    hooks/
      useTheme.ts
      useAppointments.ts
      useClients.ts
      usePets.ts
      useDashboardStats.ts
      useMessages.ts
    pages/
      LoginPage.tsx            # Portal picker
      DashboardPage.tsx        # Doctor dashboard
      ClientsPage.tsx          # Client list
      ClientDetailPage.tsx     # Client profile
      AppointmentsPage.tsx     # Appointment list
      VisitPage.tsx            # Visit notes
      CheckoutPage.tsx         # Visit checkout
      RecordsPage.tsx          # Medical records list
      RecordDetailPage.tsx     # Record detail + PDF
      NotificationsPage.tsx    # Shared notifications
      ChatPage.tsx             # Doctor chat
      MyPortalPage.tsx         # Doctor profile
      SettingsPage.tsx         # Doctor settings
      ...
      admin/                   # Admin portal pages
      owner/                   # Owner portal pages
      superadmin/              # SuperAdmin portal pages
      sysadmin/                # System admin (clinic mgmt)
  lib/
    supabase.ts                # Supabase client singleton
  types/
    database.types.ts          # Auto-generated DB types
  styles/
    index.css                  # Entry point (imports all)
    theme.css                  # CSS variables + dark mode
    tailwind.css               # Tailwind directives
    fonts.css                  # Font definitions
    print.css                  # Print media styles
```

---

## 22. Development Rules

1. **Update this file first** before implementing any feature.
2. **Multi-tenant**: All tables must include `organization_id`. Never query without tenant context.
3. **No localStorage for data**: Only `vettrack-theme` and `selected_clinic` are allowed.
4. **No hardcoded data**: All data comes from Supabase. No mock arrays in production code.
5. **Role isolation**: Doctor queries use `DOCTOR_ROLES` filter. Admin queries use `ADMIN_ROLES` filter. Never `.limit(1).single()` without role filter on `staff`.
6. **Images in Storage**: Upload to Supabase bucket, save URL in DB column. Never base64.
7. **Centralize logic**: Shared pages (NotificationsPage, ClientDetailPage, RecordsPage) are reused across portals. Don't duplicate.
8. **Custom events for instant sync**: When a page changes data that affects a sidebar badge, dispatch a custom DOM event.
9. **Race condition prevention**: Always load metadata (e.g. `last_read_at` from `conversation_participants`) before starting polling intervals.
10. **Async data access**: All Supabase reads/writes use `async/await`. No synchronous data access patterns.

---

*Last updated: 2026-03-29*
