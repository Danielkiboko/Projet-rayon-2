import { NextRequest, NextResponse } from "next/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { adminDb, initFirebaseAdmin } from "@/lib/firebase-admin";
import { getServerCaller } from "@/lib/serverAuth";
import { dispatchAccountNotification } from "@/lib/pushNotifications";
import { sendEmail } from "@/lib/email";

/**
 * GET / POST /api/cron/abandoned-carts
 * Relance automatique des paniers abandonnés (Email HTML + Push FCM + In-App).
 *
 * Cadence anti-spam :
 * - Rappel 1 : après 2 heures d'inactivité (Push + Email)
 * - Rappel 2 : après 24 heures d'inactivité (dernier rappel Push + Email)
 * - Arrêt automatique après 2 rappels, après 7 jours, ou dès qu'une commande est passée.
 *
 * Sécurité :
 * - `Authorization: Bearer ${CRON_SECRET}` (ou `?secret=${CRON_SECRET}` pour cron-job / Hostinger)
 * - Ou un Super Admin connecté pour déclenchement manuel / test.
 */

const REMINDER_1_DELAY_MS = 2 * 60 * 60 * 1000; // 2 heures
const REMINDER_2_DELAY_MS = 24 * 60 * 60 * 1000; // 24 heures
const MIN_GAP_BETWEEN_REMINDERS_MS = 18 * 60 * 60 * 1000; // 18 heures min entre R1 et R2
const CART_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 jours max

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildAbandonedCartEmailHtml(params: {
  displayName: string;
  items: Array<{ title: string; price: number; quantity: number; image?: string }>;
  subtotal: number;
  reminderStage: 1 | 2;
  recoverUrl: string;
}) {
  const { displayName, items, subtotal, reminderStage, recoverUrl } = params;
  const safeName = escapeHtml(displayName || "Client");
  const headline =
    reminderStage === 1
      ? "Votre panier vous attend sur Rayons.net"
      : "Dernier rappel : vos articles sont toujours disponibles";
  const intro =
    reminderStage === 1
      ? `Bonjour ${safeName}, vous avez laissé ${items.length} article(s) dans votre panier. Finalisez votre commande en 1 clic avant rupture de stock.`
      : `Bonjour ${safeName}, vos articles sélectionnés sur Rayons.net sont encore réservables aujourd’hui. Ne manquez pas votre commande !`;

  const rowsHtml = items
    .slice(0, 6)
    .map((item) => {
      const lineTotal = (Number(item.price || 0) * Number(item.quantity || 1)).toFixed(2);
      return `
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #1E3343;color:#FFFFFF;font-size:14px;font-weight:600;">
            ${escapeHtml(item.title)}
            <div style="font-size:12px;color:#94A3B8;font-weight:400;margin-top:2px;">Quantité : ${Number(item.quantity || 1)}</div>
          </td>
          <td style="padding:12px 0;border-bottom:1px solid #1E3343;color:#C7D300;font-size:14px;font-weight:700;text-align:right;white-space:nowrap;">
            $${lineTotal}
          </td>
        </tr>
      `;
    })
    .join("");

  const moreCount = items.length > 6 ? items.length - 6 : 0;
  const moreNote = moreCount
    ? `<p style="margin:10px 0 0;font-size:12px;color:#94A3B8;">+ ${moreCount} autre(s) article(s) dans votre panier.</p>`
    : "";

  return `
  <!DOCTYPE html>
  <html lang="fr">
    <body style="margin:0;padding:0;background-color:#081219;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#081219;padding:24px 12px;">
        <tr>
          <td align="center">
            <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#0F1D27;border:1px solid #1E3343;border-radius:16px;overflow:hidden;">
              <tr>
                <td style="padding:24px 28px;border-bottom:1px solid #1E3343;">
                  <div style="font-size:22px;font-weight:800;color:#FFFFFF;letter-spacing:-0.4px;">
                    Rayons<span style="color:#C7D300;">.net</span>
                  </div>
                  <div style="font-size:11px;color:#94A3B8;margin-top:4px;text-transform:uppercase;letter-spacing:1px;">
                    Rappel de panier sécurisé
                  </div>
                </td>
              </tr>
              <tr>
                <td style="padding:28px;">
                  <h1 style="margin:0 0 12px;font-size:20px;line-height:1.3;color:#FFFFFF;font-weight:800;">
                    ${escapeHtml(headline)}
                  </h1>
                  <p style="margin:0 0 22px;font-size:14px;line-height:1.6;color:#CBD5E1;">
                    ${intro}
                  </p>
                  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0B161E;border:1px solid #1E3343;border-radius:12px;padding:0 16px;">
                    ${rowsHtml}
                    <tr>
                      <td style="padding:14px 0;color:#E2E8F0;font-size:14px;font-weight:700;">Total estimé</td>
                      <td style="padding:14px 0;color:#C7D300;font-size:18px;font-weight:800;text-align:right;">
                        $${Number(subtotal || 0).toFixed(2)} USD
                      </td>
                    </tr>
                  </table>
                  ${moreNote}
                  <div style="text-align:center;margin:28px 0 18px;">
                    <a href="${escapeHtml(recoverUrl)}" style="display:inline-block;background-color:#C7D300;color:#0F1D27;font-size:14px;font-weight:800;text-decoration:none;padding:14px 28px;border-radius:12px;">
                      Finaliser ma commande &rarr;
                    </a>
                  </div>
                  <p style="margin:0;font-size:12px;line-height:1.5;color:#94A3B8;text-align:center;">
                    Paiement sécurisé à la livraison, par Mobile Money (M-Pesa, Airtel, Orange) ou Carte Visa.
                  </p>
                </td>
              </tr>
              <tr>
                <td style="padding:16px 28px;background-color:#0B161E;border-top:1px solid #1E3343;font-size:11px;color:#64748B;text-align:center;">
                  Rayons.net · Marketplace Officielle RDC · Vous recevez ce rappel suite à un ajout récent dans votre panier.
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>
  `;
}

