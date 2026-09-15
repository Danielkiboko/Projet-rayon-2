import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

export let adminInitError: any = null;

export function initFirebaseAdmin() {
  if (!getApps().length) {
    try {
      if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
        let saStr = process.env.FIREBASE_SERVICE_ACCOUNT_KEY.trim();
        if (!saStr.startsWith('{')) {
          try {
            saStr = Buffer.from(saStr, 'base64').toString('utf-8');
          } catch (e) {}
        }
        const serviceAccount = JSON.parse(saStr);
        initializeApp({
          credential: cert(serviceAccount),
        });
      } else {
        if (!process.env.FIREBASE_PRIVATE_KEY) {
           const keys = Object.keys(process.env).filter(k => k.includes('FIREBASE')).join(', ');
           throw new Error(`FIREBASE_PRIVATE_KEY is missing. Found keys: ${keys}`);
        }
        let privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').trim();

        // 1. Remove surrounding quotes
        privateKey = privateKey.replace(/^["']|["']$/g, '');

        // 2. Handle literal \n or escaped slashes just in case
        privateKey = privateKey.replace(/\\n/g, '\n').replace(/\r/g, '');

        // 3. Extract the base64 content and reconstruct perfectly
        const pemRegex = /-----BEGIN PRIVATE KEY-----([\s\S]+?)-----END PRIVATE KEY-----/;
        const match = privateKey.match(pemRegex);

        let cleanBase64 = "";
        if (match) {
          cleanBase64 = match[1].replace(/\s+/g, '');
        } else {
          // If no markers were found, assume the whole string is the raw base64 key
          cleanBase64 = privateKey.replace(/\s+/g, '');
        }

        // 4. Re-chunk into 64-character lines (standard OpenSSL PEM format)
        const chunks = [];
        for (let i = 0; i < cleanBase64.length; i += 64) {
          chunks.push(cleanBase64.slice(i, i + 64));
        }

        // 5. Rebuild with proper markers and trailing newline
        privateKey = `-----BEGIN PRIVATE KEY-----\n${chunks.join('\n')}\n-----END PRIVATE KEY-----\n`;

        const clientEmail = (process.env.FIREBASE_CLIENT_EMAIL || '').replace(/^["']|["']$/g, '').trim();
        const projectId = (process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'rayon-projet').replace(/^["']|["']$/g, '').trim();
        
        initializeApp({
          credential: cert({
            projectId: projectId,
            clientEmail: clientEmail,
            privateKey: privateKey,
          }),
        });
      }
      console.log('Firebase Admin initialized successfully.');
      adminInitError = null;
    } catch (error) {
      console.error('Firebase Admin initialization error', error);
      adminInitError = error;
    }
  } else {
    adminInitError = null;
  }
}

export const adminDb = new Proxy({} as any, {
  get: (target, prop) => {
    initFirebaseAdmin();
    if (adminInitError) {
      throw adminInitError;
    }
    const firestore = getFirestore();
    const value = (firestore as any)[prop];
    if (typeof value === 'function') {
      return value.bind(firestore);
    }
    return value;
  }
});

export const adminAuth = new Proxy({} as any, {
  get: (target, prop) => {
    initFirebaseAdmin();
    if (adminInitError) {
      throw adminInitError;
    }
    const auth = getAuth();
    const value = (auth as any)[prop];
    if (typeof value === 'function') {
      return value.bind(auth);
    }
    return value;
  }
});
