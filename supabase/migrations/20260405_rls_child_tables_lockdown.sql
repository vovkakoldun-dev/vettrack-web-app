-- ============================================================================
-- MIGRATION: RLS Lockdown — Replace Subquery Policies with Direct org_id
-- Date:      2026-04-05
-- Purpose:   Every child table currently uses expensive multi-hop subquery
--            policies (e.g. record_id IN (SELECT ... FROM medical_records
--            WHERE clinic_id IN (SELECT ... FROM clinics WHERE org_id = ...)))
--            This migration:
--              1. Adds organization_id column directly to each child table
--              2. Backfills from parent
--              3. Adds composite FKs (prevents cross-org references at DB level)
--              4. Drops old subquery-based FOR ALL policies
--              5. Creates per-operation policies with role-based access
--              6. Completes missing email_sync_log policies
--
-- Performance impact: Eliminates nested subquery evaluation on every row
--   scan. Before: 3-hop chain (record → medical_records → clinics → org).
--   After: single index lookup on organization_id.
--
-- Tables addressed:
--   invoice_line_items   — was: 1-hop subquery via invoices
--   payments             — was: 1-hop subquery via invoices
--   record_diagnoses     — was: 3-hop subquery via medical_records → clinics
--   record_treatments    — was: 3-hop subquery via medical_records → clinics
--   record_vitals        — was: 3-hop subquery via medical_records → clinics
--   pet_weight_history   — was: 1-hop subquery via pets
--   staff_specializations — was: 1-hop subquery via staff
--   email_sync_log       — was: SELECT only, missing INSERT/UPDATE/DELETE
-- ============================================================================

BEGIN;

-- ╔════════════════════════════════════════════════════════════════════════════╗
-- ║  PREREQUISITE: Composite unique indexes on parent tables.                ║
-- ║  Required for composite FKs: REFERENCES parent(id, organization_id)     ║
-- ╚════════════════════════════════════════════════════════════════════════════╝

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'invoices' AND indexdef LIKE '%(id, organization_id)%'
  ) THEN
    CREATE UNIQUE INDEX idx_invoices_id_org ON invoices (id, organization_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'medical_records' AND indexdef LIKE '%(id, organization_id)%'
  ) THEN
    CREATE UNIQUE INDEX idx_medical_records_id_org ON medical_records (id, organization_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'pets' AND indexdef LIKE '%(id, organization_id)%'
  ) THEN
    CREATE UNIQUE INDEX idx_pets_id_org ON pets (id, organization_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'staff' AND indexdef LIKE '%(id, organization_id)%'
  ) THEN
    CREATE UNIQUE INDEX idx_staff_id_org ON staff (id, organization_id);
  END IF;
END $$;


-- ╔════════════════════════════════════════════════════════════════════════════╗
-- ║  1. invoice_line_items                                                   ║
-- ║  Old policy: FOR ALL via subquery (invoice_id IN SELECT invoices...)     ║
-- ╚════════════════════════════════════════════════════════════════════════════╝

-- Add column + backfill
ALTER TABLE invoice_line_items ADD COLUMN IF NOT EXISTS organization_id uuid;

UPDATE invoice_line_items li
SET organization_id = i.organization_id
FROM invoices i WHERE li.invoice_id = i.id AND li.organization_id IS NULL;

DELETE FROM invoice_line_items WHERE organization_id IS NULL;
ALTER TABLE invoice_line_items ALTER COLUMN organization_id SET NOT NULL;

