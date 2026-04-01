import { useParams, Link, useLocation } from 'react-router';
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import {
  ArrowLeft, Download, Share2, Printer, Copy, Mail, Check,
  Heart, Thermometer, Activity, Wind, Gauge, Scale,
  Stethoscope, Pill, FlaskConical, CalendarCheck, FileText,
  AlertTriangle, ChevronRight, Clock, MapPin, Phone, User,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Separator } from '../components/ui/separator';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '../components/ui/table';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from '../components/ui/dropdown-menu';

// ─── Types ───────────────────────────────────────────────────

type RecordType = 'Visit' | 'Vaccination' | 'Lab Result' | 'Surgery' | 'Prescription' | 'Dental' | 'Imaging';
type RecordStatus = 'Final' | 'Pending Review' | 'Amended' | 'Draft';
type LabFlag = 'normal' | 'high' | 'low' | 'critical';

interface DetailedRecord {
  id: number;
  recordNumber: string;
  patient: {
    name: string; species: string; breed: string; dob: string; age: string;
    sex: string; weight: string; microchip: string; color: string; image: string;
  };
  owner: { name: string; email: string; phone: string; address: string };
  visit: {
    date: string; time: string; reason: string; vet: string; vetLicense: string;
    clinic: string; clinicAddress: string; clinicPhone: string; duration: string;
    recordType: RecordType; status: RecordStatus;
  };
  vitals: {
    weight: string; temperature: string; heartRate: string; respiratoryRate: string;
    bloodPressure: string; bodyConditionScore: string; painScore: string; hydrationStatus: string;
  };
  diagnosis: {
    primary: string; secondary: string[]; differentials: string[];
    notes: string; icdCodes: { code: string; description: string }[];
  };
  treatmentPlan: {
    procedures: { name: string; notes: string; status: string }[];
    instructions: string; restrictions: string[]; homeCarePlan: string;
  };
  medications: {
    name: string; dosage: string; frequency: string; route: string;
    duration: string; prescribedBy: string; startDate: string; notes: string;
  }[];
  labResults: {
    testName: string; result: string; referenceRange: string; unit: string;
    flag: LabFlag; date: string;
  }[];
  followUp: {
    nextVisitDate: string; nextVisitReason: string; notes: string; reminderSet: boolean;
  };
  createdAt: string;
  lastModified: string;
  modifiedBy: string;
}

// ─── Color Maps ──────────────────────────────────────────────

const recordTypeColors: Record<RecordType, { bg: string; text: string }> = {
  Visit:        { bg: '#2D6A4F20', text: 'var(--brand-green-text)' },
  Vaccination:  { bg: '#3B82F620', text: '#3B82F6' },
  'Lab Result': { bg: '#8B5CF620', text: '#8B5CF6' },
  Surgery:      { bg: '#EC489920', text: '#EC4899' },
  Prescription: { bg: '#F4A26120', text: '#F4A261' },
  Dental:       { bg: '#06B6D420', text: '#06B6D4' },
  Imaging:      { bg: '#6B728020', text: 'var(--text-secondary)' },
};

const statusColors: Record<RecordStatus, { bg: string; text: string }> = {
  Final:            { bg: '#74C69D20', text: 'var(--brand-green-text)' },
  'Pending Review': { bg: '#F4A26120', text: '#F4A261' },
  Amended:          { bg: '#3B82F620', text: '#3B82F6' },
  Draft:            { bg: '#6B728020', text: 'var(--text-secondary)' },
};

const labFlagColors: Record<LabFlag, { bg: string; text: string; label: string }> = {
  normal:   { bg: '#74C69D20', text: 'var(--brand-green-text)', label: 'Normal' },
  high:     { bg: '#F4A26120', text: '#F4A261', label: 'High' },
  low:      { bg: '#3B82F620', text: '#3B82F6', label: 'Low' },
  critical: { bg: '#d4183d20', text: '#d4183d', label: 'Critical' },
};

// ─── Mock Data ───────────────────────────────────────────────

