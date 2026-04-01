import React, { useState, useRef } from 'react';
import { X, Upload, Loader2, CheckCircle, AlertCircle, FileText, Play, Database } from 'lucide-react';
import { pb } from '../lib/pb';
import * as XLSX from 'xlsx';
import * as mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';

// Set worker source for pdfjs
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

interface BatchImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
}

interface FileStatus {
  id: string;
  file: File;
  status: 'pending' | 'processing' | 'success' | 'error';
  message?: string;
  extractedCount?: number;
}

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const base64String = (reader.result as string).split(',')[1];
      resolve(base64String);
    };
    reader.onerror = error => reject(error);
  });
};

const fileToText = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsText(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};

const fileToArrayBuffer = (file: File): Promise<ArrayBuffer> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsArrayBuffer(file);
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = error => reject(error);
  });
};

const extractContent = async (file: File, useDeepSeek: boolean = false): Promise<any> => {
  const ext = file.name.split('.').pop()?.toLowerCase();
  
  if (ext === 'pdf') {
    if (useDeepSeek) {
      // DeepSeek doesn't support images/pdf directly, extract text
      const arrayBuffer = await fileToArrayBuffer(file);
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(' ');
        fullText += `--- 第 ${i} 页 ---\n${pageText}\n\n`;
      }
      return { text: `PDF文件名: ${file.name}\n\n内容:\n${fullText}` };
    } else {
      const base64 = await fileToBase64(file);
      return { inlineData: { data: base64, mimeType: 'application/pdf' } };
    }
  }
  
  if (ext === 'txt' || ext === 'csv') {
    const text = await fileToText(file);
    return { text: `文件名: ${file.name}\n\n内容:\n${text}` };
  }
  
  if (ext === 'xlsx' || ext === 'xls') {
    const arrayBuffer = await fileToArrayBuffer(file);
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    let fullText = '';
    workbook.SheetNames.forEach(sheetName => {
      const csv = XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName]);
      fullText += `表名: ${sheetName}\n${csv}\n\n`;
    });
    return { text: `Excel文件名: ${file.name}\n\n内容:\n${fullText}` };
  }
  
  if (ext === 'docx') {
    const arrayBuffer = await fileToArrayBuffer(file);
    const result = await mammoth.extractRawText({ arrayBuffer });
    return { text: `Word文件名: ${file.name}\n\n内容:\n${result.value}` };
  }
  
  if (ext === 'dcm' || ext === 'dicom' || ext === 'nii' || file.name.toLowerCase().endsWith('.nii.gz')) {
     return { text: `影像文件名: ${file.name}\n\n内容:\n这是一个医学影像文件，请将其作为患者的影像资料记录。` };
  }
  
  throw new Error(`暂不支持直接解析 .${ext} 格式，请转换为 PDF, DOCX 或 XLSX 后重试。`);
};

