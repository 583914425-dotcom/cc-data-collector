import { doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
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
