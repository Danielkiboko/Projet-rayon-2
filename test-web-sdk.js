const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, query, where } = require('firebase/firestore');
const fs = require('fs');

const envLocal = fs.readFileSync('.env.local', 'utf-8');
const apiKeyMatch = envLocal.match(/NEXT_PUBLIC_FIREBASE_API_KEY=(.+)/);
const projectIdMatch = envLocal.match(/NEXT_PUBLIC_FIREBASE_PROJECT_ID=(.+)/);

const firebaseConfig = {
  apiKey: apiKeyMatch[1].trim(),
  projectId: projectIdMatch[1].trim(),
  authDomain: projectIdMatch[1].trim() + '.firebaseapp.com'
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function test() {
  try {
    const usersRef = collection(db, 'users');
    const snapshot = await getDocs(usersRef);
    console.log("Total users:", snapshot.size);
    snapshot.forEach(doc => {
      console.log(doc.id, "=>", doc.data().role, doc.data().email);
    });
  } catch (err) {
    console.error("Error:", err.code || err.message);
  }
}

test().then(() => process.exit(0));
