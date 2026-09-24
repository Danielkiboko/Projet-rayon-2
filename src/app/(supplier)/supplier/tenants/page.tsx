"use client";

import { useState, useEffect } from "react";
import { Users, Search, Plus, Bell, Home, X, DollarSign, FileText, ClipboardCheck, Wrench, ShieldCheck, History, TrendingUp, TrendingDown, ChevronDown, MessageSquare, Mail, Send } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { auth, db } from "@/lib/firebase";
import { collection, getDocs, query, where, addDoc, updateDoc, doc, getDoc, serverTimestamp } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import { generateFormalLeasePDF, generateInspectionChecklistPDF, generateRentReceiptPDF } from "@/lib/leaseGenerator";
import { recordRentPayment } from "@/lib/accountingLedger";

interface Tenant {
  id: string;
  name: string;
  phone: string;
  email: string;
  propertyId: string;
  propertyName: string;
  propertyAddress?: string;
  unitName?: string;
  rentAmount: number;
  nextPayment: string;
  status: string;
  periodicity: string;
  debtAmount?: number;
  departureDate?: string;
  levelId?: string;
  unitId?: string;
  
  // Nouveaux champs Gestion Locative & Caution
  depositAmount?: number; // Montant de la garantie locative ($)
  depositMonths?: number; // Nombre de mois de caution
  depositStatus?: "CONSERVED" | "RESTITUTED" | "DEDUCTED";
  leaseType?: "Habitation" | "Commercial" | "Mixte";
  leaseStartDate?: string;
  leaseEndDate?: string;
  paymentDueDay?: number;
  tenantIdCard?: string;
}

interface Property {
  id: string;
  title: { fr: string; en: string };
  price: number;
  location?: string;
  ownerName?: string;
  immoDetails?: {
    levels?: any[];
  }
}

