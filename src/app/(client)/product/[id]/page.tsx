"use client";

import { useState, useEffect, use, useMemo } from "react";
import Link from "next/link";
import { OptimizedImage } from "@/modules/shared/components/OptimizedImage";
import {
  ChevronLeft,
  ShoppingCart,
  ShoppingBag,
  ShieldCheck,
  Check,
  Truck,
  PackageOpen,
  MessageSquare,
  Star,
  AlertTriangle,
  Send,
  Share2,
  Sparkles,
  Palette,
  Ruler,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useParams } from "next/navigation";
import { useChat } from "@/context/ChatContext";
import { useCart } from "@/context/CartContext";
import { useCurrency } from "@/context/CurrencyContext";
import { CurrencySelector } from "@/modules/shared/components/CurrencySelector";
import { doc, getDoc, collection, getDocs, query, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { evaluateProductVerification } from "@/lib/productVerification";
import { DirectBuyModal } from "@/modules/client/components/DirectBuyModal";
import { ProductCard } from "@/modules/client/components/rayon/ProductCard";
import { RayonsLogo } from "@/modules/shared/components/brand/RayonsLogo";

export default function ProductDetails({ params }: { params: Promise<{ id: string }> }) {
  const routeParams = useParams();
  const resolvedParams = use(params);
  const productId = resolvedParams?.id || (routeParams?.id as string) || "";

  const [lang, setLang] = useState<"fr" | "en">("fr");
  const { openChatForProduct } = useChat();
  const { addToCart } = useCart();
  const { formatPrice } = useCurrency();
  const { user } = useAuth();

  const [productData, setProductData] = useState<any>(null);
  const [similarProducts, setSimilarProducts] = useState<any[]>([]);
  const [activeImage, setActiveImage] = useState<string>("");
  const [selectedColor, setSelectedColor] = useState<string>("");
  const [selectedSize, setSelectedSize] = useState<string>("");
  const [selectedOption, setSelectedOption] = useState<string>("");
  const [copiedLink, setCopiedLink] = useState(false);

  const [buyModalProduct, setBuyModalProduct] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [reviewsList, setReviewsList] = useState<any[]>([]);
  const [selectedRating, setSelectedRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [reviewFeedback, setReviewFeedback] = useState("");

  const fetchProductAndReviews = async () => {
    if (!productId) return;
    setIsLoading(true);
    try {
      const docRef = doc(db, "products", productId);
      const docSnap = await getDoc(docRef);

      let loadedProduct: any = null;
      if (docSnap.exists()) {
        loadedProduct = { id: docSnap.id, ...docSnap.data() };
        setProductData(loadedProduct);

        const initialImg =
          loadedProduct.image ||
          loadedProduct.imageUrl ||
          (Array.isArray(loadedProduct.images) && loadedProduct.images.length > 0 ? loadedProduct.images[0] : "") ||
          (Array.isArray(loadedProduct.gallery) && loadedProduct.gallery.length > 0 ? loadedProduct.gallery[0]?.url : "") ||
          "";
        setActiveImage(initialImg);

        if (Array.isArray(loadedProduct.colors) && loadedProduct.colors.length > 0) {
          setSelectedColor(loadedProduct.colors[0]);
        } else if (Array.isArray(loadedProduct.gallery) && loadedProduct.gallery[0]?.color) {
          setSelectedColor(loadedProduct.gallery[0].color);
        } else {
          setSelectedColor("");
        }

        if (Array.isArray(loadedProduct.sizes) && loadedProduct.sizes.length > 0) {
          setSelectedSize(loadedProduct.sizes[0]);
        } else {
          setSelectedSize("");
        }

        if (Array.isArray(loadedProduct.options) && loadedProduct.options.length > 0) {
          setSelectedOption(loadedProduct.options[0]);
        } else {
          setSelectedOption("");
        }
      } else {
        setProductData(null);
      }

      // Fetch similar products from the same rayon/category
      if (loadedProduct) {
        try {
          const allSnap = await getDocs(query(collection(db, "products"), limit(36)));
          const targetCat = String(loadedProduct.category || loadedProduct.rayon || "").toLowerCase();
          const sameCategory: any[] = [];
          const otherProducts: any[] = [];

          allSnap.forEach((d) => {
            if (d.id === productId) return;
            const pData = d.data();
            if (pData.status === "REJECTED") return;
            const pCat = String(pData.category || pData.rayon || "").toLowerCase();
            const item = { id: d.id, ...pData };
            if (targetCat && (pCat.includes(targetCat) || targetCat.includes(pCat))) {
              sameCategory.push(item);
            } else {
              otherProducts.push(item);
            }
          });

          setSimilarProducts([...sameCategory, ...otherProducts].slice(0, 6));
        } catch (simErr) {
          console.warn("Erreur chargement produits similaires:", simErr);
        }
      }

      // Fetch reviews
      const reviewsSnap = await getDocs(
        query(collection(db, "products", productId, "reviews"), orderBy("createdAt", "desc"))
      );
      const list: any[] = [];
      reviewsSnap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      setReviewsList(list);
    } catch (error) {
      console.error("Error fetching product or reviews:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProductAndReviews();
  }, [productId]);

  // Build normalized gallery list combining main image, images[], and gallery[]
  const galleryList = useMemo(() => {
    if (!productData) return [];
    const items: Array<{ url: string; color: string }> = [];
    const seen = new Set<string>();

    if (Array.isArray(productData.gallery)) {
      for (const g of productData.gallery) {
        if (g?.url && !seen.has(g.url)) {
          seen.add(g.url);
          items.push({ url: g.url, color: g.color || "" });
        }
      }
    }

    const mainImg = productData.image || productData.imageUrl || "";
    if (mainImg && !seen.has(mainImg)) {
      seen.add(mainImg);
      items.unshift({ url: mainImg, color: "" });
    }

    if (Array.isArray(productData.images)) {
      for (const u of productData.images) {
        if (typeof u === "string" && u && !seen.has(u)) {
          seen.add(u);
          items.push({ url: u, color: "" });
        }
      }
    }

    return items;
  }, [productData]);

  // Available colors list
  const availableColors = useMemo(() => {
    if (!productData) return [];
    const baseColors = Array.isArray(productData.colors) ? productData.colors.filter(Boolean) : [];
    const galleryColors = galleryList.map((g) => g.color).filter(Boolean);
    return Array.from(new Set([...baseColors, ...galleryColors]));
  }, [productData, galleryList]);

  const handleSelectColor = (color: string) => {
    setSelectedColor(color);
    // If a gallery photo matches this color, switch activeImage automatically
    const match = galleryList.find(
      (g) => g.color && g.color.toLowerCase().trim() === color.toLowerCase().trim()
    );
    if (match?.url) {
      setActiveImage(match.url);
    }
  };

  const handleShareProduct = async () => {
    const shareUrl = typeof window !== "undefined" ? window.location.href : "";
    const titleStr =
      typeof productData?.title === "object" && productData?.title !== null
        ? productData.title[lang] || productData.title.fr || "Produit Rayons.net"
        : productData?.title || "Produit Rayons.net";

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: titleStr,
          text: `Découvrez ${titleStr} sur Rayons.net`,
          url: shareUrl,
        });
        return;
      } catch {
        // Fallback to clipboard copy
      }
    }

    if (typeof navigator !== "undefined" && navigator.clipboard && shareUrl) {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 3000);
    }
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      alert("Veuillez vous connecter pour noter ce produit.");
      return;
    }

    setIsSubmittingReview(true);
    try {
      const res = await fetch("/api/reviews/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetType: "product",
          targetId: productId,
          clientId: user.uid,
          clientName: user.displayName || user.email?.split("@")[0] || "Client Rayons",
          clientEmail: user.email,
          rating: selectedRating,
          comment: reviewComment,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "Erreur lors de l'enregistrement de votre avis.");
      }

      setReviewFeedback("Merci ! Votre évaluation a été prise en compte et met à jour la cote du produit.");
      setReviewComment("");
      await fetchProductAndReviews();
      setTimeout(() => setReviewFeedback(""), 5000);
    } catch (err: any) {
      console.error("Error submitting review:", err);
      alert(err.message || "Erreur lors de l'envoi de votre avis.");
    } finally {
      setIsSubmittingReview(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0F1D27] flex flex-col items-center justify-center text-white">
        <div className="w-10 h-10 border-3 border-[#C7D300]/20 border-t-[#C7D300] rounded-full animate-spin mb-3"></div>
        <p className="text-gray-300 font-semibold text-sm">Chargement du produit Rayons...</p>
      </div>
    );
  }

  if (!productData) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl border border-gray-200/90 shadow-sm p-8 text-center flex flex-col items-center">
          <div className="w-16 h-16 rounded-2xl bg-orange-50 text-[#FF6600] border border-orange-200/60 flex items-center justify-center mb-4">
            <PackageOpen size={32} />
          </div>
          <h2 className="text-xl font-black text-gray-900 mb-2">Produit non disponible</h2>
          <p className="text-xs text-gray-500 mb-6 leading-relaxed">
            Cet article n&apos;est plus en stock ou a été retiré de la vitrine par le fournisseur. Vous pouvez explorer d&apos;autres articles similaires sur les rayons.
          </p>
          <div className="flex flex-col sm:flex-row gap-2.5 w-full">
            <Link
              href="/"
              className="flex-1 py-3 px-4 bg-[#0F1D27] hover:bg-[#1a2e3b] text-[#C7D300] font-extrabold text-xs rounded-xl shadow-xs hover:shadow-md transition-all text-center flex items-center justify-center gap-1.5"
            >
              <ShoppingBag size={15} />
              <span>Explorer les Rayons</span>
            </Link>
            <Link
              href="/dashboard/client?tab=orders"
              className="py-3 px-4 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 font-bold text-xs rounded-xl transition-colors text-center"
            >
              Mes Commandes
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const productTitle =
    typeof productData.title === "object" && productData.title !== null
      ? productData.title[lang] || productData.title.fr || productData.title.en || "Produit"
      : productData.title || productData.name || "Produit";

  const productDescription =
    typeof productData.description === "object" && productData.description !== null
      ? productData.description[lang] || productData.description.fr || productData.description.en || ""
      : productData.description || "Article disponible sur Rayons.net avec livraison suivie et paiement protégé par séquestre.";

  const productTag =
    typeof productData.tag === "object" && productData.tag !== null
      ? productData.tag[lang] || productData.tag.fr || productData.category || "Rayons"
      : productData.tag || productData.category || productData.rayon || "Rayons";

  const displayImage =
    activeImage ||
    productData.image ||
    productData.imageUrl ||
    (Array.isArray(productData.images) && productData.images.length > 0 ? productData.images[0] : "") ||
    "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=600";

  let currentUnitPrice = Number(productData.price || 0);
  if (Array.isArray(productData.bulkPricing) && productData.bulkPricing.length > 0) {
    currentUnitPrice = productData.bulkPricing[productData.bulkPricing.length - 1].price;
  }

  const handleOpenChat = () => {
    openChatForProduct({
      id: productData.id,
      supplierId: productData.supplierId || "admin",
      name: `${productTitle}${selectedColor ? ` (${selectedColor})` : ""}${selectedSize ? ` - Taille ${selectedSize}` : ""}`,
      price: productData.price,
      image: displayImage,
    });
  };

  const enrichedProductForOrder = {
    ...productData,
    image: displayImage,
    selectedColor,
    selectedSize,
    selectedOption,
  };

  return (
    <div className="min-h-screen bg-[#0F1D27] text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#0F1D27]/95 backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 sm:gap-4">
            <Link href="/" className="flex items-center text-gray-300 hover:text-white transition-colors">
              <ChevronLeft size={20} className="mr-0.5 sm:mr-1" />
              <span className="text-xs sm:text-sm font-semibold">{lang === "fr" ? "Retour" : "Back"}</span>
            </Link>
            <div className="h-4 sm:h-5 w-[1px] bg-white/15" />
            <RayonsLogo size="sm" variant="dark" href="/" />
          </div>

          <div className="flex items-center space-x-2.5">
            <button
              type="button"
              onClick={handleShareProduct}
              className="px-3 py-1.5 bg-white/10 hover:bg-white/15 rounded-full text-xs font-semibold text-[#C7D300] flex items-center gap-1.5 border border-white/10 transition-colors cursor-pointer"
              title="Partager le lien du produit"
            >
              <Share2 size={13} />
              <span>{copiedLink ? "Lien copié !" : "Partager"}</span>
            </button>

            <CurrencySelector variant="dark" />

            <button
              onClick={() => setLang(lang === "fr" ? "en" : "fr")}
              className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-full text-xs font-medium text-gray-300 hover:text-white transition-colors"
            >
              {lang.toUpperCase()}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-5 sm:py-10">
        <div className="flex flex-col lg:flex-row gap-6 lg:gap-12">
          {/* Colonne Image + Galerie Multi-Photos */}
          <div className="lg:w-5/12">
            <div className="lg:sticky lg:top-24 space-y-3.5 max-w-[360px] mx-auto lg:mx-0">
              <div
                className="relative w-full h-52 sm:h-64 max-h-64 bg-white rounded-2xl overflow-hidden border border-white/10 shadow-xl"
                style={{ height: "220px", maxHeight: "256px" }}
              >
                <OptimizedImage
                  src={displayImage}
                  alt={productTitle}
                  fill
                  priority
                  sizes="(max-width: 640px) 100vw, 360px"
                  className="w-full h-full object-contain p-2 transition-all duration-300"
                />
                <div className="absolute top-3 left-3 sm:top-4 sm:left-4 flex items-center gap-2">
                  <span className="px-2.5 py-1 sm:px-3 sm:py-1.5 bg-black/65 backdrop-blur-md text-[#C7D300] text-[10px] sm:text-xs font-bold tracking-wider rounded-lg sm:rounded-xl border border-white/10 uppercase">
                    {productTag}
                  </span>
                  {selectedColor && (
                    <span className="px-2.5 py-1 sm:px-3 sm:py-1.5 bg-white/90 backdrop-blur-md text-[#0F1D27] text-[10px] sm:text-xs font-extrabold rounded-lg sm:rounded-xl shadow-sm">
                      🎨 {selectedColor}
                    </span>
                  )}
                </div>
              </div>

              {/* Miniatures Multi-Photos / Couleurs */}
              {galleryList.length > 1 && (
                <div className="space-y-1.5">
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                    Photos & Couleurs disponibles ({galleryList.length})
                  </p>
                  <div className="flex items-center gap-2.5 overflow-x-auto pb-1 scrollbar-hide">
                    {galleryList.map((item, idx) => {
                      const isSelected = displayImage === item.url;
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setActiveImage(item.url);
                            if (item.color) setSelectedColor(item.color);
                          }}
                          className={`relative w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden shrink-0 border-2 transition-all cursor-pointer bg-white ${
                            isSelected
                              ? "border-[#C7D300] ring-2 ring-[#C7D300]/30 scale-105"
                              : "border-white/15 opacity-75 hover:opacity-100"
                          }`}
                        >
                          <img
                            src={item.url}
                            alt={item.color || `Photo ${idx + 1}`}
                            className="w-full h-full object-cover"
                          />
                          {item.color && (
                            <span className="absolute bottom-0 inset-x-0 bg-black/75 text-[9px] font-bold text-white text-center py-0.5 truncate px-1">
                              {item.color}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Trust badges */}
              <div className="grid grid-cols-2 gap-2.5 sm:gap-4 pt-1">
                <div className="bg-white/5 border border-white/10 rounded-xl p-3 sm:p-4 flex items-center">
                  <ShieldCheck size={20} className="text-green-400 mr-2.5 sm:mr-3 shrink-0" />
                  <div>
                    <h4 className="font-bold text-xs sm:text-sm">Garantie Rayons</h4>
                    <p className="text-[10px] sm:text-xs text-gray-400">
                      {lang === "fr" ? "Paiement & achat protégés" : "Protected purchase"}
                    </p>
                  </div>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-xl p-3 sm:p-4 flex items-center">
                  <Truck size={20} className="text-blue-400 mr-2.5 sm:mr-3 shrink-0" />
                  <div>
                    <h4 className="font-bold text-xs sm:text-sm">Livraison</h4>
                    <p className="text-[10px] sm:text-xs text-gray-400">
                      {lang === "fr" ? "Rapide & Suivie" : "Fast & Tracked"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Colonne Infos & Achat */}
          <div className="lg:w-7/12 flex flex-col">
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <span className="text-[#C7D300] text-sm font-bold tracking-wider uppercase">
                {productData.brand || productData.supplierName || "Rayons"}
              </span>

              {/* Dynamic Verification Status */}
              {(() => {
                const verification = evaluateProductVerification(productData);
                if (verification.badgeType === "admin_official") {
                  return (
                    <span
                      className="flex items-center bg-[#C7D300]/15 text-[#C7D300] px-2.5 py-1 rounded-full text-xs font-bold border border-[#C7D300]/30"
                      title="Produit officiel vendu et certifié par Rayons.net"
                    >
                      <ShieldCheck size={14} className="mr-1.5" /> Produit Officiel Certifié Rayons
                    </span>
                  );
                }
                if (verification.badgeType === "community_verified") {
                  return (
                    <span
                      className="flex items-center bg-emerald-500/15 text-emerald-400 px-2.5 py-1 rounded-full text-xs font-bold border border-emerald-500/30"
                      title="Produit certifié vérifié par les votes des clients"
                    >
                      <ShieldCheck size={14} className="mr-1.5" /> Vérifié par les clients (★{" "}
                      {verification.averageRating.toFixed(1)}/5)
                    </span>
                  );
                }
                if (verification.badgeType === "low_rating") {
                  return (
                    <span
                      className="flex items-center bg-red-500/15 text-red-400 px-2.5 py-1 rounded-full text-xs font-bold border border-red-500/30"
                      title="Cote basse : vigilance requise"
                    >
                      <AlertTriangle size={14} className="mr-1.5" /> Vigilance : Avis clients défavorables (★{" "}
                      {verification.averageRating.toFixed(1)}/5)
                    </span>
                  );
                }
                return (
                  <span className="flex items-center bg-white/5 text-gray-400 px-2.5 py-1 rounded-full text-xs font-medium border border-white/10">
                    <Star size={13} className="mr-1 text-amber-400 fill-amber-400" />
                    {verification.ratingsCount > 0
                      ? `${verification.averageRating.toFixed(1)}/5 (${verification.ratingsCount} avis)`
                      : "Nouveau produit"}
                  </span>
                );
              })()}
            </div>

            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-3 leading-tight">
              {productTitle}
            </h1>

            <div className="flex items-baseline gap-3 mb-5">
              <span className="text-2xl sm:text-3xl font-heading font-black text-[#C7D300]">
                {formatPrice(productData.price)}
              </span>
              {Number(productData.stock) > 0 && (
                <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full">
                  En stock ({productData.stock} disponibles)
                </span>
              )}
            </div>

            <p className="text-gray-300 text-sm sm:text-base mb-6 leading-relaxed whitespace-pre-line">
              {productDescription}
            </p>

            {/* Sélecteur de Couleurs (avec changement de photo automatique) */}
            {availableColors.length > 0 && (
              <div className="mb-5 p-4 bg-white/5 border border-white/10 rounded-2xl">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-300 flex items-center gap-1.5">
                    <Palette size={14} className="text-[#C7D300]" />
                    Couleur : <strong className="text-white">{selectedColor || "Au choix"}</strong>
                  </span>
                  <span className="text-[11px] text-gray-400">
                    Cliquez pour voir la couleur
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {availableColors.map((color) => {
                    const isSelected = selectedColor === color;
                    const matchingPhoto = galleryList.find(
                      (g) => g.color && g.color.toLowerCase().trim() === color.toLowerCase().trim()
                    );
                    return (
                      <button
                        key={color}
                        type="button"
                        onClick={() => handleSelectColor(color)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 border transition-all cursor-pointer ${
                          isSelected
                            ? "bg-[#C7D300] text-[#0F1D27] border-[#C7D300] shadow-md"
                            : "bg-black/30 text-gray-200 border-white/15 hover:border-white/40"
                        }`}
                      >
                        {matchingPhoto && (
                          <img
                            src={matchingPhoto.url}
                            alt={color}
                            className="w-5 h-5 rounded-full object-cover border border-black/20"
                          />
                        )}
                        <span>{color}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Sélecteur de Tailles */}
            {Array.isArray(productData.sizes) && productData.sizes.length > 0 && (
              <div className="mb-5 p-4 bg-white/5 border border-white/10 rounded-2xl">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-300 flex items-center gap-1.5 mb-2.5">
                  <Ruler size={14} className="text-[#C7D300]" />
                  Taille : <strong className="text-white">{selectedSize || "Standard"}</strong>
                </span>
                <div className="flex flex-wrap gap-2">
                  {productData.sizes.map((size: string) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setSelectedSize(size)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        selectedSize === size
                          ? "bg-[#C7D300] text-[#0F1D27] border-[#C7D300]"
                          : "bg-black/30 text-gray-200 border-white/15 hover:border-white/40"
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Sélecteur d'Options (Saveurs / Personnalisation) */}
            {Array.isArray(productData.options) && productData.options.length > 0 && (
              <div className="mb-5 p-4 bg-white/5 border border-white/10 rounded-2xl">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-300 block mb-2.5">
                  Option / Préférence : <strong className="text-white">{selectedOption}</strong>
                </span>
                <div className="flex flex-wrap gap-2">
                  {productData.options.map((opt: string) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setSelectedOption(opt)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        selectedOption === opt
                          ? "bg-[#FF6B35] text-white border-[#FF6B35]"
                          : "bg-black/30 text-gray-200 border-white/15 hover:border-white/40"
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Features (if present) */}
            {Array.isArray(productData.features) && productData.features.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">
                  {lang === "fr" ? "Points clés" : "Key features"}
                </h3>
                <ul className="space-y-2.5">
                  {productData.features.map((feature: any, idx: number) => (
                    <li key={idx} className="flex items-start">
                      <Check size={18} className="text-[#C7D300] mr-3 mt-0.5 shrink-0" />
                      <span className="text-gray-200 text-sm">
                        {typeof feature === "object" && feature !== null
                          ? feature[lang] || feature.fr || feature.en
                          : feature}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Bulk Pricing Card (if present) */}
            {Array.isArray(productData.bulkPricing) && productData.bulkPricing.length > 0 && (
              <div className="bg-[#0F1D27] border border-white/10 rounded-2xl p-5 mb-6">
                <h3 className="text-sm font-bold text-white mb-3 flex items-center">
                  <PackageOpen size={18} className="mr-2 text-[#C7D300]" />
                  {lang === "fr" ? "Tarifs de gros (B2B)" : "Bulk Pricing (B2B)"}
                </h3>
                <div className="flex flex-wrap gap-3">
                  {productData.bulkPricing.map((tier: any, idx: number) => {
                    const isActive = currentUnitPrice === tier.price;
                    return (
                      <div
                        key={idx}
                        className={`flex-1 min-w-[100px] p-3 rounded-xl border transition-colors ${
                          isActive ? "bg-primary/20 border-primary" : "bg-white/5 border-white/10"
                        }`}
                      >
                        <div className="text-xs text-gray-400 mb-1">
                          {tier.qty} {lang === "fr" ? "unités" : "units"}
                        </div>
                        <div className={`text-lg font-bold ${isActive ? "text-[#C7D300]" : "text-white"}`}>
                          {formatPrice(tier.price)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Main CTAs */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 sm:p-6 mb-6 space-y-2.5 sm:space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                <button
                  type="button"
                  onClick={() => setBuyModalProduct(enrichedProductForOrder)}
                  className="w-full py-3.5 sm:py-4 bg-[#C7D300] hover:bg-[#b5c000] text-[#0F1D27] font-heading font-extrabold rounded-xl transition-all shadow-lg shadow-[#C7D300]/20 flex items-center justify-center gap-2 cursor-pointer active:scale-98 text-xs sm:text-base"
                >
                  <ShoppingBag size={17} />
                  <span>Acheter direct</span>
                </button>

                <button
                  type="button"
                  onClick={() => addToCart(enrichedProductForOrder, 1)}
                  className="w-full py-3.5 sm:py-4 bg-white hover:bg-gray-100 text-[#0F1D27] font-heading font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98 text-xs sm:text-base shadow-sm"
                >
                  <ShoppingCart size={17} className="text-primary" />
                  <span>Ajouter au panier</span>
                </button>
              </div>

              <button
                type="button"
                onClick={handleOpenChat}
                className="w-full py-3 bg-white/10 hover:bg-white/15 text-white font-semibold rounded-xl transition-all flex items-center justify-center space-x-2 border border-white/10 text-xs sm:text-sm cursor-pointer"
              >
                <MessageSquare size={16} />
                <span>
                  {lang === "fr" ? "Discuter / Négocier avec le fournisseur" : "Contact Supplier"}
                </span>
              </button>
            </div>

            {/* Customer Rating & Reviews Section */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                    <Star className="text-amber-400 fill-amber-400" size={18} />
                    Avis & Votes des Clients
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Les votes des clients déterminent la mention « Vérifié » (minimum 3 votes et note &ge; 4.0/5).
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xl sm:text-2xl font-black text-amber-400">
                    {Number(productData.averageRating || 0) > 0
                      ? Number(productData.averageRating).toFixed(1)
                      : "—"}{" "}
                    / 5
                  </div>
                  <div className="text-[11px] text-gray-400">
                    {productData.ratingsCount || 0} vote{(productData.ratingsCount || 0) > 1 ? "s" : ""}
                  </div>
                </div>
              </div>

              {/* Vote form for clients */}
              <form
                onSubmit={handleReviewSubmit}
                className="bg-black/30 border border-white/10 rounded-xl p-4 mb-5 space-y-3"
              >
                <span className="text-xs font-semibold text-gray-300 block">
                  Donnez votre note pour cet article :
                </span>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setSelectedRating(star)}
                      className="p-1 text-2xl transition-transform hover:scale-125 focus:outline-none"
                    >
                      <Star
                        size={22}
                        className={
                          star <= selectedRating ? "text-amber-400 fill-amber-400" : "text-gray-600"
                        }
                      />
                    </button>
                  ))}
                  <span className="ml-2 text-xs font-bold text-amber-400">
                    {selectedRating} / 5 étoiles
                  </span>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    placeholder="Votre avis (qualité, conformité, livraison...)"
                    className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <button
                    type="submit"
                    disabled={isSubmittingReview}
                    className="px-4 py-2 bg-[#C7D300] hover:bg-[#b5c000] text-[#0F1D27] font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Send size={14} />
                    {isSubmittingReview ? "Envoi..." : "Voter"}
                  </button>
                </div>
                {reviewFeedback && (
                  <p className="text-xs text-emerald-400 font-medium">{reviewFeedback}</p>
                )}
              </form>

              {/* Reviews List */}
              <div className="space-y-2.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">
                  Derniers retours ({reviewsList.length})
                </h4>
                {reviewsList.length === 0 ? (
                  <p className="text-xs text-gray-500 italic py-2">
                    Soyez le premier client à voter pour ce produit !
                  </p>
                ) : (
                  reviewsList.slice(0, 5).map((rev) => (
                    <div
                      key={rev.id}
                      className="p-3 bg-white/5 rounded-xl border border-white/5 flex flex-col gap-1"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-gray-200">
                          {rev.clientName || "Client"}
                        </span>
                        <div className="flex items-center gap-0.5 text-amber-400">
                          {Array.from({ length: rev.rating || 5 }).map((_, i) => (
                            <Star key={i} size={11} className="fill-amber-400" />
                          ))}
                        </div>
                      </div>
                      {rev.comment && <p className="text-xs text-gray-300 mt-1">{rev.comment}</p>}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── SECTION : PRODUITS SIMILAIRES SUGGÉRÉS ── */}
        {similarProducts.length > 0 && (
          <section className="mt-14 pt-10 border-t border-white/10">
            <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
              <div>
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#C7D300] bg-[#C7D300]/10 border border-[#C7D300]/30 px-3 py-1 rounded-full mb-2">
                  <Sparkles size={12} />
                  Suggestions similaires
                </span>
                <h2 className="text-xl sm:text-2xl font-heading font-black text-white">
                  Vous aimerez aussi ces articles
                </h2>
              </div>
              <Link
                href="/"
                className="text-xs sm:text-sm font-bold text-[#C7D300] hover:underline"
              >
                Voir tout le catalogue →
              </Link>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5 sm:gap-3.5">
              {similarProducts.map((simProd, idx) => {
                const rawCat = String(simProd.category || simProd.rayon || "").toLowerCase();
                const cardCat: "mode" | "connect" | "saveurs" = rawCat.includes("mode")
                  ? "mode"
                  : rawCat.includes("saveur") || rawCat.includes("resto") || rawCat.includes("food")
                  ? "saveurs"
                  : "connect";

                return (
                  <ProductCard
                    key={simProd.id}
                    product={simProd}
                    lang={lang}
                    t={{ details: "Détails" }}
                    category={cardCat}
                    index={idx}
                    handleChat={(prod) =>
                      openChatForProduct({
                        id: prod.id,
                        supplierId: prod.supplierId || "admin",
                        name: prod.title?.fr || prod.title || prod.name || "Produit",
                        price: prod.price,
                        image: prod.image || prod.imageUrl || prod.images?.[0] || "",
                      })
                    }
                    onBuy={(prod) => setBuyModalProduct(prod)}
                  />
                );
              })}
            </div>
          </section>
        )}
      </main>

      {/* Direct Express Order Modal */}
      <DirectBuyModal
        isOpen={!!buyModalProduct}
        onClose={() => setBuyModalProduct(null)}
        product={buyModalProduct}
      />

      {productData && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org/",
              "@type": "Product",
              name: productData.title?.fr || productData.title || productData.name || "Produit Rayons",
              image: productData.images || [productData.image || productData.imageUrl || "https://rayons.net/supermarket-hero.jpg"],
              description: productData.description?.fr || productData.description || "Article disponible sur la marketplace unifiée Rayons.net",
              sku: productData.id,
              offers: {
                "@type": "Offer",
                url: `https://rayons.net/product/${productId}`,
                priceCurrency: "USD",
                price: Number(productData.price) || 0,
                availability: (productData.stock === undefined || productData.stock > 0) ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
                seller: {
                  "@type": "Organization",
                  name: productData.supplierName || "Rayons Marketplace",
                },
              },
            }),
          }}
        />
      )}
    </div>
  );
}
