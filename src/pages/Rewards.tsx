import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { Link } from 'react-router-dom';
import { ArrowLeft, Trophy, Gift } from 'lucide-react';

const MILESTONES = [
  { count: 3,   topN: 4, reward: '喜茶饮品券',          emoji: '🧋' },
  { count: 10,  topN: 3, reward: '李先生牛肉面',          emoji: '🍜' },
  { count: 20,  topN: 3, reward: '喜家德水饺',            emoji: '🥟' },
  { count: 30,  topN: 2, reward: '肯德基礼品卡',          emoji: '🍗' },
  { count: 50,  topN: 2, reward: '星巴克礼品卡',          emoji: '☕' },
  { count: 100, topN: 1, reward: '安小胖韩国烤肉 2-3 人餐', emoji: '🥩' },
  { count: 150, topN: 1, reward: '熊喵来了火锅双人餐',    emoji: '🍲' },
];

const RANK_COLORS = ['text-yellow-500', 'text-gray-400', 'text-amber-600'];
const RANK_BG    = ['bg-yellow-50 border-yellow-200', 'bg-gray-50 border-gray-200', 'bg-amber-50 border-amber-200'];

type UserStat = { uid: string; name: string; email: string; count: number };

export default function Rewards({ user }: { user: any }) {
  const [stats, setStats] = useState<UserStat[]>([]);
  const [loading, setLoading] = useState(true);

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
      const sorted = Object.values(map).sort((a, b) => b.count - a.count);
      setStats(sorted);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const earned = (stat: UserStat, rank: number) =>
    MILESTONES.filter(m => stat.count >= m.count && rank < m.topN);

  const next = (stat: UserStat, rank: number) =>
    MILESTONES.find(m => !(stat.count >= m.count && rank < m.topN) && rank < m.topN);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <Trophy className="w-6 h-6 text-yellow-500" />
          <h1 className="text-lg font-bold text-gray-900">录入排行榜 & 奖励</h1>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">

        {/* 奖励说明 */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <h2 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <Gift className="w-5 h-5 text-pink-500" /> 奖励规则
          </h2>
          <div className="space-y-2">
            {MILESTONES.map(m => (
              <div key={m.count} className="flex items-center gap-3 text-sm">
                <span className="text-xl w-8 text-center">{m.emoji}</span>
                <span className="text-gray-500 w-24 shrink-0">
                  达到 <span className="font-bold text-gray-800">{m.count} 例</span>
                </span>
                <span className="text-gray-400 shrink-0">前 {m.topN} 名</span>
                <span className="text-gray-700 font-medium">{m.reward}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 排行榜 */}
        <div className="space-y-3">
          <h2 className="font-semibold text-gray-800 px-1">当前排名</h2>

          {loading && (
            <div className="text-center py-12 text-gray-400">加载中…</div>
          )}

          {!loading && stats.length === 0 && (
            <div className="text-center py-12 text-gray-400">还没有任何录入记录</div>
          )}

          {stats.map((stat, idx) => {
            const rank      = idx + 1;
            const earnedList = earned(stat, idx);
            const nextMile   = next(stat, idx);
            const isMe       = stat.uid === user?.uid;

            return (
              <div
                key={stat.uid}
                className={`bg-white rounded-xl shadow-sm border p-4 ${isMe ? 'ring-2 ring-blue-400' : ''} ${idx < 3 ? RANK_BG[idx] : ''}`}
              >
                <div className="flex items-center gap-3">
                  {/* 名次 */}
                  <div className={`text-2xl font-extrabold w-10 text-center ${idx < 3 ? RANK_COLORS[idx] : 'text-gray-400'}`}>
                    {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : rank}
                  </div>

                  {/* 名字 */}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-900 flex items-center gap-1">
                      {stat.name}
                      {isMe && <span className="text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full">我</span>}
                    </div>
                    <div className="text-xs text-gray-400 truncate">{stat.email}</div>
                  </div>

                  {/* 录入数 */}
                  <div className="text-right">
                    <div className="text-2xl font-bold text-blue-600">{stat.count}</div>
                    <div className="text-xs text-gray-400">例</div>
                  </div>
                </div>

                {/* 进度条：到下一档 */}
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

                {/* 已获奖励 */}
                {earnedList.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {earnedList.map(m => (
                      <span key={m.count} className="inline-flex items-center gap-1 text-xs bg-green-50 text-green-700 border border-green-200 rounded-full px-2 py-0.5">
                        ✓ {m.emoji} {m.reward}
                      </span>
                    ))}
                  </div>
                )}

                {/* 全部达成 */}
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
