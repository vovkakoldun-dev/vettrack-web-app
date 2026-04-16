/**
 * Tenant isolation middleware for Supabase queries.
 *
 * Provides:
 * - `TenantClient` — a query wrapper that auto-injects `organization_id` on every
 *   SELECT / INSERT / UPDATE / DELETE and rejects manual overrides.
 * - `logSecurityEvent()` — writes mismatch / violation attempts to `audit_logs`.
 * - `sanitizePayload()` — strips `organization_id` / `portal_id` from user-supplied data.
 */
import { supabase } from './supabase';

// ─── Types ────────────────────────────────────────────────────
export interface TenantIdentity {
  organizationId: string;
  clinicId: string;
  userId: string;
  role: string;
}

type AnyRecord = Record<string, unknown>;

// Tables that genuinely do NOT have an organization_id column.
// All other tables are org-scoped and the tenant wrapper auto-injects org_id.
//
// ⚠️  If a migration adds organization_id to a table listed here, REMOVE it
//     from this set so the wrapper starts enforcing org isolation on it.
//
// Last updated: 2026-04-05 after composite FK + RLS child-table migrations
// which added organization_id to 16 tables previously in this set.
const TABLES_WITHOUT_ORG_ID = new Set([
  'diet_restrictions',         // child of diet_plans (org via parent FK)
  'imaging_study_files',       // child of imaging_studies (org via parent FK)
  'login_activity',            // per-user auth log, no org column
  'notification_preferences',  // per-user prefs, no org column
  'organizations',             // IS the organization table itself
  'treatment_plan_goals',      // child of treatment_plans (org via parent FK)
  'treatment_plan_medications',// child of treatment_plans (org via parent FK)
  'treatment_plan_milestones', // child of treatment_plans (org via parent FK)
  'user_sessions',             // session tracking, scoped by user_id
  'vet_conditions_reference',  // global reference data, not org-scoped
]);

// Fields that must never be set by client code — they are derived from the session.
const FORBIDDEN_OVERRIDE_KEYS = ['organization_id', 'portal_id'];

// ─── Security Event Logger ────────────────────────────────────

// Map internal action names → audit_action enum values
const SECURITY_ACTION_MAP: Record<string, string> = {
  PORTAL_MISMATCH: 'portal_mismatch',
  TENANT_VIOLATION: 'tenant_violation',
  INSERT_OVERRIDE: 'security_violation',
  UPDATE_OVERRIDE: 'security_violation',
  UPSERT_OVERRIDE: 'security_violation',
  URL_PARAM_OVERRIDE: 'security_violation',
  IDENTITY_MISSING: 'security_violation',
  INVALID_ORG: 'security_violation',
};

export async function logSecurityEvent(
  identity: TenantIdentity | null,
  action: string,
  detail: string,
) {
  try {
    const auditAction = SECURITY_ACTION_MAP[action] || 'security_violation';
    await supabase.from('audit_logs').insert({
      organization_id: identity?.organizationId ?? '00000000-0000-0000-0000-000000000000',
      action: auditAction,
      resource_type: action,
      resource_id: identity?.userId ?? 'unknown',
      actor_id: identity?.userId ?? null,
      new_data: { message: detail, timestamp: new Date().toISOString() },
    });
  } catch {
    // Best-effort — never let audit logging crash the app.
    console.error('[SECURITY]', action, detail);
  }
}

// ─── Payload Sanitization ─────────────────────────────────────

/**
 * Remove `organization_id` and `portal_id` from a user-supplied payload so that
 * only the server-derived value (injected by the tenant wrapper) is used.
 *
 * Returns `{ clean, stripped }` where `stripped` lists any keys that were removed.
 */
export function sanitizePayload<T extends AnyRecord>(
  raw: T,
): { clean: Omit<T, 'organization_id' | 'portal_id'>; stripped: string[] } {
  const stripped: string[] = [];
  const clean = { ...raw };
  for (const key of FORBIDDEN_OVERRIDE_KEYS) {
    if (key in clean) {
      stripped.push(key);
      delete (clean as AnyRecord)[key];
    }
  }
  return { clean: clean as Omit<T, 'organization_id' | 'portal_id'>, stripped };
}

// ─── URL Param Guard ──────────────────────────────────────────

/**
 * Check the current URL for `organization_id` or `portal_id` query params.
 * If found, strip them and log a security event.
 */
