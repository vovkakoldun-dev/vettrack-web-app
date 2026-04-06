import { useParams, Link, useNavigate } from 'react-router';
import { useState } from 'react';
import {
  ArrowLeft, Download, Printer, Copy, Check,
  Heart, Thermometer, Activity, Wind, Gauge, Scale,
  Stethoscope, Pill, FlaskConical, CalendarCheck, FileText,
  AlertTriangle, ChevronRight, Clock, MapPin, Phone, User, Lock,
  Clock3,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Separator } from '../../components/ui/separator';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '../../components/ui/table';

// ─── Types ───────────────────────────────────────────────────

type RecordType = 'Visit' | 'Vaccination' | 'Lab Result' | 'Surgery' | 'Prescription' | 'Dental' | 'Imaging';
type RecordStatus = 'Final' | 'Pending Vet Review' | 'In Progress';
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
  Visit:        { bg: 'color-mix(in srgb, var(--brand-green-text) 12%, transparent)', text: 'var(--brand-green-text)' },
  Vaccination:  { bg: '#3B82F620', text: '#3B82F6' },
  'Lab Result': { bg: '#8B5CF620', text: '#8B5CF6' },
  Surgery:      { bg: '#EC489920', text: '#EC4899' },
  Prescription: { bg: '#F4A26120', text: '#F4A261' },
  Dental:       { bg: '#06B6D420', text: '#06B6D4' },
  Imaging:      { bg: '#6B728020', text: 'var(--text-secondary)' },
};

const statusColors: Record<RecordStatus, { bg: string; text: string; border: string }> = {
  'Final':              { bg: '#74C69D20', text: 'var(--brand-green-text)', border: '#74C69D40' },
  'Pending Vet Review': { bg: '#F4A26118', text: '#D97706',                 border: '#F4A26140' },
  'In Progress':        { bg: '#3B82F615', text: '#3B82F6',                 border: '#3B82F630' },
};

const labFlagColors: Record<LabFlag, { bg: string; text: string; label: string }> = {
  normal:   { bg: '#74C69D20', text: 'var(--brand-green-text)', label: 'Normal' },
  high:     { bg: '#F4A26120', text: '#F4A261', label: 'High' },
  low:      { bg: '#3B82F620', text: '#3B82F6', label: 'Low' },
  critical: { bg: '#d4183d20', text: '#d4183d', label: 'Critical' },
};

// ─── Mock Data ───────────────────────────────────────────────

const MAX_IMAGE = 'https://images.unsplash.com/photo-1734966213753-1b361564bab4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxnb2xkZW4lMjByZXRyaWV2ZXIlMjBkb2clMjBwb3J0cmFpdHxlbnwxfHx8fDE3NzMyNDMxMzB8MA&ixlib=rb-4.1.0&q=80&w=400';
const HUGO_IMAGE = 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400';

