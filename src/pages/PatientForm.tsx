import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { read, utils } from 'xlsx';
import { 
  ArrowLeft, Save, Loader2, ChevronDown, Mic, MicOff, RotateCcw
} from 'lucide-react';
import { db, auth } from '../firebase';
import { GoogleGenAI } from '@google/genai';
import { 
  collection, 
  addDoc, 
  doc, 
  getDoc, 
  updateDoc, 
  serverTimestamp,
  getDocFromServer
} from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { Patient } from '../types';

// Error handling helper
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  
  // Show a more user-friendly message
  let message = "数据库操作失败。";
  if (errInfo.error.includes("permission-denied")) {
    message = "权限不足，无法执行此操作。请确保您已登录且拥有相应权限。";
  }
  
  throw new Error(JSON.stringify(errInfo));
}

const SECTION_A_FIELDS = [
  { name: 'customPatientId', label: '患者ID' },
  { name: 'name', label: '姓名' },
  { name: 'age', label: '年龄（岁）' },
  { name: 'ageGroup', label: '年龄分组', readOnly: true },
  { name: 'gender', label: '性别', options: ['女', '男'] },
  { name: 'menstrualStatus', label: '月经状态', options: ['未绝经', '围绝经', '绝经'] },
  { name: 'abortionHistory', label: '流产史', options: ['是', '否'] },
  { name: 'hpvInfection', label: 'HPV感染', options: ['阳性', '阴性'] },
  { name: 'phone', label: '电话号码' },
  { name: 'height', label: '身高 (cm)' },
  { name: 'weight', label: '体重 (kg)' },
  { name: 'bmi', label: 'BMI', readOnly: true },
  { name: 'bmiGroup', label: 'BMI分组', readOnly: true },
  { name: 'bloodPressure', label: '血压 (mmHg)', placeholder: '例如: 130/80' },
  { name: 'hypertensionGrade', label: '高血压分级', readOnly: true },
  { name: 'remarkA', label: '备注', type: 'textarea' },
];

const SECTION_B_FIELDS = [
  { name: 'figo2018', label: 'FIGO 2018分期', options: ['IB3', 'IIA1', 'IIA2', 'IIB', 'IIIA', 'IIIB', 'IIIC1', 'IIIC2', 'IVA'] },
  { name: 'tnmStaging', label: 'TNM分期' },
  { name: 'histologyType', label: '组织学类型', options: ['鳞状细胞癌', '腺癌', '腺鳞癌', '其他'] },
  { name: 'differentiation', label: '分化程度', options: ['高分化', '中分化', '低分化'] },
  { name: 'tumorMaxDiameter', label: '肿瘤最大径 (cm)' },
  { name: 'parametrialInvasion', label: '宫旁浸润', options: ['无', '有'] },
  { name: 'corpusInvasion', label: '宫体浸润', options: ['无', '有'] },
  { name: 'vaginalInvasion', label: '阴道受侵范围', options: ['无', '上1/3', '中1/3', '下1/3'] },
  { name: 'bladderInvasion', label: '膀胱受侵', options: ['无', '有'] },
  { name: 'rectalInvasion', label: '直肠受侵', options: ['无', '有'] },
  { name: 'pelvicLN', label: '盆腔淋巴结转移', options: ['无', '有'] },
  { name: 'remarkB', label: '备注', type: 'textarea' },
];

const SECTION_C_FIELDS = [
  { name: 'rbcCount', label: '红细胞计数 (10^12/L)' },
  { name: 'wbcCount', label: '白细胞计数 (10^9/L)' },
  { name: 'plateletCount', label: '血小板计数 (10^9/L)' },
  { name: 'lymphocyteCount', label: '淋巴细胞计数 (10^9/L)' },
  { name: 'neutrophilCount', label: '中性粒细胞计数 (10^9/L)' },
  { name: 'monocyteCount', label: '单核细胞计数 (10^9/L)' },
  { name: 'preTreatmentHb', label: '治疗前血红蛋白 (g/L)' },
  { name: 'scca', label: 'SCCA (ng/mL)' },
  { name: 'remarkC', label: '备注', type: 'textarea' },
];

const SECTION_D_FIELDS = [
  { name: 'rtTechnology', label: '放疗技术', options: ['VMAT', 'IMRT', '2D/3D-CRT', '其他'] },
  { name: 'ebrtDose', label: '外照射总剂量 (Gy)' },
  { name: 'icbtDose', label: '内照射总剂量 (Gy)' },
  { name: 'icbtFractions', label: '内照射次数' },
  { name: 'ccrtDuration', label: '同步放化疗疗程 (天)' },
  { name: 'platinumRegimen', label: '含铂化疗方案' },
  { name: 'platinumDrug', label: '含铂药物', options: ['顺铂', '卡铂', '洛铂', '其他'] },
  { name: 'cisplatinWeekly', label: '同步顺铂周疗', options: ['否', '是'] },
  { name: 'chemoCycles', label: '同步化疗次数' },
  { name: 'totalChemoDose', label: '化疗总剂量 (mg)' },
  { name: 'remarkD', label: '备注', type: 'textarea' },
];

