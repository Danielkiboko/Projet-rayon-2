"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { OptimizedImage } from "@/modules/shared/components/OptimizedImage";
import { ChevronLeft, ShoppingCart, ShoppingBag, ShieldCheck, Check, Truck, PackageOpen, Minus, Plus, MessageSquare, Star, AlertTriangle, Send } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useChat } from "@/context/ChatContext";
import { useCart } from "@/context/CartContext";
import { doc, getDoc, collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { evaluateProductVerification, submitProductReview } from "@/lib/productVerification";
import { DirectBuyModal } from "@/modules/client/components/DirectBuyModal";
import { useCurrency } from "@/context/CurrencyContext";
import { CurrencySelector } from "@/modules/shared/components/CurrencySelector";

export default function ProductDetails({ params }: { params: { id: string } }) {
  const [lang, setLang] = useState<"fr" | "en">("fr");
  const { openChatForProduct } = useChat();
  const { addToCart } = useCart();
  const { formatPrice } = useCurrency();
  const { user } = useAuth();
  const router = useRouter();
  
  const [productData, setProductData] = useState<any>(null);
  const [isBuyModalOpen, setIsBuyModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [reviewsList, setReviewsList] = useState<any[]>([]);
  const [selectedRating, setSelectedRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [reviewFeedback, setReviewFeedback] = useState("");

  const fetchProductAndReviews = async () => {
    try {
      const docRef = doc(db, "products", params.id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setProductData({ id: docSnap.id, ...docSnap.data() });
      } else {
        setProductData(null);
      }

      // Fetch reviews
      const reviewsSnap = await getDocs(
        query(collection(db, "products", params.id, "reviews"), orderBy("createdAt", "desc"))
      );
      const list: any[] = [];
      reviewsSnap.forEach(d => list.push({ id: d.id, ...d.data() }));
      setReviewsList(list);
    } catch (error) {
      console.error("Error fetching product or reviews:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProductAndReviews();
  }, [params.id]);

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
          targetId: params.id,
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
      <div className="min-h-screen bg-[#0b061c] flex flex-col items-center justify-center text-white">
        <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin mb-4"></div>
        <p className="text-gray-400 font-medium tracking-wide">Chargement du produit...</p>
      </div>
    );
  }

  if (!productData) {
    return (
      <div className="min-h-screen bg-[#0b061c] flex items-center justify-center text-white">
        <h2>Produit introuvable.</h2>
        <Link href="/" className="ml-4 text-primary-light hover:underline">Retour à l'accueil</Link>
      </div>
    );
  }

  // Minimum unit price for display
  let currentUnitPrice = productData.price;
  if (productData.bulkPricing && productData.bulkPricing.length > 0) {
    currentUnitPrice = productData.bulkPricing[productData.bulkPricing.length - 1].price; // usually the lowest price is the last tier
  }

  const handleOpenChat = () => {
    openChatForProduct({
      id: productData.id,
      supplierId: productData.supplierId || "admin",
      name: productData.title[lang]
    });
  };

  return (
    <div className="min-h-screen bg-[#0b061c] text-white">
      {/* Header simple */}
      <header className="sticky top-0 z-50 bg-[#0b061c]/90 backdrop-blur-md border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center text-gray-400 hover:text-white transition-colors">
            <ChevronLeft size={20} className="mr-1" />
            <span className="text-sm font-medium">{lang === "fr" ? "Retour" : "Back"}</span>
          </Link>
          
          <div className="flex items-center space-x-3">
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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex flex-col lg:flex-row gap-12">
          
          {/* Colonne Image */}
          <div className="lg:w-1/2">
            <div className="sticky top-24">
              <div className="relative aspect-square md:aspect-video lg:aspect-square bg-[#140b2e] rounded-3xl overflow-hidden border border-white/10">
                <OptimizedImage
                  src={productData.image}
                  alt={productData.title[lang]}
                  fill
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-4 left-4">
                  <span className="px-3 py-1.5 bg-black/60 backdrop-blur-md text-[#00e5ff] text-xs font-bold tracking-wider rounded border border-white/10 uppercase">
                    {productData.tag[lang]}
                  </span>
                </div>
              </div>
              
              {/* Trust badges */}
              <div className="grid grid-cols-2 gap-4 mt-6">
                <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center">
                  <ShieldCheck size={24} className="text-green-400 mr-3" />
                  <div>
                    <h4 className="font-bold text-sm">Trade Assurance</h4>
                    <p className="text-xs text-gray-400">{lang === "fr" ? "Achat protégé" : "Protected purchase"}</p>
                  </div>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center">
                  <Truck size={24} className="text-blue-400 mr-3" />
                  <div>
                    <h4 className="font-bold text-sm">Livraison</h4>
                    <p className="text-xs text-gray-400">{lang === "fr" ? "Rapide & Suivie" : "Fast & Tracked"}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Colonne Infos & Achat */}
          <div className="lg:w-1/2 flex flex-col">
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <span className="text-primary-light text-sm font-bold tracking-wider uppercase">
                {productData.brand}
              </span>

              {/* Dynamic Verification Status */}
              {(() => {
                const verification = evaluateProductVerification(productData);
                if (verification.badgeType === "admin_official") {
                  return (
                    <span className="flex items-center bg-[#C7D300]/15 text-[#C7D300] px-2.5 py-1 rounded-full text-xs font-bold border border-[#C7D300]/30" title="Produit officiel vendu et certifié par Rayons.net">
                      <ShieldCheck size={14} className="mr-1.5" /> Produit Officiel Certifié Rayons
                    </span>
                  );
                }
                if (verification.badgeType === "community_verified") {
                  return (
                    <span className="flex items-center bg-emerald-500/15 text-emerald-400 px-2.5 py-1 rounded-full text-xs font-bold border border-emerald-500/30" title="Produit certifié vérifié par les votes des clients">
                      <ShieldCheck size={14} className="mr-1.5" /> Vérifié par les clients (★ {verification.averageRating.toFixed(1)}/5)
                    </span>
                  );
                }
                if (verification.badgeType === "low_rating") {
                  return (
                    <span className="flex items-center bg-red-500/15 text-red-400 px-2.5 py-1 rounded-full text-xs font-bold border border-red-500/30" title="Cote basse : vigilance requise">
                      <AlertTriangle size={14} className="mr-1.5" /> Vigilance : Avis clients défavorables (★ {verification.averageRating.toFixed(1)}/5)
                    </span>
                  );
                }
                return (
                  <span className="flex items-center bg-white/5 text-gray-400 px-2.5 py-1 rounded-full text-xs font-medium border border-white/10">
                    <Star size={13} className="mr-1 text-amber-400 fill-amber-400" />
                    {verification.ratingsCount > 0 ? `${verification.averageRating.toFixed(1)}/5 (${verification.ratingsCount} avis)` : "Évaluation en cours"}
                  </span>
                );
              })()}
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-6 leading-tight">
              {productData.title[lang]}
            </h1>
            
            <p className="text-gray-300 text-base mb-8 leading-relaxed">
              {productData.description[lang]}
            </p>

            {/* Features */}
            <div className="mb-8">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">
                {lang === "fr" ? "Points clés" : "Key features"}
              </h3>
              <ul className="space-y-3">
                {productData.features.map((feature: any, idx: number) => (
                  <li key={idx} className="flex items-start">
                    <Check size={18} className="text-primary-light mr-3 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-200 text-sm">{feature[lang]}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="w-full h-[1px] bg-white/10 mb-8" />

            {/* Bulk Pricing Card */}
            <div className="bg-[#140b2e] border border-white/10 rounded-2xl p-6 mb-8">
              <h3 className="text-sm font-bold text-white mb-4 flex items-center">
                <PackageOpen size={18} className="mr-2 text-primary-light" />
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
                      <div className="text-xs text-gray-400 mb-1">{tier.qty} {lang === "fr" ? "unités" : "units"}</div>
                      <div className={`text-lg font-bold ${isActive ? "text-primary-light" : "text-white"}`}>
                        {formatPrice(tier.price)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Main CTAs */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-8 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button 
                  type="button"
                  onClick={() => setIsBuyModalOpen(true)}
                  className="w-full py-4 bg-[#C7D300] hover:bg-[#b5c000] text-[#0F1D27] font-heading font-extrabold rounded-xl transition-all shadow-lg shadow-[#C7D300]/20 flex items-center justify-center gap-2 cursor-pointer active:scale-98 text-sm sm:text-base"
                >
                  <ShoppingBag size={18} />
                  <span>Acheter direct</span>
                </button>

                <button 
                  type="button"
                  onClick={() => addToCart(productData, 1)}
                  className="w-full py-4 bg-white hover:bg-gray-100 text-[#0F1D27] font-heading font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98 text-sm sm:text-base shadow-sm"
                >
                  <ShoppingCart size={18} className="text-primary" />
                  <span>Ajouter au panier</span>
                </button>
              </div>

              <button 
                type="button"
                onClick={handleOpenChat}
                className="w-full py-3 bg-white/10 hover:bg-white/15 text-white font-semibold rounded-xl transition-all flex items-center justify-center space-x-2 border border-white/10 text-sm cursor-pointer"
              >
                <MessageSquare size={18} />
                <span>
                  {lang === "fr" ? "Discuter / Négocier avec le fournisseur" : "Contact Supplier"} 
                </span>
              </button>
            </div>

            {/* Customer Rating & Reviews Section */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Star className="text-amber-400 fill-amber-400" size={18} />
                    Avis & Votes des Clients
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Les votes des clients déterminent directement la mention « Vérifié » pour ce produit (minimum 3 votes et note &ge; 4.0/5).
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-black text-amber-400">
                    {Number(productData.averageRating || 0) > 0 ? Number(productData.averageRating).toFixed(1) : "—"} / 5
                  </div>
                  <div className="text-[11px] text-gray-400">
                    {productData.ratingsCount || 0} vote{(productData.ratingsCount || 0) > 1 ? "s" : ""}
                  </div>
                </div>
              </div>

              {/* Vote form for clients */}
              <form onSubmit={handleReviewSubmit} className="bg-black/30 border border-white/10 rounded-xl p-4 mb-6 space-y-3">
                <span className="text-xs font-semibold text-gray-300 block">
                  Donnez votre note pour influencer la certification de cet article :
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
                        size={24} 
                        className={star <= selectedRating ? "text-amber-400 fill-amber-400" : "text-gray-600"} 
                      />
                    </button>
                  ))}
                  <span className="ml-2 text-xs font-bold text-amber-400">{selectedRating} / 5 étoiles</span>
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
                    className="px-4 py-2 bg-primary hover:bg-primary-light text-white font-semibold text-xs rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50"
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
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">Derniers retours ({reviewsList.length})</h4>
                {reviewsList.length === 0 ? (
                  <p className="text-xs text-gray-500 italic py-2">Soyez le premier client à voter pour ce produit !</p>
                ) : (
                  reviewsList.slice(0, 5).map((rev) => (
                    <div key={rev.id} className="p-3 bg-white/5 rounded-xl border border-white/5 flex flex-col gap-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-gray-200">{rev.clientName || "Client"}</span>
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
      </main>

      {/* Direct Express Order Modal */}
      <DirectBuyModal 
        isOpen={isBuyModalOpen}
        onClose={() => setIsBuyModalOpen(false)}
        product={productData}
      />
    </div>
  );
}
