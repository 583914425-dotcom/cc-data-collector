import { useEffect, useRef, useState } from 'react';
import { pb, toPatient } from '../lib/pb';
import { Link } from 'react-router-dom';
import { ArrowLeft, Trophy, Gift, Plus, ExternalLink, Loader2, Trash2, QrCode, X } from 'lucide-react';

const MILESTONES = [
  { count: 3,   topN: 4, reward: '喜茶',                     emoji: '🧋' },
  { count: 10,  topN: 3, reward: '李先生牛肉面单人餐',          emoji: '🍜' },
  { count: 20,  topN: 2, reward: '肯德基开工吃堡单人餐',         emoji: '🍗' },
  { count: 30,  topN: 2, reward: '赛百味金枪鱼双拼三明治',       emoji: '🥖' },
  { count: 50,  topN: 1, reward: '喜家德西芹水饺单人餐',         emoji: '🥟' },
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

  // Load patients stats
  useEffect(() => {
    let unsubFn: (() => void) | null = null;

    const fetchStats = async () => {
      try {
        const records = await pb.collection('patients').getFullList();
        const map: Record<string, UserStat> = {};
        records.forEach(r => {
          const patient = toPatient(r);
          const uid   = (patient as any).authorUid   || 'unknown';
          const name  = (patient as any).authorName  || (patient as any).authorEmail?.split('@')[0] || '未知';
          const email = (patient as any).authorEmail || '';
          if (!map[uid]) map[uid] = { uid, name, email, count: 0 };
          map[uid].count++;
        });
        setStats(Object.values(map).sort((a, b) => b.count - a.count));
        setLoading(false);
      } catch (_) { setLoading(false); }
    };

    fetchStats();
    pb.collection('patients').subscribe('*', fetchStats).then(fn => { unsubFn = fn; }).catch(() => {});
    return () => {
      if (unsubFn) unsubFn();
      else pb.collection('patients').unsubscribe('*').catch(() => {});
    };
  }, []);

  // Load vouchers
  useEffect(() => {
    let unsubFn: (() => void) | null = null;

    const fetchVouchers = async () => {
      try {
        const records = await pb.collection('vouchers').getFullList({ sort: 'created' });
        setVouchers(records.map((r: any) => ({
          id: r.id,
          milestoneCount: r.milestoneCount,
          url: r.url || undefined,
          imageUrl: r.imageUrl || undefined,
          claimedBy: r.claimedBy || null,
          claimedByEmail: r.claimedByEmail || null,
          claimedByName: r.claimedByName || null,
          claimedAt: r.claimedAt || null,
        })));
      } catch (_) {}
    };

    fetchVouchers();
    pb.collection('vouchers').subscribe('*', fetchVouchers).then(fn => { unsubFn = fn; }).catch(() => {});
    return () => {
      if (unsubFn) unsubFn();
      else pb.collection('vouchers').unsubscribe('*').catch(() => {});
    };
  }, []);

  const claim = async (milestoneCount: number) => {
    setClaiming(milestoneCount);
    try {
      const available = vouchers.filter(v => v.milestoneCount === milestoneCount && !v.claimedBy);
      if (available.length === 0) { alert('暂无可用兑换券，请联系管理员补充。'); return; }
      const target = available[0];
      const myName = user?.name || stats.find(s => s.uid === user?.id)?.name || user?.email?.split('@')[0] || '';
      await pb.collection('vouchers').update(target.id, {
        claimedBy:      user?.id,
        claimedByEmail: user?.email,
        claimedByName:  myName,
        claimedAt:      new Date().toISOString(),
      });
    } catch (e: any) {
      alert('领取失败，请重试。');
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
        await Promise.all(urls.map(url => pb.collection('vouchers').create({
          milestoneCount, url, claimedBy: null, claimedByEmail: null, claimedAt: null,
        })));
        setNewUrl('');
      } else {
        if (!newImage) return;
        await pb.collection('vouchers').create({
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
    await pb.collection('vouchers').delete(id);
  };

  const openForm = (count: number) => {
    setAddingFor(count);
    setAddMode('url');
    setNewUrl('');
    setNewImage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const myVoucher    = (milestoneCount: number) => vouchers.find(v => v.milestoneCount === milestoneCount && v.claimedBy === user?.id);
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
          <div className="bg-white rounded-2xl p-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            <img src={qrViewer} alt="兑换券" className="max-w-[80vw] max-h-[80vh] rounded-lg" />
            <button onClick={() => setQrViewer(null)} className="mt-3 w-full text-sm text-gray-500 hover:text-gray-700">关闭</button>
          </div>
        </div>
      )}

      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <Link to="/" className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <ArrowLeft className="w-5 h-5 text-gray-500" />
              </Link>
              <Trophy className="w-6 h-6 text-yellow-500" />
              <h1 className="text-xl font-bold text-gray-900">录入奖励</h1>
            </div>
            {isAdmin && (
              <button
                onClick={() => setPreviewMode(v => !v)}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${previewMode ? 'bg-purple-100 text-purple-700 border-purple-300' : 'bg-gray-100 text-gray-600 border-gray-300 hover:bg-gray-200'}`}
              >
                {previewMode ? '管理视图' : '用户预览'}
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Leaderboard */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-500" /> 录入排行榜
            </h2>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            </div>
          ) : stats.length === 0 ? (
            <div className="py-8 text-center text-gray-400">暂无数据</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {stats.map((s, i) => (
                <div key={s.uid} className={`px-6 py-3 flex items-center gap-4 ${s.uid === user?.id ? 'bg-blue-50' : ''}`}>
                  <span className={`w-6 text-sm font-bold ${i === 0 ? 'text-yellow-500' : i === 1 ? 'text-gray-400' : i === 2 ? 'text-amber-600' : 'text-gray-400'}`}>
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">
                      {s.name} {s.uid === user?.id && <span className="text-blue-500 text-xs">(我)</span>}
                    </div>
                    <div className="text-xs text-gray-400 truncate">{s.email}</div>
                  </div>
                  <span className="text-sm font-bold text-blue-600">{s.count} 例</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* First-come note */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-3 text-sm text-amber-800 flex items-start gap-2">
          <span className="text-lg leading-tight">⚡</span>
          <div>
            <span className="font-semibold">先到先得！</span>
            每个奖励层级的兑换券数量有限，达到录入门槛后请尽快领取。
          </div>
        </div>

        {/* Milestones */}
        <div className="space-y-4">
          {MILESTONES.map(ms => {
            const myCount = stats.find(s => s.uid === user?.id)?.count || 0;
            const unlocked = myCount >= ms.count;
            const claimed  = myVoucher(ms.count);
            const cnt      = countFor(ms.count);

            return (
              <div key={ms.count} className={`bg-white rounded-xl border shadow-sm overflow-hidden ${unlocked ? 'border-green-200' : 'border-gray-200'}`}>
                <div className="px-5 py-4 flex items-center gap-4">
                  <span className={`text-3xl ${unlocked ? '' : 'grayscale opacity-50'}`}>{ms.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-gray-900">{ms.reward}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${unlocked ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {unlocked ? '✓ 已解锁' : `需录入 ${ms.count} 例`}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700 border border-amber-200">
                        限 {ms.topN} 份
                      </span>
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {unlocked
                        ? `您已录入 ${myCount} 例`
                        : `您已录入 ${myCount} / ${ms.count} 例`}
                      {cnt.total > 0 && (
                        <span className="ml-2 text-gray-300">
                          · 已发放 {cnt.total} 张，已领 {cnt.claimed} 张，剩余 {cnt.unclaimed} 张
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    {claimed ? (
                      <div className="flex items-center gap-2">
                        {(claimed.url || claimed.imageUrl) && (
                          <button
                            onClick={() => {
                              if (claimed.imageUrl) setQrViewer(claimed.imageUrl);
                              else if (claimed.url) window.open(claimed.url, '_blank');
                            }}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors"
                          >
                            {claimed.imageUrl ? <QrCode className="w-3.5 h-3.5" /> : <ExternalLink className="w-3.5 h-3.5" />}
                            查看兑换码
                          </button>
                        )}
                        <span className="text-xs text-green-600 font-medium bg-green-50 px-2 py-1 rounded-lg">✓ 已领取</span>
                      </div>
                    ) : unlocked && hasUnclaimed(ms.count) ? (
                      <button
                        onClick={() => claim(ms.count)}
                        disabled={claiming === ms.count}
                        className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:bg-green-400 rounded-lg transition-colors shadow-sm"
                      >
                        {claiming === ms.count ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gift className="w-4 h-4" />}
                        立即领取
                      </button>
                    ) : unlocked && !hasUnclaimed(ms.count) ? (
                      <span className="text-xs text-gray-400 px-3 py-1.5 bg-gray-100 rounded-lg">兑换券已发完</span>
                    ) : null}
                  </div>
                </div>

                {/* Admin panel */}
                {showAdmin && (
                  <div className="border-t border-gray-100 px-5 py-3 bg-gray-50">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-gray-500 font-medium">管理员操作</span>
                      {addingFor !== ms.count && (
                        <button
                          onClick={() => openForm(ms.count)}
                          className="flex items-center gap-1 text-xs px-2 py-1 text-blue-600 hover:bg-blue-50 border border-blue-200 rounded-lg transition-colors"
                        >
                          <Plus className="w-3 h-3" /> 添加兑换券
                        </button>
                      )}
                    </div>

                    {/* Existing vouchers */}
                    <div className="space-y-1">
                      {vouchers.filter(v => v.milestoneCount === ms.count).map(v => (
                        <div key={v.id} className="flex items-center gap-2 text-xs text-gray-600 bg-white rounded-lg px-2 py-1.5 border border-gray-200">
                          {v.imageUrl ? (
                            <button onClick={() => setQrViewer(v.imageUrl!)} className="text-blue-600 hover:underline flex items-center gap-1">
                              <QrCode className="w-3 h-3" /> 图片券
                            </button>
                          ) : v.url ? (
                            <a href={v.url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline flex items-center gap-1 min-w-0 flex-1 truncate">
                              <ExternalLink className="w-3 h-3 flex-shrink-0" /> {v.url.slice(0, 40)}…
                            </a>
                          ) : null}
                          {v.claimedBy ? (
                            <span className="flex-shrink-0 text-green-600">已领: {v.claimedByName || v.claimedByEmail}</span>
                          ) : (
                            <span className="flex-shrink-0 text-amber-500">未领取</span>
                          )}
                          <button
                            onClick={() => deleteVoucher(v.id)}
                            className="flex-shrink-0 text-red-400 hover:text-red-600 ml-auto"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Add form */}
                    {addingFor === ms.count && (
                      <div className="mt-2 p-3 bg-white rounded-lg border border-blue-200">
                        <div className="flex gap-2 mb-2">
                          <button
                            onClick={() => setAddMode('url')}
                            className={`text-xs px-2 py-1 rounded ${addMode === 'url' ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-100'}`}
                          >
                            链接
                          </button>
                          <button
                            onClick={() => setAddMode('image')}
                            className={`text-xs px-2 py-1 rounded ${addMode === 'image' ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-100'}`}
                          >
                            图片
                          </button>
                        </div>
                        {addMode === 'url' ? (
                          <textarea
                            value={newUrl}
                            onChange={e => setNewUrl(e.target.value)}
                            placeholder="粘贴兑换码链接（多个链接换行）"
                            rows={3}
                            className="w-full text-xs border border-gray-300 rounded p-2 focus:ring-1 focus:ring-blue-500 outline-none resize-none"
                          />
                        ) : (
                          <div>
                            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                            {newImage ? (
                              <div className="flex items-center gap-2">
                                <img src={newImage} alt="preview" className="h-16 rounded" />
                                <button onClick={() => setNewImage(null)} className="text-xs text-red-500">移除</button>
                              </div>
                            ) : (
                              <button
                                onClick={() => fileInputRef.current?.click()}
                                className="w-full py-4 border-2 border-dashed border-gray-300 rounded-lg text-xs text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-colors"
                              >
                                点击上传二维码图片
                              </button>
                            )}
                          </div>
                        )}
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={() => setAddingFor(null)}
                            className="flex-1 px-3 py-1.5 text-xs text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg"
                          >
                            取消
                          </button>
                          <button
                            onClick={() => saveVoucher(ms.count)}
                            disabled={saving || (addMode === 'url' ? !newUrl.trim() : !newImage)}
                            className="flex-1 px-3 py-1.5 text-xs text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg flex items-center justify-center gap-1"
                          >
                            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                            保存
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
