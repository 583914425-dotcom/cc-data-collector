import { useEffect, useRef, useState } from 'react';
import { collection, onSnapshot, addDoc, runTransaction, doc, query, where, getDocs, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Link } from 'react-router-dom';
import { ArrowLeft, Trophy, Gift, Plus, ExternalLink, Loader2, Trash2, QrCode, X } from 'lucide-react';

const MILESTONES = [
  { count: 3,   topN: 4, reward: '喜茶',                     emoji: '🧋' },
  { count: 10,  topN: 2, reward: '李先生牛肉面单人餐',          emoji: '🍜' },
  { count: 20,  topN: 2, reward: '肯德基开工吃堡单人餐',         emoji: '🍗' },
  { count: 30,  topN: 1, reward: '喜家德西芹水饺单人餐',         emoji: '🥟' },
  { count: 50,  topN: 1, reward: '赛百味金枪鱼双拼三明治',       emoji: '🥖' },
  { count: 100, topN: 1, reward: '熊喵来了春季宴请火锅双人餐',   emoji: '🍲' },
  { count: 150, topN: 1, reward: '安小胖韩国烤肉2-3人餐',       emoji: '🥩' },
];

type UserStat  = { uid: string; name: string; email: string; count: number };
type Voucher   = { id: string; milestoneCount: number; url?: string; imageUrl?: string; claimedBy: string | null; claimedByEmail: string | null; claimedByName?: string | null; claimedAt?: any };

