import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { Send, ArrowLeft, Loader2, User } from 'lucide-react';
import { Link } from 'react-router-dom';

const socket = io();

export default function Chat({ user }: { user: any }) {
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [messages, setMessages] = useState<{from: string, message: string}[]>([]);
  const [targetUser, setTargetUser] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const username = user.email;
    socket.emit('user:join', username);
    
    socket.on('users:online', (users: string[]) => {
      setOnlineUsers(users.filter(u => u !== username));
    });
    
    socket.on('chat:message', (data: {from: string, message: string}) => {
      setMessages(prev => [...prev, data]);
    });
    
    return () => {
      socket.off('users:online');
      socket.off('chat:message');
    };
  }, [user.email]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUser || !newMessage.trim()) return;

    socket.emit('chat:message', { to: targetUser, message: newMessage, from: user.email });
    setMessages(prev => [...prev, { from: 'Me', message: newMessage }]);
    setNewMessage('');
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
          <h3 className="font-bold mb-4 flex items-center gap-2"><User className="w-4 h-4" /> 在线用户</h3>
          <ul className="space-y-2">
            {onlineUsers.map(u => (
              <li 
                key={u} 
                onClick={() => setTargetUser(u)} 
                className={`cursor-pointer p-2 rounded-lg ${targetUser === u ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}
              >
                {u}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex-1 flex flex-col bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          {targetUser ? (
            <>
              <h4 className="font-semibold mb-4 pb-2 border-b">与 {targetUser} 对话</h4>
              <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-4 mb-4">
                {messages.map((m, i) => (
                  <div key={i} className={`flex flex-col ${m.from === 'Me' ? 'items-end' : 'items-start'}`}>
                    <span className="text-xs text-gray-500">{m.from}</span>
                    <div className={`p-3 rounded-2xl ${m.from === 'Me' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}>
                      {m.message}
                    </div>
                  </div>
                ))}
              </div>
              <form onSubmit={handleSendMessage} className="flex gap-2">
                <input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="输入消息..."
                  className="flex-1 p-3 border rounded-xl"
                />
                <button type="submit" className="bg-blue-600 text-white p-3 rounded-xl"><Send className="w-5 h-5" /></button>
              </form>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400">请选择一个用户开始聊天</div>
          )}
        </div>
      </main>
    </div>
  );
}
