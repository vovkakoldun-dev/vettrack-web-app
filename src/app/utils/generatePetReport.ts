// src/app/utils/generatePetReport.ts
// Full-patient-snapshot PDF generator
//
// Gathers data from every "pet tab" table and produces a single PDF
// saved to the `pet-reports` storage bucket + a row in `pet_reports`.

import { jsPDF } from 'jspdf';
import type { SupabaseClient } from '@supabase/supabase-js';

export type ReportSource =
  | 'manual'
  | 'diet'
  | 'photo'
  | 'injection'
  | 'surgery'
  | 'xray'
  | 'plan'
  | 'problem'
  | 'weight'
  | 'visit'
  | 'note';

export const SOURCE_LABELS: Record<ReportSource, string> = {
  manual: 'Manual snapshot',
  diet: 'Diet update',
  photo: 'Photo added',
  injection: 'Injection logged',
  surgery: 'Surgery recorded',
  xray: 'Imaging study added',
  plan: 'Treatment plan updated',
  problem: 'Problem updated',
  weight: 'Weight logged',
  visit: 'Visit recorded',
  note: 'Note added',
};

export const SOURCE_COLORS: Record<ReportSource, string> = {
  manual: '#6B7280',
  diet: '#F4A261',
  photo: '#3B82F6',
  injection: '#8B5CF6',
  surgery: '#EC4899',
  xray: '#06B6D4',
  plan: '#2D6A4F',
  problem: '#D4183D',
  weight: '#16A34A',
  visit: '#0EA5E9',
  note: '#A16207',
};

// ─────────────────────────────────────────────────────────────
// Data gathering
// ─────────────────────────────────────────────────────────────

interface GatheredReport {
  pet: any;
  owner: any;
  clinic: any;
  problems: any[];
  allergies: any[];
  vaccinations: any[];
  medications: any[];
  weights: any[];
  dietPlan: any | null;
  dietRestrictions: any[];
  treatmentPlans: any[];
  planGoals: Record<string, any[]>;
  planMilestones: Record<string, any[]>;
  planMeds: Record<string, any[]>;
  imagingStudies: any[];
  surgeries: any[];
  visitReports: any[];
  notes: any[];
  photos: any[];
}

