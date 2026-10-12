import { doc, updateDoc, serverTimestamp, deleteField } from "firebase/firestore";
import { db } from "./firebase";

/**
 * Statuts alignés sur l'espace livreur web (src/app/(driver)) et les API Next.js :
 * CONFIRMED_AWAITING_DRIVER → ACCEPTED → ARRIVED_AWAITING_PAYMENT → COMPLETED
 */
export const ORDER_STATUS = {
  AWAITING_DRIVER: "CONFIRMED_AWAITING_DRIVER",
  ACCEPTED: "ACCEPTED",
  ARRIVED: "ARRIVED_AWAITING_PAYMENT",
  COMPLETED: "COMPLETED",
} as const;

export const ACTIVE_STATUSES: string[] = [ORDER_STATUS.ACCEPTED, ORDER_STATUS.ARRIVED];

export const API_URL = (process.env.EXPO_PUBLIC_API_URL || "https://rayons.net").replace(/\/$/, "");

export type DriverProfile = {
  uid: string;
  name: string;
  phone: string;
  vehicle: string;
  supplierId: string;
};

export type LatLng = { lat: number; lng: number };

// ── Helpers d'affichage ──
export const getClientName = (o: any) =>
  o?.clientName || o?.customerInfo?.name || o?.deliveryDetails?.recipientName || "Client";

export const getClientPhone = (o: any): string =>
  o?.clientPhone || o?.customerInfo?.phone || o?.deliveryDetails?.recipientPhone || "";

export const getClientAddress = (o: any): string =>
  o?.clientAddress || o?.customerInfo?.address || o?.deliveryDetails?.address || "";

export const getAmountToCollect = (o: any): number =>
  Number(o?.remainingBalance ?? o?.totalAmount ?? o?.total ?? 0);

export const formatMoney = (amount: number, currency?: string) => {
  const cur = currency || "$";
  const value = Number(amount || 0).toLocaleString("fr-FR", { maximumFractionDigits: 2 });
  return cur === "$" ? `${value} $` : `${value} ${cur}`;
};

export const shortId = (id: string) => id.substring(0, 6).toUpperCase();

/** Une commande est-elle visible pour ce livreur (livreur exclusif d'un fournisseur ou livreur plateforme) ? */
export const isOrderForDriver = (order: any, supplierId: string) => {
  if (!supplierId || ["admin", "superAdmin"].includes(supplierId)) return true;
  const ids = Array.isArray(order.supplierIds) ? order.supplierIds : [];
  return order.supplierId === supplierId || ids.includes(supplierId);
};

async function postJson(path: string, body: Record<string, unknown>) {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("Connexion impossible. Vérifiez votre réseau internet.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    const err: any = new Error(data.message || data.error || "Erreur serveur, réessayez.");
    err.code = data.code;
    throw err;
  }
  return data;
}

/** Acceptation atomique côté serveur (anti-doublon entre livreurs). */
export const acceptMission = (orderId: string, driver: DriverProfile) =>
  postJson("/api/driver/accept-mission", {
    orderId,
    driverId: driver.uid,
    driverName: driver.name,
    driverPhone: driver.phone,
    driverVehicle: driver.vehicle,
  });

/** Le livreur signale son arrivée : le client est notifié (SMS / email). */
export async function markArrived(order: any) {
  await updateDoc(doc(db, "orders", order.id), {
    status: ORDER_STATUS.ARRIVED,
    arrivedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  fetch(`${API_URL}/api/notifications`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "ORDER_STATUS_CHANGED",
      orderId: order.id,
      status: ORDER_STATUS.ARRIVED,
      clientId: order.clientId,
      clientPhone: getClientPhone(order),
    }),
  }).catch(() => {});
}

/** Livraison confirmée + encaissement : écritures de caisse et notifications gérées par le serveur. */
export const confirmDelivery = (order: any, driver: DriverProfile) =>
  postJson("/api/orders/confirm-delivery", {
    orderId: order.id,
    driverId: driver.uid,
    driverName: driver.name,
    driverPhone: driver.phone,
    amountCollected: getAmountToCollect(order),
    paymentMethod: "CASH",
  });

/** Le livreur abandonne la course : elle retourne dans la file des courses disponibles. */
export const releaseMission = (orderId: string) =>
  updateDoc(doc(db, "orders", orderId), {
    status: ORDER_STATUS.AWAITING_DRIVER,
    driverId: deleteField(),
    driverName: deleteField(),
    driverPhone: deleteField(),
    driverVehicle: deleteField(),
    driverLocation: deleteField(),
    releasedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

/** Publie la position GPS du livreur (lue par la page de suivi client). */
export const publishDriverLocation = (orderId: string, loc: LatLng) =>
  updateDoc(doc(db, "orders", orderId), {
    driverLocation: { lat: loc.lat, lng: loc.lng, updatedAt: Date.now() },
  });

// Position par défaut enregistrée par le checkout quand le client n'a pas partagé sa position
const KINSHASA_DEFAULT = { lat: -4.322447, lng: 15.307045 };
const isDefaultLocation = (l?: LatLng) =>
  !l || (Math.abs(l.lat - KINSHASA_DEFAULT.lat) < 1e-5 && Math.abs(l.lng - KINSHASA_DEFAULT.lng) < 1e-5);

/** Position de livraison : coordonnées réelles du client, sinon géocodage de l'adresse (OpenStreetMap). */
export async function resolveDestination(order: any): Promise<{ location: LatLng | null; approximate: boolean }> {
  const loc = order?.clientLocation;
  if (loc && typeof loc.lat === "number" && typeof loc.lng === "number" && !isDefaultLocation(loc)) {
    return { location: { lat: loc.lat, lng: loc.lng }, approximate: false };
  }
  const address = getClientAddress(order);
  if (address && address !== "Kinshasa") {
    try {
      const city = order?.deliveryDetails?.city || "Kinshasa";
      const q = encodeURIComponent(address.toLowerCase().includes(city.toLowerCase()) ? address : `${address}, ${city}`);
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=cd&q=${q}`, {
        headers: { "User-Agent": "RayonLivreur/1.0 (contact@rayons.net)", "Accept-Language": "fr" },
      });
      const results = await res.json();
      if (Array.isArray(results) && results[0]) {
        return { location: { lat: Number(results[0].lat), lng: Number(results[0].lon) }, approximate: false };
      }
    } catch {}
  }
  return { location: loc && typeof loc.lat === "number" ? { lat: loc.lat, lng: loc.lng } : null, approximate: true };
}

export function distanceKm(a: LatLng, b: LatLng) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
