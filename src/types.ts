export interface Patient {
  id?: string;
  customPatientId?: string;
  name: string;
  phone?: string;
  age?: string | number;
  ageGroup?: string;
  gender?: string;
  menstrualStatus?: string;
  abortionHistory?: string;
  hpvInfection?: string;
  height?: string | number;
  weight?: string | number;
  bmi?: string | number;
  bmiGroup?: string;
  bloodPressure?: string;
  hypertensionGrade?: string;
  remarkA?: string;
  
  figo2018?: string;
  figoSummary?: string;
  tnmStaging?: string;
  histologyType?: string;
  differentiation?: string;
  tumorMaxDiameter?: string | number;
  tumorMaxDiameterGroup?: string;
  remarkB?: string;
  
  parametrialInvasion?: string;
  corpusInvasion?: string;
  vaginalInvasion?: string;
  bladderInvasion?: string;
  rectalInvasion?: string;
  pelvicLN?: string;
  
  rbcCount?: string | number;
  wbcCount?: string | number;
  plateletCount?: string | number;
  lymphocyteCount?: string | number;
  neutrophilCount?: string | number;
  monocyteCount?: string | number;
  preTreatmentHb?: string | number;
  hbGroup?: string;
  scca?: string | number;
  sccaGroup?: string;
  nlr?: string | number;
  plr?: string | number;
  lmr?: string | number;
  remarkC?: string;
  
  rtTechnology?: string;
  ebrtDose?: string | number;
  ebrtDoseGroup?: string;
  icbtDose?: string | number;
  icbtFractions?: string | number;
  eqd2?: string | number;
  eqd4?: string | number;
  ccrtDuration?: string | number;
  platinumRegimen?: string;
  platinumDrug?: string;
  cisplatinWeekly?: string;
  chemoCycles?: string | number;
  totalChemoDose?: string | number;
  remarkD?: string;
  remarkE?: string;
  treatmentStartDate?: string;
  progressionDate?: string;
  deathDate?: string;
  metastasis?: string;
  metastasisSite?: string;
  treatmentResponse?: string;
  recurrence?: string;
  recurrenceSite?: string;
  pfsMonths?: string | number;
  osMonths?: string | number;
  survivalStatus?: string;
  followUpDate?: string;
  
  imagingFiles?: {
    name: string;
    url: string;
    size: number;
    path: string;
  }[];
  
  authorEmail?: string;
  authorName?: string;
  authorUid?: string;
  userId: string;
  createdAt: any;
  updatedAt: any;
}
