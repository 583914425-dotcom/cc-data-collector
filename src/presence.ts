import { pb } from './lib/pb';

export async function setOnline(uid: string, email: string) {
  const now = new Date().toISOString();
  try {
    await pb.collection('presence').update(uid, { email, lastSeen: now });
  } catch {
    try {
      await pb.collection('presence').create({ id: uid, email, lastSeen: now });
    } catch (_) {}
  }
}

export async function setOffline(uid: string) {
  try {
    await pb.collection('presence').delete(uid);
  } catch (_) {}
}

export function startHeartbeat(uid: string): () => void {
  const tick = async () => {
    try {
      await pb.collection('presence').update(uid, { lastSeen: new Date().toISOString() });
    } catch (_) {}
  };
  const interval = setInterval(tick, 60_000);
  return () => clearInterval(interval);
}
