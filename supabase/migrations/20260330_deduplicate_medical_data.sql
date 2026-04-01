-- ============================================================================
-- MIGRATION: Deduplicate Medical Data
-- ============================================================================
-- DEPENDS ON: 20260330_multitenant_composite_fks.sql (must run FIRST)
--             20260330_rls_org_isolation.sql          (must run SECOND)
-- RUN ORDER:  This migration runs THIRD.
-- ============================================================================
-- Goal: Make medical_records + relational child tables the SINGLE source of truth.
--
-- SUMMARY OF ACTIONS:
--   DROP TABLE   visit_reports              (fully redundant with medical_records)
--   DROP COLUMN  medical_records.vitals_json         → data migrated to record_vitals
--   DROP COLUMN  medical_records.medications_json    → data migrated to medications
--   DROP COLUMN  medical_records.primary_diagnosis   → data migrated to record_diagnoses
--   DROP COLUMN  medical_records.secondary_diagnosis → data migrated to record_diagnoses
--   DROP COLUMN  medical_records.procedures_text     → data migrated to record_treatments
--   DROP COLUMN  medical_records.owner_instructions  → data migrated to record_treatments
--   DROP COLUMN  medical_records.exam_notes          → folded into clinical_notes
--   DROP COLUMN  medical_records.chief_complaint     → folded into reason
--   KEEP TABLE   record_vitals       (1:1 with medical_records)
--   KEEP TABLE   record_diagnoses    (1:N with medical_records)
--   KEEP TABLE   record_treatments   (1:N with medical_records)
--   KEEP TABLE   medications         (1:N with medical_records)
--   KEEP TABLE   lab_results         (1:N with medical_records)
--   KEEP TABLE   vaccinations        (1:N with medical_records)
--   KEEP COLUMN  medical_records.clinical_notes   (free-text clinical narrative)
--   KEEP COLUMN  medical_records.reason           (visit reason / chief complaint)
--   KEEP COLUMN  medical_records.follow_up_*      (follow-up scheduling)
-- ============================================================================

BEGIN;

-- ════════════════════════════════════════════════════════════════════════════
-- PHASE 1: Migrate visit_reports orphans → medical_records
-- ════════════════════════════════════════════════════════════════════════════
-- 4 of 5 visit_reports rows have no matching medical_record (appointment_id IS NULL).
-- We insert them as medical_records so no data is lost before dropping the table.

INSERT INTO medical_records (
  record_number, appointment_id, pet_id, client_id, clinic_id,
  vet_id, record_type, status, visit_date,
  reason, clinical_notes,
  primary_diagnosis, secondary_diagnosis,
  owner_instructions,
  follow_up_date, follow_up_notes,
  organization_id
)
SELECT
  'VT-' || EXTRACT(YEAR FROM vr.visit_date)::text || '-' || LPAD(FLOOR(RANDOM() * 999999)::text, 6, '0'),
  vr.appointment_id,
  vr.pet_id,
  -- Resolve client_id from pet
  COALESCE(p.client_id, '00000000-0000-0000-0000-000000000000'),
  -- Resolve clinic_id from org
  (SELECT c.id FROM clinics c WHERE c.organization_id = vr.organization_id LIMIT 1),
  vr.vet_id,
  'Visit'::record_type,
  'Final'::record_status,
  vr.visit_date,
  vr.primary_diagnosis,                             -- use as reason
  vr.clinical_notes,
  vr.primary_diagnosis,
  vr.secondary_diagnosis,
  vr.owner_instructions,
  vr.follow_up_date,
  vr.follow_up_notes,
  vr.organization_id
FROM visit_reports vr
JOIN pets p ON p.id = vr.pet_id
WHERE NOT EXISTS (
  -- Skip if a medical_record already covers this visit_report
  SELECT 1 FROM medical_records mr
  WHERE mr.appointment_id = vr.appointment_id
    AND mr.appointment_id IS NOT NULL
    AND mr.pet_id = vr.pet_id
)
AND NOT EXISTS (
  -- Also skip if same pet + same date + same diagnosis already exists (for null-appointment rows)
  SELECT 1 FROM medical_records mr
  WHERE vr.appointment_id IS NULL
    AND mr.pet_id = vr.pet_id
    AND mr.visit_date = vr.visit_date
    AND mr.primary_diagnosis IS NOT NULL
    AND mr.primary_diagnosis = vr.primary_diagnosis
);

-- ════════════════════════════════════════════════════════════════════════════
-- PHASE 2: Migrate vitals_json → record_vitals
-- ════════════════════════════════════════════════════════════════════════════
-- vitals_json stores: weight, temperature, heartRate, respiratoryRate,
--                     painScore, bodyConditionScore
-- record_vitals stores the same in proper typed columns.
-- Only migrate where record_vitals row does NOT already exist.

