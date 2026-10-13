"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { collection, onSnapshot, query, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ProductSkeleton } from "@/modules/shared/components/ui/Skeleton";
import { useChat } from "@/context/ChatContext";
import { RayonNavbar } from "./RayonNavbar";
import { ProductCard } from "./ProductCard";
import { Search, X, PackageSearch } from "lucide-react";
import { DirectBuyModal } from "@/modules/client/components/DirectBuyModal";

interface StoreTemplateProps {
  category: "mode" | "connect" | "saveurs";
  heroImage: string;
  dummyProducts: any[];
  dict: any;
}

function StoreTemplateContent({ category, heroImage, dummyProducts, dict }: StoreTemplateProps) {
  const [lang, setLang] = useState<"fr" | "en">("fr");
  const t = dict[lang];
  const { openChatForProduct } = useChat();
  const searchParams = useSearchParams();

  const [products, setProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBuyProduct, setSelectedBuyProduct] = useState<any | null>(null);

  // Sync with search parameter in URL
  useEffect(() => {
    const q = searchParams.get("search");
    if (q) {
      setSearchQuery(q);
    }
  }, [searchParams]);

  useEffect(() => {
    const productsQuery = query(collection(db, "products"), limit(60));
    const unsubscribe = onSnapshot(
      productsQuery,
      (snapshot) => {
        const allProducts = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        const isTargetRayon = (p: any) => {
          if (p.status === "REJECTED") return false;

          const cat = (p.category || "").toString().toLowerCase().trim();
          const ray = (p.rayon || "").toString().toLowerCase().trim();

          if (category === "mode") {
            return (
              cat === "mode" ||
              ray === "mode" ||
              cat.includes("mode") ||
              cat.includes("vetement") ||
              cat.includes("vêtement") ||
              cat.includes("habit") ||
              cat.includes("chaussure") ||
              cat.includes("accessoire") ||
              cat.includes("pantalon") ||
              cat.includes("robe") ||
              cat.includes("chemise") ||
              cat.includes("costume")
            );
          } else if (category === "connect") {
            return (
              cat === "connect" ||
              ray === "connect" ||
              cat.includes("connect") ||
              cat.includes("electr") ||
              cat.includes("électr") ||
              cat.includes("tech") ||
              cat.includes("telecom") ||
              cat.includes("télécom") ||
              cat.includes("starlink") ||
              cat.includes("wifi") ||
              cat.includes("informatique") ||
              cat.includes("ordi") ||
              cat.includes("phone")
            );
          } else if (category === "saveurs") {
            return (
              cat === "saveurs" ||
              ray === "saveurs" ||
              cat.includes("saveur") ||
              cat.includes("resto") ||
              cat.includes("restaurant") ||
              cat.includes("plat") ||
              cat.includes("cuisine") ||
              cat.includes("ustensile") ||
              cat.includes("repas") ||
              cat.includes("food") ||
              cat.includes("boisson") ||
              cat.includes("traiteur")
            );
          }
          return cat === category || ray === category;
        };

        const matchedProducts = allProducts.filter(isTargetRayon);

        if (matchedProducts.length === 0) {
          setProducts(dummyProducts);
        } else {
          setProducts(matchedProducts);
        }
        setIsLoading(false);
      },
      (error) => {
        console.error("Error listening to products:", error);
        setProducts(dummyProducts);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [category, dummyProducts]);

  const handleChat = (product: any) => {
    openChatForProduct({
      id: product.id,
      supplierId: product.supplierId || "admin",
      name: product.title?.[lang] || product.title?.fr || product.title || "Produit",
      price: product.price,
      image: product.imageUrl || product.images?.[0] || ""
    });
  };

  const isMode = category === "mode";
  const isSaveurs = category === "saveurs";
  const bgGradient = isMode 
    ? "from-[#D4B08C]/90 via-[#0F1D27]/80" 
    : isSaveurs
    ? "from-[#FF6B35]/90 via-[#0F1D27]/80"
    : "from-[#00B5A5]/90 via-[#0F1D27]/80";
  const heroTextColor = isMode ? "text-[#D4B08C]" : isSaveurs ? "text-[#FF6B35]" : "text-[#00B5A5]";

  // Filter products by search query
  const displayedProducts = products.filter(p => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    const title = (p.title?.[lang] || p.title?.fr || p.title || "").toLowerCase();
    const desc = (p.description?.[lang] || p.description?.fr || p.description || "").toLowerCase();
    const brand = (p.brand || "").toLowerCase();
    const tag = (p.tag?.[lang] || p.tag?.fr || p.tag || "").toLowerCase();
    return title.includes(q) || desc.includes(q) || brand.includes(q) || tag.includes(q);
  });

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F1D27] relative selection:bg-[#C7D300]/30 selection:text-[#0F1D27] overflow-x-hidden">
      {/* Ambient Chromatic Mesh Glow customized per Rayon */}
      <div 
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[min(800px,100vw)] h-[450px] rounded-full blur-[140px] pointer-events-none -z-0 opacity-30"
        style={{
          background: isMode
            ? "radial-gradient(circle, rgba(212, 176, 140, 0.5) 0%, transparent 70%)"
            : isSaveurs
            ? "radial-gradient(circle, rgba(255, 107, 53, 0.4) 0%, transparent 70%)"
            : "radial-gradient(circle, rgba(0, 181, 165, 0.4) 0%, transparent 70%)"
        }}
      />

      <RayonNavbar 
        category={category}
        lang={lang}
        setLang={setLang}
        t={t}
      />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
        
        {/* Hero Section */}
        <div className="relative rounded-2xl sm:rounded-3xl overflow-hidden mb-5 sm:mb-8 shadow-lg sm:shadow-xl h-[190px] sm:h-[280px] md:h-[320px]">
          <img 
            src={heroImage} 
            alt={t[category] || category} 
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className={`absolute inset-0 bg-gradient-to-r ${bgGradient} to-transparent`}></div>
          <div className="absolute inset-0 flex flex-col justify-center px-4 sm:px-8 md:px-16 w-full md:w-2/3">
            <span className="inline-block px-2.5 py-0.5 sm:px-3 sm:py-1 bg-white/20 text-white text-[10px] sm:text-xs font-bold tracking-wider rounded-full mb-2 sm:mb-4 border border-white/30 uppercase w-max backdrop-blur-xs">
              {t[category] || category}
            </span>
            <motion.h1 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="text-2xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tight leading-tight mb-1 sm:mb-3"
            >
              {t.title}
            </motion.h1>
            {t.subtitle && (
              <motion.p 
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.15 }}
                className={`text-xs sm:text-base md:text-lg ${heroTextColor} max-w-lg hidden sm:block`}
              >
                {t.subtitle}
              </motion.p>
            )}
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="bg-white p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-gray-200/80 shadow-xs mb-5 sm:mb-8 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-4">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Rechercher dans Rayons ${t[category] || category}...`}
              className="w-full pl-9 pr-9 py-2 sm:py-2.5 bg-gray-50 border border-gray-200 rounded-lg sm:rounded-xl text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1 rounded-full cursor-pointer"
                title="Effacer la recherche"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="text-[11px] sm:text-xs text-gray-500 font-medium text-right sm:text-left">
            {displayedProducts.length} article{displayedProducts.length > 1 ? "s" : ""} disponible{displayedProducts.length > 1 ? "s" : ""}
          </div>
        </div>

        {/* Products Grid */}
        {displayedProducts.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-8 sm:p-12 text-center my-6 sm:my-8">
            <PackageSearch size={44} className="mx-auto text-gray-300 mb-3" />
            <h3 className="text-sm sm:text-base font-bold text-gray-800 mb-1">Aucun résultat trouvé</h3>
            <p className="text-xs text-gray-400 max-w-md mx-auto mb-4">
              Aucun article dans ce rayon ne correspond à votre recherche "{searchQuery}". Essayez un autre mot-clé ou réinitialisez le filtre.
            </p>
            <button
              onClick={() => setSearchQuery("")}
              className="px-4 py-2 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary-dark transition-colors cursor-pointer"
            >
              Afficher tous les articles
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3 md:gap-4">
            {isLoading ? (
              <>
                <ProductSkeleton />
                <ProductSkeleton />
                <ProductSkeleton />
                <ProductSkeleton />
              </>
            ) : (
              displayedProducts.map((product, idx) => (
                <ProductCard 
                  key={product.id}
                  product={product}
                  index={idx}
                  category={category}
                  lang={lang}
                  t={t}
                  handleChat={handleChat}
                  onBuy={(p) => setSelectedBuyProduct(p)}
                />
              ))
            )}
          </div>
        )}
      </main>

      {/* Direct Buy Express Modal */}
      <DirectBuyModal 
        isOpen={!!selectedBuyProduct}
        onClose={() => setSelectedBuyProduct(null)}
        product={selectedBuyProduct}
      />
    </div>
  );
}

export function StoreTemplate(props: StoreTemplateProps) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center text-gray-500 font-medium">Chargement du rayon...</div>}>
      <StoreTemplateContent {...props} />
    </Suspense>
  );
}
