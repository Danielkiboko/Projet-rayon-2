const fs = require('fs');
const envLocal = fs.readFileSync('.env.local', 'utf-8');
const privateKeyMatch = envLocal.match(/FIREBASE_PRIVATE_KEY="(.+?)"/);

let privateKey = privateKeyMatch[1];
privateKey = privateKey.replace(/^["']|["']$/g, '');
privateKey = privateKey.replace(/\\n/g, '\n').replace(/\r/g, '');
const pemRegex = /-----BEGIN PRIVATE KEY-----([\s\S]+?)-----END PRIVATE KEY-----/;
const match = privateKey.match(pemRegex);
let cleanBase64 = "";
if (match) {
  cleanBase64 = match[1].replace(/\s+/g, '');
} else {
  cleanBase64 = privateKey.replace(/\s+/g, '');
}
const chunks = [];
for (let i = 0; i < cleanBase64.length; i += 64) {
  chunks.push(cleanBase64.slice(i, i + 64));
}
privateKey = `-----BEGIN PRIVATE KEY-----\n${chunks.join('\n')}\n-----END PRIVATE KEY-----\n`;

const admin = require('firebase-admin');
const clientEmailMatch = envLocal.match(/FIREBASE_CLIENT_EMAIL="(.+?)"/);
try {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: 'rayon-projet',
      clientEmail: clientEmailMatch[1].trim(),
      privateKey: privateKey,
    })
  });
  console.log("Success!");
} catch(e) {
  console.log("Failed:", e.message);
}