const SECTION_E_FIELDS = [
  { name: 'treatmentStartDate', label: '治疗开始时间', type: 'date' },
  { name: 'progressionDate', label: '进展时间', type: 'date', optional: true },
  { name: 'deathDate', label: '死亡时间', type: 'date', optional: true },
  { name: 'metastasis', label: '转移', options: ['无', '有'] },
  { name: 'metastasisSite', label: '转移部位', optional: true },
  { name: 'treatmentResponse', label: '放化疗疗效', options: ['CR', 'PR', 'SD', 'PD'] },
  { name: 'recurrence', label: '复发', options: ['无', '有'] },
  { name: 'recurrenceSite', label: '复发部位', optional: true },
  { name: 'pfsMonths', label: '无进展生存期 (月)', readOnly: true },
  { name: 'osMonths', label: '总生存期 (月)', readOnly: true },
  { name: 'survivalStatus', label: '生存状态', options: ['存活', '死亡', '失访'] },
  { name: 'followUpDate', label: '随访时间', type: 'date' },
  { name: 'remarkE', label: '备注', type: 'textarea' },
];

function playOneSectionDone() {
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtx) return;
  const ctx = new AudioCtx();
  const master = ctx.createGain();
  master.connect(ctx.destination);
  master.gain.value = 0.75;

  const notes = [
    { freq: 659.25, start: 0,    dur: 0.14, g: 0.5, type: 'sine' },  // E5
    { freq: 783.99, start: 0.13, dur: 0.14, g: 0.5, type: 'sine' },  // G5
    { freq: 1046.5, start: 0.26, dur: 0.30, g: 0.6, type: 'sine' },  // C6
  ];

  notes.forEach(({ freq, start, dur, g, type }) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(master);
    osc.type = type as OscillatorType;
    osc.frequency.value = freq;
    const t = ctx.currentTime + start;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(g, t + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.start(t); osc.stop(t + dur + 0.05);
  });

  setTimeout(() => ctx.close().catch(() => {}), 1500);
}

function playSectionDone() {
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtx) return;
  const ctx = new AudioCtx();
  const master = ctx.createGain();
  master.connect(ctx.destination);
  master.gain.value = 0.9;

  const notes = [
    { freq: 523.25, start: 0,    dur: 0.13, g: 0.55, type: 'sine'     },  // C5
    { freq: 659.25, start: 0.11, dur: 0.13, g: 0.55, type: 'sine'     },  // E5
    { freq: 783.99, start: 0.22, dur: 0.13, g: 0.55, type: 'sine'     },  // G5
    { freq: 261.63, start: 0.34, dur: 0.80, g: 0.40, type: 'triangle' },  // C4 bass
    { freq: 523.25, start: 0.34, dur: 0.80, g: 0.50, type: 'sine'     },  // C5
    { freq: 659.25, start: 0.34, dur: 0.80, g: 0.45, type: 'sine'     },  // E5
    { freq: 783.99, start: 0.34, dur: 0.80, g: 0.45, type: 'sine'     },  // G5
    { freq: 1046.5, start: 0.34, dur: 0.80, g: 0.55, type: 'sine'     },  // C6
  ];

  notes.forEach(({ freq, start, dur, g, type }) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(master);
    osc.type = type as OscillatorType;
    osc.frequency.value = freq;
    const t = ctx.currentTime + start;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(g, t + 0.018);
    gain.gain.setValueAtTime(g, t + dur * 0.65);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.start(t); osc.stop(t + dur + 0.05);
  });

  setTimeout(() => ctx.close().catch(() => {}), 2500);
}

function isSectionFilled(fields: any[], values: any) {
  const required = fields.filter(f => !f.readOnly && !f.optional && f.label !== '备注');
  return required.length > 0 && required.every(f => String(values?.[f.name] ?? '').trim() !== '');
}

