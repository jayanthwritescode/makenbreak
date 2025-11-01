// src/firebase.ts
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyAYmb3n_Oey294rPxmspU5DtfhVBXTeupI",
  authDomain: "makenbreak-cd654.firebaseapp.com",
  projectId: "makenbreak-cd654",
  storageBucket: "makenbreak-cd654.firebasestorage.app",
  messagingSenderId: "475976510347",
  appId: "1:475976510347:web:0dc2281c29b7f65b169d8e",
  measurementId: "G-NH6NDFPEL6"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
