import { initializeApp, getApps, getApp } from "firebase/app";
// @ts-ignore - getReactNativePersistence est exporté par le bundle React Native de firebase/auth
import { initializeAuth, getAuth, getReactNativePersistence, Auth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

// Initialize Firebase (Singleton pattern to prevent re-initialization)
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Session persistante : le livreur reste connecté entre deux lancements de l'app
let auth: Auth;
try {
  if (Platform.OS !== "web") {
    auth = initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
  } else {
    auth = getAuth(app);
  }
} catch {
  auth = getAuth(app);
}

const db = getFirestore(app);

export { app, auth, db };