const DETAILED_RECORDS: Record<number, DetailedRecord> = {
  1: {
    id: 1,
    recordNumber: 'VT-2026-001542',
    patient: {
      name: 'Max', species: 'Dog', breed: 'Golden Retriever',
      dob: 'Jun 15, 2020', age: '5 years, 9 months', sex: 'Male (Neutered)',
      weight: '32 kg (70.5 lbs)', microchip: '900118000123456', color: 'Golden',
      image: 'https://images.unsplash.com/photo-1734966213753-1b361564bab4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxnb2xkZW4lMjByZXRyaWV2ZXIlMjBkb2clMjBwb3J0cmFpdHxlbnwxfHx8fDE3NzMyNDMxMzB8MA&ixlib=rb-4.1.0&q=80&w=400',
    },
    owner: {
      name: 'John Smith', email: 'john.smith@email.com',
      phone: '(555) 123-4567', address: '742 Evergreen Terrace, Springfield, IL 62704',
    },
    visit: {
      date: 'Mar 11, 2026', time: '9:30 AM', reason: 'Annual Wellness Exam',
      vet: 'Dr. Sarah Chen', vetLicense: 'DVM-IL-2018-4521',
      clinic: 'Hugory Animal Hospital', clinicAddress: '1200 Oak Park Ave, Springfield, IL 62704',
      clinicPhone: '(555) 800-VETS', duration: '45 minutes',
      recordType: 'Visit', status: 'Final',
    },
    vitals: {
      weight: '32 kg', temperature: '101.3°F', heartRate: '88 bpm',
      respiratoryRate: '18 breaths/min', bloodPressure: '130/85 mmHg',
      bodyConditionScore: '5/9 (Ideal)', painScore: '0/10',
      hydrationStatus: 'Normal (<2s skin turgor)',
    },
    diagnosis: {
      primary: 'Routine wellness exam — no significant findings',
      secondary: [
        'Mild tartar accumulation on upper premolars',
        'Bilateral hip dysplasia (previously diagnosed, stable)',
      ],
      differentials: [],
      notes: 'Patient is in excellent overall health. Weight is stable from last visit. Coat and skin condition are good. Eyes, ears, and oral cavity examined — mild dental tartar noted but no gingivitis. Heart and lungs auscultated — no murmurs, arrhythmias, or adventitious lung sounds. Abdominal palpation unremarkable. Musculoskeletal exam shows mild bilateral hip laxity consistent with known dysplasia — no pain on manipulation. Neurological assessment normal. Lymph nodes non-reactive.',
      icdCodes: [
        { code: 'Z00.0', description: 'General adult medical examination' },
        { code: 'M16.1', description: 'Hip dysplasia, bilateral (pre-existing)' },
        { code: 'K03.6', description: 'Dental calculus deposits' },
      ],
    },
    treatmentPlan: {
      procedures: [
        { name: 'Comprehensive Physical Examination', notes: 'Full nose-to-tail assessment', status: 'Completed' },
        { name: 'DHPP Vaccination', notes: 'Distemper/Hepatitis/Parainfluenza/Parvovirus booster', status: 'Completed' },
        { name: 'Bordetella Vaccination', notes: 'Intranasal administration', status: 'Completed' },
        { name: 'Fecal Examination', notes: 'Fecal float — negative for parasites', status: 'Completed' },
        { name: 'Blood Work', notes: 'CBC & comprehensive metabolic panel', status: 'Completed' },
      ],
      instructions: 'Continue current diet and exercise routine. Monitor hips for any changes in mobility. Schedule dental cleaning within the next 3–6 months to prevent further tartar buildup. Continue monthly heartworm prevention (Heartgard Plus).',
      restrictions: ['No restrictions at this time'],
      homeCarePlan: 'Maintain joint supplement regimen (glucosamine/chondroitin 1500mg daily). Continue fish oil supplement for coat and joint health. Brush teeth 2–3 times per week to slow tartar accumulation. Resume normal activity — swimming recommended for low-impact exercise.',
    },
    medications: [
      {
        name: 'Heartgard Plus', dosage: '272 mcg ivermectin / 227 mg pyrantel',
        frequency: 'Once monthly', route: 'Oral', duration: 'Ongoing (12 months)',
        prescribedBy: 'Dr. Sarah Chen', startDate: 'Jan 1, 2026',
        notes: 'Heartworm & intestinal parasite prevention. Give with food on 1st of each month.',
      },
      {
        name: 'Dasuquin Advanced', dosage: '1 chewable tablet',
        frequency: 'Once daily', route: 'Oral', duration: 'Ongoing',
        prescribedBy: 'Dr. Sarah Chen', startDate: 'Feb 1, 2024',
        notes: 'Joint support for hip dysplasia. Contains glucosamine, chondroitin, ASU, and MSM.',
      },
      {
        name: 'Omega-3 Fish Oil', dosage: '2000 mg (EPA/DHA)',
        frequency: 'Once daily', route: 'Oral', duration: 'Ongoing',
        prescribedBy: 'Dr. Sarah Chen', startDate: 'Feb 1, 2024',
        notes: 'Anti-inflammatory support for joints and skin/coat health. Pump onto food.',
      },
    ],
    labResults: [
      { testName: 'WBC (White Blood Cells)', result: '10.2', referenceRange: '5.5–16.9', unit: '×10³/µL', flag: 'normal', date: 'Mar 11, 2026' },
      { testName: 'RBC (Red Blood Cells)', result: '7.1', referenceRange: '5.5–8.5', unit: '×10⁶/µL', flag: 'normal', date: 'Mar 11, 2026' },
      { testName: 'Hemoglobin', result: '16.8', referenceRange: '12–18', unit: 'g/dL', flag: 'normal', date: 'Mar 11, 2026' },
      { testName: 'Hematocrit', result: '48', referenceRange: '37–55', unit: '%', flag: 'normal', date: 'Mar 11, 2026' },
      { testName: 'Platelets', result: '285', referenceRange: '175–500', unit: '×10³/µL', flag: 'normal', date: 'Mar 11, 2026' },
      { testName: 'BUN (Blood Urea Nitrogen)', result: '18', referenceRange: '7–27', unit: 'mg/dL', flag: 'normal', date: 'Mar 11, 2026' },
      { testName: 'Creatinine', result: '1.2', referenceRange: '0.5–1.8', unit: 'mg/dL', flag: 'normal', date: 'Mar 11, 2026' },
      { testName: 'ALT (Alanine Aminotransferase)', result: '42', referenceRange: '10–125', unit: 'U/L', flag: 'normal', date: 'Mar 11, 2026' },
      { testName: 'ALP (Alkaline Phosphatase)', result: '68', referenceRange: '23–212', unit: 'U/L', flag: 'normal', date: 'Mar 11, 2026' },
      { testName: 'Glucose', result: '95', referenceRange: '74–143', unit: 'mg/dL', flag: 'normal', date: 'Mar 11, 2026' },
      { testName: 'Total Protein', result: '6.8', referenceRange: '5.2–8.2', unit: 'g/dL', flag: 'normal', date: 'Mar 11, 2026' },
      { testName: 'Albumin', result: '3.4', referenceRange: '2.3–4.0', unit: 'g/dL', flag: 'normal', date: 'Mar 11, 2026' },
    ],
    followUp: {
      nextVisitDate: 'Sep 11, 2026',
      nextVisitReason: '6-month wellness recheck & dental cleaning evaluation',
      notes: 'Owner informed about dental cleaning recommendation. Will call to schedule within 3 months. Continue monitoring hip mobility — consider radiographs at next visit if any changes noted.',
      reminderSet: true,
    },
    createdAt: 'Mar 11, 2026 at 10:15 AM',
    lastModified: 'Mar 11, 2026 at 11:42 AM',
    modifiedBy: 'Dr. Sarah Chen',
  },

  5: {
    id: 5,
    recordNumber: 'VT-2026-001538',
    patient: {
      name: 'Bella', species: 'Cat', breed: 'Siamese',
      dob: 'Sep 22, 2024', age: '1 year, 5 months', sex: 'Female (Spayed)',
      weight: '3.8 kg (8.4 lbs)', microchip: '900118000987654', color: 'Seal Point',
      image: 'https://images.unsplash.com/photo-1608574592993-774ffa9a218e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzaWFtZXNlJTIwY2F0JTIwcG9ydHJhaXR8ZW58MXx8fHwxNzczMTczMjkwfDA&ixlib=rb-4.1.0&q=80&w=400',
    },
    owner: {
      name: 'Sarah Williams', email: 'swilliams@email.com',
      phone: '(555) 456-7890', address: '89 Maple Drive, Springfield, IL 62701',
    },
    visit: {
      date: 'Mar 7, 2026', time: '2:00 PM', reason: 'Ovariohysterectomy (Spay)',
      vet: 'Dr. James Park', vetLicense: 'DVM-IL-2016-3198',
      clinic: 'Hugory Animal Hospital', clinicAddress: '1200 Oak Park Ave, Springfield, IL 62704',
      clinicPhone: '(555) 800-VETS', duration: '2 hours 15 minutes',
      recordType: 'Surgery', status: 'Final',
    },
    vitals: {
      weight: '3.8 kg', temperature: '100.8°F', heartRate: '160 bpm',
      respiratoryRate: '24 breaths/min', bloodPressure: '125/80 mmHg',
      bodyConditionScore: '5/9 (Ideal)', painScore: '2/10 (post-op, managed)',
      hydrationStatus: 'Normal (<2s skin turgor)',
    },
    diagnosis: {
      primary: 'Elective ovariohysterectomy — routine spay procedure',
      secondary: ['Mild post-operative inflammation (expected)'],
      differentials: [],
      notes: 'Patient presented for elective spay. Pre-operative bloodwork (CBC, chemistry) within normal limits. Pre-anesthetic assessment score ASA I (healthy patient). Anesthesia induced with propofol, maintained with isoflurane. Ventral midline approach — ovaries and uterus identified and removed without complication. Linea alba closed with 3-0 PDS in a simple interrupted pattern. Subcuticular closure with 4-0 Monocryl. Skin sealed with tissue adhesive. No intra-operative complications. Estimated blood loss minimal (<5 mL). Recovery from anesthesia was smooth and uneventful.',
      icdCodes: [
        { code: 'Z40.2', description: 'Elective surgical sterilization' },
        { code: 'T81.4', description: 'Post-procedural inflammation (expected)' },
      ],
    },
    treatmentPlan: {
      procedures: [
        { name: 'Pre-Operative Blood Panel', notes: 'CBC & mini-chemistry — all values WNL', status: 'Completed' },
        { name: 'IV Catheter Placement', notes: '22g cephalic vein, LRS at 5 mL/kg/hr', status: 'Completed' },
        { name: 'General Anesthesia', notes: 'Propofol induction, isoflurane maintenance', status: 'Completed' },
        { name: 'Ovariohysterectomy', notes: 'Ventral midline approach, routine procedure', status: 'Completed' },
        { name: 'Post-Op Monitoring', notes: '4 hours in recovery — vitals stable throughout', status: 'Completed' },
      ],
      instructions: 'Keep patient calm and confined for 10–14 days. Use e-collar at all times to prevent licking at incision site. Check incision daily for redness, swelling, or discharge. No running, jumping, or rough play. Keep indoors only. Offer small meals tonight — return to normal feeding tomorrow.',
      restrictions: [
        'No jumping or climbing for 14 days',
        'E-collar must stay on at all times',
        'Indoor only — no outdoor access',
        'No bathing for 14 days',
        'No strenuous play with other pets',
      ],
      homeCarePlan: 'Confine to a small room or large crate for the first 7 days. Provide a clean, soft bed at ground level. Monitor appetite and litter box use — report any concerns. Incision should look clean and dry. A small amount of bruising is normal. Contact clinic immediately if: vomiting persists beyond 24 hours, incision opens or oozes, patient is lethargic beyond 48 hours, or fever develops.',
    },
    medications: [
      {
        name: 'Meloxicam (Metacam)', dosage: '0.1 mg/kg',
        frequency: 'Once daily', route: 'Oral (liquid)', duration: '3 days',
        prescribedBy: 'Dr. James Park', startDate: 'Mar 7, 2026',
        notes: 'NSAID for post-operative pain and inflammation. Give with food.',
      },
      {
        name: 'Buprenorphine', dosage: '0.02 mg/kg',
        frequency: 'Every 8 hours', route: 'Oral transmucosal (OTM)', duration: '2 days',
        prescribedBy: 'Dr. James Park', startDate: 'Mar 7, 2026',
        notes: 'Opioid analgesic for post-op pain. Apply inside cheek — do not swallow.',
      },
      {
        name: 'Cefovecin (Convenia)', dosage: '8 mg/kg — single injection',
        frequency: 'Single dose', route: 'Subcutaneous injection', duration: '14 days effective',
        prescribedBy: 'Dr. James Park', startDate: 'Mar 7, 2026',
        notes: 'Long-acting antibiotic given at time of surgery. No oral antibiotics needed.',
      },
    ],
    labResults: [
      { testName: 'WBC (White Blood Cells)', result: '9.8', referenceRange: '5.5–19.5', unit: '×10³/µL', flag: 'normal', date: 'Mar 7, 2026' },
      { testName: 'RBC (Red Blood Cells)', result: '8.2', referenceRange: '5.0–10.0', unit: '×10⁶/µL', flag: 'normal', date: 'Mar 7, 2026' },
      { testName: 'Hematocrit', result: '38', referenceRange: '30–45', unit: '%', flag: 'normal', date: 'Mar 7, 2026' },
      { testName: 'Platelets', result: '310', referenceRange: '175–500', unit: '×10³/µL', flag: 'normal', date: 'Mar 7, 2026' },
      { testName: 'ALT', result: '52', referenceRange: '12–130', unit: 'U/L', flag: 'normal', date: 'Mar 7, 2026' },
      { testName: 'BUN', result: '24', referenceRange: '16–36', unit: 'mg/dL', flag: 'normal', date: 'Mar 7, 2026' },
      { testName: 'Creatinine', result: '1.4', referenceRange: '0.8–2.4', unit: 'mg/dL', flag: 'normal', date: 'Mar 7, 2026' },
      { testName: 'Glucose', result: '112', referenceRange: '74–159', unit: 'mg/dL', flag: 'normal', date: 'Mar 7, 2026' },
    ],
    followUp: {
      nextVisitDate: 'Mar 17, 2026',
      nextVisitReason: '10-day post-operative incision check',
      notes: 'Assess incision healing. Remove e-collar if incision is fully healed. Discuss resumption of normal activity.',
      reminderSet: true,
    },
    createdAt: 'Mar 7, 2026 at 4:30 PM',
    lastModified: 'Mar 7, 2026 at 5:15 PM',
    modifiedBy: 'Dr. James Park',
  },

  8: {
    id: 8,
    recordNumber: 'VT-2026-001535',
    patient: {
      name: 'Rocky', species: 'Dog', breed: 'German Shepherd',
      dob: 'Mar 2, 2019', age: '7 years', sex: 'Male (Intact)',
      weight: '38 kg (83.8 lbs)', microchip: '900118000654321', color: 'Black & Tan',
      image: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400',
    },
    owner: {
      name: 'James Wilson', email: 'jwilson@email.com',
      phone: '(555) 678-9012', address: '156 Pine Street, Springfield, IL 62702',
    },
    visit: {
      date: 'Mar 3, 2026', time: '11:00 AM', reason: 'Exercise intolerance & coughing',
      vet: 'Dr. James Park', vetLicense: 'DVM-IL-2016-3198',
      clinic: 'Hugory Animal Hospital', clinicAddress: '1200 Oak Park Ave, Springfield, IL 62704',
      clinicPhone: '(555) 800-VETS', duration: '1 hour 30 minutes',
      recordType: 'Imaging', status: 'Pending Review',
    },
    vitals: {
      weight: '38 kg', temperature: '101.8°F', heartRate: '110 bpm',
      respiratoryRate: '28 breaths/min', bloodPressure: '145/95 mmHg',
      bodyConditionScore: '6/9 (Slightly Overweight)', painScore: '1/10',
      hydrationStatus: 'Normal (<2s skin turgor)',
    },
    diagnosis: {
      primary: 'Dilated cardiomyopathy (DCM) — suspected, pending echocardiogram',
      secondary: [
        'Mild cardiomegaly on thoracic radiographs',
        'Elevated NT-proBNP cardiac biomarker',
        'Mild pulmonary venous congestion',
      ],
      differentials: [
        'Dilated cardiomyopathy (most likely)',
        'Valvular heart disease',
        'Pericardial effusion',
        'Pulmonary hypertension',
      ],
      notes: 'Owner reports progressive exercise intolerance over the past 3–4 weeks. Occasional soft cough, especially at night when lying down. No syncope episodes. Appetite slightly decreased. On auscultation, a Grade III/VI systolic murmur was detected at the left apex. Thoracic radiographs (3 views) reveal mild generalized cardiomegaly with a vertebral heart score of 11.2 (normal <10.7 for breed). Mild pulmonary venous distension noted. Cardiac biomarker (NT-proBNP) significantly elevated at 1,850 pmol/L (normal <900). Echocardiogram referral is strongly recommended.',
      icdCodes: [
        { code: 'I42.0', description: 'Dilated cardiomyopathy (suspected)' },
        { code: 'I51.7', description: 'Cardiomegaly' },
        { code: 'R05.9', description: 'Cough, unspecified' },
        { code: 'R53.1', description: 'Exercise intolerance' },
      ],
    },
    treatmentPlan: {
      procedures: [
        { name: 'Thoracic Radiographs (3 views)', notes: 'Right lateral, left lateral, VD — cardiomegaly confirmed', status: 'Completed' },
        { name: 'Cardiac Biomarker Panel', notes: 'NT-proBNP elevated at 1,850 pmol/L', status: 'Completed' },
        { name: 'Echocardiogram', notes: 'Referral to veterinary cardiologist — Dr. Amanda Torres', status: 'Scheduled' },
        { name: 'Electrocardiogram (ECG)', notes: 'To be performed at cardiology referral', status: 'Pending' },
      ],
      instructions: 'Restrict exercise to short, leashed walks only — no running, jumping, or strenuous activity. Monitor respiratory rate at rest (count breaths per minute while sleeping — normal <30). Start Pimobendan immediately. Low-sodium diet recommended.',
      restrictions: [
        'No strenuous exercise — leashed walks only',
        'No swimming or off-leash activity',
        'Avoid heat and humidity exposure',
        'Low-sodium diet (Hill\'s h/d or Royal Canin Cardiac)',
      ],
      homeCarePlan: 'Monitor sleeping respiratory rate daily and log in diary — bring to each visit. Target resting respiratory rate <30 breaths/min. Transition to cardiac diet over 5–7 days by mixing with current food. Ensure fresh water is always available. Weigh weekly — sudden weight gain may indicate fluid retention.',
    },
    medications: [
      {
        name: 'Pimobendan (Vetmedin)', dosage: '0.25 mg/kg (9.5 mg)',
        frequency: 'Twice daily (every 12 hours)', route: 'Oral', duration: 'Ongoing — lifelong',
        prescribedBy: 'Dr. James Park', startDate: 'Mar 3, 2026',
        notes: 'Positive inotrope/vasodilator. Give 1 hour BEFORE meals on empty stomach.',
      },
      {
        name: 'Furosemide (Lasix)', dosage: '2 mg/kg (76 mg)',
        frequency: 'Twice daily', route: 'Oral', duration: 'Ongoing — adjust based on recheck',
        prescribedBy: 'Dr. James Park', startDate: 'Mar 3, 2026',
        notes: 'Loop diuretic to manage pulmonary congestion. Monitor water intake and urination.',
      },
      {
        name: 'Enalapril', dosage: '0.5 mg/kg (19 mg)',
        frequency: 'Once daily', route: 'Oral', duration: 'Ongoing — lifelong',
        prescribedBy: 'Dr. James Park', startDate: 'Mar 3, 2026',
        notes: 'ACE inhibitor for afterload reduction. Recheck kidney values in 7 days.',
      },
    ],
    labResults: [
      { testName: 'NT-proBNP', result: '1,850', referenceRange: '<900', unit: 'pmol/L', flag: 'critical', date: 'Mar 3, 2026' },
      { testName: 'Cardiac Troponin I', result: '0.18', referenceRange: '<0.10', unit: 'ng/mL', flag: 'high', date: 'Mar 3, 2026' },
      { testName: 'BUN', result: '26', referenceRange: '7–27', unit: 'mg/dL', flag: 'normal', date: 'Mar 3, 2026' },
      { testName: 'Creatinine', result: '1.6', referenceRange: '0.5–1.8', unit: 'mg/dL', flag: 'normal', date: 'Mar 3, 2026' },
      { testName: 'Sodium', result: '148', referenceRange: '144–160', unit: 'mEq/L', flag: 'normal', date: 'Mar 3, 2026' },
      { testName: 'Potassium', result: '4.8', referenceRange: '3.5–5.8', unit: 'mEq/L', flag: 'normal', date: 'Mar 3, 2026' },
      { testName: 'WBC', result: '12.4', referenceRange: '5.5–16.9', unit: '×10³/µL', flag: 'normal', date: 'Mar 3, 2026' },
      { testName: 'Hematocrit', result: '46', referenceRange: '37–55', unit: '%', flag: 'normal', date: 'Mar 3, 2026' },
    ],
    followUp: {
      nextVisitDate: 'Mar 10, 2026',
      nextVisitReason: '7-day recheck — kidney values, electrolytes, response to medications',
      notes: 'Priority follow-up to assess renal function after starting diuretic and ACE inhibitor therapy. Echocardiogram referral with Dr. Amanda Torres scheduled for Mar 14, 2026. Owner understands the urgency and potential severity of the condition.',
      reminderSet: true,
    },
    createdAt: 'Mar 3, 2026 at 12:30 PM',
    lastModified: 'Mar 3, 2026 at 2:15 PM',
    modifiedBy: 'Dr. James Park',
  },
};