const FormSection = ({ title, children, id, fields, clearSection, toggleSectionRecording, recordingSection, processingSection, handleFileUpload, formValues, suppressSound }: { title: string, children: React.ReactNode, id: string, fields: any[], clearSection: (fields: any[]) => void, toggleSectionRecording: (id: string, title: string, fields: any[]) => void, recordingSection: string | null, processingSection: string | null, handleFileUpload: (file: File, patientNameOrId: string) => Promise<void>, formValues?: any, suppressSound?: boolean }) => {
  const editableFields = fields.filter(f => !f.readOnly && !f.optional && f.label !== '备注');
  const filledCount = editableFields.filter(f => String(formValues?.[f.name] ?? '').trim() !== '').length;
  const isComplete = editableFields.length > 0 && filledCount === editableFields.length;
  const prevCompleteRef = React.useRef(false);
  const [justCompleted, setJustCompleted] = React.useState(false);
  React.useEffect(() => {
    if (isComplete && !prevCompleteRef.current) {
      setJustCompleted(true);
      if (!suppressSound) playOneSectionDone();
      const t = setTimeout(() => setJustCompleted(false), 1800);
      return () => clearTimeout(t);
    }
    prevCompleteRef.current = isComplete;
  }, [isComplete]);
  return (
    <div className={`bg-white rounded-xl shadow-sm mb-6 border transition-all duration-700 ${justCompleted ? 'border-green-400 shadow-green-100 shadow-md' : isComplete ? 'border-green-200' : 'border-gray-100'}`} id={id}>
      <div className="bg-gray-50 px-6 py-3 border-bottom border-gray-100 flex items-center justify-between">
        <div className='flex items-center gap-3'>
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">{title}</h3>
          {isComplete && (
            <span className={`inline-flex items-center gap-1 text-xs font-medium text-green-600 transition-all duration-300 ${justCompleted ? 'scale-110' : 'scale-100'}`}>
              <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" fill="#dcfce7" stroke="#16a34a" strokeWidth="1.5"/><path d="M5 8l2 2 4-4" stroke="#16a34a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              已完成
            </span>
          )}
          {!isComplete && editableFields.length > 0 && (
            <span className="text-xs text-gray-400">{filledCount}/{editableFields.length}</span>
          )}
        </div>
        <div className='flex items-center gap-2'>
          <button type="button" onClick={() => clearSection(fields)} className="text-xs text-gray-500 hover:text-red-600">清空</button>
          <button
            type="button"
            onClick={() => toggleSectionRecording(id, title, fields)}
            disabled={processingSection === id}
            className={`p-1.5 rounded-md transition-colors ${
              recordingSection === id 
                ? 'bg-red-100 text-red-600 hover:bg-red-200 animate-pulse' 
                : processingSection === id
                ? 'bg-blue-50 text-blue-600'
                : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'
            }`}
            title={recordingSection === id ? "停止录音" : processingSection === id ? "正在处理..." : "语音输入本模块"}
          >
            {processingSection === id ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : recordingSection === id ? (
              <MicOff className="w-4 h-4" />
            ) : (
              <Mic className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
      <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {children}
      </div>
    </div>
  )};

const FormInput = ({ label, name, type = "text", placeholder, options, multiple = false, description, readOnly = false, register, toggleRecording, processingField, recordingField }: any) => {
  const listId = options ? `${name}-list` : undefined;
  
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-gray-700">
        {label}
      </label>
      <div className="relative">
        {type === "textarea" ? (
          <textarea
            {...register(name)}
            placeholder={placeholder}
            rows={3}
            readOnly={readOnly}
            className={`w-full px-3 py-2 ${!readOnly ? 'pr-10' : ''} border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm ${readOnly ? 'bg-gray-100 cursor-not-allowed text-gray-500' : 'bg-white'}`}
          />
        ) : options ? (
          <select
            {...register(name)}
            multiple={multiple}
            disabled={readOnly}
            className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm ${readOnly ? 'bg-gray-100 cursor-not-allowed text-gray-500' : 'bg-white'} ${multiple ? 'h-32' : ''}`}
          >
            {!multiple && <option value="">请选择</option>}
            {options.map((opt: string) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        ) : (
          <>
            <input
              type={type === 'select' ? 'text' : type}
              {...register(name)}
              placeholder={placeholder}
              readOnly={readOnly}
              className={`w-full px-3 py-2 ${!readOnly && type !== 'date' ? 'pr-10' : ''} border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm ${readOnly ? 'bg-gray-100 cursor-not-allowed text-gray-500' : 'bg-white'}`}
            />
          </>
        )}
        {!readOnly && type !== 'date' && (
          <button
            type="button"
            onClick={() => toggleRecording(name, label, options)}
            disabled={processingField === name}
            className={`absolute right-2 ${type === 'textarea' ? 'top-2' : 'top-1/2 -translate-y-1/2'} p-1.5 rounded-md transition-colors ${
              recordingField === name 
                ? 'bg-red-100 text-red-600 hover:bg-red-200 animate-pulse' 
                : processingField === name
                ? 'bg-blue-50 text-blue-600'
                : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'
            }`}
            title={recordingField === name ? "停止录音" : processingField === name ? "正在处理..." : "语音输入"}
          >
            {processingField === name ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : recordingField === name ? (
              <MicOff className="w-4 h-4" />
            ) : (
              <Mic className="w-4 h-4" />
            )}
          </button>
        )}
      </div>
    </div>
  )};

export default function PatientForm({ user: propUser }: { user?: any }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [authStateUser] = useAuthState(auth);
  const user = propUser || authStateUser;
  const [loading, setLoading] = useState(!!id);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [recordingField, setRecordingField] = useState<string | null>(null);
  const [processingField, setProcessingField] = useState<string | null>(null);
  const [recordingSection, setRecordingSection] = useState<string | null>(null);
  const [processingSection, setProcessingSection] = useState<string | null>(null);
  const recordingFieldRef = useRef<string | null>(null);
  const recordingSectionRef = useRef<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef<string>('');
  const activeFieldInfoRef = useRef<{name: string, label: string, options?: string[], initialValue: string} | null>(null);
  const activeSectionInfoRef = useRef<{id: string, title: string, fields: any[]} | null>(null);
  const isProcessingRef = useRef(false);

  useEffect(() => {
    recordingFieldRef.current = recordingField;
  }, [recordingField]);

  useEffect(() => {
    recordingSectionRef.current = recordingSection;
  }, [recordingSection]);

  const finishRecording = async () => {
    const fieldName = recordingFieldRef.current;
    if (!fieldName || isProcessingRef.current) return;
    
    isProcessingRef.current = true;
    setRecordingField(null);
    setProcessingField(fieldName);
    
    const transcript = transcriptRef.current;
    const info = activeFieldInfoRef.current;
    
    if (transcript && info && info.name === fieldName) {
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const prompt = `你是一个医疗表单填写助手。
当前正在填写的字段是：“${info.label}”
该字段的可选值有：${info.options ? info.options.join(', ') : '无限制'}
该字段原本的值是：“${info.initialValue}”
用户刚刚通过语音输入了：“${transcript}”

请根据用户的语音指令，提取或修改该字段的值。
规则：
1. 去除语气词、标点符号和多余的动作词（如“改成”、“输入”、“就是”、“写”等）。
2. 将中文数字转换为阿拉伯数字（如“三点八” -> “3.8”）。
3. 如果有可选值，请尽量对齐到可选值之一。
4. 如果用户指令是追加内容，请结合“原本的值”进行追加。如果是修改，则直接替换。
5. 只返回最终要填入的纯文本，不要返回任何其他解释、Markdown标记或引号。`;

        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: prompt,
        });
        
        const finalValue = response.text?.trim() || transcript;
        setValue(fieldName as any, finalValue, { shouldValidate: true, shouldDirty: true });
      } catch (error) {
        console.error("AI processing failed:", error);
      }
    }
    
    setProcessingField(null);
    isProcessingRef.current = false;
    transcriptRef.current = '';
    activeFieldInfoRef.current = null;
    recordingFieldRef.current = null;
  };

  const finishRecordingRef = useRef(finishRecording);
  useEffect(() => {
    finishRecordingRef.current = finishRecording;
  }, [finishRecording]);

  const finishSectionRecording = async () => {
    const sectionId = recordingSectionRef.current;
    if (!sectionId || isProcessingRef.current) return;
    
    isProcessingRef.current = true;
    setRecordingSection(null);
    setProcessingSection(sectionId);
    
    const transcript = transcriptRef.current;
    const info = activeSectionInfoRef.current;
    
    if (transcript && info && info.id === sectionId) {
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const prompt = `你是一个医疗表单填写助手。
当前正在填写的模块是：“${info.title}”
该模块包含以下字段及其可选值（如果有）：
${info.fields.map(f => `- ${f.label} (字段名: ${f.name})${f.options ? `，可选值: [${f.options.join(', ')}]` : ''}`).join('\n')}

用户刚刚通过语音输入了一段话，请从中提取出对应字段的值。
用户的语音内容是：“${transcript}”

请根据用户的语音指令，提取出各个字段的值。
规则：
1. 去除语气词、标点符号和多余的动作词。
2. 将中文数字转换为阿拉伯数字。
3. 如果有可选值，请尽量对齐到可选值之一。
4. 返回的结果必须是一个合法的 JSON 对象，键为字段名（如 customPatientId, name 等），值为提取出的文本或数字。
5. 如果某个字段在语音中没有提到，请不要在 JSON 中包含该字段。
6. 不要返回任何其他解释、Markdown标记（如 \`\`\`json）或引号。只返回纯 JSON 字符串。`;

        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: prompt,
          config: {
            responseMimeType: "application/json",
          }
        });
        
        const responseText = response.text?.trim() || "{}";
        try {
          const extractedData = JSON.parse(responseText);
          Object.keys(extractedData).forEach(key => {
            if (info.fields.some(f => f.name === key)) {
              setValue(key as any, extractedData[key], { shouldValidate: true, shouldDirty: true });
            }
          });
        } catch (parseError) {
          console.error("Failed to parse AI response as JSON:", parseError, responseText);
        }
      } catch (error) {
        console.error("AI processing failed:", error);
      }
    }
    
    setProcessingSection(null);
    isProcessingRef.current = false;
    transcriptRef.current = '';
    activeSectionInfoRef.current = null;
    recordingSectionRef.current = null;
  };

  const finishSectionRecordingRef = useRef(finishSectionRecording);
  useEffect(() => {
    finishSectionRecordingRef.current = finishSectionRecording;
  }, [finishSectionRecording]);

  const { register, handleSubmit, setValue, watch, reset, getValues, control, formState: { errors } } = useForm<Patient>({
    defaultValues: {
      gender: '女',
      menstrualStatus: '',
      abortionHistory: '',
      hpvInfection: '',
      parametrialInvasion: '无',
      corpusInvasion: '无',
      vaginalInvasion: '无',
      bladderInvasion: '无',
      rectalInvasion: '无',
      pelvicLN: '无',
      cisplatinWeekly: '否',
      treatmentStartDate: '',
      progressionDate: '',
      deathDate: '',
      metastasis: '无',
      metastasisSite: '',
      treatmentResponse: '',
      recurrence: '无',
      survivalStatus: '存活',
      figo2018: ''
    }
  });

  // Watch fields for auto-calculation
  const allFormValues = watch();

  const allSectionsComplete = [SECTION_A_FIELDS, SECTION_B_FIELDS, SECTION_C_FIELDS, SECTION_D_FIELDS, SECTION_E_FIELDS]
    .every(f => isSectionFilled(f, allFormValues));
  const prevAllCompleteRef = React.useRef(false);
  useEffect(() => {
    if (allSectionsComplete && !prevAllCompleteRef.current) {
      playSectionDone();
    }
    prevAllCompleteRef.current = allSectionsComplete;
  }, [allSectionsComplete]);
  const bloodPressure = watch('bloodPressure');
  const height = watch('height');
  const weight = watch('weight');
  const age = watch('age');
  const figo2018 = watch('figo2018');
  const tumorMaxDiameter = watch('tumorMaxDiameter');
  const preTreatmentHb = watch('preTreatmentHb');
  const scca = watch('scca');
  const neutrophilCount = watch('neutrophilCount');
  const lymphocyteCount = watch('lymphocyteCount');
  const plateletCount = watch('plateletCount');
  const monocyteCount = watch('monocyteCount');
  const ebrtDose = watch('ebrtDose');
  const icbtDose = watch('icbtDose');
  const icbtFractions = watch('icbtFractions');
  const treatmentStartDate = watch('treatmentStartDate');
  const progressionDate = watch('progressionDate');
  const deathDate = watch('deathDate');
  const followUpDate = watch('followUpDate');

  // Auto-calculation logic
  useEffect(() => {
    if (bloodPressure) {
      const parts = bloodPressure.split('/');
      if (parts.length === 2) {
        const s = Number(parts[0]);
        const d = Number(parts[1]);
        if (!isNaN(s) && !isNaN(d)) {
          if (s >= 180 || d >= 110) setValue('hypertensionGrade', '3级(重度)');
          else if (s >= 160 || d >= 100) setValue('hypertensionGrade', '2级(中度)');
          else if (s >= 140 || d >= 90) setValue('hypertensionGrade', '1级(轻度)');
          else if (s > 0 && d > 0) setValue('hypertensionGrade', '无');
          else setValue('hypertensionGrade', undefined);
          return;
        }
      }
    }
    setValue('hypertensionGrade', undefined);
  }, [bloodPressure, setValue]);

  useEffect(() => {
    if (age && Number(age) > 0) {
      const a = Number(age);
      if (a < 40) setValue('ageGroup', '<40');
      else if (a <= 60) setValue('ageGroup', '40-60');
      else setValue('ageGroup', '>60');
    } else {
      setValue('ageGroup', undefined);
    }
  }, [age, setValue]);

  useEffect(() => {
    if (height && weight && Number(height) > 0 && Number(weight) > 0) {
      const h = Number(height) / 100;
      const w = Number(weight);
      const bmi = Number((w / (h * h)).toFixed(2));
      setValue('bmi', bmi);
      setValue('bmiGroup', bmi < 24 ? '<24' : '>=24');
    } else {
      setValue('bmi', undefined);
      setValue('bmiGroup', undefined);
    }
  }, [height, weight, setValue]);

  useEffect(() => {
    if (figo2018) {
      if (figo2018.startsWith('IA') || figo2018.startsWith('IB')) setValue('figoSummary', 'I');
      else if (figo2018.startsWith('IIA') || figo2018.startsWith('IIB')) setValue('figoSummary', 'II');
      else if (figo2018.startsWith('IIIA') || figo2018.startsWith('IIIB') || figo2018.startsWith('IIIC')) setValue('figoSummary', 'III');
      else if (figo2018.startsWith('IVA') || figo2018.startsWith('IVB')) setValue('figoSummary', 'IV');
    } else {
      setValue('figoSummary', '');
    }
  }, [figo2018, setValue]);

  useEffect(() => {
    if (neutrophilCount && lymphocyteCount && plateletCount && monocyteCount &&
        Number(neutrophilCount) > 0 && Number(lymphocyteCount) > 0 && 
        Number(plateletCount) > 0 && Number(monocyteCount) > 0) {
      const n = Number(neutrophilCount);
      const l = Number(lymphocyteCount);
      const p = Number(plateletCount);
      const m = Number(monocyteCount);
      setValue('nlr', Number((n / l).toFixed(2)));
      setValue('plr', Number((p / l).toFixed(2)));
      setValue('lmr', Number((l / m).toFixed(2)));
    } else {
      setValue('nlr', undefined);
      setValue('plr', undefined);
      setValue('lmr', undefined);
    }
  }, [neutrophilCount, lymphocyteCount, plateletCount, monocyteCount, setValue]);

  useEffect(() => {
    if (preTreatmentHb && Number(preTreatmentHb) > 0) {
      setValue('hbGroup', Number(preTreatmentHb) < 100 ? '<10' : '>=10');
    } else {
      setValue('hbGroup', undefined);
    }
  }, [preTreatmentHb, setValue]);

  useEffect(() => {
    if (scca !== undefined && scca !== null && Number(scca) >= 0) {
      const s = Number(scca);
      if (s < 1.5) setValue('sccaGroup', '<1.5');
      else if (s <= 5) setValue('sccaGroup', '1.5-5');
      else setValue('sccaGroup', '>5');
    } else {
      setValue('sccaGroup', undefined);
    }
  }, [scca, setValue]);

  useEffect(() => {
    if (ebrtDose && Number(ebrtDose) > 0) {
      setValue('ebrtDoseGroup', Number(ebrtDose) < 50.4 ? '<50.4' : '>=50.4');
    } else {
      setValue('ebrtDoseGroup', undefined);
    }
  }, [ebrtDose, setValue]);

  useEffect(() => {
    if (ebrtDose && icbtDose && icbtFractions && 
        Number(ebrtDose) > 0 && Number(icbtDose) > 0 && Number(icbtFractions) > 0) {
      const e = Number(ebrtDose);
      const i = Number(icbtDose);
      const f = Number(icbtFractions);
      const dosePerFraction = i / f;
      
      const eqd2_val = e + i * ((dosePerFraction + 10) / (2 + 10));
      const eqd4_val = e + i * ((dosePerFraction + 10) / (4 + 10));
      
      setValue('eqd2', Number(eqd2_val.toFixed(2)));
      setValue('eqd4', Number(eqd4_val.toFixed(2)));
    } else {
      setValue('eqd2', undefined);
      setValue('eqd4', undefined);
    }
  }, [ebrtDose, icbtDose, icbtFractions, setValue]);

  useEffect(() => {
    if (tumorMaxDiameter && Number(tumorMaxDiameter) > 0) {
      setValue('tumorMaxDiameterGroup', Number(tumorMaxDiameter) < 4 ? '<4' : '>=4');
    } else {
      setValue('tumorMaxDiameterGroup', undefined);
    }
  }, [tumorMaxDiameter, setValue]);

  useEffect(() => {
    if (treatmentStartDate) {
      const start = new Date(treatmentStartDate);
      
      // Calculate PFS
      if (progressionDate) {
        const prog = new Date(progressionDate);
        const diffTime = Math.abs(prog.getTime() - start.getTime());
        const diffMonths = diffTime / (1000 * 60 * 60 * 24 * 30.44);
        setValue('pfsMonths', Number(diffMonths.toFixed(1)));
      } else {
        setValue('pfsMonths', undefined);
      }

      // Calculate OS
      if (deathDate) {
        const death = new Date(deathDate);
        const diffTime = Math.abs(death.getTime() - start.getTime());
        const diffMonths = diffTime / (1000 * 60 * 60 * 24 * 30.44);
        setValue('osMonths', Number(diffMonths.toFixed(1)));
      } else if (followUpDate) {
        const followUp = new Date(followUpDate);
        const diffTime = Math.abs(followUp.getTime() - start.getTime());
        const diffMonths = diffTime / (1000 * 60 * 60 * 24 * 30.44);
        setValue('osMonths', Number(diffMonths.toFixed(1)));
      } else {
        setValue('osMonths', undefined);
      }
    } else {
      setValue('pfsMonths', undefined);
      setValue('osMonths', undefined);
    }
  }, [treatmentStartDate, progressionDate, deathDate, followUpDate, setValue]);

  useEffect(() => {
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Firebase connection test failed: client is offline.");
        }
      }
    };
    testConnection();

    if (id && user) {
      const fetchPatient = async () => {
        try {
          const docRef = doc(db, 'patients', id);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data() as Patient;
            reset(data);
          }
        } catch (error) {
          setFormError('获取患者信息失败，权限不足或数据不存在。');
          try {
            handleFirestoreError(error, OperationType.GET, `patients/${id}`);
          } catch (err) {}
        } finally {
          setLoading(false);
        }
      };
      fetchPatient();
    } else if (id && !user) {
      setLoading(false);
    } else if (!id) {
      setLoading(false);
    }
  }, [id, user, reset]);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'zh-CN';

      recognitionRef.current.onresult = (event: any) => {
        let finalTranscript = '';
        let interimTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }
        
        if (finalTranscript) {
          transcriptRef.current += finalTranscript;
        }
        
        const info = activeFieldInfoRef.current;
        if (info) {
           const displayValue = info.initialValue + (info.initialValue ? ' ' : '') + transcriptRef.current + interimTranscript;
           setValue(info.name as any, displayValue, { shouldValidate: true, shouldDirty: true });
        }
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        if (event.error !== 'no-speech') {
            setRecordingField(null);
            recordingFieldRef.current = null;
        }
      };

      recognitionRef.current.onend = () => {
        if (recordingFieldRef.current) {
          finishRecordingRef.current();
        }
      };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setValue]);

  const toggleRecording = (fieldName: string, label: string, options?: string[]) => {
    if (recordingField === fieldName) {
      recognitionRef.current?.stop();
      finishRecording();
    } else {
      if (!recognitionRef.current) {
        setFormError("您的浏览器不支持语音识别，请直接在文本框中输入。");
        return;
      }
      try {
        recognitionRef.current.stop();
      } catch (e) {}
      
      setTimeout(() => {
        try {
          transcriptRef.current = '';
          activeFieldInfoRef.current = {
            name: fieldName,
            label,
            options,
            initialValue: getValues(fieldName as any) || ''
          };
          recordingFieldRef.current = fieldName;
          recognitionRef.current.start();
          setRecordingField(fieldName);
        } catch (e) {
          console.error("Failed to start recording:", e);
        }
      }, 100);
    }
  };

  const toggleSectionRecording = (sectionId: string, title: string, fields: any[]) => {
    if (recordingSection === sectionId) {
      recognitionRef.current?.stop();
      finishSectionRecording();
    } else {
      if (!recognitionRef.current) {
        setFormError("您的浏览器不支持语音识别，请直接在文本框中输入。");
        return;
      }
      try {
        recognitionRef.current.stop();
      } catch (e) {}
      
      setTimeout(() => {
        try {
          transcriptRef.current = '';
          activeSectionInfoRef.current = {
            id: sectionId,
            title,
            fields
          };
          recordingSectionRef.current = sectionId;
          recognitionRef.current.start();
          setRecordingSection(sectionId);
        } catch (e) {
          console.error("Failed to start section recording:", e);
        }
      }, 100);
    }
  };

  const clearSection = (fields: any[]) => {
    fields.forEach(field => {
      setValue(field.name, undefined);
    });
  };

  const handleFileUpload = async (file: File, patientNameOrId: string) => {
    console.log("Starting file upload for patient:", patientNameOrId);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      console.log("File read complete");
      const data = evt.target?.result;
      const workbook = read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const json = utils.sheet_to_json(worksheet);
      console.log("Excel data parsed:", json);
    };
    reader.onerror = (err) => {
      console.error("FileReader error:", err);
    };
    reader.readAsArrayBuffer(file);
  };

  const sanitizeData = (data: any) => {
    const sanitized = { ...data };
    Object.keys(sanitized).forEach((key) => {
      if (sanitized[key] === undefined) {
        delete sanitized[key];
      }
    });
    return sanitized;
  };

  const onSubmit = async (data: Patient) => {
    if (!user) return;
    
    setFormError(null);
    if (!data.name || data.name.trim() === '') {
      setFormError('请输入患者姓名');
      return;
    }

    setSaving(true);
    try {
      const sanitizedData = sanitizeData(data);
      
      // Ensure numeric fields are actually numbers
      const numericFields = [
        'age', 'height', 'weight', 'bmi', 'tumorMaxDiameter', 
        'rbcCount', 'wbcCount', 'plateletCount', 'lymphocyteCount', 
        'neutrophilCount', 'monocyteCount', 'preTreatmentHb', 'scca', 
        'nlr', 'plr', 'lmr', 'ebrtDose', 'icbtDose', 'eqd2', 'eqd4', 
        'ccrtDuration', 'chemoCycles', 'totalChemoDose', 
        'pfsMonths', 'osMonths', 'followUpTime', 'icbtFractions'
      ];

      const finalData: any = { ...sanitizedData };
      
      // Remove empty strings and convert numeric fields
      Object.keys(finalData).forEach(key => {
        if (finalData[key] === '' || finalData[key] === null || finalData[key] === undefined) {
          delete finalData[key];
        } else if (numericFields.includes(key)) {
          const val = Number(finalData[key]);
          if (!isNaN(val)) {
            finalData[key] = val;
          } else {
            // If it's a numeric field but not a valid number, delete it to prevent Firestore errors
            // except for 'age' which can be a string
            if (key !== 'age') {
              delete finalData[key];
            }
          }
        }
      });

      const payload: any = {
        ...finalData,
        updatedAt: serverTimestamp(),
      };

      if (id) {
        // Fetch the existing document to ensure we don't overwrite critical fields
        // and to satisfy the security rules which check request.resource.data.createdAt == resource.data.createdAt
        const docRef = doc(db, 'patients', id);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const existingData = docSnap.data();
          
          // Ensure we don't overwrite these fields, but keep them in the payload if they exist
          // to satisfy the `data.keys().hasAll(['name', 'authorUid', 'updatedAt'])` rule
          if (existingData.authorUid !== undefined) {
            payload.authorUid = existingData.authorUid;
          } else {
            payload.authorUid = user.uid; // Fallback for old data
          }
          
          if (existingData.createdAt !== undefined) {
            payload.createdAt = existingData.createdAt;
          } else {
            payload.createdAt = serverTimestamp(); // Fallback for old data
          }
          
          // These are not required by rules but good to preserve
          if (existingData.userId !== undefined) payload.userId = existingData.userId;
          if (existingData.authorEmail !== undefined) payload.authorEmail = existingData.authorEmail;
          if (existingData.authorName !== undefined) payload.authorName = existingData.authorName;
          
          // Clean up any undefined values from payload before sending to Firestore
          Object.keys(payload).forEach(key => {
            if (payload[key] === undefined) {
              delete payload[key];
            }
          });
          
          await updateDoc(docRef, payload);
        } else {
          throw new Error("Patient not found");
        }
      } else {
        // On create, set author info and createdAt
        payload.userId = user.uid;
        payload.authorUid = user.uid;
        payload.authorEmail = user.email || '';
        payload.authorName = user.displayName || user.email?.split('@')[0] || '未知用户';
        payload.createdAt = serverTimestamp();
        
        // Clean up any undefined values from payload before sending to Firestore
        Object.keys(payload).forEach(key => {
          if (payload[key] === undefined) {
            delete payload[key];
          }
        });
        
        await addDoc(collection(db, 'patients'), payload);
      }
      navigate('/');
    } catch (error) {
      try {
        handleFirestoreError(error, id ? OperationType.UPDATE : OperationType.CREATE, id ? `patients/${id}` : 'patients');
      } catch (err: any) {
        setFormError(`保存失败，权限不足或数据格式错误。请检查必填项是否完整。`);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleClear = () => {
    reset({
      customPatientId: '',
      name: '',
      age: undefined,
      gender: '女',
      menstrualStatus: '',
      abortionHistory: '',
      hpvInfection: '',
      phone: '',
      height: undefined,
      weight: undefined,
      bloodPressure: '',
      tnmStaging: '',
      histologyType: '',
      differentiation: '',
      tumorMaxDiameter: undefined,
      parametrialInvasion: '无',
      corpusInvasion: '无',
      vaginalInvasion: '无',
      bladderInvasion: '无',
      rectalInvasion: '无',
      pelvicLN: '无',
      rbcCount: undefined,
      wbcCount: undefined,
      plateletCount: undefined,
      lymphocyteCount: undefined,
      neutrophilCount: undefined,
      monocyteCount: undefined,
      preTreatmentHb: undefined,
      scca: undefined,
      rtTechnology: '',
      ebrtDose: undefined,
      icbtDose: undefined,
      icbtFractions: undefined,
      ccrtDuration: undefined,
      platinumRegimen: '',
      platinumDrug: '',
      cisplatinWeekly: '否',
      chemoCycles: undefined,
      totalChemoDose: undefined,
      treatmentStartDate: '',
      progressionDate: '',
      deathDate: '',
      metastasis: '无',
      metastasisSite: '',
      treatmentResponse: '',
      recurrence: '无',
      recurrenceSite: '',
      pfsMonths: undefined,
      osMonths: undefined,
      survivalStatus: '存活',
      followUpDate: ''
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="p-2 hover:bg-gray-200 rounded-full transition-colors"
            title="返回主界面"
          >
            <ArrowLeft className="w-6 h-6 text-gray-600" />
          </button>
          <h1 className="text-2xl font-bold text-gray-900">
            {id ? '编辑患者信息' : '新增患者录入'}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleClear}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            重置
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-3 space-y-6">
          {formError && (
            <div className="p-4 bg-red-50 text-red-700 rounded-lg border border-red-200">
              {formError}
            </div>
          )}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="flex justify-end gap-3 mb-6">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 font-medium shadow-sm"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {saving ? '保存中...' : '保存信息'}
              </button>
            </div>
            <FormSection title="A. 基本信息" id="section-a" fields={SECTION_A_FIELDS} clearSection={clearSection} toggleSectionRecording={toggleSectionRecording} recordingSection={recordingSection} processingSection={processingSection} handleFileUpload={handleFileUpload} formValues={allFormValues} suppressSound={allSectionsComplete}>
              {SECTION_A_FIELDS.map(field => (
                <FormInput key={field.name} {...field} register={register} toggleRecording={toggleRecording} processingField={processingField} recordingField={recordingField} />
              ))}
            </FormSection>

            <FormSection title="B. 分期与病理" id="section-b" fields={SECTION_B_FIELDS} clearSection={clearSection} toggleSectionRecording={toggleSectionRecording} recordingSection={recordingSection} processingSection={processingSection} handleFileUpload={handleFileUpload} formValues={allFormValues} suppressSound={allSectionsComplete}>
              {SECTION_B_FIELDS.map(field => (
                <FormInput key={field.name} {...field} register={register} toggleRecording={toggleRecording} processingField={processingField} recordingField={recordingField} />
              ))}
            </FormSection>

            <FormSection title="C. 实验室与炎症指标" id="section-c" fields={SECTION_C_FIELDS} clearSection={clearSection} toggleSectionRecording={toggleSectionRecording} recordingSection={recordingSection} processingSection={processingSection} handleFileUpload={handleFileUpload} formValues={allFormValues} suppressSound={allSectionsComplete}>
              {SECTION_C_FIELDS.map(field => (
                <FormInput key={field.name} {...field} register={register} toggleRecording={toggleRecording} processingField={processingField} recordingField={recordingField} />
              ))}
            </FormSection>

            <FormSection title="D. 治疗方案" id="section-d" fields={SECTION_D_FIELDS} clearSection={clearSection} toggleSectionRecording={toggleSectionRecording} recordingSection={recordingSection} processingSection={processingSection} handleFileUpload={handleFileUpload} formValues={allFormValues} suppressSound={allSectionsComplete}>
              {SECTION_D_FIELDS.map(field => (
                <FormInput key={field.name} {...field} register={register} toggleRecording={toggleRecording} processingField={processingField} recordingField={recordingField} />
              ))}
            </FormSection>

            <FormSection title="E. 结局与随访" id="section-e" fields={SECTION_E_FIELDS} clearSection={clearSection} toggleSectionRecording={toggleSectionRecording} recordingSection={recordingSection} processingSection={processingSection} handleFileUpload={handleFileUpload} formValues={allFormValues} suppressSound={allSectionsComplete}>
              {SECTION_E_FIELDS.map(field => (
                <FormInput key={field.name} {...field} register={register} toggleRecording={toggleRecording} processingField={processingField} recordingField={recordingField} />
              ))}
            </FormSection>
          </form>
        </div>

        <div className="space-y-6">
          <div className="sticky top-24 space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4">表单导航</h3>
              <nav className="space-y-1">
                {[
                  { id: 'section-a', label: 'A. 基本信息' },
                  { id: 'section-b', label: 'B. 分期与病理' },
                  { id: 'section-c', label: 'C. 实验室指标' },
                  { id: 'section-d', label: 'D. 治疗方案' },
                  { id: 'section-e', label: 'E. 结局与随访' },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth' })}
                    className="w-full text-left px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50 hover:text-blue-600 transition-colors flex items-center justify-between group"
                  >
                    {item.label}
                    <ChevronDown className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                ))}
              </nav>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