-- Composite FK (replace simple FK)
ALTER TABLE invoice_line_items DROP CONSTRAINT IF EXISTS invoice_line_items_invoice_id_fkey;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoice_line_items_invoice_org_fkey') THEN
    ALTER TABLE invoice_line_items
      ADD CONSTRAINT invoice_line_items_invoice_org_fkey
      FOREIGN KEY (invoice_id, organization_id) REFERENCES invoices (id, organization_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_invoice_line_items_org ON invoice_line_items (organization_id);

-- Drop old subquery policy
DROP POLICY IF EXISTS "line_items: org via invoice" ON invoice_line_items;

-- New per-operation policies
CREATE POLICY "invoice_line_items_select" ON invoice_line_items FOR SELECT TO authenticated
  USING (organization_id = auth_org_id());
CREATE POLICY "invoice_line_items_insert" ON invoice_line_items FOR INSERT TO authenticated
  WITH CHECK (organization_id = auth_org_id());
CREATE POLICY "invoice_line_items_update" ON invoice_line_items FOR UPDATE TO authenticated
  USING (organization_id = auth_org_id());
CREATE POLICY "invoice_line_items_delete" ON invoice_line_items FOR DELETE TO authenticated
  USING (organization_id = auth_org_id() AND is_admin_or_above());


-- ╔════════════════════════════════════════════════════════════════════════════╗
-- ║  2. payments                                                             ║
-- ║  Old policy: FOR ALL via subquery (invoice_id IN SELECT invoices...)     ║
-- ╚════════════════════════════════════════════════════════════════════════════╝

ALTER TABLE payments ADD COLUMN IF NOT EXISTS organization_id uuid;

UPDATE payments p
SET organization_id = i.organization_id
FROM invoices i WHERE p.invoice_id = i.id AND p.organization_id IS NULL;

DELETE FROM payments WHERE organization_id IS NULL;
ALTER TABLE payments ALTER COLUMN organization_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payments_org ON payments (organization_id);

DROP POLICY IF EXISTS "payments: org via invoice" ON payments;

CREATE POLICY "payments_select" ON payments FOR SELECT TO authenticated
  USING (organization_id = auth_org_id());
CREATE POLICY "payments_insert" ON payments FOR INSERT TO authenticated
  WITH CHECK (organization_id = auth_org_id());
CREATE POLICY "payments_update" ON payments FOR UPDATE TO authenticated
  USING (organization_id = auth_org_id());
CREATE POLICY "payments_delete" ON payments FOR DELETE TO authenticated
  USING (organization_id = auth_org_id() AND is_admin_or_above());


-- ╔════════════════════════════════════════════════════════════════════════════╗
-- ║  3. record_diagnoses                                                     ║
-- ║  Old policy: 3-hop chain record→medical_records→clinics→org_id           ║
-- ╚════════════════════════════════════════════════════════════════════════════╝

ALTER TABLE record_diagnoses ADD COLUMN IF NOT EXISTS organization_id uuid;

UPDATE record_diagnoses rd
SET organization_id = mr.organization_id
FROM medical_records mr WHERE rd.record_id = mr.id AND rd.organization_id IS NULL;

DELETE FROM record_diagnoses WHERE organization_id IS NULL;
ALTER TABLE record_diagnoses ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE record_diagnoses DROP CONSTRAINT IF EXISTS record_diagnoses_record_id_fkey;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'record_diagnoses_record_org_fkey') THEN
    ALTER TABLE record_diagnoses
      ADD CONSTRAINT record_diagnoses_record_org_fkey
      FOREIGN KEY (record_id, organization_id) REFERENCES medical_records (id, organization_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_record_diagnoses_org ON record_diagnoses (organization_id);

DROP POLICY IF EXISTS "rec_diagnoses: org via record" ON record_diagnoses;

CREATE POLICY "record_diagnoses_select" ON record_diagnoses FOR SELECT TO authenticated
  USING (organization_id = auth_org_id());
CREATE POLICY "record_diagnoses_insert" ON record_diagnoses FOR INSERT TO authenticated
  WITH CHECK (organization_id = auth_org_id());
CREATE POLICY "record_diagnoses_update" ON record_diagnoses FOR UPDATE TO authenticated
  USING (organization_id = auth_org_id());
CREATE POLICY "record_diagnoses_delete" ON record_diagnoses FOR DELETE TO authenticated
  USING (organization_id = auth_org_id() AND is_admin_or_above());


-- ╔════════════════════════════════════════════════════════════════════════════╗
-- ║  4. record_treatments                                                    ║
-- ║  Old policy: 3-hop chain record→medical_records→clinics→org_id           ║
-- ╚════════════════════════════════════════════════════════════════════════════╝

ALTER TABLE record_treatments ADD COLUMN IF NOT EXISTS organization_id uuid;

UPDATE record_treatments rt
SET organization_id = mr.organization_id
FROM medical_records mr WHERE rt.record_id = mr.id AND rt.organization_id IS NULL;

DELETE FROM record_treatments WHERE organization_id IS NULL;
ALTER TABLE record_treatments ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE record_treatments DROP CONSTRAINT IF EXISTS record_treatments_record_id_fkey;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'record_treatments_record_org_fkey') THEN
    ALTER TABLE record_treatments
      ADD CONSTRAINT record_treatments_record_org_fkey
      FOREIGN KEY (record_id, organization_id) REFERENCES medical_records (id, organization_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_record_treatments_org ON record_treatments (organization_id);

DROP POLICY IF EXISTS "rec_treatments: org via record" ON record_treatments;

CREATE POLICY "record_treatments_select" ON record_treatments FOR SELECT TO authenticated
  USING (organization_id = auth_org_id());
CREATE POLICY "record_treatments_insert" ON record_treatments FOR INSERT TO authenticated
  WITH CHECK (organization_id = auth_org_id());
CREATE POLICY "record_treatments_update" ON record_treatments FOR UPDATE TO authenticated
  USING (organization_id = auth_org_id());
CREATE POLICY "record_treatments_delete" ON record_treatments FOR DELETE TO authenticated
  USING (organization_id = auth_org_id() AND is_admin_or_above());


-- ╔════════════════════════════════════════════════════════════════════════════╗
-- ║  5. record_vitals                                                        ║
-- ║  Old policy: 3-hop chain record→medical_records→clinics→org_id           ║
-- ╚════════════════════════════════════════════════════════════════════════════╝

ALTER TABLE record_vitals ADD COLUMN IF NOT EXISTS organization_id uuid;

UPDATE record_vitals rv
SET organization_id = mr.organization_id
FROM medical_records mr WHERE rv.record_id = mr.id AND rv.organization_id IS NULL;

DELETE FROM record_vitals WHERE organization_id IS NULL;
ALTER TABLE record_vitals ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE record_vitals DROP CONSTRAINT IF EXISTS record_vitals_record_id_fkey;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'record_vitals_record_org_fkey') THEN
    ALTER TABLE record_vitals
      ADD CONSTRAINT record_vitals_record_org_fkey
      FOREIGN KEY (record_id, organization_id) REFERENCES medical_records (id, organization_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_record_vitals_org ON record_vitals (organization_id);

DROP POLICY IF EXISTS "rec_vitals: org via record" ON record_vitals;

CREATE POLICY "record_vitals_select" ON record_vitals FOR SELECT TO authenticated
  USING (organization_id = auth_org_id());
CREATE POLICY "record_vitals_insert" ON record_vitals FOR INSERT TO authenticated
  WITH CHECK (organization_id = auth_org_id());
CREATE POLICY "record_vitals_update" ON record_vitals FOR UPDATE TO authenticated
  USING (organization_id = auth_org_id());
CREATE POLICY "record_vitals_delete" ON record_vitals FOR DELETE TO authenticated
  USING (organization_id = auth_org_id() AND is_admin_or_above());


-- ╔════════════════════════════════════════════════════════════════════════════╗
-- ║  6. pet_weight_history                                                   ║
-- ║  Old policy: FOR ALL via subquery (pet_id IN SELECT pets...)             ║
-- ╚════════════════════════════════════════════════════════════════════════════╝

ALTER TABLE pet_weight_history ADD COLUMN IF NOT EXISTS organization_id uuid;

UPDATE pet_weight_history pwh
SET organization_id = p.organization_id
FROM pets p WHERE pwh.pet_id = p.id AND pwh.organization_id IS NULL;

DELETE FROM pet_weight_history WHERE organization_id IS NULL;
ALTER TABLE pet_weight_history ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE pet_weight_history DROP CONSTRAINT IF EXISTS pet_weight_history_pet_id_fkey;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pet_weight_history_pet_org_fkey') THEN
    ALTER TABLE pet_weight_history
      ADD CONSTRAINT pet_weight_history_pet_org_fkey
      FOREIGN KEY (pet_id, organization_id) REFERENCES pets (id, organization_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_pet_weight_history_org ON pet_weight_history (organization_id);

DROP POLICY IF EXISTS "pet_weight: org via pet" ON pet_weight_history;

CREATE POLICY "pet_weight_history_select" ON pet_weight_history FOR SELECT TO authenticated
  USING (organization_id = auth_org_id());
CREATE POLICY "pet_weight_history_insert" ON pet_weight_history FOR INSERT TO authenticated
  WITH CHECK (organization_id = auth_org_id());
CREATE POLICY "pet_weight_history_update" ON pet_weight_history FOR UPDATE TO authenticated
  USING (organization_id = auth_org_id());
CREATE POLICY "pet_weight_history_delete" ON pet_weight_history FOR DELETE TO authenticated
  USING (organization_id = auth_org_id());


-- ╔════════════════════════════════════════════════════════════════════════════╗
-- ║  7. staff_specializations                                                ║
-- ║  Old policy: FOR ALL via subquery (staff_id IN SELECT staff...)          ║
-- ╚════════════════════════════════════════════════════════════════════════════╝

ALTER TABLE staff_specializations ADD COLUMN IF NOT EXISTS organization_id uuid;

UPDATE staff_specializations ss
SET organization_id = s.organization_id
FROM staff s WHERE ss.staff_id = s.id AND ss.organization_id IS NULL;

DELETE FROM staff_specializations WHERE organization_id IS NULL;
ALTER TABLE staff_specializations ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE staff_specializations DROP CONSTRAINT IF EXISTS staff_specializations_staff_id_fkey;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'staff_specializations_staff_org_fkey') THEN
    ALTER TABLE staff_specializations
      ADD CONSTRAINT staff_specializations_staff_org_fkey
      FOREIGN KEY (staff_id, organization_id) REFERENCES staff (id, organization_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_staff_specializations_org ON staff_specializations (organization_id);

DROP POLICY IF EXISTS "staff_specs: org via staff" ON staff_specializations;

CREATE POLICY "staff_specializations_select" ON staff_specializations FOR SELECT TO authenticated
  USING (organization_id = auth_org_id());
CREATE POLICY "staff_specializations_insert" ON staff_specializations FOR INSERT TO authenticated
  WITH CHECK (organization_id = auth_org_id() AND is_admin_or_above());
CREATE POLICY "staff_specializations_update" ON staff_specializations FOR UPDATE TO authenticated
  USING (organization_id = auth_org_id() AND is_admin_or_above());
CREATE POLICY "staff_specializations_delete" ON staff_specializations FOR DELETE TO authenticated
  USING (organization_id = auth_org_id() AND auth_role() = 'superadmin');


-- ╔════════════════════════════════════════════════════════════════════════════╗
-- ║  8. email_sync_log — Complete missing policies                           ║
-- ║  Existing: SELECT only. Missing: INSERT, UPDATE, DELETE.                 ║
-- ╚════════════════════════════════════════════════════════════════════════════╝

CREATE POLICY "email_sync_log_insert" ON email_sync_log FOR INSERT TO authenticated
  WITH CHECK (organization_id = auth_org_id());

CREATE POLICY "email_sync_log_update" ON email_sync_log FOR UPDATE TO authenticated
  USING (organization_id = auth_org_id());

CREATE POLICY "email_sync_log_delete" ON email_sync_log FOR DELETE TO authenticated
  USING (organization_id = auth_org_id() AND is_admin_or_above());


-- ╔════════════════════════════════════════════════════════════════════════════╗
-- ║  VERIFICATION (uncomment to run post-migration)                          ║
-- ╚════════════════════════════════════════════════════════════════════════════╝

-- 1. Confirm all public tables have RLS enabled:
-- SELECT tablename FROM pg_tables
-- WHERE schemaname='public' AND rowsecurity=false ORDER BY tablename;
-- Expected: 0 rows

-- 2. Confirm no subquery-based policies remain on these tables:
-- SELECT tablename, policyname, qual FROM pg_policies
-- WHERE tablename IN ('invoice_line_items','payments','record_diagnoses',
--   'record_treatments','record_vitals','pet_weight_history','staff_specializations')
--   AND qual LIKE '%IN%SELECT%'
-- ORDER BY tablename;
-- Expected: 0 rows

-- 3. Confirm organization_id is NOT NULL on all child tables:
-- SELECT table_name, column_name, is_nullable FROM information_schema.columns
-- WHERE table_schema='public' AND column_name='organization_id' AND is_nullable='YES';
-- Expected: 0 rows

COMMIT;
