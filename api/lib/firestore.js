// Firebase client SDK (lite/REST) for Firestore access in serverless.
// Uses REST transport instead of WebSockets — works reliably on Vercel.

import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore/lite";

const firebaseConfig = {
  apiKey: "AIzaSyDbcTducgo39cIvbjRDLayAE22NYE0o6Bs",
  authDomain: "myaicademy-client-app.firebaseapp.com",
  projectId: "myaicademy-client-app",
  storageBucket: "myaicademy-client-app.firebasestorage.app",
  messagingSenderId: "350240447051",
  appId: "1:350240447051:web:94d4091b4beb034e180bce",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const db = getFirestore(app);
