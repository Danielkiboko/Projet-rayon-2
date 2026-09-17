"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Plus, X, Search, Home, Image as ImageIcon, AlertCircle, 
  MapPin, CheckCircle, XCircle, Trash2, Building, Eye, Edit,
  Star, Coffee, Car, Plane, Zap, Wifi, Waves, Shield, Clock, Sparkles, Bed, Hotel, Lock
} from "lucide-react";
import { useProductAiAssistant, handleImageUploadShared } from "@/hooks/useProductAiAssistant";
import AiAssistantChat from "@/modules/shared/components/shared/AiAssistantChat";
import ImageUploadArea from "@/modules/shared/components/shared/ImageUploadArea";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { 
  collection, query, where, getDocs, addDoc, updateDoc, 
  deleteDoc, doc, serverTimestamp, orderBy, onSnapshot, limit 
} from "firebase/firestore";
import { useCurrency, CurrencyCode } from "@/context/CurrencyContext";
import { evaluateSupplierSubscription } from "@/lib/supplierSubscription";

interface PropertyManagerProps {
  isAdmin: boolean;
}

export default function PropertyManager({ isAdmin }: PropertyManagerProps) {
  const { user, userData } = useAuth();
  const subscriptionInfo = evaluateSupplierSubscription(userData);
  const { formatPrice, currency, rates } = useCurrency();
  const [inputCurrency, setInputCurrency] = useState<CurrencyCode>("USD");
  
  const [properties, setProperties] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [previewProperty, setPreviewProperty] = useState<any | null>(null);

  // Separation: Habitation vs Hotel
  const [immoBranch, setImmoBranch] = useState<"habitation" | "hotel">("habitation");
  const [hotelSubtype, setHotelSubtype] = useState<string>("chambre_standard");
  const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>("all");

  // Form State
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [propertyTitle, setPropertyTitle] = useState("");
  const [propertyType, setPropertyType] = useState("appartement");
  const [typeTransaction, setTypeTransaction] = useState("À Louer");
  const [propertyPrice, setPropertyPrice] = useState("");
  const [propertyLocation, setPropertyLocation] = useState("");
  const [propertyCoords, setPropertyCoords] = useState<{lat: number, lng: number} | null>(null);
  const [isFetchingGps, setIsFetchingGps] = useState(false);
  const [propertyDesc, setPropertyDesc] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");
  const [agencyCommissionRate, setAgencyCommissionRate] = useState<number | string>(10);

  const {
    chatMessages,
    chatInput,
    setChatInput,
    isAiLoading,
    analyzeImage,
    handleSendMessage,
    resetChat
  } = useProductAiAssistant({
    onAiDataParsed: (autoFill) => {
      if (autoFill.title) setPropertyTitle(autoFill.title.fr || autoFill.title);
      if (autoFill.category) setPropertyType(autoFill.category);
      if (autoFill.price) setPropertyPrice(autoFill.price);
      if (autoFill.description) setPropertyDesc(autoFill.description);
    },
    apiEndpoint: '/api/ai/product-assistant'
  });

  const [isProcessing, setIsProcessing] = useState(false);

  // Structure Dynamique (Niveaux, Appartements, Bureaux, Chaises, Chambres)
  const [levels, setLevels] = useState<{
    id: string;
    name: string;
    units: {
      id: string;
      name: string;
      type: string;
      capacity: number;
    }[]
  }[]>([]);

  // Configuration Spécifique Hôtellerie & Résidences
  const [hotelStars, setHotelStars] = useState<string>("4");
  const [hotelAmenities, setHotelAmenities] = useState<string[]>([
    "generator", "wifi", "ac", "security", "parking"
  ]);
  const [checkInTime, setCheckInTime] = useState<string>("14:00");
  const [checkOutTime, setCheckOutTime] = useState<string>("12:00");

  const toggleAmenity = (key: string) => {
    setHotelAmenities(prev => 
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  // Fetch properties
  useEffect(() => {
    if (!user) return;
    setIsLoading(true);

    let unsubscribe = () => {};

    if (isAdmin) {
      // Admin: Fetch all properties (capped to 200). Avoid orderBy("createdAt") in Firebase to prevent hiding docs missing this field.
      const q = query(collection(db, "properties"), limit(200));
      unsubscribe = onSnapshot(q, (snapshot) => {
        const fetchedProperties: any[] = [];
        snapshot.forEach((docSnap) => {
          fetchedProperties.push({ id: docSnap.id, ...docSnap.data() });
        });
        
        // Sort locally by createdAt desc
        fetchedProperties.sort((a, b) => {
          const tA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
          const tB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
          return tB - tA;
        });

        setProperties(fetchedProperties);
        setIsLoading(false);
      }, (error) => {
        console.warn("Error fetching admin properties (handled):", error.message);
        setIsLoading(false);
      });
    } else {
      // Supplier: Fetch only their properties
      const q = query(collection(db, "properties"), where("supplierId", "==", user.uid), limit(100));
      unsubscribe = onSnapshot(q, (snapshot) => {
        const prods: any[] = [];
        snapshot.forEach(docSnap => prods.push({ id: docSnap.id, ...docSnap.data() }));
        setProperties(prods);
        setIsLoading(false);
      }, (error) => {
        console.warn("Error fetching supplier properties (handled):", error.message);
        setIsLoading(false);
      });
    }

    return () => unsubscribe();
  }, [user, isAdmin]);

  const resetForm = () => {
    setEditingId(null);
    setInputCurrency("USD");
    setImmoBranch("habitation");
    setPropertyTitle("");
    setPropertyType("appartement");
    setHotelSubtype("chambre_standard");
    setTypeTransaction("À Louer");
    setPropertyPrice("");
    setPropertyLocation("");
    setPropertyCoords(null);
    setPropertyDesc("");
    setOwnerName("");
    setOwnerPhone("");
    setAgencyCommissionRate(10);
    setLevels([]);
    setImagePreview(null);
    setImageFile(null);
    setHotelStars("4");
    setHotelAmenities(["generator", "wifi", "ac", "security", "parking"]);
    setCheckInTime("14:00");
    setCheckOutTime("12:00");
    resetChat();
  };

  const openAddModal = () => {
    if (!isAdmin && subscriptionInfo.isBlocked) {
      alert("Votre compte est actuellement suspendu pour impayé de dépôt mensuel. Vous ne pouvez pas ajouter de nouveaux biens ou chambres d'hôtel tant que votre compte n'est pas régularisé dans l'espace Finance.");
      return;
    }
    resetForm();
    setIsModalOpen(true);
  };

  const openEditModal = (property: any) => {
    setEditingId(property.id);
    const isHotel = property.immoBranch === "hotel" || property.type === "hotel" || !!property.hotelDetails;
    setImmoBranch(isHotel ? "hotel" : "habitation");
    setPropertyTitle(getTitle(property.title));
    setPropertyType(property.type || (isHotel ? "hotel" : "appartement"));
    setHotelSubtype(property.hotelDetails?.subtype || "chambre_standard");
    setTypeTransaction(property.typeTransaction || (isHotel ? "Réservation / Nuitée" : "À Louer"));
    if (property.inputCurrency) {
      setInputCurrency(property.inputCurrency);
      setPropertyPrice(property.originalInputPrice !== undefined ? String(property.originalInputPrice) : (property.price?.toString() || ""));
    } else {
      setInputCurrency("USD");
      setPropertyPrice(property.price?.toString() || "");
    }
    setPropertyLocation(property.location || "");
    setPropertyCoords(property.propertyCoords || null);
    setPropertyDesc(property.description || "");
    setOwnerName(property.ownerName || "");
    setOwnerPhone(property.ownerPhone || "");
    setAgencyCommissionRate(property.agencyCommissionRate ?? 10);
    setLevels(property.immoDetails?.levels || []);
    setImagePreview(property.image || null);
    setImageFile(null);
    if (property.hotelDetails) {
      setHotelStars(property.hotelDetails.stars?.toString() || "4");
      setHotelAmenities(property.hotelDetails.amenities || ["generator", "wifi", "ac", "security", "parking"]);
      setCheckInTime(property.hotelDetails.checkInTime || "14:00");
      setCheckOutTime(property.hotelDetails.checkOutTime || "12:00");
    }
    setIsModalOpen(true);
  };

  const handleGetLocation = () => {
    setIsFetchingGps(true);
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setPropertyCoords({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
          setIsFetchingGps(false);
        },
        (error) => {
          console.error("Erreur GPS:", error);
          alert("Impossible de récupérer la position. Assurez-vous d'avoir autorisé l'accès au GPS.");
          setIsFetchingGps(false);
        }
      );
    } else {
      alert("La géolocalisation n'est pas supportée par votre navigateur.");
      setIsFetchingGps(false);
    }
  };

  const handleAddLevel = () => {
    setLevels([...levels, { id: Date.now().toString(), name: `Niveau ${levels.length + 1}`, units: [] }]);
  };

  const handleRemoveLevel = (lIndex: number) => {
    const newLevels = [...levels];
    newLevels.splice(lIndex, 1);
    setLevels(newLevels);
  };

  const handleUpdateLevelName = (lIndex: number, name: string) => {
    const newLevels = [...levels];
    newLevels[lIndex].name = name;
    setLevels(newLevels);
  };

  const handleAddUnit = (lIndex: number) => {
    const newLevels = [...levels];
    newLevels[lIndex].units.push({
      id: Date.now().toString(),
      name: "",
      type: "appartement",
      capacity: 1
    });
    setLevels(newLevels);
  };

  const handleRemoveUnit = (lIndex: number, uIndex: number) => {
    const newLevels = [...levels];
    newLevels[lIndex].units.splice(uIndex, 1);
    setLevels(newLevels);
  };

  const handleUpdateUnit = (lIndex: number, uIndex: number, field: string, value: any) => {
    const newLevels = [...levels];
    newLevels[lIndex].units[uIndex] = { ...newLevels[lIndex].units[uIndex], [field]: value };
    setLevels(newLevels);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleImageUploadShared(
      e,
      setImageFile,
      setImagePreview,
      analyzeImage,
      "Voici la photo de ma propriété immobilière. Peux-tu l'analyser pour vérifier si elle est pertinente, et m'aider à créer une bonne description ? Si la photo ne ressemble pas à un bien immobilier, dis-le moi."
    );
  };

  const handleSaveProperty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsProcessing(true);

    const isHotel = immoBranch === "hotel";

    // Normalisation en amont du type de transaction
    let normalizedTransaction = typeTransaction || (isHotel ? "Réservation / Nuitée" : "À Louer");
    if (isHotel) {
      normalizedTransaction = "Réservation / Nuitée";
    } else {
      const tLower = (typeTransaction || "").toLowerCase().trim();
      if (tLower.includes("vent") || tLower.includes("vendre") || tLower === "sale") {
        normalizedTransaction = "À Vendre";
      } else {
        normalizedTransaction = "À Louer";
      }
    }

    const rawPrice = parseFloat(propertyPrice.toString().replace(/[^0-9.]/g, '') || "0");
    const fcRate = rates?.FC || 2850;
    const eurRate = rates?.EUR || 0.92;
    let canonicalPrice = rawPrice;
    if (inputCurrency === "FC") {
      canonicalPrice = Number((rawPrice / fcRate).toFixed(2));
    } else if (inputCurrency === "EUR") {
      canonicalPrice = Number((rawPrice / eurRate).toFixed(2));
    }

    const propertyData = {
      title: { fr: propertyTitle, en: propertyTitle }, // Simulating i18n
      immoBranch: isHotel ? "hotel" : "habitation",
      type: isHotel ? "hotel" : (propertyType || "appartement"),
      category: "immo",
      rayon: "immo",
      typeTransaction: normalizedTransaction,
      price: canonicalPrice,
      inputCurrency: inputCurrency,
      originalInputPrice: rawPrice,
      appliedExchangeRate: rates?.[inputCurrency] || 1,
      location: propertyLocation,
      description: propertyDesc,
      image: imagePreview || (isHotel ? "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&q=80&w=800" : "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&q=80&w=800"),
      propertyCoords: propertyCoords,
      ownerName: ownerName.trim(),
      ownerPhone: ownerPhone.trim(),
      agencyCommissionRate: Number(agencyCommissionRate) || 10,
      supplierId: user.uid,
      immoDetails: {
        area: 0,
        beds: 0,
        baths: 0,
        levels: levels
      },
      hotelDetails: isHotel ? {
        stars: hotelStars,
        subtype: hotelSubtype,
        amenities: hotelAmenities,
        checkInTime: checkInTime || "14:00",
        checkOutTime: checkOutTime || "12:00"
      } : null
    };

    try {
      if (editingId) {
        const updatePayload: any = {
          ...propertyData,
          updatedAt: serverTimestamp(),
        };
        // Toute modification effectuée par un fournisseur repasse obligatoirement par la validation de l'administrateur
        if (!isAdmin) {
          updatePayload.status = "PENDING_APPROVAL";
        }
        await updateDoc(doc(db, "properties", editingId), updatePayload);

        if (!isAdmin) {
          // Notification instantanée pour l'administrateur
          await addDoc(collection(db, "inapp_notifications"), {
            supplierId: "admin",
            type: "property",
            title: "Modification d'annonce à valider",
            message: `Le bien / hôtel "${propertyTitle}" a été modifié et attend votre validation pour être remis en ligne.`,
            propertyId: editingId,
            time: Date.now(),
            link: "/admin/properties",
            read: false,
            createdAt: serverTimestamp()
          });
        }
      } else {
        const docRef = await addDoc(collection(db, "properties"), {
          ...propertyData,
          status: isAdmin ? "Disponible" : "PENDING_APPROVAL",
          createdAt: serverTimestamp(),
        });

        if (!isAdmin) {
          // Notification instantanée pour l'administrateur
          await addDoc(collection(db, "inapp_notifications"), {
            supplierId: "admin",
            type: "property",
            title: isHotel ? "Nouvelle offre hôtelière à valider" : "Nouveau bien immobilier à valider",
            message: `Un nouveau bien "${propertyTitle}" (${isHotel ? "Hôtellerie / Nuitée" : "Habitation"}) a été soumis et attend votre validation.`,
            propertyId: docRef.id,
            time: Date.now(),
            link: "/admin/properties",
            read: false,
            createdAt: serverTimestamp()
          });
        }
      }

      setIsModalOpen(false);
      resetForm();

      if (!isAdmin) {
        alert(
          editingId
            ? "Vos modifications ont été enregistrées ! L'annonce est actuellement en attente de validation par l'administrateur avant d'être remise en ligne."
            : "Votre annonce a bien été soumise ! Elle est en attente de validation par l'administrateur avant d'être publiée sur le Rayon Immo."
        );
      }
    } catch (error: any) {
      console.error("Erreur lors de la sauvegarde de la propriété:", error);
      alert("Une erreur est survenue: " + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteProperty = async (id: string) => {
    if (confirm("Voulez-vous vraiment supprimer cette propriété ? Cette action est irréversible.")) {
      try {
        await deleteDoc(doc(db, "properties", id));
      } catch (error) {
        console.error("Erreur lors de la suppression:", error);
        alert("Erreur lors de la suppression.");
      }
    }
  };

  const handleApproveProperty = async (property: any) => {
    if (!isAdmin) return;
    if (confirm("Approuver et publier ce bien immobilier ?")) {
      let isSuccess = false;
      try {
        const response = await fetch("/api/properties/update-status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            propertyId: property.id,
            supplierId: property.supplierId,
            title: property.title,
            status: "Disponible"
          })
        });

        const result = await response.json();
        if (result.success) {
          isSuccess = true;
        } else {
          throw new Error(result.error);
        }
      } catch (apiError: any) {
        console.warn("API status update failed, fallback to direct Firestore update:", apiError);
        try {
          await updateDoc(doc(db, "properties", property.id), {
            status: "Disponible"
          });
          isSuccess = true;
          if (property.supplierId) {
            await addDoc(collection(db, "inapp_notifications"), {
              supplierId: property.supplierId,
              type: "property",
              title: "Annonce Publiée",
              message: `Félicitations, votre bien "${getTitle(property.title)}" est maintenant en ligne !`,
              time: Date.now(),
              link: "/supplier/properties",
              read: false,
              createdAt: serverTimestamp()
            });
          }
        } catch (directError: any) {
          console.error("Error approving property:", directError);
          alert("Erreur lors de l'approbation: " + (apiError?.message || directError?.message));
          return;
        }
      }

      if (isSuccess && property.supplierId) {
        fetch("/api/notifications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "PROPERTY_APPROVED",
            supplierId: property.supplierId
          })
        }).catch(console.error);
      }
    }
  };

  const handleRejectProperty = async (id: string) => {
    if (!isAdmin) return;
    const reason = prompt("Motif de rejet (sera visible par le fournisseur) :");
    if (reason !== null) {
      const prop = properties.find(p => p.id === id);
      try {
        const response = await fetch("/api/properties/update-status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            propertyId: id,
            supplierId: prop?.supplierId,
            title: prop?.title,
            status: "REJECTED",
            rejectionReason: reason
          })
        });

        const result = await response.json();
        if (!result.success) throw new Error(result.error);
      } catch (apiError: any) {
        console.warn("API reject update failed, fallback to direct Firestore update:", apiError);
        try {
          await updateDoc(doc(db, "properties", id), {
            status: "REJECTED",
            rejectionReason: reason
          });
          if (prop?.supplierId) {
            await addDoc(collection(db, "inapp_notifications"), {
              supplierId: prop.supplierId,
              type: "property",
              title: "Annonce Rejetée",
              message: `Votre bien "${getTitle(prop.title)}" a été rejeté. Motif : ${reason || "Non spécifié"}`,
              time: Date.now(),
              link: "/supplier/properties",
              read: false,
              createdAt: serverTimestamp()
            });
          }
        } catch (directError: any) {
          console.error("Error rejecting property:", directError);
          alert("Erreur lors du rejet: " + (apiError?.message || directError?.message));
        }
      }
    }
  };

  const getTitle = (titleObj: Record<string, string> | string | null | undefined) => {
    if (typeof titleObj === 'object' && titleObj !== null) {
      return titleObj.fr || titleObj.en || "Sans titre";
    }
    return titleObj || "Sans titre";
  };

  const habitationCount = properties.filter(p => p.immoBranch === "habitation" || (p.immoBranch !== "hotel" && p.type !== "hotel")).length;
  const hotelCount = properties.filter(p => p.immoBranch === "hotel" || p.type === "hotel" || !!p.hotelDetails).length;
  const pendingCount = properties.filter(p => p.status === "PENDING_APPROVAL").length;

  const filteredProperties = properties.filter(p => {
    const title = getTitle(p.title).toLowerCase();
    const loc = (p.location || "").toLowerCase();
    const matchesSearch = title.includes(search.toLowerCase()) || loc.includes(search.toLowerCase());
    if (!matchesSearch) return false;

    if (selectedBranchFilter === "pending") return p.status === "PENDING_APPROVAL";
    const isHotel = p.immoBranch === "hotel" || p.type === "hotel" || !!p.hotelDetails;
    if (selectedBranchFilter === "habitation") return !isHotel;
    if (selectedBranchFilter === "hotel") return isHotel;
    return true;
  });

  const getBranchBadge = (property: any) => {
    const isHotel = property.immoBranch === "hotel" || property.type === "hotel" || !!property.hotelDetails;
    if (isHotel) {
      const stars = property.hotelDetails?.stars || "4";
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 uppercase tracking-wider">
          <Hotel size={13} className="text-amber-400" />
          <span>Hôtel {stars}★</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 uppercase tracking-wider">
        <Home size={13} className="text-emerald-400" />
        <span>Habitation • {property.type || "Bien"}</span>
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Building className="text-blue-500" /> 
            {isAdmin ? "Gestion & Validation de l'Immobilier / Hôtellerie" : "Mes Propriétés & Hôtels"}
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            {isAdmin 
              ? "Validez et publiez les annonces résidentielles et hôtelières soumises par les fournisseurs."
              : "Gérez vos biens résidentiels et hôteliers. Vos annonces sont validées par l'administrateur avant publication."
            }
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={openAddModal}
            className={`${
              !isAdmin && subscriptionInfo.isBlocked 
                ? "bg-red-600/80 text-white cursor-not-allowed shadow-red-900/30" 
                : "bg-primary text-white hover:bg-primary-light"
            } px-5 py-2.5 rounded-xl text-sm font-semibold flex items-center transition-colors shadow-sm`}
            title={!isAdmin && subscriptionInfo.isBlocked ? "Compte suspendu : Dépôt mensuel impayé" : undefined}
          >
            {!isAdmin && subscriptionInfo.isBlocked ? (
              <Lock size={18} className="mr-2" />
            ) : (
              <Plus size={18} className="mr-2" />
            )}
            {!isAdmin && subscriptionInfo.isBlocked ? "Ajout verrouillé (Impayé)" : "Ajouter un bien / hôtel"}
          </button>
        </div>
      </div>

      {/* Admin Alert Banner for Pending Approvals */}
      {isAdmin && pendingCount > 0 && (
        <div className="p-4 bg-orange-500/15 border border-orange-500/30 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-orange-400">
            <div className="p-2.5 bg-orange-500/20 rounded-xl">
              <Clock size={24} className="text-orange-400 animate-pulse" />
            </div>
            <div>
              <p className="font-bold text-white text-base">
                {pendingCount} annonce(s) en attente de votre validation
              </p>
              <p className="text-xs text-orange-200/80 mt-0.5">
                Des offres immobilières et hôtelières ont été déposées par les propriétaires/fournisseurs. Cliquez ci-contre pour les examiner et les valider en un clic.
              </p>
            </div>
          </div>
          <button
            onClick={() => setSelectedBranchFilter("pending")}
            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs rounded-xl transition-all shadow-md shrink-0 flex items-center gap-1.5"
          >
            <Clock size={14} />
            <span>Examiner les annonces ({pendingCount})</span>
          </button>
        </div>
      )}

      {/* Quick Stats: 3 distinct cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-400">Total Biens Enregistrés</p>
            <p className="text-2xl font-bold text-white mt-1">{properties.length}</p>
          </div>
          <div className="p-3 bg-blue-400/10 text-blue-400 rounded-lg">
            <Building size={20} />
          </div>
        </div>

        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-sm text-emerald-300">🏠 Habitations (Vente/Location)</p>
            <p className="text-2xl font-bold text-emerald-400 mt-1">{habitationCount}</p>
          </div>
          <div className="p-3 bg-emerald-500/20 text-emerald-300 rounded-lg">
            <Home size={20} />
          </div>
        </div>

        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-sm text-amber-300">🏨 Hôtels & Séjours (Nuitées)</p>
            <p className="text-2xl font-bold text-amber-400 mt-1">{hotelCount}</p>
          </div>
          <div className="p-3 bg-amber-500/20 text-amber-300 rounded-lg">
            <Hotel size={20} />
          </div>
        </div>
      </div>

      <div className="bg-[#1a1a1a] rounded-2xl shadow-sm border border-white/5 overflow-hidden">
        <div className="p-4 border-b border-white/10 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
          <div className="relative max-w-sm w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Rechercher par titre ou ville..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-black/20 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-white text-sm transition-all"
            />
          </div>

          {/* Branch Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto">
            <button
              onClick={() => setSelectedBranchFilter("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 ${
                selectedBranchFilter === "all"
                  ? "bg-white text-gray-950 shadow-sm"
                  : "bg-white/5 text-gray-400 hover:text-white hover:bg-white/10"
              }`}
            >
              Tous ({properties.length})
            </button>
            <button
              onClick={() => setSelectedBranchFilter("habitation")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 flex items-center gap-1.5 ${
                selectedBranchFilter === "habitation"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "bg-white/5 text-gray-400 hover:text-white hover:bg-white/10"
              }`}
            >
              <Home size={13} />
              <span>Habitation ({habitationCount})</span>
            </button>
            <button
              onClick={() => setSelectedBranchFilter("hotel")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 flex items-center gap-1.5 ${
                selectedBranchFilter === "hotel"
                  ? "bg-amber-600 text-white shadow-sm"
                  : "bg-white/5 text-gray-400 hover:text-white hover:bg-white/10"
              }`}
            >
              <Hotel size={13} />
              <span>Hôtellerie ({hotelCount})</span>
            </button>
            {pendingCount > 0 && (
              <button
                onClick={() => setSelectedBranchFilter("pending")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 flex items-center gap-1.5 ${
                  selectedBranchFilter === "pending"
                    ? "bg-orange-600 text-white shadow-sm"
                    : "bg-orange-500/15 text-orange-300 border border-orange-500/30 hover:bg-orange-500/25"
                }`}
              >
                <Clock size={13} />
                <span>En attente ({pendingCount})</span>
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/5 text-xs uppercase tracking-wider text-gray-400 font-semibold">
                <th className="p-4 w-16">Image</th>
                <th className="p-4">Titre de l'annonce</th>
                <th className="p-4">Branche & Type</th>
                <th className="p-4">Localisation</th>
                <th className="p-4">Tarification</th>
                <th className="p-4">Statut</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="text-sm text-gray-300">
              {isLoading ? (
                <tr><td colSpan={7} className="p-12 text-center text-gray-500 font-medium">Chargement...</td></tr>
              ) : filteredProperties.length === 0 ? (
                <tr><td colSpan={7} className="p-12 text-center text-gray-500 font-medium">Aucun bien trouvé.</td></tr>
              ) : (
                filteredProperties.map((property) => {
                  const isHotel = property.immoBranch === "hotel" || property.type === "hotel" || !!property.hotelDetails;
                  return (
                  <tr key={property.id} className="border-b border-white/5 hover:bg-white/5 transition-colors group">
                    <td className="p-4">
                      <div className="w-12 h-12 bg-white/5 rounded-lg overflow-hidden border border-white/10 flex items-center justify-center">
                        {property.image ? (
                           // eslint-disable-next-line @next/next/no-img-element
                           <img src={property.image} alt="bien immo" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                        ) : (
                           <Home size={16} className="text-primary-light" />
                        )}
                      </div>
                    </td>
                    <td className="p-4 font-semibold text-white">
                      <span className="line-clamp-1">{getTitle(property.title)}</span>
                    </td>
                    <td className="p-4">
                      {getBranchBadge(property)}
                    </td>
                    <td className="p-4 flex items-center gap-1 text-sm text-gray-300">
                      <MapPin size={14} className="text-gray-400" />
                      {property.location || "-"}
                    </td>
                    <td className="p-4 font-bold text-white">
                      {typeof property.price === "number" ? formatPrice(property.price) : property.price}
                      <span className="text-xs font-normal text-gray-400 ml-1">
                        {isHotel ? "/ nuit" : (property.typeTransaction === "À Louer" ? "/ mois" : "")}
                      </span>
                    </td>
                    <td className="p-4">
                      {property.status === "PENDING_APPROVAL" ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-orange-500/15 text-orange-400 border border-orange-500/30 uppercase tracking-wider">
                          <Clock size={12} className="animate-pulse" />
                          <span>En attente validation</span>
                        </span>
                      ) : property.status === "Disponible" ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-green-500/15 text-green-400 border border-green-500/30 uppercase tracking-wider">
                          <CheckCircle size={12} />
                          <span>En ligne</span>
                        </span>
                      ) : property.status === "REJECTED" ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-red-500/15 text-red-400 border border-red-500/30 uppercase tracking-wider">
                          <XCircle size={12} />
                          <span>Rejeté</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-white/10 text-gray-300 uppercase tracking-wider">
                          {property.status || "Inconnu"}
                        </span>
                      )}
                      {property.status === "REJECTED" && property.rejectionReason && (
                        <div className="text-xs text-red-400 mt-1">Motif: {property.rejectionReason}</div>
                      )}
                    </td>
                    <td className="p-4 text-right whitespace-nowrap">
                      {isAdmin && (property.status !== "Disponible") && (
                        <>
                          <button 
                            onClick={() => handleApproveProperty(property)}
                            title="Approuver et Publier sur Rayon Immo"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white rounded-lg text-xs font-bold transition-all shadow-sm mr-2"
                          >
                            <CheckCircle size={14} />
                            <span>Valider</span>
                          </button>
                          <button 
                            onClick={() => handleRejectProperty(property.id)}
                            title="Rejeter avec motif"
                            className="inline-flex p-1.5 bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white rounded-lg transition-colors border border-red-500/30 mr-2"
                          >
                            <XCircle size={16} />
                          </button>
                        </>
                      )}
                      {isAdmin && (
                        <button 
                          onClick={() => setPreviewProperty(property)}
                          title="Prévisualiser"
                          className="inline-flex p-2 bg-white/5 text-blue-400 hover:text-white rounded-lg hover:bg-blue-600 transition-colors border border-transparent hover:border-blue-600 mr-2"
                        >
                          <Eye size={18} />
                        </button>
                      )}
                      <button 
                        onClick={() => openEditModal(property)}
                        title="Modifier la propriété"
                        className="inline-flex p-2 bg-white/5 text-gray-400 hover:text-white rounded-lg hover:bg-purple-600 transition-colors border border-transparent hover:border-purple-600 mr-2"
                      >
                        <Edit size={18} />
                      </button>
                      <button 
                        onClick={() => handleDeleteProperty(property.id)}
                        className="inline-flex p-2 bg-white/5 text-gray-400 hover:text-white rounded-lg hover:bg-red-600 transition-colors border border-transparent hover:border-red-600"
                      >
                        <Trash2 size={18} />
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

      {/* Create Property Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-2xl bg-[#140b2e] border border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] my-4"
            >
              <div className="flex items-center justify-between p-4 border-b border-white/10 shrink-0 bg-[#140b2e]">
                <h2 className="text-xl font-semibold text-white">Ajouter une propriété</h2>
                <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white transition-colors">
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleSaveProperty} className="p-4 space-y-5 overflow-y-auto scrollbar-hide">
                
                {/* Image Upload Area */}
                <ImageUploadArea
                  imagePreview={imagePreview}
                  fileInputRef={fileInputRef}
                  handleImageUpload={handleImageUpload}
                  onClear={() => {
                    setImagePreview(null);
                    setImageFile(null);
                    resetChat();
                    if (fileInputRef.current) {
                      fileInputRef.current.value = "";
                    }
                  }}
                  onUrlChange={(url) => setImagePreview(url)}
                />

                <div className="space-y-4">
                  {/* AI Chat Assistant */}
                  {imageFile && (
                    <AiAssistantChat 
                      title="Assistant IA Immo"
                      chatMessages={chatMessages}
                      chatInput={chatInput}
                      setChatInput={setChatInput}
                      isAiLoading={isAiLoading}
                      handleSendMessage={handleSendMessage}
                    />
                  )}
                </div>

                {/* ── Sélecteur de Branche Immo (Habitation vs Hôtellerie) ── */}
                <div className="space-y-2 p-4 bg-white/5 border border-white/10 rounded-2xl">
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-300 block">
                    Type de produit immobilier <span className="text-red-400">*</span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setImmoBranch("habitation");
                        setPropertyType("appartement");
                        setTypeTransaction("À Louer");
                      }}
                      className={`p-4 rounded-xl border text-left transition-all relative overflow-hidden flex flex-col justify-between ${
                        immoBranch === "habitation"
                          ? "bg-emerald-500/20 border-emerald-500 text-white shadow-lg shadow-emerald-950/40"
                          : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2.5 mb-2">
                          <div className={`p-2 rounded-lg ${immoBranch === "habitation" ? "bg-emerald-500 text-black font-bold" : "bg-white/10 text-gray-400"}`}>
                            <Home size={18} />
                          </div>
                          <div>
                            <span className="font-bold text-sm block text-white">Immobilier Habitation</span>
                            <span className="text-[11px] text-emerald-400 font-medium">Baux, Loyers & Ventes</span>
                          </div>
                        </div>
                        <p className="text-xs text-gray-400 leading-relaxed mt-1">
                          Maisons, Appartements, Terrains, Villas, Immeubles, Bureaux. Vente définitive ou location mensuelle avec contrat de bail.
                        </p>
                      </div>
                      {immoBranch === "habitation" && (
                        <div className="mt-3 flex items-center gap-1.5 text-xs text-emerald-400 font-semibold">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                          Branche sélectionnée
                        </div>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setImmoBranch("hotel");
                        setPropertyType("hotel");
                        setTypeTransaction("Réservation / Nuitée");
                      }}
                      className={`p-4 rounded-xl border text-left transition-all relative overflow-hidden flex flex-col justify-between ${
                        immoBranch === "hotel"
                          ? "bg-amber-500/20 border-amber-500 text-white shadow-lg shadow-amber-950/40"
                          : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2.5 mb-2">
                          <div className={`p-2 rounded-lg ${immoBranch === "hotel" ? "bg-amber-500 text-black font-bold" : "bg-white/10 text-gray-400"}`}>
                            <Hotel size={18} />
                          </div>
                          <div>
                            <span className="font-bold text-sm block text-white">Immo Hôtelier & Séjours</span>
                            <span className="text-[11px] text-amber-400 font-medium">Nuitées & Hébergements</span>
                          </div>
                        </div>
                        <p className="text-xs text-gray-400 leading-relaxed mt-1">
                          Hôtels, Suites, Chambres, Résidences meublées, Lodges. Tarification par nuitée, check-in/out et facturation de séjour.
                        </p>
                      </div>
                      {immoBranch === "hotel" && (
                        <div className="mt-3 flex items-center gap-1.5 text-xs text-amber-400 font-semibold">
                          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                          Branche sélectionnée
                        </div>
                      )}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1 md:col-span-2">
                    <label className="text-sm font-medium text-gray-300">Titre de l'annonce</label>
                    <input
                      type="text"
                      required
                      value={propertyTitle}
                      onChange={(e) => setPropertyTitle(e.target.value)}
                      placeholder={immoBranch === "hotel" ? "Ex: Suite Prestige avec Vue Panoramique" : "Ex: Bel appartement 3 pièces au centre"}
                      className="w-full px-4 py-2 bg-black/20 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-white"
                    />
                  </div>

                  {immoBranch === "habitation" ? (
                    <>
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-300">Catégorie de bien</label>
                        <select 
                          required 
                          value={propertyType} 
                          onChange={(e) => setPropertyType(e.target.value)} 
                          className="w-full px-4 py-2 bg-black/20 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-white"
                        >
                          <option value="appartement">🏢 Appartement</option>
                          <option value="maison">🏡 Maison / Villa</option>
                          <option value="studio">🛋️ Studio</option>
                          <option value="terrain">📐 Terrain / Parcelle</option>
                          <option value="commercial">🏬 Local Commercial / Bureau</option>
                          <option value="immeuble">🏙️ Immeuble de rapport</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-300">Type de Transaction</label>
                        <select
                          required
                          value={typeTransaction}
                          onChange={(e) => setTypeTransaction(e.target.value)}
                          className="w-full px-4 py-2 bg-black/20 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-white"
                        >
                          <option value="À Louer">🔑 À Louer (Location avec bail & loyer)</option>
                          <option value="À Vendre">💰 À Vendre (Vente définitive)</option>
                        </select>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-300">Type d'hébergement / Chambre</label>
                        <select 
                          required 
                          value={hotelSubtype} 
                          onChange={(e) => setHotelSubtype(e.target.value)} 
                          className="w-full px-4 py-2 bg-black/20 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-white"
                        >
                          <option value="chambre_standard">🛏️ Chambre Standard</option>
                          <option value="chambre_deluxe">✨ Chambre Deluxe / Supérieure</option>
                          <option value="suite_executive">👑 Suite Exécutive</option>
                          <option value="suite_presidentielle">🌟 Suite Présidentielle</option>
                          <option value="bungalow">🏡 Bungalow / Villa d'Hôtes</option>
                          <option value="hotel_complet">🏨 Établissement Hôtelier Complet</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-300">Formule de séjour</label>
                        <div className="w-full px-4 py-2 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-300 text-sm font-medium flex items-center justify-between">
                          <span>🏨 Réservation par Nuitée</span>
                          <span className="text-xs bg-amber-500/20 px-2 py-0.5 rounded text-amber-200">Facturation Check-in/out</span>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Sélecteur de Devise & Taux de Change pour la Soumission Immo */}
                <div className="p-3.5 bg-[#0F1D27] border border-[#C7D300]/30 rounded-xl space-y-2.5 shadow-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white uppercase tracking-wider">Devise de tarification</span>
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-[#C7D300] text-[#0F1D27]">
                          {inputCurrency === "USD" ? "$ Dollar US" : inputCurrency === "FC" ? "FC Franc Congolais" : "€ Euro"}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-300 mt-0.5">
                        Fixez le loyer ou prix de vente dans la devise communiquée par le bailleur. Le site l'adaptera au visiteur.
                      </p>
                    </div>

                    {/* Choix devise : USD / FC / EUR */}
                    <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/10 shrink-0">
                      {(["USD", "FC", "EUR"] as CurrencyCode[]).map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setInputCurrency(c)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                            inputCurrency === c
                              ? "bg-[#C7D300] text-[#0F1D27] shadow-md"
                              : "text-gray-300 hover:text-white"
                          }`}
                        >
                          {c === "USD" ? "$ USD" : c === "FC" ? "FC (CDF)" : "€ EUR"}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Taux plateforme informatif */}
                  <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-white/10 text-[11px] text-gray-400">
                    <span>Taux actif : <strong className="text-[#C7D300]">1 $ USD = {(rates?.FC || 2850).toLocaleString("fr-FR")} FC</strong> | <strong className="text-[#C7D300]">1 $ USD = {rates?.EUR || 0.92} €</strong></span>
                    {inputCurrency !== "USD" && (
                      <span className="text-amber-400 font-medium">Conversion automatique vers USD ($) pour le catalogue</span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-300">
                      {immoBranch === "hotel" 
                        ? `Tarif par nuitée (${inputCurrency} / nuit)` 
                        : (typeTransaction === "À Vendre" ? `Prix de vente total (${inputCurrency})` : `Loyer mensuel (${inputCurrency} / mois)`)
                      }
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      required
                      value={propertyPrice}
                      onChange={(e) => setPropertyPrice(e.target.value)}
                      placeholder={immoBranch === "hotel" ? (inputCurrency === "FC" ? "Ex: 285000" : "Ex: 100") : (typeTransaction === "À Vendre" ? (inputCurrency === "FC" ? "Ex: 285000000" : "Ex: 150000") : (inputCurrency === "FC" ? "Ex: 850000" : "Ex: 300"))}
                      className="w-full px-4 py-2 bg-black/20 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C7D300] text-white"
                    />
                    <div className="text-[11px] text-gray-400 min-h-[16px]">
                      {propertyPrice && !isNaN(parseFloat(propertyPrice)) ? (
                        inputCurrency === "FC" ? (
                          <span className="text-[#C7D300] font-semibold">≈ ${(parseFloat(propertyPrice) / (rates?.FC || 2850)).toFixed(2)} USD (converti au catalogue)</span>
                        ) : inputCurrency === "USD" ? (
                          <span className="text-[#C7D300] font-semibold">≈ {Math.round(parseFloat(propertyPrice) * (rates?.FC || 2850)).toLocaleString("fr-FR")} FC</span>
                        ) : (
                          <span className="text-[#C7D300] font-semibold">≈ ${(parseFloat(propertyPrice) / (rates?.EUR || 0.92)).toFixed(2)} USD</span>
                        )
                      ) : (
                        <span>Tarif officiel affiché aux clients</span>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-300">Localisation</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <MapPin size={16} className="text-gray-400" />
                      </div>
                      <input
                        type="text"
                        required
                        value={propertyLocation}
                        onChange={(e) => setPropertyLocation(e.target.value)}
                        placeholder="Ex: Gombe, Kinshasa"
                        className="w-full pl-10 pr-4 py-2 bg-black/20 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-white"
                      />
                    </div>
                  </div>
                </div>

                {/* ── Gestion Bailleur & Mandat de gestion (Habitation) ── */}
                {immoBranch === "habitation" && (
                  <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl space-y-3">
                    <div className="flex items-center justify-between border-b border-emerald-500/20 pb-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-emerald-300 flex items-center gap-1.5">
                        <Building size={14} className="text-emerald-400" />
                        Propriétaire / Bailleur & Mandat Agence (Optionnel)
                      </span>
                      <span className="text-[11px] text-gray-400">Pour rétrocession loyer & commissions</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-300">Nom du Bailleur / Proprio</label>
                        <input
                          type="text"
                          value={ownerName}
                          onChange={(e) => setOwnerName(e.target.value)}
                          placeholder="Ex: M. Jean Kasongo"
                          className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-300">Téléphone du Bailleur</label>
                        <input
                          type="text"
                          value={ownerPhone}
                          onChange={(e) => setOwnerPhone(e.target.value)}
                          placeholder="Ex: +243 81 234 5678"
                          className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-300">Commission Agence (%)</label>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={agencyCommissionRate}
                          onChange={(e) => setAgencyCommissionRate(e.target.value)}
                          placeholder="Ex: 10"
                          className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Spécifications Hôtelières (Hospitality) ── */}
                {immoBranch === "hotel" && (
                  <div className="p-4 bg-gradient-to-br from-amber-500/10 via-purple-500/5 to-transparent border border-amber-500/20 rounded-xl space-y-4">
                    <div className="flex items-center justify-between border-b border-white/10 pb-3">
                      <div className="flex items-center space-x-2 text-amber-400">
                        <Sparkles size={18} />
                        <span className="font-semibold text-sm">Paramètres Hôteliers & Standing</span>
                      </div>
                      <span className="text-xs px-2.5 py-1 bg-amber-500/20 text-amber-300 rounded-full font-medium">
                        Hospitality Pro
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-300">Classement / Standing</label>
                        <select 
                          value={hotelStars} 
                          onChange={(e) => setHotelStars(e.target.value)}
                          className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-amber-500 [&>option]:bg-[#140b2e]"
                        >
                          <option value="5">⭐⭐⭐⭐⭐ 5 Étoiles (Luxe)</option>
                          <option value="4">⭐⭐⭐⭐ 4 Étoiles (Standing)</option>
                          <option value="3">⭐⭐⭐ 3 Étoiles (Confort)</option>
                          <option value="2">⭐⭐ 2 Étoiles</option>
                          <option value="1">⭐ 1 Étoile</option>
                          <option value="boutique">✨ Hôtel Boutique</option>
                          <option value="guest_house">🏡 Guest House / Maison d'hôtes</option>
                          <option value="residence">🏢 Résidence Hôtelière</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-300 flex items-center gap-1">
                          <Clock size={12} className="text-amber-400" /> Heure Check-in (Arrivée)
                        </label>
                        <input
                          type="time"
                          value={checkInTime}
                          onChange={(e) => setCheckInTime(e.target.value)}
                          className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-amber-500"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-300 flex items-center gap-1">
                          <Clock size={12} className="text-amber-400" /> Heure Check-out (Départ)
                        </label>
                        <input
                          type="time"
                          value={checkOutTime}
                          onChange={(e) => setCheckOutTime(e.target.value)}
                          className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-amber-500"
                        />
                      </div>
                    </div>

                    {/* Commodités & Prestations Hôtelières */}
                    <div className="space-y-2 pt-2">
                      <label className="text-xs font-medium text-gray-300">Commodités & Services Disponibles</label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                        {[
                          { id: "generator", label: "Groupe électrogène 24/7", icon: Zap },
                          { id: "wifi", label: "Wifi Fibre gratuit", icon: Wifi },
                          { id: "ac", label: "Climatisation", icon: Sparkles },
                          { id: "pool", label: "Piscine", icon: Waves },
                          { id: "restaurant", label: "Restaurant & Bar", icon: Coffee },
                          { id: "parking", label: "Parking sécurisé", icon: Car },
                          { id: "security", label: "Gardiennage 24h", icon: Shield },
                          { id: "breakfast", label: "Petit-déjeuner inclus", icon: Coffee },
                          { id: "shuttle", label: "Navette aéroport", icon: Plane },
                        ].map(item => {
                          const IconComp = item.icon;
                          const isChecked = hotelAmenities.includes(item.id);
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => toggleAmenity(item.id)}
                              className={`flex items-center gap-2 p-2 rounded-lg border text-left transition-all ${
                                isChecked
                                  ? "bg-amber-500/20 border-amber-500/50 text-amber-200"
                                  : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10"
                              }`}
                            >
                              <IconComp size={14} className={isChecked ? "text-amber-400" : "text-gray-500"} />
                              <span className="truncate">{item.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300">Coordonnées GPS de la propriété (Requis pour l'itinéraire visiteur)</label>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                    <button
                      type="button"
                      onClick={handleGetLocation}
                      disabled={isFetchingGps}
                      className="px-4 py-2 bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 border border-blue-500/30 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                      <MapPin size={16} />
                      {isFetchingGps ? "Recherche en cours..." : "📍 Obtenir ma position actuelle"}
                    </button>
                    {propertyCoords && (
                      <span className="text-xs text-green-400 font-medium">
                        ✓ Position enregistrée ({propertyCoords.lat.toFixed(4)}, {propertyCoords.lng.toFixed(4)})
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400">Position qui sera partagée au visiteur pour générer son itinéraire depuis son point de départ.</p>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-300">Description détaillée</label>
                  <textarea
                    rows={4}
                    value={propertyDesc}
                    onChange={(e) => setPropertyDesc(e.target.value)}
                    placeholder="Décrivez les atouts de votre bien (nombre de pièces, salle de bain, commodités...)"
                    className="w-full px-4 py-2 bg-black/20 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-white"
                  ></textarea>
                </div>

                {/* Dynamic Structure Builder */}
                <div className="space-y-4 border-t border-white/10 pt-4">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-gray-300">
                      {immoBranch === "hotel" 
                        ? "Configuration des Étages & Chambres (Hôtellerie)" 
                        : "Structure du bâtiment (Niveaux, Appartements, Bureaux)"
                      }
                    </label>
                    <button 
                      type="button" 
                      onClick={handleAddLevel} 
                      className="text-xs bg-primary/20 hover:bg-primary/40 transition-colors text-primary-light px-3 py-1.5 rounded-lg flex items-center space-x-1"
                    >
                      <Plus size={14} /> <span>{immoBranch === "hotel" ? "Ajouter un étage d'hôtel" : "Ajouter un niveau"}</span>
                    </button>
                  </div>
                  
                  {levels.length === 0 && (
                     <p className="text-xs text-gray-500 italic">
                       {immoBranch === "hotel" 
                         ? "Aucun étage ou chambre configuré. (Optionnel si vous louez une suite unique)" 
                         : "Aucun niveau défini. (Optionnel)"
                       }
                     </p>
                  )}

                  {levels.map((level, lIndex) => (
                    <div key={level.id} className="p-4 bg-black/20 border border-white/10 rounded-xl space-y-4">
                      <div className="flex items-center gap-2">
                        <input 
                          type="text" 
                          value={level.name} 
                          onChange={(e) => handleUpdateLevelName(lIndex, e.target.value)} 
                          placeholder="Nom du niveau (ex: RDC, 1er Étage)" 
                          className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-primary" 
                        />
                        <button type="button" onClick={() => handleRemoveLevel(lIndex)} className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg">
                          <X size={16}/>
                        </button>
                      </div>
                      
                      <div className="pl-4 ml-2 border-l-2 border-white/10 space-y-3">
                         {level.units.map((unit, uIndex) => (
                             <div key={unit.id} className="flex flex-col sm:flex-row gap-2">
                                <input 
                                  type="text" 
                                  value={unit.name} 
                                  onChange={(e) => handleUpdateUnit(lIndex, uIndex, 'name', e.target.value)}
                                  placeholder="Nom (ex: Appt 1A, Bureau 1)"
                                  className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none"
                                />
                                <select 
                                  value={unit.type} 
                                  onChange={(e) => handleUpdateUnit(lIndex, uIndex, 'type', e.target.value)}
                                  className="w-full sm:w-36 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none [&>option]:bg-[#140b2e]"
                                >
                                  <option value="appartement">Appart. / Local</option>
                                  <option value="chambre">Chambre Hôtel</option>
                                  <option value="suite">Suite Hôtelière</option>
                                  <option value="apparthotel">Appart-Hôtel</option>
                                  <option value="bureau">Bureau</option>
                                  <option value="chaise">Poste/Chaise</option>
                                </select>
                                {unit.type !== 'appartement' && (
                                  <input 
                                    type="number" 
                                    value={unit.capacity} 
                                    onChange={(e) => handleUpdateUnit(lIndex, uIndex, 'capacity', parseInt(e.target.value) || 1)}
                                    title={unit.type === 'chambre' || unit.type === 'suite' ? "Nb personnes / couchages" : "Nombre de places/chaises"}
                                    placeholder="Capacité"
                                    className="w-full sm:w-20 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none"
                                  />
                                )}
                                <button type="button" onClick={() => handleRemoveUnit(lIndex, uIndex)} className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg flex items-center justify-center shrink-0">
                                  <X size={16}/>
                                </button>
                             </div>
                         ))}
                         <button 
                           type="button" 
                           onClick={() => handleAddUnit(lIndex)} 
                           className="text-xs text-gray-400 hover:text-white flex items-center space-x-1"
                         >
                           <Plus size={12} /> <span>Ajouter une sous-unité</span>
                         </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-4 flex justify-end space-x-3 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={isProcessing}
                    className="px-6 py-2 bg-primary hover:bg-primary-light text-white font-semibold rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center"
                  >
                    {isProcessing ? "Traitement..." : (editingId ? "Enregistrer les modifications" : (immoBranch === "hotel" ? "🏨 Publier l'offre hôtelière" : "🏠 Publier le bien immobilier"))}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Preview Property Modal */}
      <AnimatePresence>
        {previewProperty && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-3xl bg-[#140b2e] border border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] my-4"
            >
              <div className="flex items-center justify-between p-4 border-b border-white/10 shrink-0 bg-[#140b2e]">
                <h2 className="text-xl font-semibold text-white">Prévisualisation de l'annonce</h2>
                <button onClick={() => setPreviewProperty(null)} className="text-gray-400 hover:text-white transition-colors">
                  <X size={24} />
                </button>
              </div>

              <div className="p-6 space-y-6 overflow-y-auto scrollbar-hide">
                {/* Header Info */}
                <div className="flex flex-col md:flex-row gap-6">
                  {/* Image */}
                  <div className="w-full md:w-1/3 aspect-square rounded-xl overflow-hidden bg-white/5 border border-white/10 shrink-0">
                    {previewProperty.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={previewProperty.image} alt={getTitle(previewProperty.title)} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-500">
                        <Home size={48} />
                      </div>
                    )}
                  </div>
                  
                  {/* Details */}
                  <div className="flex-1 space-y-4">
                    <div>
                      <h3 className="text-2xl font-bold text-white">{getTitle(previewProperty.title)}</h3>
                      <p className="text-primary font-semibold text-xl mt-1">
                        {typeof previewProperty.price === "number" ? formatPrice(previewProperty.price) : previewProperty.price} {currency}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="bg-white/5 p-3 rounded-lg">
                        <span className="text-gray-400 block mb-1">Type</span>
                        <span className="text-white font-medium capitalize">{previewProperty.type || "Non défini"}</span>
                      </div>
                      <div className="bg-white/5 p-3 rounded-lg">
                        <span className="text-gray-400 block mb-1">Transaction</span>
                        <span className="text-white font-medium">{previewProperty.typeTransaction || "Vente"}</span>
                      </div>
                      <div className="bg-white/5 p-3 rounded-lg col-span-2 flex items-center gap-2">
                        <MapPin size={16} className="text-gray-400" />
                        <span className="text-white">{previewProperty.location || "-"}</span>
                      </div>
                      {previewProperty.ownerName && (
                        <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-lg col-span-2 text-xs">
                          <span className="text-emerald-400 font-bold block mb-1">Bailleur / Propriétaire Mandant :</span>
                          <span className="text-white font-medium">{previewProperty.ownerName}</span>
                          {previewProperty.ownerPhone && <span className="text-gray-300 ml-2">({previewProperty.ownerPhone})</span>}
                          {previewProperty.agencyCommissionRate !== undefined && (
                            <span className="text-emerald-300 ml-2 font-semibold">| Commission agence: {previewProperty.agencyCommissionRate}%</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <h4 className="text-lg font-semibold text-white mb-2">Description</h4>
                  <div className="bg-white/5 p-4 rounded-xl text-gray-300 text-sm whitespace-pre-wrap">
                    {previewProperty.description || "Aucune description fournie."}
                  </div>
                </div>

                {/* Structure (Levels/Units) */}
                {previewProperty.levels && previewProperty.levels.length > 0 && (
                  <div>
                    <h4 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                      <Building size={18} /> Structure du bâtiment
                    </h4>
                    <div className="space-y-3">
                      {previewProperty.levels.map((level: any) => (
                        <div key={level.id} className="bg-white/5 p-4 rounded-xl border border-white/10">
                          <h5 className="font-semibold text-white mb-3">{level.name}</h5>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {level.units && level.units.map((unit: any) => (
                              <div key={unit.id} className="flex items-center justify-between bg-black/20 p-2 rounded-lg text-sm">
                                <span className="text-gray-300">{unit.name}</span>
                                <span className="text-gray-400 text-xs px-2 py-1 bg-white/5 rounded">
                                  {unit.type} {unit.type !== 'appartement' && `(${unit.capacity} places)`}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Actions Footer */}
              <div className="flex items-center justify-end gap-3 p-4 border-t border-white/10 shrink-0 bg-[#140b2e]">
                <button
                  type="button"
                  onClick={() => setPreviewProperty(null)}
                  className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                >
                  Fermer
                </button>
                {isAdmin && previewProperty.status !== "Disponible" && (
                  <>
                    <button
                      onClick={() => {
                        handleRejectProperty(previewProperty.id);
                        setPreviewProperty(null);
                      }}
                      className="px-4 py-2 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white font-medium rounded-lg transition-colors flex items-center gap-2"
                    >
                      <XCircle size={18} /> Rejeter
                    </button>
                    <button
                      onClick={() => {
                        handleApproveProperty(previewProperty);
                        setPreviewProperty(null);
                      }}
                      className="px-6 py-2 bg-green-500 text-white font-medium rounded-lg hover:bg-green-600 transition-colors flex items-center gap-2"
                    >
                      <CheckCircle size={18} /> Approuver et Publier
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
