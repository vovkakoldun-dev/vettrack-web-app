export type ApptStatus = 'Confirmed' | 'Pending' | 'Completed' | 'Cancelled' | 'In Progress';

export interface Appointment {
  id: number;
  date: string;
  timeStart: string;
  timeEnd: string;
  petName: string;
  petImage: string;
  ownerName: string;
  species: string;
  service: string;
  vet: string;
  status: ApptStatus;
  notes: string;
  clientId?: number;
}

export const MOCK_APPOINTMENTS: Appointment[] = [
  { id: 1, date: '2026-03-11', timeStart: '9:00 AM', timeEnd: '9:30 AM', petName: 'Max', petImage: 'https://images.unsplash.com/photo-1734966213753-1b361564bab4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxnb2xkZW4lMjByZXRyaWV2ZXIlMjBkb2clMjBwb3J0cmFpdHxlbnwxfHx8fDE3NzMyNDMxMzB8MA&ixlib=rb-4.1.0&q=80&w=400', ownerName: 'John Smith', species: 'Dog', service: 'Annual Checkup', vet: 'Dr. Chen', status: 'Confirmed', notes: 'Routine annual examination, bloodwork review', clientId: 1 },
  { id: 2, date: '2026-03-11', timeStart: '10:00 AM', timeEnd: '10:30 AM', petName: 'Luna', petImage: 'https://images.unsplash.com/photo-1574158622682-e40e69881006?w=400', ownerName: 'Emily Johnson', species: 'Cat', service: 'Vaccination', vet: 'Dr. Patel', status: 'Confirmed', notes: 'FVRCP booster due' },
  { id: 3, date: '2026-03-11', timeStart: '10:30 AM', timeEnd: '11:00 AM', petName: 'Cooper', petImage: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400', ownerName: 'Michael Brown', species: 'Dog', service: 'Dental Cleaning', vet: 'Dr. Chen', status: 'Pending', notes: 'Grade 2 dental disease — full dental cleaning under sedation' },
  { id: 4, date: '2026-03-11', timeStart: '11:30 AM', timeEnd: '12:00 PM', petName: 'Bella', petImage: 'https://images.unsplash.com/photo-1513360371669-4adf3dd7dff8?w=400', ownerName: 'Sarah Williams', species: 'Cat', service: 'Follow-up', vet: 'Dr. Chen', status: 'Confirmed', notes: 'Post-surgery follow-up, check incision site' },
  { id: 5, date: '2026-03-11', timeStart: '1:00 PM', timeEnd: '1:30 PM', petName: 'Charlie', petImage: 'https://images.unsplash.com/photo-1612195583950-b8fd34c87093?w=400', ownerName: 'David Miller', species: 'Dog', service: 'Emergency', vet: 'Dr. Garcia', status: 'Confirmed', notes: 'Owner reports limping on front right leg since yesterday' },
  { id: 6, date: '2026-03-11', timeStart: '2:00 PM', timeEnd: '2:30 PM', petName: 'Rocky', petImage: 'https://images.unsplash.com/photo-1551717743-49959800-b1c6?w=400', ownerName: 'James Wilson', species: 'Dog', service: 'Vaccination', vet: 'Dr. Patel', status: 'Completed', notes: 'Rabies and DHPP boosters' },
  { id: 7, date: '2026-03-11', timeStart: '3:00 PM', timeEnd: '3:30 PM', petName: 'Milo', petImage: 'https://images.unsplash.com/photo-1589883661923-6476cb0ae9f2?w=400', ownerName: 'Jessica Taylor', species: 'Cat', service: 'Checkup', vet: 'Dr. Chen', status: 'Cancelled', notes: 'Owner cancelled — rescheduling for next week' },
  { id: 8, date: '2026-03-11', timeStart: '3:30 PM', timeEnd: '4:00 PM', petName: 'Daisy', petImage: 'https://images.unsplash.com/photo-1518717758536-85ae29035b6d?w=400', ownerName: 'Robert Anderson', species: 'Dog', service: 'Surgery', vet: 'Dr. Garcia', status: 'Confirmed', notes: 'Spay procedure — pre-op fasting confirmed' },
  { id: 9, date: '2026-03-12', timeStart: '9:00 AM', timeEnd: '9:30 AM', petName: 'Oliver', petImage: 'https://images.unsplash.com/photo-1526336024174-e58f5cdd8e13?w=400', ownerName: 'Lisa Martinez', species: 'Cat', service: 'Dental Cleaning', vet: 'Dr. Chen', status: 'Confirmed', notes: 'Routine dental cleaning' },
  { id: 10, date: '2026-03-12', timeStart: '10:00 AM', timeEnd: '10:30 AM', petName: 'Buddy', petImage: 'https://images.unsplash.com/photo-1558788353-f76d92427f16?w=400', ownerName: 'Kevin Lee', species: 'Dog', service: 'Follow-up', vet: 'Dr. Patel', status: 'Pending', notes: 'Hip dysplasia medication check' },
  { id: 11, date: '2026-03-13', timeStart: '11:00 AM', timeEnd: '11:30 AM', petName: 'Coco', petImage: 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=400', ownerName: 'Amanda White', species: 'Dog', service: 'Vaccination', vet: 'Dr. Garcia', status: 'Confirmed', notes: 'Bordetella and Leptospirosis vaccines' },
  { id: 12, date: '2026-03-14', timeStart: '2:00 PM', timeEnd: '2:45 PM', petName: 'Simba', petImage: 'https://images.unsplash.com/photo-1592194996308-7b43878e84a6?w=400', ownerName: 'Chris Davis', species: 'Cat', service: 'Surgery', vet: 'Dr. Garcia', status: 'Confirmed', notes: 'Neuter procedure' },
];

export const SERVICE_PRICE_LIST = [
  { name: 'Office Visit / Consultation', price: 65 },
  { name: 'Annual Wellness Exam', price: 85 },
  { name: 'Vaccination (each)', price: 35 },
  { name: 'Dental Cleaning', price: 250 },
  { name: 'Blood Panel — CBC', price: 125 },
  { name: 'Blood Chemistry Panel', price: 145 },
  { name: 'Urinalysis', price: 45 },
  { name: 'X-Ray (per view)', price: 175 },
  { name: 'Fecal Floatation', price: 38 },
  { name: 'Heartworm Antigen Test', price: 55 },
  { name: 'Tick-Borne Disease Panel', price: 72 },
  { name: 'Skin Scrape / Cytology', price: 65 },
  { name: 'Ear Swab — Cytology', price: 45 },
  { name: 'Culture & Sensitivity', price: 95 },
  { name: 'Microchipping', price: 55 },
  { name: 'Nail Trim', price: 18 },
  { name: 'Ear Cleaning', price: 28 },
  { name: 'Prescription Medication', price: 0 },
  { name: 'Emergency Fee', price: 150 },
  { name: 'Spay / Neuter', price: 320 },
  { name: 'Surgery (Minor)', price: 380 },
  { name: 'Surgery (Major)', price: 850 },
  { name: 'Flea / Tick Prevention', price: 45 },
  { name: 'Hospitalization (per day)', price: 95 },
  { name: 'Ultrasound', price: 220 },
  { name: 'Fine Needle Aspirate (FNA)', price: 85 },
];

export interface LabTest {
  id: string;
  label: string;
  category: string;
}

export const LAB_TESTS: LabTest[] = [
  { id: 'cbc', label: 'CBC — Complete Blood Count', category: 'Blood' },
  { id: 'chem', label: 'Chemistry Panel', category: 'Blood' },
  { id: 'thyroid', label: 'Thyroid (T4)', category: 'Blood' },
  { id: 'coag', label: 'Coagulation Profile', category: 'Blood' },
  { id: 'ua', label: 'Urinalysis', category: 'Urine' },
  { id: 'uc', label: 'Urine Culture & Sensitivity', category: 'Urine' },
  { id: 'fecal', label: 'Fecal — Floatation', category: 'Fecal' },
  { id: 'fecal_pcr', label: 'Fecal PCR Panel', category: 'Fecal' },
  { id: 'giardia', label: 'Giardia Antigen Test', category: 'Fecal' },
  { id: 'skin_scrape', label: 'Skin Scrape', category: 'Dermatology' },
  { id: 'cytology', label: 'Fine Needle Aspirate / Cytology', category: 'Dermatology' },
  { id: 'ear_swab', label: 'Ear Swab — Cytology', category: 'Dermatology' },
  { id: 'culture', label: 'Culture & Sensitivity', category: 'Microbiology' },
  { id: 'heartworm', label: 'Heartworm Antigen Test', category: 'Parasitology' },
  { id: 'tick_panel', label: 'Tick-Borne Disease Panel', category: 'Parasitology' },
  { id: 'xray', label: 'Radiograph / X-Ray', category: 'Imaging' },
  { id: 'ultrasound', label: 'Ultrasound', category: 'Imaging' },
];

// ─── Medication Price List (set by Super Admin) ───────────────

export interface MedicationPreset {
  name: string;
  defaultDosage: string;
  unit: string;
  price: number;
  category: string;
}

export const MEDICATION_PRICE_LIST: MedicationPreset[] = [
  // Antibiotics
  { name: 'Amoxicillin 250mg', defaultDosage: '250mg', unit: 'tablet', price: 1.20, category: 'Antibiotic' },
  { name: 'Amoxicillin/Clavulanate (Clavamox) 62.5mg', defaultDosage: '62.5mg', unit: 'tablet', price: 2.80, category: 'Antibiotic' },
  { name: 'Doxycycline 100mg', defaultDosage: '100mg', unit: 'tablet', price: 1.50, category: 'Antibiotic' },
  { name: 'Metronidazole 250mg', defaultDosage: '250mg', unit: 'tablet', price: 0.90, category: 'Antibiotic' },
  { name: 'Enrofloxacin (Baytril) 22.7mg', defaultDosage: '22.7mg', unit: 'tablet', price: 2.20, category: 'Antibiotic' },
  { name: 'Clindamycin 150mg', defaultDosage: '150mg', unit: 'capsule', price: 1.80, category: 'Antibiotic' },
  // Anti-inflammatory / Pain
  { name: 'Carprofen (Rimadyl) 75mg', defaultDosage: '75mg', unit: 'tablet', price: 2.50, category: 'NSAID / Pain' },
  { name: 'Meloxicam 1.5mg/mL', defaultDosage: '0.2mg/kg', unit: 'mL', price: 4.00, category: 'NSAID / Pain' },
  { name: 'Gabapentin 100mg', defaultDosage: '100mg', unit: 'capsule', price: 0.80, category: 'NSAID / Pain' },
  { name: 'Tramadol 50mg', defaultDosage: '50mg', unit: 'tablet', price: 1.20, category: 'NSAID / Pain' },
  // Steroids
  { name: 'Prednisone 5mg', defaultDosage: '5mg', unit: 'tablet', price: 0.60, category: 'Steroid' },
  { name: 'Prednisolone 5mg', defaultDosage: '5mg', unit: 'tablet', price: 0.70, category: 'Steroid' },
  { name: 'Dexamethasone 2mg/mL injection', defaultDosage: '0.1mg/kg', unit: 'mL', price: 8.00, category: 'Steroid' },
  // Cardiac
  { name: 'Furosemide (Lasix) 40mg', defaultDosage: '40mg', unit: 'tablet', price: 0.50, category: 'Cardiac' },
  { name: 'Enalapril 5mg', defaultDosage: '5mg', unit: 'tablet', price: 0.90, category: 'Cardiac' },
  { name: 'Atenolol 25mg', defaultDosage: '25mg', unit: 'tablet', price: 0.70, category: 'Cardiac' },
  { name: 'Pimobendan (Vetmedin) 5mg', defaultDosage: '5mg', unit: 'tablet', price: 4.50, category: 'Cardiac' },
  // Thyroid / Hormones
  { name: 'Methimazole 5mg', defaultDosage: '5mg', unit: 'tablet', price: 1.20, category: 'Thyroid' },
  { name: 'Levothyroxine (Soloxine) 0.1mg', defaultDosage: '0.1mg', unit: 'tablet', price: 0.80, category: 'Thyroid' },
  // Behavioral
  { name: 'Fluoxetine 10mg', defaultDosage: '10mg', unit: 'capsule', price: 1.00, category: 'Behavioral' },
  { name: 'Trazodone 100mg', defaultDosage: '100mg', unit: 'tablet', price: 0.90, category: 'Behavioral' },
  { name: 'Alprazolam 0.25mg', defaultDosage: '0.25mg', unit: 'tablet', price: 0.60, category: 'Behavioral' },
  // Allergy / Dermatology
  { name: 'Apoquel (Oclacitinib) 16mg', defaultDosage: '16mg', unit: 'tablet', price: 3.80, category: 'Allergy' },
  { name: 'Cytopoint injection', defaultDosage: '1 injection', unit: 'injection', price: 95.00, category: 'Allergy' },
  { name: 'Hydroxyzine 25mg', defaultDosage: '25mg', unit: 'tablet', price: 0.50, category: 'Allergy' },
  // GI
  { name: 'Cerenia (Maropitant) 16mg', defaultDosage: '16mg', unit: 'tablet', price: 4.20, category: 'GI' },
  { name: 'Metoclopramide 10mg', defaultDosage: '10mg', unit: 'tablet', price: 0.60, category: 'GI' },
  { name: 'Omeprazole 20mg', defaultDosage: '20mg', unit: 'capsule', price: 0.80, category: 'GI' },
  { name: 'Famotidine 20mg', defaultDosage: '20mg', unit: 'tablet', price: 0.40, category: 'GI' },
  { name: 'Sucralfate 1g', defaultDosage: '1g', unit: 'tablet', price: 0.90, category: 'GI' },
  { name: 'Lactulose 10g/15mL', defaultDosage: '15mL', unit: 'mL', price: 1.50, category: 'GI' },
  // Liver / Supplements
  { name: 'Denamarin (Large Dog)', defaultDosage: '1 tablet', unit: 'tablet', price: 2.80, category: 'Supplement' },
  { name: 'Omega-3 Fish Oil 1000mg', defaultDosage: '1000mg', unit: 'capsule', price: 0.50, category: 'Supplement' },
  // Antiparasitic
  { name: 'Fenbendazole (Panacur) 3-day pack', defaultDosage: '50mg/kg', unit: 'pack', price: 28.00, category: 'Antiparasitic' },
  { name: 'Praziquantel (Droncit)', defaultDosage: '1 tablet', unit: 'tablet', price: 4.00, category: 'Antiparasitic' },
  { name: 'Pyrantel Pamoate', defaultDosage: '5mg/kg', unit: 'mL', price: 0.80, category: 'Antiparasitic' },
  // Preventatives
  { name: 'NexGard (chew, 25–50kg)', defaultDosage: '1 chew', unit: 'chew', price: 35.00, category: 'Preventative' },
  { name: 'Bravecto (chew, 20–40kg)', defaultDosage: '1 chew', unit: 'chew', price: 55.00, category: 'Preventative' },
  { name: 'Heartgard Plus (26–50 lbs)', defaultDosage: '1 chew', unit: 'chew', price: 18.00, category: 'Preventative' },
  { name: 'Revolution (Selamectin) 120mg', defaultDosage: '1 tube', unit: 'tube', price: 28.00, category: 'Preventative' },
  { name: 'Sentinel Spectrum', defaultDosage: '1 chew', unit: 'chew', price: 28.00, category: 'Preventative' },
  { name: 'ProHeart 6 injection', defaultDosage: '1 injection', unit: 'injection', price: 55.00, category: 'Preventative' },
];
