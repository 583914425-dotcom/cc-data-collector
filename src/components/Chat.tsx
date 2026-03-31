import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';

const socket = io();

export const Chat = ({ username }: { username: string }) => {
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [messages, setMessages] = useState<{from: string, message: string}[]>([]);
  const [targetUser, setTargetUser] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
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
  }, [username]);

  const sendMessage = () => {
    if (targetUser && message) {
      socket.emit('chat:message', { to: targetUser, message, from: username });
      setMessages(prev => [...prev, { from: 'Me', message }]);
      setMessage('');
    }
  };

  return (
    <div className="fixed bottom-4 right-4 w-80 bg-white p-4 border rounded shadow-lg">
      <h3 className="font-bold mb-2">Online Users</h3>
      <ul className="mb-4">
        {onlineUsers.map(u => (
          <li key={u} onClick={() => setTargetUser(u)} className="cursor-pointer flex items-center gap-2 py-1 hover:bg-gray-50 rounded px-1">
            <span className="w-2 h-2 rounded-full bg-green-500 inline-block flex-shrink-0"></span>
            <span className="text-blue-600 hover:underline">{u}</span>
          </li>
        ))}
      </ul>
      {targetUser && (
        <div className="border-t pt-2">
          <h4 className="font-semibold mb-2">Chat with {targetUser}</h4>
          <div className="h-40 overflow-y-auto mb-2 border p-2">
            {messages.map((m, i) => <div key={i} className="text-sm">{m.from}: {m.message}</div>)}
          </div>
          <div className="flex gap-2">
            <input value={message} onChange={e => setMessage(e.target.value)} className="border p-1 flex-grow" />
            <button onClick={sendMessage} className="bg-blue-500 text-white px-2 py-1 rounded">Send</button>
          </div>
        </div>
      )}
    </div>
  );
};
