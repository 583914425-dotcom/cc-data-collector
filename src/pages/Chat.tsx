import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { Send, ArrowLeft, User, Circle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

const socket = io();

interface AppUser {
  id: string;
  email: string;
}

export default function Chat({ user }: { user: any }) {
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [allUsers, setAllUsers] = useState<AppUser[]>([]);
  const [messages, setMessages] = useState<{from: string, message: string, to?: string, image?: string, createdAt?: any}[]>([]);
  const [targetUser, setTargetUser] = useState<string | null>('公共频道');
  const [newMessage, setNewMessage] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Fetch all users
    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      console.log('User snapshot received, count:', snapshot.docs.length);
      const data: AppUser[] = [];
      snapshot.forEach((doc) => {
        const userData = doc.data();
        console.log('User found:', userData.email);
        data.push({ id: doc.id, email: userData.email } as AppUser);
      });
      setAllUsers(data);
    }, (error) => {
      console.error('Error fetching users:', error);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    // Listen for messages
    const q = query(collection(db, 'chat_messages'), orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      console.log('Received snapshot, doc count:', snapshot.docs.length);
      const data = snapshot.docs.map(doc => ({
        from: doc.data().from,
        message: doc.data().message,
        to: doc.data().to,
        image: doc.data().image,
        createdAt: doc.data().createdAt
      }));
      console.log('Processed messages:', data);
      setMessages(data);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !user.email) return;
    
    const joinUser = () => {
      socket.emit('user:join', user.email);
    };

    if (socket.connected) {
      joinUser();
    }

    socket.on('connect', joinUser);
    
    socket.on('users:online', (users: string[]) => {
      console.log('Received online users:', users);
      setOnlineUsers(users);
    });
    
    return () => {
      socket.off('connect', joinUser);
      socket.off('users:online');
    };
  }, [user.email]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUser || (!newMessage.trim() && !image)) return;

    const payload: any = { 
      from: user.email,
      to: targetUser === '公共频道' ? 'all' : targetUser,
      createdAt: serverTimestamp()
    };
    
    if (newMessage.trim()) {
      payload.message = newMessage.trim();
    }
    if (image) {
      payload.image = image;
    }
    
    console.log('Sending message:', payload);
    
    try {
      // Save to Firestore
      await addDoc(collection(db, 'chat_messages'), payload);
      console.log('Message saved to Firestore successfully');
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
      reader.onloadend = () => {
        setImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white shadow-sm border-b border-gray-200 h-16 flex items-center px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto w-full flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="p-2 hover:bg-gray-100 rounded-full transition-colors">
              <ArrowLeft className="w-5 h-5 text-gray-500" />
            </Link>
            <h1 className="text-xl font-bold text-gray-900">在线聊天</h1>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full p-4 flex gap-4 overflow-hidden">
        <div className="w-64 bg-white p-4 border rounded-xl shadow-sm">
          <h3 className="font-bold mb-4 flex items-center gap-2"><User className="w-4 h-4" /> 用户列表</h3>
          <ul className="space-y-2">
            <li 
              onClick={() => setTargetUser('公共频道')} 
              className={`cursor-pointer p-2 rounded-lg flex items-center justify-between gap-2 ${targetUser === '公共频道' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}
            >
              <span className="truncate text-sm font-bold">公共频道</span>
            </li>
            {allUsers.map(u => {
              const isOnline = onlineUsers.includes(u.email);
              return (
                <li 
                  key={u.id} 
                  onClick={() => setTargetUser(u.email)} 
                  className={`cursor-pointer p-2 rounded-lg flex items-center justify-between gap-2 ${targetUser === u.email ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}
                >
                  <span className="truncate text-sm">{u.email === user.email ? 'Me (在线)' : u.email}</span>
                  <Circle className={`w-3 h-3 flex-shrink-0 ${isOnline || u.email === user.email ? 'text-green-500 fill-green-500' : 'text-gray-300 fill-gray-300'}`} />
                </li>
              );
            })}
          </ul>
        </div>

        <div className="flex-1 flex flex-col bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <>
            <h4 className="font-semibold mb-4 pb-2 border-b">与 {targetUser} 对话</h4>
            <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-4 mb-4">
              {messages
                .filter(m => {
                  if (targetUser === '公共频道') return m.to === 'all' || !m.to;
                  return (m.to === targetUser && m.from === user.email) || 
                         (m.to === user.email && m.from === targetUser);
                })
                .map((m, i) => (
                <div key={i} className={`flex flex-col ${m.from === user.email ? 'items-end' : 'items-start'}`}>
                  <span className="text-xs text-gray-500">{m.from === user.email ? 'Me' : m.from}</span>
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
                </div>
              ))}
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

      {/* Enlarged Image Modal */}
      {enlargedImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setEnlargedImage(null)}>
          <img src={enlargedImage} alt="enlarged" className="max-w-full max-h-full object-contain rounded-lg" />
        </div>
      )}
    </div>
  );
}
