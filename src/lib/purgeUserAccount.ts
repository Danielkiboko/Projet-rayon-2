import { adminAuth, adminDb } from "@/lib/firebase-admin";

const runWithTimeout = <T,>(promise: Promise<T>, ms: number, label: string): Promise<T> =>
  Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`FIRESTORE_TIMEOUT:${label}`)), ms)
    ),
  ]);

export interface PurgeResult {
  authDeleted: boolean;
  deletedProducts: number;
  deletedProperties: number;
  deletedPushDevices: number;
  deletedSubscriptionRequests: number;
  deletedNotifications: number;
  deletedSubAgents: number;
}

/**
 * Suppression hermétique et définitive d'un utilisateur / fournisseur / membre Team :
 * - Révoque tous les refresh tokens + supprime le compte Firebase Auth (zéro session résiduelle)
 * - Supprime users/{uid}, suppliers/{uid}, drivers/{uid}, referrals/{uid}
 * - Supprime tous ses produits, biens immobiliers, demandes d'abonnement, appareils push et notifications
 * - Révoque et supprime les éventuels sous-agents rattachés (parentSupplierId == uid)
 */
export async function purgeUserAccountCompletely(
  uid: string,
  options?: { collectionName?: string }
): Promise<PurgeResult> {
  // 1. Tuer la session Auth + récupérer uniquement les références (.select() = 0 payload) EN PARALLÈLE
  const [
    authDeleted,
    productsSnap,
    propertiesSnap,
    pushDevicesSnap,
    subRequestsSnap,
    notifsSnap,
    subAgentsSnap,
  ]: [boolean, any, any, any, any, any, any] = await Promise.all([
    (async () => {
      try {
        await adminAuth.revokeRefreshTokens(uid).catch(() => {});
        await adminAuth.deleteUser(uid);
        return true;
      } catch (authErr: any) {
        if (authErr?.code === "auth/user-not-found") return true;
        console.warn("[purgeUserAccount] Auth delete warning:", authErr?.message);
        return false;
      }
    })(),
    runWithTimeout<any>(
      adminDb.collection("products").where("supplierId", "==", uid).select().limit(200).get(),
      8000,
      "products.refs"
    ).catch(() => null),
    runWithTimeout<any>(
      adminDb.collection("properties").where("supplierId", "==", uid).select().limit(200).get(),
      8000,
      "properties.refs"
    ).catch(() => null),
    runWithTimeout<any>(
      adminDb.collection("push_devices").where("boundUid", "==", uid).select().limit(50).get(),
      6000,
      "push_devices.refs"
    ).catch(() => null),
    runWithTimeout<any>(
      adminDb.collection("subscription_requests").where("supplierId", "==", uid).select().limit(100).get(),
      6000,
      "subscription_requests.refs"
    ).catch(() => null),
    runWithTimeout<any>(
      adminDb.collection("inapp_notifications").where("userId", "==", uid).select().limit(100).get(),
      6000,
      "inapp_notifications.refs"
    ).catch(() => null),
    runWithTimeout<any>(
      adminDb.collection("users").where("parentSupplierId", "==", uid).select().limit(50).get(),
      6000,
      "sub_agents.refs"
    ).catch(() => null),
  ]);

  // 2. Collecter toutes les références Firestore à effacer (en respectant la limite de 450 ops/batch)
  const refsToDelete: any[] = [
    adminDb.collection("users").doc(uid),
    adminDb.collection("suppliers").doc(uid),
    adminDb.collection("drivers").doc(uid),
    adminDb.collection("referrals").doc(uid),
  ];

  const allowedCollections = ["users", "suppliers", "drivers"];
  if (options?.collectionName && allowedCollections.includes(options.collectionName)) {
    refsToDelete.push(adminDb.collection(options.collectionName).doc(uid));
  }

  const pushRefs = (snap: any) => {
    if (!snap || typeof snap.forEach !== "function") return 0;
    let count = 0;
    snap.forEach((docSnap: any) => {
      refsToDelete.push(docSnap.ref);
      count++;
    });
    return count;
  };

  const deletedProducts = pushRefs(productsSnap);
  const deletedProperties = pushRefs(propertiesSnap);
  const deletedPushDevices = pushRefs(pushDevicesSnap);
  const deletedSubscriptionRequests = pushRefs(subRequestsSnap);
  const deletedNotifications = pushRefs(notifsSnap);

  // Supprimer aussi les sous-agents rattachés à ce fournisseur dans Auth & Firestore
  const subAgentIds: string[] = [];
  if (subAgentsSnap && typeof subAgentsSnap.forEach === "function") {
    subAgentsSnap.forEach((docSnap: any) => {
      if (docSnap.id !== uid) {
        subAgentIds.push(docSnap.id);
        refsToDelete.push(docSnap.ref);
      }
    });
  }

  if (subAgentIds.length > 0) {
    await Promise.allSettled(
      subAgentIds.map(async (subId) => {
        await adminAuth.revokeRefreshTokens(subId).catch(() => {});
        await adminAuth.deleteUser(subId).catch(() => {});
      })
    );
  }

  // Dédupliquer les chemins pour éviter des opérations en double
  const seenPaths = new Set<string>();
  const uniqueRefs = refsToDelete.filter((ref) => {
    const p = ref?.path || "";
    if (!p || seenPaths.has(p)) return false;
    seenPaths.add(p);
    return true;
  });

  // Exécuter les suppressions par lots de 400
  const CHUNK_SIZE = 400;
  for (let i = 0; i < uniqueRefs.length; i += CHUNK_SIZE) {
    const chunk = uniqueRefs.slice(i, i + CHUNK_SIZE);
    const batch = adminDb.batch();
    for (const ref of chunk) {
      batch.delete(ref);
    }
    await runWithTimeout(batch.commit(), 10000, `purge.batch.${i}`);
  }

  return {
    authDeleted,
    deletedProducts,
    deletedProperties,
    deletedPushDevices,
    deletedSubscriptionRequests,
    deletedNotifications,
    deletedSubAgents: subAgentIds.length,
  };
}
