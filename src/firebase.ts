import { initializeApp } from "firebase/app";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// ✅ WORKING: Hardcoded keys that successfully connect to Firebase
const firebaseConfig = {
  apiKey: "AIzaSyAQ5FdR_OjZvMkTOYy9auXDctOQXGtZPgg",
  authDomain: "house-budget-pwa.firebaseapp.com",
  projectId: "house-budget-pwa",
  storageBucket: "house-budget-pwa.firebasestorage.app",
  messagingSenderId: "7591891522",
  appId: "1:7591891522:web:ebf15777f6c206129753db",
  measurementId: "G-6QDXEYXPTE"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore with offline persistence
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
});

const auth = getAuth(app);

export { db, auth };