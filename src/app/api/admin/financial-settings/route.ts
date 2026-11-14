import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { getServerCaller } from "@/lib/serverAuth";

export async function GET(req: NextRequest) {
  try {
    const caller = await getServerCaller(req);
    if (!caller || !caller.uid) {
      return NextResponse.json({ success: false, error: "Non autorisé" }, { status: 401 });
    }

    const platformDoc = await adminDb.collection("settings").doc("platform").get();
    const data = platformDoc.exists ? platformDoc.data() : {};

    const settings = {
      usdToFcRate: Number(data?.usdToFcRate || data?.exchangeRateFC) || 2850,
      usdToEurRate: Number(data?.usdToEurRate || data?.exchangeRateEUR) || 0.92,
      referralCommissionUSD: Number(data?.referralCommissionUSD) || 5,
      promoDiscountUSD: Number(data?.promoDiscountUSD) || 10,
      monthlySubscriptionPrice: Number(data?.monthlySubscriptionPrice) || 50,
      trialDurationDays: Number(data?.trialDurationDays) || 15,
      updatedAt: data?.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : null,
      updatedBy: data?.updatedBy || null,
    };

    const pendingProposal = data?.pendingFinancialProposal || null;

    // Récupérer les 5 derniers changements archivés
    const historySnap = await adminDb
      .collection("financial_change_history")
      .orderBy("appliedAt", "desc")
      .limit(5)
      .get();

    const history = historySnap.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data(),
      appliedAt: doc.data().appliedAt?.toDate ? doc.data().appliedAt.toDate().toISOString() : null,
    }));

    return NextResponse.json({
      success: true,
      settings,
      pendingProposal,
      history,
    });
  } catch (error: any) {
    console.error("[GET FINANCIAL SETTINGS ERROR]:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const caller = await getServerCaller(req);
    if (!caller || !caller.uid) {
      return NextResponse.json({ success: false, error: "Non autorisé" }, { status: 401 });
    }

    const body = await req.json();
    const { action, proposalData, rejectionReason } = body;

    const callerDoc = await adminDb.collection("users").doc(caller.uid).get();
    const callerData = callerDoc.exists ? callerDoc.data() : {};
    const roleUpper = String(callerData?.role || "").toUpperCase();
    const isSuperAdmin =
      Boolean((caller as any).claims?.superAdmin) ||
      ["SUPER_ADMIN", "SUPERADMIN"].includes(roleUpper) ||
      (Array.isArray(callerData?.staffProfile?.positions) &&
        callerData.staffProfile.positions.includes("DIRECTEUR_GENERAL"));

    const platformRef = adminDb.collection("settings").doc("platform");
    const platformDoc = await platformRef.get();
    const currentData = platformDoc.exists ? platformDoc.data() : {};

    // ─────────────────────────────────────────────────────────────
    // ACTION 1 : PROPOSER UNE MODIFICATION (PAR LE FINANCIER OU L'ADMIN)
    // ─────────────────────────────────────────────────────────────
    if (action === "PROPOSE_CHANGE") {
      const {
        usdToFcRate,
        referralCommissionUSD,
        promoDiscountUSD,
        monthlySubscriptionPrice,
        reason,
        applyDirectly,
      } = proposalData;

      const newValues = {
        usdToFcRate: Number(usdToFcRate) || Number(currentData?.usdToFcRate) || 2850,
        referralCommissionUSD: Number(referralCommissionUSD) || Number(currentData?.referralCommissionUSD) || 5,
        promoDiscountUSD: Number(promoDiscountUSD) || Number(currentData?.promoDiscountUSD) || 10,
        monthlySubscriptionPrice: Number(monthlySubscriptionPrice) || Number(currentData?.monthlySubscriptionPrice) || 50,
      };

      // Si c'est le Super Admin / DG et qu'il souhaite appliquer directement sans étape d'attente
      if (isSuperAdmin && applyDirectly) {
        await platformRef.set(
          {
            ...newValues,
            updatedAt: FieldValue.serverTimestamp(),
            updatedBy: caller.uid,
            updatedByName: callerData?.displayName || "Direction Générale",
            pendingFinancialProposal: null,
          },
          { merge: true }
        );

        // Archivage
        await adminDb.collection("financial_change_history").add({
          values: newValues,
          previousValues: {
            usdToFcRate: currentData?.usdToFcRate || 2850,
            referralCommissionUSD: currentData?.referralCommissionUSD || 5,
            promoDiscountUSD: currentData?.promoDiscountUSD || 10,
            monthlySubscriptionPrice: currentData?.monthlySubscriptionPrice || 50,
          },
          reason: reason || "Mise à jour directe par la Direction Générale",
          appliedBy: caller.uid,
          appliedByName: callerData?.displayName || "Direction Générale",
          appliedAt: FieldValue.serverTimestamp(),
          status: "APPROVED_DIRECT",
        });

        // Notifications aux concernés
        await broadcastFinancialChangeNotifications(newValues, currentData);

        return NextResponse.json({
          success: true,
          directApplied: true,
          message: "Paramètres financiers mis à jour directement et notifications transmises.",
        });
      }

      // Cas standard : Le financier soumet une proposition soumise à approbation
      const proposal = {
        id: `PROP-${Date.now()}`,
        requestedBy: caller.uid,
        requestedByName: callerData?.displayName || callerData?.name || "Responsable Financier",
        requestedByEmail: callerData?.email || "",
        requestedByRole: callerData?.staffProfile?.positions?.[0] || callerData?.role || "FINANCE",
        requestedAt: new Date().toISOString(),
        proposed: newValues,
        current: {
          usdToFcRate: Number(currentData?.usdToFcRate) || 2850,
          referralCommissionUSD: Number(currentData?.referralCommissionUSD) || 5,
          promoDiscountUSD: Number(currentData?.promoDiscountUSD) || 10,
          monthlySubscriptionPrice: Number(currentData?.monthlySubscriptionPrice) || 50,
        },
        reason: reason || "Ajustement opérationnel des paramètres financiers",
        status: "PENDING_APPROVAL",
      };

      await platformRef.set({ pendingFinancialProposal: proposal }, { merge: true });

      // Notifier la Direction Générale / Super Admin
      await adminDb.collection("inapp_notifications").add({
        type: "FINANCE_PROPOSAL",
        title: "📑 Proposition financière en attente d'approbation",
        message: `${proposal.requestedByName} a soumis un ajustement des paramètres financiers (Taux USD/FC: ${newValues.usdToFcRate}, Commission: ${newValues.referralCommissionUSD}$, Abonnement: ${newValues.monthlySubscriptionPrice}$). Veuillez approuver ou refuser.`,
        link: "/admin/finance",
        read: false,
        targetRole: "SUPER_ADMIN",
        createdAt: FieldValue.serverTimestamp(),
      });

      return NextResponse.json({
        success: true,
        directApplied: false,
        message: "Proposition soumise avec succès. L'Administrateur Principal doit maintenant l'approuver.",
        proposal,
      });
    }

    // ─────────────────────────────────────────────────────────────
    // ACTION 2 : APPROUVER LA PROPOSITION (RÉSERVÉ SUPER ADMIN / DG)
    // ─────────────────────────────────────────────────────────────
    if (action === "APPROVE_CHANGE") {
      if (!isSuperAdmin) {
        return NextResponse.json(
          { success: false, error: "Seul l'Administrateur Principal (Direction Générale) peut approuver cette modification." },
          { status: 403 }
        );
      }

      const pending = currentData?.pendingFinancialProposal;
      if (!pending || pending.status !== "PENDING_APPROVAL") {
        return NextResponse.json({ success: false, error: "Aucune proposition en attente." }, { status: 400 });
      }

      const newValues = pending.proposed;

      // 1. Appliquer les valeurs actives
      await platformRef.set(
        {
          ...newValues,
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: caller.uid,
          updatedByName: callerData?.displayName || "Direction Générale",
          pendingFinancialProposal: null,
        },
        { merge: true }
      );

      // 2. Archiver dans l'historique
      await adminDb.collection("financial_change_history").add({
        proposalId: pending.id,
        values: newValues,
        previousValues: pending.current,
        reason: pending.reason,
        requestedBy: pending.requestedBy,
        requestedByName: pending.requestedByName,
        approvedBy: caller.uid,
        approvedByName: callerData?.displayName || "Direction Générale",
        appliedAt: FieldValue.serverTimestamp(),
        status: "APPROVED",
      });

      // 3. Notifier le financier demandeur
      if (pending.requestedBy) {
        await adminDb.collection("inapp_notifications").add({
          userId: pending.requestedBy,
          type: "FINANCE_APPROVED",
          title: "✅ Modification financière approuvée !",
          message: `La Direction Générale a validé votre proposition : Taux USD: ${newValues.usdToFcRate} FC, Commission: ${newValues.referralCommissionUSD} USD.`,
          link: "/admin/finance",
          read: false,
          createdAt: FieldValue.serverTimestamp(),
        });
      }

      // 4. Notifier tous les concernés (Partenaires et Fournisseurs)
      await broadcastFinancialChangeNotifications(newValues, pending.current);

      return NextResponse.json({
        success: true,
        message: "Proposition approuvée et appliquée avec succès. Les notifications ont été diffusées aux concernés.",
      });
    }

    // ─────────────────────────────────────────────────────────────
    // ACTION 3 : REJETER LA PROPOSITION (RÉSERVÉ SUPER ADMIN / DG)
    // ─────────────────────────────────────────────────────────────
    if (action === "REJECT_CHANGE") {
      if (!isSuperAdmin) {
        return NextResponse.json(
          { success: false, error: "Seul l'Administrateur Principal peut rejeter cette modification." },
          { status: 403 }
        );
      }

      const pending = currentData?.pendingFinancialProposal;
      if (!pending) {
        return NextResponse.json({ success: false, error: "Aucune proposition en attente." }, { status: 400 });
      }

      // Supprimer la proposition en attente
      await platformRef.update({ pendingFinancialProposal: FieldValue.delete() });

      // Archiver le rejet
      await adminDb.collection("financial_change_history").add({
        proposalId: pending.id,
        values: pending.proposed,
        previousValues: pending.current,
        reason: pending.reason,
        requestedBy: pending.requestedBy,
        requestedByName: pending.requestedByName,
        rejectedBy: caller.uid,
        rejectedByName: callerData?.displayName || "Direction Générale",
        rejectionReason: rejectionReason || "Rejeté par la Direction Générale",
        appliedAt: FieldValue.serverTimestamp(),
        status: "REJECTED",
      });

      // Notifier le financier
      if (pending.requestedBy) {
        await adminDb.collection("inapp_notifications").add({
          userId: pending.requestedBy,
          type: "FINANCE_REJECTED",
          title: "❌ Modification financière refusée",
          message: `La Direction Générale n'a pas retenu votre proposition. Motif : ${rejectionReason || "Non précisé"}.`,
          link: "/admin/finance",
          read: false,
          createdAt: FieldValue.serverTimestamp(),
        });
      }

      return NextResponse.json({
        success: true,
        message: "Proposition rejetée.",
      });
    }

    return NextResponse.json({ success: false, error: "Action non reconnue." }, { status: 400 });
  } catch (error: any) {
    console.error("[POST FINANCIAL SETTINGS ERROR]:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/** Diffuse les notifications in-app aux personnes concernées */
async function broadcastFinancialChangeNotifications(newValues: any, oldValues: any) {
  try {
    const notificationsToCreate: any[] = [];

    // Si le taux de change USD -> FC a changé
    if (newValues.usdToFcRate !== oldValues.usdToFcRate) {
      notificationsToCreate.push({
        title: "💱 Actualisation du Taux de Change Officiel",
        message: `Le taux de change de référence sur Rayons.net a été actualisé : 1 USD = ${newValues.usdToFcRate} FC (au lieu de ${oldValues.usdToFcRate} FC). Vos prix en Francs Congolais s'ajustent automatiquement.`,
        targetAudience: "ALL",
        link: "/",
        createdAt: FieldValue.serverTimestamp(),
        type: "RATE_UPDATE",
      });
    }

    // Si la commission partenaire a changé
    if (newValues.referralCommissionUSD !== oldValues.referralCommissionUSD) {
      notificationsToCreate.push({
        title: "💰 Évolution de la Commission Partenaire",
        message: `Bonne nouvelle ! Le montant de votre commission récurrente sur chaque abonnement de vos boutiques affiliées est désormais de ${newValues.referralCommissionUSD} USD.`,
        targetAudience: "PARTNERS",
        link: "/partner",
        createdAt: FieldValue.serverTimestamp(),
        type: "COMMISSION_UPDATE",
      });
    }

    // Si le montant de réduction promo a changé
    if (newValues.promoDiscountUSD !== oldValues.promoDiscountUSD) {
      notificationsToCreate.push({
        title: "🏷️ Offre Promo Partenaires Actualisée",
        message: `La réduction immédiate accordée à vos filleuls lors de leur premier abonnement avec votre code promo est maintenant fixée à ${newValues.promoDiscountUSD} USD.`,
        targetAudience: "PARTNERS",
        link: "/partner",
        createdAt: FieldValue.serverTimestamp(),
        type: "PROMO_UPDATE",
      });
    }

    // Enregistrer les notifications globales de diffusion
    for (const notif of notificationsToCreate) {
      await adminDb.collection("system_announcements").add(notif);
    }
  } catch (err) {
    console.warn("Could not broadcast financial change notifications:", err);
  }
}
