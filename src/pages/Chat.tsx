import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Send, ArrowLeft, User, Trash2, Undo2, Eraser } from 'lucide-react';
import { Link } from 'react-router-dom';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, deleteDoc, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';

// Apple tri-tone style note
function playTriTone(ctx: AudioContext, freq: number, t: number, vol: number) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  // Add subtle overtone for bell-like quality
  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc.connect(gain); gain.connect(ctx.destination);
  osc2.connect(gain2); gain2.connect(ctx.destination);
  osc.type = 'sine'; osc.frequency.value = freq;
  osc2.type = 'sine'; osc2.frequency.value = freq * 2.756; // inharmonic overtone
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(vol, t + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
  gain2.gain.setValueAtTime(0, t);
  gain2.gain.linearRampToValueAtTime(vol * 0.25, t + 0.005);
  gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
  osc.start(t); osc.stop(t + 0.30);
  osc2.start(t); osc2.stop(t + 0.15);
}

// Apple tri-tone send: two ascending notes (lighter)
function playMessageSent() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    playTriTone(ctx, 1046.5, ctx.currentTime, 0.30);       // C6
    playTriTone(ctx, 1318.5, ctx.currentTime + 0.11, 0.30); // E6
    setTimeout(() => ctx.close().catch(() => {}), 1000);
  } catch (_) {}
}

interface AppUser {
  id: string;
  email: string;
  displayName?: string;
  avatarUrl?: string;
}

const AVATAR_COLORS = [
  'bg-blue-500', 'bg-purple-500', 'bg-green-500', 'bg-yellow-500',
  'bg-red-500', 'bg-pink-500', 'bg-indigo-500', 'bg-teal-500',
  'bg-orange-500', 'bg-cyan-500',
];