export default function Rewards({ user, userData }: { user: any; userData?: any }) {
  const isAdmin = userData?.role === 'admin';

  const [stats,       setStats]       = useState<UserStat[]>([]);
  const [vouchers,    setVouchers]    = useState<Voucher[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [claiming,    setClaiming]    = useState<number | null>(null);
  const [previewMode, setPreviewMode] = useState(false);

  const [addingFor,   setAddingFor]   = useState<number | null>(null);
  const [addMode,     setAddMode]     = useState<'url' | 'image'>('url');
  const [newUrl,      setNewUrl]      = useState('');
  const [newImage,    setNewImage]    = useState<string | null>(null);
  const [saving,      setSaving]      = useState(false);
  const [qrViewer,    setQrViewer]    = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showAdmin = isAdmin && !previewMode;

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'patients'), (snap) => {
      const map: Record<string, UserStat> = {};
      snap.docs.forEach(d => {
        const data = d.data();
        const uid   = data.authorUid   || 'unknown';
        const name  = data.authorName  || data.authorEmail?.split('@')[0] || '未知';
        const email = data.authorEmail || '';
        if (!map[uid]) map[uid] = { uid, name, email, count: 0 };
        map[uid].count++;
      });
      setStats(Object.values(map).sort((a, b) => b.count - a.count));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'vouchers'), (snap) => {
      setVouchers(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
    });
    return () => unsub();
  }, []);

  const claim = async (milestoneCount: number) => {
    setClaiming(milestoneCount);
    try {
      const q = query(
        collection(db, 'vouchers'),
        where('milestoneCount', '==', milestoneCount),
        where('claimedBy', '==', null),
      );
      const snap = await getDocs(q);
      if (snap.empty) { alert('暂无可用兑换券，请联系管理员补充。'); return; }
      const target = snap.docs[0];
      await runTransaction(db, async (tx) => {
        const fresh = await tx.get(target.ref);
        if (fresh.data()?.claimedBy) throw new Error('already_claimed');
        const myName = userData?.displayName || stats.find(s => s.uid === user.uid)?.name || user.displayName || user.email?.split('@')[0] || '';
        tx.update(target.ref, {
          claimedBy:      user.uid,
          claimedByEmail: user.email,
          claimedByName:  myName,
          claimedAt:      serverTimestamp(),
        });
      });
    } catch (e: any) {
      if (e.message !== 'already_claimed') alert('领取失败，请重试。');
    } finally {
      setClaiming(null);
    }
  };

  const compressImage = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const size = 600;
          const canvas = document.createElement('canvas');
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext('2d')!;
          ctx.fillStyle = '#fff';
          ctx.fillRect(0, 0, size, size);
          const scale = Math.min(size / img.width, size / img.height);
          const w = img.width * scale;
          const h = img.height * scale;
          ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        };
        img.onerror = reject;
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImage(file);
      setNewImage(compressed);
    } catch {
      alert('图片处理失败，请重试。');
    }
  };

  const saveVoucher = async (milestoneCount: number) => {
    setSaving(true);
    try {
      if (addMode === 'url') {
        const raw = newUrl.trim();
        const urls = raw.split(/(?=https?:\/\/)/).map(u => u.trim()).filter(u => u.length > 0);
        if (urls.length === 0) return;
        await Promise.all(urls.map(url => addDoc(collection(db, 'vouchers'), {
          milestoneCount, url, claimedBy: null, claimedByEmail: null, claimedAt: null,
        })));
        setNewUrl('');
      } else {
        if (!newImage) return;
        await addDoc(collection(db, 'vouchers'), {
          milestoneCount, imageUrl: newImage, claimedBy: null, claimedByEmail: null, claimedAt: null,
        });
        setNewImage(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
      setAddingFor(null);
    } finally {
      setSaving(false);
    }
  };

  const deleteVoucher = async (id: string) => {
    if (!confirm('确认删除这条兑换券？')) return;
    await deleteDoc(doc(db, 'vouchers', id));
  };

  const openForm = (count: number) => {
    setAddingFor(count);
    setAddMode('url');
    setNewUrl('');
    setNewImage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const myVoucher    = (milestoneCount: number) => vouchers.find(v => v.milestoneCount === milestoneCount && v.claimedBy === user.uid);
  const hasUnclaimed = (milestoneCount: number) => vouchers.some(v => v.milestoneCount === milestoneCount && !v.claimedBy);
  const countFor     = (milestoneCount: number) => ({
    total:     vouchers.filter(v => v.milestoneCount === milestoneCount).length,
    unclaimed: vouchers.filter(v => v.milestoneCount === milestoneCount && !v.claimedBy).length,
    claimed:   vouchers.filter(v => v.milestoneCount === milestoneCount &&  v.claimedBy).length,
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* QR code viewer modal */}
      {qrViewer && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          onClick={() => setQrViewer(null)}
        >
          <div className="relative bg-white rounded-2xl p-5 shadow-2xl max-w-xs w-full mx-4" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setQrViewer(null)}
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
            <p className="text-sm font-medium text-gray-700 mb-3 text-center">扫描二维码兑换</p>
            <img src={qrViewer} alt="兑换码" className="w-full rounded-lg" />
            <p className="text-xs text-gray-400 text-center mt-3">点击任意处关闭</p>
          </div>
        </div>
      )}

      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <Trophy className="w-6 h-6 text-yellow-500" />
          <h1 className="text-lg font-bold text-gray-900">录入奖励榜</h1>
          {isAdmin && (
            <button
              onClick={() => { setPreviewMode(p => !p); setAddingFor(null); }}
              className={`ml-auto text-xs px-3 py-1.5 rounded-full border transition-colors ${previewMode ? 'bg-orange-100 text-orange-600 border-orange-300' : 'bg-gray-100 text-gray-500 border-gray-300 hover:bg-gray-200'}`}
            >
              {previewMode ? '🙋 当前：用户视角  (点击还原)' : '👁 预览用户视角'}
            </button>
          )}
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">

        {/* 奖励规则 */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <h2 className="font-semibold text-gray-800 mb-1 flex items-center gap-2">
            <Gift className="w-5 h-5 text-pink-500" /> 奖励规则
          </h2>
          <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
            ⚡ 奖励数量有限，先到先得，领完即止。达到例数不代表一定能领到，请及时领取！
          </p>
          <div className="space-y-3">
            {MILESTONES.map(m => {
              const c          = countFor(m.count);
              const myCount    = stats.find(s => s.uid === user?.uid)?.count ?? 0;
              const reached    = myCount >= m.count;
              const mv         = myVoucher(m.count);
              const canClaim   = reached && !mv && hasUnclaimed(m.count);
              const isClaiming = claiming === m.count;
              return (
                <div key={m.count} className={`flex items-center gap-3 text-sm rounded-lg px-2 py-1 transition-colors ${reached ? 'bg-green-50' : ''}`}>
                  <span className="text-xl w-8 text-center">{m.emoji}</span>
                  <span className={`w-24 shrink-0 ${reached ? 'text-green-700 font-semibold' : 'text-gray-500'}`}>
                    达到 <span className="font-bold">{m.count} 例</span>
                  </span>
                  <span className="text-gray-700 font-medium flex-1">
                    {m.reward}
                    <span className="ml-1.5 text-xs text-orange-500 font-normal">限{m.topN}份</span>
                    {reached && <span className="ml-1 text-green-600 text-xs">✓ 已达成</span>}
                  </span>
                  {c.total > 0 && (
                    <span className={`text-xs shrink-0 ${c.unclaimed === 0 ? 'text-red-400' : 'text-gray-400'}`}>
                      剩 {c.unclaimed}/{c.total}
                    </span>
                  )}
                  {canClaim && (
                    <button
                      onClick={() => claim(m.count)}
                      disabled={isClaiming}
                      className="text-xs bg-orange-500 hover:bg-orange-600 text-white px-2.5 py-1 rounded-full flex items-center gap-1 shrink-0 disabled:opacity-60"
                    >
                      {isClaiming ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                      领取
                    </button>
                  )}
                  {mv && mv.imageUrl && (
                    <button
                      onClick={() => setQrViewer(mv.imageUrl!)}
                      className="text-xs bg-green-50 text-green-700 border border-green-200 px-2.5 py-1 rounded-full flex items-center gap-1 shrink-0 hover:bg-green-100"
                    >
                      <QrCode className="w-3 h-3" /> 查看二维码
                    </button>
                  )}
                  {mv && mv.url && (
                    <a href={mv.url} target="_blank" rel="noopener noreferrer"
                      className="text-xs bg-blue-50 text-blue-600 border border-blue-200 px-2.5 py-1 rounded-full flex items-center gap-1 shrink-0 hover:bg-blue-100"
                    >
                      <ExternalLink className="w-3 h-3" /> 兑换
                    </a>
                  )}
                  {reached && !mv && !hasUnclaimed(m.count) && (
                    <span className="text-xs text-gray-400 shrink-0">待补充</span>
                  )}
                  {showAdmin && (
                    <button
                      onClick={() => openForm(m.count)}
                      className="text-blue-500 hover:text-blue-700 shrink-0"
                      title="添加兑换券"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* 管理员添加表单 */}
          {showAdmin && addingFor !== null && (
            <div className="mt-4 p-3 bg-blue-50 rounded-lg space-y-3">
              <p className="text-sm font-medium text-blue-800">
                添加「{MILESTONES.find(m => m.count === addingFor)?.emoji} {MILESTONES.find(m => m.count === addingFor)?.reward}」兑换券
              </p>
              {/* 模式切换 */}
              <div className="flex gap-2">
                <button
                  onClick={() => { setAddMode('url'); setNewImage(null); }}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${addMode === 'url' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
                >
                  🔗 粘贴链接
                </button>
                <button
                  onClick={() => { setAddMode('image'); setNewUrl(''); }}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${addMode === 'image' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
                >
                  📷 上传二维码
                </button>
              </div>

              {addMode === 'url' ? (
                <textarea
                  value={newUrl}
                  onChange={e => setNewUrl(e.target.value)}
                  placeholder="粘贴兑换链接（支持多条，每行一个）…"
                  rows={4}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none font-mono"
                />
              ) : (
                <div className="space-y-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="block w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-medium file:bg-blue-100 file:text-blue-700 hover:file:bg-blue-200 cursor-pointer"
                  />
                  {newImage && (
                    <div className="relative inline-block">
                      <img src={newImage} alt="预览" className="w-36 h-36 object-contain border rounded-lg bg-white p-1" />
                      <button
                        onClick={() => { setNewImage(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                        className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600"
                      >×</button>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => saveVoucher(addingFor)}
                  disabled={saving || (addMode === 'url' ? !newUrl.trim() : !newImage)}
                  className="bg-blue-600 text-white text-sm px-4 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
                >
                  {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : null} 保存
                </button>
                <button
                  onClick={() => setAddingFor(null)}
                  className="text-sm text-gray-500 px-3 py-1.5 rounded-lg hover:bg-gray-100"
                >
                  取消
                </button>
              </div>
            </div>
          )}

          {/* 管理员：已添加的券列表 */}
          {showAdmin && addingFor !== null && (
            <div className="mt-2 space-y-1">
              {vouchers.filter(v => v.milestoneCount === addingFor).map(v => (
                <div key={v.id} className="flex items-center gap-2 text-xs px-1">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${v.claimedBy ? 'bg-green-400' : 'bg-gray-300'}`} />
                  {v.imageUrl ? (
                    <span className="flex items-center gap-1 text-gray-500 flex-1">
                      <QrCode className="w-3 h-3" /> 二维码图片
                    </span>
                  ) : (
                    <span className="flex-1 truncate font-mono text-gray-500">{v.url}</span>
                  )}
                  <span className="shrink-0 text-gray-400">
                    {v.claimedBy
                      ? `已领 (${v.claimedByName || stats.find(s => s.uid === v.claimedBy)?.name || v.claimedByEmail?.split('@')[0]})`
                      : '未领'}
                  </span>
                  <button onClick={() => deleteVoucher(v.id)} className="text-red-400 hover:text-red-600 shrink-0">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 领取记录 */}
        {vouchers.filter(v => v.claimedBy).length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-4">
            <h2 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <span className="text-lg">🎉</span> 领取记录
            </h2>
            <div className="space-y-2">
              {vouchers
                .filter(v => v.claimedBy)
                .sort((a, b) => {
                  const ta = a.claimedAt?.toMillis?.() ?? 0;
                  const tb = b.claimedAt?.toMillis?.() ?? 0;
                  return tb - ta;
                })
                .map(v => {
                  const m = MILESTONES.find(m => m.count === v.milestoneCount);
                  return (
                    <div key={v.id} className="flex items-center gap-3 text-sm">
                      <span className="text-xl w-8 text-center">{m?.emoji ?? '🎁'}</span>
                      <span className="text-gray-700 font-medium flex-1">{m?.reward ?? '奖励'}</span>
                      <span className="text-gray-500 text-xs">
                        {v.claimedByName
                          || stats.find(s => s.uid === v.claimedBy)?.name
                          || (v.claimedBy === user?.uid ? (userData?.displayName || user?.displayName || null) : null)
                          || v.claimedByEmail?.split('@')[0]}
                      </span>
                      <span className="text-green-500 text-xs font-medium">✓ 已领取</span>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
