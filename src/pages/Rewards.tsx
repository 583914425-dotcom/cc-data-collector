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

const RANK_COLORS = ['text-yellow-500', 'text-gray-400', 'text-amber-600'];
const RANK_BG    = ['bg-yellow-50 border-yellow-200', 'bg-gray-50 border-gray-200', 'bg-amber-50 border-amber-200'];

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

  const earned = (stat: UserStat, rank: number) => MILESTONES.filter(m => stat.count >= m.count && rank < m.topN);
  const next   = (stat: UserStat, rank: number) => MILESTONES.find(m => !(stat.count >= m.count && rank < m.topN) && rank < m.topN);

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

        {/* 自助领取说明 */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
          <span className="text-2xl shrink-0">🎁</span>
          <div className="text-sm text-amber-800 space-y-1">
            <p className="font-semibold">奖励自助领取说明</p>
            <p>录入病例达到对应数量后，下方排名卡片里会自动出现 <span className="font-bold">「领取兑换券」</span> 按钮，点击即可获得兑换链接，<span className="font-bold">无需联系管理员</span>。</p>
            <p className="text-amber-600">例：录入满 3 例 → 自动解锁喜茶饮品券，点按钮领走就行 🧋</p>
          </div>
        </div>

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
                  <span className="shrink-0 text-gray-400">{v.claimedBy ? `已领 (${v.claimedByEmail?.split('@')[0]})` : '未领'}</span>
                  <button onClick={() => deleteVoucher(v.id)} className="text-red-400 hover:text-red-600 shrink-0">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 排行榜 */}
        <div className="space-y-3">
          <h2 className="font-semibold text-gray-800 px-1">当前排名</h2>

          {loading && <div className="text-center py-12 text-gray-400">加载中…</div>}
          {!loading && stats.length === 0 && <div className="text-center py-12 text-gray-400">还没有任何录入记录</div>}

          {stats.map((stat, idx) => {
            const isMe       = stat.uid === user?.uid;
            const earnedList = earned(stat, idx);
            const nextMile   = next(stat, idx);

            return (
              <div
                key={stat.uid}
                className={`bg-white rounded-xl shadow-sm border p-4 ${isMe ? 'ring-2 ring-blue-400' : ''} ${idx < 3 ? RANK_BG[idx] : ''}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`text-2xl font-extrabold w-10 text-center ${idx < 3 ? RANK_COLORS[idx] : 'text-gray-400'}`}>
                    {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-900 flex items-center gap-1">
                      {stat.name}
                      {isMe && <span className="text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full">我</span>}
                    </div>
                    <div className="text-xs text-gray-400 truncate">{stat.email}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-blue-600">{stat.count}</div>
                    <div className="text-xs text-gray-400">例</div>
                  </div>
                </div>

                {/* 进度条 */}
                {nextMile && (
                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>距下一奖励：{nextMile.emoji} {nextMile.reward}</span>
                      <span>{stat.count}/{nextMile.count}</span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full transition-all"
                        style={{ width: `${Math.min(100, (stat.count / nextMile.count) * 100)}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* 已获奖励 + 领取按钮（仅本人可见） */}
                {earnedList.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    {earnedList.map(m => {
                      const mv = myVoucher(m.count);
                      const canClaim = isMe && !mv && hasUnclaimed(m.count);
                      const isClaiming = claiming === m.count;

                      return (
                        <div key={m.count} className="flex items-center gap-2 flex-wrap">
                          <span className="inline-flex items-center gap-1 text-xs bg-green-50 text-green-700 border border-green-200 rounded-full px-2 py-0.5">
                            ✓ {m.emoji} {m.reward}
                          </span>

                          {/* 本人且有未领取券 */}
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

                          {/* 本人已领取 — 显示链接 */}
                          {isMe && mv && (
                            <a
                              href={mv.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs bg-blue-50 text-blue-600 border border-blue-200 px-3 py-0.5 rounded-full flex items-center gap-1 hover:bg-blue-100"
                            >
                              <ExternalLink className="w-3 h-3" /> 点击兑换
                            </a>
                          )}

                          {/* 本人且没券可领（已被领完） */}
                          {isMe && !mv && !hasUnclaimed(m.count) && (
                            <span className="text-xs text-gray-400">兑换券待补充</span>
                          )}

                          {/* 管理员查看谁领了 */}
                          {showAdmin && !isMe && (
                            <span className="text-xs text-gray-400">
                              {vouchers.find(v => v.milestoneCount === m.count && v.claimedBy === stat.uid)
                                ? '✓ 已领取'
                                : '未领取'}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {!nextMile && earnedList.length > 0 && (
                  <div className="mt-2 text-xs text-center text-purple-600 font-medium">🎉 所有奖励已全部达成！</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