const calculateDerivedFields = (data: any) => {
  const result = { ...data };
  if (!result.gender) result.gender = '女';

  const h = typeof result.height === 'string' ? parseFloat(result.height) : result.height;
  const w = typeof result.weight === 'string' ? parseFloat(result.weight) : result.weight;

  if (h && w && h > 0) {
    const heightInMeters = h > 3 ? h / 100 : h;
    result.bmi = Number((w / (heightInMeters * heightInMeters)).toFixed(2));
    result.bmiGroup = result.bmi < 24 ? '<24' : '>=24';
  }
  
  const a = typeof result.age === 'string' ? parseFloat(result.age) : result.age;
  if (a) {
    if (a < 40) result.ageGroup = '<40';
    else if (a <= 60) result.ageGroup = '40-60';
    else result.ageGroup = '>60';
  }
  
  const n = typeof result.neutrophilCount === 'string' ? parseFloat(result.neutrophilCount) : result.neutrophilCount;
  const l = typeof result.lymphocyteCount === 'string' ? parseFloat(result.lymphocyteCount) : result.lymphocyteCount;
  const p = typeof result.plateletCount === 'string' ? parseFloat(result.plateletCount) : result.plateletCount;
  const m = typeof result.monocyteCount === 'string' ? parseFloat(result.monocyteCount) : result.monocyteCount;

  if (n && l && l > 0) {
    result.nlr = Number((n / l).toFixed(2));
  }
  if (p && l && l > 0) {
    result.plr = Number((p / l).toFixed(2));
  }
  if (l && m && m > 0) {
    result.lmr = Number((l / m).toFixed(2));
  }
  
  const hb = typeof result.preTreatmentHb === 'string' ? parseFloat(result.preTreatmentHb) : result.preTreatmentHb;
  if (hb) {
    result.hbGroup = hb >= 10 ? '>=10' : '<10';
  }
  
  const scca = typeof result.scca === 'string' ? parseFloat(result.scca) : result.scca;
  if (scca) {
    if (scca < 1.5) result.sccaGroup = '<1.5';
    else if (scca <= 5) result.sccaGroup = '1.5-5';
    else result.sccaGroup = '>5';
  }
  
  const ebrt = typeof result.ebrtDose === 'string' ? parseFloat(result.ebrtDose) : result.ebrtDose;
  if (ebrt) {
    result.ebrtDoseGroup = ebrt < 50.4 ? '<50.4' : '>=50.4';
  }
  
  const icbt = typeof result.icbtDose === 'string' ? parseFloat(result.icbtDose) : result.icbtDose;
  const fractions = typeof result.icbtFractions === 'string' ? parseFloat(result.icbtFractions) : result.icbtFractions;
  
  if (ebrt && icbt && fractions && fractions > 0) {
    const icbtDosePerFraction = icbt / fractions;
    const icbtEqd2 = icbt * (icbtDosePerFraction + 10) / 12;
    const totalEqd2 = ebrt + icbtEqd2;
    result.eqd2 = Number(totalEqd2.toFixed(2));
    
    const icbtEqd4 = icbt * (icbtDosePerFraction + 4) / (2 + 4);
    const ebrtEqd4 = ebrt * (2 + 4) / (2 + 4);
    const totalEqd4 = ebrtEqd4 + icbtEqd4;
    result.eqd4 = Number(totalEqd4.toFixed(2));
  }
  
  const d = typeof result.tumorMaxDiameter === 'string' ? parseFloat(result.tumorMaxDiameter) : result.tumorMaxDiameter;
  if (d) {
    result.tumorMaxDiameterGroup = d < 4 ? '<4' : '>=4';
  }
  
  if (result.figo2018) {
    const s = typeof result.figo2018 === 'string' ? result.figo2018 : (Array.isArray(result.figo2018) ? result.figo2018[0] : '');
    if (s) {
      if (s.startsWith('I') && !s.startsWith('II') && !s.startsWith('IV')) result.figoSummary = 'I';
      else if (s.startsWith('II') && !s.startsWith('III')) result.figoSummary = 'II';
      else if (s.startsWith('III')) result.figoSummary = 'III';
      else if (s.startsWith('IV')) result.figoSummary = 'IV';
    }
  }
  
  const sys = typeof result.systolicBP === 'string' ? parseFloat(result.systolicBP) : result.systolicBP;
  const dia = typeof result.diastolicBP === 'string' ? parseFloat(result.diastolicBP) : result.diastolicBP;
  if (sys || dia) {
    const s = sys || 0;
    const d = dia || 0;
    if (s >= 180 || d >= 110) result.hypertensionGrade = '3级(重度)';
    else if (s >= 160 || d >= 100) result.hypertensionGrade = '2级(中度)';
    else if (s >= 140 || d >= 90) result.hypertensionGrade = '1级(轻度)';
    else if (s > 0 && d > 0) result.hypertensionGrade = '无';
  }
  return result;
};

const cleanPayload = (payload: any) => {
  Object.keys(payload).forEach(key => {
    if (Number.isNaN(payload[key]) || payload[key] === '' || payload[key] === undefined || payload[key] === null) {
      delete payload[key];
    }
  });
  return payload;
};

