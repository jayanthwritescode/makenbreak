// src/useCursors.ts
import { useEffect, useState, useCallback } from 'react';
import { db } from './firebase';
import { collection, doc, setDoc, onSnapshot, deleteDoc } from 'firebase/firestore';
import { useAuth } from './AuthContext';
import { usePresence } from './usePresence';
import { User } from './types';

export const useCursors = () => {
  const { user } = useAuth();
  const [cursors, setCursors] = useState<User[]>([]);
  const onlineUsers = usePresence(); // Get online users for color

  useEffect(() => {
    if (!user) return;

    const cursorsRef = collection(db, 'cursors');
    const unsubscribe = onSnapshot(cursorsRef, (snapshot) => {
      const cursorList: User[] = [];
      snapshot.forEach(doc => {
        cursorList.push(doc.data() as User);
      });
      setCursors(cursorList);
    });

    return unsubscribe;
  }, [user]);

  const updateCursor = useCallback((row: number, col: number) => {
    if (!user) return;
    const userColor = onlineUsers.find(u => u.id === user.uid)?.color || 'blue';
    const cursorDoc = doc(collection(db, 'cursors'), user.uid);
    setDoc(cursorDoc, {
      id: user.uid,
      name: `User ${user.uid.slice(0, 4)}`,
      color: userColor,
      cursor: { row, col }
    });
  }, [user, onlineUsers]);

  const removeCursor = () => {
    if (!user) return;
    const cursorDoc = doc(collection(db, 'cursors'), user.uid);
    deleteDoc(cursorDoc);
  };

  return { cursors, updateCursor, removeCursor };
};
