import * as XLSX from 'xlsx';

export type PatientExportColumn = {
  key: string;
  header: string;
};

export const PATIENT_EXPORT_COLUMNS: PatientExportColumn[] = [
  { key: 'customPatientId', header: '患者ID (自定义)' },
  { key: 'name', header: '姓名' },
  { key: 'phone', header: '电话号码' },
  { key: 'description', header: '影像描述' },
  { key: 'diagnosis', header: '影像诊断' },
  { key: 'age', header: '年龄(岁)' },
  { key: 'ageGroup', header: '年龄分组' },
  { key: 'gender', header: '性别' },
  { key: 'height', header: '身高(cm)' },
  { key: 'weight', header: '体重(kg)' },
  { key: 'bmi', header: 'BMI' },
  { key: 'bmiGroup', header: 'BMI分组' },
  { key: 'menstrualStatus', header: '月经状态' },
  { key: 'abortionHistory', header: '流产史' },
  { key: 'hpvInfection', header: 'HPV感染' },
  { key: 'systolicBP', header: '收缩压(mmHg)' },
  { key: 'diastolicBP', header: '舒张压(mmHg)' },
  { key: 'hypertensionGrade', header: '高血压分级' },
  { key: 'figo2018', header: 'FIGO2018分期' },
  { key: 'figoSummary', header: 'FIGO分期汇总' },
  { key: 'tnmStaging', header: 'TNM分期' },
  { key: 'histologyType', header: '组织学类型' },
  { key: 'differentiation', header: '分化程度' },
  { key: 'tumorMaxDiameter', header: '肿瘤最大径(mm)' },
  { key: 'tumorMaxDiameterGroup', header: '肿瘤最大径分组' },
  { key: 'parametrialInvasion', header: '宫旁浸润' },
  { key: 'corpusInvasion', header: '宫体浸润' },
  { key: 'vaginalInvasion', header: '阴道受侵范围' },
  { key: 'bladderInvasion', header: '膀胱受侵' },
  { key: 'rectalInvasion', header: '直肠受侵' },
  { key: 'pelvicLN', header: '盆腔淋巴结转移' },
  { key: 'rbcCount', header: '红细胞计数' },
  { key: 'wbcCount', header: '白细胞计数' },
  { key: 'plateletCount', header: '血小板计数' },
  { key: 'lymphocyteCount', header: '淋巴细胞计数' },
  { key: 'neutrophilCount', header: '中性粒细胞计数' },
  { key: 'monocyteCount', header: '单核细胞计数' },
  { key: 'preTreatmentHb', header: '治疗前血红蛋白' },
  { key: 'hbGroup', header: '血红蛋白分组' },
  { key: 'scca', header: '鳞癌抗原SCCA' },
  { key: 'sccaGroup', header: 'SCCA分组' },
  { key: 'nlr', header: 'NLR' },
  { key: 'plr', header: 'PLR' },
  { key: 'lmr', header: 'LMR' },
  { key: 'rtTechnology', header: '放疗技术' },
  { key: 'ebrtDose', header: '外照射总剂量EBRT' },
  { key: 'ebrtDoseGroup', header: '外照射总剂量分组' },
  { key: 'icbtDose', header: '内照射总剂量ICBT' },
  { key: 'icbtFractions', header: '内照射次数' },
  { key: 'eqd2', header: '等效生物剂量EQD2' },
  { key: 'eqd4', header: '等效生物剂量EQD4' },
  { key: 'ccrtDuration', header: '同步放化疗疗程(天)' },
  { key: 'platinumRegimen', header: '含铂化疗方案' },
  { key: 'platinumDrug', header: '含铂药物' },
  { key: 'cisplatinWeekly', header: '同步顺铂周疗' },
  { key: 'chemoCycles', header: '同步化疗次数' },
  { key: 'totalChemoDose', header: '化疗总剂量' },
  { key: 'treatmentStartDate', header: '治疗开始时间' },
  { key: 'progressionDate', header: '进展时间' },
  { key: 'deathDate', header: '死亡时间' },
  { key: 'metastasis', header: '转移' },
  { key: 'metastasisSite', header: '转移部位' },
  { key: 'treatmentResponse', header: '放化疗疗效' },
  { key: 'recurrence', header: '复发' },
  { key: 'recurrenceSite', header: '复发部位' },
  { key: 'pfsMonths', header: '无进展生存期(月)' },
  { key: 'osMonths', header: '总生存期(月)' },
  { key: 'survivalStatus', header: '生存状态' },
  { key: 'followUpDate', header: '随访时间(YYYY-MM-DD)' },
  { key: 'imagingFilesCount', header: '影像文件数量' },
  { key: 'createdAt', header: '录入时间' },
  { key: 'updatedAt', header: '最后更新时间' },
  { key: 'authorName', header: '录入者姓名' },
  { key: 'authorEmail', header: '录入者邮箱' },
  { key: 'authorUid', header: '录入者UID' },
  { key: 'id', header: '系统记录ID' },
];

