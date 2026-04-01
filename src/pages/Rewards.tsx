import { useEffect, useState } from 'react';
import { collection, onSnapshot, addDoc, runTransaction, doc, query, where, getDocs, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Link } from 'react-router-dom';
import { ArrowLeft, Trophy, Gift, Plus, ExternalLink, Loader2, Trash2 } from 'lucide-react';

const MILESTONES = [
  { count: 3,   topN: 4, reward: '喜茶饮品券',            emoji: '🧋' },
  { count: 10,  topN: 3, reward: '李先生牛肉面',            emoji: '🍜' },
  { count: 20,  topN: 3, reward: '喜家德水饺',              emoji: '🥟' },
  { count: 30,  topN: 2, reward: '肯德基礼品卡',            emoji: '🍗' },
  { count: 50,  topN: 2, reward: '星巴克礼品卡',            emoji: '☕' },
  { count: 100, topN: 1, reward: '安小胖韩国烤肉 2-3 人餐', emoji: '🥩' },
  { count: 150, topN: 1, reward: '熊喵来了火锅双人餐',      emoji: '🍲' },
];


type UserStat  = { uid: string; name: string; email: string; count: number };
type Voucher   = { id: string; milestoneCount: number; url: string; claimedBy: string | null; claimedByEmail: string | null };

