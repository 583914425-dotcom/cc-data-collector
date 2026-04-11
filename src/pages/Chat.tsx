import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Send, ArrowLeft, User, Trash2, Undo2, Eraser } from 'lucide-react';
import { Link } from 'react-router-dom';
import { pb } from '../lib/pb';

function playTriTone(ctx: AudioContext, freq: number, t: number, vol: number) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc.connect(gain); gain.connect(ctx.destination);
  osc2.connect(gain2); gain2.connect(ctx.destination);
  osc.type = 'sine'; osc.frequency.value = freq;
  osc2.type = 'sine'; osc2.frequency.value = freq * 2.756;
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(vol, t + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
  gain2.gain.setValueAtTime(0, t);
  gain2.gain.linearRampToValueAtTime(vol * 0.25, t + 0.005);
  gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
  osc.start(t); osc.stop(t + 0.30);
  osc2.start(t); osc2.stop(t + 0.15);
}

function playMessageSent() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    playTriTone(ctx, 1046.5, ctx.currentTime, 0.30);
    playTriTone(ctx, 1318.5, ctx.currentTime + 0.11, 0.30);
    setTimeout(() => ctx.close().catch(() => {}), 1000);
  } catch (_) {}
}

function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    playTriTone(ctx, 1046.5, ctx.currentTime, 0.38);
    playTriTone(ctx, 1318.5, ctx.currentTime + 0.11, 0.38);
    playTriTone(ctx, 1567.98, ctx.currentTime + 0.22, 0.38);
    setTimeout(() => ctx.close().catch(() => {}), 1200);
  } catch (_) {}
}

interface AppUser {
  id: string;
  email: string;
  name?: string;
  avatarUrl?: string;
}

const AVATAR_COLORS = [
  'bg-blue-500', 'bg-purple-500', 'bg-green-500', 'bg-yellow-500',
  'bg-red-500', 'bg-pink-500', 'bg-indigo-500', 'bg-teal-500',
  'bg-orange-500', 'bg-cyan-500',
];