export async function gatherPetReportData(
  db: SupabaseClient,
  petDbId: string
): Promise<GatheredReport | null> {
  // Pet + owner + clinic
  const { data: petRow } = await db
    .from('pets')
    .select(
      'id, name, species, breed, date_of_birth, sex, color, weight_kg, microchip_no, photo_url, notes, client_id, clinic_id, organization_id'
    )
    .eq('id', petDbId)
    .maybeSingle();

  if (!petRow) return null;

  const [ownerRes, clinicRes] = await Promise.all([
    petRow.client_id
      ? db.from('clients').select('first_name, last_name, email, phone').eq('id', petRow.client_id).maybeSingle()
      : Promise.resolve({ data: null }),
    petRow.clinic_id
      ? db.from('clinics').select('name, phone, address').eq('id', petRow.clinic_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  // Medical data — run in parallel for speed
  const [
    problemsRes,
    allergiesRes,
    vaccinationsRes,
    weightsRes,
    dietPlanRes,
    treatmentPlansRes,
    imagingRes,
    surgeriesRes,
    visitReportsRes,
    notesRes,
    photosRes,
  ] = await Promise.all([
    db
      .from('pet_conditions')
      .select('id, name, severity, status, date_diagnosed, resolved_date, notes, soap_s, soap_o, soap_a, soap_p')
      .eq('pet_id', petDbId)
      .order('date_diagnosed', { ascending: false }),
    db
      .from('pet_allergies')
      .select('id, allergen, severity')
      .eq('pet_id', petDbId),
    db
      .from('vaccinations')
      .select('id, vaccine_name, administered_date, next_due_date, batch_number')
      .eq('pet_id', petDbId)
      .order('administered_date', { ascending: false }),
    db
      .from('pet_weight_history')
      .select('id, weight_kg, recorded_at, notes')
      .eq('pet_id', petDbId)
      .order('recorded_at', { ascending: true }),
    db
      .from('diet_plans')
      .select(
        'id, food_brand, food_name, food_type, daily_amount, meals, calories, water_note, treats_note, target_weight_kg, started_on, status, notes'
      )
      .eq('pet_id', petDbId)
      .eq('status', 'active')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    db
      .from('treatment_plans')
      .select('id, title, status, last_review_date, next_review_date, notes, created_at')
      .eq('pet_id', petDbId)
      .order('created_at', { ascending: false }),
    db
      .from('imaging_studies')
      .select('id, title, modality, region, study_date, radiologist, findings, impression, status')
      .eq('pet_id', petDbId)
      .order('study_date', { ascending: false }),
    db
      .from('surgeries')
      .select('id, name, surgery_date, duration_minutes, anesthesia, pre_op, procedure_notes, post_op, complications, follow_up, status')
      .eq('pet_id', petDbId)
      .order('surgery_date', { ascending: false }),
    db
      .from('visit_reports')
      .select(
        'id, visit_date, primary_diagnosis, secondary_diagnosis, clinical_notes, procedures, owner_instructions, follow_up_date, follow_up_notes'
      )
      .eq('pet_id', petDbId)
      .order('visit_date', { ascending: false }),
    db
      .from('pet_notes')
      .select('id, content, created_at')
      .eq('pet_id', petDbId)
      .order('created_at', { ascending: false }),
    db
      .from('pet_photos')
      .select('id, title, caption, category, photo_date, tags')
      .eq('pet_id', petDbId)
      .order('photo_date', { ascending: false }),
  ]);

  // Diet restrictions & plan children (depend on plan ids)
  const dietPlan = (dietPlanRes as any).data || null;
  const [dietRestrictionsRes, planGoalsRes, planMilestonesRes, planMedsRes] = await Promise.all([
    dietPlan
      ? db
          .from('diet_restrictions')
          .select('item, reason, severity')
          .eq('plan_id', dietPlan.id)
          .order('sort_order', { ascending: true })
      : Promise.resolve({ data: [] }),
    (treatmentPlansRes.data || []).length
      ? db
          .from('treatment_plan_goals')
          .select('plan_id, text, progress, status')
          .in('plan_id', ((treatmentPlansRes.data as any[]) || []).map((p: any) => p.id))
          .order('sort_order', { ascending: true })
      : Promise.resolve({ data: [] }),
    (treatmentPlansRes.data || []).length
      ? db
          .from('treatment_plan_milestones')
          .select('plan_id, title, note, milestone_date, status')
          .in('plan_id', ((treatmentPlansRes.data as any[]) || []).map((p: any) => p.id))
          .order('milestone_date', { ascending: true })
      : Promise.resolve({ data: [] }),
    (treatmentPlansRes.data || []).length
      ? db
          .from('treatment_plan_medications')
          .select('plan_id, name, dose, purpose')
          .in('plan_id', ((treatmentPlansRes.data as any[]) || []).map((p: any) => p.id))
          .order('sort_order', { ascending: true })
      : Promise.resolve({ data: [] }),
  ]);

  const planGoals: Record<string, any[]> = {};
  ((planGoalsRes as any).data || []).forEach((g: any) => {
    (planGoals[g.plan_id] = planGoals[g.plan_id] || []).push(g);
  });
  const planMilestones: Record<string, any[]> = {};
  ((planMilestonesRes as any).data || []).forEach((m: any) => {
    (planMilestones[m.plan_id] = planMilestones[m.plan_id] || []).push(m);
  });
  const planMeds: Record<string, any[]> = {};
  ((planMedsRes as any).data || []).forEach((m: any) => {
    (planMeds[m.plan_id] = planMeds[m.plan_id] || []).push(m);
  });

  return {
    pet: petRow,
    owner: (ownerRes as any).data || null,
    clinic: (clinicRes as any).data || null,
    problems: (problemsRes.data as any[]) || [],
    allergies: (allergiesRes.data as any[]) || [],
    vaccinations: (vaccinationsRes.data as any[]) || [],
    medications: [],
    weights: (weightsRes.data as any[]) || [],
    dietPlan,
    dietRestrictions: ((dietRestrictionsRes as any).data as any[]) || [],
    treatmentPlans: (treatmentPlansRes.data as any[]) || [],
    planGoals,
    planMilestones,
    planMeds,
    imagingStudies: (imagingRes.data as any[]) || [],
    surgeries: (surgeriesRes.data as any[]) || [],
    visitReports: (visitReportsRes.data as any[]) || [],
    notes: (notesRes.data as any[]) || [],
    photos: (photosRes.data as any[]) || [],
  };
}

// ─────────────────────────────────────────────────────────────
// PDF rendering
// ─────────────────────────────────────────────────────────────

const PAGE_MARGIN_X = 40;
const PAGE_MARGIN_TOP = 50;
const PAGE_MARGIN_BOTTOM = 50;

const COLOR_HEADING = [45, 106, 79] as [number, number, number]; // brand green
const COLOR_TEXT = [31, 41, 55] as [number, number, number];
const COLOR_MUTED = [107, 114, 128] as [number, number, number];
const COLOR_DIVIDER = [229, 231, 235] as [number, number, number];

function fmtDate(d?: string | null): string {
  if (!d) return '—';
  try {
    return new Date(d.length === 10 ? d + 'T00:00:00' : d).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return d || '—';
  }
}

function ageYears(dob?: string | null): string {
  if (!dob) return '';
  const birth = new Date(dob);
  if (isNaN(birth.getTime())) return '';
  const diffMs = Date.now() - birth.getTime();
  const years = diffMs / (365.25 * 24 * 60 * 60 * 1000);
  if (years < 1) {
    const months = Math.round(years * 12);
    return `${months} mo`;
  }
  return `${Math.floor(years)} yr`;
}

interface PdfState {
  doc: jsPDF;
  cursor: number;
  pageWidth: number;
  pageHeight: number;
  contentWidth: number;
  sections: number;
}

function newPage(s: PdfState) {
  s.doc.addPage();
  s.cursor = PAGE_MARGIN_TOP;
  drawFooter(s);
}

function ensureRoom(s: PdfState, needed: number) {
  if (s.cursor + needed > s.pageHeight - PAGE_MARGIN_BOTTOM) {
    newPage(s);
  }
}

function drawFooter(s: PdfState) {
  const { doc, pageWidth, pageHeight } = s;
  const total = doc.getNumberOfPages();
  const current = doc.getCurrentPageInfo().pageNumber;
  doc.setFontSize(8);
  doc.setTextColor(...COLOR_MUTED);
  doc.text(
    `Page ${current} of ${total} · VetTrack patient snapshot`,
    pageWidth / 2,
    pageHeight - 20,
    { align: 'center' }
  );
}

function writeText(
  s: PdfState,
  text: string,
  opts: {
    size?: number;
    bold?: boolean;
    color?: [number, number, number];
    indent?: number;
    lineHeight?: number;
  } = {}
): void {
  const { doc, contentWidth } = s;
  const size = opts.size ?? 10;
  const lineHeight = opts.lineHeight ?? size * 1.35;
  const indent = opts.indent ?? 0;
  doc.setFontSize(size);
  doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
  doc.setTextColor(...(opts.color ?? COLOR_TEXT));
  const lines = doc.splitTextToSize(text, contentWidth - indent);
  for (const line of lines) {
    ensureRoom(s, lineHeight + 2);
    doc.text(line, PAGE_MARGIN_X + indent, s.cursor);
    s.cursor += lineHeight;
  }
}

function sectionHeader(s: PdfState, title: string) {
  s.sections += 1;
  ensureRoom(s, 36);
  s.cursor += 10;
  s.doc.setDrawColor(...COLOR_DIVIDER);
  s.doc.setLineWidth(0.5);
  s.doc.line(PAGE_MARGIN_X, s.cursor, s.pageWidth - PAGE_MARGIN_X, s.cursor);
  s.cursor += 14;
  writeText(s, title.toUpperCase(), { size: 11, bold: true, color: COLOR_HEADING });
  s.cursor += 2;
}

function keyValue(s: PdfState, label: string, value: string | null | undefined) {
  if (!value) return;
  const line = `${label}: ${value}`;
  writeText(s, line, { size: 10 });
}

function bullet(s: PdfState, text: string) {
  writeText(s, `• ${text}`, { size: 10, indent: 4 });
}

export function buildPetReportPdf(
  data: GatheredReport,
  source: ReportSource,
  generatedByName?: string
): { blob: Blob; fileName: string; sectionsCount: number; title: string } {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const state: PdfState = {
    doc,
    cursor: PAGE_MARGIN_TOP,
    pageWidth,
    pageHeight,
    contentWidth: pageWidth - PAGE_MARGIN_X * 2,
    sections: 0,
  };

  const { pet, owner, clinic } = data;
  const ownerName = owner ? `${owner.first_name || ''} ${owner.last_name || ''}`.trim() : '—';

  // ── Header ──────────────────────────────────────────────────
  doc.setFillColor(...COLOR_HEADING);
  doc.rect(0, 0, pageWidth, 80, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('Patient Snapshot', PAGE_MARGIN_X, 38);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `${pet.name} · ${pet.species || 'Unknown species'}${pet.breed ? ' · ' + pet.breed : ''}`,
    PAGE_MARGIN_X,
    58
  );
  if (clinic?.name) {
    doc.setFontSize(9);
    doc.text(clinic.name, pageWidth - PAGE_MARGIN_X, 38, { align: 'right' });
  }
  const now = new Date();
  doc.setFontSize(9);
  doc.text(
    now.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) +
      ' · ' +
      now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
    pageWidth - PAGE_MARGIN_X,
    58,
    { align: 'right' }
  );

  state.cursor = 110;
  drawFooter(state);

  // Trigger banner
  doc.setFillColor(244, 162, 97, 0.1 as unknown as number); // jsPDF ignores alpha; use solid tint
  doc.setFillColor(253, 240, 226);
  doc.roundedRect(PAGE_MARGIN_X, state.cursor, state.contentWidth, 28, 6, 6, 'F');
  doc.setTextColor(180, 95, 35);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(
    `TRIGGER: ${SOURCE_LABELS[source] || source}${generatedByName ? '  ·  by ' + generatedByName : ''}`,
    PAGE_MARGIN_X + 12,
    state.cursor + 17
  );
  state.cursor += 40;

  // ── Patient info block ────────────────────────────────────
  sectionHeader(state, 'Patient');
  keyValue(state, 'Name', pet.name);
  keyValue(state, 'Species', pet.species);
  keyValue(state, 'Breed', pet.breed);
  keyValue(state, 'Sex', pet.sex);
  keyValue(state, 'Date of birth', fmtDate(pet.date_of_birth) + (pet.date_of_birth ? ` (${ageYears(pet.date_of_birth)})` : ''));
  keyValue(state, 'Color', pet.color);
  keyValue(state, 'Weight', pet.weight_kg != null ? `${pet.weight_kg} kg` : null);
  keyValue(state, 'Microchip', pet.microchip_no);
  if (pet.notes) {
    state.cursor += 4;
    writeText(state, 'Notes:', { size: 9, bold: true, color: COLOR_MUTED });
    writeText(state, pet.notes, { size: 10 });
  }

  // ── Owner ─────────────────────────────────────────────────
  if (owner) {
    sectionHeader(state, 'Owner');
    keyValue(state, 'Name', ownerName || '—');
    keyValue(state, 'Email', owner.email);
    keyValue(state, 'Phone', owner.phone);
  }

  // ── Clinic ────────────────────────────────────────────────
  if (clinic) {
    sectionHeader(state, 'Clinic');
    keyValue(state, 'Name', clinic.name);
    keyValue(state, 'Phone', clinic.phone);
    keyValue(state, 'Address', clinic.address);
  }

  // ── Problems ──────────────────────────────────────────────
  if (data.problems.length) {
    sectionHeader(state, `Problems (${data.problems.length})`);
    for (const p of data.problems) {
      writeText(
        state,
        `${p.name} — ${p.severity || 'unspecified'} · ${p.status || 'active'}`,
        { size: 10, bold: true }
      );
      keyValue(state, 'Diagnosed', fmtDate(p.date_diagnosed));
      if (p.resolved_date) keyValue(state, 'Resolved', fmtDate(p.resolved_date));
      if (p.soap_s) writeText(state, `S: ${p.soap_s}`, { size: 9, indent: 4, color: COLOR_MUTED });
      if (p.soap_o) writeText(state, `O: ${p.soap_o}`, { size: 9, indent: 4, color: COLOR_MUTED });
      if (p.soap_a) writeText(state, `A: ${p.soap_a}`, { size: 9, indent: 4, color: COLOR_MUTED });
      if (p.soap_p) writeText(state, `P: ${p.soap_p}`, { size: 9, indent: 4, color: COLOR_MUTED });
      state.cursor += 4;
    }
  }

  // ── Allergies ─────────────────────────────────────────────
  if (data.allergies.length) {
    sectionHeader(state, `Allergies (${data.allergies.length})`);
    for (const a of data.allergies) {
      bullet(state, `${a.allergen}${a.severity ? ' (' + a.severity + ')' : ''}`);
    }
  }

  // ── Vaccinations ──────────────────────────────────────────
  if (data.vaccinations.length) {
    sectionHeader(state, `Vaccinations (${data.vaccinations.length})`);
    for (const v of data.vaccinations) {
      writeText(state, v.vaccine_name || 'Vaccine', { size: 10, bold: true });
      keyValue(state, 'Administered', fmtDate(v.administered_date));
      keyValue(state, 'Next due', fmtDate(v.next_due_date));
      keyValue(state, 'Batch', v.batch_number);
      state.cursor += 4;
    }
  }

  // ── Treatment plans ───────────────────────────────────────
  if (data.treatmentPlans.length) {
    sectionHeader(state, `Treatment Plans (${data.treatmentPlans.length})`);
    for (const plan of data.treatmentPlans) {
      writeText(state, `${plan.title} — ${plan.status || 'active'}`, { size: 10, bold: true });
      keyValue(state, 'Last review', fmtDate(plan.last_review_date));
      keyValue(state, 'Next review', fmtDate(plan.next_review_date));
      if (plan.notes) writeText(state, plan.notes, { size: 9, color: COLOR_MUTED });

      const goals = data.planGoals[plan.id] || [];
      if (goals.length) {
        writeText(state, 'Goals:', { size: 9, bold: true, color: COLOR_MUTED });
        for (const g of goals) bullet(state, `${g.text} — ${g.progress}% (${g.status})`);
      }
      const milestones = data.planMilestones[plan.id] || [];
      if (milestones.length) {
        writeText(state, 'Milestones:', { size: 9, bold: true, color: COLOR_MUTED });
        for (const m of milestones)
          bullet(state, `${fmtDate(m.milestone_date)} — ${m.title} (${m.status})${m.note ? ' · ' + m.note : ''}`);
      }
      const meds = data.planMeds[plan.id] || [];
      if (meds.length) {
        writeText(state, 'Medications:', { size: 9, bold: true, color: COLOR_MUTED });
        for (const med of meds)
          bullet(state, `${med.name}${med.dose ? ' · ' + med.dose : ''}${med.purpose ? ' — ' + med.purpose : ''}`);
      }
      state.cursor += 4;
    }
  }

  // ── Diet ──────────────────────────────────────────────────
  if (data.dietPlan) {
    const d = data.dietPlan;
    sectionHeader(state, 'Diet Plan');
    if (d.food_brand || d.food_name) {
      writeText(state, `${d.food_brand ? d.food_brand + ' — ' : ''}${d.food_name || ''}`, {
        size: 10,
        bold: true,
      });
    }
    keyValue(state, 'Type', d.food_type);
    keyValue(state, 'Daily amount', d.daily_amount);
    keyValue(state, 'Meals', d.meals);
    keyValue(state, 'Calories', d.calories);
    keyValue(state, 'Water', d.water_note);
    keyValue(state, 'Treats', d.treats_note);
    keyValue(state, 'Target weight', d.target_weight_kg != null ? `${d.target_weight_kg} kg` : null);
    keyValue(state, 'Started', fmtDate(d.started_on));
    if (d.notes) writeText(state, d.notes, { size: 9, color: COLOR_MUTED });

    if (data.dietRestrictions.length) {
      state.cursor += 2;
      writeText(state, 'Restrictions:', { size: 9, bold: true, color: COLOR_MUTED });
      for (const r of data.dietRestrictions) {
        bullet(state, `${r.item}${r.severity ? ' (' + r.severity + ')' : ''}${r.reason ? ' — ' + r.reason : ''}`);
      }
    }
  }

  // ── Weight history ────────────────────────────────────────
  if (data.weights.length) {
    sectionHeader(state, `Weight History (${data.weights.length})`);
    for (const w of data.weights) {
      bullet(state, `${fmtDate(w.recorded_at)} — ${Number(w.weight_kg)} kg${w.notes ? ' · ' + w.notes : ''}`);
    }
  }

  // ── Imaging studies ───────────────────────────────────────
  if (data.imagingStudies.length) {
    sectionHeader(state, `Imaging Studies (${data.imagingStudies.length})`);
    for (const st of data.imagingStudies) {
      writeText(state, `${st.title} — ${st.modality || ''}${st.region ? ' / ' + st.region : ''}`, {
        size: 10,
        bold: true,
      });
      keyValue(state, 'Date', fmtDate(st.study_date));
      keyValue(state, 'Radiologist', st.radiologist);
      keyValue(state, 'Status', st.status);
      if (st.findings) writeText(state, 'Findings: ' + st.findings, { size: 9, color: COLOR_MUTED });
      if (st.impression) writeText(state, 'Impression: ' + st.impression, { size: 9, color: COLOR_MUTED });
      state.cursor += 4;
    }
  }

  // ── Surgeries ─────────────────────────────────────────────
  if (data.surgeries.length) {
    sectionHeader(state, `Surgeries (${data.surgeries.length})`);
    for (const sg of data.surgeries) {
      writeText(state, `${sg.name} — ${sg.status || ''}`, { size: 10, bold: true });
      keyValue(state, 'Date', fmtDate(sg.surgery_date));
      keyValue(state, 'Duration', sg.duration_minutes ? `${sg.duration_minutes} min` : null);
      keyValue(state, 'Anesthesia', sg.anesthesia);
      if (sg.pre_op) writeText(state, 'Pre-op: ' + sg.pre_op, { size: 9, color: COLOR_MUTED });
      if (sg.procedure_notes) writeText(state, 'Procedure: ' + sg.procedure_notes, { size: 9, color: COLOR_MUTED });
      if (sg.post_op) writeText(state, 'Post-op: ' + sg.post_op, { size: 9, color: COLOR_MUTED });
      if (sg.complications) writeText(state, 'Complications: ' + sg.complications, { size: 9, color: COLOR_MUTED });
      if (sg.follow_up) writeText(state, 'Follow-up: ' + sg.follow_up, { size: 9, color: COLOR_MUTED });
      state.cursor += 4;
    }
  }

  // ── Visit reports ─────────────────────────────────────────
  if (data.visitReports.length) {
    sectionHeader(state, `Visits (${data.visitReports.length})`);
    for (const v of data.visitReports) {
      writeText(state, fmtDate(v.visit_date), { size: 10, bold: true });
      keyValue(state, 'Primary diagnosis', v.primary_diagnosis);
      keyValue(state, 'Secondary diagnosis', v.secondary_diagnosis);
      if (v.clinical_notes) writeText(state, 'Notes: ' + v.clinical_notes, { size: 9, color: COLOR_MUTED });
      if (v.procedures) writeText(state, 'Procedures: ' + v.procedures, { size: 9, color: COLOR_MUTED });
      if (v.owner_instructions)
        writeText(state, 'Owner instructions: ' + v.owner_instructions, { size: 9, color: COLOR_MUTED });
      if (v.follow_up_date)
        keyValue(state, 'Follow-up', fmtDate(v.follow_up_date) + (v.follow_up_notes ? ' — ' + v.follow_up_notes : ''));
      state.cursor += 4;
    }
  }

  // ── Photos ────────────────────────────────────────────────
  if (data.photos.length) {
    sectionHeader(state, `Photos (${data.photos.length})`);
    for (const p of data.photos) {
      bullet(
        state,
        `${fmtDate(p.photo_date)} — ${p.title}${p.category ? ' [' + p.category + ']' : ''}${
          p.caption ? ' · ' + p.caption : ''
        }`
      );
    }
  }

  // ── Notes ─────────────────────────────────────────────────
  if (data.notes.length) {
    sectionHeader(state, `Notes (${data.notes.length})`);
    for (const n of data.notes) {
      writeText(
        state,
        new Date(n.created_at).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }),
        { size: 9, bold: true, color: COLOR_MUTED }
      );
      writeText(state, n.content, { size: 10 });
      state.cursor += 4;
    }
  }

  // Re-draw footer with correct page count on every page
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(...COLOR_MUTED);
    doc.text(
      `Page ${i} of ${total} · VetTrack patient snapshot · ${pet.name}`,
      pageWidth / 2,
      pageHeight - 20,
      { align: 'center' }
    );
  }

  const blob = doc.output('blob');
  const dateStr = new Date().toISOString().slice(0, 10);
  const safeName = (pet.name || 'pet').replace(/[^a-z0-9]+/gi, '_');
  const fileName = `${safeName}_${dateStr}_${SOURCE_LABELS[source].replace(/\s+/g, '_')}.pdf`;
  const title = `${pet.name} — ${SOURCE_LABELS[source]}`;
  return { blob, fileName, sectionsCount: state.sections, title };
}

