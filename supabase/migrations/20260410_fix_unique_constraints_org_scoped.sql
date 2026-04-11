-- ============================================================================
-- Migration: fix_unique_constraints_org_scoped
-- Date: 2026-04-10
--
-- record_number and invoice_number were globally unique but should be
-- scoped per organization. Drop old single-column unique, add composite.
-- ============================================================================

BEGIN;

-- medical_records.record_number: global → org-scoped
ALTER TABLE medical_records DROP CONSTRAINT IF EXISTS medical_records_record_number_key;
ALTER TABLE medical_records ADD CONSTRAINT medical_records_org_record_number_unique
  UNIQUE (organization_id, record_number);

-- invoices.invoice_number: global → org-scoped
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_invoice_number_key;
ALTER TABLE invoices ADD CONSTRAINT invoices_org_invoice_number_unique
  UNIQUE (organization_id, invoice_number);

COMMIT;