function getAvatarColor(email: string | undefined): string {
  const str = email || '';
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitial(displayName: string | undefined, email: string | undefined): string {
  const name = displayName || email || '?';
  return name.charAt(0).toUpperCase();
}

function Avatar({ email, displayName, avatarUrl, size = 'md' }: { email?: string, displayName?: string, avatarUrl?: string, size?: 'sm' | 'md' }) {
  const color = getAvatarColor(email);
  const initial = getInitial(displayName, email);
  const sizeClass = size === 'sm' ? 'w-7 h-7 text-xs' : 'w-8 h-8 text-sm';
  if (avatarUrl) {
    return (
      <div className={`${sizeClass} rounded-full overflow-hidden flex-shrink-0 border border-gray-200`}>
        <img src={avatarUrl} alt={displayName || email} className="w-full h-full object-cover" />
      </div>
    );
  }
  return (
    <div className={`${color} ${sizeClass} rounded-full flex items-center justify-center text-white font-bold flex-shrink-0`}>
      {initial}
    </div>
  );
}

export default function Chat({ user, onEnter, onLeave }: { user: any, onEnter?: () => void, onLeave?: () => void }) {
  const [onlineUsers, setOnlineUsers] = useState<{email: string, lastSeen: number}[]>([]);
  const [allUsers, setAllUsers] = useState<AppUser[]>([]);
  const [messages, setMessages] = useState<{id: string, from: string, message?: string, to?: string, image?: string, createdAt?: any, recalled?: boolean}[]>([]);
  const [hoveredMsgId, setHoveredMsgId] = useState<string | null>(null);
  const [localClearedAt, setLocalClearedAt] = useState<Record<string, number>>({});
  const [targetUser, setTargetUser] = useState<string | null>('公共频道');
  const [newMessage, setNewMessage] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [emojiTab, setEmojiTab] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
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

  const EMOJIS = [
    { label: '常用', list: ['😊','😂','🤣','❤️','😍','🥰','😘','😁','😄','😃','😀','🙂','😉','😋','😎','🤩','🥳','😏','😒','😞','😔','😟','😕','🙁','😣','😖','😫','😩','🥺','😢','😭','😤','😠','😡','🤬','🤯','😳','🥵','🥶','😱','😨','😰','😥','😓','🤗','🤔','🤭','🤫','🤥','😶','😐','😑','😬','🙄','😯','😦','😧','😮','😲','🥱','😴','🤤','😪','😵','🤐','🥴','🤢','🤮','🤧','😷','🤒','🤕','🤑','🤠','😈','👿','👹','👺','💀','☠️','👻','👽','🤖','💩'] },
    { label: '手势', list: ['👋','🤚','🖐️','✋','🖖','👌','🤌','🤏','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','🖕','👇','☝️','👍','👎','✊','👊','🤛','🤜','👏','🙌','👐','🤲','🤝','🙏'] },
    { label: '动物', list: ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🙈','🙉','🙊','🐔','🐧','🐦','🐤','🦆','🦅','🦉','🦇','🐝','🐛','🦋','🐌'] },
    { label: '食物', list: ['🍎','🍊','🍋','🍇','🍓','🫐','🍈','🍒','🍑','🥭','🍍','🥥','🥝','🍅','🥑','🍆','🥦','🥬','🥒','🫑','🌽','🥕','🧄','🥜','🍞','🥐','🧀','🥚','🍳','🥞','🍗','🍖','🌭','🍔','🍟','🍕','🥙','🌮','🌯','🍝','🍜','🍲','🍣','🍱','🥟','🍤','🍙','🍘','🍡','🍧','🍨','🍦','🥧','🧁','🍰','🎂','🍮','🍭','🍬','🍫','🍿','🍩','🍪','🍯','☕','🍵','🍺','🥂','🍷','🥃'] },
    { label: '符号', list: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❤️‍🔥','💕','💞','💓','💗','💖','💘','💝','💯','🆗','🆙','🆒','🆕','🆓','‼️','⁉️','❗','❕','❓','❔','🔔','🎵','🎶','⚠️','✅','❌','⭕','🔥','💧','⭐','🌟','✨'] },
  ];

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(false);
      }
    }
    if (showEmojiPicker) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showEmojiPicker]);

  const insertEmoji = (emoji: string) => {
    const input = inputRef.current;
    if (!input) { setNewMessage(prev => prev + emoji); return; }
    const start = input.selectionStart ?? newMessage.length;
    const end = input.selectionEnd ?? newMessage.length;
    const next = newMessage.slice(0, start) + emoji + newMessage.slice(end);
    setNewMessage(next);
    setTimeout(() => {
      input.focus();
      const pos = start + emoji.length;
      input.setSelectionRange(pos, pos);
    }, 0);
  };

  // Load all users + subscribe
  useEffect(() => {
    let unsubFn: (() => void) | null = null;

    const fetchUsers = async () => {
      try {
        const records = await pb.collection('users').getFullList();
        setAllUsers(records.map((r: any) => ({
          id: r.id,
          email: r.email,
          name: r.name || '',
          avatarUrl: r.avatarUrl || '',
        })));
      } catch (_) {}
    };

    fetchUsers();
    pb.collection('users').subscribe('*', fetchUsers).then(fn => { unsubFn = fn; }).catch(() => {});
    return () => {
      if (unsubFn) unsubFn();
      else pb.collection('users').unsubscribe('*').catch(() => {});
    };
  }, []);

  // Load messages + subscribe
  useEffect(() => {
    let unsubFn: (() => void) | null = null;

    const fetchMessages = async () => {
      try {
        const records = await pb.collection('chat_messages').getFullList({ sort: 'created' });
        const data = records.map((r: any) => ({
          id: r.id,
          from: r.from,
          message: r.message,
          to: r.to,
          image: r.image,
          createdAt: r.created,
          recalled: r.recalled || false,
        }));
        prevMessagesRef.current = data;
        setMessages(data);
      } catch (_) {}
    };

    fetchMessages();

    pb.collection('chat_messages').subscribe('*', (e) => {
      const msg = e.record;
      if (e.action === 'create') {
        const newMsg = {
          id: msg.id,
          from: msg.from,
          message: msg.message,
          to: msg.to,
          image: msg.image,
          createdAt: msg.created,
          recalled: msg.recalled || false,
        };

        // Notification logic
        if (msg.from !== user.email && !msg.recalled) {
          const isPublic = msg.to === 'all' || !msg.to;
          const isPrivateToMe = msg.to === user.email;
          if (isPublic || isPrivateToMe) {
            const conversationKey = isPublic ? '公共频道' : msg.from;
            const currentTarget = targetUserRef.current;
            playNotificationSound();
            if (currentTarget !== conversationKey) {
              setUnreadCounts(prev => ({
                ...prev,
                [conversationKey]: (prev[conversationKey] || 0) + 1,
              }));
            }
          }
        }

        setMessages(prev => [...prev, newMsg]);
      } else if (e.action === 'update') {
        setMessages(prev => prev.map(m => m.id === msg.id ? {
          ...m,
          message: msg.message,
          image: msg.image,
          recalled: msg.recalled || false,
        } : m));
      } else if (e.action === 'delete') {
        setMessages(prev => prev.filter(m => m.id !== msg.id));
      }
    }).then(fn => { unsubFn = fn; }).catch(() => {});

    return () => {
      if (unsubFn) unsubFn();
      else pb.collection('chat_messages').unsubscribe('*').catch(() => {});
    };
  }, [user.email]);

  // Presence subscription
  useEffect(() => {
    let unsubFn: (() => void) | null = null;

    const fetchPresence = async () => {
      try {
        const records = await pb.collection('presence').getFullList();
        const now = Date.now();
        const users = records
          .map((r: any) => ({ email: r.email as string, lastSeen: r.lastSeen ? new Date(r.lastSeen).getTime() : now }))
          .filter(u => now - u.lastSeen < 2 * 60 * 1000);
        setOnlineUsers(users);
      } catch (_) {}
    };

    fetchPresence();
    pb.collection('presence').subscribe('*', fetchPresence).then(fn => { unsubFn = fn; }).catch(() => {});
    return () => {
      if (unsubFn) unsubFn();
      else pb.collection('presence').unsubscribe('*').catch(() => {});
    };
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
    };
    if (newMessage.trim()) payload.message = newMessage.trim();
    if (image) payload.image = image;

    try {
      await pb.collection('chat_messages').create(payload);
      playMessageSent();
    } catch (error) {
      console.error('Error saving message:', error);
    }

    setNewMessage('');
    setImage(null);
  };

  const handleRecall = async (msgId: string, createdAt: any) => {
    const ts = createdAt ? new Date(createdAt).getTime() : 0;
    if (Date.now() - ts > 2 * 60 * 1000) {
      alert('只能撤回2分钟内的消息');
      return;
    }
    await pb.collection('chat_messages').update(msgId, { recalled: true, message: '', image: '' });
  };

  const handleDelete = async (msgId: string) => {
    if (!confirm('确认删除这条消息？')) return;
    await pb.collection('chat_messages').delete(msgId);
  };

  const handleClearScreen = () => {
    if (!targetUser) return;
    if (!confirm('清屏后本频道的历史消息将在此设备上隐藏，确认吗？')) return;
    setLocalClearedAt(prev => ({ ...prev, [targetUser]: Date.now() }));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const totalUnread = Object.values(unreadCounts as Record<string, number>).reduce((a, b) => a + b, 0);

  useEffect(() => {
    const original = document.title;
    if (totalUnread > 0) {
      document.title = `(${totalUnread}) 新消息 — 在线聊天`;
    } else {
      document.title = '在线聊天';
    }
    return () => { document.title = original; };
  }, [totalUnread]);

  const filteredMessages = messages.filter(msg => {
    const clearedAt = targetUser ? localClearedAt[targetUser] : 0;
    const msgTime = msg.createdAt ? new Date(msg.createdAt).getTime() : 0;
    if (clearedAt && msgTime < clearedAt) return false;

    if (targetUser === '公共频道') {
      return msg.to === 'all' || !msg.to;
    }
    return (msg.from === user.email && msg.to === targetUser) ||
           (msg.from === targetUser && msg.to === user.email);
  });

  const getUserInfo = (email: string) => allUsers.find(u => u.email === email);

  const isOnline = (email: string) => {
    const now = Date.now();
    return onlineUsers.some(u => u.email === email && now - u.lastSeen < 2 * 60 * 1000);
  };

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
        {/* Sidebar */}
        <div className="w-64 bg-white p-4 border rounded-xl shadow-sm flex flex-col overflow-hidden">
          <h3 className="font-bold mb-4 flex items-center gap-2 flex-shrink-0"><User className="w-4 h-4" /> 用户列表</h3>
          <ul className="space-y-2 overflow-y-auto flex-1">
            <li
              onClick={() => handleSelectConversation('公共频道')}
              className={`cursor-pointer p-2 rounded-lg flex items-center justify-between gap-2 ${targetUser === '公共频道' ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}
            >
              <span className="truncate text-sm font-bold">📢 公共频道</span>
              {unreadCounts['公共频道'] > 0 && (
                <span className="bg-red-500 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                  {unreadCounts['公共频道']}
                </span>
              )}
            </li>
            {allUsers.filter(u => u.email !== user.email).map(u => (
              <li
                key={u.id}
                onClick={() => handleSelectConversation(u.email)}
                className={`cursor-pointer p-2 rounded-lg flex items-center gap-2 ${targetUser === u.email ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}
              >
                <div className="relative flex-shrink-0">
                  <Avatar email={u.email} displayName={u.name} avatarUrl={u.avatarUrl} size="sm" />
                  {isOnline(u.email) && (
                    <span className="absolute bottom-0 right-0 w-2 h-2 bg-green-400 rounded-full border border-white" />
                  )}
                </div>
                <span className="truncate text-sm flex-1">{u.name || (u.email || '').split('@')[0]}</span>
                {unreadCounts[u.email] > 0 && (
                  <span className="bg-red-500 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                    {unreadCounts[u.email]}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>

        {/* Chat area */}
        <div className="flex-1 flex flex-col bg-white border rounded-xl shadow-sm overflow-hidden">
          {/* Chat header */}
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-900">
                {targetUser === '公共频道' ? '📢 公共频道' : (getUserInfo(targetUser || '')?.name || targetUser)}
              </span>
              {targetUser !== '公共频道' && targetUser && isOnline(targetUser) && (
                <span className="text-xs text-green-500 font-medium">● 在线</span>
              )}
            </div>
            <button
              onClick={handleClearScreen}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              title="清屏"
            >
              <Eraser className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
            {filteredMessages.map(msg => {
              const isMe = msg.from === user.email;
              const senderInfo = getUserInfo(msg.from);
              return (
                <div
                  key={msg.id}
                  className={`flex items-end gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}
                  onMouseEnter={() => setHoveredMsgId(msg.id)}
                  onMouseLeave={() => setHoveredMsgId(null)}
                >
                  <Avatar email={msg.from} displayName={senderInfo?.name} avatarUrl={senderInfo?.avatarUrl} size="sm" />
                  <div className={`max-w-[70%] group flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                    <span className="text-xs text-gray-400 mb-1">
                      {senderInfo?.name || (msg.from || '').split('@')[0]}
                      {msg.createdAt && <span className="ml-1">{new Date(msg.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</span>}
                    </span>
                    {msg.recalled ? (
                      <span className="text-xs text-gray-400 italic px-3 py-2 bg-gray-100 rounded-xl">消息已撤回</span>
                    ) : (
                      <div className={`px-3 py-2 rounded-2xl ${isMe ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-900'}`}>
                        {msg.message && <p className="text-sm whitespace-pre-wrap break-words">{msg.message}</p>}
                        {msg.image && (
                          <img
                            src={msg.image}
                            alt="图片"
                            className="max-w-[200px] rounded-lg cursor-pointer mt-1"
                            onClick={() => setEnlargedImage(msg.image!)}
                          />
                        )}
                      </div>
                    )}
                    {/* Message actions */}
                    {hoveredMsgId === msg.id && !msg.recalled && (
                      <div className={`flex gap-1 mt-1 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                        {isMe && (
                          <button
                            onClick={() => handleRecall(msg.id, msg.createdAt)}
                            className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                            title="撤回"
                          >
                            <Undo2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {(isMe || user?.role === 'admin') && (
                          <button
                            onClick={() => handleDelete(msg.id)}
                            className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                            title="删除"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          {/* Image preview */}
          {image && (
            <div className="px-4 py-2 border-t flex items-center gap-2">
              <img src={image} alt="preview" className="h-16 rounded-lg object-cover" />
              <button onClick={() => setImage(null)} className="text-sm text-red-500 hover:underline">移除</button>
            </div>
          )}

          {/* Input */}
          <form onSubmit={handleSendMessage} className="px-4 py-3 border-t flex items-center gap-2">
            <div className="relative flex-shrink-0" ref={emojiPickerRef}>
              <button
                type="button"
                onClick={() => setShowEmojiPicker(v => !v)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors text-lg leading-none"
              >
                😊
              </button>
              {showEmojiPicker && (
                <div className="absolute bottom-12 left-0 bg-white border border-gray-200 rounded-xl shadow-lg w-72 p-2 z-10">
                  <div className="flex gap-1 mb-2 border-b pb-2">
                    {EMOJIS.map((tab, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setEmojiTab(i)}
                        className={`px-2 py-1 text-xs rounded ${emojiTab === i ? 'bg-blue-100 text-blue-700 font-medium' : 'text-gray-500 hover:bg-gray-100'}`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-8 gap-1 max-h-40 overflow-y-auto">
                    {EMOJIS[emojiTab].list.map((emoji, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => { insertEmoji(emoji); setShowEmojiPicker(false); }}
                        className="text-xl p-1 hover:bg-gray-100 rounded transition-colors"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              title="发送图片"
            >
              📎
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageChange}
            />

            <input
              ref={inputRef}
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder={`发送到 ${targetUser === '公共频道' ? '公共频道' : (getUserInfo(targetUser || '')?.name || targetUser)}`}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <button
              type="submit"
              disabled={!newMessage.trim() && !image}
              className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </main>

      {/* Enlarged image */}
      {enlargedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          onClick={() => setEnlargedImage(null)}
        >
          <img src={enlargedImage} alt="大图" className="max-w-[90vw] max-h-[90vh] rounded-lg shadow-xl" />
        </div>
      )}
    </div>
  );
}
