// src/usePresence.ts
import { useEffect, useState } from 'react';
import { db } from './firebase';
import { collection, doc, setDoc, onSnapshot, query, where, Timestamp, QuerySnapshot, DocumentData } from 'firebase/firestore';
import { useAuth } from './AuthContext';
import { PresenceUser } from './types';

const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8'];

export const usePresence = () => {
  const { user } = useAuth();
  const [onlineUsers, setOnlineUsers] = useState<PresenceUser[]>([]);

  useEffect(() => {
    if (!user) return;

    const userDoc = doc(collection(db, 'presence'), user.uid);
    const userData = {
      id: user.uid,
      name: `User ${user.uid.slice(0, 4)}`, // Simple name, can be improved
      color: colors[Math.floor(Math.random() * colors.length)],
      lastSeen: Timestamp.now()
    };

    // Set initial presence
    setDoc(userDoc, userData);

    // Update every 30 seconds
    const interval = setInterval(() => {
      setDoc(userDoc, { ...userData, lastSeen: Timestamp.now() }, { merge: true });
    }, 30000);

    // Listen for online users (last seen within 1 minute)
    const q = query(collection(db, 'presence'), where('lastSeen', '>', Timestamp.fromMillis(Date.now() - 60000)));
    const unsubscribe = onSnapshot(q, (snapshot: QuerySnapshot<DocumentData>) => {
      const users: PresenceUser[] = [];
      snapshot.forEach((doc) => {
        users.push(doc.data() as PresenceUser);
      });
      setOnlineUsers(users);
    });

    return () => {
      clearInterval(interval);
      unsubscribe();
    };
  }, [user]);

  return onlineUsers;
};
