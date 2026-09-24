"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Package, Plus, X, Search, Edit2, Trash2, Filter, Settings, 
  MapPin, Clock, Tag, ShoppingBag, Truck, Image as ImageIcon, Bot, Send, AlertCircle, CheckCircle, XCircle, TrendingUp
} from "lucide-react";
import { useProductAiAssistant, handleImageUploadShared } from "@/hooks/useProductAiAssistant";
import AiAssistantChat from "@/modules/shared/components/shared/AiAssistantChat";
import ImageUploadArea from "@/modules/shared/components/shared/ImageUploadArea";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { getSupplierType } from "@/lib/permissions";
import { 
  collection, query, where, getDocs, addDoc, updateDoc, 
  deleteDoc, doc, serverTimestamp, orderBy, onSnapshot, limit 
} from "firebase/firestore";
import { useCurrency, CurrencyCode } from "@/context/CurrencyContext";
import { evaluateSupplierSubscription } from "@/lib/supplierSubscription";
import { Lock } from "lucide-react";

interface ProductManagerProps {
  isAdmin: boolean;
}

export default function ProductManager({ isAdmin }: ProductManagerProps) {
  const { user, userData } = useAuth();
  const activeSupplierId = userData?.parentSupplierId || user?.uid;
  const { formatPrice, currency, rates } = useCurrency();
  const [products, setProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const subscriptionInfo = evaluateSupplierSubscription(userData);

  // Form State
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [inputCurrency, setInputCurrency] = useState<CurrencyCode>("USD");
  const [productTitle, setProductTitle] = useState("");
  const [productBrand, setProductBrand] = useState("");
  const [productCategory, setProductCategory] = useState("");
  const [productPrice, setProductPrice] = useState("");
  const [productPurchasePrice, setProductPurchasePrice] = useState("");
  const [productStock, setProductStock] = useState("");
  const [productDesc, setProductDesc] = useState("");
  const [productSizes, setProductSizes] = useState<string[]>([]);
  const [productColors, setProductColors] = useState<string[]>([]);
  const [productOptions, setProductOptions] = useState<string[]>([]);  // Pour Saveurs : "sans piment", "épicé", etc.
  const [sizeInput, setSizeInput] = useState("");
  const [colorInput, setColorInput] = useState("");
  const [optionInput, setOptionInput] = useState("");

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
      if (autoFill.title) {
        if (typeof autoFill.title === 'string') {
          setProductTitle(autoFill.title);
        } else {
          setProductTitle(autoFill.title.fr || autoFill.title.en || autoFill.title.français || "");
        }
      }
      if (autoFill.brand) setProductBrand(autoFill.brand);
      if (autoFill.category) setProductCategory(autoFill.category);
      if (autoFill.price) setProductPrice(autoFill.price);
      if (autoFill.purchasePrice) setProductPurchasePrice(autoFill.purchasePrice);
      if (autoFill.stock) setProductStock(autoFill.stock);
      if (autoFill.description) setProductDesc(autoFill.description);
    },
    apiEndpoint: '/api/ai/product-assistant'
  });

  const [isProcessing, setIsProcessing] = useState(false);

  // Fetch products
  useEffect(() => {
    if (!user) return;
    setIsLoading(true);

    let unsubscribe = () => {};

    if (isAdmin) {
      // Admin: Fetch all products, real-time (capped to 100 recent)
      const q = query(collection(db, "products"), orderBy("createdAt", "desc"), limit(100));
      unsubscribe = onSnapshot(q, (snapshot) => {
        const fetchedProducts: any[] = [];
        snapshot.forEach((docSnap) => {
          fetchedProducts.push({ id: docSnap.id, ...docSnap.data() });
        });
        setProducts(fetchedProducts);
        setIsLoading(false);
      }, (error) => {
        console.error("Error fetching admin products:", error);
        setIsLoading(false);
      });
    } else {
      // Supplier: Fetch only their products, real-time with onSnapshot
      const q = query(collection(db, "products"), where("supplierId", "==", activeSupplierId), limit(100));
      unsubscribe = onSnapshot(q, (snapshot) => {
        const prods: any[] = [];
        snapshot.forEach(docSnap => prods.push({ id: docSnap.id, ...docSnap.data() }));
        prods.sort((a, b) => {
          const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0);
          const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0);
          return timeB - timeA;
        });
        setProducts(prods);
        setIsLoading(false);
      }, (error) => {
        console.error("Error fetching supplier products:", error);
        setIsLoading(false);
      });
    }

    return () => {
      unsubscribe();
    };
  }, [user, isAdmin, activeSupplierId]);

  const resetForm = () => {
    setEditingId(null);
    setInputCurrency("USD");
    setProductTitle("");
    setProductBrand("");
    setProductCategory("");
    setProductPrice("");
    setProductPurchasePrice("");
    setProductStock("");
    setProductDesc("");
    setProductSizes([]);
    setProductColors([]);
    setProductOptions([]);
    setSizeInput("");
    setColorInput("");
    setOptionInput("");
    setImagePreview(null);
    setImageFile(null);
    resetChat();
  };

  const openAddModal = () => {
    if (!isAdmin && subscriptionInfo.isBlocked) {
      alert("Votre compte est actuellement suspendu pour impayé de dépôt mensuel. Vous ne pouvez pas ajouter de nouveaux produits tant que votre compte n'est pas régularisé dans l'espace Finance.");
      return;
    }
    resetForm();
    const activeRayon = typeof window !== "undefined" ? localStorage.getItem("activeSupplierRayon") : null;
    if (activeRayon && (activeRayon === "mode" || activeRayon === "connect" || activeRayon === "immo")) {
      setProductCategory(activeRayon);
    } else if (Array.isArray(userData?.assignedRayons) && userData.assignedRayons.length > 0) {
      setProductCategory(userData.assignedRayons[0]);
    } else if (userData) {
      const defaultType = getSupplierType(userData);
      setProductCategory(defaultType);
    }
    setIsModalOpen(true);
  };

  const openEditModal = (product: any) => {
    setEditingId(product.id);
    
    // Handle bilingual or string titles
    if (typeof product.title === 'object' && product.title !== null) {
      setProductTitle(product.title.fr || product.title.en || "");
    } else {
      setProductTitle(product.title as string || "");
    }
    
    setProductBrand(product.brand || "");
    if (product.inputCurrency) {
      setInputCurrency(product.inputCurrency);
      setProductPrice(product.originalInputPrice !== undefined ? String(product.originalInputPrice) : (product.price?.toString() || ""));
      setProductPurchasePrice(product.originalPurchasePrice !== undefined ? String(product.originalPurchasePrice) : (product.purchasePrice?.toString() || ""));
    } else {
      setInputCurrency("USD");
      setProductPrice(product.price?.toString() || "");
      setProductPurchasePrice(product.purchasePrice?.toString() || "");
    }
    setProductStock(product.stock?.toString() || "");
    setProductCategory(product.category || "");
    setProductDesc(product.description || "");
    setProductSizes(Array.isArray(product.sizes) ? product.sizes : []);
    setProductColors(Array.isArray(product.colors) ? product.colors : []);
    setProductOptions(Array.isArray(product.options) ? product.options : []);
    setImagePreview(product.image || "");
    setIsModalOpen(true);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleImageUploadShared(
      e,
      setImageFile,
      setImagePreview,
      analyzeImage,
      "Voici la photo de mon produit. Peux-tu l'analyser et m'aider à créer une bonne description ? Donne-moi aussi un titre bilingue (fr, en)."
    );
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsProcessing(true);

    const normalizedCategory = (() => {
      const c = (productCategory || "").toLowerCase().trim();
      if (c.includes("mode") || c.includes("vetement") || c.includes("vêtement") || c.includes("habit") || c.includes("chaussure") || c.includes("accessoire")) return "mode";
      if (c.includes("connect") || c.includes("electr") || c.includes("électr") || c.includes("tech") || c.includes("telecom") || c.includes("télécom") || c.includes("phone")) return "connect";
      if (c.includes("saveur") || c.includes("resto") || c.includes("cuisine") || c.includes("ustensil") || c.includes("repas") || c.includes("food") || c.includes("plat")) return "saveurs";
      if (c.includes("immo")) return "immo";
      return c || "general";
    })();

    const rawPrice = parseFloat(productPrice);
    const rawPurchasePrice = parseFloat(productPurchasePrice);
    const parsedStock = parseInt(productStock || "0", 10);

    if (!productTitle.trim()) {
      alert("Veuillez renseigner un titre pour le produit.");
      setIsProcessing(false);
      return;
    }

    // Conversion dynamique vers la devise de base USD ($) selon le taux actif de la plateforme
    const fcRate = rates?.FC || 2850;
    const eurRate = rates?.EUR || 0.92;
    let canonicalPrice = 0;
    let canonicalPurchasePrice = 0;

    if (!isNaN(rawPrice) && rawPrice > 0) {
      if (inputCurrency === "FC") {
        canonicalPrice = Number((rawPrice / fcRate).toFixed(2));
      } else if (inputCurrency === "EUR") {
        canonicalPrice = Number((rawPrice / eurRate).toFixed(2));
      } else {
        canonicalPrice = rawPrice;
      }
    }

    if (!isNaN(rawPurchasePrice) && rawPurchasePrice > 0) {
      if (inputCurrency === "FC") {
        canonicalPurchasePrice = Number((rawPurchasePrice / fcRate).toFixed(2));
      } else if (inputCurrency === "EUR") {
        canonicalPurchasePrice = Number((rawPurchasePrice / eurRate).toFixed(2));
      } else {
        canonicalPurchasePrice = rawPurchasePrice;
      }
    }

    const productData: any = {
      title: { fr: productTitle.trim(), en: productTitle.trim() },
      category: normalizedCategory,
      rayon: normalizedCategory,
      price: canonicalPrice,
      purchasePrice: canonicalPurchasePrice,
      inputCurrency: inputCurrency,
      originalInputPrice: isNaN(rawPrice) ? 0 : rawPrice,
      originalPurchasePrice: isNaN(rawPurchasePrice) ? 0 : rawPurchasePrice,
      appliedExchangeRate: rates?.[inputCurrency] || 1,
      stock: isNaN(parsedStock) ? 0 : parsedStock,
      description: productDesc.trim(),
      image: imagePreview || "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=400",
      sizes: productSizes.filter(Boolean),
      colors: productColors.filter(Boolean),
      options: productOptions.filter(Boolean),
    };

    if (productBrand.trim()) {
      productData.brand = productBrand.trim();
    }

    if (!isAdmin && subscriptionInfo.isBlocked) {
      alert("Action refusée : Votre compte est suspendu pour impayé. Veuillez régulariser votre dépôt.");
      setIsProcessing(false);
      return;
    }

    try {
      if (editingId) {
        await updateDoc(doc(db, "products", editingId), {
          ...productData,
          updatedAt: serverTimestamp(),
        });
      } else {
        const isOfficialStore = isAdmin || Boolean(userData?.isOfficialAdminStore || userData?.isAdminSupplier || user.email === "danielkiboko218@gmail.com");
        await addDoc(collection(db, "products"), {
          ...productData,
          supplierId: activeSupplierId || user.uid,
          supplierName: isOfficialStore 
            ? (userData?.displayName || "Rayons Officiel (Admin)") 
            : (userData?.displayName || userData?.name || "Fournisseur"),
          supplierEmail: user.email || "",
          supplierRole: isOfficialStore ? "ADMIN" : (userData?.role || "SUPPLIER"),
          isAdminProduct: isOfficialStore,
          isOfficialRayons: isOfficialStore,
          isOfficialAdminStore: isOfficialStore,
          isVerified: isOfficialStore, // Vérifié d'office si Admin ou Boutique Officielle, soumis aux votes clients si Fournisseur standard
          ratingsCount: isOfficialStore ? 1 : 0,
          averageRating: isOfficialStore ? 5.0 : 0,
          status: isOfficialStore ? "Disponible" : "pending_approval",
          createdAt: serverTimestamp(),
        });

        if (!isOfficialStore) {
          // Add notification for admins
          try {
            await addDoc(collection(db, "inapp_notifications"), {
              type: "admin_alert",
              title: "Nouveau produit à valider",
              message: `Le fournisseur a ajouté un nouveau produit: ${productTitle}. Veuillez l'examiner.`,
              time: Date.now(),
              link: "/admin/products",
              read: false,
              createdAt: serverTimestamp()
            });
          } catch (notifError) {
            console.warn("Error notifying admins:", notifError);
          }
        }
      }
      setIsModalOpen(false);
      resetForm();
    } catch (error: any) {
      console.error("Erreur lors de la sauvegarde du produit", error);
      alert("Erreur lors de la sauvegarde : " + (error?.message || "Vérifiez vos permissions réseau."));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (confirm("Voulez-vous vraiment supprimer ce produit ? Cette action est irréversible.")) {
      try {
        await deleteDoc(doc(db, "products", id));
        if (!isAdmin) {
          setProducts(products.filter(p => p.id !== id));
        }
      } catch (error) {
        console.error("Error deleting product", error);
        alert("Erreur lors de la suppression.");
      }
    }
  };

  const handleApproveProduct = async (id: string) => {
    if (!isAdmin) return;
    if (confirm("Approuver et publier ce produit ?")) {
      try {
        const prod = products.find(p => p.id === id);
        await updateDoc(doc(db, "products", id), {
          status: "Disponible",
          isAdminProduct: false,
          isOfficialRayons: false,
          approvedByAdmin: true,
          approvedAt: serverTimestamp(),
        });
        if (prod && prod.supplierId) {
          await addDoc(collection(db, "inapp_notifications"), {
            supplierId: prod.supplierId,
            type: "product",
            title: "Produit Publié",
            message: `Votre produit "${prod.name?.fr || prod.name || 'Produit'}" a été validé et est en ligne !`,
            time: Date.now(),
            link: "/supplier/products",
            read: false,
            createdAt: serverTimestamp()
          });
        }
      } catch (error) {
        console.error("Error approving product", error);
        alert("Erreur lors de l'approbation.");
      }
    }
  };

  const handleRejectProduct = async (id: string) => {
    if (!isAdmin) return;
    const reason = prompt("Motif de rejet (sera visible par le fournisseur) :");
    if (reason !== null) {
      try {
        const prod = products.find(p => p.id === id);
        await updateDoc(doc(db, "products", id), {
          status: "REJECTED",
          rejectionReason: reason
        });
        if (prod && prod.supplierId) {
          await addDoc(collection(db, "inapp_notifications"), {
            supplierId: prod.supplierId,
            type: "product",
            title: "Produit Rejeté",
            message: `Votre produit "${prod.name?.fr || prod.name || 'Produit'}" a été rejeté. Motif : ${reason}`,
            time: Date.now(),
            link: "/supplier/products",
            read: false,
            createdAt: serverTimestamp()
          });
        }
      } catch (error) {
        console.error("Error rejecting product", error);
        alert("Erreur lors du rejet.");
      }
    }
  };

  const handleCleanupOldProducts = async () => {
    if (!isAdmin) return;
    if (confirm("ATTENTION : Cela va supprimer TOUS les produits dont le titre est dans l'ancien format (texte simple au lieu de bilingue). Continuer ?")) {
      setIsProcessing(true);
      try {
        let deletedCount = 0;
        for (const product of products) {
          if (typeof product.title === "string") {
            await deleteDoc(doc(db, "products", product.id));
            deletedCount++;
          }
        }
        alert(`${deletedCount} ancien(s) produit(s) supprimé(s) avec succès !`);
      } catch (error) {
        console.error("Erreur lors du nettoyage", error);
        alert("Erreur lors du nettoyage.");
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const getTitle = (titleObj: Record<string, string> | string | null | undefined) => {
    if (typeof titleObj === 'object' && titleObj !== null) {
      return titleObj.fr || titleObj.en || "Sans titre";
    }
    return titleObj || "Sans titre";
  };

  const [selectedRayonFilter, setSelectedRayonFilter] = useState<string>("all");
  const assignedRayons = (userData?.assignedRayons as string[]) || [];

  const getRayonBadge = (p: any) => {
    const cat = (p.category || "").toLowerCase();
    const ray = (p.rayon || "").toLowerCase();
    if (cat === "mode" || ray === "mode" || cat.includes("mode") || cat.includes("vetement") || cat.includes("habit") || cat.includes("chaussure")) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-purple-500/15 text-purple-400 border border-purple-500/30 uppercase tracking-wider">
          <span>👗</span> Mode
        </span>
      );
    }
    if (cat === "connect" || ray === "connect" || cat.includes("connect") || cat.includes("electr") || cat.includes("tech") || cat.includes("telecom")) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30 uppercase tracking-wider">
          <span>📡</span> Connect
        </span>
      );
    }
    if (cat === "immo" || ray === "immo") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 uppercase tracking-wider">
          <span>🏢</span> Immo
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-gray-500/15 text-gray-300 uppercase tracking-wider">
        {p.category || "Général"}
      </span>
    );
  };

  const filteredProducts = products.filter(p => {
    const title = getTitle(p.title).toLowerCase();
    const brand = (p.brand || "").toLowerCase();
    const matchesSearch = title.includes(search.toLowerCase()) || brand.includes(search.toLowerCase());
    if (!matchesSearch) return false;

    if (selectedRayonFilter === "all") return true;

    if (selectedRayonFilter === "low_stock") {
      return (Number(p.stock) || 0) < 10;
    }

    const cat = (p.category || "").toLowerCase();
    const ray = (p.rayon || "").toLowerCase();

    if (selectedRayonFilter === "mode") {
      return cat === "mode" || ray === "mode" || cat.includes("mode") || cat.includes("vetement") || cat.includes("habit");
    }
    if (selectedRayonFilter === "connect") {
      return cat === "connect" || ray === "connect" || cat.includes("connect") || cat.includes("electr") || cat.includes("tech");
    }
    if (selectedRayonFilter === "saveurs") {
      return cat === "saveurs" || ray === "saveurs" || cat.includes("saveur") || cat.includes("resto") || cat.includes("cuisine") || cat.includes("ustensil") || cat.includes("food");
    }
    if (selectedRayonFilter === "immo") {
      return cat === "immo" || ray === "immo";
    }
    return cat === selectedRayonFilter;
  });

  const lowStockCount = products.filter(p => (Number(p.stock) || 0) < 10).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            {isAdmin ? "Gestion des Produits" : "Mes Produits & Logistique"}
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            {isAdmin ? "Gérez le catalogue complet de Rayons." : "Gérez votre catalogue d'articles, vos marques et le suivi logistique des stocks."}
          </p>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <button
              onClick={handleCleanupOldProducts}
              disabled={isProcessing}
              className="bg-red-600/20 text-red-500 px-5 py-2.5 rounded-xl text-sm font-semibold flex items-center hover:bg-red-600 hover:text-white transition-colors shadow-sm disabled:opacity-50 border border-red-600/30"
            >
              <Trash2 size={18} className="mr-2" /> Nettoyer les anciens produits
            </button>
          )}
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
            {!isAdmin && subscriptionInfo.isBlocked ? "Ajout verrouillé (Impayé)" : "Ajouter un produit"}
          </button>
        </div>
      </div>

      {/* Quick Stats (Supplier Only or Admin) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-400">Total Produits</p>
            <p className="text-2xl font-bold text-white mt-1">{products.length}</p>
          </div>
          <div className="p-3 bg-purple-400/10 text-purple-400 rounded-lg">
            <Package size={20} />
          </div>
        </div>
        {!isAdmin && (
          <div className={`border rounded-xl p-4 flex items-center justify-between transition-all ${
            lowStockCount > 0 
              ? "bg-red-500/15 border-red-500/40 text-red-200 shadow-lg shadow-red-950/20" 
              : "bg-white/5 border-white/10"
          }`}>
            <div>
              <p className="text-sm text-gray-300 font-medium">Rupture & Stock Faible (&lt; 10 pcs)</p>
              <p className={`text-2xl font-black mt-1 ${lowStockCount > 0 ? "text-red-400" : "text-white"}`}>
                {lowStockCount}
              </p>
              {lowStockCount > 0 && (
                <span className="text-[11px] text-red-300 font-semibold">⚠️ Signal rouge actif</span>
              )}
            </div>
            <div className={`p-3 rounded-xl ${lowStockCount > 0 ? "bg-red-500/25 text-red-400 animate-pulse" : "bg-orange-400/10 text-orange-400"}`}>
              <AlertCircle size={22} />
            </div>
          </div>
        )}
      </div>

      {/* Signal Rouge : Bannière Logistique Rupture / Stock critique (< 10 pièces) */}
      {!isAdmin && lowStockCount > 0 && (
        <div className="bg-gradient-to-r from-red-950/60 via-red-900/30 to-red-950/60 border-2 border-red-500/50 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl shadow-red-950/40">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-red-500 text-white rounded-xl shadow-lg shadow-red-500/50 shrink-0">
              <AlertCircle size={24} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping"></span>
                <h3 className="text-base font-black text-white tracking-wide uppercase">
                  Signal Rouge Logistique : {lowStockCount} Produit(s) en Rupture ou Moins de 10 Pièces
                </h3>
              </div>
              <p className="text-xs text-red-200/90 mt-1">
                Le seuil de sécurité logistique est fixé à 10 pièces en magasin. Dès qu'un article passe sous 10 unités, ce signal rouge vous avertit d'un réapprovisionnement urgent pour éviter la rupture complète.
              </p>
            </div>
          </div>
          <button
            onClick={() => setSelectedRayonFilter("low_stock")}
            className="px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shrink-0 self-start sm:self-center uppercase tracking-wider"
          >
            Filtrer les stocks critiques ({lowStockCount})
          </button>
        </div>
      )}

      <div className="bg-white/5 border border-white/10 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-white/10 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
          <div className="relative max-w-sm w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Rechercher par titre ou marque..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-black/20 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-white text-sm transition-all"
            />
          </div>

          {/* Multi-Rayon Filter Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto">
            <button
              onClick={() => setSelectedRayonFilter("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 ${
                selectedRayonFilter === "all"
                  ? "bg-white text-gray-950 shadow-sm"
                  : "bg-white/5 text-gray-400 hover:text-white hover:bg-white/10"
              }`}
            >
              Tous ({products.length})
            </button>
            
            {!isAdmin && (
              <button
                onClick={() => setSelectedRayonFilter("low_stock")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 flex items-center gap-1.5 ${
                  selectedRayonFilter === "low_stock"
                    ? "bg-red-600 text-white shadow-sm font-bold"
                    : lowStockCount > 0
                    ? "bg-red-500/20 text-red-400 border border-red-500/40 hover:bg-red-500/30"
                    : "bg-white/5 text-gray-400 hover:text-white hover:bg-white/10"
                }`}
              >
                <span>🔴</span> Stock Critique (&lt; 10) {lowStockCount > 0 ? `(${lowStockCount})` : ''}
              </button>
            )}

            {(isAdmin || assignedRayons.includes("mode") || assignedRayons.length === 0) && (
              <button
                onClick={() => setSelectedRayonFilter("mode")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 flex items-center gap-1.5 ${
                  selectedRayonFilter === "mode"
                    ? "bg-purple-600 text-white shadow-sm"
                    : "bg-white/5 text-gray-400 hover:text-white hover:bg-white/10"
                }`}
              >
                <span>👗</span> Rayon Mode
              </button>
            )}

            {(isAdmin || assignedRayons.includes("connect") || assignedRayons.length === 0) && (
              <button
                onClick={() => setSelectedRayonFilter("connect")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 flex items-center gap-1.5 ${
                  selectedRayonFilter === "connect"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-white/5 text-gray-400 hover:text-white hover:bg-white/10"
                }`}
              >
                <span>📡</span> Rayon Connect
              </button>
            )}

            {(isAdmin || assignedRayons.includes("saveurs") || assignedRayons.length === 0) && (
              <button
                onClick={() => setSelectedRayonFilter("saveurs")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 flex items-center gap-1.5 ${
                  selectedRayonFilter === "saveurs"
                    ? "bg-[#FF6B35] text-white shadow-sm"
                    : "bg-white/5 text-gray-400 hover:text-[#FF6B35] hover:bg-[#FF6B35]/10"
                }`}
              >
                <span>🍽️</span> Rayon Saveurs
              </button>
            )}

            {(isAdmin || assignedRayons.includes("immo")) && (
              <button
                onClick={() => setSelectedRayonFilter("immo")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 flex items-center gap-1.5 ${
                  selectedRayonFilter === "immo"
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "bg-white/5 text-gray-400 hover:text-white hover:bg-white/10"
                }`}
              >
                <span>🏢</span> Rayon Immo
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/5 text-xs uppercase tracking-wider text-gray-400 font-semibold">
                <th className="p-4 w-16">Image</th>
                <th className="p-4">Produit & Marque</th>
                <th className="p-4">Rayon</th>
                <th className="p-4">Stock (Logistique)</th>
                <th className="p-4">Prix</th>
                <th className="p-4">Statut</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="text-sm text-gray-300">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-gray-500 font-medium">Chargement...</td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-gray-500 font-medium">
                    Aucun produit trouvé.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((product) => {
                  const stockNum = Number(product.stock ?? 0);
                  const isLowStock = stockNum < 10;
                  const isOutOfStock = stockNum <= 0;

                  return (
                    <tr 
                      key={product.id} 
                      className={`border-b border-white/5 hover:bg-white/5 transition-colors group ${
                        isLowStock ? "bg-red-500/[0.04] border-l-4 border-l-red-500" : ""
                      }`}
                    >
                      <td className="p-4">
                        <div className="w-12 h-12 bg-white/5 rounded-lg overflow-hidden border border-white/10 flex items-center justify-center shrink-0">
                          {product.image ? (
                            <img src={product.image} alt="produit" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                          ) : (
                            <Package size={16} className="text-primary-light" />
                          )}
                        </div>
                      </td>
                      <td className="p-4 font-semibold text-white">
                        <div className="flex flex-col">
                          <span className="line-clamp-1">{getTitle(product.title)}</span>
                          {product.brand ? (
                            <span className="text-[11px] font-bold text-gray-400 tracking-wider uppercase mt-0.5">
                              🏷️ {product.brand}
                            </span>
                          ) : (
                            <span className="text-[10px] text-gray-500 italic mt-0.5">Marque standard</span>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        {getRayonBadge(product)}
                      </td>
                      <td className="p-4">
                        {isOutOfStock ? (
                          <div className="flex flex-col gap-1">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-black bg-red-500/25 text-red-300 border border-red-500/50 shadow-sm animate-pulse">
                              <span className="w-2 h-2 rounded-full bg-red-500"></span>
                              Rupture Totale (0 pc)
                            </span>
                            <span className="text-[10px] text-red-400 font-bold uppercase tracking-wider">
                              Réassort urgent requis
                            </span>
                          </div>
                        ) : isLowStock ? (
                          <div className="flex flex-col gap-1">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-black bg-red-500/20 text-red-400 border border-red-500/40 shadow-sm animate-pulse">
                              <span className="w-2 h-2 rounded-full bg-red-500"></span>
                              Moins de 10 pcs ({stockNum} rest.)
                            </span>
                            <span className="text-[10px] text-red-300/80 font-semibold">
                              Signal rouge (&lt; 10 pcs)
                            </span>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                            {stockNum} pièces
                          </span>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-white text-sm">{formatPrice(product.price)}</span>
                          {product.purchasePrice !== undefined && Number(product.purchasePrice) > 0 ? (
                            <div className="flex flex-col text-[11px] mt-0.5 space-y-0.5">
                              <span className="text-gray-400">Capital: {formatPrice(product.purchasePrice)}</span>
                              <span className={Number(product.price) - Number(product.purchasePrice) >= 0 ? "text-emerald-400 font-semibold" : "text-red-400 font-semibold"}>
                                Intérêt: {Number(product.price) - Number(product.purchasePrice) >= 0 ? "+" : ""}{formatPrice(Number(product.price) - Number(product.purchasePrice))}
                              </span>
                            </div>
                          ) : (
                            <span className="text-[10px] text-gray-500 italic mt-0.5">Capital non renseigné</span>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        {product.status === "pending_approval" || product.status === "PENDING_APPROVAL" ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-orange-500/10 text-orange-500 uppercase tracking-wider">
                            En attente
                          </span>
                        ) : product.status === "published" || product.status === "Disponible" ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-green-500/10 text-green-500 uppercase tracking-wider">
                            Publié
                          </span>
                        ) : product.status === "REJECTED" ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-red-500/10 text-red-500 uppercase tracking-wider">
                            Rejeté
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-white/10 text-gray-300 uppercase tracking-wider">
                            {product.status || "Brouillon"}
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-right whitespace-nowrap">
                        {isAdmin && (product.status !== "published" && product.status !== "Disponible") && (
                          <>
                            <button 
                              onClick={() => handleApproveProduct(product.id)}
                              title="Approuver et Publier"
                              className="inline-flex p-2 bg-white/5 text-orange-500 hover:text-white rounded-lg hover:bg-green-500 transition-colors border border-transparent hover:border-green-500 mr-2"
                            >
                              <CheckCircle size={18} />
                            </button>
                            <button 
                              onClick={() => handleRejectProduct(product.id)}
                              title="Rejeter"
                              className="inline-flex p-2 bg-white/5 text-red-500 hover:text-white rounded-lg hover:bg-red-500 transition-colors border border-transparent hover:border-red-500 mr-2"
                            >
                              <XCircle size={18} />
                            </button>
                          </>
                        )}
                        <button 
                          onClick={() => openEditModal(product)}
                          className="inline-flex p-2 bg-white/5 text-gray-400 hover:text-white rounded-lg hover:bg-blue-600 transition-colors border border-transparent hover:border-blue-600 mr-2"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button 
                          onClick={() => handleDeleteProduct(product.id)}
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

      {/* Create / Edit Product Modal */}
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
                <h2 className="text-xl font-semibold text-white">
                  {editingId ? "Modifier le produit" : "Ajouter un produit"}
                </h2>
                <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white transition-colors">
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleSaveProduct} className="p-4 space-y-5 overflow-y-auto scrollbar-hide">
                
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

                {/* AI Chat Assistant */}
                {imageFile && (
                  <AiAssistantChat 
                    title="Assistant IA Rayon"
                    chatMessages={chatMessages}
                    chatInput={chatInput}
                    setChatInput={setChatInput}
                    isAiLoading={isAiLoading}
                    handleSendMessage={handleSendMessage}
                  />
                )}

                {/* Form Fields: Titre & Marque */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-300">Titre du produit</label>
                    <input
                      type="text"
                      required
                      value={productTitle}
                      onChange={(e) => setProductTitle(e.target.value)}
                      placeholder="Ex: Routeur Starlink Gen 3"
                      className="w-full px-4 py-2 bg-black/20 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-300">Marque / Fabricant</label>
                    <input
                      type="text"
                      value={productBrand}
                      onChange={(e) => setProductBrand(e.target.value)}
                      placeholder="Ex: Starlink, Apple, Nike..."
                      className="w-full px-4 py-2 bg-black/20 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-white"
                    />
                  </div>
                </div>

                {/* Sélecteur de Devise & Taux de Change pour la Soumission */}
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
                        Indiquez vos prix dans la devise de votre choix. Le catalogue client s'ajustera automatiquement en direct.
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
                    <span>Taux plateforme actif : <strong className="text-[#C7D300]">1 $ USD = {(rates?.FC || 2850).toLocaleString("fr-FR")} FC</strong> | <strong className="text-[#C7D300]">1 $ USD = {rates?.EUR || 0.92} €</strong></span>
                    {inputCurrency !== "USD" && (
                      <span className="text-amber-400 font-medium">Conversion automatique vers USD ($) à la soumission</span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-300">
                      Prix d'achat (Capital : {inputCurrency})
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={productPurchasePrice}
                      onChange={(e) => setProductPurchasePrice(e.target.value)}
                      placeholder={inputCurrency === "FC" ? "Ex: 28500" : inputCurrency === "EUR" ? "Ex: 45.00" : "Ex: 120.00"}
                      className="w-full px-4 py-2 bg-black/20 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C7D300] text-white"
                    />
                    <div className="text-[11px] text-gray-400 min-h-[16px]">
                      {productPurchasePrice && !isNaN(parseFloat(productPurchasePrice)) ? (
                        inputCurrency === "FC" ? (
                          <span className="text-[#C7D300]">≈ ${(parseFloat(productPurchasePrice) / (rates?.FC || 2850)).toFixed(2)} USD</span>
                        ) : inputCurrency === "USD" ? (
                          <span className="text-[#C7D300]">≈ {Math.round(parseFloat(productPurchasePrice) * (rates?.FC || 2850)).toLocaleString("fr-FR")} FC</span>
                        ) : (
                          <span className="text-[#C7D300]">≈ ${(parseFloat(productPurchasePrice) / (rates?.EUR || 0.92)).toFixed(2)} USD</span>
                        )
                      ) : (
                        <span>Capital investi / pièce</span>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-300">
                      Prix de vente (Client : {inputCurrency})
                    </label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={productPrice}
                      onChange={(e) => setProductPrice(e.target.value)}
                      placeholder={inputCurrency === "FC" ? "Ex: 57000" : inputCurrency === "EUR" ? "Ex: 75.00" : "Ex: 199.99"}
                      className="w-full px-4 py-2 bg-black/20 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C7D300] text-white"
                    />
                    <div className="text-[11px] text-gray-400 min-h-[16px]">
                      {productPrice && !isNaN(parseFloat(productPrice)) ? (
                        inputCurrency === "FC" ? (
                          <span className="text-[#C7D300] font-semibold">≈ ${(parseFloat(productPrice) / (rates?.FC || 2850)).toFixed(2)} USD</span>
                        ) : inputCurrency === "USD" ? (
                          <span className="text-[#C7D300] font-semibold">≈ {Math.round(parseFloat(productPrice) * (rates?.FC || 2850)).toLocaleString("fr-FR")} FC</span>
                        ) : (
                          <span className="text-[#C7D300] font-semibold">≈ ${(parseFloat(productPrice) / (rates?.EUR || 0.92)).toFixed(2)} USD</span>
                        )
                      ) : (
                        <span>Prix public en magasin</span>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-gray-300">Quantité stock</label>
                      {parseInt(productStock || "0") < 10 && (
                        <span className="text-[11px] font-bold text-red-400 flex items-center gap-1 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20">
                          <AlertCircle size={12} />
                          {parseInt(productStock || "0") <= 0 ? "Rupture" : "< 10 pcs"}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <button 
                        type="button" 
                        onClick={() => setProductStock(String(Math.max(0, parseInt(productStock || "0") - 1)))}
                        className="p-2 bg-black/20 border border-white/10 rounded-lg hover:bg-white/10 transition-colors text-white"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        required
                        min="0"
                        value={productStock}
                        onChange={(e) => setProductStock(e.target.value)}
                        placeholder="0"
                        className="w-full px-4 py-2 bg-black/20 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-white text-center"
                      />
                      <button 
                        type="button" 
                        onClick={() => setProductStock(String(parseInt(productStock || "0") + 1))}
                        className="p-2 bg-black/20 border border-white/10 rounded-lg hover:bg-white/10 transition-colors text-white"
                      >
                        +
                      </button>
                    </div>
                    {parseInt(productStock || "0") < 10 && (
                      <p className="text-[10px] text-red-400 font-medium mt-1">
                        ⚠️ Moins de 10 pièces : alerte rouge activée.
                      </p>
                    )}
                  </div>
                </div>

                {/* Calculateur de rentabilité & Comptabilité automatique */}
                {parseFloat(productPrice) > 0 && parseFloat(productPurchasePrice) > 0 && (
                  <div className={`p-3 rounded-xl border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                    parseFloat(productPrice) >= parseFloat(productPurchasePrice)
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                      : "bg-red-500/10 border-red-500/30 text-red-300"
                  }`}>
                    <div className="flex items-center gap-2">
                      <TrendingUp size={16} className={parseFloat(productPrice) >= parseFloat(productPurchasePrice) ? "text-emerald-400" : "text-red-400"} />
                      <span>
                        <strong>Marge brute (Intérêt net) :</strong>{" "}
                        {(parseFloat(productPrice) - parseFloat(productPurchasePrice)).toFixed(2)} {currency}{" "}
                        ({(((parseFloat(productPrice) - parseFloat(productPurchasePrice)) / parseFloat(productPrice)) * 100).toFixed(1)}%)
                      </span>
                    </div>
                    <span className="text-gray-300">
                      <strong>Capital investi :</strong> {parseFloat(productPurchasePrice).toFixed(2)} {currency} / unité
                    </span>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-300">Rayon / Catégorie de publication</label>
                  <select required value={productCategory} onChange={(e) => setProductCategory(e.target.value)} className="w-full px-4 py-2.5 bg-black/20 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-white appearance-none text-sm font-medium">
                    <option className="bg-[#1a1a1a]" value="">Sélectionner un rayon</option>
                    <option className="bg-[#1a1a1a]" value="mode">👗 Rayon Mode (Vêtements, Chaussures & Accessoires)</option>
                    <option className="bg-[#1a1a1a]" value="connect">📡 Rayon Connect (Électronique, Starlink, Télécom)</option>
                    <option className="bg-[#1a1a1a]" value="saveurs">🍽️ Rayon Saveurs (Restaurants, Plats de chef & Ustensiles)</option>
                    <option className="bg-[#1a1a1a]" value="immo">🏢 Rayon Immo (Immobilier & Résidences)</option>
                    <option className="bg-[#1a1a1a]" value="general">📦 Général (Divers)</option>
                  </select>
                </div>

                {/* ── Variantes : Tailles & Couleurs (Mode/Connect) ou Options (Saveurs) ── */}
                {(productCategory === "mode" || productCategory === "connect") && (
                  <div className="space-y-3 p-4 bg-white/5 rounded-xl border border-white/10">
                    <p className="text-sm font-semibold text-white">Variantes disponibles</p>
                    {/* Tailles */}
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-400">Tailles (ex: XS, S, M, L, XL, 42, 44...)</label>
                      <div className="flex gap-2">
                        <input
                          type="text" value={sizeInput} onChange={e => setSizeInput(e.target.value)}
                          onKeyDown={e => { if ((e.key === 'Enter' || e.key === ',') && sizeInput.trim()) { e.preventDefault(); setProductSizes(s => [...new Set([...s, sizeInput.trim().toUpperCase()])]) ; setSizeInput(''); } }}
                          placeholder="Taper une taille + Entrée"
                          className="flex-1 px-3 py-1.5 bg-black/20 border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                        <button type="button" onClick={() => { if (sizeInput.trim()) { setProductSizes(s => [...new Set([...s, sizeInput.trim().toUpperCase()])]); setSizeInput(''); } }}
                          className="px-3 py-1.5 bg-primary/20 hover:bg-primary/30 text-white rounded-lg text-xs font-bold transition-all">+</button>
                      </div>
                      {productSizes.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {productSizes.map(s => (
                            <span key={s} className="flex items-center gap-1 px-2 py-0.5 bg-white/10 text-white text-xs rounded-md font-medium">
                              {s}
                              <button type="button" onClick={() => setProductSizes(prev => prev.filter(x => x !== s))} className="text-gray-400 hover:text-red-400 transition-colors">×</button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    {/* Couleurs */}
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-400">Couleurs (ex: Noir, Blanc, Rouge...)</label>
                      <div className="flex gap-2">
                        <input
                          type="text" value={colorInput} onChange={e => setColorInput(e.target.value)}
                          onKeyDown={e => { if ((e.key === 'Enter' || e.key === ',') && colorInput.trim()) { e.preventDefault(); setProductColors(s => [...new Set([...s, colorInput.trim()])]); setColorInput(''); } }}
                          placeholder="Taper une couleur + Entrée"
                          className="flex-1 px-3 py-1.5 bg-black/20 border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                        <button type="button" onClick={() => { if (colorInput.trim()) { setProductColors(s => [...new Set([...s, colorInput.trim()])]); setColorInput(''); } }}
                          className="px-3 py-1.5 bg-primary/20 hover:bg-primary/30 text-white rounded-lg text-xs font-bold transition-all">+</button>
                      </div>
                      {productColors.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {productColors.map(c => (
                            <span key={c} className="flex items-center gap-1 px-2 py-0.5 bg-white/10 text-white text-xs rounded-md font-medium">
                              {c}
                              <button type="button" onClick={() => setProductColors(prev => prev.filter(x => x !== c))} className="text-gray-400 hover:text-red-400 transition-colors">×</button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {productCategory === "saveurs" && (
                  <div className="space-y-2 p-4 bg-[#FF6B35]/5 rounded-xl border border-[#FF6B35]/20">
                    <p className="text-sm font-semibold text-white">Options / Personnalisations</p>
                    <label className="text-xs font-medium text-gray-400">Exemples : Sans piment, Épicé, Sauce à part, Végétarien...</label>
                    <div className="flex gap-2">
                      <input
                        type="text" value={optionInput} onChange={e => setOptionInput(e.target.value)}
                        onKeyDown={e => { if ((e.key === 'Enter' || e.key === ',') && optionInput.trim()) { e.preventDefault(); setProductOptions(s => [...new Set([...s, optionInput.trim()])]); setOptionInput(''); } }}
                        placeholder="Option + Entrée"
                        className="flex-1 px-3 py-1.5 bg-black/20 border border-[#FF6B35]/20 rounded-lg text-white text-xs focus:outline-none focus:ring-1 focus:ring-[#FF6B35]"
                      />
                      <button type="button" onClick={() => { if (optionInput.trim()) { setProductOptions(s => [...new Set([...s, optionInput.trim()])]); setOptionInput(''); } }}
                        className="px-3 py-1.5 bg-[#FF6B35]/20 hover:bg-[#FF6B35]/30 text-[#FF6B35] rounded-lg text-xs font-bold transition-all">+</button>
                    </div>
                    {productOptions.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {productOptions.map(o => (
                          <span key={o} className="flex items-center gap-1 px-2 py-0.5 bg-[#FF6B35]/10 text-[#FF6B35] text-xs rounded-md font-medium border border-[#FF6B35]/20">
                            {o}
                            <button type="button" onClick={() => setProductOptions(prev => prev.filter(x => x !== o))} className="text-[#FF6B35]/60 hover:text-red-400 transition-colors">×</button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-300">Description</label>
                  <textarea
                    rows={4}
                    value={productDesc}
                    onChange={(e) => setProductDesc(e.target.value)}
                    placeholder="Décrivez votre produit en détail..."
                    className="w-full px-4 py-2 bg-black/20 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-white"
                  ></textarea>
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
                    className="px-6 py-2 bg-primary hover:bg-primary-light text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
                  >
                    {isProcessing ? "Enregistrement..." : (isAdmin ? "Sauvegarder le produit" : "Publier le produit")}
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
