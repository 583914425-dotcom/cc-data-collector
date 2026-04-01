import { useEffect, useRef, useState } from 'react';
import { collection, query, orderBy, onSnapshot, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
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
  const [displayName, setDisplayName] = useState(userData?.displayName || '');
  const [avatarPreview, setAvatarPreview] = useState<string>(userData?.avatarUrl || '');
  const [savingProfile, setSavingProfile] = useState(false);
  const avatarFileRef = useRef<HTMLInputElement>(null);
  const [milestoneAlert, setMilestoneAlert] = useState<{ count: number; reward: string } | null>(null);

  const MILESTONES: { count: number; reward: string }[] = [
    { count: 3, reward: '🧋 喜茶' },
    { count: 10, reward: '🍜 李先生牛肉面三件套单人餐' },
    { count: 20, reward: '🍗 肯德基开工吃堡单人餐' },
    { count: 30, reward: '🥟 喜家德西芹水饺单人餐' },
    { count: 50, reward: '🥖 赛百味金枪鱼双拼三明治' },
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
    setDisplayName(userData?.displayName || '');
    setAvatarPreview(userData?.avatarUrl || '');
  }, [userData?.displayName, userData?.avatarUrl]);

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
    setAvatarPreview(userData?.avatarUrl || '');
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
      await updateDoc(doc(db, 'users', user.uid), {
        displayName: nicknameInput.trim(),
        avatarUrl: avatarPreview,
      });
      setDisplayName(nicknameInput.trim());
      setShowNicknameModal(false);
      showToast('个人资料已保存', 'success');
    } catch (err) {
      showToast('保存失败，请重试', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  useEffect(() => {
    const handleFirestoreError = (error: any, operation: string, path: string) => {
      const errInfo = {
        error: error.message,
        operationType: operation,
        path,
        authInfo: {
          userId: auth.currentUser?.uid,
          email: auth.currentUser?.email,
          emailVerified: auth.currentUser?.emailVerified,
        }
      };
      console.error('Firestore Error:', JSON.stringify(errInfo));
      setErrorMessage(`权限不足或获取数据失败: ${error.message}`);
    };

    const q = query(collection(db, 'patients'), orderBy('updatedAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: Patient[] = [];
      snapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() } as Patient);
      });
      setPatients(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, 'list', 'patients');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user?.uid || patients.length === 0) return;
    const myCount = patients.filter(p => p.authorUid === user.uid).length;
    const celebratedKey = `milestone_celebrated_${user.uid}`;
    const prevCountKey = `milestone_prevcount_${user.uid}`;
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
  }, [patients, user?.uid]);

  const handleExport = () => {
    if (patients.length === 0) return;

    // Define the exact columns and their Chinese headers we want to export
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

    // Map the data to match the columns and format timestamps
    const exportData = patients.map(patient => {
      const row: any = {};
      exportColumns.forEach(col => {
        let value = (patient as any)[col.key];
        
        if (col.key === 'imagingFilesCount') {
          value = patient.imagingFiles?.length || 0;
        }
        
        // Format timestamps to readable dates
        if ((col.key === 'createdAt' || col.key === 'updatedAt') && value) {
          const date = value.toDate ? value.toDate() : new Date(value);
          value = format(date, 'yyyy-MM-dd HH:mm:ss');
        }
        
        // Handle undefined/null values
        row[col.header] = value !== undefined && value !== null ? value : '';
      });
      return row;
    });

    const csv = Papa.unparse(exportData);
    // Add BOM for Excel UTF-8 compatibility
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
    if (userData?.role !== 'admin' && user.uid !== authorUid) {
      setErrorMessage("您没有权限删除此记录。只有录入者或管理员可以删除。");
      return;
    }
    setPatientToDelete({ id, authorUid });
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!patientToDelete) return;
    try {
      await deleteDoc(doc(db, 'patients', patientToDelete.id));
    } catch (error) {
      console.error("Error deleting document:", error);
      setErrorMessage("删除失败，请检查权限。");
    } finally {
      setPatientToDelete(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {toastMessage && (
        <div className={`fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 text-white ${
          toastMessage.type === 'success' ? 'bg-green-600' : 'bg-red-600'
        }`}>
          {toastMessage.text}
        </div>
      )}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">预测模型数据采集系统</h1>
          <div className="flex items-center gap-4">
            {userData?.role === 'admin' && (
              <Link
                to="/users"
                className="text-gray-500 hover:text-purple-600 flex items-center gap-1 text-sm transition-colors"
                title="用户权限管理"
              >
                <Users className="w-4 h-4" /> 用户管理
              </Link>
            )}
            <Link
              to="/rewards"
              className="text-gray-500 hover:text-yellow-600 flex items-center gap-1 text-sm transition-colors"
              title="录入排行榜与奖励"
            >
              <Trophy className="w-4 h-4" /> 奖励榜
            </Link>
            <Link
              to="/chat"
              className="text-gray-500 hover:text-green-600 flex items-center gap-1 text-sm transition-colors relative"
              title="进入团队聊天室"
            >
              <MessageSquare className="w-4 h-4" /> 聊天室
              {chatUnread > 0 && (
                <span className="absolute -top-2 -right-3 bg-red-500 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                  {chatUnread}
                </span>
              )}
            </Link>
            <button
              onClick={() => setShowSettingsModal(true)}
              className="text-gray-500 hover:text-blue-600 flex items-center gap-1 text-sm transition-colors"
              title="配置 DeepSeek API Key"
            >
              <Settings className="w-4 h-4" /> AI 设置
            </button>
            <button
              onClick={handleOpenNickname}
              className="text-sm text-gray-500 border-l pl-4 flex items-center gap-2 hover:text-blue-600 transition-colors"
              title="点击修改个人资料"
            >
              <div className="w-7 h-7 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
                {userData?.avatarUrl ? (
                  <img src={userData.avatarUrl} alt="头像" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs font-bold text-gray-500">
                    {(displayName || user.email || '?').charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              {displayName || user.email}
              <Pencil className="w-3 h-3" />
            </button>
            <button
              onClick={() => auth.signOut()}
              className="text-gray-500 hover:text-gray-700 flex items-center gap-1 text-sm"
            >
              <LogOut className="w-4 h-4" /> 退出
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-medium text-gray-900">患者列表 ({patients.length})</h2>
          <div className="flex gap-3">
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <Download className="w-4 h-4" /> 导出 CSV
            </button>
            <Link
              to="/patient/new"
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 rounded-lg text-sm font-medium text-white hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" /> 新增录入
            </Link>
          </div>
        </div>

        <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-500">加载中...</div>
          ) : patients.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              暂无数据，点击右上角"新增录入"开始收集。
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">患者ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">姓名</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">电话号码</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">年龄(岁)</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">FIGO2018分期</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">录入者</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {patients.map((patient) => (
                    <tr key={patient.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{patient.customPatientId || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{patient.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{patient.phone || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{patient.age}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{patient.figo2018 || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <span className="font-medium text-blue-600">{patient.authorName || patient.authorEmail?.split('@')[0] || '未知'}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-3">
                          <Link to={`/patient/${patient.id}`} className="text-blue-600 hover:text-blue-900">
                            <Edit className="w-4 h-4" />
                          </Link>
                          <button 
                            onClick={() => handleDelete(patient.id!, patient.authorUid)}
                            className="text-red-600 hover:text-red-900"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
      <DeleteConfirmationModal 
        isOpen={showDeleteModal} 
        onClose={() => setShowDeleteModal(false)} 
        onConfirm={confirmDelete} 
      />
      {errorMessage && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4 text-red-600">
              <AlertCircle className="w-6 h-6" />
              <h3 className="text-lg font-bold">错误</h3>
            </div>
            <p className="text-gray-600 mb-6">{errorMessage}</p>
            <div className="flex justify-end">
              <button
                onClick={() => setErrorMessage(null)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                确定
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-900">AI 模型设置</h3>
              <button onClick={() => setShowSettingsModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Gemini API Key (可选)
                </label>
                <input
                  type="password"
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                  placeholder="AI Studio API Key..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="mt-1 text-xs text-gray-500">
                  如果不填写，系统将尝试使用内置的免费 Gemini 模型。如果内置模型报错，请在此填写您自己的 API Key。
                </p>
                <button
                  onClick={handleTestKey}
                  disabled={testing}
                  className="mt-2 text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                  {testing ? '测试中...' : '测试连接'}
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  DeepSeek API Key (可选)
                </label>
                <input
                  type="password"
                  value={deepseekKey}
                  onChange={(e) => setDeepseekKey(e.target.value)}
                  placeholder="sk-..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="mt-1 text-xs text-gray-500">
                  填写后将优先使用 DeepSeek 接口进行解析。
                </p>
              </div>
              
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowSettingsModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                >
                  取消
                </button>
                <button
                  onClick={handleSaveSettings}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                >
                  保存设置
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showNicknameModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-bold text-gray-900">个人资料</h3>
              <button onClick={() => setShowNicknameModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-col items-center mb-5">
              <div
                className="w-20 h-20 rounded-full overflow-hidden bg-gray-100 border-2 border-gray-200 cursor-pointer hover:opacity-80 transition-opacity relative group"
                onClick={() => avatarFileRef.current?.click()}
              >
                {avatarPreview ? (
                  <img src={avatarPreview} alt="头像" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-gray-400">
                    {(nicknameInput || user.email || '?').charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Pencil className="w-5 h-5 text-white" />
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-2">点击头像上传图片</p>
              <input
                ref={avatarFileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarFileChange}
              />
              {avatarPreview && (
                <button
                  onClick={() => setAvatarPreview('')}
                  className="text-xs text-red-500 hover:text-red-700 mt-1"
                >
                  移除头像
                </button>
              )}
            </div>

            <label className="block text-sm font-medium text-gray-700 mb-1">昵称</label>
            <input
              type="text"
              value={nicknameInput}
              onChange={(e) => setNicknameInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveNickname()}
              placeholder="输入你的昵称（留空则显示邮箱）"
              maxLength={20}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-5"
            />

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowNicknameModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                取消
              </button>
              <button
                onClick={handleSaveNickname}
                disabled={savingProfile}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60"
              >
                {savingProfile ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {milestoneAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <style>{`
            @keyframes confetti-fall {
              0% { transform: translateY(-80px) rotate(0deg); opacity: 1; }
              100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
            }
            @keyframes pop-in {
              0% { transform: scale(0.3); opacity: 0; }
              70% { transform: scale(1.1); }
              100% { transform: scale(1); opacity: 1; }
            }
            .milestone-card { animation: pop-in 0.45s cubic-bezier(.17,.67,.35,1.2) both; }
            .confetti-piece { position: fixed; top: -20px; width: 10px; height: 14px; opacity: 0; animation: confetti-fall linear infinite; pointer-events: none; }
          `}</style>

          {['#f43f5e','#f97316','#facc15','#22c55e','#3b82f6','#a855f7','#ec4899'].flatMap((color, ci) =>
            Array.from({ length: 6 }, (_, i) => (
              <div
                key={`c-${ci}-${i}`}
                className="confetti-piece"
                style={{
                  left: `${(ci * 6 + i) * 2.2}%`,
                  background: color,
                  animationDuration: `${1.8 + (ci + i) * 0.23}s`,
                  animationDelay: `${(ci * 0.07 + i * 0.13)}s`,
                  borderRadius: i % 2 === 0 ? '50%' : '2px',
                  width: `${8 + (i % 3) * 4}px`,
                  height: `${10 + (ci % 3) * 4}px`,
                }}
              />
            ))
          )}

          <div className="milestone-card relative bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full mx-4 text-center">
            <div className="text-6xl mb-3">🎉</div>
            <div className="text-2xl font-bold text-gray-900 mb-1">里程碑达成！</div>
            <div className="text-5xl font-black text-orange-500 my-3">{milestoneAlert.count} 例</div>
            <div className="text-gray-500 text-sm mb-2">恭喜你解锁奖励</div>
            <div className="bg-orange-50 border border-orange-200 rounded-2xl px-5 py-3 text-lg font-semibold text-orange-700 mb-6">
              {milestoneAlert.reward}
            </div>
            <p className="text-xs text-gray-400 mb-5">前往「奖励榜」页面领取你的奖励 🏆</p>
            <button
              onClick={() => setMilestoneAlert(null)}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-orange-400 to-pink-500 text-white font-bold text-base hover:opacity-90 transition"
            >
              太棒了！
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
