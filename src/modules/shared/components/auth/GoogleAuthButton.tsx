"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

export const GoogleIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
    />
  </svg>
);

interface GoogleAuthButtonProps {
  mode?: "login" | "register";
  redirectUrl?: string;
  onError?: (errorMessage: string) => void;
  disabled?: boolean;
  className?: string;
}

export default function GoogleAuthButton({
  mode = "login",
  redirectUrl = "/dashboard",
  onError,
  disabled = false,
  className = "",
}: GoogleAuthButtonProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleAuth = async () => {
    setIsLoading(true);
    if (onError) onError("");

    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      const result = await signInWithPopup(auth, provider);
      const googleUser = result.user;

      // Synchronisation du profil client dans Firestore
      const userDocRef = doc(db, "users", googleUser.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (!userDocSnap.exists()) {
        await setDoc(userDocRef, {
          id: googleUser.uid,
          email: googleUser.email,
          displayName: googleUser.displayName || googleUser.email?.split("@")[0] || "Client",
          photoURL: googleUser.photoURL || null,
          role: "client",
          authProvider: "google",
          createdAt: serverTimestamp(),
          lastConnection: serverTimestamp(),
          isOnline: true,
        });
      } else {
        await updateDoc(userDocRef, {
          lastConnection: serverTimestamp(),
          isOnline: true,
        }).catch(() => {});
      }

      const userEmail = (googleUser.email || "").toLowerCase().trim();
      if (["danielkiboko218@gmail.com", "admin@rayons.net"].includes(userEmail)) {
        router.replace("/admin/dashboard");
      } else {
        router.replace(redirectUrl);
      }
    } catch (err: any) {
      console.log("Erreur Google Auth :", err.code, err.message);
      if (err.code === "auth/popup-closed-by-user" || err.code === "auth/cancelled-popup-request") {
        return;
      }
      let message = "Erreur lors de l'authentification avec Google.";
      if (err.code === "auth/popup-blocked") {
        message = "La fenêtre de connexion a été bloquée par votre navigateur. Veuillez autoriser les fenêtres pop-up.";
      } else if (err.code === "auth/unauthorized-domain") {
        message = "Le domaine doit être ajouté dans Firebase Console (Authentication > Paramètres > Domaines autorisés).";
      } else if (err.message) {
        message = err.message;
      }
      if (onError) onError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const label =
    mode === "register"
      ? "S'inscrire avec Google (Gmail)"
      : "Continuer avec Google (Gmail)";

  return (
    <button
      type="button"
      onClick={handleGoogleAuth}
      disabled={disabled || isLoading}
      className={`w-full py-3.5 px-4 bg-white hover:bg-gray-50 text-gray-700 font-heading font-bold text-sm border border-gray-200 rounded-xl transition-all shadow-xs flex items-center justify-center gap-3 active:scale-[0.99] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
      {isLoading ? (
        <div className="w-5 h-5 border-2 border-gray-400 border-t-gray-800 rounded-full animate-spin" />
      ) : (
        <>
          <GoogleIcon />
          <span>{label}</span>
        </>
      )}
    </button>
  );
}
