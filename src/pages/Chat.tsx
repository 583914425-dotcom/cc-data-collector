import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Send, ArrowLeft, User, Circle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

interface AppUser {
  id: string;
  email: string;
  displayName?: string;
}

function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();

    const playTone = (freq: number, startTime: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.38, startTime + 0.01);
      gain.gain.setValueAtTime(0.38, startTime + 0.07);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.13);
      osc.start(startTime);
      osc.stop(startTime + 0.14);
    };

    playTone(880, ctx.currentTime);
    playTone(1108, ctx.currentTime + 0.15);
    playTone(1397, ctx.currentTime + 0.30);
  } catch (_) {}
}

export default function Chat({ user, onEnter, onLeave }: { user: any, onEnter?: () => void, onLeave?: () => void }) {
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [allUsers, setAllUsers] = useState<AppUser[]>([]);
  const [messages, setMessages] = useState<{from: string, message: string, to?: string, image?: string, createdAt?: any}[]>([]);
  const [targetUser, setTargetUser] = useState<string | null>('公共频道');
  const [newMessage, setNewMessage] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevMessagesRef = useRef<typeof messages>([]);
  const targetUserRef = useRef(targetUser);

  useEffect(() => {
    onEnter?.();
    return () => { onLeave?.(); };
  }, []);

  useEffect(() => {
    targetUserRef.current = targetUser;
  }, [targetUser]);

  useEffect(() => {
    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: AppUser[] = [];
      snapshot.forEach((doc) => {
        const userData = doc.data();
        data.push({ id: doc.id, email: userData.email, displayName: userData.displayName || '' } as AppUser);
      });
      setAllUsers(data);
    }, (error) => {
      console.error('Error fetching users:', error);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'chat_messages'), orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        from: doc.data().from,
        message: doc.data().message,
        to: doc.data().to,
        image: doc.data().image,
        createdAt: doc.data().createdAt
      }));

      const prev = prevMessagesRef.current;
      if (prev.length > 0 && data.length > prev.length) {
        const newMsgs = data.slice(prev.length);
        newMsgs.forEach(msg => {
          if (msg.from === user.email) return;

          const isPublic = msg.to === 'all' || !msg.to;
          const isPrivateToMe = msg.to === user.email;
          if (!isPublic && !isPrivateToMe) return;

          const conversationKey = isPublic ? '公共频道' : msg.from;
          const currentTarget = targetUserRef.current;

          playNotificationSound();
          if (currentTarget !== conversationKey) {
            setUnreadCounts(prev => ({
              ...prev,
              [conversationKey]: (prev[conversationKey] || 0) + 1
            }));
          }
        });
      }

      prevMessagesRef.current = data;
      setMessages(data);
    });

    return () => unsubscribe();
  }, [user.email]);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'presence'), (snapshot) => {
      const emails = snapshot.docs.map(doc => doc.data().email as string);
      setOnlineUsers(emails);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'auto' });
  }, [messages, targetUser]);

  const handleSelectConversation = useCallback((key: string) => {
    setTargetUser(key);
    setUnreadCounts(prev => ({ ...prev, [key]: 0 }));
  }, []);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUser || (!newMessage.trim() && !image)) return;

    const payload: any = { 
      from: user.email,
      to: targetUser === '公共频道' ? 'all' : targetUser,
      createdAt: serverTimestamp()
    };
    
    if (newMessage.trim()) payload.message = newMessage.trim();
    if (image) payload.image = image;
    
    try {
      await addDoc(collection(db, 'chat_messages'), payload);
    } catch (error) {
      console.error('Error saving message to Firestore:', error);
    }

    setNewMessage('');
    setImage(null);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const totalUnread = Object.values(unreadCounts).reduce((a, b) => a + b, 0);

  useEffect(() => {
    const original = document.title;
    if (totalUnread > 0) {
      document.title = `(${totalUnread}) 新消息 — 在线聊天`;
    } else {
      document.title = '在线聊天';
    }
    return () => { document.title = original; };
  }, [totalUnread]);

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      <header className="bg-white shadow-sm border-b border-gray-200 h-16 flex items-center px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto w-full flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="p-2 hover:bg-gray-100 rounded-full transition-colors">
              <ArrowLeft className="w-5 h-5 text-gray-500" />
            </Link>
            <h1 className="text-xl font-bold text-gray-900">
              在线聊天
              {totalUnread > 0 && (
                <span className="ml-2 bg-red-500 text-white text-xs font-bold rounded-full px-2 py-0.5">
                  {totalUnread}
                </span>
              )}
            </h1>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full p-4 flex gap-4 overflow-hidden">
        <div className="w-64 bg-white p-4 border rounded-xl shadow-sm">
          <h3 className="font-bold mb-4 flex items-center gap-2"><User className="w-4 h-4" /> 用户列表</h3>
          <ul className="space-y-2">
            <li 
              onClick={() => handleSelectConversation('公共频道')} 
              className={`cursor-pointer p-2 rounded-lg flex items-center justify-between gap-2 ${targetUser === '公共频道' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}
            >
              <span className="truncate text-sm font-bold">公共频道</span>
              {(unreadCounts['公共频道'] || 0) > 0 && (
                <span className="bg-red-500 text-white text-xs font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1">
                  {unreadCounts['公共频道']}
                </span>
              )}
            </li>
            {allUsers.map(u => {
              const isOnline = onlineUsers.includes(u.email);
              const unread = unreadCounts[u.email] || 0;
              return (
                <li 
                  key={u.id} 
                  onClick={() => handleSelectConversation(u.email)} 
                  className={`cursor-pointer p-2 rounded-lg flex items-center justify-between gap-2 ${targetUser === u.email ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}
                >
                  <span className="truncate text-sm">{u.email === user.email ? `${u.displayName || u.email} (我)` : (u.displayName || u.email)}</span>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {unread > 0 && (
                      <span className="bg-red-500 text-white text-xs font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1">
                        {unread}
                      </span>
                    )}
                    <Circle className={`w-3 h-3 ${isOnline || u.email === user.email ? 'text-green-500 fill-green-500' : 'text-gray-300 fill-gray-300'}`} />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="flex-1 flex flex-col bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <>
            <h4 className="font-semibold mb-4 pb-2 border-b">
              与 {targetUser === '公共频道' ? '公共频道' : (allUsers.find(u => u.email === targetUser)?.displayName || targetUser)} 对话
            </h4>
            <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-4 mb-4">
              {messages
                .filter(m => {
                  if (targetUser === '公共频道') return m.to === 'all' || !m.to;
                  return (m.to === targetUser && m.from === user.email) || 
                         (m.to === user.email && m.from === targetUser);
                })
                .map((m, i) => (
                <div key={i} className={`flex flex-col ${m.from === user.email ? 'items-end' : 'items-start'}`}>
                  <span className="text-xs text-gray-500 mb-0.5">{m.from === user.email ? (allUsers.find(u => u.email === user.email)?.displayName || '我') : (allUsers.find(u => u.email === m.from)?.displayName || m.from)}</span>
                  <div className={`p-3 rounded-2xl ${m.from === user.email ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}>
                    {m.message}
                    {m.image && (
                      <img 
                        src={m.image} 
                        alt="chat" 
                        className="max-w-xs mt-2 rounded-lg cursor-pointer hover:opacity-80 transition-opacity" 
                        onClick={() => setEnlargedImage(m.image || null)}
                      />
                    )}
                  </div>
                  {m.createdAt && (
                    <span className="text-xs text-gray-400 mt-0.5">
                      {m.createdAt.toDate
                        ? m.createdAt.toDate().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
                        : new Date(m.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
            {image && (
              <div className="mb-2 p-2 bg-gray-100 rounded-lg inline-block">
                <img src={image} alt="preview" className="w-20 h-20 object-cover rounded" />
                <button onClick={() => setImage(null)} className="text-xs text-red-500">取消</button>
              </div>
            )}
            <form onSubmit={handleSendMessage} className="flex gap-2">
              <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageChange} className="hidden" />
              <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2 text-gray-500 hover:text-blue-600">图片</button>
              <input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="输入消息..."
                className="flex-1 p-3 border rounded-xl"
              />
              <button type="submit" className="bg-blue-600 text-white p-3 rounded-xl"><Send className="w-5 h-5" /></button>
            </form>
          </>
        </div>
      </main>

      {enlargedImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setEnlargedImage(null)}>
          <img src={enlargedImage} alt="enlarged" className="max-w-full max-h-full object-contain rounded-lg" />
        </div>
      )}
    </div>
  );
}