// ─────────────────────────────────────────────────────────────
// Orchestrator: gather + build + upload + insert row
// ─────────────────────────────────────────────────────────────

export async function generateAndUploadPetReport(
  db: SupabaseClient,
  supabase: SupabaseClient,
  petDbId: string,
  source: ReportSource,
  opts: { organizationId: string; clinicId: string | null; generatedByStaffId: string | null; generatedByName?: string }
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  try {
    const data = await gatherPetReportData(db, petDbId);
    if (!data) return { ok: false, error: 'Pet not found' };

    const { blob, fileName, sectionsCount, title } = buildPetReportPdf(data, source, opts.generatedByName);

    const path = `${petDbId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.pdf`;
    const { error: upErr } = await supabase.storage
      .from('pet-reports')
      .upload(path, blob, { contentType: 'application/pdf' });
    if (upErr) return { ok: false, error: 'Storage upload failed: ' + upErr.message };

    const { data: urlData } = supabase.storage.from('pet-reports').getPublicUrl(path);

    const summary = buildSummary(data);

    const { data: inserted, error: insErr } = await db
      .from('pet_reports')
      .insert({
        organization_id: opts.organizationId,
        clinic_id: opts.clinicId,
        pet_id: petDbId,
        title,
        summary,
        trigger_source: source,
        sections_count: sectionsCount,
        file_url: urlData.publicUrl,
        storage_path: path,
        file_name: fileName,
        file_size: blob.size,
        generated_by: opts.generatedByStaffId,
      })
      .select('id')
      .single();

    if (insErr || !inserted) {
      // Roll back storage file
      await supabase.storage.from('pet-reports').remove([path]);
      return { ok: false, error: 'DB insert failed: ' + (insErr?.message || 'unknown') };
    }

    // Notify any mounted listener to refresh its list
    try {
      window.dispatchEvent(
        new CustomEvent('petReportCreated', { detail: { petDbId, reportId: (inserted as any).id } })
      );
    } catch {
      /* noop */
    }

    return { ok: true, id: (inserted as any).id };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}

function buildSummary(d: GatheredReport): string {
  const parts: string[] = [];
  if (d.problems.length) parts.push(`${d.problems.length} problem${d.problems.length === 1 ? '' : 's'}`);
  if (d.allergies.length) parts.push(`${d.allergies.length} allergy${d.allergies.length === 1 ? '' : 'ies'}`);
  if (d.vaccinations.length) parts.push(`${d.vaccinations.length} vaccination${d.vaccinations.length === 1 ? '' : 's'}`);
  if (d.treatmentPlans.length) parts.push(`${d.treatmentPlans.length} plan${d.treatmentPlans.length === 1 ? '' : 's'}`);
  if (d.dietPlan) parts.push('diet plan');
  if (d.weights.length) parts.push(`${d.weights.length} weight entr${d.weights.length === 1 ? 'y' : 'ies'}`);
  if (d.imagingStudies.length) parts.push(`${d.imagingStudies.length} imaging studies`);
  if (d.surgeries.length) parts.push(`${d.surgeries.length} surgeries`);
  if (d.visitReports.length) parts.push(`${d.visitReports.length} visits`);
  if (d.photos.length) parts.push(`${d.photos.length} photos`);
  if (d.notes.length) parts.push(`${d.notes.length} notes`);
  return parts.length ? parts.join(' · ') : 'No clinical data recorded yet.';
}

// Global convenience: dispatch an event from anywhere to trigger regeneration.
// The ClientDetailPage listens for this and calls generateAndUploadPetReport.
export function requestPetReport(petDbId: string, source: ReportSource) {
  try {
    window.dispatchEvent(
      new CustomEvent('petReportRegenerate', { detail: { petDbId, source } })
    );
  } catch {
    /* noop */
  }
}
