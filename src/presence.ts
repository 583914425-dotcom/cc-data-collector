import { doc, setDoc, deleteDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from './firebase';

export async function setOnline(uid: string, email: string) {
  await setDoc(doc(db, 'presence', uid), {
    email,
    online: true,
    lastSeen: serverTimestamp(),
  });
}

export async function setOffline(uid: string) {
  await deleteDoc(doc(db, 'presence', uid));
}

export function startHeartbeat(uid: string): () => void {
  const tick = async () => {
    try {
      await updateDoc(doc(db, 'presence', uid), {
        lastSeen: serverTimestamp(),
      });
    } catch (_) {}
  };
  const interval = setInterval(tick, 60_000);
  return () => clearInterval(interval);
}
