"use client";

import { useState, useEffect } from "react";
import { 
  Plus, X, FileText, Download, Trash2, Calendar, User, Search, 
  Hotel, Home, Sparkles, Shirt, Wifi, UtensilsCrossed, CheckCircle2,
  Receipt, ArrowUpRight, ShieldCheck
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { db } from "@/lib/firebase";
import { collection, query, where, addDoc, serverTimestamp, deleteDoc, doc, onSnapshot, orderBy, limit } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import { useCurrency } from "@/context/CurrencyContext";
import { generateFormalInvoicePDF, InvoiceData } from "@/lib/invoiceGenerator";
import { getSupplierType } from "@/lib/permissions";

export default function InvoiceManager() {
  const { user, userData } = useAuth();
  const activeSupplierId = userData?.parentSupplierId || user?.uid;
  const { formatPrice, currency } = useCurrency();

  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  // Supplier natural rayon
  const defaultSupplierRayon = getSupplierType(userData) || "mode";

  // Branch & Filter State
  const [selectedRayon, setSelectedRayon] = useState<"mode" | "connect" | "immo" | "saveurs">(
    (defaultSupplierRayon === "immo" || defaultSupplierRayon === "connect" || defaultSupplierRayon === "saveurs")
      ? defaultSupplierRayon
      : "mode"
  );
  const [immoBranch, setImmoBranch] = useState<"habitation" | "hotel" | "generic">("habitation");
  const [selectedRayonFilter, setSelectedRayonFilter] = useState<string>("all");

  // Form State
  const [invoiceType, setInvoiceType] = useState<"PROFORMA" | "INVOICE">("PROFORMA");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Virement / Mobile Money (Makuta)");
  const [items, setItems] = useState<any[]>([{ description: "", quantity: 1, unitPrice: 0 }]);
  const [taxRate, setTaxRate] = useState(0);
  const [notes, setNotes] = useState("");

  // Helpers per Rayon
  // 1. Hotel Stay Helper State
  const [hotelRoom, setHotelRoom] = useState("");
  const [hotelCheckIn, setHotelCheckIn] = useState("");
  const [hotelCheckOut, setHotelCheckOut] = useState("");
  const [hotelNightlyRate, setHotelNightlyRate] = useState("");
  const [hotelNights, setHotelNights] = useState(1);

  // 2. Habitation Helper State
  const [habitationProperty, setHabitationProperty] = useState("");
  const [habitationPeriod, setHabitationPeriod] = useState("");
  const [habitationMonthlyRent, setHabitationMonthlyRent] = useState("");

  // 3. Mode Helper State
  const [modeItemName, setModeItemName] = useState("");
  const [modeSize, setModeSize] = useState("");
  const [modePrice, setModePrice] = useState("");

  // 4. Connect Helper State
  const [connectEquipment, setConnectEquipment] = useState("");
  const [connectSerial, setConnectSerial] = useState("");
  const [connectPrice, setConnectPrice] = useState("");

  // 5. Saveurs Helper State
  const [saveursDishOrTool, setSaveursDishOrTool] = useState("");
  const [saveursGuests, setSaveursGuests] = useState(1);
  const [saveursUnitPrice, setSaveursUnitPrice] = useState("");

  useEffect(() => {
    if (!user || !activeSupplierId) return;

    const q = query(
      collection(db, "invoices"),
      where("supplierId", "==", activeSupplierId),
      orderBy("createdAt", "desc"),
      limit(50)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const data: any[] = [];
      snapshot.forEach(docSnap => data.push({ id: docSnap.id, ...docSnap.data() }));
      setInvoices(data);
      setLoading(false);
    }, (err) => {
      console.warn("InvoiceManager listener warning:", err.message);
      setLoading(false);
    });

    return () => unsub();
  }, [user, activeSupplierId]);

  const generateAutoNumber = (type: "PROFORMA" | "INVOICE") => {
    const year = new Date().getFullYear();
    const prefix = type === "PROFORMA" ? "RAY-PRO" : "RAY-FAC";
    const rand = Math.floor(10000 + Math.random() * 90000);
    return `${prefix}-${year}-${rand}`;
  };

  const resetForm = () => {
    const autoNum = generateAutoNumber("PROFORMA");
    setInvoiceNumber(autoNum);
    setInvoiceType("PROFORMA");
    setSelectedRayon(
      (defaultSupplierRayon === "immo" || defaultSupplierRayon === "connect" || defaultSupplierRayon === "saveurs")
        ? defaultSupplierRayon
        : "mode"
    );
    setImmoBranch("habitation");
    setClientName("");
    setClientAddress("");
    setClientPhone("");
    setClientEmail("");
    setPaymentMethod("Virement / Mobile Money (Makuta)");
    setItems([{ description: "", quantity: 1, unitPrice: 0 }]);
    setTaxRate(0);
    setNotes("");

    // Reset helpers
    setHotelRoom("");
    setHotelCheckIn("");
    setHotelCheckOut("");
    setHotelNightlyRate("");
    setHotelNights(1);
    setHabitationProperty("");
    setHabitationPeriod("");
    setHabitationMonthlyRent("");
    setModeItemName("");
    setModeSize("");
    setModePrice("");
    setConnectEquipment("");
    setConnectSerial("");
    setConnectPrice("");
    setSaveursDishOrTool("");
    setSaveursGuests(1);
    setSaveursUnitPrice("");
  };

  // Helper appliers
  const applyHotelStayToItems = () => {
    if (!hotelRoom || !hotelNightlyRate) {
      alert("Veuillez indiquer la chambre et le tarif par nuit.");
      return;
    }
    const rate = parseFloat(hotelNightlyRate) || 0;
    const desc = `Séjour Hôtelier - ${hotelRoom}${hotelCheckIn && hotelCheckOut ? ` (du ${hotelCheckIn} au ${hotelCheckOut})` : ""}`;
    setItems([{ description: desc, quantity: hotelNights > 0 ? hotelNights : 1, unitPrice: rate }]);
  };

  const applyHabitationRentToItems = () => {
    if (!habitationProperty || !habitationMonthlyRent) {
      alert("Veuillez indiquer le bien et le montant du loyer.");
      return;
    }
    const rent = parseFloat(habitationMonthlyRent) || 0;
    const desc = `Loyer Mensuel & Charges - ${habitationProperty}${habitationPeriod ? ` (${habitationPeriod})` : ""}`;
    setItems([{ description: desc, quantity: 1, unitPrice: rent }]);
  };

  const applyModeItem = () => {
    if (!modeItemName || !modePrice) {
      alert("Veuillez indiquer l'article et son prix.");
      return;
    }
    const p = parseFloat(modePrice) || 0;
    const desc = `Pièce de mode : ${modeItemName}${modeSize ? ` (Taille / Réf : ${modeSize})` : ""}`;
    setItems([...items.filter(i => i.description.trim() !== ""), { description: desc, quantity: 1, unitPrice: p }]);
  };

  const applyConnectItem = () => {
    if (!connectEquipment || !connectPrice) {
      alert("Veuillez indiquer l'équipement et son prix.");
      return;
    }
    const p = parseFloat(connectPrice) || 0;
    const desc = `Équipement Connect / Télécom : ${connectEquipment}${connectSerial ? ` [S/N : ${connectSerial}]` : ""}`;
    setItems([...items.filter(i => i.description.trim() !== ""), { description: desc, quantity: 1, unitPrice: p }]);
  };

  const applySaveursItem = () => {
    if (!saveursDishOrTool || !saveursUnitPrice) {
      alert("Veuillez indiquer la prestation ou l'ustensile.");
      return;
    }
    const p = parseFloat(saveursUnitPrice) || 0;
    const desc = `Menu / Cuisine Saveurs : ${saveursDishOrTool}`;
    setItems([...items.filter(i => i.description.trim() !== ""), { description: desc, quantity: saveursGuests || 1, unitPrice: p }]);
  };

  const handleAddItem = () => {
    setItems([...items, { description: "", quantity: 1, unitPrice: 0 }]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const newItems = [...items];
    newItems[index][field] = value;
    setItems(newItems);
  };

  const calculateSubtotal = () => {
    return items.reduce((acc, item) => acc + (item.quantity * item.unitPrice), 0);
  };

  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    return subtotal + (subtotal * (taxRate / 100));
  };

  const downloadInvoicePDF = async (inv: any) => {
    const data: InvoiceData = {
      invoiceNumber: inv.invoiceNumber || `RAY-${inv.type === "PROFORMA" ? "PRO" : "FAC"}-${inv.id?.slice(0, 6)?.toUpperCase() || "DOC"}`,
      type: inv.type || "PROFORMA",
      rayon: inv.rayon || (inv.immoBranch ? "immo" : "general"),
      immoBranch: inv.immoBranch,
      createdAt: inv.createdAt,
      status: inv.status || (inv.type === "PROFORMA" ? "DRAFT" : "UNPAID"),
      supplierName: userData?.companyName || userData?.company || userData?.displayName || userData?.name || "Partenaire Officiel Rayons.net",
      supplierEmail: userData?.email,
      supplierPhone: userData?.phone || userData?.phoneNumber,
      supplierAddress: userData?.address,
      supplierRccm: userData?.rccm,
      supplierIdNat: userData?.idNat,
      supplierNif: userData?.nif,
      supplierLogo: userData?.logoUrl || userData?.logo || userData?.pendingProfile?.logoUrl,
      clientName: inv.clientName || "Client",
      clientPhone: inv.clientPhone,
      clientAddress: inv.clientAddress,
      clientEmail: inv.clientEmail,
      items: inv.items || [],
      subtotal: inv.subtotal || 0,
      taxRate: inv.taxRate || 0,
      total: inv.total || 0,
      currency: currency || "USD",
      paymentMethod: inv.paymentMethod || "Paiement sécurisé",
      stayDetails: inv.stayDetails,
      habitationDetails: inv.habitationDetails,
      notes: inv.notes
    };

    await generateFormalInvoicePDF(data);
  };

  const handleSaveInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (items.some(item => !item.description.trim() || item.quantity <= 0 || item.unitPrice <= 0)) {
      alert("Veuillez renseigner au moins une ligne valide (désignation, quantité > 0, prix unitaire > 0).");
      return;
    }

    setIsProcessing(true);
    try {
      const subtotal = calculateSubtotal();
      const total = calculateTotal();

      const finalInvoiceNumber = invoiceNumber.trim() || generateAutoNumber(invoiceType);

      const invoicePayload: any = {
        supplierId: activeSupplierId,
        invoiceNumber: finalInvoiceNumber,
        type: invoiceType,
        rayon: selectedRayon,
        clientName,
        clientAddress,
        clientPhone,
        clientEmail,
        paymentMethod,
        items,
        taxRate,
        subtotal,
        total,
        notes,
        status: invoiceType === "PROFORMA" ? "DRAFT" : "UNPAID",
        createdAt: serverTimestamp()
      };

      if (selectedRayon === "immo") {
        invoicePayload.immoBranch = immoBranch;
        if (immoBranch === "hotel") {
          invoicePayload.stayDetails = {
            room: hotelRoom,
            checkIn: hotelCheckIn,
            checkOut: hotelCheckOut,
            nights: hotelNights,
            nightlyRate: parseFloat(hotelNightlyRate) || 0
          };
        } else if (immoBranch === "habitation") {
          invoicePayload.habitationDetails = {
            property: habitationProperty,
            period: habitationPeriod,
            monthlyRent: parseFloat(habitationMonthlyRent) || 0
          };
        }
      }

      await addDoc(collection(db, "invoices"), invoicePayload);
      setIsModalOpen(false);
      resetForm();
    } catch (error) {
      console.error("Error saving invoice:", error);
      alert("Erreur lors de l'enregistrement de la facture.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Voulez-vous vraiment supprimer ce document ?")) {
      try {
        await deleteDoc(doc(db, "invoices", id));
      } catch (error) {
        console.error("Error deleting invoice", error);
        alert("Erreur lors de la suppression.");
      }
    }
  };

  const filteredInvoices = invoices.filter(inv => {
    const matchesSearch = (inv.clientName || "").toLowerCase().includes(search.toLowerCase()) ||
                          (inv.invoiceNumber || "").toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;
    if (selectedRayonFilter === "all") return true;
    if (selectedRayonFilter === "immo") return inv.rayon === "immo" || !!inv.immoBranch;
    if (selectedRayonFilter === "mode") return inv.rayon === "mode";
    if (selectedRayonFilter === "connect") return inv.rayon === "connect";
    if (selectedRayonFilter === "saveurs") return inv.rayon === "saveurs";
    return true;
  });

  const immoCount = invoices.filter(i => i.rayon === "immo" || i.immoBranch).length;
  const modeCount = invoices.filter(i => i.rayon === "mode").length;
  const connectCount = invoices.filter(i => i.rayon === "connect").length;
  const saveursCount = invoices.filter(i => i.rayon === "saveurs").length;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-[#C7D300] bg-[#C7D300]/10 px-2.5 py-0.5 rounded-full border border-[#C7D300]/20">
              Module Comptable Formalisé
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-heading font-extrabold text-white tracking-tight">
            Proformas & Factures Professionnelles
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Émettez et exportez des devis proformas, quittances de loyer et factures certifiées pour vos clients.
          </p>
        </div>
        <button
          onClick={() => { resetForm(); setIsModalOpen(true); }}
          className="bg-[#C7D300] text-[#0F1D27] hover:bg-[#b5c000] font-bold px-5 py-2.5 rounded-xl text-sm flex items-center transition-all shadow-md shadow-[#C7D300]/15 w-fit active:scale-95"
        >
          <Plus size={18} className="mr-2" /> Créer un Document Comptable
        </button>
      </div>

      {/* Main Container */}
      <div className="bg-[#0F1D27] border border-white/10 rounded-2xl shadow-xl overflow-hidden">
        {/* Search and Universe Filters */}
        <div className="p-4 border-b border-white/10 flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center bg-black/20">
          <div className="relative max-w-sm w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Rechercher par client ou N° facture..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-black/40 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C7D300] text-white text-sm transition-all"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
            <button
              onClick={() => setSelectedRayonFilter("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 ${
                selectedRayonFilter === "all" ? "bg-white text-[#0F1D27] shadow-sm" : "bg-white/5 text-gray-400 hover:text-white"
              }`}
            >
              Tous ({invoices.length})
            </button>
            <button
              onClick={() => setSelectedRayonFilter("mode")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 flex items-center gap-1.5 ${
                selectedRayonFilter === "mode" ? "bg-[#D4B08C] text-[#0F1D27] shadow-sm" : "bg-white/5 text-gray-400 hover:text-[#D4B08C]"
              }`}
            >
              <span>👗</span> Mode ({modeCount})
            </button>
            <button
              onClick={() => setSelectedRayonFilter("connect")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 flex items-center gap-1.5 ${
                selectedRayonFilter === "connect" ? "bg-[#00B5A5] text-white shadow-sm" : "bg-white/5 text-gray-400 hover:text-[#00B5A5]"
              }`}
            >
              <span>⚡</span> Connect ({connectCount})
            </button>
            <button
              onClick={() => setSelectedRayonFilter("saveurs")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 flex items-center gap-1.5 ${
                selectedRayonFilter === "saveurs" ? "bg-[#FF6B35] text-white shadow-sm" : "bg-white/5 text-gray-400 hover:text-[#FF6B35]"
              }`}
            >
              <span>🍽️</span> Saveurs ({saveursCount})
            </button>
            <button
              onClick={() => setSelectedRayonFilter("immo")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 flex items-center gap-1.5 ${
                selectedRayonFilter === "immo" ? "bg-[#4C6EF5] text-white shadow-sm" : "bg-white/5 text-gray-400 hover:text-[#4C6EF5]"
              }`}
            >
              <span>🏠</span> Immo ({immoCount})
            </button>
          </div>
        </div>

        {/* Invoices Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-black/30 text-xs uppercase tracking-wider text-gray-400 font-semibold border-b border-white/10">
                <th className="p-4">Réf & Type</th>
                <th className="p-4">Rayon</th>
                <th className="p-4">Client / Destinataire</th>
                <th className="p-4">Date Émission</th>
                <th className="p-4">Total Net</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="text-sm text-gray-300 divide-y divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-gray-400">
                    <div className="w-6 h-6 border-2 border-[#C7D300] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Chargement des documents comptables...
                  </td>
                </tr>
              ) : filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-gray-400">
                    <Receipt className="mx-auto text-gray-600 mb-3" size={40} />
                    <p className="font-semibold text-white">Aucun document comptable trouvé.</p>
                    <p className="text-xs text-gray-500 mt-1">Créez votre première facture ou proforma en cliquant ci-dessus.</p>
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => {
                  const r = inv.rayon || (inv.immoBranch ? "immo" : "general");
                  const badgeColor = 
                    r === "connect" ? "bg-[#00B5A5]/15 text-[#00B5A5] border-[#00B5A5]/30" :
                    r === "immo" ? "bg-[#4C6EF5]/15 text-[#4C6EF5] border-[#4C6EF5]/30" :
                    r === "saveurs" ? "bg-[#FF6B35]/15 text-[#FF6B35] border-[#FF6B35]/30" :
                    "bg-[#D4B08C]/15 text-[#D4B08C] border-[#D4B08C]/30";

                  const rayonName = 
                    r === "connect" ? "Connect" :
                    r === "immo" ? (inv.immoBranch === "hotel" ? "Hôtel" : "Habitation") :
                    r === "saveurs" ? "Saveurs" : "Mode";

                  return (
                    <tr key={inv.id} className="hover:bg-white/5 transition-colors">
                      <td className="p-4">
                        <div className="flex flex-col gap-1">
                          <span className="font-bold text-white tracking-wide text-xs">
                            {inv.invoiceNumber || `#RAY-${inv.id.slice(0, 8).toUpperCase()}`}
                          </span>
                          <span className={`w-fit px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider ${
                            inv.type === 'PROFORMA' ? 'bg-purple-500/20 text-purple-300' : 'bg-green-500/20 text-green-300'
                          }`}>
                            {inv.type === "PROFORMA" ? "Proforma / Devis" : "Facture Officielle"}
                          </span>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${badgeColor}`}>
                          {rayonName}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="font-semibold text-white">{inv.clientName}</div>
                        {inv.clientPhone && <div className="text-xs text-gray-400">{inv.clientPhone}</div>}
                      </td>
                      <td className="p-4 text-xs text-gray-300">
                        {inv.createdAt ? new Date(inv.createdAt.seconds * 1000).toLocaleDateString("fr-FR") : "-"}
                      </td>
                      <td className="p-4">
                        <span className="font-extrabold text-white text-base">
                          {formatPrice(inv.total)}
                        </span>
                      </td>
                      <td className="p-4 text-right space-x-2">
                        <button 
                          onClick={() => downloadInvoicePDF(inv)}
                          title="Télécharger PDF officiel Rayons"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-[#C7D300] hover:text-[#0F1D27] text-white rounded-lg text-xs font-bold transition-all active:scale-95 shadow-xs"
                        >
                          <Download size={14} />
                          <span>PDF</span>
                        </button>
                        <button 
                          onClick={() => handleDelete(inv.id)}
                          title="Supprimer"
                          className="inline-flex p-1.5 bg-white/5 text-gray-400 hover:text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Creation Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="w-full max-w-3xl bg-[#0F1D27] border border-white/15 rounded-3xl shadow-2xl flex flex-col max-h-[92vh] my-4 overflow-hidden"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between p-5 border-b border-white/10 bg-black/40">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#C7D300]/15 flex items-center justify-center text-[#C7D300]">
                    <FileText size={20} />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">Éditer un Document Comptable</h2>
                    <p className="text-xs text-gray-400">Formalisation certifiée selon les standards de Rayons.net</p>
                  </div>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors">
                  <X size={20} />
                </button>
              </div>

              {/* Modal Body Form */}
              <form onSubmit={handleSaveInvoice} className="p-6 space-y-6 overflow-y-auto">
                {/* Rayon Selection */}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-300 block">
                    Rayon / Univers d'émission
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedRayon("mode")}
                      className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center gap-1 ${
                        selectedRayon === "mode" 
                          ? "bg-[#D4B08C]/20 border-[#D4B08C] text-white shadow-md shadow-[#D4B08C]/10" 
                          : "bg-black/30 border-white/10 text-gray-400 hover:text-white"
                      }`}
                    >
                      <Shirt size={20} className={selectedRayon === "mode" ? "text-[#D4B08C]" : "text-gray-400"} />
                      <span className="text-xs font-bold">Rayon Mode</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedRayon("connect")}
                      className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center gap-1 ${
                        selectedRayon === "connect" 
                          ? "bg-[#00B5A5]/20 border-[#00B5A5] text-white shadow-md shadow-[#00B5A5]/10" 
                          : "bg-black/30 border-white/10 text-gray-400 hover:text-white"
                      }`}
                    >
                      <Wifi size={20} className={selectedRayon === "connect" ? "text-[#00B5A5]" : "text-gray-400"} />
                      <span className="text-xs font-bold">Rayon Connect</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedRayon("saveurs")}
                      className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center gap-1 ${
                        selectedRayon === "saveurs" 
                          ? "bg-[#FF6B35]/20 border-[#FF6B35] text-white shadow-md shadow-[#FF6B35]/10" 
                          : "bg-black/30 border-white/10 text-gray-400 hover:text-white"
                      }`}
                    >
                      <UtensilsCrossed size={20} className={selectedRayon === "saveurs" ? "text-[#FF6B35]" : "text-gray-400"} />
                      <span className="text-xs font-bold">Rayon Saveurs</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedRayon("immo")}
                      className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center gap-1 ${
                        selectedRayon === "immo" 
                          ? "bg-[#4C6EF5]/20 border-[#4C6EF5] text-white shadow-md shadow-[#4C6EF5]/10" 
                          : "bg-black/30 border-white/10 text-gray-400 hover:text-white"
                      }`}
                    >
                      <BuildingOrHome size={20} active={selectedRayon === "immo"} />
                      <span className="text-xs font-bold">Rayon Immo</span>
                    </button>
                  </div>
                </div>

                {/* Sub-branch for Immo */}
                {selectedRayon === "immo" && (
                  <div className="p-3 bg-black/30 border border-white/10 rounded-xl flex gap-3">
                    <button
                      type="button"
                      onClick={() => setImmoBranch("habitation")}
                      className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold border transition-all ${
                        immoBranch === "habitation" ? "bg-emerald-500/20 border-emerald-500 text-emerald-300" : "border-white/10 text-gray-400"
                      }`}
                    >
                      🏠 Habitation & Bail
                    </button>
                    <button
                      type="button"
                      onClick={() => setImmoBranch("hotel")}
                      className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold border transition-all ${
                        immoBranch === "hotel" ? "bg-amber-500/20 border-amber-500 text-amber-300" : "border-white/10 text-gray-400"
                      }`}
                    >
                      🏨 Hôtellerie & Séjour
                    </button>
                  </div>
                )}

                {/* Document Type & Reference */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-300">Nature du Document</label>
                    <div className="flex gap-4 p-2.5 bg-black/30 border border-white/10 rounded-xl">
                      <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-white">
                        <input
                          type="radio"
                          value="PROFORMA"
                          checked={invoiceType === "PROFORMA"}
                          onChange={() => {
                            setInvoiceType("PROFORMA");
                            setInvoiceNumber(generateAutoNumber("PROFORMA"));
                          }}
                          className="text-[#C7D300] focus:ring-[#C7D300]"
                        />
                        <span>Proforma / Devis</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-white">
                        <input
                          type="radio"
                          value="INVOICE"
                          checked={invoiceType === "INVOICE"}
                          onChange={() => {
                            setInvoiceType("INVOICE");
                            setInvoiceNumber(generateAutoNumber("INVOICE"));
                          }}
                          className="text-[#C7D300] focus:ring-[#C7D300]"
                        />
                        <span>Facture Définitive</span>
                      </label>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-300">Numéro de Facture (Normalisé)</label>
                    <input
                      type="text"
                      required
                      value={invoiceNumber}
                      onChange={(e) => setInvoiceNumber(e.target.value)}
                      className="w-full px-4 py-2.5 bg-black/30 border border-white/10 rounded-xl text-white text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#C7D300]"
                    />
                  </div>
                </div>

                {/* Specific Helper Assistants */}
                {selectedRayon === "immo" && immoBranch === "hotel" && (
                  <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                        <Hotel size={14} /> Assistant Séjour Hôtelier
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <input
                        type="text"
                        placeholder="Chambre / Suite"
                        value={hotelRoom}
                        onChange={(e) => setHotelRoom(e.target.value)}
                        className="px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-white"
                      />
                      <input
                        type="date"
                        value={hotelCheckIn}
                        onChange={(e) => setHotelCheckIn(e.target.value)}
                        className="px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-white"
                      />
                      <input
                        type="date"
                        value={hotelCheckOut}
                        onChange={(e) => {
                          setHotelCheckOut(e.target.value);
                          if (hotelCheckIn && e.target.value) {
                            const d1 = new Date(hotelCheckIn);
                            const d2 = new Date(e.target.value);
                            const diff = Math.ceil(Math.abs(d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)) || 1;
                            setHotelNights(diff);
                          }
                        }}
                        className="px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-white"
                      />
                      <input
                        type="number"
                        placeholder="Tarif / nuit ($)"
                        value={hotelNightlyRate}
                        onChange={(e) => setHotelNightlyRate(e.target.value)}
                        className="px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-white"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={applyHotelStayToItems}
                      className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-lg text-xs transition-all flex items-center gap-1"
                    >
                      <Sparkles size={13} /> Insérer dans la facture
                    </button>
                  </div>
                )}

                {selectedRayon === "immo" && immoBranch === "habitation" && (
                  <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl space-y-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-300 flex items-center gap-1.5">
                      <Home size={14} /> Assistant Loyer & Bail
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                      <input
                        type="text"
                        placeholder="Bien / Villa / Appartement"
                        value={habitationProperty}
                        onChange={(e) => setHabitationProperty(e.target.value)}
                        className="px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-white"
                      />
                      <input
                        type="text"
                        placeholder="Mois / Période (ex: Septembre 2026)"
                        value={habitationPeriod}
                        onChange={(e) => setHabitationPeriod(e.target.value)}
                        className="px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-white"
                      />
                      <input
                        type="number"
                        placeholder="Loyer mensuel ($)"
                        value={habitationMonthlyRent}
                        onChange={(e) => setHabitationMonthlyRent(e.target.value)}
                        className="px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-white"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={applyHabitationRentToItems}
                      className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-lg text-xs transition-all flex items-center gap-1"
                    >
                      <Sparkles size={13} /> Insérer dans la quittance
                    </button>
                  </div>
                )}

                {/* Client Information */}
                <div className="p-4 bg-black/20 border border-white/10 rounded-2xl space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-300">Coordonnées du Client</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">Nom du Client / Société *</label>
                      <input
                        type="text"
                        required
                        placeholder="Ex: Entreprise Maluku SARL ou M. Jean Dupont"
                        value={clientName}
                        onChange={(e) => setClientName(e.target.value)}
                        className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-xl text-white text-xs focus:ring-2 focus:ring-[#C7D300]"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">Téléphone</label>
                      <input
                        type="text"
                        placeholder="+243..."
                        value={clientPhone}
                        onChange={(e) => setClientPhone(e.target.value)}
                        className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-xl text-white text-xs focus:ring-2 focus:ring-[#C7D300]"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">Email</label>
                      <input
                        type="email"
                        placeholder="client@domaine.com"
                        value={clientEmail}
                        onChange={(e) => setClientEmail(e.target.value)}
                        className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-xl text-white text-xs focus:ring-2 focus:ring-[#C7D300]"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">Adresse de Facturation</label>
                      <input
                        type="text"
                        placeholder="Ex: Kinshasa, Gombe"
                        value={clientAddress}
                        onChange={(e) => setClientAddress(e.target.value)}
                        className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-xl text-white text-xs focus:ring-2 focus:ring-[#C7D300]"
                      />
                    </div>
                  </div>
                </div>

                {/* Line Items Table */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-gray-300">Lignes de Prestations & Articles</h3>
                    <button
                      type="button"
                      onClick={handleAddItem}
                      className="text-xs font-bold text-[#C7D300] hover:underline flex items-center gap-1"
                    >
                      <Plus size={14} /> Ajouter une ligne
                    </button>
                  </div>

                  <div className="space-y-2">
                    {items.map((item, index) => (
                      <div key={index} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-3 bg-black/30 border border-white/10 rounded-xl">
                        <input
                          type="text"
                          required
                          placeholder="Désignation de la prestation ou de l'article"
                          value={item.description}
                          onChange={(e) => handleItemChange(index, "description", e.target.value)}
                          className="flex-1 px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-white text-xs"
                        />
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="1"
                            required
                            placeholder="Qté"
                            value={item.quantity}
                            onChange={(e) => handleItemChange(index, "quantity", parseInt(e.target.value) || 1)}
                            className="w-20 px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-white text-xs text-center"
                          />
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            required
                            placeholder="Prix unit. ($)"
                            value={item.unitPrice}
                            onChange={(e) => handleItemChange(index, "unitPrice", parseFloat(e.target.value) || 0)}
                            className="w-28 px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-white text-xs text-right"
                          />
                          <div className="w-24 text-right text-xs font-bold text-white px-1">
                            {formatPrice(item.quantity * item.unitPrice)}
                          </div>
                          {items.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(index)}
                              className="p-1.5 text-red-400 hover:text-red-300 rounded hover:bg-red-500/20"
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Financial Summary */}
                <div className="p-4 bg-black/30 border border-white/10 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="flex items-center gap-3">
                    <label className="text-xs text-gray-400">Taux TVA / Taxe (%) :</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={taxRate}
                      onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                      className="w-16 px-2.5 py-1.5 bg-black/40 border border-white/10 rounded-lg text-white text-xs text-center font-bold"
                    />
                  </div>
                  <div className="text-right space-y-1">
                    <div className="text-xs text-gray-400">
                      Sous-total HT : <strong className="text-white">{formatPrice(calculateSubtotal())}</strong>
                    </div>
                    {taxRate > 0 && (
                      <div className="text-xs text-gray-400">
                        TVA ({taxRate}%) : <strong className="text-white">{formatPrice((calculateSubtotal() * taxRate) / 100)}</strong>
                      </div>
                    )}
                    <div className="text-base font-extrabold text-[#C7D300]">
                      Total Net : {formatPrice(calculateTotal())}
                    </div>
                  </div>
                </div>

                {/* Modal Actions */}
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-5 py-2.5 rounded-xl border border-white/10 text-gray-300 hover:text-white hover:bg-white/5 text-sm font-semibold transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={isProcessing}
                    className="px-6 py-2.5 bg-[#C7D300] hover:bg-[#b5c000] text-[#0F1D27] text-sm font-extrabold rounded-xl transition-all shadow-lg shadow-[#C7D300]/20 disabled:opacity-50"
                  >
                    {isProcessing ? "Enregistrement..." : "Valider & Générer"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function BuildingOrHome({ size, active }: { size: number; active: boolean }) {
  return (
    <div className="relative">
      <Home size={size} className={active ? "text-[#4C6EF5]" : "text-gray-400"} />
    </div>
  );
}
