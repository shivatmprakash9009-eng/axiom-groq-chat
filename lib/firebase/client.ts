import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

export function getFirebaseAuth() {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;

  if (!apiKey || !authDomain || !projectId || !appId) {
    throw new Error(
      "Firebase is not configured. Set NEXT_PUBLIC_FIREBASE_API_KEY, NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN, NEXT_PUBLIC_FIREBASE_PROJECT_ID and NEXT_PUBLIC_FIREBASE_APP_ID."
    );
  }

  const app = getApps().length
    ? getApp()
    : initializeApp({ apiKey, authDomain, projectId, appId });

  return getAuth(app);
}
