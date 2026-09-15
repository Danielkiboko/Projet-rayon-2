const admin = require('firebase-admin');
const fs = require('fs');

const envLocal = fs.readFileSync('.env.local', 'utf-8');
const privateKeyMatch = envLocal.match(/FIREBASE_PRIVATE_KEY="(.+?)"/);
const clientEmailMatch = envLocal.match(/FIREBASE_CLIENT_EMAIL="(.+?)"/);
const projectIdMatch = envLocal.match(/NEXT_PUBLIC_FIREBASE_PROJECT_ID=(.+)/);

if (!privateKeyMatch || !clientEmailMatch || !projectIdMatch) {
  console.error("Could not find admin credentials in .env.local");
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: projectIdMatch[1].trim(),
    clientEmail: clientEmailMatch[1].trim(),
    privateKey: privateKeyMatch[1].replace(/\\n/g, '\n'),
  })
});

const db = admin.firestore();

async function check() {
  const usersRef = db.collection('users');
  const snapshot = await usersRef.get();
  console.log("Total users:", snapshot.size);
  let supplierCount = 0;
  snapshot.forEach(doc => {
    const data = doc.data();
    if (data.email === 'kingombe@nova-city.online') {
       console.log("KINGOMBE ROLE:", data.role);
    }
    const role = (data.role || '').toUpperCase();
    if (role.includes('SUPPLIER') || role.includes('FOURNISSEUR')) {
      console.log("Supplier:", data.email, data.role);
      supplierCount++;
    }
  });
  console.log("Total suppliers:", supplierCount);
}

check().then(() => process.exit(0)).catch(console.error);
