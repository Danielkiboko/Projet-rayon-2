import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { 
  getFirestore, 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager 
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyDummyKeyForBuildVerification12345",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "projets-rayons2.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "projets-rayons2",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "projets-rayons2.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "123456789",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:123456789:web:abcdef",
};

// Initialize Firebase (Singleton pattern to prevent re-initialization in Next.js)
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
let auth: any;
try {
  auth = getAuth(app);
} catch (e) {
  console.warn("Client Firebase Auth init warning during build:", e);
}

// Enable persistent multi-tab cache in browser to dramatically cut reads and avoid quota exhaustion
let db: any;
try {
  if (typeof window !== "undefined") {
    db = initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    });
  } else {
    db = getFirestore(app);
  }
} catch (e) {
  db = getFirestore(app);
}

export { auth, db };