function getAvatarColor(email: string): string {
  let hash = 0;
  for (let i = 0; i < email.length; i++) hash = email.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitial(displayName: string, email: string): string {
  const name = displayName || email;
  return name.charAt(0).toUpperCase();
}

function Avatar({ email, displayName, avatarUrl, size = 'md' }: { email: string, displayName?: string, avatarUrl?: string, size?: 'sm' | 'md' }) {
  const color = getAvatarColor(email);
  const initial = getInitial(displayName || '', email);
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

// Apple tri-tone receive: three ascending notes C6 → E6 → G6
function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    playTriTone(ctx, 1046.5, ctx.currentTime, 0.38);        // C6
    playTriTone(ctx, 1318.5, ctx.currentTime + 0.11, 0.38); // E6
    playTriTone(ctx, 1567.98, ctx.currentTime + 0.22, 0.38); // G6
    setTimeout(() => ctx.close().catch(() => {}), 1200);
  } catch (_) {}
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
    { label: '常用', list: ['😊','😂','🤣','❤️','😍','🥰','😘','😁','😄','😃','😀','🙂','😉','😋','😎','🤩','🥳','😏','😒','😞','😔','😟','😕','🙁','😣','😖','😫','😩','🥺','😢','😭','😤','😠','😡','🤬','🤯','😳','🥵','🥶','😱','😨','😰','😥','😓','🤗','🤔','🤭','🤫','🤥','😶','😐','😑','😬','🙄','😯','😦','😧','😮','😲','🥱','😴','🤤','😪','😵','🤐','🥴','🤢','🤮','🤧','😷','🤒','🤕','🤑','🤠','😈','👿','👹','👺','💀','☠️','👻','👽','🤖','💩','😺','😸','😹','😻','😼','😽','🙀','😿','😾'] },
    { label: '手势', list: ['👋','🤚','🖐️','✋','🖖','👌','🤌','🤏','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','🖕','👇','☝️','👍','👎','✊','👊','🤛','🤜','👏','🙌','👐','🤲','🤝','🙏','✍️','💅','🤳','💪','🦵','🦶','👂','🦻','👃','👀','👁️','👅','👄','💋','🫀','🫁','🧠','🦷','🦴'] },
    { label: '动物', list: ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🙈','🙉','🙊','🐔','🐧','🐦','🐤','🦆','🦅','🦉','🦇','🐝','🐛','🦋','🐌','🐞','🐜','🦟','🦗','🐢','🐍','🦎','🦖','🦕','🐙','🦑','🦐','🦞','🦀','🐡','🐠','🐟','🐬','🐳','🐋','🦈','🐊','🐅','🐆','🦓','🦍','🦧','🦣','🐘','🦏','🦛','🐪','🦒','🦘','🦬','🐃','🐂','🦙','🐑','🐏','🐐','🦌','🐕','🐩','🦮','🐕‍🦺','🐈','🐈‍⬛','🐓','🦤','🦚','🦜','🦢','🦩','🕊️','🐇','🦝','🦨','🦡','🦫','🦦','🦥','🐁','🐀','🐿️','🦔'] },
    { label: '食物', list: ['🍎','🍊','🍋','🍇','🍓','🫐','🍈','🍒','🍑','🥭','🍍','🥥','🥝','🍅','🥑','🍆','🥦','🥬','🥒','🫑','🌽','🥕','🫛','🧅','🥔','🍠','🫚','🧄','🧅','🥜','🫘','🌰','🍞','🥐','🥨','🧀','🥚','🍳','🧈','🥞','🧇','🥓','🥩','🍗','🍖','🌭','🍔','🍟','🍕','🫓','🥙','🥪','🌮','🌯','🫔','🥗','🥘','🫕','🍝','🍜','🍲','🍛','🍣','🍱','🥟','🦪','🍤','🍙','🍘','🍥','🥮','🍢','🧆','🥙','🧆','🍡','🍧','🍨','🍦','🥧','🧁','🍰','🎂','🍮','🍭','🍬','🍫','🍿','🍩','🍪','🌰','🥜','🫘','🍯','🧃','🥤','🧋','☕','🍵','🫖','🍺','🍻','🥂','🍷','🫗','🥃','🍸','🍹','🧉','🍾'] },
    { label: '符号', list: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❤️‍🔥','❤️‍🩹','💕','💞','💓','💗','💖','💘','💝','💟','☮️','✝️','☯️','🕉️','✡️','🔯','🛐','⛎','♈','💯','🆗','🆙','🆒','🆕','🆓','0️⃣','1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟','🔠','🔡','🔢','🔣','🔤','🅰️','🅱️','🆎','🆑','🅾️','🆘','❌','⭕','🛑','⛔','📛','🚫','💢','♨️','🚷','🚯','🚳','🚱','🔞','📵','🔕','❗','❕','❓','❔','‼️','⁉️','🔅','🔆','〽️','⚠️','🚸','🆚','💬','💭','🗯️','💤','🔈','🔉','🔊','📢','📣','🔔','🔕','🎵','🎶','💹','🗺️','🌐','🗾','🧭','🏔️','⛰️','🌋','🗻','🏕️','🏖️','🏜️','🏝️','🏞️','🏟️','🏛️','🏗️','🏘️','🏚️','🏠','🏡','🏢','🏣','🏤','🏥','🏦','🏨','🏩','🏪','🏫','🏬','🏭','🏯','🏰','💒','🗼','🗽','⛪','🕌','🛕','🕍','⛩️','🕋','⛲','⛺','🌁','🌃','🏙️','🌄','🌅','🌆','🌇','🌉','♾️','🌌','🌠','🎇','🎆','🌈','🌤️','⛅','🌥️','🌦️','🌧️','⛈️','🌩️','🌨️','❄️','☃️','⛄','🌬️','💨','🌪️','🌫️','🌊','🌀','🌈','🌂','☂️','☔','⛱️','⚡','❄️','🔥','💧','🌊'] },
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

  useEffect(() => {
    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: AppUser[] = [];
      snapshot.forEach((doc) => {
        const userData = doc.data();
        data.push({ id: doc.id, email: userData.email, displayName: userData.displayName || '', avatarUrl: userData.avatarUrl || '' } as AppUser);
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
      const data = snapshot.docs.map(d => ({
        id: d.id,
        from: d.data().from,
        message: d.data().message,
        to: d.data().to,
        image: d.data().image,
        createdAt: d.data().createdAt,
        recalled: d.data().recalled || false,
      }));

      const prev = prevMessagesRef.current;
      if (prev.length > 0 && data.length > prev.length) {
        const newMsgs = data.slice(prev.length);
        newMsgs.forEach(msg => {
          if (msg.from === user.email) return;
          if (msg.recalled) return;

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
      const now = Date.now();
      const users = snapshot.docs
        .map(d => {
          const data = d.data();
          const lastSeen = data.lastSeen?.toMillis ? data.lastSeen.toMillis() : now;
          return { email: data.email as string, lastSeen };
        })
        .filter(u => now - u.lastSeen < 2 * 60 * 1000);
      setOnlineUsers(users);
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
      playMessageSent();
    } catch (error) {
      console.error('Error saving message to Firestore:', error);
    }

    setNewMessage('');
    setImage(null);
  };

  const handleRecall = async (msgId: string, createdAt: any) => {
    const ts = createdAt?.toDate ? createdAt.toDate().getTime() : Number(createdAt);
    if (Date.now() - ts > 2 * 60 * 1000) {
      alert('只能撤回2分钟内的消息');
      return;
    }
    await updateDoc(doc(db, 'chat_messages', msgId), { recalled: true, message: '', image: '' });
  };

  const handleDelete = async (msgId: string) => {
    if (!confirm('确认删除这条消息？')) return;
    await deleteDoc(doc(db, 'chat_messages', msgId));
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
              const isOnline = onlineUsers.some(o => o.email === u.email);
              const unread = unreadCounts[u.email] || 0;
              return (
                <li 
                  key={u.id} 
                  onClick={() => handleSelectConversation(u.email)} 
                  className={`cursor-pointer p-2 rounded-lg flex items-center gap-2 ${targetUser === u.email ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'}`}
                >
                  <div className="relative flex-shrink-0">
                    <Avatar email={u.email} displayName={u.displayName} avatarUrl={u.avatarUrl} size="sm" />
                    <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${isOnline || u.email === user.email ? 'bg-green-500' : 'bg-gray-300'}`} />
                  </div>
                  <span className="truncate text-sm flex-1">{u.email === user.email ? `${u.displayName || u.email} (我)` : (u.displayName || u.email)}</span>
                  {unread > 0 && (
                    <span className="bg-red-500 text-white text-xs font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1 flex-shrink-0">
                      {unread}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        <div className="flex-1 flex flex-col bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <>
            <div className="flex items-center justify-between mb-4 pb-2 border-b">
              <h4 className="font-semibold">
                与 {targetUser === '公共频道' ? '公共频道' : (allUsers.find(u => u.email === targetUser)?.displayName || targetUser)} 对话
              </h4>
              <button
                onClick={handleClearScreen}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition-colors px-2 py-1 rounded hover:bg-red-50"
                title="清屏（仅本设备隐藏）"
              >
                <Eraser className="w-3.5 h-3.5" /> 清屏
              </button>
            </div>
            <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-4 mb-4">
              {messages
                .filter(m => {
                  if (targetUser === '公共频道') return m.to === 'all' || !m.to;
                  return (m.to === targetUser && m.from === user.email) || 
                         (m.to === user.email && m.from === targetUser);
                })
                .filter(m => {
                  const clearedTs = localClearedAt[targetUser!];
                  if (!clearedTs || !m.createdAt) return true;
                  const msgTs = m.createdAt.toDate ? m.createdAt.toDate().getTime() : Number(m.createdAt);
                  return msgTs > clearedTs;
                })
                .map((m) => {
                  const isMine = m.from === user.email;
                  const sender = allUsers.find(u => u.email === m.from);
                  const senderName = isMine ? (allUsers.find(u => u.email === user.email)?.displayName || '我') : (sender?.displayName || m.from);
                  const timeStr = m.createdAt
                    ? (m.createdAt.toDate
                        ? m.createdAt.toDate().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
                        : new Date(m.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }))
                    : '';
                  const canRecall = isMine && !m.recalled && m.createdAt && (() => {
                    const ts = m.createdAt.toDate ? m.createdAt.toDate().getTime() : Number(m.createdAt);
                    return Date.now() - ts <= 2 * 60 * 1000;
                  })();
                  return (
                    <div
                      key={m.id}
                      className={`flex items-end gap-2 ${isMine ? 'flex-row-reverse' : 'flex-row'} group`}
                      onMouseEnter={() => setHoveredMsgId(m.id)}
                      onMouseLeave={() => setHoveredMsgId(null)}
                    >
                      <Avatar email={m.from} displayName={sender?.displayName} avatarUrl={sender?.avatarUrl} size="sm" />
                      <div className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} max-w-[70%]`}>
                        <span className="text-xs text-gray-500 mb-0.5 px-1">{senderName}</span>
                        {m.recalled ? (
                          <div className="px-3 py-2 rounded-2xl bg-gray-100 text-gray-400 text-sm italic">
                            {isMine ? '你' : senderName} 撤回了一条消息
                          </div>
                        ) : (
                          <div className={`p-3 rounded-2xl ${isMine ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-900'}`}>
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
                        )}
                        <div className={`flex items-center gap-1 mt-0.5 px-1 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
                          {timeStr && <span className="text-xs text-gray-400">{timeStr}</span>}
                          {hoveredMsgId === m.id && !m.recalled && isMine && (
                            <div className={`flex items-center gap-1 ${isMine ? 'mr-1' : 'ml-1'}`}>
                              {canRecall && (
                                <button
                                  onClick={() => handleRecall(m.id, m.createdAt)}
                                  className="text-xs text-gray-400 hover:text-orange-500 flex items-center gap-0.5 transition-colors"
                                  title="撤回（2分钟内有效）"
                                >
                                  <Undo2 className="w-3 h-3" /> 撤回
                                </button>
                              )}
                              <button
                                onClick={() => handleDelete(m.id)}
                                className="text-xs text-gray-400 hover:text-red-500 flex items-center gap-0.5 transition-colors"
                                title="删除"
                              >
                                <Trash2 className="w-3 h-3" /> 删除
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              <div ref={bottomRef} />
            </div>
            {image && (
              <div className="mb-2 p-2 bg-gray-100 rounded-lg inline-block">
                <img src={image} alt="preview" className="w-20 h-20 object-cover rounded" />
                <button onClick={() => setImage(null)} className="text-xs text-red-500">取消</button>
              </div>
            )}
            <div className="relative">
              {showEmojiPicker && (
                <div
                  ref={emojiPickerRef}
                  className="absolute bottom-12 left-0 z-50 bg-white border border-gray-200 rounded-2xl shadow-xl w-80"
                >
                  <div className="flex border-b overflow-x-auto">
                    {EMOJIS.map((cat, i) => (
                      <button
                        key={i}
                        onClick={() => setEmojiTab(i)}
                        className={`px-3 py-2 text-xs whitespace-nowrap flex-shrink-0 font-medium transition-colors ${emojiTab === i ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-8 gap-0.5 p-2 h-48 overflow-y-auto">
                    {EMOJIS[emojiTab].list.map((emoji, i) => (
                      <button
                        key={i}
                        onClick={() => insertEmoji(emoji)}
                        className="text-xl hover:bg-gray-100 rounded-lg p-1 transition-colors leading-none"
                        title={emoji}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <form onSubmit={handleSendMessage} className="flex gap-2">
                <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageChange} className="hidden" />
                <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2 text-gray-500 hover:text-blue-600">图片</button>
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker(v => !v)}
                  className={`p-2 text-xl leading-none transition-colors ${showEmojiPicker ? 'text-blue-600' : 'text-gray-500 hover:text-blue-600'}`}
                  title="表情"
                >
                  😊
                </button>
                <input
                  ref={inputRef}
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="输入消息..."
                  className="flex-1 p-3 border rounded-xl"
                />
                <button type="submit" className="bg-blue-600 text-white p-3 rounded-xl"><Send className="w-5 h-5" /></button>
              </form>
            </div>
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