async function authorizeCron(req: NextRequest): Promise<boolean> {
  const cronSecret = (process.env.CRON_SECRET || "").trim();
  const authHeader = req.headers.get("authorization") || "";
  const querySecret = req.nextUrl.searchParams.get("secret") || "";

  if (cronSecret && cronSecret !== "REMPLACEZ_PAR_VOTRE_SECRET") {
    if (authHeader === `Bearer ${cronSecret}` || querySecret === cronSecret) {
      return true;
    }
  }

  const caller = await getServerCaller(req);
  return Boolean(caller?.isAdmin);
}

async function runAbandonedCartReminders(req: NextRequest) {
  const authorized = await authorizeCron(req);
  if (!authorized) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const nowMs = Date.now();
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://rayons.net").replace(/\/+$/, "");
  const recoverUrl = `${siteUrl}/?openCart=1`;

  const snap = await adminDb
    .collection("abandoned_carts")
    .where("status", "==", "ACTIVE")
    .limit(100)
    .get();

  if (snap.empty) {
    return NextResponse.json({
      success: true,
      scanned: 0,
      reminded: 0,
      emailsSent: 0,
      pushesSent: 0,
      message: "Aucun panier abandonné en attente.",
    });
  }

  let reminded = 0;
  let emailsSent = 0;
  let pushesSent = 0;
  let convertedSkipped = 0;
  let expiredCleaned = 0;

  for (const docSnap of snap.docs) {
    const cart = docSnap.data() || {};
    const items = Array.isArray(cart.items) ? cart.items : [];
    const updatedAtMs = Number(cart.updatedAtMs) || 0;
    const reminderCount = Number(cart.reminderCount) || 0;
    const lastRemindedAtMs = Number(cart.lastRemindedAtMs) || 0;

    if (items.length === 0 || !updatedAtMs || nowMs - updatedAtMs > CART_EXPIRY_MS || reminderCount >= 2) {
      await docSnap.ref.set(
        { status: "EXPIRED", updatedAt: FieldValue.serverTimestamp() },
        { merge: true }
      );
      expiredCleaned++;
      continue;
    }

    const elapsedMs = nowMs - updatedAtMs;
    let stageToSend: 1 | 2 | null = null;

    if (reminderCount === 0 && elapsedMs >= REMINDER_1_DELAY_MS) {
      stageToSend = 1;
    } else if (
      reminderCount === 1 &&
      elapsedMs >= REMINDER_2_DELAY_MS &&
      (!lastRemindedAtMs || nowMs - lastRemindedAtMs >= MIN_GAP_BETWEEN_REMINDERS_MS)
    ) {
      stageToSend = 2;
    }

    if (!stageToSend) continue;

    const userId = typeof cart.userId === "string" && cart.userId.trim() ? cart.userId.trim() : null;

    // Double vérification anti-faux-rappel : vérifier si le client a déjà commandé après la mise à jour du panier
    if (userId) {
      try {
        const recentOrderSnap = await adminDb
          .collection("orders")
          .where("clientId", "==", userId)
          .where("createdAt", ">=", Timestamp.fromMillis(updatedAtMs))
          .limit(1)
          .get();

        if (!recentOrderSnap.empty) {
          await docSnap.ref.set(
            {
              status: "CONVERTED",
              convertedAt: FieldValue.serverTimestamp(),
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
          convertedSkipped++;
          continue;
        }
      } catch (checkErr) {
        // Si un index composite manque temporairement, on ne bloque pas la relance
        console.warn("[AbandonedCarts] Order cross-check fallback:", (checkErr as any)?.message);
      }
    }

    const firstTitle = String(items[0]?.title || "vos articles").slice(0, 60);
    const totalItems = Number(cart.totalItems) || items.length;
    const subtotal = Number(cart.subtotal) || 0;
    const displayName = String(cart.displayName || "Client");

    const pushTitle =
      stageToSend === 1
        ? "🛒 Votre panier vous attend sur Rayons !"
        : "⏳ Dernier rappel : finalisez votre commande";
    const pushMessage =
      totalItems === 1
        ? `${firstTitle} ($${subtotal.toFixed(2)}) est toujours dans votre panier. Commandez en 1 clic !`
        : `${firstTitle} et ${totalItems - 1} autre(s) article(s) ($${subtotal.toFixed(2)}) vous attendent dans votre panier.`;

    let sentPushForCart = false;
    let sentEmailForCart = false;

    // 1. Envoi Push + Notification In-App
    if (userId) {
      try {
        const pushRes = await dispatchAccountNotification({
          userId,
          clientId: userId,
          type: "order",
          title: pushTitle,
          message: pushMessage,
          link: "/?openCart=1",
          tag: `abandoned-cart-${docSnap.id}-s${stageToSend}`,
        });
        if (pushRes.pushedTokens > 0 || pushRes.notifiedUsers > 0) {
          sentPushForCart = true;
          pushesSent++;
        }
      } catch (pushErr) {
        console.warn(`[AbandonedCarts] Push error for ${userId}:`, (pushErr as any)?.message);
      }
    } else if (typeof cart.guestFcmToken === "string" && cart.guestFcmToken.trim()) {
      // Visiteur invité ayant accepté les notifications Push sur son téléphone/navigateur
      try {
        initFirebaseAdmin();
        await getMessaging().send({
          token: cart.guestFcmToken.trim(),
          notification: {
            title: pushTitle,
            body: pushMessage,
          },
          webpush: {
            notification: {
              title: pushTitle,
              body: pushMessage,
              icon: "/icon.png",
              badge: "/icon.png",
              tag: `abandoned-cart-${docSnap.id}-s${stageToSend}`,
            },
            fcmOptions: { link: recoverUrl },
          },
          data: {
            link: "/?openCart=1",
            type: "abandoned_cart",
          },
        });
        sentPushForCart = true;
        pushesSent++;
      } catch (guestPushErr: any) {
        const code = guestPushErr?.code || "";
        if (code === "messaging/registration-token-not-registered" || code === "messaging/invalid-registration-token") {
          await docSnap.ref.set({ status: "EXPIRED", updatedAt: FieldValue.serverTimestamp() }, { merge: true });
        }
      }
    }

    // 2. Envoi Email HTML (uniquement si adresse email connue)
    const targetEmail = typeof cart.email === "string" && cart.email.includes("@") ? cart.email.trim() : null;
    if (targetEmail) {
      try {
        const subject =
          stageToSend === 1
            ? `🛒 Vous avez oublié ${totalItems} article(s) dans votre panier Rayons.net`
            : `⏳ Vos articles Rayons.net vous attendent encore ($${subtotal.toFixed(2)})`;

        await sendEmail({
          to: targetEmail,
          subject,
          html: buildAbandonedCartEmailHtml({
            displayName,
            items,
            subtotal,
            reminderStage: stageToSend,
            recoverUrl,
          }),
        });
        sentEmailForCart = true;
        emailsSent++;
      } catch (emailErr) {
        console.warn(`[AbandonedCarts] Email error for ${targetEmail}:`, (emailErr as any)?.message);
      }
    }

    // 3. Mise à jour du compteur anti-spam même si un seul canal est dispo
    const nextCount = reminderCount + 1;
    await docSnap.ref.set(
      {
        reminderCount: nextCount,
        lastRemindedAtMs: nowMs,
        lastRemindedAt: FieldValue.serverTimestamp(),
        lastChannels: { push: sentPushForCart, email: sentEmailForCart },
        status: nextCount >= 2 ? "COMPLETED" : "ACTIVE",
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    if (sentPushForCart || sentEmailForCart) {
      reminded++;
    }
  }

  return NextResponse.json({
    success: true,
    scanned: snap.size,
    reminded,
    emailsSent,
    pushesSent,
    convertedSkipped,
    expiredCleaned,
    message: `${reminded} rappel(s) envoyé(s) (${emailsSent} email(s), ${pushesSent} push).`,
  });
}

export async function GET(req: NextRequest) {
  try {
    return await runAbandonedCartReminders(req);
  } catch (error: any) {
    console.error("[CRON ABANDONED CARTS ERROR]:", error);
    return NextResponse.json({ success: false, error: "Erreur lors de la relance paniers." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
