import { useEffect, useRef, useState } from 'react';
import { pb, toPatient } from '../lib/pb';
import { Patient } from '../types';
import { Link } from 'react-router-dom';
import { Plus, Download, LogOut, Trash2, Edit, Database, Settings, X, Users, AlertCircle, MessageSquare, Pencil, Trophy } from 'lucide-react';
import { DeleteConfirmationModal } from '../components/DeleteConfirmationModal';
import { format } from 'date-fns';
import Papa from 'papaparse';

export default function Dashboard({ user, userData, chatUnread = 0 }: { user: any, userData?: any, chatUnread?: number }) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [patientToDelete, setPatientToDelete] = useState<{ id: string, authorUid: string } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [deepseekKey, setDeepseekKey] = useState(localStorage.getItem('deepseek_api_key') || '');
  const [geminiKey, setGeminiKey] = useState(localStorage.getItem('gemini_api_key') || '');
  const [testing, setTesting] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);
  const [showNicknameModal, setShowNicknameModal] = useState(false);
  const [nicknameInput, setNicknameInput] = useState('');
  const [displayName, setDisplayName] = useState(user?.name || '');
  const [avatarPreview, setAvatarPreview] = useState<string>(user?.avatarUrl || '');
  const [savingProfile, setSavingProfile] = useState(false);
  const avatarFileRef = useRef<HTMLInputElement>(null);
  const [milestoneAlert, setMilestoneAlert] = useState<{ count: number; reward: string } | null>(null);

  const MILESTONES: { count: number; reward: string }[] = [
    { count: 3, reward: '🧋 喜茶' },
    { count: 10, reward: '🍜 李先生牛肉面单人餐' },
    { count: 20, reward: '🍗 肯德基开工吃堡单人餐' },
    { count: 30, reward: '🥖 赛百味金枪鱼双拼三明治' },
    { count: 50, reward: '🥟 喜家德西芹水饺单人餐' },
    { count: 100, reward: '🍲 熊喵来了春季宴请火锅双人餐' },
    { count: 150, reward: '🥩 安小胖韩国烤肉2-3人餐' },
  ];

  const playVictorySound = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.12);
        gain.gain.setValueAtTime(0.3, ctx.currentTime + i * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 0.3);
        osc.start(ctx.currentTime + i * 0.12);
        osc.stop(ctx.currentTime + i * 0.12 + 0.3);
      });
    } catch { /* ignore */ }
  };

  useEffect(() => {
    setDisplayName(user?.name || '');
    setAvatarPreview(user?.avatarUrl || '');
  }, [user?.name, user?.avatarUrl]);

  const showToast = (text: string, type: 'success' | 'error') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleTestKey = async () => {
    setTesting(true);
    try {
      const response = await fetch('/api/test-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ geminiApiKey: geminiKey })
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "测试失败");
      }
      showToast('API Key 连接成功！', 'success');
    } catch (error: any) {
      showToast(`API Key 测试失败: ${error.message}`, 'error');
    } finally {
      setTesting(false);
    }
  };

  const handleSaveSettings = () => {
    localStorage.setItem('deepseek_api_key', deepseekKey);
    localStorage.setItem('gemini_api_key', geminiKey);
    setShowSettingsModal(false);
    showToast('设置已保存', 'success');
  };

  const handleOpenNickname = () => {
    setNicknameInput(displayName || '');
    setAvatarPreview(user?.avatarUrl || '');
    setShowNicknameModal(true);
  };

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const size = 100;
          const canvas = document.createElement('canvas');
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext('2d')!;
          const scale = Math.max(size / img.width, size / img.height);
          const w = img.width * scale;
          const h = img.height * scale;
          ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.75));
        };
        img.onerror = reject;
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImage(file);
      setAvatarPreview(compressed);
    } catch {
      showToast('图片处理失败', 'error');
    }
  };

  const handleSaveNickname = async () => {
    setSavingProfile(true);
    try {
      await pb.collection('users').update(user.id, {
        name: nicknameInput.trim(),
        avatarUrl: avatarPreview,
      });
      await pb.collection('users').authRefresh();
      setDisplayName(nicknameInput.trim());
      setShowNicknameModal(false);
      showToast('个人资料已保存', 'success');
    } catch (err) {
      showToast('保存失败，请重试', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  // Load patients + subscribe to realtime changes
  useEffect(() => {
    let unsubFn: (() => void) | null = null;

    const fetchPatients = async () => {
      try {
        const records = await pb.collection('patients').getFullList({ sort: '-updated' });
        setPatients(records.map(toPatient) as any);
      } catch (error: any) {
        setErrorMessage(`获取数据失败: ${error.message}`);
      } finally {
        setLoading(false);
      }
    };

    fetchPatients();

    pb.collection('patients').subscribe('*', (e) => {
      if (e.action === 'create') {
        setPatients(prev => [toPatient(e.record) as any, ...prev]);
      } else if (e.action === 'update') {
        setPatients(prev => prev.map(p => p.id === e.record.id ? toPatient(e.record) as any : p));
      } else if (e.action === 'delete') {
        setPatients(prev => prev.filter(p => p.id !== e.record.id));
      }
    }).then(fn => { unsubFn = fn; }).catch(() => {});

    return () => {
      if (unsubFn) unsubFn();
      else pb.collection('patients').unsubscribe('*').catch(() => {});
    };
  }, []);

  // Milestone celebrations
  useEffect(() => {
    if (!user?.id || patients.length === 0) return;
    const myCount = patients.filter((p: any) => p.authorUid === user.id).length;
    const celebratedKey = `milestone_celebrated_${user.id}`;
    const prevCountKey = `milestone_prevcount_${user.id}`;
    let lastCelebrated = parseInt(localStorage.getItem(celebratedKey) || '0', 10);
    if (lastCelebrated > myCount) {
      lastCelebrated = MILESTONES.filter(m => m.count < myCount).reduce((max, m) => Math.max(max, m.count), 0);
      localStorage.setItem(celebratedKey, String(lastCelebrated));
    }
    const rawPrev = localStorage.getItem(prevCountKey);
    const prevCount = rawPrev === null ? Math.max(0, myCount - 1) : parseInt(rawPrev, 10);
    localStorage.setItem(prevCountKey, String(myCount));
    if (myCount <= prevCount) {
      const stuckHit = MILESTONES.find(m => m.count === myCount && m.count > lastCelebrated);
      if (stuckHit) {
        localStorage.setItem(celebratedKey, String(stuckHit.count));
        setMilestoneAlert(stuckHit);
        playVictorySound();
      }
      return;
    }
    const hit = [...MILESTONES].reverse().find(m => myCount >= m.count && prevCount < m.count && m.count > lastCelebrated);
    if (hit) {
      localStorage.setItem(celebratedKey, String(hit.count));
      setMilestoneAlert(hit);
      playVictorySound();
    }
  }, [patients, user?.id]);

  const handleExport = () => {
    if (patients.length === 0) return;

    const exportColumns = [
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
      { key: 'tumorMaxDiameter', header: '肿瘤最大径(cm)' },
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
      { key: 'id', header: '系统记录ID' }
    ];

    const exportData = patients.map(patient => {
      const row: any = {};
      exportColumns.forEach(col => {
        let value = (patient as any)[col.key];
        if (col.key === 'imagingFilesCount') {
          value = patient.imagingFiles?.length || 0;
        }
        if ((col.key === 'createdAt' || col.key === 'updatedAt') && value) {
          const date = value.toDate ? value.toDate() : new Date(value);
          value = format(date, 'yyyy-MM-dd HH:mm:ss');
        }
        row[col.header] = value !== undefined && value !== null ? value : '';
      });
      return row;
    });

    const csv = Papa.unparse(exportData);
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `宫颈癌预测模型数据导出_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDelete = async (id: string, authorUid: string) => {
    if (userData?.role !== 'admin' && user.id !== authorUid) {
      setErrorMessage("您没有权限删除此记录。只有录入者或管理员可以删除。");
      return;
    }
    setPatientToDelete({ id, authorUid });
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!patientToDelete) return;
    try {
      await pb.collection('patients').delete(patientToDelete.id);
    } catch (error: any) {
      console.error("Error deleting document:", error);
      setErrorMessage("删除失败，请检查权限。");
    } finally {
      setPatientToDelete(null);
    }
  };

  const isAdmin = userData?.role === 'admin';

  return (
    <div className="min-h-screen bg-gray-50">
      {toastMessage && (
        <div className={`fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 text-white ${
          toastMessage.type === 'success' ? 'bg-green-500' : 'bg-red-500'
        }`}>
          {toastMessage.text}
        </div>
      )}

      {milestoneAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-8 text-center">
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">恭喜！</h2>
            <p className="text-gray-600 mb-1">您已录入 <span className="font-bold text-blue-600">{milestoneAlert.count}</span> 例患者！</p>
            <p className="text-gray-700 font-medium mb-6">解锁奖励：{milestoneAlert.reward}</p>
            <button
              onClick={() => setMilestoneAlert(null)}
              className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors"
            >
              太棒了！
            </button>
          </div>
        </div>
      )}

      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <Database className="w-6 h-6 text-blue-600" />
              <h1 className="text-xl font-bold text-gray-900">宫颈癌数据库采集系统</h1>
            </div>
            <div className="flex items-center gap-2">
              <Link to="/rewards" className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-yellow-700 bg-yellow-50 hover:bg-yellow-100 rounded-lg transition-colors">
                <Trophy className="w-4 h-4" />
                奖励
              </Link>
              <Link to="/chat" className="relative flex items-center gap-1 px-3 py-2 text-sm font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-lg transition-colors">
                <MessageSquare className="w-4 h-4" />
                聊天
                {chatUnread > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                    {chatUnread}
                  </span>
                )}
              </Link>
              {isAdmin && (
                <Link to="/users" className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors">
                  <Users className="w-4 h-4" />
                  用户
                </Link>
              )}
              <button
                onClick={handleOpenNickname}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                {user?.avatarUrl ? (
                  <img src={user.avatarUrl} alt="avatar" className="w-6 h-6 rounded-full object-cover border border-gray-200" />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold">
                    {(displayName || user?.email || '?').charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="hidden sm:inline">{displayName || user?.email?.split('@')[0]}</span>
                <Pencil className="w-3 h-3 text-gray-400" />
              </button>
              <button
                onClick={() => setShowSettingsModal(true)}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                title="设置"
              >
                <Settings className="w-5 h-5" />
              </button>
              <button
                onClick={() => pb.authStore.clear()}
                className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
                退出
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {errorMessage && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-red-700 text-sm">{errorMessage}</p>
            </div>
            <button onClick={() => setErrorMessage(null)} className="text-red-400 hover:text-red-600">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <p className="text-gray-500 text-sm mt-1">
              共 {patients.length} 条记录
              {patients.filter((p: any) => p.authorUid === user?.id).length > 0 && (
                <span className="ml-2 text-blue-600 font-medium">
                  （我录入 {patients.filter((p: any) => p.authorUid === user?.id).length} 例）
                </span>
              )}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleExport}
              disabled={patients.length === 0}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Download className="w-4 h-4" />
              导出CSV
            </button>
            <Link
              to="/patient/new"
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              录入新患者
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-gray-500 text-sm">正在加载数据...</p>
            </div>
          </div>
        ) : patients.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <Database className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">暂无患者记录</h3>
            <p className="text-gray-500 mb-6">点击右上角按钮开始录入第一条患者数据</p>
            <Link
              to="/patient/new"
              className="inline-flex items-center gap-2 px-6 py-3 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              录入新患者
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">患者ID</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">姓名</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">分期</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">录入者</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">最后更新</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {patients.map((patient) => (
                    <tr key={patient.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-sm text-gray-600 font-mono">
                        {(patient as any).customPatientId || <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-gray-900">{patient.name}</div>
                        {(patient as any).phone && <div className="text-xs text-gray-400">{(patient as any).phone}</div>}
                      </td>
                      <td className="px-4 py-3">
                        {(patient as any).figo2018 ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {(patient as any).figo2018}
                          </span>
                        ) : (
                          <span className="text-gray-300 text-sm">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 hidden md:table-cell">
                        <span className="font-medium text-blue-600">{(patient as any).authorName || (patient as any).authorEmail?.split('@')[0] || '未知'}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 hidden lg:table-cell">
                        {(patient as any).updatedAt ? format(new Date((patient as any).updatedAt), 'yyyy-MM-dd HH:mm') : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            to={`/patient/${patient.id}`}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="编辑"
                          >
                            <Edit className="w-4 h-4" />
                          </Link>
                          {(isAdmin || user?.id === (patient as any).authorUid) && (
                            <button
                              onClick={() => handleDelete(patient.id!, (patient as any).authorUid)}
                              className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                              title="删除"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">API 设置</h2>
              <button onClick={() => setShowSettingsModal(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Gemini API Key</label>
                <input
                  type="password"
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                  placeholder="AIza..."
                  className="w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">DeepSeek API Key</label>
                <input
                  type="password"
                  value={deepseekKey}
                  onChange={(e) => setDeepseekKey(e.target.value)}
                  placeholder="sk-..."
                  className="w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleTestKey}
                disabled={testing || !geminiKey}
                className="flex-1 px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 disabled:opacity-50"
              >
                {testing ? '测试中...' : '测试 Gemini Key'}
              </button>
              <button
                onClick={handleSaveSettings}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Nickname Modal */}
      {showNicknameModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">编辑个人资料</h2>
              <button onClick={() => setShowNicknameModal(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex flex-col items-center mb-4">
              <div className="relative">
                {avatarPreview ? (
                  <img src={avatarPreview} alt="avatar" className="w-20 h-20 rounded-full object-cover border-2 border-gray-200" />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-blue-500 flex items-center justify-center text-white text-2xl font-bold">
                    {(nicknameInput || user?.email || '?').charAt(0).toUpperCase()}
                  </div>
                )}
                <button
                  onClick={() => avatarFileRef.current?.click()}
                  className="absolute bottom-0 right-0 bg-white border border-gray-300 rounded-full p-1 shadow hover:bg-gray-50"
                >
                  <Pencil className="w-3 h-3 text-gray-600" />
                </button>
              </div>
              <input ref={avatarFileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarFileChange} />
              {avatarPreview && (
                <button onClick={() => setAvatarPreview('')} className="mt-1 text-xs text-red-500 hover:underline">
                  移除头像
                </button>
              )}
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">昵称</label>
              <input
                type="text"
                value={nicknameInput}
                onChange={(e) => setNicknameInput(e.target.value)}
                placeholder={user?.email?.split('@')[0]}
                className="w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <button
              onClick={handleSaveNickname}
              disabled={savingProfile}
              className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {savingProfile ? '保存中...' : '保存'}
            </button>
          </div>
        </div>
      )}

      <DeleteConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => { setShowDeleteModal(false); setPatientToDelete(null); }}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
