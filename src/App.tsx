import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthState } from 'react-firebase-hooks/auth';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { socket } from './socket';
import Dashboard from './pages/Dashboard';
import PatientForm from './pages/PatientForm';
import UserManagement from './pages/UserManagement';
import Chat from './pages/Chat';
import { Loader2, LogIn, UserPlus, Chrome } from 'lucide-react';

export default function App() {
  const [user, loading] = useAuthState(auth);
  const [userData, setUserData] = useState<any>(null);
  const [userDataLoading, setUserDataLoading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user?.email) return;
    const joinUser = () => socket.emit('user:join', user.email);
    if (socket.connected) {
      joinUser();
    }
    socket.on('connect', joinUser);
    return () => {
      socket.off('connect', joinUser);
    };
  }, [user?.email]);

  const handleGoogleLogin = async () => {
    setError('');
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      console.error("Google login error:", err);
      setError(`Google 登录失败: ${err.message}`);
    }
  };

  useEffect(() => {
    const fetchUserData = async () => {
      if (user) {
        setUserDataLoading(true);
        try {
          console.log('Fetching user data for UID:', user.uid);
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            console.log('User data found:', userDoc.data());
            setUserData(userDoc.data());
          } else {
            console.log('User data not found, creating new profile...');
            // Create user profile if it doesn't exist
            const newUser = {
              email: user.email,
              role: 'pending',
              createdAt: Date.now()
            };
            await setDoc(doc(db, 'users', user.uid), newUser);
            console.log('User profile created successfully');
            setUserData(newUser);
          }
        } catch (err) {
          console.error("Error fetching user data:", err);
        } finally {
          setUserDataLoading(false);
        }
      } else {
        setUserData(null);
      }
    };
    fetchUserData();
  }, [user]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (isRegistering) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      console.error("Auth error:", err);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('邮箱或密码错误。');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('该邮箱已被注册。');
      } else {
        setError(`出错啦: ${err.message}`);
      }
    }
  };

  if (loading || userDataLoading) {
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

          <div className="mt-4 flex items-center gap-4">
            <div className="flex-1 h-px bg-gray-200"></div>
            <span className="text-xs text-gray-400 uppercase">或者</span>
            <div className="flex-1 h-px bg-gray-200"></div>
          </div>

          <button
            onClick={handleGoogleLogin}
            className="mt-4 w-full bg-white border border-gray-300 text-gray-700 py-3 px-4 rounded-lg hover:bg-gray-50 transition-colors font-medium flex items-center justify-center gap-2"
          >
            <Chrome className="w-5 h-5 text-red-500" />
            使用 Google 账号登录
          </button>

          <div className="mt-6 text-center">
            <button
              onClick={() => setIsRegistering(!isRegistering)}
              className="text-sm text-blue-600 hover:underline"
            >
              {isRegistering ? '已有账号？立即登录' : '没有账号？点击注册'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (userData?.role === 'pending') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">账号审核中</h1>
          <p className="text-gray-600 mb-8">您的账号已创建，但需要管理员审核后才能进入系统。请联系管理员进行授权。</p>
          <button
            onClick={() => signOut(auth)}
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
        <Route path="/" element={<Dashboard user={user} userData={userData} />} />
        <Route path="/patient/new" element={<PatientForm user={user} />} />
        <Route path="/patient/:id" element={<PatientForm user={user} />} />
        <Route path="/users" element={userData?.role === 'admin' ? <UserManagement user={user} /> : <Navigate to="/" replace />} />
        <Route path="/chat" element={<Chat user={user} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
