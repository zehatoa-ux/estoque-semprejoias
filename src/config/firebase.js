// src/config/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { FIREBASE_CONFIG } from "./constants";

// Tenta pegar do ambiente (Vercel) ou usa a constante manual
const configToUse =
  FIREBASE_CONFIG ||
  (typeof __firebase_config !== "undefined"
    ? JSON.parse(__firebase_config)
    : null);

let app, auth, db;

if (configToUse && configToUse.apiKey) {
  try {
    app = initializeApp(configToUse);
    auth = getAuth(app);
    db = getFirestore(app);

    // Inicia o login anônimo imediatamente
    signInAnonymously(auth).catch((err) => console.error("Auth Error:", err));
  } catch (err) {
    console.error("Firebase Init Error:", err);
  }
}

export { auth, db };