export default function Rewards({ user, userData }: { user: any; userData?: any }) {
  const isAdmin = userData?.role === 'admin';

  const [stats,       setStats]       = useState<UserStat[]>([]);
  const [vouchers,    setVouchers]    = useState<Voucher[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [claiming,    setClaiming]    = useState<number | null>(null);
  const [previewMode, setPreviewMode] = useState(false);

  // Admin add-voucher form
  const [addingFor,  setAddingFor]  = useState<number | null>(null);
  const [newUrl,     setNewUrl]     = useState('');
  const [saving,     setSaving]     = useState(false);

  const showAdmin = isAdmin && !previewMode;

  // --- listen patients ---
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

  // --- listen vouchers ---
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'vouchers'), (snap) => {
      setVouchers(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
    });
    return () => unsub();
  }, []);

  // --- claim a voucher ---
  const claim = async (milestoneCount: number) => {
    setClaiming(milestoneCount);
    try {
      // find unclaimed vouchers for this milestone
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
        tx.update(target.ref, {
          claimedBy:      user.uid,
          claimedByEmail: user.email,
          claimedAt:      serverTimestamp(),
        });
      });
    } catch (e: any) {
      if (e.message !== 'already_claimed') alert('领取失败，请重试。');
    } finally {
      setClaiming(null);
    }
  };

  // --- admin add voucher ---
  const saveVoucher = async (milestoneCount: number) => {
    const raw = newUrl.trim();
    const urls = raw
      .split(/(?=https?:\/\/)/)
      .map(u => u.trim())
      .filter(u => u.length > 0);
    if (urls.length === 0) return;
    setSaving(true);
    try {
      await Promise.all(urls.map(url => addDoc(collection(db, 'vouchers'), {
        milestoneCount,
        url,
        claimedBy:      null,
        claimedByEmail: null,
        claimedAt:      null,
      })));
      setNewUrl('');
      setAddingFor(null);
    } finally {
      setSaving(false);
    }
  };

  const deleteVoucher = async (id: string) => {
    if (!confirm('确认删除这条兑换券？')) return;
    await deleteDoc(doc(db, 'vouchers', id));
  };

  const myVoucher   = (milestoneCount: number) => vouchers.find(v => v.milestoneCount === milestoneCount && v.claimedBy === user.uid);
  const hasUnclaimed = (milestoneCount: number) => vouchers.some(v => v.milestoneCount === milestoneCount && !v.claimedBy);
  const countFor    = (milestoneCount: number) => ({
    total:     vouchers.filter(v => v.milestoneCount === milestoneCount).length,
    unclaimed: vouchers.filter(v => v.milestoneCount === milestoneCount && !v.claimedBy).length,
    claimed:   vouchers.filter(v => v.milestoneCount === milestoneCount &&  v.claimedBy).length,
  });


  return (
    <div className="min-h-screen bg-gray-50">
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
          <h2 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <Gift className="w-5 h-5 text-pink-500" /> 奖励规则
          </h2>
          <div className="space-y-2">
            {MILESTONES.map(m => {
              const c = countFor(m.count);
              return (
                <div key={m.count} className="flex items-center gap-3 text-sm">
                  <span className="text-xl w-8 text-center">{m.emoji}</span>
                  <span className="text-gray-500 w-24 shrink-0">
                    达到 <span className="font-bold text-gray-800">{m.count} 例</span>
                  </span>
                  <span className="text-gray-400 shrink-0">前 {m.topN} 名</span>
                  <span className="text-gray-700 font-medium flex-1">{m.reward}</span>
                  {c.total > 0 && (
                    <span className={`text-xs shrink-0 ${c.unclaimed === 0 ? 'text-red-400' : 'text-gray-400'}`}>
                      剩 {c.unclaimed}/{c.total}
                    </span>
                  )}
                  {showAdmin && (
                    <button
                      onClick={() => { setAddingFor(m.count); setNewUrl(''); }}
                      className="text-blue-500 hover:text-blue-700 shrink-0"
                      title="添加兑换链接"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* 管理员添加链接表单 */}
          {showAdmin && addingFor !== null && (
            <div className="mt-4 p-3 bg-blue-50 rounded-lg space-y-2">
              <p className="text-sm font-medium text-blue-800">
                添加「{MILESTONES.find(m => m.count === addingFor)?.emoji} {MILESTONES.find(m => m.count === addingFor)?.reward}」兑换链接
              </p>
              <textarea
                value={newUrl}
                onChange={e => setNewUrl(e.target.value)}
                placeholder={"粘贴兑换链接（支持多条，每行一个）…"}
                rows={4}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none font-mono"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => saveVoucher(addingFor)}
                  disabled={saving || !newUrl.trim()}
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

          {/* 管理员：显示已添加的券 + 删除按钮 */}
          {showAdmin && addingFor !== null && (
            <div className="mt-2 space-y-1">
              {vouchers.filter(v => v.milestoneCount === addingFor).map(v => (
                <div key={v.id} className="flex items-center gap-2 text-xs px-1">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${v.claimedBy ? 'bg-green-400' : 'bg-gray-300'}`} />
                  <span className="flex-1 truncate font-mono text-gray-500">{v.url}</span>
                  <span className="shrink-0 text-gray-400">
                    {v.claimedBy
                      ? `已领 (${stats.find(s => s.uid === v.claimedBy)?.name ?? v.claimedByEmail?.split('@')[0]})`
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

        {/* 我的进度 */}
        {(() => {
          const myStat   = stats.find(s => s.uid === user?.uid);
          const myCount  = myStat?.count ?? 0;
          const nextMile = MILESTONES.find(m => myCount < m.count);
          const earnedList = MILESTONES.filter(m => myCount >= m.count);

          return (
            <div className="bg-white rounded-xl shadow-sm border-2 border-blue-300 p-4">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-2xl">👤</span>
                <div className="flex-1">
                  <div className="font-semibold text-gray-900">{myStat?.name ?? '我'}</div>
                  <div className="text-xs text-gray-400">{myStat?.email ?? user?.email}</div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-blue-600">{myCount}</div>
                  <div className="text-xs text-gray-400">例</div>
                </div>
              </div>

              {loading && <div className="text-gray-400 text-sm">加载中…</div>}

              {/* 进度条 */}
              {nextMile && (
                <div className="mb-3">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>距下一奖励：{nextMile.emoji} {nextMile.reward}</span>
                    <span>{myCount}/{nextMile.count}</span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full transition-all"
                      style={{ width: `${Math.min(100, (myCount / nextMile.count) * 100)}%` }}
                    />
                  </div>
                </div>
              )}

              {/* 已解锁的奖励 */}
              {earnedList.length > 0 && (
                <div className="space-y-1.5">
                  {earnedList.map(m => {
                    const mv        = myVoucher(m.count);
                    const canClaim  = !mv && hasUnclaimed(m.count);
                    const isClaiming = claiming === m.count;
                    return (
                      <div key={m.count} className="flex items-center gap-2 flex-wrap">
                        <span className="inline-flex items-center gap-1 text-xs bg-green-50 text-green-700 border border-green-200 rounded-full px-2 py-0.5">
                          ✓ {m.emoji} {m.reward}
                        </span>
                        {canClaim && (
                          <button
                            onClick={() => claim(m.count)}
                            disabled={isClaiming}
                            className="text-xs bg-orange-500 hover:bg-orange-600 text-white px-3 py-0.5 rounded-full flex items-center gap-1 disabled:opacity-60"
                          >
                            {isClaiming ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                            领取兑换券
                          </button>
                        )}
                        {mv && (
                          <a href={mv.url} target="_blank" rel="noopener noreferrer"
                            className="text-xs bg-blue-50 text-blue-600 border border-blue-200 px-3 py-0.5 rounded-full flex items-center gap-1 hover:bg-blue-100"
                          >
                            <ExternalLink className="w-3 h-3" /> 点击兑换
                          </a>
                        )}
                        {!mv && !hasUnclaimed(m.count) && (
                          <span className="text-xs text-gray-400">兑换券待补充</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {!nextMile && earnedList.length > 0 && (
                <div className="mt-2 text-xs text-center text-purple-600 font-medium">🎉 所有奖励已全部达成！</div>
              )}

              {myCount === 0 && !loading && (
                <div className="text-sm text-gray-400 text-center py-2">还没有录入记录，快去录入第一例吧！</div>
              )}
            </div>
          );
        })()}

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
                        {stats.find(s => s.uid === v.claimedBy)?.name ?? v.claimedByEmail?.split('@')[0]}
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