export default function BatchImportModal({ isOpen, onClose, user }: BatchImportModalProps) {
  const [files, setFiles] = useState<FileStatus[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [overallProgress, setOverallProgress] = useState(0);
  const [overallStatus, setOverallStatus] = useState('');
  const [stats, setStats] = useState({ saved: 0 });
  const [confirmClose, setConfirmClose] = useState(false);
  const [aiInstruction, setAiInstruction] = useState(`请严格按当前表单字段提取患者信息，并遵守以下规则：

【总原则】
1. 只提取本次上传文件中同一位患者的信息，先用“姓名”进行匹配。
2. 以“方便录入、尽量正确填写”为优先目标：只要病历、Excel、影像描述、妇科查体、TNM分期、治疗记录中存在足够依据，就允许进行结构化映射和合理推断，不要求原文必须与表单字段完全同名。
3. 不要凭空臆造；但只要有明确或高度支持性的间接证据，就尽量填写。
4. 数值型字段必须谨慎：只有原文明确给出数值，或可由“明确单次剂量 × 明确次数”直接计算时，才能填写具体数字。
5. 不允许为了完整性而填写“临床均值”“经验值”“常见值”“默认值”到数值型字段。
6. 若直接证据和间接证据都没有：
   - 对普通文本/选择型字段：统一填写“未知”或“不详”。
   - 对数值型字段：必须留空，绝对不能填 0 或任何数字。
7. “影像描述”和“影像诊断”这两个字段不要根据内容重新生成，也不要覆盖原有内容；这两个字段保留系统原内容或人工已填写内容，不参与本次提取。
8. F. 结局与随访 整个部分本次不提取，全部留空。

【字段专项逻辑】

一、基本信息
1. 患者ID (自定义)：留空，由用户手动填写。
2. 姓名、年龄、性别：按病案首页或出院记录提取。
3. 电话号码：优先提取病案首页“现住址/电话”栏中的患者本人电话；不要优先提取联系人电话；若分不清本人电话和联系人电话，则留空。
4. 身高、体重、收缩压、舒张压：务必优先从【护理评估单】或【入院评估单】中提取明确数值。如果病案首页和其他地方有冲突，以护理评估单为准（如体重56.5kg，血压120/80mmHg等）。
5. 月经状态、流产史、HPV感染：根据病历描述提取。

二、分期与病理
1. FIGO2018分期：首先根据病历写出的 FIGO 分期填写，若无根据 TNM 或影像描述进行推断（如 pT2 N1 M0 可推断为 IIIC1）。
2. TNM分期：提取明确写出的 TNM 分期（如 pT2N1M0）。
3. 组织学类型：务必仔细查看病案首页的【病理诊断】部分，明确提取“鳞状细胞癌”、“腺癌”等具体类型。
4. 肿瘤分化程度：提取“高分化”、“中分化”、“低分化”等。
5. 肿瘤最大径：提取明确最大径；若原文写“约4-5cm”，可取 5 cm；若仅描述“大”“较大”则留空。

三、影像/肿瘤负荷
1. 宫旁浸润：明确写“宫旁(+)”“宫旁受侵”“宫旁浸润”时填“有”；明确写“宫旁(-)”时填“无”；若左右侧一阳一阴，则按“有”填写。
2. 宫体浸润：若影像描述中出现“病灶累及宫颈基质及肌层”、“宫体受累”等字眼，必须推断并填写为“有”。
3. 盆腔淋巴结转移：若病案首页或分期中出现“N1”或“N2”，必须推断并填写为“有”。
4. 膀胱受侵、直肠受侵：只有病历明确提到时才填写。
5. 阴道受侵范围：只有明确写出“阴道上1/3、中1/3、下1/3、上段、中段、下段受侵”等分段范围时才填写；“阴道通畅”“外阴正常”等描述不等于阴道受侵范围，必须留空。

四、实验室与炎症
1. 红细胞计数、白细胞计数、血小板计数、淋巴细胞计数、中性粒细胞计数、单核细胞计数、治疗前血红蛋白、SCCA：
   优先从 检验报告单、治疗前最近一次化验结果中提取。
2. 若同一指标有多次结果，只取“治疗前/放化疗前/入院后治疗开始前最近一次”结果。
3. 不要提取治疗后、出院前、骨髓抑制后复查的异常值作为基线值。
4. 若文件中没有明确检验值，留空。

五、治疗与剂量
1. 放疗技术：务必仔细查看病案首页（特别是第2页或治疗经过），明确写 VMAT、IMRT、容积弧形调强放射治疗 等时，填写对应标准名称（如“容积弧形调强放射治疗 [VMAT]”提取为“VMAT”）。
2. 外照射总剂量EBRT：提取总剂量数值；例如“50.4Gy/28F”填写 50.4。
3. 内照射总剂量ICBT：必须优先搜索“内照射、后装、插植、腔内、A点、HDR、Gy”等关键词，提取明确写出的总剂量（Gy）。
4. 内照射次数：提取内照射治疗的次数。
5. 等效生物剂量EQD2/EQD4：若病历中有明确计算结果，则提取；否则留空，系统会自动计算。
6. 同步放化疗疗程(天)：只有在病历中能明确得到同步放化疗起止日期或明确治疗天数时才填写；若仅有住院天数、疗程次数或周期数，不能直接当作同步放化疗疗程(天)，应留空。
7. 含铂化疗方案：优先提取明确方案名称，如“单药含铂”“TP方案”“顺铂周疗”“洛铂单药”等；若只知道用了某个药但看不出方案名称，可根据原文最接近地填写，但不要编造未出现的方案。
8. 含铂药物：明确提取顺铂、洛铂、卡铂等具体药名。
9. 同步顺铂周疗：只有原文明确写“顺铂周疗/每周顺铂”时才填写；若使用的是洛铂或其他药物，或未写“周疗”，则留空。
10. 同步化疗次数：明确写“6周期”“6次”等时可填写次数。
11. 化疗总剂量：必须提取病历中明确写出的总剂量；若只有次数、没有每次剂量或总剂量，不要计算，直接留空。

【自动计算字段】
以下字段由系统自动计算，不要填写，留空：
年龄分组、BMI、BMI分组、高血压分级、FIGO分期汇总、肿瘤最大径分组、血红蛋白分组、SCCA分组、NLR、PLR、LMR、外照射总剂量分组、等效生物剂量EQD2、等效生物剂量EQD4。

【特别强调】
1. 先扫住院病案首页，再扫出院记录，再扫检验单/Excel。
2. 电话号码、放疗技术、EBRT、ICBT、含铂药物、同步化疗次数是重点字段，必须重点搜索。
3. 对“阴道受侵范围”“ICBT总剂量”“同步放化疗疗程(天)”“化疗总剂量”要求最严格：没有明确值就留空。
4. 不要修改“影像描述”和“影像诊断”。
5. 不要填写 F. 结局与随访。`);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const batchAbortController = useRef<AbortController | null>(null);

  if (!isOpen) return null;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files).map(file => ({
        id: Math.random().toString(36).substring(7),
        file,
        status: 'pending' as const
      }));
      setFiles(prev => [...prev, ...newFiles]);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (id: string) => {
    if (isProcessing) return;
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const handleStart = async () => {
    if (files.length === 0) return;
    setIsProcessing(true);
    setOverallProgress(0);
    setOverallStatus('准备开始批量导入...');
    let totalSaved = stats.saved;

    // Create new controller for this batch
    batchAbortController.current = new AbortController();
    const signal = batchAbortController.current.signal;

    try {
      for (let i = 0; i < files.length; i++) {
        if (signal.aborted) throw new Error("CANCELED");
        if (files[i].status !== 'pending' && files[i].status !== 'error') continue;

        setOverallStatus(`正在处理第 ${i + 1} 个文件 (共 ${files.length} 个)...`);
        setOverallProgress(Math.round((i / files.length) * 100));

        setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'processing', message: '正在解析文档内容...' } : f));

        try {
          const deepseekApiKey = localStorage.getItem('deepseek_api_key');
          const geminiApiKey = localStorage.getItem('gemini_api_key');
          const contentPayload = await extractContent(files[i].file, !!deepseekApiKey);

          if (signal.aborted) throw new Error("CANCELED");
          setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'processing', message: '正在请求 AI 分析...' } : f));

          let promptText = `你是一个专业的医疗数据提取助手。请从提供的病历资料（可能是单个患者的详细病历，也可能是包含多个患者的Excel/CSV表格）中提取结构化数据。
                请自动过滤掉没有用的杂乱信息，只提取符合要求的有用信息。对于数值类型只提取数字。`;
          
          if (aiInstruction.trim()) {
            promptText += `\n\n【用户附加指令】：${aiInstruction.trim()}`;
          }

          const response = await fetch('/api/extract', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [contentPayload],
              promptText,
              deepseekApiKey,
              geminiApiKey,
              isBatch: true
            }),
            signal // Pass the signal to fetch
          });

          if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || "提取失败");
          }

          if (signal.aborted) throw new Error("CANCELED");
          setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'processing', message: '正在保存数据...' } : f));

          const extractedArray = await response.json();
          if (!Array.isArray(extractedArray)) throw new Error("AI 未返回有效的数组格式");

          let savedCount = 0;
          for (const item of extractedArray) {
            if (signal.aborted) throw new Error("CANCELED");
            // Skip completely empty objects
            if (Object.keys(item).length === 0) continue;

            let processed = calculateDerivedFields(item);
            if (!processed.name) processed.name = `批量导入患者`;
            
            const authorUid   = user?.id    || '';
            const authorEmail = user?.email  || '';
            const authorName  = user?.name   || user?.email?.split('@')[0] || '未知用户';

            processed = cleanPayload({ ...processed, authorUid, authorEmail, authorName, userId: authorUid });

            await pb.collection('patients').create({
              name:        processed.name || '批量导入患者',
              authorUid,
              authorEmail,
              authorName,
              patientData: processed,
            });
            savedCount++;
            totalSaved++;
          }

          setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'success', extractedCount: savedCount, message: `成功导入 ${savedCount} 条记录` } : f));
          setStats(s => ({ ...s, saved: totalSaved }));

        } catch (error: any) {
          if (error.name === 'AbortError' || error.message === "CANCELED") {
            setFiles(prev => prev.map((f, idx) => idx === i && f.status === 'processing' ? { ...f, status: 'pending', message: "已取消" } : f));
            throw error; // Re-throw to catch in outer block
          }
          console.error("Batch processing error:", error);
          setFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'error', message: error.message || "解析失败" } : f));
        }
      }

      setOverallProgress(100);
      setOverallStatus(`批量导入完成！共处理 ${files.length} 个文件，成功保存 ${totalSaved} 条记录。`);
    } catch (error: any) {
      if (error.name === 'AbortError' || error.message === "CANCELED") {
        setOverallStatus('批量导入已取消');
      } else {
        setOverallStatus('批量导入过程中发生错误');
      }
    } finally {
      setIsProcessing(false);
      batchAbortController.current = null;
    }
  };

  const cancelBatchExtract = () => {
    if (batchAbortController.current) {
      batchAbortController.current.abort();
    }
  };

  const handleClose = () => {
    if (isProcessing) {
      setConfirmClose(true);
      return;
    }
    onClose();
    // Reset state after close animation
    setTimeout(() => {
      setFiles([]);
      setStats({ saved: 0 });
    }, 300);
  };

  const confirmCloseModal = () => {
    setConfirmClose(false);
    cancelBatchExtract();
    onClose();
    setTimeout(() => {
      setFiles([]);
      setStats({ saved: 0 });
    }, 300);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">批量 AI 导入</h2>
              <p className="text-xs text-gray-500 mt-0.5">支持上传多个 Excel / Word / PDF 文件，AI 将自动清洗并提取有效数据</p>
            </div>
          </div>
          <button onClick={handleClose} disabled={isProcessing} className="text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-gray-100 transition-colors disabled:opacity-50">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Overall Progress */}
          {isProcessing && (
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-100 shadow-sm mb-6">
              <div className="flex justify-between text-sm text-blue-800 mb-2 font-medium">
                <span>{overallStatus}</span>
                <div className="flex items-center gap-2">
                  <span>{overallProgress}%</span>
                  <button 
                    type="button"
                    onClick={cancelBatchExtract}
                    className="text-red-600 hover:text-red-800 font-bold px-1 rounded hover:bg-red-50 transition-colors"
                  >
                    取消
                  </button>
                </div>
              </div>
              <div className="w-full bg-blue-200 rounded-full h-2.5">
                <div
                  className="bg-blue-600 h-2.5 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${overallProgress}%` }}
                ></div>
              </div>
            </div>
          )}

          {/* Upload Zone */}
          <div className="relative">
            <input 
              type="file" 
              multiple
              accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.dcm,.dicom,.nii,.nii.gz" 
              className="hidden" 
              ref={fileInputRef}
              onChange={handleFileSelect}
              disabled={isProcessing}
            />
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
              className="w-full flex flex-col items-center justify-center py-8 border-2 border-dashed border-blue-200 rounded-xl bg-blue-50/50 hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              <div className="p-3 bg-white rounded-full shadow-sm mb-3 group-hover:scale-110 transition-transform">
                <Upload className="w-6 h-6 text-blue-500" />
              </div>
              <span className="text-sm font-medium text-blue-800">点击选择多个文件</span>
              <span className="text-xs text-blue-500/80 mt-1">支持批量选择 Excel, Word, PDF, DICOM, NIfTI 等格式</span>
            </button>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">提示词</label>
            <textarea
              value={aiInstruction}
              onChange={(e) => setAiInstruction(e.target.value)}
              placeholder="在此输入 AI 提取指令..."
              className="w-full h-48 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm resize-y"
              disabled={isProcessing}
            />
          </div>

          {/* Stats */}
          {stats.saved > 0 && (
            <div className="bg-green-50 border border-green-100 rounded-lg p-4 flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span className="text-sm font-medium text-green-800">
                已成功提取并保存 <strong>{stats.saved}</strong> 条患者记录到数据库
              </span>
            </div>
          )}

          {/* File List */}
          {files.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center justify-between">
                <span>待处理文件列表 ({files.length})</span>
              </h3>
              <div className="space-y-2">
                {files.map((f) => (
                  <div key={f.id} className={`flex items-center justify-between p-3 rounded-lg border ${
                    f.status === 'success' ? 'bg-green-50 border-green-100' :
                    f.status === 'error' ? 'bg-red-50 border-red-100' :
                    f.status === 'processing' ? 'bg-blue-50 border-blue-100' :
                    'bg-white border-gray-200'
                  }`}>
                    <div className="flex items-center gap-3 overflow-hidden">
                      <FileText className={`w-5 h-5 flex-shrink-0 ${
                        f.status === 'success' ? 'text-green-500' :
                        f.status === 'error' ? 'text-red-500' :
                        f.status === 'processing' ? 'text-blue-500' :
                        'text-gray-400'
                      }`} />
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-medium text-gray-900 truncate">{f.file.name}</span>
                        {f.message && (
                          <span className={`text-xs truncate ${
                            f.status === 'success' ? 'text-green-600' :
                            f.status === 'error' ? 'text-red-600' :
                            'text-blue-600'
                          }`}>{f.message}</span>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                      {f.status === 'pending' && (
                        <button onClick={() => removeFile(f.id)} disabled={isProcessing} className="text-gray-400 hover:text-red-500 p-1">
                          <X className="w-4 h-4" />
                        </button>
                      )}
                      {f.status === 'processing' && <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />}
                      {f.status === 'success' && <CheckCircle className="w-4 h-4 text-green-500" />}
                      {f.status === 'error' && <AlertCircle className="w-4 h-4 text-red-500" />}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
          <button 
            onClick={handleClose}
            disabled={isProcessing}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            关闭
          </button>
          <button 
            onClick={handleStart}
            disabled={isProcessing || files.length === 0 || files.every(f => f.status === 'success')}
            className="flex items-center gap-2 px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:bg-blue-400 transition-colors shadow-sm"
          >
            {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {isProcessing ? '正在批量解析...' : '开始批量导入'}
          </button>
        </div>

      </div>

      {confirmClose && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">确认关闭</h3>
            <p className="text-gray-600 mb-6">正在处理中，确定要关闭吗？未处理的文件将被取消。</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmClose(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                onClick={confirmCloseModal}
                className="px-4 py-2 text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
              >
                确认关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