export const NUMERIC_FIELDS = new Set([
  'age',
  'height',
  'weight',
  'bmi',
  'tumorMaxDiameter',
  'rbcCount',
  'wbcCount',
  'plateletCount',
  'lymphocyteCount',
  'neutrophilCount',
  'monocyteCount',
  'preTreatmentHb',
  'scca',
  'nlr',
  'plr',
  'lmr',
  'ebrtDose',
  'icbtDose',
  'eqd2',
  'eqd4',
  'ccrtDuration',
  'chemoCycles',
  'totalChemoDose',
  'pfsMonths',
  'osMonths',
  'icbtFractions',
  'systolicBP',
  'diastolicBP',
]);

export const DATE_FIELDS = new Set([
  'treatmentStartDate',
  'progressionDate',
  'deathDate',
  'followUpDate',
]);

export const DERIVED_FIELDS = new Set([
  'ageGroup',
  'bmi',
  'bmiGroup',
  'hypertensionGrade',
  'figoSummary',
  'tumorMaxDiameterGroup',
  'hbGroup',
  'sccaGroup',
  'nlr',
  'plr',
  'lmr',
  'ebrtDoseGroup',
  'eqd2',
  'eqd4',
  'pfsMonths',
  'osMonths',
]);

export const STRUCTURED_IMPORT_IGNORED_FIELDS = new Set([
  'id',
  'imagingFilesCount',
]);

const HEADER_ALIASES: Record<string, string> = {
  '患者id': 'customPatientId',
  '患者id(自定义)': 'customPatientId',
  '患者id（自定义）': 'customPatientId',
  '血压(mmhg)': 'bloodPressure',
  '血压（mmhg）': 'bloodPressure',
  '随访时间': 'followUpDate',
  '治疗开始日期': 'treatmentStartDate',
  '治疗开始时间': 'treatmentStartDate',
  '进展日期': 'progressionDate',
  '进展时间': 'progressionDate',
  '死亡日期': 'deathDate',
  '死亡时间': 'deathDate',
  '录入者': 'authorName',
  '作者': 'authorName',
  'figo2018分期': 'figo2018',
  'figo 2018分期': 'figo2018',
  '肿瘤最大径(cm)': 'tumorMaxDiameter',
  '肿瘤最大径（cm）': 'tumorMaxDiameter',
  '肿瘤最大径(mm)': 'tumorMaxDiameter',
  '肿瘤最大径（mm）': 'tumorMaxDiameter',
  '随访时间(yyyy/mm/dd)': 'followUpDate',
};

const CM_DIAMETER_HEADERS = new Set([
  '肿瘤最大径(cm)',
  '肿瘤最大径（cm）',
]);

const HEADER_TO_FIELD_MAP = PATIENT_EXPORT_COLUMNS.reduce<Record<string, string>>((acc, column) => {
  acc[normalizeSpreadsheetHeader(column.header)] = column.key;
  return acc;
}, {});