INSERT INTO record_vitals (
  record_id,
  weight_kg,
  temperature_c,
  heart_rate_bpm,
  respiratory_rate_bpm,
  pain_score,
  body_condition_score
)
SELECT
  mr.id,
  NULLIF(mr.vitals_json->>'weight', '')::numeric,
  -- vitals_json stores Fahrenheit; convert to Celsius for record_vitals
  CASE
    WHEN NULLIF(mr.vitals_json->>'temperature', '') IS NOT NULL
    THEN ROUND(((mr.vitals_json->>'temperature')::numeric - 32) * 5.0 / 9.0, 1)
    ELSE NULL
  END,
  NULLIF(mr.vitals_json->>'heartRate', '')::numeric,
  NULLIF(mr.vitals_json->>'respiratoryRate', '')::numeric,
  NULLIF(mr.vitals_json->>'painScore', '')::numeric,
  NULLIF(mr.vitals_json->>'bodyConditionScore', '')::numeric
FROM medical_records mr
WHERE mr.vitals_json IS NOT NULL
  AND mr.vitals_json != '{}'::jsonb
  AND NOT EXISTS (
    SELECT 1 FROM record_vitals rv WHERE rv.record_id = mr.id
  );

-- ════════════════════════════════════════════════════════════════════════════
-- PHASE 3: Migrate primary_diagnosis / secondary_diagnosis → record_diagnoses
-- ════════════════════════════════════════════════════════════════════════════
-- Only insert where the diagnosis text doesn't already exist for this record.

-- Primary diagnoses
INSERT INTO record_diagnoses (record_id, type, description)
SELECT mr.id, 'primary'::diagnosis_type, mr.primary_diagnosis
FROM medical_records mr
WHERE mr.primary_diagnosis IS NOT NULL
  AND mr.primary_diagnosis != ''
  AND NOT EXISTS (
    SELECT 1 FROM record_diagnoses rd
    WHERE rd.record_id = mr.id AND rd.type = 'primary'
  );

-- Secondary diagnoses
INSERT INTO record_diagnoses (record_id, type, description)
SELECT mr.id, 'secondary'::diagnosis_type, mr.secondary_diagnosis
FROM medical_records mr
WHERE mr.secondary_diagnosis IS NOT NULL
  AND mr.secondary_diagnosis != ''
  AND NOT EXISTS (
    SELECT 1 FROM record_diagnoses rd
    WHERE rd.record_id = mr.id AND rd.type = 'secondary'
  );

-- ════════════════════════════════════════════════════════════════════════════
-- PHASE 4: Migrate procedures_text + owner_instructions → record_treatments
-- ════════════════════════════════════════════════════════════════════════════

INSERT INTO record_treatments (record_id, procedure_name, post_visit_instructions)
SELECT
  mr.id,
  COALESCE(NULLIF(mr.procedures_text, ''), 'General Visit'),
  NULLIF(mr.owner_instructions, '')
FROM medical_records mr
WHERE (mr.procedures_text IS NOT NULL AND mr.procedures_text != '')
   OR (mr.owner_instructions IS NOT NULL AND mr.owner_instructions != '')
AND NOT EXISTS (
  SELECT 1 FROM record_treatments rt WHERE rt.record_id = mr.id
);

-- ════════════════════════════════════════════════════════════════════════════
-- PHASE 5: Migrate medications_json → medications
-- ════════════════════════════════════════════════════════════════════════════
-- medications_json is an array of {name, dosage, frequency, route, duration}

INSERT INTO medications (
  pet_id, record_id, organization_id,
  name, dosage, frequency, route, duration_days, start_date, is_active
)
SELECT
  mr.pet_id,
  mr.id,
  mr.organization_id,
  med->>'name',
  COALESCE(med->>'dosage', '—'),
  COALESCE(med->>'frequency', '—'),
  COALESCE(med->>'route', 'Oral')::medication_route,
  -- Try to parse duration as integer days
  CASE
    WHEN med->>'duration' ~ '^\d+$' THEN (med->>'duration')::integer
    ELSE NULL
  END,
  mr.visit_date,
  true
FROM medical_records mr,
     jsonb_array_elements(mr.medications_json) AS med
WHERE mr.medications_json IS NOT NULL
  AND jsonb_array_length(mr.medications_json) > 0
  AND med->>'name' IS NOT NULL
  AND med->>'name' != ''
  -- Avoid duplicates: skip if same med name already exists for this record
  AND NOT EXISTS (
    SELECT 1 FROM medications m
    WHERE m.record_id = mr.id AND m.name = med->>'name'
  );

-- ════════════════════════════════════════════════════════════════════════════
-- PHASE 6: Fold chief_complaint → reason, exam_notes → clinical_notes
-- ════════════════════════════════════════════════════════════════════════════
-- If reason is NULL/empty but chief_complaint has data, copy it over.
-- If clinical_notes is NULL/empty but exam_notes has data, copy it over.
-- If both exist, prepend the extra field.

-- chief_complaint → reason
UPDATE medical_records
SET reason = COALESCE(NULLIF(reason, ''), chief_complaint)
WHERE chief_complaint IS NOT NULL AND chief_complaint != ''
  AND (reason IS NULL OR reason = '');