export function guardUrlParams(identity: TenantIdentity | null) {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  let dirty = false;
  for (const key of FORBIDDEN_OVERRIDE_KEYS) {
    if (url.searchParams.has(key)) {
      url.searchParams.delete(key);
      dirty = true;
      logSecurityEvent(identity, 'URL_PARAM_OVERRIDE', `Blocked "${key}" in query string`);
    }
  }
  if (dirty) {
    window.history.replaceState(null, '', url.toString());
  }
}

// ─── Tenant Client ────────────────────────────────────────────

/**
 * Creates a tenant-scoped wrapper around the Supabase client.
 *
 * Every `.from(table)` call returns a builder that:
 * 1. Auto-appends `.eq('organization_id', orgId)` on SELECT / UPDATE / DELETE.
 * 2. Auto-injects `organization_id` into INSERT payloads.
 * 3. Rejects and logs any attempt to manually set `organization_id`.
 *
 * Tables without `organization_id` (parent-join tables) pass through untouched
 * — they rely on RLS parent-join policies.
 */
export function createTenantClient(identity: TenantIdentity) {
  const orgId = identity.organizationId;

  return {
    /** Tenant-scoped `.from()` — auto-injects org isolation. */
    from(table: string) {
      const hasOrgId = !TABLES_WITHOUT_ORG_ID.has(table);

      return {
        /** SELECT — auto-appends `.eq('organization_id', orgId)`. */
        select(columns?: string, options?: { count?: 'exact' | 'planned' | 'estimated'; head?: boolean }) {
          let q = supabase.from(table).select(columns as any, options as any);
          if (hasOrgId) q = q.eq('organization_id', orgId);
          return q;
        },

        /** INSERT — auto-injects `organization_id` into every row. */
        insert(values: AnyRecord | AnyRecord[]) {
          const rows = Array.isArray(values) ? values : [values];
          const injected = rows.map(row => {
            const { clean, stripped } = sanitizePayload(row);
            if (stripped.length > 0) {
              logSecurityEvent(identity, 'INSERT_OVERRIDE', `Blocked override of [${stripped.join(', ')}] on "${table}"`);
            }
            return hasOrgId ? { ...clean, organization_id: orgId } : clean;
          });
          return supabase.from(table).insert(injected.length === 1 ? injected[0] : injected);
        },

        /** UPDATE — auto-appends `.eq('organization_id', orgId)` and strips org from payload. */
        update(values: AnyRecord) {
          const { clean, stripped } = sanitizePayload(values);
          if (stripped.length > 0) {
            logSecurityEvent(identity, 'UPDATE_OVERRIDE', `Blocked override of [${stripped.join(', ')}] on "${table}"`);
          }
          let q = supabase.from(table).update(clean);
          if (hasOrgId) q = q.eq('organization_id', orgId);
          return q;
        },

        /** DELETE — auto-appends `.eq('organization_id', orgId)`. */
        delete() {
          let q = supabase.from(table).delete();
          if (hasOrgId) q = q.eq('organization_id', orgId);
          return q;
        },

        /** UPSERT — auto-injects `organization_id` into every row. */
        upsert(values: AnyRecord | AnyRecord[], options?: { onConflict?: string }) {
          const rows = Array.isArray(values) ? values : [values];
          const injected = rows.map(row => {
            const { clean, stripped } = sanitizePayload(row);
            if (stripped.length > 0) {
              logSecurityEvent(identity, 'UPSERT_OVERRIDE', `Blocked override of [${stripped.join(', ')}] on "${table}"`);
            }
            return hasOrgId ? { ...clean, organization_id: orgId } : clean;
          });
          return supabase.from(table).upsert(
            injected.length === 1 ? injected[0] : injected,
            options as any,
          );
        },
      };
    },

    /** Pass-through to supabase.auth (not tenant-scoped). */
    get auth() {
      return supabase.auth;
    },

    /** Pass-through to supabase.storage (not tenant-scoped). */
    get storage() {
      return supabase.storage;
    },

    /** Pass-through to supabase.channel / realtime. */
    channel(name: string) {
      return supabase.channel(name);
    },

    removeChannel(channel: ReturnType<typeof supabase.channel>) {
      return supabase.removeChannel(channel);
    },

    /** The validated tenant identity. */
    get identity() {
      return identity;
    },
  };
}

export type TenantClient = ReturnType<typeof createTenantClient>;