for (const [header, field] of Object.entries(HEADER_ALIASES)) {
  HEADER_TO_FIELD_MAP[normalizeSpreadsheetHeader(header)] = field;
}

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function formatDateLocal(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatDateTimeLocal(date: Date) {
  return `${formatDateLocal(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function isValidDate(year: number, month: number, day: number, hours = 0, minutes = 0, seconds = 0) {
  const candidate = new Date(year, month - 1, day, hours, minutes, seconds);
  return (
    candidate.getFullYear() === year &&
    candidate.getMonth() === month - 1 &&
    candidate.getDate() === day &&
    candidate.getHours() === hours &&
    candidate.getMinutes() === minutes &&
    candidate.getSeconds() === seconds
  );
}

function toDateFromParts(year: number, month: number, day: number, hours = 0, minutes = 0, seconds = 0) {
  if (!isValidDate(year, month, day, hours, minutes, seconds)) return undefined;
  return new Date(year, month - 1, day, hours, minutes, seconds);
}

function normalizeYear(year: number) {
  if (year >= 100) return year;
  return year >= 70 ? 1900 + year : 2000 + year;
}

function parseStringAsDate(value: string) {
  const raw = value.trim();
  if (!raw) return undefined;

  const normalized = raw
    .replace(/[年月.]/g, '/')
    .replace(/日/g, '')
    .replace(/-/g, '/')
    .replace(/\s+/g, ' ')
    .trim();

  const digitsOnly = normalized.replace(/\D/g, '');
  if (digitsOnly.length === 8 && /^\d{8}$/.test(digitsOnly)) {
    const date = toDateFromParts(
      Number(digitsOnly.slice(0, 4)),
      Number(digitsOnly.slice(4, 6)),
      Number(digitsOnly.slice(6, 8))
    );
    if (date) return date;
  }

  const dateTimeMatch = normalized.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/);
  if (dateTimeMatch) {
    return toDateFromParts(
      Number(dateTimeMatch[1]),
      Number(dateTimeMatch[2]),
      Number(dateTimeMatch[3]),
      Number(dateTimeMatch[4] || 0),
      Number(dateTimeMatch[5] || 0),
      Number(dateTimeMatch[6] || 0)
    );
  }

  const monthDayYearMatch = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/);
  if (monthDayYearMatch) {
    return toDateFromParts(
      normalizeYear(Number(monthDayYearMatch[3])),
      Number(monthDayYearMatch[1]),
      Number(monthDayYearMatch[2]),
      Number(monthDayYearMatch[4] || 0),
      Number(monthDayYearMatch[5] || 0),
      Number(monthDayYearMatch[6] || 0)
    );
  }

  const fallback = new Date(raw);
  if (!Number.isNaN(fallback.getTime())) return fallback;

  return undefined;
}

function parseExcelDate(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;

  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return undefined;
    return toDateFromParts(parsed.y, parsed.m, parsed.d, parsed.H, parsed.M, Math.floor(parsed.S));
  }

  if (typeof value === 'string') {
    return parseStringAsDate(value);
  }

  return undefined;
}

function normalizeDateField(value: unknown) {
  const parsed = parseExcelDate(value);
  return parsed ? formatDateLocal(parsed) : undefined;
}

function normalizeDateTimeField(value: unknown) {
  const parsed = parseExcelDate(value);
  return parsed ? formatDateTimeLocal(parsed) : undefined;
}

function normalizeNumericField(value: unknown) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value !== 'string') return undefined;

  const cleaned = value.replace(/,/g, '').trim();
  if (!cleaned) return undefined;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function asCleanString(value: unknown) {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || undefined;
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return formatDateTimeLocal(value);
  }
  return String(value).trim() || undefined;
}

export function normalizeSpreadsheetHeader(header: string) {
  return String(header ?? '')
    .replace(/\r?\n/g, ' ')
    .replace(/\u3000/g, ' ')
    .replace(/（/g, '(')
    .replace(/）/g, ')')
    .replace(/\s+/g, '')
    .trim()
    .toLowerCase();
}

export function parseTnmStaging(value?: string) {
  const text = asCleanString(value);
  if (!text) return {};

  const compact = text.replace(/\s+/g, '');
  const t = compact.match(/(T(?:is|x|X|0|[1-4](?:[a-cA-C])?))/i)?.[1]?.toUpperCase();
  const n = compact.match(/(N(?:x|X|0|[1-3](?:[a-cA-C])?))/i)?.[1]?.toUpperCase();
  const m = compact.match(/(M(?:x|X|0|1(?:[a-cA-C])?))/i)?.[1]?.toUpperCase();

  return {
    ...(t ? { tnmT: t } : {}),
    ...(n ? { tnmN: n } : {}),
    ...(m ? { tnmM: m } : {}),
  };
}

function applyBloodPressureCompatibility(data: Record<string, any>) {
  const next = { ...data };

  if (!next.bloodPressure && (next.systolicBP || next.diastolicBP)) {
    if (next.systolicBP && next.diastolicBP) {
      next.bloodPressure = `${next.systolicBP}/${next.diastolicBP}`;
    }
  }

  if (next.bloodPressure && (!next.systolicBP || !next.diastolicBP)) {
    const match = String(next.bloodPressure).match(/(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/);
    if (match) {
      next.systolicBP = Number(match[1]);
      next.diastolicBP = Number(match[2]);
    }
  }

  return next;
}

export function calculatePatientDerivedFields(data: Record<string, any>) {
  const result: Record<string, any> = { ...data };

  const age = normalizeNumericField(result.age);
  if (age && age > 0) {
    result.age = age;
    result.ageGroup = age < 40 ? '<40' : age <= 60 ? '40-60' : '>60';
  } else {
    delete result.ageGroup;
  }

  const height = normalizeNumericField(result.height);
  const weight = normalizeNumericField(result.weight);
  if (height && weight && height > 0 && weight > 0) {
    result.height = height;
    result.weight = weight;
    const bmi = Number((weight / ((height / 100) * (height / 100))).toFixed(2));
    result.bmi = bmi;
    result.bmiGroup = bmi < 24 ? '<24' : '>=24';
  } else {
    delete result.bmi;
    delete result.bmiGroup;
  }

  const bloodPressure = asCleanString(result.bloodPressure);
  if (bloodPressure) {
    result.bloodPressure = bloodPressure;
    const parts = bloodPressure.split('/');
    if (parts.length === 2) {
      const systolic = Number(parts[0]);
      const diastolic = Number(parts[1]);
      if (!Number.isNaN(systolic) && !Number.isNaN(diastolic)) {
        result.systolicBP = systolic;
        result.diastolicBP = diastolic;
        if (systolic >= 180 || diastolic >= 110) result.hypertensionGrade = '3级(重度)';
        else if (systolic >= 160 || diastolic >= 100) result.hypertensionGrade = '2级(中度)';
        else if (systolic >= 140 || diastolic >= 90) result.hypertensionGrade = '1级(轻度)';
        else if (systolic > 0 && diastolic > 0) result.hypertensionGrade = '无';
        else delete result.hypertensionGrade;
      } else {
        delete result.hypertensionGrade;
      }
    } else {
      delete result.hypertensionGrade;
    }
  } else {
    delete result.hypertensionGrade;
  }

  const figo2018 = asCleanString(result.figo2018);
  if (figo2018) {
    result.figo2018 = figo2018;
    if (figo2018.startsWith('IA') || figo2018.startsWith('IB')) result.figoSummary = 'I';
    else if (figo2018.startsWith('IIA') || figo2018.startsWith('IIB')) result.figoSummary = 'II';
    else if (figo2018.startsWith('IIIA') || figo2018.startsWith('IIIB') || figo2018.startsWith('IIIC')) result.figoSummary = 'III';
    else if (figo2018.startsWith('IVA') || figo2018.startsWith('IVB')) result.figoSummary = 'IV';
    else delete result.figoSummary;
  } else {
    delete result.figoSummary;
  }

  const tumorMaxDiameter = normalizeNumericField(result.tumorMaxDiameter);
  if (tumorMaxDiameter && tumorMaxDiameter > 0) {
    result.tumorMaxDiameter = tumorMaxDiameter;
    result.tumorMaxDiameterGroup = tumorMaxDiameter < 40 ? '<40mm' : '>=40mm';
  } else {
    delete result.tumorMaxDiameterGroup;
  }

  const preTreatmentHb = normalizeNumericField(result.preTreatmentHb);
  if (preTreatmentHb && preTreatmentHb > 0) {
    result.preTreatmentHb = preTreatmentHb;
    result.hbGroup = preTreatmentHb < 100 ? '<10' : '>=10';
  } else {
    delete result.hbGroup;
  }

  const scca = normalizeNumericField(result.scca);
  if (scca !== undefined && scca !== null && scca >= 0) {
    result.scca = scca;
    if (scca < 1.5) result.sccaGroup = '<1.5';
    else if (scca <= 5) result.sccaGroup = '1.5-5';
    else result.sccaGroup = '>5';
  } else {
    delete result.sccaGroup;
  }

  const neutrophilCount = normalizeNumericField(result.neutrophilCount);
  const lymphocyteCount = normalizeNumericField(result.lymphocyteCount);
  const plateletCount = normalizeNumericField(result.plateletCount);
  const monocyteCount = normalizeNumericField(result.monocyteCount);
  if (
    neutrophilCount && lymphocyteCount && plateletCount && monocyteCount &&
    neutrophilCount > 0 && lymphocyteCount > 0 && plateletCount > 0 && monocyteCount > 0
  ) {
    result.neutrophilCount = neutrophilCount;
    result.lymphocyteCount = lymphocyteCount;
    result.plateletCount = plateletCount;
    result.monocyteCount = monocyteCount;
    result.nlr = Number((neutrophilCount / lymphocyteCount).toFixed(2));
    result.plr = Number((plateletCount / lymphocyteCount).toFixed(2));
    result.lmr = Number((lymphocyteCount / monocyteCount).toFixed(2));
  } else {
    delete result.nlr;
    delete result.plr;
    delete result.lmr;
  }

  const ebrtDose = normalizeNumericField(result.ebrtDose);
  if (ebrtDose && ebrtDose > 0) {
    result.ebrtDose = ebrtDose;
    result.ebrtDoseGroup = ebrtDose < 50.4 ? '<50.4' : '>=50.4';
  } else {
    delete result.ebrtDoseGroup;
  }

  const icbtDose = normalizeNumericField(result.icbtDose);
  const icbtFractions = normalizeNumericField(result.icbtFractions);
  if (ebrtDose && icbtDose && icbtFractions && ebrtDose > 0 && icbtDose > 0 && icbtFractions > 0) {
    result.icbtDose = icbtDose;
    result.icbtFractions = icbtFractions;
    const dosePerFraction = icbtDose / icbtFractions;
    const eqd2 = ebrtDose + icbtDose * ((dosePerFraction + 10) / (2 + 10));
    const eqd4 = ebrtDose + icbtDose * ((dosePerFraction + 10) / (4 + 10));
    result.eqd2 = Number(eqd2.toFixed(2));
    result.eqd4 = Number(eqd4.toFixed(2));
  } else {
    delete result.eqd2;
    delete result.eqd4;
  }

  const treatmentStartDate = normalizeDateField(result.treatmentStartDate);
  const progressionDate = normalizeDateField(result.progressionDate);
  const deathDate = normalizeDateField(result.deathDate);
  const followUpDate = normalizeDateField(result.followUpDate);

  if (treatmentStartDate) result.treatmentStartDate = treatmentStartDate;
  if (progressionDate) result.progressionDate = progressionDate;
  if (deathDate) result.deathDate = deathDate;
  if (followUpDate) result.followUpDate = followUpDate;

  if (treatmentStartDate) {
    const start = new Date(treatmentStartDate);
    if (progressionDate) {
      const progression = new Date(progressionDate);
      result.pfsMonths = Number((Math.abs(progression.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30.44)).toFixed(1));
    } else {
      delete result.pfsMonths;
    }

    if (deathDate) {
      const death = new Date(deathDate);
      result.osMonths = Number((Math.abs(death.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30.44)).toFixed(1));
    } else if (followUpDate) {
      const followUp = new Date(followUpDate);
      result.osMonths = Number((Math.abs(followUp.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30.44)).toFixed(1));
    } else {
      delete result.osMonths;
    }
  } else {
    delete result.pfsMonths;
    delete result.osMonths;
  }

  return result;
}

export function mapStructuredSpreadsheetRow(rawRow: Record<string, unknown>) {
  const mapped: Record<string, any> = {};

  for (const [header, rawValue] of Object.entries(rawRow)) {
    const normalizedHeader = normalizeSpreadsheetHeader(header);
    const field = HEADER_TO_FIELD_MAP[normalizedHeader];
    if (!field || STRUCTURED_IMPORT_IGNORED_FIELDS.has(field)) continue;

    if (DATE_FIELDS.has(field)) {
      const normalizedDate = normalizeDateField(rawValue);
      if (normalizedDate) mapped[field] = normalizedDate;
      continue;
    }

    if (field === 'createdAt' || field === 'updatedAt') {
      const normalizedDateTime = normalizeDateTimeField(rawValue);
      if (normalizedDateTime) mapped[field] = normalizedDateTime;
      continue;
    }

    if (NUMERIC_FIELDS.has(field)) {
      let numericValue = normalizeNumericField(rawValue);
      if (numericValue !== undefined && CM_DIAMETER_HEADERS.has(header.trim())) {
        numericValue = Number((numericValue * 10).toFixed(2));
      }
      if (numericValue !== undefined) mapped[field] = numericValue;
      continue;
    }

    const cleaned = asCleanString(rawValue);
    if (cleaned !== undefined) mapped[field] = cleaned;
  }

  for (const derivedField of DERIVED_FIELDS) {
    delete mapped[derivedField];
  }

  const tnm = parseTnmStaging(mapped.tnmStaging);
  if (!mapped.tnmT && tnm.tnmT) mapped.tnmT = tnm.tnmT;
  if (!mapped.tnmN && tnm.tnmN) mapped.tnmN = tnm.tnmN;
  if (!mapped.tnmM && tnm.tnmM) mapped.tnmM = tnm.tnmM;

  if (!mapped.tnmStaging && (mapped.tnmT || mapped.tnmN || mapped.tnmM)) {
    mapped.tnmStaging = `${mapped.tnmT || ''}${mapped.tnmN || ''}${mapped.tnmM || 'M0'}`;
  }

  return calculatePatientDerivedFields(applyBloodPressureCompatibility(mapped));
}

export function hasMeaningfulStructuredData(data: Record<string, any>) {
  const ignored = new Set(['authorUid', 'authorEmail', 'authorName', 'createdAt', 'updatedAt', 'userId']);
  return Object.entries(data).some(([key, value]) => {
    if (ignored.has(key)) return false;
    if (value === undefined || value === null) return false;
    if (typeof value === 'string') return value.trim() !== '';
    return true;
  });
}