export default function SupplierTenantsPage() {
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user, userData } = useAuth();
  const activeSupplierId = userData?.parentSupplierId || user?.uid;

  // Form State
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [tenantIdCard, setTenantIdCard] = useState("");
  const [selectedPropertyId, setSelectedPropertyId] = useState("");
  const [selectedLevelId, setSelectedLevelId] = useState("");
  const [selectedUnitId, setSelectedUnitId] = useState("");
  const [rentAmount, setRentAmount] = useState<number | "">("");
  const [nextPayment, setNextPayment] = useState("");
  const [periodicity, setPeriodicity] = useState("Mensuel");
  
  // Nouveaux champs Garantie & Bail
  const [depositAmount, setDepositAmount] = useState<number | "">("");
  const [depositMonths, setDepositMonths] = useState<number>(3);
  const [leaseType, setLeaseType] = useState<"Habitation" | "Commercial">("Habitation");
  const [leaseStartDate, setLeaseStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [leaseEndDate, setLeaseEndDate] = useState("");
  const [paymentDueDay, setPaymentDueDay] = useState<number>(5);

  // Departure Modal State
  const [isDepartureModalOpen, setIsDepartureModalOpen] = useState(false);
  const [tenantToDepart, setTenantToDepart] = useState<Tenant | null>(null);
  const [departureDate, setDepartureDate] = useState("");
  const [debtAmount, setDebtAmount] = useState<number | "">(0);
  const [depositRestitutionStatus, setDepositRestitutionStatus] = useState<"RESTITUTED" | "DEDUCTED">("RESTITUTED");

  // Payment Modal State
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [tenantToPay, setTenantToPay] = useState<Tenant | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number | "">("");
  const [paymentReference, setPaymentReference] = useState("");

  // Maintenance Tickets Modal State
  const [isMaintenanceModalOpen, setIsMaintenanceModalOpen] = useState(false);
  const [maintenanceTenant, setMaintenanceTenant] = useState<Tenant | null>(null);
  const [maintenanceTitle, setMaintenanceTitle] = useState("");
  const [maintenanceCost, setMaintenanceCost] = useState<number | "">("");
  const [maintenanceChargedTo, setMaintenanceChargedTo] = useState<"BAILLEUR" | "LOCATAIRE">("BAILLEUR");
  const [maintenanceCategory, setMaintenanceCategory] = useState("Plomberie");
  const [sendingEmailTenantId, setSendingEmailTenantId] = useState<string | null>(null);

  // Payment History Modal State
  type Payment = { id: string; amount: number; currency: string; reference: string; createdAt: any; };
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [historyTenant, setHistoryTenant] = useState<Tenant | null>(null);
  const [tenantPayments, setTenantPayments] = useState<Payment[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const loadTenantPayments = async (tenant: Tenant) => {
    setHistoryTenant(tenant);
    setIsHistoryModalOpen(true);
    setTenantPayments([]);
    setIsLoadingHistory(true);
    try {
      const q = query(
        collection(db, "payments"),
        where("tenantId", "==", tenant.id)
      );
      const snap = await getDocs(q);
      const list = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as Payment))
        .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
      setTenantPayments(list);
    } catch (err) {
      console.error("Error loading payment history:", err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Treasury state
  type MonthRow = { month: string; label: string; income: number; charges: number; net: number; };
  const [treasuryRows, setTreasuryRows] = useState<MonthRow[]>([]);
  const [isTreasuryOpen, setIsTreasuryOpen] = useState(true);
  const [isLoadingTreasury, setIsLoadingTreasury] = useState(false);

  useEffect(() => {
    if (!activeSupplierId) return;
    const loadTreasury = async () => {
      setIsLoadingTreasury(true);
      try {
        // Payments (loyers)
        const paymentsSnap = await getDocs(
          query(collection(db, "payments"), where("supplierId", "==", activeSupplierId))
        );
        // Maintenance tickets
        const maintenanceSnap = await getDocs(
          query(collection(db, "maintenance_tickets"), where("supplierId", "==", activeSupplierId))
        );

        const incomeByMonth: Record<string, number> = {};
        const chargesByMonth: Record<string, number> = {};

        paymentsSnap.docs.forEach(d => {
          const data = d.data();
          const date: Date = data.createdAt?.toDate?.() || new Date();
          const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
          incomeByMonth[key] = (incomeByMonth[key] || 0) + Number(data.amount || 0);
        });

        maintenanceSnap.docs.forEach(d => {
          const data = d.data();
          const date: Date = data.createdAt?.toDate?.() || new Date();
          const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
          chargesByMonth[key] = (chargesByMonth[key] || 0) + Number(data.cost || 0);
        });

        // Merge all months
        const allKeys = new Set([...Object.keys(incomeByMonth), ...Object.keys(chargesByMonth)]);
        const rows: MonthRow[] = Array.from(allKeys)
          .sort((a, b) => b.localeCompare(a)) // desc
          .slice(0, 12) // 12 derniers mois
          .map(key => {
            const [y, m] = key.split("-");
            const label = new Date(Number(y), Number(m) - 1, 1)
              .toLocaleString("fr-FR", { month: "long", year: "numeric" });
            const income = incomeByMonth[key] || 0;
            const charges = chargesByMonth[key] || 0;
            return { month: key, label, income, charges, net: income - charges };
          });

        // Always show current month even if empty
        const now = new Date();
        const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
        if (!rows.find(r => r.month === currentKey)) {
          const label = now.toLocaleString("fr-FR", { month: "long", year: "numeric" });
          rows.unshift({ month: currentKey, label, income: 0, charges: 0, net: 0 });
        }

        setTreasuryRows(rows);
      } catch (err) {
        console.error("Error loading treasury:", err);
      } finally {
        setIsLoadingTreasury(false);
      }
    };
    loadTreasury();
  }, [activeSupplierId]);

  // ── HELPER AGENCE ÉMETTRICE ─────────────────────────
  const getAgencyName = () => {
    return userData?.company || userData?.agencyName || userData?.displayName || userData?.name || "MUTAMULIS";
  };

  const getAgencyDetails = () => {
    const name = getAgencyName();
    return {
      name,
      phone: userData?.phone || "",
      email: userData?.email || user?.email || "",
      address: userData?.address || "Kinshasa, RDC",
      rccm: userData?.rccm || "",
      nif: userData?.nif || "",
      idNat: userData?.idNat || "",
    };
  };

  // ── ENVOI BAIL PAR EMAIL ─────────────────────────────
  const handleSendLeaseByEmail = async (tenant: Tenant) => {
    if (!tenant.email) {
      alert(`Le locataire ${tenant.name} n'a pas d'adresse email enregistrée.`);
      return;
    }

    setSendingEmailTenantId(tenant.id);
    try {
      const prop = properties.find(p => p.id === tenant.propertyId);
      const agency = getAgencyDetails();

      // Générer le PDF sans téléchargement direct
      const leaseResult = await generateFormalLeasePDF({
        agencyName: agency.name,
        agencyPhone: agency.phone,
        agencyEmail: agency.email,
        agencyAddress: agency.address,
        agencyRccm: agency.rccm,
        agencyNif: agency.nif,
        agencyIdNat: agency.idNat,
        ownerName: prop?.ownerName || undefined,

        tenantName: tenant.name,
        tenantPhone: tenant.phone,
        tenantEmail: tenant.email,
        tenantIdCard: tenant.tenantIdCard,

        propertyName: tenant.propertyName,
        unitName: tenant.unitName,
        propertyAddress: tenant.propertyAddress || prop?.location || "Kinshasa, RDC",

        monthlyRent: tenant.rentAmount,
        depositAmount: tenant.depositAmount || (tenant.rentAmount * (tenant.depositMonths || 3)),
        depositMonths: tenant.depositMonths || 3,
        paymentPeriodicity: tenant.periodicity || "Mensuel",
        paymentDueDay: tenant.paymentDueDay || 5,

        leaseType: tenant.leaseType || "Habitation",
        startDate: tenant.leaseStartDate || new Date().toLocaleDateString("fr-FR"),
        endDate: tenant.leaseEndDate || undefined,
      }, { autoDownload: false });

      // Envoi du document officiel par email
      const res = await fetch("/api/immo/send-lease", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantEmail: tenant.email,
          tenantName: tenant.name,
          agencyName: agency.name,
          agencyPhone: agency.phone,
          agencyEmail: agency.email,
          propertyName: tenant.propertyName,
          unitName: tenant.unitName,
          propertyAddress: tenant.propertyAddress || prop?.location || "Kinshasa, RDC",
          rentAmount: tenant.rentAmount,
          currency: "USD",
          startDate: tenant.leaseStartDate || new Date().toLocaleDateString("fr-FR"),
          pdfBase64: leaseResult.base64,
          fileName: leaseResult.fileName,
        }),
      });

      const data = await res.json();
      if (data.success) {
        alert(`✅ Contrat de bail officiel PDF envoyé avec succès à ${tenant.email} au nom de ${agency.name} !`);
      } else {
        alert(`❌ Erreur lors de l'envoi de l'email : ${data.error || "Une erreur est survenue"}`);
      }
    } catch (err: any) {
      console.error("Erreur envoi email bail:", err);
      alert(`Erreur: ${err.message || "Impossible d'envoyer l'email"}`);
    } finally {
      setSendingEmailTenantId(null);
    }
  };

  // ── RELANCES ───────────────────────────────────────
  const handleSendReminder = async (tenant: Tenant) => {
    const agencyName = getAgencyName();
    const days = tenant.nextPayment
      ? Math.ceil((new Date().getTime() - new Date(tenant.nextPayment).getTime()) / (1000 * 60 * 60 * 24))
      : 0;
    const dayLabel = days > 0 ? `${days} jour(s) de retard` : "retard de paiement";

    const message = [
      `Bonjour ${tenant.name},`,
      ``,
      `🔔 *RELANCE DE LOYER — ${agencyName}*`,
      ``,
      `Nous vous informons que votre loyer pour le bien : *${tenant.propertyName}${tenant.unitName ? ` (${tenant.unitName})` : ""}* est en attente de règlement.`,
      ``,
      `• Montant dû : *${tenant.rentAmount.toLocaleString("fr-FR")} $*`,
      `• Échéance dépassée : ${dayLabel}`,
      ``,
      `Merci de régulariser votre situation dans les plus brefs délais afin d’éviter des pénalités.`,
      ``,
      `Cordialement,`,
      `${agencyName}`
    ].join("\n");

    // Tracer la relance dans Firestore
    try {
      await addDoc(collection(db, "relances"), {
        supplierId: activeSupplierId,
        tenantId: tenant.id,
        tenantName: tenant.name,
        tenantPhone: tenant.phone || "",
        propertyName: tenant.propertyName,
        amountDue: tenant.rentAmount,
        channel: "WhatsApp",
        sentAt: serverTimestamp(),
      });
    } catch (err) {
      console.warn("Relance non enregistrée (non bloquant) :", err);
    }

    // Ouvrir WhatsApp
    const phone = (tenant.phone || "").replace(/[^0-9]/g, "");
    const waUrl = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(waUrl, "_blank");
  };

  const handleBulkReminder = () => {
    const overdue = tenants.filter(t => t.status === "En retard");
    if (overdue.length === 0) return;
    overdue.forEach(t => handleSendReminder(t));
  };

  const fetchData = async () => {
    if (!user) return;
    setIsLoading(true);
    try {

      // Fetch Properties
      const propsQuery = query(collection(db, "properties"), where("supplierId", "==", activeSupplierId));
      const propsSnap = await getDocs(propsQuery);
      const propsData = propsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Property[];
      setProperties(propsData);

      // Fetch Tenants
      const tenantsQuery = query(collection(db, "tenants"), where("supplierId", "==", activeSupplierId));
      const tenantsSnap = await getDocs(tenantsQuery);
      const tenantsData = tenantsSnap.docs.map(d => {
        const data = d.data();
        let calculatedStatus = data.status || "À jour";
        
        if (data.status !== "PARTI" && data.nextPayment) {
          const paymentDate = new Date(data.nextPayment);
          const today = new Date();
          paymentDate.setHours(0, 0, 0, 0);
          today.setHours(0, 0, 0, 0);

          if (paymentDate < today) {
            calculatedStatus = "En retard";
          } else {
            calculatedStatus = "À jour";
          }
        }
        
        return { id: d.id, ...data, status: calculatedStatus };
      }) as Tenant[];
      setTenants(tenantsData);

    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  // When a property is selected, auto-fill the rent amount
  useEffect(() => {
    if (selectedPropertyId) {
      const prop = properties.find(p => p.id === selectedPropertyId);
      if (prop) {
        setRentAmount(prop.price || "");
      }
      setSelectedLevelId("");
      setSelectedUnitId("");
    }
  }, [selectedPropertyId, properties]);

  const selectedProperty = properties.find(p => p.id === selectedPropertyId);
  const levels = selectedProperty?.immoDetails?.levels || [];
  const selectedLevel = levels.find((l: any) => l.id === selectedLevelId);
  const units = selectedLevel?.units || [];

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPropertyId) return alert("Veuillez sélectionner une propriété");
    if (!rentAmount) return alert("Veuillez définir un loyer");
    
    setIsSubmitting(true);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Non connecté");

      let unitName = "";
      if (selectedLevel && selectedUnitId) {
         const unit = units.find((u: any) => u.id === selectedUnitId);
         if (unit) unitName = `${selectedLevel.name} - ${unit.name}`;
      }

      const calculatedDeposit = Number(depositAmount || (Number(rentAmount) * (depositMonths || 3)));

      const newTenant = {
        supplierId: activeSupplierId,
        name,
        phone,
        email,
        tenantIdCard: tenantIdCard || "",
        propertyId: selectedPropertyId,
        propertyName: selectedProperty?.title?.fr || "Propriété",
        propertyAddress: selectedProperty?.location || "Kinshasa, RDC",
        unitName,
        levelId: selectedLevelId,
        unitId: selectedUnitId,
        rentAmount: Number(rentAmount),
        depositAmount: calculatedDeposit,
        depositMonths: Number(depositMonths || 3),
        depositStatus: "CONSERVED",
        leaseType: leaseType || "Habitation",
        leaseStartDate: leaseStartDate || new Date().toISOString().split("T")[0],
        leaseEndDate: leaseEndDate || "",
        paymentDueDay: Number(paymentDueDay || 5),
        nextPayment,
        periodicity,
        status: "À jour",
        createdAt: new Date().toISOString(),
      };

      await addDoc(collection(db, "tenants"), newTenant);

      // --- LOGIC TO UPDATE PROPERTY/UNIT STATUS ---
      const propRef = doc(db, "properties", selectedPropertyId);
      if (levels.length === 0) {
        // Simple property without sub-units
        await updateDoc(propRef, { status: "Loué" });
      } else {
        // It has sub-units. Decrease capacity of the selected unit.
        const propDoc = await getDoc(propRef);
        if (propDoc.exists()) {
           const data = propDoc.data();
           const currentLevels = data.immoDetails?.levels || [];
           let allUnitsTaken = true;

           const updatedLevels = currentLevels.map((l: any) => {
              if (l.id === selectedLevelId) {
                 l.units = l.units.map((u: any) => {
                    if (u.id === selectedUnitId) {
                       u.capacity = Math.max(0, (u.capacity || 1) - 1);
                    }
                    if ((u.capacity || 1) > 0) allUnitsTaken = false;
                    return u;
                 });
              } else {
                 l.units.forEach((u: any) => {
                    if ((u.capacity || 1) > 0) allUnitsTaken = false;
                 });
              }
              return l;
           });

           await updateDoc(propRef, {
             "immoDetails.levels": updatedLevels,
             status: allUnitsTaken ? "Loué" : "Disponible" // Hide only if ALL units are taken
           });
        }
      }

      // --- GÉNÉRATION AUTOMATIQUE DU CONTRAT DE BAIL OFFICIEL AU NOM DE L'AGENCE (MUTAMULIS) ---
      const agency = getAgencyDetails();
      let leaseResult: { base64: string; fileName: string } | null = null;
      try {
        leaseResult = await generateFormalLeasePDF({
          agencyName: agency.name,
          agencyPhone: agency.phone,
          agencyEmail: agency.email,
          agencyAddress: agency.address,
          agencyRccm: agency.rccm,
          agencyNif: agency.nif,
          agencyIdNat: agency.idNat,
          ownerName: selectedProperty?.ownerName || undefined,

          tenantName: name,
          tenantPhone: phone,
          tenantEmail: email,
          tenantIdCard: tenantIdCard || "",

          propertyName: selectedProperty?.title?.fr || "Propriété",
          unitName: unitName,
          propertyAddress: selectedProperty?.location || "Kinshasa, RDC",

          monthlyRent: Number(rentAmount),
          depositAmount: calculatedDeposit,
          depositMonths: Number(depositMonths || 3),
          paymentPeriodicity: periodicity || "Mensuel",
          paymentDueDay: Number(paymentDueDay || 5),

          leaseType: leaseType || "Habitation",
          startDate: leaseStartDate || new Date().toLocaleDateString("fr-FR"),
          endDate: leaseEndDate || undefined,
        }, { autoDownload: true });
      } catch (pdfErr) {
        console.warn("Erreur génération PDF bail à la création :", pdfErr);
      }

      // --- ENVOI DIRECT DU CONTRAT PDF PAR EMAIL AU LOCATAIRE ---
      let emailSuccess = false;
      if (email && leaseResult?.base64) {
        try {
          const emailRes = await fetch("/api/immo/send-lease", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              tenantEmail: email,
              tenantName: name,
              agencyName: agency.name,
              agencyPhone: agency.phone,
              agencyEmail: agency.email,
              propertyName: selectedProperty?.title?.fr || "Propriété",
              unitName: unitName,
              propertyAddress: selectedProperty?.location || "Kinshasa, RDC",
              rentAmount: Number(rentAmount),
              currency: "USD",
              startDate: leaseStartDate || new Date().toLocaleDateString("fr-FR"),
              pdfBase64: leaseResult.base64,
              fileName: leaseResult.fileName,
            }),
          });
          const emailData = await emailRes.json();
          emailSuccess = !!emailData.success;
        } catch (emailErr) {
          console.warn("Erreur envoi email locataire :", emailErr);
        }
      }

      // --- NOTIFICATION SMS AU LOCATAIRE (SENDER ID DE L'AGENCE : MUTAMULIS) ---
      if (phone) {
        try {
          const cleanPhone = phone.replace(/[^0-9]/g, "");
          const smsText = `Bonjour ${name}, votre contrat de bail avec ${agency.name} pour ${selectedProperty?.title?.fr || "votre logement"} a bien été enregistré.${email && emailSuccess ? " Le contrat PDF officiel vous a été envoyé par email." : ""} Bienvenue !`;
          await fetch("/api/sms", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              phone: cleanPhone,
              to: cleanPhone,
              message: smsText,
              customSenderId: agency.name.replace(/[^a-zA-Z0-9]/g, "").slice(0, 11) || "MUTAMULIS",
              supplierId: activeSupplierId,
            }),
          });
        } catch (smsErr) {
          console.warn("SMS locataire non envoyé :", smsErr);
        }
      }

      const alertMessage = [
        `✅ Locataire ${name} enregistré avec succès !`,
        `• Contrat officiel généré et téléchargé au nom de "${agency.name}"`,
        email 
          ? (emailSuccess ? `• 📩 Contrat PDF officiel envoyé directement par email à ${email}` : `• ⚠️ Email en attente d'envoi vers ${email}`)
          : `• ℹ️ Aucun email renseigné pour l'envoi du contrat`,
        phone ? `• 📱 Notification SMS envoyée au ${phone}` : null
      ].filter(Boolean).join("\n");

      alert(alertMessage);
      setIsModalOpen(false);
      setName("");
      setPhone("");
      setEmail("");
      setTenantIdCard("");
      setSelectedPropertyId("");
      setSelectedLevelId("");
      setSelectedUnitId("");
      setRentAmount("");
      setDepositAmount("");
      setNextPayment("");
      setPeriodicity("Mensuel");
      fetchData();
    } catch (err) {
      console.error(err);
      alert("Erreur lors de l'ajout du locataire");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadLease = async (tenant: Tenant) => {
    const prop = properties.find(p => p.id === tenant.propertyId);
    const agency = getAgencyDetails();
    try {
      await generateFormalLeasePDF({
        agencyName: agency.name,
        agencyPhone: agency.phone,
        agencyEmail: agency.email,
        agencyAddress: agency.address,
        agencyRccm: agency.rccm,
        agencyNif: agency.nif,
        agencyIdNat: agency.idNat,
        ownerName: prop?.ownerName || undefined,

        tenantName: tenant.name,
        tenantPhone: tenant.phone,
        tenantEmail: tenant.email,
        tenantIdCard: tenant.tenantIdCard,

        propertyName: tenant.propertyName,
        unitName: tenant.unitName,
        propertyAddress: tenant.propertyAddress || prop?.location || "Kinshasa, RDC",

        monthlyRent: tenant.rentAmount,
        depositAmount: tenant.depositAmount || (tenant.rentAmount * (tenant.depositMonths || 3)),
        depositMonths: tenant.depositMonths || 3,
        paymentPeriodicity: tenant.periodicity || "Mensuel",
        paymentDueDay: tenant.paymentDueDay || 5,

        leaseType: tenant.leaseType || "Habitation",
        startDate: tenant.leaseStartDate || new Date().toLocaleDateString("fr-FR"),
        endDate: tenant.leaseEndDate || undefined,
      });
    } catch (error) {
      console.error("Erreur génération bail:", error);
      alert("Erreur lors de la génération du contrat de bail.");
    }
  };

  const handleDownloadInspection = async (tenant: Tenant, type: "ENTRÉE" | "SORTIE") => {
    const agency = getAgencyDetails();
    try {
      await generateInspectionChecklistPDF({
        inspectionType: type,
        agencyName: agency.name,
        tenantName: tenant.name,
        propertyName: tenant.propertyName,
        unitName: tenant.unitName,
        inspectionDate: new Date().toLocaleDateString("fr-FR")
      });
    } catch (error) {
      console.error("Erreur génération état des lieux:", error);
      alert("Erreur lors de la génération de la fiche d'état des lieux.");
    }
  };

  const handleCreateMaintenanceTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!maintenanceTenant || !maintenanceTitle) return;
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "maintenance_tickets"), {
        supplierId: activeSupplierId,
        tenantId: maintenanceTenant.id,
        tenantName: maintenanceTenant.name,
        propertyId: maintenanceTenant.propertyId,
        propertyName: maintenanceTenant.propertyName,
        unitName: maintenanceTenant.unitName || "",
        title: maintenanceTitle,
        category: maintenanceCategory,
        cost: Number(maintenanceCost || 0),
        chargedTo: maintenanceChargedTo,
        status: "EN COURS",
        createdAt: serverTimestamp()
      });
      alert("Incident de maintenance enregistré avec succès !");
      setIsMaintenanceModalOpen(false);
      setMaintenanceTitle("");
      setMaintenanceCost("");
    } catch (err) {
      console.error(err);
      alert("Erreur lors de l'enregistrement de l'incident.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeclareDeparture = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantToDepart || !departureDate) return;
    setIsSubmitting(true);
    
    try {
      // 1. Update tenant status to PARTI
      const tenantRef = doc(db, "tenants", tenantToDepart.id);
      await updateDoc(tenantRef, {
        status: "PARTI",
        departureDate,
        debtAmount: Number(debtAmount),
        depositStatus: depositRestitutionStatus
      });
      
      // 2. Release property/unit
      const propRef = doc(db, "properties", tenantToDepart.propertyId);
      const propDoc = await getDoc(propRef);
      if (propDoc.exists()) {
        const propData = propDoc.data();
        const propLevels = propData.immoDetails?.levels || [];
        
        if (propLevels.length === 0) {
           await updateDoc(propRef, { status: "Disponible" });
        } else {
           let allUnitsTaken = true;
           const updatedLevels = propLevels.map((l: any) => {
              if (l.id === tenantToDepart.levelId) {
                 l.units = l.units.map((u: any) => {
                    if (u.id === tenantToDepart.unitId) {
                       u.capacity = (u.capacity || 0) + 1; // Release the capacity
                    }
                    if ((u.capacity || 1) > 0) allUnitsTaken = false;
                    return u;
                 });
              } else {
                 l.units.forEach((u: any) => {
                    if ((u.capacity || 1) > 0) allUnitsTaken = false;
                 });
              }
              return l;
           });
           
           await updateDoc(propRef, {
             "immoDetails.levels": updatedLevels,
             status: allUnitsTaken ? "Loué" : "Disponible"
           });
        }
      }
      
      alert("Départ du locataire enregistré. La propriété a été libérée.");
      setIsDepartureModalOpen(false);
      setTenantToDepart(null);
      setDepartureDate("");
      setDebtAmount(0);
      fetchData();
      
    } catch (err) {
      console.error(err);
      alert("Erreur lors de la déclaration du départ.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeclarePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantToPay || !paymentAmount) return;
    setIsSubmitting(true);
    
    try {
      // 1. Ajouter le paiement
      await addDoc(collection(db, "payments"), {
        supplierId: activeSupplierId,
        tenantId: tenantToPay.id,
        tenantName: tenantToPay.name,
        propertyId: tenantToPay.propertyId,
        propertyName: tenantToPay.propertyName,
        unitId: tenantToPay.unitId || null,
        unitTitle: tenantToPay.unitName || null,
        amount: Number(paymentAmount),
        currency: "USD",
        status: "COMPLETED",
        createdAt: serverTimestamp(),
        createdBy: activeSupplierId,
        reference: paymentReference || `Loyer ${new Date().toLocaleString('fr-FR', { month: 'long', year: 'numeric' })}`
      });

      // 1b. Écriture comptable dans le grand livre
      try {
        const agency = getAgencyDetails();
        await recordRentPayment({
          supplierId: activeSupplierId!,
          supplierName: agency.name,
          tenantId: tenantToPay.id,
          tenantName: tenantToPay.name,
          propertyId: tenantToPay.propertyId,
          propertyName: tenantToPay.propertyName,
          unitName: tenantToPay.unitName || undefined,
          amount: Number(paymentAmount),
          currency: "USD",
          reference: paymentReference || undefined,
          periodicity: tenantToPay.periodicity || "Mensuel",
        });
      } catch (ledgerErr) {
        console.warn("Écriture comptable loyer non enregistrée (non bloquant) :", ledgerErr);
      }

      // 1c. Générer et télécharger la quittance de loyer PDF
      try {
        const period = new Date().toLocaleString("fr-FR", { month: "long", year: "numeric" });
        const agency = getAgencyDetails();
        await generateRentReceiptPDF({
          agencyName: agency.name,
          agencyPhone: agency.phone,
          agencyEmail: agency.email,
          agencyAddress: agency.address,
          agencyRccm: agency.rccm,
          tenantName: tenantToPay.name,
          tenantPhone: tenantToPay.phone || "",
          tenantEmail: tenantToPay.email || "",
          propertyName: tenantToPay.propertyName,
          unitName: tenantToPay.unitName || undefined,
          amount: Number(paymentAmount),
          currency: "USD",
          periodicity: tenantToPay.periodicity || "Mensuel",
          paymentReference: paymentReference || undefined,
          paymentMethod: "Caisse / Mobile Money",
          periodLabel: period,
          paymentDate: new Date().toLocaleDateString("fr-FR"),
          monthlyRent: tenantToPay.rentAmount,
          leaseStartDate: tenantToPay.leaseStartDate || undefined,
        });
      } catch (pdfErr) {
        console.warn("Génération PDF quittance non bloquante :", pdfErr);
      }

      // 2. Update tenant's nextPayment
      if (tenantToPay.nextPayment) {
        const currentDate = new Date(tenantToPay.nextPayment);
        if (tenantToPay.periodicity === "Trimestriel") currentDate.setMonth(currentDate.getMonth() + 3);
        else if (tenantToPay.periodicity === "Annuel") currentDate.setFullYear(currentDate.getFullYear() + 1);
        else if (tenantToPay.periodicity === "Hebdomadaire") currentDate.setDate(currentDate.getDate() + 7);
        else currentDate.setMonth(currentDate.getMonth() + 1); // Mensuel par défaut

        const tenantRef = doc(db, "tenants", tenantToPay.id);
        await updateDoc(tenantRef, {
          nextPayment: currentDate.toISOString().split("T")[0],
          status: "À jour"
        });
      }

      alert("Paiement enregistré avec succès !");
      setIsPaymentModalOpen(false);
      setTenantToPay(null);
      setPaymentAmount("");
      setPaymentReference("");
      fetchData();
      
    } catch (err) {
      console.error(err);
      alert("Erreur lors de l'enregistrement du paiement.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredTenants = tenants.filter(
    (t) => (t.name || "").toLowerCase().includes(search.toLowerCase()) || (t.propertyName || "").toLowerCase().includes(search.toLowerCase())
  );

  const totalDeposits = tenants
    .filter(t => t.status !== "PARTI")
    .reduce((sum, t) => sum + (t.depositAmount || (t.rentAmount * (t.depositMonths || 3))), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Mes Locataires & Baux</h1>
          <p className="text-sm text-gray-400">Gérez vos locataires, garanties locatives, contrats de bail et réparations.</p>
        </div>
        <button
          onClick={() => {
            setDepositAmount(rentAmount ? Number(rentAmount) * 3 : "");
            setIsModalOpen(true);
          }}
          className="flex items-center space-x-2 bg-primary hover:bg-primary-light text-white px-4 py-2 rounded-lg transition-colors font-medium shadow-md"
        >
          <Plus size={20} />
          <span>Nouveau Bail & Locataire</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-400">Locataires Actifs</p>
            <p className="text-2xl font-bold text-white mt-1">{tenants.filter(t => t.status !== "PARTI").length}</p>
          </div>
          <div className="p-3 bg-blue-400/10 text-blue-400 rounded-lg">
            <Users size={20} />
          </div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-400">En retard de loyer</p>
            <p className="text-2xl font-bold text-red-400 mt-1">{tenants.filter(t => t.status === "En retard").length}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="p-3 bg-red-400/10 text-red-400 rounded-lg">
              <Bell size={20} />
            </div>
            {tenants.filter(t => t.status === "En retard").length > 0 && (
              <button
                onClick={handleBulkReminder}
                title="Envoyer une relance WhatsApp à tous les locataires en retard"
                className="flex items-center gap-1 text-[11px] px-2 py-1 rounded bg-orange-500/15 hover:bg-orange-500/25 text-orange-400 border border-orange-500/30 transition-all"
              >
                <MessageSquare size={11} />
                Tout relancer
              </button>
            )}
          </div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-400">Garanties Locatives (Cautions)</p>
            <p className="text-2xl font-bold text-emerald-400 mt-1">{totalDeposits.toLocaleString()} $</p>
          </div>
          <div className="p-3 bg-emerald-400/10 text-emerald-400 rounded-lg">
            <ShieldCheck size={20} />
          </div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col justify-center">
          <p className="text-sm text-gray-400">Arriérés & Dettes</p>
          <p className="text-lg font-bold text-red-400 mt-1">
            {tenants.reduce((sum, t) => sum + (t.status === "PARTI" ? (t.debtAmount || 0) : 0), 0)} $
          </p>
        </div>
      </div>

      {/* ── TABLEAU DE TRÉSORERIE IMMO ───────────────────────── */}
      <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
        <button
          onClick={() => setIsTreasuryOpen(v => !v)}
          className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <TrendingUp size={18} className="text-emerald-400" />
            <span className="font-semibold text-white text-sm">Trésorerie Immobilière — Loyers vs Charges</span>
            {!isLoadingTreasury && treasuryRows.length > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                {treasuryRows.length} mois
              </span>
            )}
          </div>
          <ChevronDown size={16} className={`text-gray-400 transition-transform ${isTreasuryOpen ? "rotate-180" : ""}`} />
        </button>

        {isTreasuryOpen && (
          <div className="border-t border-white/10">
            {isLoadingTreasury ? (
              <div className="p-6 text-center text-gray-400 text-sm">Chargement de la trésorerie...</div>
            ) : treasuryRows.length === 0 ? (
              <div className="p-6 text-center text-gray-500 text-sm">Aucune donnée financière disponible. Enregistrez des paiements et des tickets de maintenance pour voir la trésorerie.</div>
            ) : (
              <>
                {/* Summary totals */}
                <div className="grid grid-cols-3 divide-x divide-white/10 bg-black/20">
                  <div className="p-3 text-center">
                    <p className="text-xs text-gray-400">Total Loyers (12m)</p>
                    <p className="text-lg font-bold text-emerald-400">
                      {treasuryRows.reduce((s, r) => s + r.income, 0).toLocaleString("fr-FR")} $
                    </p>
                  </div>
                  <div className="p-3 text-center">
                    <p className="text-xs text-gray-400">Total Charges (12m)</p>
                    <p className="text-lg font-bold text-red-400">
                      {treasuryRows.reduce((s, r) => s + r.charges, 0).toLocaleString("fr-FR")} $
                    </p>
                  </div>
                  <div className="p-3 text-center">
                    <p className="text-xs text-gray-400">Résultat Net (12m)</p>
                    <p className={`text-lg font-bold ${
                      treasuryRows.reduce((s, r) => s + r.net, 0) >= 0 ? "text-emerald-400" : "text-red-400"
                    }`}>
                      {treasuryRows.reduce((s, r) => s + r.net, 0).toLocaleString("fr-FR")} $
                    </p>
                  </div>
                </div>

                {/* Month-by-month table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs uppercase text-gray-400 bg-black/10">
                        <th className="px-4 py-2.5 text-left">Mois</th>
                        <th className="px-4 py-2.5 text-right">Loyers encaissés</th>
                        <th className="px-4 py-2.5 text-right">Charges maintenance</th>
                        <th className="px-4 py-2.5 text-right">Résultat net</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {treasuryRows.map((row, idx) => {
                        const isCurrentMonth = idx === 0;
                        return (
                          <tr key={row.month} className={`transition-colors hover:bg-white/5 ${
                            isCurrentMonth ? "bg-white/3" : ""
                          }`}>
                            <td className="px-4 py-3">
                              <span className={`text-sm font-medium capitalize ${
                                isCurrentMonth ? "text-white" : "text-gray-300"
                              }`}>{row.label}</span>
                              {isCurrentMonth && (
                                <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-400 font-semibold">En cours</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className="font-semibold text-emerald-400">
                                {row.income > 0 ? `+${row.income.toLocaleString("fr-FR")} $` : <span className="text-gray-500">—</span>}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className="font-semibold text-red-400">
                                {row.charges > 0 ? `-${row.charges.toLocaleString("fr-FR")} $` : <span className="text-gray-500">—</span>}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {row.net > 0 ? (
                                  <TrendingUp size={13} className="text-emerald-400" />
                                ) : row.net < 0 ? (
                                  <TrendingDown size={13} className="text-red-400" />
                                ) : null}
                                <span className={`font-bold ${
                                  row.net > 0 ? "text-emerald-400" : row.net < 0 ? "text-red-400" : "text-gray-500"
                                }`}>
                                  {row.net === 0 ? "—" : `${row.net > 0 ? "+" : ""}${row.net.toLocaleString("fr-FR")} $`}
                                </span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-white/10 flex flex-col sm:flex-row gap-4 justify-between">
          <div className="relative max-w-sm w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Rechercher par nom ou bien loué..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-black/20 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-white text-sm transition-all"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-300">
            <thead className="text-xs uppercase bg-black/20 text-gray-400">
              <tr>
                <th className="px-5 py-4">Locataire</th>
                <th className="px-5 py-4">Bien & Unité</th>
                <th className="px-5 py-4">Loyer Mensuel</th>
                <th className="px-5 py-4">Garantie (Caution)</th>
                <th className="px-5 py-4">Prochaine Échéance</th>
                <th className="px-5 py-4">Statut</th>
                <th className="px-5 py-4 text-right">Actions Juridiques & Gestion</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} className="px-6 py-8 text-center text-gray-400">Chargement des baux...</td></tr>
              ) : filteredTenants.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-8 text-center text-gray-400">Aucun locataire enregistré.</td></tr>
              ) : (
                filteredTenants.map((tenant) => (
                  <tr key={tenant.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="px-5 py-4 font-medium text-white">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary-light uppercase font-bold text-xs shrink-0">
                          {tenant.name.charAt(0)}
                        </div>
                        <div>
                          <span className="font-semibold block">{tenant.name}</span>
                          <span className="text-xs text-gray-400">{tenant.phone}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-col space-y-0.5">
                        <div className="flex items-center space-x-1.5 text-white font-medium">
                          <Home size={14} className="text-primary-light shrink-0" />
                          <span className="truncate max-w-[160px]">{tenant.propertyName}</span>
                        </div>
                        {tenant.unitName && (
                          <span className="text-xs text-gray-400 ml-5">{tenant.unitName}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="font-bold text-white">{tenant.rentAmount} $</span>
                      <span className="text-[11px] text-gray-400 block">/ {tenant.periodicity || "Mois"}</span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-col space-y-0.5">
                        <span className="font-semibold text-emerald-400">
                          {(tenant.depositAmount || (tenant.rentAmount * (tenant.depositMonths || 3))).toLocaleString()} $
                        </span>
                        <span className="text-[11px] text-gray-400">
                          {tenant.depositMonths || 3} mois ({tenant.depositStatus === "RESTITUTED" ? "Restituée" : tenant.depositStatus === "DEDUCTED" ? "Déduite" : "Conservée"})
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-white text-xs">{tenant.nextPayment ? new Date(tenant.nextPayment).toLocaleDateString("fr-FR") : "Non définie"}</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                        tenant.status === "À jour" 
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                          : tenant.status === "PARTI" 
                          ? "bg-gray-500/10 text-gray-400 border border-gray-500/20" 
                          : "bg-red-500/10 text-red-400 border border-red-500/20"
                      }`}>
                        {tenant.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5 flex-wrap">
                        {/* Bouton Bail PDF */}
                        <button
                          onClick={() => handleDownloadLease(tenant)}
                          title="Télécharger le Contrat de Bail officiel (PDF)"
                          className="px-2 py-1 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded text-xs flex items-center gap-1 transition-all"
                        >
                          <FileText size={13} />
                          <span>Bail</span>
                        </button>

                        {/* Bouton Envoi Bail par Email */}
                        {tenant.email && (
                          <button
                            onClick={() => handleSendLeaseByEmail(tenant)}
                            disabled={sendingEmailTenantId === tenant.id}
                            title={`Envoyer le contrat de bail par email à ${tenant.email}`}
                            className="px-2 py-1 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded text-xs flex items-center gap-1 transition-all disabled:opacity-50"
                          >
                            <Mail size={13} className={sendingEmailTenantId === tenant.id ? "animate-spin" : ""} />
                            <span>{sendingEmailTenantId === tenant.id ? "Envoi..." : "Email"}</span>
                          </button>
                        )}

                        {/* Bouton État des Lieux */}
                        <button
                          onClick={() => handleDownloadInspection(tenant, tenant.status === "PARTI" ? "SORTIE" : "ENTRÉE")}
                          title="Fiche d'État des Lieux (Entrée/Sortie)"
                          className="px-2 py-1 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded text-xs flex items-center gap-1 transition-all"
                        >
                          <ClipboardCheck size={13} />
                          <span>État lieux</span>
                        </button>

                        {/* Bouton Maintenance / Incidents */}
                        <button
                          onClick={() => {
                            setMaintenanceTenant(tenant);
                            setIsMaintenanceModalOpen(true);
                          }}
                          title="Signaler une panne ou des réparations"
                          className="px-2 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded text-xs flex items-center gap-1 transition-all"
                        >
                          <Wrench size={13} />
                          <span>Réparation</span>
                        </button>

                        {/* Bouton Historique Paiements */}
                        <button
                          onClick={() => loadTenantPayments(tenant)}
                          title="Historique des paiements de loyer"
                          className="px-2 py-1 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded text-xs flex items-center gap-1 transition-all"
                        >
                          <History size={13} />
                          <span>Historique</span>
                        </button>

                        {/* Bouton Relance WhatsApp (uniquement si en retard) */}
                        {tenant.status === "En retard" && (
                          <button
                            onClick={() => handleSendReminder(tenant)}
                            title="Envoyer une relance de loyer par WhatsApp"
                            className="px-2 py-1 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/30 rounded text-xs flex items-center gap-1 transition-all animate-pulse hover:animate-none"
                          >
                            <MessageSquare size={13} />
                            <span>Relancer</span>
                          </button>
                        )}

                        {tenant.status !== "PARTI" ? (
                          <>
                            <button 
                              onClick={() => {
                                setTenantToPay(tenant);
                                setPaymentAmount(tenant.rentAmount);
                                setIsPaymentModalOpen(true);
                              }}
                              className="text-emerald-400 hover:text-emerald-300 transition-colors flex items-center text-xs bg-emerald-400/10 hover:bg-emerald-400/20 px-2 py-1 rounded border border-emerald-500/30"
                            >
                              <DollarSign size={13} className="mr-0.5" />
                              <span>Paiement</span>
                            </button>
                            <button 
                              onClick={() => {
                                setTenantToDepart(tenant);
                                setIsDepartureModalOpen(true);
                              }}
                              className="text-red-400 hover:text-red-300 transition-colors flex items-center text-xs bg-red-400/10 hover:bg-red-400/20 px-2 py-1 rounded border border-red-500/30"
                            >
                              <span>Départ</span>
                            </button>
                          </>
                        ) : (
                          <span className="text-xs text-gray-500">Dette: {tenant.debtAmount || 0} $</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE TENANT / BAIL MODAL */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-xl bg-[#140b2e] border border-white/10 rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between p-6 border-b border-white/10 sticky top-0 bg-[#140b2e] z-10">
                <div>
                  <h2 className="text-xl font-bold text-white">Nouveau Bail & Locataire</h2>
                  <p className="text-xs text-gray-400">Établissez le contrat, la garantie locative et les détails d'occupation.</p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white">
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleCreateTenant} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-300 uppercase">Type de Bail</label>
                    <select value={leaseType} onChange={(e: any) => setLeaseType(e.target.value)} className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-white text-sm [&>option]:bg-[#140b2e]">
                      <option value="Habitation">Bail d'Habitation (Résidentiel)</option>
                      <option value="Commercial">Bail Commercial / Bureaux</option>
                      <option value="Mixte">Usage Mixte</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-300 uppercase">Nom complet du locataire *</label>
                    <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-white text-sm" placeholder="ex: Jean Dupont" />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-300 uppercase">Téléphone (SMS) *</label>
                    <input type="text" required value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-white text-sm" placeholder="+243..." />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-300 uppercase">Email</label>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-white text-sm" placeholder="client@domaine.com" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-300 uppercase">N° Pièce d'identité</label>
                    <input type="text" value={tenantIdCard} onChange={(e) => setTenantIdCard(e.target.value)} className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-white text-sm" placeholder="Passeport / C. Electeur" />
                  </div>
                </div>

                {/* Propriété & Sous-unité */}
                <div className="space-y-1 pt-1">
                  <label className="text-xs font-semibold text-gray-300 uppercase">Propriété louée *</label>
                  <select required value={selectedPropertyId} onChange={(e) => setSelectedPropertyId(e.target.value)} className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-white text-sm [&>option]:bg-[#140b2e]">
                    <option value="">Sélectionner une propriété...</option>
                    {properties.map(p => (
                      <option key={p.id} value={p.id}>{p.title?.fr || "Propriété sans titre"} — {p.price} $/mois</option>
                    ))}
                  </select>
                </div>

                {levels.length > 0 && (
                  <div className="grid grid-cols-2 gap-4 border-l-2 border-primary/50 pl-4 py-2 bg-white/5 rounded-r-lg">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-300">Niveau / Étage</label>
                      <select required value={selectedLevelId} onChange={(e) => setSelectedLevelId(e.target.value)} className="w-full px-3 py-1.5 bg-black/30 border border-white/10 rounded-lg text-white text-sm [&>option]:bg-[#140b2e]">
                        <option value="">Sélectionner...</option>
                        {levels.map((l: any) => (
                          <option key={l.id} value={l.id}>{l.name}</option>
                        ))}
                      </select>
                    </div>
                    {selectedLevelId && (
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-300">Sous-unité (Porte)</label>
                        <select required value={selectedUnitId} onChange={(e) => setSelectedUnitId(e.target.value)} className="w-full px-3 py-1.5 bg-black/30 border border-white/10 rounded-lg text-white text-sm [&>option]:bg-[#140b2e]">
                          <option value="">Sélectionner...</option>
                          {units.filter((u: any) => (u.capacity || 1) > 0).map((u: any) => (
                            <option key={u.id} value={u.id}>{u.name} ({u.type})</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                )}

                {/* Conditions Financières & Garantie */}
                <div className="border-t border-white/10 pt-3">
                  <span className="text-xs font-bold text-primary-light uppercase tracking-wider block mb-3">
                    Conditions Financières & Garantie Locative
                  </span>
                  
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-300">Loyer convenu ($) *</label>
                      <input 
                        type="number" 
                        required 
                        value={rentAmount} 
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setRentAmount(val);
                          setDepositAmount(val * (depositMonths || 3));
                        }} 
                        className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-white text-sm font-bold" 
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-300">Mois de caution</label>
                      <input 
                        type="number" 
                        min="1" 
                        max="12" 
                        value={depositMonths} 
                        onChange={(e) => {
                          const m = Number(e.target.value);
                          setDepositMonths(m);
                          if (rentAmount) setDepositAmount(Number(rentAmount) * m);
                        }} 
                        className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-white text-sm" 
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-300">Caution Totale ($)</label>
                      <input 
                        type="number" 
                        value={depositAmount} 
                        onChange={(e) => setDepositAmount(Number(e.target.value))} 
                        className="w-full px-3 py-2 bg-black/30 border border-emerald-500/30 rounded-lg text-emerald-400 font-bold text-sm" 
                        placeholder="Calculé auto" 
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 mt-3">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-300">Périodicité</label>
                      <select required value={periodicity} onChange={(e) => setPeriodicity(e.target.value)} className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-white text-sm [&>option]:bg-[#140b2e]">
                        <option value="Mensuel">Mensuel</option>
                        <option value="Trimestriel">Trimestriel</option>
                        <option value="Annuel">Annuel</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-300">Date d'effet (Début)</label>
                      <input type="date" value={leaseStartDate} onChange={(e) => setLeaseStartDate(e.target.value)} className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-white text-xs [color-scheme:dark]" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-300">Prochaine échéance *</label>
                      <input type="date" required value={nextPayment} onChange={(e) => setNextPayment(e.target.value)} className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-white text-xs [color-scheme:dark]" />
                    </div>
                  </div>
                </div>

                <div className="pt-4 flex justify-end space-x-3 border-t border-white/10">
                  <button type="button" onClick={() => setIsModalOpen(false)} disabled={isSubmitting} className="px-4 py-2 text-gray-400 hover:text-white text-sm">
                    Annuler
                  </button>
                  <button type="submit" disabled={isSubmitting} className="px-6 py-2 bg-primary hover:bg-primary-light text-white font-semibold rounded-lg text-sm flex items-center gap-2">
                    {isSubmitting ? "Création en cours..." : "Enregistrer le Bail & Locataire"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MAINTENANCE / INCIDENTS MODAL */}
      <AnimatePresence>
        {isMaintenanceModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-[#140b2e] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between p-6 border-b border-white/10 bg-[#140b2e]">
                <div className="flex items-center gap-2">
                  <Wrench className="text-amber-400" size={20} />
                  <h2 className="text-lg font-bold text-white">Signaler un Incident / Réparation</h2>
                </div>
                <button onClick={() => setIsMaintenanceModalOpen(false)} className="text-gray-400 hover:text-white">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleCreateMaintenanceTicket} className="p-6 space-y-4">
                <p className="text-xs text-gray-300">
                  Pour <strong className="text-white">{maintenanceTenant?.name}</strong> dans le bien <strong className="text-white">{maintenanceTenant?.propertyName}</strong>.
                </p>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-300 uppercase">Catégorie</label>
                  <select value={maintenanceCategory} onChange={(e) => setMaintenanceCategory(e.target.value)} className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-white text-sm [&>option]:bg-[#140b2e]">
                    <option value="Plomberie">Plomberie & Fuites d'eau</option>
                    <option value="Électricité">Électricité & SNEL / Disjoncteur</option>
                    <option value="Climatisation">Climatisation & Froid</option>
                    <option value="Toiture">Toiture & Infiltration</option>
                    <option value="Serrurerie">Serrurerie & Portes</option>
                    <option value="Autre">Autre réparation</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-300 uppercase">Description de la panne</label>
                  <input type="text" required value={maintenanceTitle} onChange={(e) => setMaintenanceTitle(e.target.value)} className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-white text-sm" placeholder="ex: Remplacement robinet cuisine" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-300 uppercase">Coût estimé ($)</label>
                    <input type="number" min="0" value={maintenanceCost} onChange={(e) => setMaintenanceCost(e.target.value === "" ? "" : Number(e.target.value))} className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-white text-sm" placeholder="0" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-300 uppercase">Imputation (Qui paie ?)</label>
                    <select value={maintenanceChargedTo} onChange={(e: any) => setMaintenanceChargedTo(e.target.value)} className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-white text-sm [&>option]:bg-[#140b2e]">
                      <option value="BAILLEUR">À la charge du Bailleur</option>
                      <option value="LOCATAIRE">À la charge du Locataire</option>
                    </select>
                  </div>
                </div>

                <div className="pt-4 flex justify-end space-x-3 border-t border-white/10">
                  <button type="button" onClick={() => setIsMaintenanceModalOpen(false)} className="px-4 py-2 text-gray-400 hover:text-white text-sm">
                    Annuler
                  </button>
                  <button type="submit" disabled={isSubmitting} className="px-6 py-2 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-lg text-sm">
                    {isSubmitting ? "Enregistrement..." : "Valider le ticket"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DECLARE DEPARTURE MODAL */}
      <AnimatePresence>
        {isDepartureModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm bg-[#140b2e] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between p-6 border-b border-white/10 bg-[#140b2e]">
                <h2 className="text-lg font-semibold text-white">Déclarer un départ & Clôture du Bail</h2>
                <button onClick={() => setIsDepartureModalOpen(false)} className="text-gray-400 hover:text-white">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleDeclareDeparture} className="p-6 space-y-4">
                <p className="text-xs text-gray-300 mb-2">
                  Départ de <strong className="text-white">{tenantToDepart?.name}</strong> de <strong className="text-white">{tenantToDepart?.propertyName}</strong>.
                </p>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-300 uppercase">Date de libération des lieux</label>
                  <input type="date" required value={departureDate} onChange={(e) => setDepartureDate(e.target.value)} className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-white text-xs [color-scheme:dark]" />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-300 uppercase">Sort de la Garantie Locative (Caution)</label>
                  <select value={depositRestitutionStatus} onChange={(e: any) => setDepositRestitutionStatus(e.target.value)} className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-white text-xs [&>option]:bg-[#140b2e]">
                    <option value="RESTITUTED">Restituée intégralement au locataire</option>
                    <option value="DEDUCTED">Retenue (déduite pour impayés ou réparations)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-300 uppercase">Dette restante nette ($)</label>
                  <input type="number" required min="0" value={debtAmount} onChange={(e) => setDebtAmount(e.target.value === "" ? "" : Number(e.target.value))} className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-white text-sm" placeholder="0 si soldé" />
                </div>

                <div className="pt-4 flex justify-end space-x-3 border-t border-white/10">
                  <button type="button" onClick={() => setIsDepartureModalOpen(false)} className="px-4 py-2 text-gray-400 hover:text-white text-sm">
                    Annuler
                  </button>
                  <button type="submit" disabled={isSubmitting} className="px-5 py-2 bg-red-500 hover:bg-red-400 text-white font-semibold rounded-lg text-sm">
                    {isSubmitting ? "Traitement..." : "Clôturer le bail"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DECLARE PAYMENT MODAL */}
      <AnimatePresence>
        {isPaymentModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm bg-[#140b2e] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between p-6 border-b border-white/10 bg-[#140b2e]">
                <h2 className="text-lg font-semibold text-white">Enregistrer un paiement de loyer</h2>
                <button onClick={() => setIsPaymentModalOpen(false)} className="text-gray-400 hover:text-white">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleDeclarePayment} className="p-6 space-y-4">
                <p className="text-xs text-gray-300 mb-2">
                  Paiement de <strong className="text-white">{tenantToPay?.name}</strong> pour <strong className="text-white">{tenantToPay?.propertyName}</strong>.
                </p>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-300 uppercase">Montant perçu (USD) *</label>
                  <input type="number" required min="1" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value === "" ? "" : Number(e.target.value))} className="w-full px-3 py-2 bg-black/30 border border-emerald-500/30 rounded-lg text-emerald-400 font-bold text-base" />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-300 uppercase">Référence ou Mois réglé</label>
                  <input type="text" value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-white text-sm" placeholder="ex: Loyer Mars 2024" />
                </div>

                <div className="pt-4 flex justify-end space-x-3 border-t border-white/10">
                  <button type="button" onClick={() => setIsPaymentModalOpen(false)} className="px-4 py-2 text-gray-400 hover:text-white text-sm">
                    Annuler
                  </button>
                  <button type="submit" disabled={isSubmitting} className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-white font-bold rounded-lg text-sm">
                    {isSubmitting ? "Traitement..." : "Valider l'encaissement"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* PAYMENT HISTORY MODAL */}
      <AnimatePresence>
        {isHistoryModalOpen && historyTenant && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg bg-[#140b2e] border border-white/10 rounded-2xl shadow-2xl overflow-hidden max-h-[88vh] flex flex-col"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-5 border-b border-white/10 bg-black/30 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-500/15 rounded-lg">
                    <History size={18} className="text-indigo-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Historique des Paiements</h3>
                    <p className="text-xs text-gray-400">{historyTenant.name} — {historyTenant.propertyName}{historyTenant.unitName ? ` (${historyTenant.unitName})` : ""}</p>
                  </div>
                </div>
                <button onClick={() => setIsHistoryModalOpen(false)} className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/10">
                  <X size={18} />
                </button>
              </div>

              {/* Stats bar */}
              <div className="grid grid-cols-3 divide-x divide-white/10 bg-white/3 border-b border-white/10 shrink-0">
                <div className="p-3 text-center">
                  <p className="text-xs text-gray-400">Paiements</p>
                  <p className="text-lg font-bold text-white">{tenantPayments.length}</p>
                </div>
                <div className="p-3 text-center">
                  <p className="text-xs text-gray-400">Total encaissé</p>
                  <p className="text-lg font-bold text-emerald-400">
                    {tenantPayments.reduce((s, p) => s + (p.amount || 0), 0).toLocaleString()} $
                  </p>
                </div>
                <div className="p-3 text-center">
                  <p className="text-xs text-gray-400">Loyer mensuel</p>
                  <p className="text-lg font-bold text-indigo-400">{historyTenant.rentAmount} $</p>
                </div>
              </div>

              {/* Timeline */}
              <div className="flex-1 overflow-y-auto p-4">
                {isLoadingHistory ? (
                  <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
                    Chargement de l&apos;historique...
                  </div>
                ) : tenantPayments.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-40 text-gray-500">
                    <DollarSign size={32} className="mb-2 opacity-30" />
                    <p className="text-sm">Aucun paiement enregistré pour ce locataire.</p>
                    <p className="text-xs mt-1 text-gray-600">Les paiements futurs apparaîtront ici.</p>
                  </div>
                ) : (
                  <div className="relative">
                    {/* Ligne verticale timeline */}
                    <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-white/10" />

                    <div className="space-y-3 pl-10">
                      {tenantPayments.map((pmt, idx) => {
                        const date = pmt.createdAt?.toDate?.()
                          ? pmt.createdAt.toDate().toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })
                          : "—";
                        const isFirst = idx === 0;
                        return (
                          <div key={pmt.id} className="relative">
                            {/* Dot timeline */}
                            <div className={`absolute -left-[26px] top-3 w-3 h-3 rounded-full border-2 ${isFirst ? "bg-emerald-400 border-emerald-400" : "bg-white/20 border-white/30"}`} />

                            <div className={`rounded-xl p-3.5 border ${isFirst ? "bg-emerald-500/5 border-emerald-500/20" : "bg-white/3 border-white/8"}`}>
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs text-gray-400">{date}</p>
                                  <p className="text-sm font-medium text-white truncate mt-0.5">
                                    {(pmt as any).reference || `Loyer — ${date}`}
                                  </p>
                                </div>
                                <span className={`text-sm font-bold shrink-0 ${isFirst ? "text-emerald-400" : "text-white"}`}>
                                  +{Number(pmt.amount).toLocaleString("fr-FR")} $
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-white/10 bg-black/20 shrink-0 flex justify-end">
                <button
                  onClick={() => setIsHistoryModalOpen(false)}
                  className="px-4 py-2 text-sm text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                >
                  Fermer
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
