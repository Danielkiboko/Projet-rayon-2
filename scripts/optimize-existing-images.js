/**
 * Script de maintenance pour optimiser et convertir toutes les images existantes
 * de la base de données Firestore au format WebP ultra-léger.
 *
 * Utilisation : node scripts/optimize-existing-images.js
 */

const admin = require('firebase-admin');
const dotenv = require('dotenv');
const sharp = require('sharp');

dotenv.config({ path: '.env.local' });

const privateKey = process.env.FIREBASE_PRIVATE_KEY
  ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
  : undefined;

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: privateKey,
    })
  });
}

const db = admin.firestore();

function formatBytes(bytes) {
  if (bytes === 0) return '0 Ko';
  return (bytes / 1024).toFixed(1) + ' Ko';
}

async function convertBufferToWebp(buffer) {
  return await sharp(buffer)
    .resize(960, 960, {
      fit: 'inside',
      withoutEnlargement: true
    })
    .webp({ quality: 80, effort: 6 })
    .toBuffer();
}

async function optimizeCollection(collectionName) {
  console.log(`\n========================================`);
  console.log(`🔍 Analyse de la collection "${collectionName}"...`);
  console.log(`========================================`);

  const snapshot = await db.collection(collectionName).get();
  console.log(`Trouvé ${snapshot.size} document(s) dans "${collectionName}".`);

  let optimizedCount = 0;
  let totalSavedBytes = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const currentImg = data.image;

    if (!currentImg || typeof currentImg !== 'string') {
      continue;
    }

    // Si c'est une chaîne base64 (data:image/...)
    if (currentImg.startsWith('data:image/')) {
      const parts = currentImg.split(',');
      if (parts.length === 2) {
        const mimeMatch = currentImg.match(/data:(image\/[a-zA-Z+]+);base64/);
        const mime = mimeMatch ? mimeMatch[1] : '';
        const initialBuffer = Buffer.from(parts[1], 'base64');
        const initialSize = initialBuffer.length;

        // Si l'image fait plus de 60 Ko ou n'est pas déjà un webp optimisé
        if (initialSize > 50 * 1024 || mime !== 'image/webp') {
          try {
            const webpBuffer = await convertBufferToWebp(initialBuffer);
            const webpBase64 = `data:image/webp;base64,${webpBuffer.toString('base64')}`;
            const newSize = webpBuffer.length;

            if (newSize < initialSize) {
              await doc.ref.update({
                image: webpBase64,
                imageFormat: 'webp',
                imageOptimizedAt: admin.firestore.FieldValue.serverTimestamp()
              });

              const saved = initialSize - newSize;
              totalSavedBytes += saved;
              optimizedCount++;

              const title = data.title?.fr || data.title || doc.id;
              console.log(`✨ [${title}] Optimisé : ${formatBytes(initialSize)} ➔ ${formatBytes(newSize)} (-${Math.round((saved / initialSize) * 100)}%)`);
            } else {
              console.log(`ℹ️ [${doc.id}] Déjà optimal.`);
            }
          } catch (err) {
            console.warn(`⚠️ Erreur d'optimisation pour le doc ${doc.id}:`, err.message);
          }
        } else {
          console.log(`✅ [${doc.id}] Déjà léger (${formatBytes(initialSize)}).`);
        }
      }
    }
  }

  console.log(`\n🎉 Bilan ${collectionName} : ${optimizedCount} image(s) convertie(s) en WebP.`);
  console.log(`📊 Espace total économisé : ${formatBytes(totalSavedBytes)}.`);
}

async function main() {
  try {
    await optimizeCollection('products');
    await optimizeCollection('properties');
    console.log('\n🚀 Optimisation terminée avec succès ! Le site est maintenant beaucoup plus léger.');
    process.exit(0);
  } catch (err) {
    console.error('Erreur générale:', err);
    process.exit(1);
  }
}

main();
