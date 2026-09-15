const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, query, where } = require('firebase/firestore');
require('fs').readFileSync('.env.local', 'utf-8').split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) process.env[match[1]] = match[2];
});

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkSuppliers() {
  const snap = await getDocs(collection(db, "users"));
  console.log("Total users:", snap.size);
  let supplierCount = 0;
  snap.forEach(doc => {
    const data = doc.data();
    if (data.email === 'kingombe@nova-city.online') {
        console.log("FOUND kingombe:", data.email, data.role, data.isInternalStaff);
    }
    const role = (data.role || '').toUpperCase();
    if (role.includes('SUPPLIER') || role.includes('FOURNISSEUR')) {
        console.log("Supplier:", data.email, data.role);
        supplierCount++;
    }
  });
  console.log("Total suppliers:", supplierCount);
}

checkSuppliers().then(() => process.exit(0)).catch(console.error);