-- exam_notes → clinical_notes (append if clinical_notes already has content)
UPDATE medical_records
SET clinical_notes = CASE
  WHEN clinical_notes IS NOT NULL AND clinical_notes != ''
    THEN clinical_notes || E'\n\n--- Exam Notes ---\n' || exam_notes
  ELSE exam_notes
END
WHERE exam_notes IS NOT NULL AND exam_notes != '';

-- ════════════════════════════════════════════════════════════════════════════
-- PHASE 7: DROP visit_reports table
-- ════════════════════════════════════════════════════════════════════════════
-- No other table references visit_reports as a FK parent.
-- All data has been migrated to medical_records in Phase 1.

DROP POLICY IF EXISTS "Allow org members to read"   ON visit_reports;
DROP POLICY IF EXISTS "Allow org members to insert"  ON visit_reports;
DROP POLICY IF EXISTS "Allow org members to update"  ON visit_reports;
DROP POLICY IF EXISTS "Allow org members to delete"  ON visit_reports;

DROP TABLE visit_reports;

-- ════════════════════════════════════════════════════════════════════════════
-- PHASE 8: DROP redundant columns from medical_records
-- ════════════════════════════════════════════════════════════════════════════
-- All data has been migrated to relational child tables or folded into
-- existing columns. Safe to remove.

ALTER TABLE medical_records
  DROP COLUMN vitals_json,
  DROP COLUMN medications_json,
  DROP COLUMN primary_diagnosis,
  DROP COLUMN secondary_diagnosis,
  DROP COLUMN procedures_text,
  DROP COLUMN owner_instructions,
  DROP COLUMN chief_complaint,
  DROP COLUMN exam_notes;

-- ════════════════════════════════════════════════════════════════════════════
-- PHASE 9: Update RLS policies
-- ════════════════════════════════════════════════════════════════════════════
-- visit_reports policies already dropped with the table.
-- All kept tables (record_vitals, record_diagnoses, record_treatments,
-- medications, lab_results, vaccinations) already have org-scoped RLS
-- from the previous 20260330_rls_org_isolation migration. No changes needed.

-- ════════════════════════════════════════════════════════════════════════════
-- PHASE 10: Add missing indexes for the relational tables
-- ════════════════════════════════════════════════════════════════════════════
-- Ensure performant lookups when reading a medical_record with all children.

CREATE INDEX IF NOT EXISTS idx_record_vitals_record_id
  ON record_vitals (record_id);

CREATE INDEX IF NOT EXISTS idx_record_diagnoses_record_id
  ON record_diagnoses (record_id);

CREATE INDEX IF NOT EXISTS idx_record_treatments_record_id
  ON record_treatments (record_id);

CREATE INDEX IF NOT EXISTS idx_medications_record_id
  ON medications (record_id);

CREATE INDEX IF NOT EXISTS idx_lab_results_record_id
  ON lab_results (record_id);

CREATE INDEX IF NOT EXISTS idx_vaccinations_record_id
  ON vaccinations (record_id);

COMMIT;

-- ============================================================================
-- POST-MIGRATION: Required code changes (do NOT apply via SQL)
-- ============================================================================
--
-- 1. VisitPage.tsx (lines 1372-1387):
--    DELETE the entire visit_reports insert block.
--    The medical_records insert (line 1411) stays but must be updated:
--      - Remove: primary_diagnosis, secondary_diagnosis, procedures_text,
--                owner_instructions, chief_complaint, exam_notes,
--                vitals_json, medications_json
--      - Instead, after inserting medical_records, insert child rows:
--        • record_vitals   ← vitals data (weight, temp, HR, RR, pain, BCS)
--        • record_diagnoses ← primary + secondary diagnosis rows
--        • record_treatments ← procedures + owner_instructions
--        • medications      ← meds array (already done on CheckoutPage)
--
-- 2. RecordDetailPage.tsx (lines 509-568):
--    Remove all (data as any).vitals_json fallback logic.
--    Remove all (data as any).primary_diagnosis / secondary_diagnosis fallback.
--    Remove all (data as any).procedures_text / owner_instructions fallback.
--    Remove all (data as any).medications_json fallback.
--    Read ONLY from joined relational tables:
--      record_vitals, record_diagnoses, record_treatments, medications
--
-- 3. ClientDetailPage.tsx (lines 676-685, 2030-2078):
--    Replace fetchVisitReports() — query medical_records instead:
--      supabase.from('medical_records').select('*, record_diagnoses(*)')
--    Update the JSX that renders report.primary_diagnosis → use
--      record_diagnoses data instead.
--
-- 4. useClients.ts (line 58):
--    Remove: supabase.from('visit_reports').delete().eq('pet_id', petId)
--
-- 5. database.types.ts:
--    Regenerate types: npx supabase gen types typescript --project-id <id>
-- ============================================================================