const OWNER_DETAILED_RECORDS: Record<number, DetailedRecord> = {
  // ── Record 1: Max — Annual Wellness Visit ──────────────────
  1: {
    id: 1,
    recordNumber: 'VT-2026-001542',
    patient: {
      name: 'Max', species: 'Dog', breed: 'Golden Retriever',
      dob: 'Jun 15, 2020', age: '5 years, 9 months', sex: 'Male (Neutered)',
      weight: '32 kg (70.5 lbs)', microchip: '900118000123456', color: 'Golden',
      image: MAX_IMAGE,
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

  // ── Record 2: Max — Lab Result (CBC + Metabolic Panel) ─────
  2: {
    id: 2,
    recordNumber: 'VT-2026-001543',
    patient: {
      name: 'Max', species: 'Dog', breed: 'Golden Retriever',
      dob: 'Jun 15, 2020', age: '5 years, 9 months', sex: 'Male (Neutered)',
      weight: '32 kg (70.5 lbs)', microchip: '900118000123456', color: 'Golden',
      image: MAX_IMAGE,
    },
    owner: {
      name: 'John Smith', email: 'john.smith@email.com',
      phone: '(555) 123-4567', address: '742 Evergreen Terrace, Springfield, IL 62704',
    },
    visit: {
      date: 'Mar 11, 2026', time: '9:30 AM', reason: 'Annual Wellness — Lab Work',
      vet: 'Dr. Sarah Chen', vetLicense: 'DVM-IL-2018-4521',
      clinic: 'Hugory Animal Hospital', clinicAddress: '1200 Oak Park Ave, Springfield, IL 62704',
      clinicPhone: '(555) 800-VETS', duration: '15 minutes (blood draw)',
      recordType: 'Lab Result', status: 'Final',
    },
    vitals: {
      weight: '32 kg', temperature: '101.3°F', heartRate: '88 bpm',
      respiratoryRate: '18 breaths/min', bloodPressure: '130/85 mmHg',
      bodyConditionScore: '5/9 (Ideal)', painScore: '0/10',
      hydrationStatus: 'Normal (<2s skin turgor)',
    },
    diagnosis: {
      primary: 'CBC & comprehensive metabolic panel — all values within normal limits',
      secondary: [],
      differentials: [],
      notes: 'Blood sample collected during annual wellness visit. Complete blood count and comprehensive metabolic panel results are all within normal reference ranges. Kidney function (BUN, creatinine) and liver enzymes (ALT, ALP) are healthy. No evidence of infection, anemia, or metabolic disease. Results are consistent with a healthy 5-year-old neutered male Golden Retriever.',
      icdCodes: [
        { code: 'Z00.0', description: 'Routine laboratory screening, wellness exam' },
      ],
    },
    treatmentPlan: {
      procedures: [
        { name: 'Blood Draw — Jugular Venipuncture', notes: '3 mL collected, no complications', status: 'Completed' },
        { name: 'CBC (Complete Blood Count)', notes: 'Analyzed in-house — all values WNL', status: 'Completed' },
        { name: 'Comprehensive Metabolic Panel', notes: 'Kidney, liver, glucose, protein — all normal', status: 'Completed' },
      ],
      instructions: 'No specific follow-up required for these lab results. Continue routine annual bloodwork. Results filed in Max\'s medical record.',
      restrictions: ['No restrictions'],
      homeCarePlan: 'No changes to current care plan required. Continue preventative medications and joint supplement as prescribed.',
    },
    medications: [
      {
        name: 'Heartgard Plus', dosage: '272 mcg ivermectin / 227 mg pyrantel',
        frequency: 'Once monthly', route: 'Oral', duration: 'Ongoing',
        prescribedBy: 'Dr. Sarah Chen', startDate: 'Jan 1, 2026',
        notes: 'Heartworm & intestinal parasite prevention.',
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
      nextVisitReason: 'Annual recheck — repeat bloodwork if clinically indicated',
      notes: 'All lab values normal. No immediate follow-up required for lab results. Next routine bloodwork recommended at annual wellness visit in September 2026.',
      reminderSet: true,
    },
    createdAt: 'Mar 11, 2026 at 10:45 AM',
    lastModified: 'Mar 11, 2026 at 11:42 AM',
    modifiedBy: 'Dr. Sarah Chen',
  },

  // ── Record 3: Max — Vaccination ────────────────────────────
  3: {
    id: 3,
    recordNumber: 'VT-2026-001544',
    patient: {
      name: 'Max', species: 'Dog', breed: 'Golden Retriever',
      dob: 'Jun 15, 2020', age: '5 years, 9 months', sex: 'Male (Neutered)',
      weight: '32 kg (70.5 lbs)', microchip: '900118000123456', color: 'Golden',
      image: MAX_IMAGE,
    },
    owner: {
      name: 'John Smith', email: 'john.smith@email.com',
      phone: '(555) 123-4567', address: '742 Evergreen Terrace, Springfield, IL 62704',
    },
    visit: {
      date: 'Mar 11, 2026', time: '9:30 AM', reason: 'Annual Vaccinations — DHPP & Bordetella',
      vet: 'Dr. Sarah Chen', vetLicense: 'DVM-IL-2018-4521',
      clinic: 'Hugory Animal Hospital', clinicAddress: '1200 Oak Park Ave, Springfield, IL 62704',
      clinicPhone: '(555) 800-VETS', duration: '10 minutes',
      recordType: 'Vaccination', status: 'Final',
    },
    vitals: {
      weight: '32 kg', temperature: '101.3°F', heartRate: '88 bpm',
      respiratoryRate: '18 breaths/min', bloodPressure: '130/85 mmHg',
      bodyConditionScore: '5/9 (Ideal)', painScore: '0/10',
      hydrationStatus: 'Normal (<2s skin turgor)',
    },
    diagnosis: {
      primary: 'Routine annual vaccination — DHPP booster and Bordetella (Bordetella bronchiseptica) intranasal',
      secondary: [],
      differentials: [],
      notes: 'Patient presented as part of annual wellness visit. Pre-vaccination assessment performed — patient deemed healthy and appropriate candidate for vaccination. DHPP (Distemper, Hepatitis, Parainfluenza, Parvovirus) 3-year booster administered subcutaneously. Bordetella intranasal vaccine administered per protocol. No adverse reactions observed during 15-minute post-vaccine observation period. Owner reminded that Rabies vaccine is due in approximately 6 months (September 2026).',
      icdCodes: [
        { code: 'Z23', description: 'Encounter for immunization' },
        { code: 'Z23.1', description: 'DHPP booster administered' },
        { code: 'Z23.2', description: 'Bordetella intranasal administered' },
      ],
    },
    treatmentPlan: {
      procedures: [
        { name: 'DHPP Booster (Nobivac)', notes: '1 mL subcutaneous, right shoulder — no reaction', status: 'Completed' },
        { name: 'Bordetella Intranasal (Intra-Trac 3)', notes: '1 dose per nostril — patient tolerated well', status: 'Completed' },
        { name: 'Post-Vaccination Observation', notes: '15-minute monitoring — no adverse reaction', status: 'Completed' },
      ],
      instructions: 'Monitor for any vaccine reactions over the next 24–48 hours. Common mild reactions include lethargy, mild soreness at injection site, or mild nasal discharge (Bordetella). Contact clinic if you observe facial swelling, hives, difficulty breathing, vomiting, or collapse — these may indicate a rare allergic reaction.',
      restrictions: ['Avoid dog parks or doggy daycares for 48 hours post-Bordetella'],
      homeCarePlan: 'Rabies vaccine is due September 2026 — schedule at next wellness appointment. Continue regular exercise and normal diet. No special care required after routine vaccinations.',
    },
    medications: [],
    labResults: [],
    followUp: {
      nextVisitDate: 'Sep 11, 2026',
      nextVisitReason: 'Rabies 3-year booster — due September 2026',
      notes: 'DHPP and Bordetella administered today. Rabies booster reminder set for September 2026. Owner advised to call if any adverse reactions within 48 hours.',
      reminderSet: true,
    },
    createdAt: 'Mar 11, 2026 at 10:00 AM',
    lastModified: 'Mar 11, 2026 at 10:20 AM',
    modifiedBy: 'Dr. Sarah Chen',
  },

  // ── Record 4: Max — Prescription ───────────────────────────
  4: {
    id: 4,
    recordNumber: 'VT-2026-001508',
    patient: {
      name: 'Max', species: 'Dog', breed: 'Golden Retriever',
      dob: 'Jun 15, 2020', age: '5 years, 8 months', sex: 'Male (Neutered)',
      weight: '32 kg (70.5 lbs)', microchip: '900118000123456', color: 'Golden',
      image: MAX_IMAGE,
    },
    owner: {
      name: 'John Smith', email: 'john.smith@email.com',
      phone: '(555) 123-4567', address: '742 Evergreen Terrace, Springfield, IL 62704',
    },
    visit: {
      date: 'Feb 20, 2026', time: '2:15 PM', reason: 'Prescription Renewal — Joint Supplement',
      vet: 'Dr. Sarah Chen', vetLicense: 'DVM-IL-2018-4521',
      clinic: 'Hugory Animal Hospital', clinicAddress: '1200 Oak Park Ave, Springfield, IL 62704',
      clinicPhone: '(555) 800-VETS', duration: '20 minutes',
      recordType: 'Prescription', status: 'Final',
    },
    vitals: {
      weight: '32 kg', temperature: '101.5°F', heartRate: '84 bpm',
      respiratoryRate: '16 breaths/min', bloodPressure: '128/82 mmHg',
      bodyConditionScore: '5/9 (Ideal)', painScore: '1/10 (mild hip stiffness)',
      hydrationStatus: 'Normal (<2s skin turgor)',
    },
    diagnosis: {
      primary: 'Bilateral hip dysplasia — chronic, stable — ongoing management',
      secondary: [
        'Mild morning stiffness reported by owner (improving with movement)',
      ],
      differentials: [],
      notes: 'Owner presents for prescription renewal of Dasuquin Advanced for hip dysplasia management. Max has been on this joint supplement since February 2024. Owner reports mild stiffness upon rising from rest, which typically resolves after a few minutes of movement. No significant lameness observed during exam. Hip extension — mild crepitus bilaterally, consistent with known dysplasia. No muscle atrophy. Comfortable weight bearing on all four limbs. Pain on deep hip palpation is minimal (1/10). Continued Dasuquin Advanced is appropriate for long-term joint support.',
      icdCodes: [
        { code: 'M16.1', description: 'Hip dysplasia, bilateral — chronic management' },
        { code: 'M25.5', description: 'Mild joint pain, manageable with current regimen' },
      ],
    },
    treatmentPlan: {
      procedures: [
        { name: 'Brief Physical Examination', notes: 'Focus on musculoskeletal — hip extension, gait assessment', status: 'Completed' },
        { name: 'Prescription Renewal — Dasuquin Advanced', notes: '90-day supply dispensed', status: 'Completed' },
      ],
      instructions: 'Continue Dasuquin Advanced once daily with food. Swimming and controlled leash walking are ideal low-impact exercise. Avoid rough play and jumping from heights. Monitor for any worsening lameness, reluctance to rise, or change in gait — report to clinic promptly.',
      restrictions: [
        'Avoid jumping onto high furniture',
        'No rough play or high-impact activity',
        'Leash walks preferred over off-leash running on hard surfaces',
      ],
      homeCarePlan: 'Maintain healthy weight (current 32 kg is ideal). Consider hydrotherapy if stiffness worsens. Continue fish oil supplementation. Orthopedic dog bed recommended to reduce joint stress during rest. Hip radiographs may be recommended at annual exam to track progression.',
    },
    medications: [
      {
        name: 'Dasuquin Advanced', dosage: '1 chewable tablet (large dog formula)',
        frequency: 'Once daily', route: 'Oral', duration: 'Ongoing — 90-day supply',
        prescribedBy: 'Dr. Sarah Chen', startDate: 'Feb 20, 2026',
        notes: 'Joint support for bilateral hip dysplasia. Contains glucosamine HCl (900mg), sodium chondroitin sulfate (200mg), avocado/soybean unsaponifiables (ASU), and MSM.',
      },
      {
        name: 'Omega-3 Fish Oil', dosage: '2000 mg (EPA/DHA)',
        frequency: 'Once daily', route: 'Oral', duration: 'Ongoing',
        prescribedBy: 'Dr. Sarah Chen', startDate: 'Feb 1, 2024',
        notes: 'Anti-inflammatory support. Pump onto food at mealtime.',
      },
    ],
    labResults: [],
    followUp: {
      nextVisitDate: 'Mar 11, 2026',
      nextVisitReason: 'Annual wellness exam — next scheduled visit',
      notes: 'Prescription renewed for 90 days. Monitor hip function. Discussed hydrotherapy options if stiffness increases. Annual exam scheduled for March 11.',
      reminderSet: true,
    },
    createdAt: 'Feb 20, 2026 at 2:45 PM',
    lastModified: 'Feb 20, 2026 at 3:00 PM',
    modifiedBy: 'Dr. Sarah Chen',
  },

  // ── Record 5: Hugo — Dental Recheck Visit ──────────────────
  5: {
    id: 5,
    recordNumber: 'VT-2026-001490',
    patient: {
      name: 'Hugo', species: 'Cat', breed: 'Persian',
      dob: 'Apr 3, 2019', age: '6 years, 11 months', sex: 'Male (Neutered)',
      weight: '4.8 kg (10.6 lbs)', microchip: '900118000654987', color: 'White & Grey',
      image: HUGO_IMAGE,
    },
    owner: {
      name: 'John Smith', email: 'john.smith@email.com',
      phone: '(555) 123-4567', address: '742 Evergreen Terrace, Springfield, IL 62704',
    },
    visit: {
      date: 'Feb 1, 2026', time: '11:00 AM', reason: 'Dental Recheck — Post-Cleaning Follow-Up',
      vet: 'Dr. Sarah Chen', vetLicense: 'DVM-IL-2018-4521',
      clinic: 'Hugory Animal Hospital', clinicAddress: '1200 Oak Park Ave, Springfield, IL 62704',
      clinicPhone: '(555) 800-VETS', duration: '30 minutes',
      recordType: 'Visit', status: 'Pending Vet Review',
    },
    vitals: {
      weight: '4.8 kg', temperature: '101.7°F', heartRate: '168 bpm',
      respiratoryRate: '22 breaths/min', bloodPressure: '130/85 mmHg',
      bodyConditionScore: '5/9 (Ideal)', painScore: '0/10',
      hydrationStatus: 'Normal (<2s skin turgor)',
    },
    diagnosis: {
      primary: 'Dental recheck — gingivitis improving following dental cleaning on Jan 15, 2026',
      secondary: [
        'Mild residual gingival inflammation at extraction site 307 (resolving)',
      ],
      differentials: [],
      notes: 'Hugo presents for recheck 2.5 weeks after full dental cleaning and single tooth extraction (307). Owner reports Hugo eating well, no pawing at face, no drooling. Oral examination: gingival tissue at extraction site is healing well — mild pink inflammation remains but no abscess, discharge, or dehiscence. Remaining dentition appears clean. Mild gingivitis along gingival margin of upper left carnassial — consistent with early Grade 1 disease. Recheck recommended in 6 weeks. Owner counseled on home dental care.',
      icdCodes: [
        { code: 'K05.1', description: 'Chronic gingivitis — improving' },
        { code: 'Z09', description: 'Follow-up examination after dental procedure' },
      ],
    },
    treatmentPlan: {
      procedures: [
        { name: 'Oral Examination', notes: 'Inspect gingival healing post-extraction, assess remaining teeth', status: 'Completed' },
        { name: 'Urinalysis — In-House', notes: 'Routine follow-up, results pending review', status: 'Completed' },
      ],
      instructions: 'Gingivitis is improving — continue monitoring at home. Begin dental hygiene routine: enzymatic toothpaste with cat-specific toothbrush 2–3 times weekly. Offer dental health treats (VOHC approved) daily. Feed dental diet or dental kibble to help slow tartar.',
      restrictions: ['No hard chew toys or bones'],
      homeCarePlan: 'Begin tooth brushing routine gradually — start with finger brush, transition to toothbrush. Use only veterinary-approved toothpaste (never human toothpaste — toxic to cats). Continue Hills c/d dental diet as primary food source. Next dental evaluation in 6 weeks.',
    },
    medications: [
      {
        name: 'Chlorhexidine Oral Rinse 0.12%', dosage: '1 mL per side of mouth',
        frequency: 'Once daily', route: 'Topical oral', duration: '2 weeks',
        prescribedBy: 'Dr. Sarah Chen', startDate: 'Feb 1, 2026',
        notes: 'Antiseptic rinse for gingival health. Apply with cotton swab along gum line. Do not rinse after application.',
      },
    ],
    labResults: [],
    followUp: {
      nextVisitDate: 'Mar 15, 2026',
      nextVisitReason: '6-week dental recheck — assess gingivitis resolution',
      notes: 'Gingival healing progressing well. Urinalysis results pending (see separate record). Next dental recheck in 6 weeks. Discuss whether further professional cleaning will be needed.',
      reminderSet: true,
    },
    createdAt: 'Feb 1, 2026 at 11:35 AM',
    lastModified: 'Feb 1, 2026 at 12:00 PM',
    modifiedBy: 'Dr. Sarah Chen',
  },

  // ── Record 6: Hugo — Lab Result (Urinalysis) ───────────────
  6: {
    id: 6,
    recordNumber: 'VT-2026-001491',
    patient: {
      name: 'Hugo', species: 'Cat', breed: 'Persian',
      dob: 'Apr 3, 2019', age: '6 years, 11 months', sex: 'Male (Neutered)',
      weight: '4.8 kg (10.6 lbs)', microchip: '900118000654987', color: 'White & Grey',
      image: HUGO_IMAGE,
    },
    owner: {
      name: 'John Smith', email: 'john.smith@email.com',
      phone: '(555) 123-4567', address: '742 Evergreen Terrace, Springfield, IL 62704',
    },
    visit: {
      date: 'Feb 1, 2026', time: '11:00 AM', reason: 'Urinalysis — Routine Screening',
      vet: 'Dr. Sarah Chen', vetLicense: 'DVM-IL-2018-4521',
      clinic: 'Hugory Animal Hospital', clinicAddress: '1200 Oak Park Ave, Springfield, IL 62704',
      clinicPhone: '(555) 800-VETS', duration: '15 minutes (sample collection)',
      recordType: 'Lab Result', status: 'In Progress',
    },
    vitals: {
      weight: '4.8 kg', temperature: '101.7°F', heartRate: '168 bpm',
      respiratoryRate: '22 breaths/min', bloodPressure: '130/85 mmHg',
      bodyConditionScore: '5/9 (Ideal)', painScore: '0/10',
      hydrationStatus: 'Normal (<2s skin turgor)',
    },
    diagnosis: {
      primary: 'Urinalysis — trace struvite crystals detected, dietary modification recommended',
      secondary: [
        'Urine specific gravity within normal range (concentrated urine)',
        'Trace protein on dipstick — non-significant at this stage',
      ],
      differentials: [
        'Feline idiopathic cystitis (FIC)',
        'Urolithiasis (struvite)',
        'Early chronic kidney disease',
      ],
      notes: 'Urine collected by free catch during dental recheck visit. Urinalysis reveals trace struvite crystals on sediment examination. Urine specific gravity is 1.048 — well-concentrated, no concern for early CKD at this time. Trace protein on dipstick (1+) — could be related to concentration; re-check in context of specific gravity suggests non-significant. No hematuria, no bacteria seen on sediment. Recommend dietary change to a urinary health diet (Hills c/d or Royal Canin Urinary SO) to dissolve struvite crystals and prevent recurrence. Increase water intake — consider water fountain. Recheck urinalysis in 6–8 weeks.',
      icdCodes: [
        { code: 'N20.0', description: 'Struvite crystalluria (trace)' },
        { code: 'R80.9', description: 'Proteinuria, unspecified — trace, non-significant' },
      ],
    },
    treatmentPlan: {
      procedures: [
        { name: 'Urine Collection — Free Catch', notes: 'Sample collected during visit, submitted for full analysis', status: 'Completed' },
        { name: 'Urinalysis with Sediment Examination', notes: 'Trace struvite crystals — see lab results', status: 'Completed' },
        { name: 'Dietary Consultation', notes: 'Transitioning to Hills c/d Urinary Care diet discussed with owner', status: 'Completed' },
      ],
      instructions: 'Switch Hugo to Hills Prescription Diet c/d Multicare Urinary Care (or Royal Canin Urinary SO) as primary diet. Transition gradually over 7 days by mixing with current food. Encourage water intake — use a cat water fountain if possible, and offer wet food 1–2 times per week. Avoid high-magnesium treats. Recheck urinalysis in 6–8 weeks.',
      restrictions: [
        'No dry food high in magnesium or ash',
        'Avoid treats not approved for urinary health',
      ],
      homeCarePlan: 'Monitor litter box habits — report any changes in urination frequency, straining, blood in urine, or crying in the litter box immediately. These could indicate a urinary blockage, which is a medical emergency in male cats. Provide a clean water fountain and multiple water stations around the home.',
    },
    medications: [],
    labResults: [
      { testName: 'Urine Specific Gravity', result: '1.048', referenceRange: '1.020–1.060', unit: 'USG', flag: 'normal', date: 'Feb 1, 2026' },
      { testName: 'Urine pH', result: '7.2', referenceRange: '6.0–7.5', unit: 'pH', flag: 'normal', date: 'Feb 1, 2026' },
      { testName: 'Protein (Dipstick)', result: '1+', referenceRange: 'Negative', unit: '', flag: 'high', date: 'Feb 1, 2026' },
      { testName: 'Glucose', result: 'Negative', referenceRange: 'Negative', unit: '', flag: 'normal', date: 'Feb 1, 2026' },
      { testName: 'Blood (Dipstick)', result: 'Negative', referenceRange: 'Negative', unit: '', flag: 'normal', date: 'Feb 1, 2026' },
      { testName: 'WBC (Sediment)', result: '0–2', referenceRange: '0–5', unit: '/hpf', flag: 'normal', date: 'Feb 1, 2026' },
      { testName: 'RBC (Sediment)', result: '0–1', referenceRange: '0–5', unit: '/hpf', flag: 'normal', date: 'Feb 1, 2026' },
      { testName: 'Struvite Crystals', result: 'Trace (+1)', referenceRange: 'None', unit: '', flag: 'high', date: 'Feb 1, 2026' },
      { testName: 'Bacteria', result: 'None seen', referenceRange: 'None', unit: '', flag: 'normal', date: 'Feb 1, 2026' },
    ],
    followUp: {
      nextVisitDate: 'Mar 29, 2026',
      nextVisitReason: '6–8 week recheck urinalysis — assess response to dietary change',
      notes: 'Trace struvite crystals — dietary modification initiated. Recheck urinalysis in 6–8 weeks to confirm resolution. Owner understands urgency of reporting any signs of straining or inability to urinate. Hills c/d prescription written.',
      reminderSet: true,
    },
    createdAt: 'Feb 1, 2026 at 12:10 PM',
    lastModified: 'Feb 1, 2026 at 12:30 PM',
    modifiedBy: 'Dr. Sarah Chen',
  },

  // ── Record 7: Hugo — Dental Cleaning ───────────────────────
  7: {
    id: 7,
    recordNumber: 'VT-2026-001462',
    patient: {
      name: 'Hugo', species: 'Cat', breed: 'Persian',
      dob: 'Apr 3, 2019', age: '6 years, 9 months', sex: 'Male (Neutered)',
      weight: '4.9 kg (10.8 lbs)', microchip: '900118000654987', color: 'White & Grey',
      image: HUGO_IMAGE,
    },
    owner: {
      name: 'John Smith', email: 'john.smith@email.com',
      phone: '(555) 123-4567', address: '742 Evergreen Terrace, Springfield, IL 62704',
    },
    visit: {
      date: 'Jan 15, 2026', time: '8:00 AM', reason: 'Dental Prophylaxis Under General Anesthesia',
      vet: 'Dr. Sarah Chen', vetLicense: 'DVM-IL-2018-4521',
      clinic: 'Hugory Animal Hospital', clinicAddress: '1200 Oak Park Ave, Springfield, IL 62704',
      clinicPhone: '(555) 800-VETS', duration: '1 hour 45 minutes',
      recordType: 'Dental', status: 'Final',
    },
    vitals: {
      weight: '4.9 kg', temperature: '101.6°F', heartRate: '172 bpm',
      respiratoryRate: '24 breaths/min', bloodPressure: '128/80 mmHg',
      bodyConditionScore: '5/9 (Ideal)', painScore: '2/10 (post-procedure, managed)',
      hydrationStatus: 'Normal (<2s skin turgor)',
    },
    diagnosis: {
      primary: 'Grade 2 periodontal disease — full dental prophylaxis performed, tooth 307 (lower left first molar) extracted',
      secondary: [
        'Tooth 307: Grade 3 periodontal attachment loss — extraction indicated',
        'Generalized Grade 2 gingivitis — improved with cleaning',
        'Mild calculus accumulation on remaining premolars and molars',
      ],
      differentials: [],
      notes: 'Hugo fasted from midnight. Pre-anesthetic blood panel within normal limits. Anesthesia induced with alfaxalone, maintained with isoflurane. Full-mouth dental radiographs obtained. Dental probing revealed Grade 2 periodontal disease throughout with one pocket of Grade 3 attachment loss at tooth 307 (lower left first molar) — extraction was performed. Supragingival and subgingival scaling performed with ultrasonic scaler. Tooth surfaces polished with fine prophy paste. Gingival sulci flushed with chlorhexidine solution. Extraction site closed with 4-0 absorbable suture. Recovery from anesthesia was smooth. Hugo discharged at 2:00 PM in good condition.',
      icdCodes: [
        { code: 'K05.3', description: 'Chronic periodontitis, Grade 2' },
        { code: 'K08.1', description: 'Tooth extraction — tooth 307, periodontal attachment loss' },
        { code: 'K03.6', description: 'Dental calculus deposits' },
      ],
    },
    treatmentPlan: {
      procedures: [
        { name: 'Pre-Anesthetic Blood Panel', notes: 'CBC & mini-chemistry — all values WNL', status: 'Completed' },
        { name: 'General Anesthesia', notes: 'Alfaxalone induction, isoflurane maintenance — smooth recovery', status: 'Completed' },
        { name: 'Full-Mouth Dental Radiographs', notes: '10 radiographic projections obtained', status: 'Completed' },
        { name: 'Dental Prophylaxis (Scaling & Polishing)', notes: 'Ultrasonic scaling, prophy polish, chlorhexidine flush', status: 'Completed' },
        { name: 'Tooth Extraction — 307', notes: 'Grade 3 periodontal disease — extraction performed', status: 'Completed' },
      ],
      instructions: 'Feed only soft food for 7–14 days to allow extraction site to heal. No hard kibble, crunchy treats, or chew toys until recheck. Give Meloxicam as directed for pain. Keep extraction site clean — avoid touching with fingers. Monitor for swelling, discharge, or refusal to eat.',
      restrictions: [
        'Soft food only for 14 days',
        'No dry kibble or hard treats',
        'No chew toys or hard objects',
      ],
      homeCarePlan: 'After full healing (approximately 2 weeks), begin a home dental care routine: enzymatic toothpaste with finger brush 2–3 times per week. Offer VOHC-approved dental treats daily. Consider prescription dental diet to slow future tartar accumulation. Next dental evaluation in 6 months.',
    },
    medications: [
      {
        name: 'Meloxicam (Metacam 0.5 mg/mL)', dosage: '0.05 mg/kg (0.24 mL)',
        frequency: 'Once daily', route: 'Oral (liquid, in food)', duration: '3 days',
        prescribedBy: 'Dr. Sarah Chen', startDate: 'Jan 15, 2026',
        notes: 'NSAID for post-dental pain and inflammation. Give with food. Do not exceed prescribed dose — NSAID toxicity risk in cats.',
      },
      {
        name: 'Cefovecin Sodium (Convenia)', dosage: '8 mg/kg (39 mg) — single injection',
        frequency: 'Single dose (effective 14 days)', route: 'Subcutaneous injection', duration: '14 days',
        prescribedBy: 'Dr. Sarah Chen', startDate: 'Jan 15, 2026',
        notes: 'Long-acting antibiotic administered at time of procedure. No at-home oral antibiotics needed.',
      },
    ],
    labResults: [],
    followUp: {
      nextVisitDate: 'Feb 1, 2026',
      nextVisitReason: '2.5-week post-dental recheck — assess gingival healing and extraction site',
      notes: 'Full dental prophylaxis and extraction completed without complications. Post-op recheck booked for Feb 1, 2026. Owner instructed on pain management and soft food requirements. Discussion held regarding ongoing home dental care to prevent recurrence.',
      reminderSet: true,
    },
    createdAt: 'Jan 15, 2026 at 3:00 PM',
    lastModified: 'Jan 15, 2026 at 4:15 PM',
    modifiedBy: 'Dr. Sarah Chen',
  },

  // ── Record 8: Hugo — Vaccination ───────────────────────────
  8: {
    id: 8,
    recordNumber: 'VT-2025-001398',
    patient: {
      name: 'Hugo', species: 'Cat', breed: 'Persian',
      dob: 'Apr 3, 2019', age: '6 years, 8 months', sex: 'Male (Neutered)',
      weight: '4.9 kg (10.8 lbs)', microchip: '900118000654987', color: 'White & Grey',
      image: HUGO_IMAGE,
    },
    owner: {
      name: 'John Smith', email: 'john.smith@email.com',
      phone: '(555) 123-4567', address: '742 Evergreen Terrace, Springfield, IL 62704',
    },
    visit: {
      date: 'Dec 10, 2025', time: '3:00 PM', reason: 'Annual Vaccinations — FeLV & FVRCP Boosters',
      vet: 'Dr. Raj Patel', vetLicense: 'DVM-IL-2019-5012',
      clinic: 'Hugory Animal Hospital', clinicAddress: '1200 Oak Park Ave, Springfield, IL 62704',
      clinicPhone: '(555) 800-VETS', duration: '20 minutes',
      recordType: 'Vaccination', status: 'Final',
    },
    vitals: {
      weight: '4.9 kg', temperature: '101.5°F', heartRate: '164 bpm',
      respiratoryRate: '20 breaths/min', bloodPressure: '125/78 mmHg',
      bodyConditionScore: '5/9 (Ideal)', painScore: '0/10',
      hydrationStatus: 'Normal (<2s skin turgor)',
    },
    diagnosis: {
      primary: 'Routine annual vaccination — FeLV and FVRCP boosters administered without adverse reaction',
      secondary: [],
      differentials: [],
      notes: 'Hugo presented for annual vaccination appointment. Pre-vaccination physical exam performed — patient is healthy, appropriate body weight and condition score, no contraindications to vaccination. FeLV (Feline Leukemia Virus) 1-year booster administered subcutaneously in the left rear leg per AAFP guidelines for site-specific injection. FVRCP (Feline Viral Rhinotracheitis, Calicivirus, Panleukopenia) 3-year booster administered subcutaneously in the right rear leg. 15-minute post-vaccine observation period — no immediate adverse reactions observed. Owner instructed on signs of delayed hypersensitivity reaction. Next FeLV booster due December 2026; FVRCP due December 2028.',
      icdCodes: [
        { code: 'Z23', description: 'Encounter for immunization' },
        { code: 'Z23.3', description: 'FeLV booster administered' },
        { code: 'Z23.4', description: 'FVRCP 3-year booster administered' },
      ],
    },
    treatmentPlan: {
      procedures: [
        { name: 'FeLV Booster (Purevax FeLV)', notes: 'Subcutaneous, left rear leg — AAFP site recommendation', status: 'Completed' },
        { name: 'FVRCP 3-Year Booster (Purevax RCP)', notes: 'Subcutaneous, right rear leg — no adjuvant formulation used', status: 'Completed' },
        { name: 'Post-Vaccination Observation', notes: '15 minutes — no immediate reaction', status: 'Completed' },
        { name: 'Brief Physical Examination', notes: 'Nose-to-tail assessment — healthy, no findings', status: 'Completed' },
      ],
      instructions: 'Monitor Hugo at home over the next 24–48 hours. Mild lethargy or slight soreness at injection sites is normal and should resolve within 24 hours. Contact clinic immediately if Hugo develops facial swelling, hives, difficulty breathing, vomiting, or collapse. Check both injection sites over the next few weeks — if you notice any lumps or swelling that persist beyond 3 weeks, contact the clinic promptly.',
      restrictions: ['No restrictions following routine vaccination'],
      homeCarePlan: 'No dietary or activity restrictions needed. FeLV booster due December 2026. FVRCP booster due December 2028. Dental evaluation recommended — owner to schedule in January 2026.',
    },
    medications: [],
    labResults: [],
    followUp: {
      nextVisitDate: 'Jan 15, 2026',
      nextVisitReason: 'Dental evaluation and prophylaxis — scheduled',
      notes: 'Vaccines administered without incident. Owner reminded of upcoming dental visit (January 2026) and vaccination schedule. FeLV booster due Dec 2026; FVRCP (3-year) due Dec 2028.',
      reminderSet: true,
    },
    createdAt: 'Dec 10, 2025 at 3:25 PM',
    lastModified: 'Dec 10, 2025 at 3:40 PM',
    modifiedBy: 'Dr. Raj Patel',
  },
};

const DEFAULT_RECORD = OWNER_DETAILED_RECORDS[1];

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
      <div className="w-8 h-8 flex items-center justify-center" style={{ backgroundColor: 'color-mix(in srgb, var(--brand-green-text) 12%, transparent)', borderRadius: '8px' }}>
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

export default function OwnerRecordDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const record = OWNER_DETAILED_RECORDS[Number(id)] ?? DEFAULT_RECORD;
  const [linkCopied, setLinkCopied] = useState(false);

  const typeStyle = recordTypeColors[record.visit.recordType];
  const sttStyle  = statusColors[record.visit.status];
  const isLocked  = record.visit.status === 'Pending Vet Review' || record.visit.status === 'In Progress';

  // ── Locked / In-progress gate ────────────────────────────
  if (isLocked) {
    const isPendingReview = record.visit.status === 'Pending Vet Review';
    return (
      <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-base)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px' }}>
        <div style={{ backgroundColor: 'var(--surface-white)', borderRadius: '20px', maxWidth: '480px', width: '100%', overflow: 'hidden', boxShadow: '0 8px 40px rgba(0,0,0,0.10)', textAlign: 'center' }}>
          {/* Top accent */}
          <div style={{ height: 5, background: isPendingReview ? 'linear-gradient(90deg, #F4A261, #D97706)' : 'linear-gradient(90deg, #3B82F6, #8B5CF6)' }} />
          <div style={{ padding: '40px 36px 36px' }}>
            {/* Icon */}
            <div style={{ width: 72, height: 72, borderRadius: '50%', backgroundColor: isPendingReview ? '#F4A26118' : '#3B82F615', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              {isPendingReview
                ? <Lock style={{ width: 32, height: 32, color: '#D97706' }} />
                : <Clock3 style={{ width: 32, height: 32, color: '#3B82F6' }} />
              }
            </div>
            {/* Title */}
            <p style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '10px' }}>
              {isPendingReview ? 'Record Pending Vet Review' : 'Results In Progress'}
            </p>
            {/* Status badge */}
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '5px 14px', borderRadius: '9999px', fontSize: '13px', fontWeight: 700,
              backgroundColor: sttStyle.bg, color: sttStyle.text, border: `1px solid ${sttStyle.border}`,
              marginBottom: '18px',
            }}>
              {isPendingReview ? <Lock style={{ width: 12, height: 12 }} /> : <Clock3 style={{ width: 12, height: 12 }} />}
              {record.visit.status}
            </span>
            {/* Message */}
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '28px' }}>
              {isPendingReview
                ? 'This record is being reviewed by your veterinarian before it becomes available to you. You\'ll be notified once it\'s approved and ready to view.'
                : 'Your lab results are currently being processed. This usually takes 24–48 hours. You\'ll receive a notification once they\'re ready and reviewed by your vet.'
              }
            </p>
            {/* Record info pill */}
            <div style={{ padding: '12px 16px', borderRadius: '10px', backgroundColor: 'var(--surface-elevated)', border: '1px solid var(--border-color)', marginBottom: '24px', display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                🐾 <strong style={{ color: 'var(--text-primary)' }}>{record.patient.name}</strong>
              </span>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                📋 {record.visit.recordType}
              </span>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                📅 {record.visit.date}
              </span>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                👩‍⚕️ {record.visit.vet}
              </span>
            </div>
            {/* CTA */}
            <button
              onClick={() => navigate('/owner/records')}
              style={{ width: '100%', padding: '12px', borderRadius: '10px', backgroundColor: 'var(--brand-green-text)', color: 'var(--on-brand-green)', border: 'none', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}
            >
              ← Back to My Records
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleCopyLink = () => {
    const url = `${window.location.origin}/owner/records/${record.id}`;
    navigator.clipboard.writeText(url);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  return (
    <div className="max-w-[1200px] mx-auto p-8">
      {/* Back Link */}
      <Link
        to="/owner/records"
        className="inline-flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--brand-green-text)] transition-colors mb-6"
        style={{ fontSize: '14px' }}
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Records
      </Link>

      {/* Header accent bar */}
      <div style={{ height: 4, borderRadius: '4px 4px 0 0', background: 'linear-gradient(90deg, var(--brand-green-text), #52B788)', marginBottom: '-1px' }} />

      {/* Header card */}
      <div
        className="bg-[var(--surface-white)] border border-[var(--border-color)] p-6 mb-8"
        style={{ borderRadius: '0 0 12px 12px' }}
      >
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <h1 className="text-[var(--text-primary)]" style={{ fontSize: '28px', fontWeight: 700 }}>{record.recordNumber}</h1>
              <span className="inline-block px-3 py-1" style={{ backgroundColor: typeStyle.bg, color: typeStyle.text, borderRadius: '9999px', fontSize: '13px', fontWeight: 600 }}>
                {record.visit.recordType}
              </span>
              <span className="inline-flex items-center gap-1 px-3 py-1" style={{ backgroundColor: sttStyle.bg, color: sttStyle.text, border: `1px solid ${sttStyle.border}`, borderRadius: '9999px', fontSize: '13px', fontWeight: 700 }}>
                {record.visit.status}
              </span>
              {/* Read Only badge */}
              <span
                className="inline-flex items-center gap-1 px-2.5 py-1"
                style={{ backgroundColor: '#6B728015', color: 'var(--text-secondary)', borderRadius: '9999px', fontSize: '12px', fontWeight: 600, border: '1px solid var(--border-color)' }}
              >
                <Lock className="w-3 h-3" />
                Read Only
              </span>
            </div>
            <p className="text-[var(--text-secondary)]" style={{ fontSize: '15px' }}>
              {record.patient.name} • {record.visit.reason} • {record.visit.date}
            </p>
          </div>
          {/* Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              onClick={() => window.print()}
              className="gap-2"
              style={{ backgroundColor: 'var(--brand-green-text)', color: 'var(--on-brand-green)' }}
            >
              <Download className="w-4 h-4" />
              Download PDF
            </Button>
            <Button
              variant="outline"
              onClick={() => window.print()}
              className="gap-2"
            >
              <Printer className="w-4 h-4" />
              Print
            </Button>
            <Button
              variant="outline"
              onClick={handleCopyLink}
              className="gap-2"
            >
              {linkCopied
                ? <><Check className="w-4 h-4 text-[var(--brand-green-text)]" /> Copied!</>
                : <><Copy className="w-4 h-4" /> Copy Link</>
              }
            </Button>
          </div>
        </div>
      </div>

      {/* ───────── Section 1: Patient Info + Visit Details ───────── */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* Patient Info */}
        <div className="bg-[var(--surface-white)] border border-[var(--border-color)] p-6" style={{ borderRadius: '12px' }}>
          <SectionHeader icon={User} title="Patient Information" />
          <div className="flex items-center gap-4 mb-4">
            <img src={record.patient.image} alt={record.patient.name} className="w-16 h-16 object-cover" style={{ borderRadius: '9999px' }} />
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
      {record.medications.length > 0 && (
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
      )}

      {/* ───────── Section 6: Lab Results ───────── */}
      {record.labResults.length > 0 && (
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
      )}

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
