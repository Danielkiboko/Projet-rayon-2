const admin = require('firebase-admin');
const fs = require('fs');

const envLocal = fs.readFileSync('.env.local', 'utf-8');
const privateKeyMatch = envLocal.match(/FIREBASE_PRIVATE_KEY="(.+?)"/);
const clientEmailMatch = envLocal.match(/FIREBASE_CLIENT_EMAIL="(.+?)"/);
const projectIdMatch = envLocal.match(/NEXT_PUBLIC_FIREBASE_PROJECT_ID=(.+)/);

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: projectIdMatch[1].trim(),
    clientEmail: clientEmailMatch[1].trim(),
    privateKey: privateKeyMatch[1].replace(/\\n/g, '\n'),
  })
});

const db = admin.firestore();

async function testWrite() {
  try {
    const docRef = db.collection('users').doc('test-connection-doc');
    await docRef.set({ test: 'hello world', role: 'SUPPLIER' });
    console.log("Successfully wrote to Firestore!");
  } catch (err) {
    console.error("Failed to write to Firestore:");
    console.error(err);
  }
}

testWrite().then(() => process.exit(0));