const DEFAULT_RECORD = DETAILED_RECORDS[1];

// ─── Helper Components ───────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-2">
      <span className="text-[var(--text-secondary)]" style={{ fontSize: '14px' }}>{label}</span>
      <span className="text-[var(--text-primary)] text-right" style={{ fontSize: '14px', fontWeight: 500 }}>{value}</span>
    </div>
  );
}

function SectionHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="w-8 h-8 flex items-center justify-center" style={{ backgroundColor: '#2D6A4F20', borderRadius: '8px' }}>
        <Icon className="w-4 h-4 text-[var(--brand-green-text)]" />
      </div>
      <h3 className="text-[var(--text-primary)]" style={{ fontSize: '18px', fontWeight: 600 }}>{title}</h3>
    </div>
  );
}

function VitalCard({ label, value, icon: Icon, isAbnormal }: { label: string; value: string; icon: React.ElementType; isAbnormal?: boolean }) {
  const color = isAbnormal ? '#F4A261' : 'var(--brand-green-text)';
  return (
    <div className="p-4 border border-[var(--border-color)]" style={{ borderRadius: '8px' }}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4" style={{ color }} />
        <span className="text-[var(--text-secondary)]" style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
      </div>
      <p style={{ fontSize: '16px', fontWeight: 600, color }}>{value}</p>
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────

export default function RecordDetailPage() {
  const { id } = useParams();
  const { pathname } = useLocation();
  const basePath = pathname.startsWith('/admin') ? '/admin/records' : '/records';
  const mockRecord = Number(id) ? DETAILED_RECORDS[Number(id)] : null;
  const [realRecord, setRealRecord] = useState<DetailedRecord | null>(null);
  const [loading, setLoading] = useState(!mockRecord);

  useEffect(() => {
    if (mockRecord || !id || !id.includes('-')) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('medical_records')
        .select('*, pets(id, name, species, breed, photo_url, date_of_birth, sex, weight_kg, color, microchip_no), clients(id, first_name, last_name, email, phone), staff!medical_records_vet_id_fkey(id, profiles:profiles!staff_profile_id_fkey(first_name, last_name)), record_vitals(weight_kg, temperature_c, heart_rate_bpm, respiratory_rate_bpm, blood_pressure_systolic, blood_pressure_diastolic, body_condition_score, pain_score, hydration_status), record_diagnoses(type, description, icd_code, notes), record_treatments(procedure_name, description, post_visit_instructions, activity_restrictions, home_care_plan)')
        .eq('id', id)
        .single();
      if (data) {
        const visitDate = new Date(data.visit_date + 'T12:00:00');
        setRealRecord({
          id: 0,
          recordNumber: data.record_number,
          patient: (() => {
            const pet = data.pets;
            let age = '—';
            let dobStr = '—';
            if (pet?.date_of_birth) {
              const dob = new Date(pet.date_of_birth + 'T12:00:00');
              dobStr = dob.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
              const now = new Date();
              const years = now.getFullYear() - dob.getFullYear();
              const months = now.getMonth() - dob.getMonth();
              const totalMonths = years * 12 + months;
              age = totalMonths >= 12 ? `${Math.floor(totalMonths / 12)} years, ${totalMonths % 12} months` : `${totalMonths} months`;
            }
            const weightKg = pet?.weight_kg;
            const weightStr = weightKg ? `${weightKg} kg (${(weightKg * 2.205).toFixed(1)} lbs)` : '—';
            return {
              name: pet?.name ?? '—',
              species: pet?.species ?? '—',
              breed: pet?.breed ?? '—',
              dob: dobStr,
              age,
              sex: pet?.sex ?? '—',
              weight: weightStr,
              microchip: pet?.microchip_no ?? '—',
              color: pet?.color ?? '—',
              image: pet?.photo_url ?? '',
            };
          })(),
          owner: {
            name: data.clients ? `${data.clients.first_name} ${data.clients.last_name}` : '—',
            email: data.clients?.email ?? '—',
            phone: data.clients?.phone ?? '—',
            address: '—',
          },
          visit: {
            date: visitDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
            time: (() => {
              if (!data.visit_time) return '—';
              const parts = data.visit_time.split(':');
              let h = parseInt(parts[0], 10);
              const m = parts[1] || '00';
              const ampm = h >= 12 ? 'PM' : 'AM';
              if (h > 12) h -= 12;
              if (h === 0) h = 12;
              return `${h}:${m} ${ampm}`;
            })(),
            reason: data.reason ?? '—',
            vet: (data as any).staff?.profiles ? `Dr. ${(data as any).staff.profiles.first_name} ${(data as any).staff.profiles.last_name}` : '—',
            vetLicense: '—',
            clinic: 'HugoIT Veterinary Clinic',
            clinicAddress: '—',
            clinicPhone: '—',
            duration: data.duration_minutes ? `${data.duration_minutes} minutes` : '—',
            recordType: (data.record_type || 'Visit') as RecordType,
            status: (data.status || 'Final') as RecordStatus,
          },
          vitals: (() => {
            const rv = Array.isArray((data as any).record_vitals) ? (data as any).record_vitals[0] : (data as any).record_vitals;
            const weight = rv?.weight_kg ? String(rv.weight_kg) : null;
            const temp = rv?.temperature_c ? String((rv.temperature_c * 9/5 + 32).toFixed(1)) : null;
            const hr = rv?.heart_rate_bpm ? String(rv.heart_rate_bpm) : null;
            const rr = rv?.respiratory_rate_bpm ? String(rv.respiratory_rate_bpm) : null;
            const bpSys = rv?.blood_pressure_systolic;
            const bpDia = rv?.blood_pressure_diastolic;
            const bcs = rv?.body_condition_score ? String(rv.body_condition_score) : null;
            const ps = rv?.pain_score ? String(rv.pain_score) : null;
            const hydration = rv?.hydration_status || null;
            return {
              weight: weight ? `${weight} kg` : '—',
              temperature: temp ? `${temp}°F` : '—',
              heartRate: hr ? `${hr} bpm` : '—',
              respiratoryRate: rr ? `${rr} brpm` : '—',
              bloodPressure: bpSys && bpDia ? `${bpSys}/${bpDia} mmHg` : '—',
              bodyConditionScore: bcs ? `${bcs}/9` : '—',
              painScore: ps ? `${ps}/10` : '—',
              hydrationStatus: hydration || '—',
            };
          })(),
          diagnosis: (() => {
            const dxRows = (data as any).record_diagnoses || [];
            const primaryDx = dxRows.find((d: any) => d.type === 'primary')?.description || '—';
            const secondary = dxRows.filter((d: any) => d.type === 'secondary').map((d: any) => d.description);
            const differentials = dxRows.filter((d: any) => d.type === 'differential').map((d: any) => d.description);
            const icdCodes = dxRows.filter((d: any) => d.icd_code).map((d: any) => ({ code: d.icd_code, description: d.description || '' }));
            return {
              primary: primaryDx,
              secondary,
              differentials,
              notes: (data as any).clinical_notes || dxRows.map((d: any) => d.notes).filter(Boolean).join('\n') || '',
              icdCodes,
            };
          })(),
          treatmentPlan: (() => {
            const txRows = (data as any).record_treatments || [];
            const procedures = txRows.map((t: any) => ({ name: t.procedure_name || '—', notes: t.description || '', status: 'Completed' }));
            const instructions = txRows.map((t: any) => t.post_visit_instructions).filter(Boolean).join('\n') || '';
            const restrictions = txRows.map((t: any) => t.activity_restrictions).filter(Boolean);
            const homeCarePlan = txRows.map((t: any) => t.home_care_plan).filter(Boolean).join('\n') || '';
            return { procedures, instructions, restrictions, homeCarePlan };
          })(),
          medications: await (async () => {
            try {
              const { data: medsData } = await supabase
                .from('medications')
                .select('name, dosage, frequency, route, duration_days, start_date, notes, prescribed_by')
                .eq('record_id', data.id);
              if (medsData && medsData.length > 0) {
                return medsData.map((m: any) => ({
                  name: m.name || '—', dosage: m.dosage || '—', frequency: m.frequency || '—',
                  route: m.route || '—', duration: m.duration_days ? `${m.duration_days} days` : '—',
                  prescribedBy: '—', startDate: m.start_date || data.visit_date || '—', notes: m.notes || '',
                }));
              }
              return [];
            } catch { return []; }
          })(),
          labResults: await (async () => {
            try {
              const { data: labs } = await supabase
                .from('lab_results')
                .select('test_name, result_value, reference_range, unit, flag, tested_at')
                .eq('record_id', data.id);
              if (labs && labs.length > 0) {
                const flagMap: Record<string, LabFlag> = { normal: 'normal', high: 'high', low: 'low', critical: 'critical' };
                return labs.map((l: any) => ({
                  testName: l.test_name || '—',
                  result: l.result_value || 'Pending',
                  referenceRange: l.reference_range || '—',
                  unit: l.unit || '',
                  flag: flagMap[l.flag] || 'Normal',
                  date: l.tested_at ? new Date(l.tested_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—',
                }));
              }
            } catch {}
            return [];
          })(),
          followUp: {
            nextVisitDate: data.follow_up_date ? new Date(data.follow_up_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—',
            nextVisitReason: data.follow_up_reason ?? '—',
            notes: data.follow_up_notes ?? '',
            reminderSet: !!data.follow_up_date,
          },
          createdAt: new Date(data.created_at).toLocaleString(),
          lastModified: new Date(data.updated_at).toLocaleString(),
          modifiedBy: '—',
        });
      }
      setLoading(false);
    })();
  }, [id, mockRecord]);

  const record = mockRecord || realRecord || DEFAULT_RECORD;
  const [linkCopied, setLinkCopied] = useState(false);

  if (loading) {
    return (
      <div className="max-w-[1200px] mx-auto p-8 flex items-center justify-center" style={{ minHeight: '60vh' }}>
        <div className="text-center">
          <div className="w-8 h-8 border-3 border-[var(--border-color)] border-t-[var(--brand-green-text)] rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[var(--text-secondary)]" style={{ fontSize: '14px' }}>Loading record…</p>
        </div>
      </div>
    );
  }

  const typeStyle = recordTypeColors[record.visit.recordType];
  const sttStyle = statusColors[record.visit.status];

  const handleCopyLink = () => {
    const url = `${window.location.origin}${basePath}/${record.id}`;
    navigator.clipboard.writeText(url);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const handleEmailShare = () => {
    const url = `${window.location.origin}${basePath}/${record.id}`;
    const subject = encodeURIComponent(`Medical Record — ${record.patient.name}`);
    const body = encodeURIComponent(`View the medical record for ${record.patient.name}: ${url}`);
    window.open(`mailto:${record.owner.email}?subject=${subject}&body=${body}`);
  };

  return (
    <div className="max-w-[1200px] mx-auto p-8">
      {/* Back Link */}
      <Link to={basePath} className="inline-flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--brand-green-text)] transition-colors mb-6" style={{ fontSize: '14px' }}>
        <ArrowLeft className="w-4 h-4" />
        Back to Records
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-[var(--text-primary)]" style={{ fontSize: '28px', fontWeight: 700 }}>{record.recordNumber}</h1>
            <span className="inline-block px-3 py-1" style={{ backgroundColor: typeStyle.bg, color: typeStyle.text, borderRadius: '9999px', fontSize: '13px', fontWeight: 600 }}>
              {record.visit.recordType}
            </span>
            <span className="inline-block px-3 py-1" style={{ backgroundColor: sttStyle.bg, color: sttStyle.text, borderRadius: '9999px', fontSize: '13px', fontWeight: 600 }}>
              {record.visit.status}
            </span>
          </div>
          <p className="text-[var(--text-secondary)]" style={{ fontSize: '15px' }}>
            {record.patient.name} • {record.visit.reason} • {record.visit.date}
          </p>
        </div>
        {/* CTA Export / Share Buttons */}
        <div className="flex items-center gap-2">
          <Button
            onClick={() => window.print()}
            className="gap-2"
            style={{ backgroundColor: 'var(--brand-green-text)', color: '#fff' }}
          >
            <Download className="w-4 h-4" />
            Export PDF
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Share2 className="w-4 h-4" />
                Share
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleCopyLink}>
                {linkCopied ? <Check className="w-4 h-4 mr-2 text-[var(--brand-green-text)]" /> : <Copy className="w-4 h-4 mr-2" />}
                {linkCopied ? 'Link Copied!' : 'Copy Link'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleEmailShare}>
                <Mail className="w-4 h-4 mr-2" />
                Email to Owner
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => window.print()}>
                <Printer className="w-4 h-4 mr-2" />
                Print Record
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* ───────── Section 1: Patient Info + Visit Details ───────── */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* Patient Info */}
        <div className="bg-[var(--surface-white)] border border-[var(--border-color)] p-6" style={{ borderRadius: '12px' }}>
          <SectionHeader icon={User} title="Patient Information" />
          <div className="flex items-center gap-4 mb-4">
            {record.patient.image ? (
              <img src={record.patient.image} alt={record.patient.name} className="w-16 h-16 object-cover" style={{ borderRadius: '9999px' }} />
            ) : (
              <div className="w-16 h-16 flex items-center justify-center text-white font-bold flex-shrink-0" style={{ borderRadius: '9999px', backgroundColor: '#2D6A4F', fontSize: '18px' }}>{record.patient.name.slice(0, 2).toUpperCase()}</div>
            )}
            <div>
              <p className="text-[var(--text-primary)]" style={{ fontSize: '20px', fontWeight: 700 }}>{record.patient.name}</p>
              <p className="text-[var(--text-secondary)]" style={{ fontSize: '14px' }}>{record.patient.species} • {record.patient.breed}</p>
            </div>
          </div>
          <Separator className="my-3" />
          <InfoRow label="Date of Birth" value={record.patient.dob} />
          <InfoRow label="Age" value={record.patient.age} />
          <InfoRow label="Sex" value={record.patient.sex} />
          <InfoRow label="Weight" value={record.patient.weight} />
          <InfoRow label="Color" value={record.patient.color} />
          <InfoRow label="Microchip" value={record.patient.microchip} />
        </div>

        {/* Visit Details */}
        <div className="bg-[var(--surface-white)] border border-[var(--border-color)] p-6" style={{ borderRadius: '12px' }}>
          <SectionHeader icon={Stethoscope} title="Visit Details" />
          <InfoRow label="Date" value={record.visit.date} />
          <InfoRow label="Time" value={record.visit.time} />
          <InfoRow label="Reason for Visit" value={record.visit.reason} />
          <InfoRow label="Duration" value={record.visit.duration} />
          <Separator className="my-3" />
          <InfoRow label="Attending Veterinarian" value={record.visit.vet} />
          <InfoRow label="License Number" value={record.visit.vetLicense} />
          <Separator className="my-3" />
          <div className="flex items-center gap-2 mt-2">
            <MapPin className="w-4 h-4 text-[var(--text-secondary)]" />
            <span className="text-[var(--text-secondary)]" style={{ fontSize: '13px' }}>{record.visit.clinic}</span>
          </div>
          <div className="flex items-center gap-2 mt-1 pl-6">
            <span className="text-[var(--text-secondary)]" style={{ fontSize: '13px' }}>{record.visit.clinicAddress}</span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <Phone className="w-4 h-4 text-[var(--text-secondary)]" />
            <span className="text-[var(--text-secondary)]" style={{ fontSize: '13px' }}>{record.visit.clinicPhone}</span>
          </div>
        </div>
      </div>

      {/* Owner Info Strip */}
      <div className="bg-[var(--surface-white)] border border-[var(--border-color)] p-5 mb-6" style={{ borderRadius: '12px' }}>
        <div className="flex items-center gap-8 flex-wrap">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-[var(--text-secondary)]" />
            <span className="text-[var(--text-secondary)]" style={{ fontSize: '13px' }}>Owner:</span>
            <span className="text-[var(--text-primary)]" style={{ fontSize: '14px', fontWeight: 600 }}>{record.owner.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <Phone className="w-4 h-4 text-[var(--text-secondary)]" />
            <span className="text-[var(--text-secondary)]" style={{ fontSize: '13px' }}>{record.owner.phone}</span>
          </div>
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-[var(--text-secondary)]" />
            <span className="text-[var(--text-secondary)]" style={{ fontSize: '13px' }}>{record.owner.email}</span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-[var(--text-secondary)]" />
            <span className="text-[var(--text-secondary)]" style={{ fontSize: '13px' }}>{record.owner.address}</span>
          </div>
        </div>
      </div>

      {/* ───────── Section 2: Vitals ───────── */}
      <div className="bg-[var(--surface-white)] border border-[var(--border-color)] p-6 mb-6" style={{ borderRadius: '12px' }}>
        <SectionHeader icon={Activity} title="Vitals" />
        <div className="grid grid-cols-4 gap-4">
          <VitalCard label="Weight" value={record.vitals.weight} icon={Scale} />
          <VitalCard label="Temperature" value={record.vitals.temperature} icon={Thermometer} />
          <VitalCard label="Heart Rate" value={record.vitals.heartRate} icon={Heart} isAbnormal={parseInt(record.vitals.heartRate) > 100} />
          <VitalCard label="Respiratory Rate" value={record.vitals.respiratoryRate} icon={Wind} isAbnormal={parseInt(record.vitals.respiratoryRate) > 24} />
          <VitalCard label="Blood Pressure" value={record.vitals.bloodPressure} icon={Gauge} isAbnormal={parseInt(record.vitals.bloodPressure) > 140} />
          <VitalCard label="Body Condition" value={record.vitals.bodyConditionScore} icon={Activity} />
          <VitalCard label="Pain Score" value={record.vitals.painScore} icon={AlertTriangle} isAbnormal={parseInt(record.vitals.painScore) > 3} />
          <VitalCard label="Hydration" value={record.vitals.hydrationStatus} icon={Activity} />
        </div>
      </div>

      {/* ───────── Section 3: Diagnosis ───────── */}
      <div className="bg-[var(--surface-white)] border border-[var(--border-color)] p-6 mb-6" style={{ borderRadius: '12px' }}>
        <SectionHeader icon={Stethoscope} title="Diagnosis" />

        <div className="mb-4">
          <span className="text-[var(--text-secondary)]" style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Primary Diagnosis</span>
          <p className="text-[var(--text-primary)] mt-1" style={{ fontSize: '16px', fontWeight: 600 }}>{record.diagnosis.primary}</p>
        </div>

        {record.diagnosis.secondary.length > 0 && (
          <div className="mb-4">
            <span className="text-[var(--text-secondary)]" style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Secondary Findings</span>
            <ul className="mt-1 space-y-1">
              {record.diagnosis.secondary.map((s, i) => (
                <li key={i} className="flex items-start gap-2">
                  <ChevronRight className="w-4 h-4 text-[var(--text-secondary)] mt-0.5 flex-shrink-0" />
                  <span className="text-[var(--text-primary)]" style={{ fontSize: '14px' }}>{s}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {record.diagnosis.differentials.length > 0 && (
          <div className="mb-4">
            <span className="text-[var(--text-secondary)]" style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Differential Diagnoses</span>
            <ul className="mt-1 space-y-1">
              {record.diagnosis.differentials.map((d, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-[var(--text-secondary)]" style={{ fontSize: '14px' }}>•</span>
                  <span className="text-[var(--text-secondary)]" style={{ fontSize: '14px' }}>{d}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <Separator className="my-4" />

        <div className="mb-4">
          <span className="text-[var(--text-secondary)]" style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Clinical Notes</span>
          <p className="text-[var(--text-primary)] mt-2 leading-relaxed" style={{ fontSize: '14px' }}>{record.diagnosis.notes}</p>
        </div>

        <Separator className="my-4" />

        <div>
          <span className="text-[var(--text-secondary)]" style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>ICD Codes</span>
          <div className="mt-2 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="py-2 px-3" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Code</TableHead>
                  <TableHead className="py-2 px-3" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Description</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {record.diagnosis.icdCodes.map((code, i) => (
                  <TableRow key={i} className="hover:bg-[var(--surface-elevated)]">
                    <TableCell className="py-2 px-3">
                      <span className="inline-block px-2 py-0.5 bg-[var(--surface-elevated)] text-[var(--text-primary)]" style={{ borderRadius: '4px', fontSize: '13px', fontWeight: 600, fontFamily: 'monospace' }}>{code.code}</span>
                    </TableCell>
                    <TableCell className="py-2 px-3">
                      <span className="text-[var(--text-primary)]" style={{ fontSize: '13px' }}>{code.description}</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      {/* ───────── Section 4: Treatment Plan ───────── */}
      <div className="bg-[var(--surface-white)] border border-[var(--border-color)] p-6 mb-6" style={{ borderRadius: '12px' }}>
        <SectionHeader icon={FileText} title="Treatment Plan" />

        <div className="mb-5 overflow-x-auto">
          <span className="text-[var(--text-secondary)] block mb-2" style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Procedures</span>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="py-2 px-3" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Procedure</TableHead>
                <TableHead className="py-2 px-3" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Notes</TableHead>
                <TableHead className="py-2 px-3" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {record.treatmentPlan.procedures.map((proc, i) => (
                <TableRow key={i} className="hover:bg-[var(--surface-elevated)]">
                  <TableCell className="py-2 px-3">
                    <span className="text-[var(--text-primary)]" style={{ fontSize: '14px', fontWeight: 500 }}>{proc.name}</span>
                  </TableCell>
                  <TableCell className="py-2 px-3">
                    <span className="text-[var(--text-secondary)]" style={{ fontSize: '13px' }}>{proc.notes}</span>
                  </TableCell>
                  <TableCell className="py-2 px-3">
                    <span className="inline-block px-2 py-0.5" style={{
                      backgroundColor: proc.status === 'Completed' ? '#74C69D20' : proc.status === 'Scheduled' ? '#3B82F620' : '#F4A26120',
                      color: proc.status === 'Completed' ? 'var(--brand-green-text)' : proc.status === 'Scheduled' ? '#3B82F6' : '#F4A261',
                      borderRadius: '9999px', fontSize: '12px', fontWeight: 600,
                    }}>
                      {proc.status}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <Separator className="my-4" />

        <div className="mb-4">
          <span className="text-[var(--text-secondary)]" style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Post-Visit Instructions</span>
          <p className="text-[var(--text-primary)] mt-2 leading-relaxed" style={{ fontSize: '14px' }}>{record.treatmentPlan.instructions}</p>
        </div>

        <div className="mb-4">
          <span className="text-[var(--text-secondary)]" style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Activity Restrictions</span>
          <div className="flex flex-wrap gap-2 mt-2">
            {record.treatmentPlan.restrictions.map((r, i) => (
              <span key={i} className="inline-block px-3 py-1 border border-[var(--border-color)] text-[var(--text-primary)]" style={{ borderRadius: '8px', fontSize: '13px' }}>
                {r}
              </span>
            ))}
          </div>
        </div>

        <div>
          <span className="text-[var(--text-secondary)]" style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Home Care Plan</span>
          <p className="text-[var(--text-primary)] mt-2 leading-relaxed" style={{ fontSize: '14px' }}>{record.treatmentPlan.homeCarePlan}</p>
        </div>
      </div>

      {/* ───────── Section 5: Medications ───────── */}
      <div className="bg-[var(--surface-white)] border border-[var(--border-color)] p-6 mb-6" style={{ borderRadius: '12px' }}>
        <SectionHeader icon={Pill} title="Medications" />
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {['Medication', 'Dosage', 'Frequency', 'Route', 'Duration', 'Start Date', 'Notes'].map((h) => (
                  <TableHead key={h} className="py-2 px-3" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {record.medications.map((med, i) => (
                <TableRow key={i} className="hover:bg-[var(--surface-elevated)]">
                  <TableCell className="py-3 px-3">
                    <span className="text-[var(--text-primary)]" style={{ fontSize: '14px', fontWeight: 600 }}>{med.name}</span>
                  </TableCell>
                  <TableCell className="py-3 px-3">
                    <span className="text-[var(--text-primary)]" style={{ fontSize: '13px' }}>{med.dosage}</span>
                  </TableCell>
                  <TableCell className="py-3 px-3">
                    <span className="text-[var(--text-secondary)]" style={{ fontSize: '13px' }}>{med.frequency}</span>
                  </TableCell>
                  <TableCell className="py-3 px-3">
                    <span className="text-[var(--text-secondary)]" style={{ fontSize: '13px' }}>{med.route}</span>
                  </TableCell>
                  <TableCell className="py-3 px-3">
                    <span className="text-[var(--text-secondary)]" style={{ fontSize: '13px' }}>{med.duration}</span>
                  </TableCell>
                  <TableCell className="py-3 px-3">
                    <span className="text-[var(--text-secondary)]" style={{ fontSize: '13px' }}>{med.startDate}</span>
                  </TableCell>
                  <TableCell className="py-3 px-3 max-w-[200px]">
                    <span className="text-[var(--text-secondary)]" style={{ fontSize: '12px' }}>{med.notes}</span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* ───────── Section 6: Lab Results ───────── */}
      <div className="bg-[var(--surface-white)] border border-[var(--border-color)] p-6 mb-6" style={{ borderRadius: '12px' }}>
        <SectionHeader icon={FlaskConical} title="Lab Results" />
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {['Test', 'Result', 'Reference Range', 'Unit', 'Flag'].map((h) => (
                  <TableHead key={h} className="py-2 px-3" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {record.labResults.map((lab, i) => {
                const flagStyle = labFlagColors[lab.flag];
                return (
                  <TableRow key={i} className="hover:bg-[var(--surface-elevated)]">
                    <TableCell className="py-2.5 px-3">
                      <span className="text-[var(--text-primary)]" style={{ fontSize: '14px', fontWeight: 500 }}>{lab.testName}</span>
                    </TableCell>
                    <TableCell className="py-2.5 px-3">
                      <span style={{ fontSize: '14px', fontWeight: 600, color: flagStyle.text }}>{lab.result}</span>
                    </TableCell>
                    <TableCell className="py-2.5 px-3">
                      <span className="text-[var(--text-secondary)]" style={{ fontSize: '13px' }}>{lab.referenceRange}</span>
                    </TableCell>
                    <TableCell className="py-2.5 px-3">
                      <span className="text-[var(--text-secondary)]" style={{ fontSize: '13px' }}>{lab.unit}</span>
                    </TableCell>
                    <TableCell className="py-2.5 px-3">
                      <span className="inline-block px-2 py-0.5" style={{ backgroundColor: flagStyle.bg, color: flagStyle.text, borderRadius: '9999px', fontSize: '12px', fontWeight: 600 }}>
                        {flagStyle.label}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* ───────── Section 7: Follow-Up ───────── */}
      <div className="bg-[var(--surface-white)] border border-[var(--border-color)] p-6 mb-6" style={{ borderRadius: '12px' }}>
        <SectionHeader icon={CalendarCheck} title="Follow-Up" />
        <div className="grid grid-cols-2 gap-6">
          <div>
            <InfoRow label="Next Visit Date" value={record.followUp.nextVisitDate} />
            <InfoRow label="Reason" value={record.followUp.nextVisitReason} />
            <InfoRow label="Reminder Set" value={record.followUp.reminderSet ? 'Yes' : 'No'} />
          </div>
          <div>
            <span className="text-[var(--text-secondary)]" style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Additional Notes</span>
            <p className="text-[var(--text-primary)] mt-2 leading-relaxed" style={{ fontSize: '14px' }}>{record.followUp.notes}</p>
          </div>
        </div>
      </div>

      {/* ───────── Footer: Metadata ───────── */}
      <div className="bg-[var(--surface-white)] border border-[var(--border-color)] p-6" style={{ borderRadius: '12px' }}>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[var(--text-secondary)]" />
              <span className="text-[var(--text-secondary)]" style={{ fontSize: '13px' }}>Created: {record.createdAt}</span>
            </div>
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-[var(--text-secondary)]" />
              <span className="text-[var(--text-secondary)]" style={{ fontSize: '13px' }}>Last Modified: {record.lastModified} by {record.modifiedBy}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
