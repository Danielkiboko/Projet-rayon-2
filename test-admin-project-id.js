const admin = require('firebase-admin');
const fs = require('fs');

const envLocal = fs.readFileSync('.env.local', 'utf-8');
const privateKeyMatch = envLocal.match(/FIREBASE_PRIVATE_KEY="(.+?)"/);
const clientEmailMatch = envLocal.match(/FIREBASE_CLIENT_EMAIL="(.+?)"/);

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: 'project-930187596211',
    clientEmail: clientEmailMatch[1].trim(),
    privateKey: privateKeyMatch[1].replace(/\\n/g, '\n'),
  })
});

const db = admin.firestore();

async function test() {
  try {
    const usersRef = db.collection('users');
    const snapshot = await usersRef.get();
    console.log("Total users in project-930187596211:", snapshot.size);
    snapshot.forEach(doc => {
      console.log(doc.id, "=>", doc.data().role, doc.data().email);
    });
  } catch (err) {
    console.error("Error:", err.code || err.message);
  }
}

test().then(() => process.exit(0));
