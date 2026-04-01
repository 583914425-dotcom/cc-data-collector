import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { pb } from './lib/pb';
import { setOnline, setOffline, startHeartbeat } from './presence';
import Dashboard from './pages/Dashboard';
import PatientForm from './pages/PatientForm';
import UserManagement from './pages/UserManagement';
import Chat from './pages/Chat';
import Rewards from './pages/Rewards';
import { Loader2, LogIn, UserPlus } from 'lucide-react';

function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const note = (freq: number, t: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc2.connect(gain2); gain2.connect(ctx.destination);
      osc.type = 'sine'; osc.frequency.value = freq;
      osc2.type = 'sine'; osc2.frequency.value = freq * 2.756;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.38, t + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      gain2.gain.setValueAtTime(0, t);
      gain2.gain.linearRampToValueAtTime(0.09, t + 0.005);
      gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      osc.start(t); osc.stop(t + 0.30);
      osc2.start(t); osc2.stop(t + 0.15);
    };
    note(1046.5,  ctx.currentTime);
    note(1318.5,  ctx.currentTime + 0.11);
    note(1567.98, ctx.currentTime + 0.22);
    setTimeout(() => ctx.close().catch(() => {}), 1200);
  } catch (_) {}
}

export default function App() {
  const [user, setUser] = useState<any>(pb.authStore.model);
  const [loading, setLoading] = useState(true);
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [chatUnread, setChatUnread] = useState(0);
  const isOnChatPageRef = useRef(false);

  // Listen to PocketBase auth store changes
  useEffect(() => {
    const unsub = pb.authStore.onChange((_token, model) => {
      setUser(model as any);
      setLoading(false);
    }, true);
    return () => unsub();
  }, []);

  // Presence management
  useEffect(() => {
    if (!user?.id || !user?.email) return;
    setOnline(user.id, user.email);
    const stopHeartbeat = startHeartbeat(user.id);
    const handleUnload = () => setOffline(user.id);
    window.addEventListener('beforeunload', handleUnload);
    return () => {
      stopHeartbeat();
      window.removeEventListener('beforeunload', handleUnload);
      setOffline(user.id);
    };
  }, [user?.id, user?.email]);

  // Chat unread badge
  useEffect(() => {
    if (!user?.email) return;
    let unsubFn: (() => void) | null = null;
    pb.collection('chat_messages').subscribe('*', (e) => {
      if (e.action === 'create') {
        const msg = e.record;
        if (msg.from !== user.email && !isOnChatPageRef.current) {
          playNotificationSound();
          setChatUnread(prev => prev + 1);
        }
      }
    }).then(fn => { unsubFn = fn; }).catch(() => {});
    return () => {
      if (unsubFn) unsubFn();
      else pb.collection('chat_messages').unsubscribe('*').catch(() => {});
    };
  }, [user?.email]);

  const clearChatUnread = useCallback(() => {
    setChatUnread(0);
    isOnChatPageRef.current = true;
  }, []);

  const onChatLeave = useCallback(() => {
    isOnChatPageRef.current = false;
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (isRegistering) {
        await pb.collection('users').create({
          email,
          password,
          passwordConfirm: password,
          role: 'pending',
        });
        await pb.collection('users').authWithPassword(email, password);
      } else {
        await pb.collection('users').authWithPassword(email, password);
      }
    } catch (err: any) {
      console.error("Auth error:", err);
      const msg: string = err?.response?.message || err?.message || '';
      if (msg.toLowerCase().includes('invalid') || msg.toLowerCase().includes('credentials') || msg.toLowerCase().includes('password')) {
        setError('邮箱或密码错误。');
      } else if (msg.toLowerCase().includes('already exists') || msg.toLowerCase().includes('unique')) {
        setError('该邮箱已被注册。');
      } else {
        setError(`出错啦: ${msg || '请稍后重试'}`);
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">医学预测模型数据采集系统</h1>
            <p className="text-gray-600">{isRegistering ? '注册新账号' : '请登录以进入系统'}</p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">邮箱地址</label>
              <input
                type="email"
                placeholder="example@hospital.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">密码</label>
              <input
                type="password"
                placeholder="请输入密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center justify-center gap-2"
            >
              {isRegistering ? <><UserPlus className="w-5 h-5" /> 注册</> : <><LogIn className="w-5 h-5" /> 登录</>}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => { setIsRegistering(!isRegistering); setError(''); }}
              className="text-sm text-blue-600 hover:underline"
            >
              {isRegistering ? '已有账号？立即登录' : '没有账号？点击注册'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (user?.role === 'pending') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">账号审核中</h1>
          <p className="text-gray-600 mb-8">您的账号已创建，但需要管理员审核后才能进入系统。请联系管理员进行授权。</p>
          <button
            onClick={() => pb.authStore.clear()}
            className="w-full bg-gray-200 text-gray-700 py-3 px-4 rounded-lg hover:bg-gray-300 transition-colors font-medium"
          >
            退出登录
          </button>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard user={user} userData={user} chatUnread={chatUnread} />} />
        <Route path="/patient/new" element={<PatientForm user={user} />} />
        <Route path="/patient/:id" element={<PatientForm user={user} />} />
        <Route path="/users" element={user?.role === 'admin' ? <UserManagement user={user} /> : <Navigate to="/" replace />} />
        <Route path="/chat" element={<Chat user={user} onEnter={clearChatUnread} onLeave={onChatLeave} />} />
        <Route path="/rewards" element={<Rewards user={user} userData={user} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
