"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { 
  Search, 
  X, 
  Wifi, 
  Building2, 
  Shirt, 
  UtensilsCrossed, 
  ArrowRight, 
  Sparkles,
  Hotel,
  Tag
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useCurrency } from "@/context/CurrencyContext";

interface UniversalSearchBarProps {
  products?: any[];
  properties?: any[];
}

export function UniversalSearchBar({ products = [], properties = [] }: UniversalSearchBarProps) {
  const router = useRouter();
  const { formatPrice } = useCurrency();
  const [query, setQuery] = useState("");
  const [selectedRayon, setSelectedRayon] = useState<"all" | "connect" | "immo" | "mode" | "saveurs">("all");
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSearchSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanQuery = query.trim();
    if (!cleanQuery) return;

    setIsOpen(false);

    if (selectedRayon === "immo") {
      router.push(`/rayon/immo?search=${encodeURIComponent(cleanQuery)}`);
      return;
    }
    if (selectedRayon === "connect") {
      router.push(`/rayon/connect?search=${encodeURIComponent(cleanQuery)}`);
      return;
    }
    if (selectedRayon === "mode") {
      router.push(`/rayon/mode?search=${encodeURIComponent(cleanQuery)}`);
      return;
    }
    if (selectedRayon === "saveurs") {
      router.push(`/rayon/saveurs?search=${encodeURIComponent(cleanQuery)}`);
      return;
    }

    // Auto-detect intent if 'all' is selected
    const q = cleanQuery.toLowerCase();
    const immoKeywords = ["hotel", "hôtel", "chambre", "sejour", "séjour", "appart", "appartement", "maison", "villa", "terrain", "bureau", "parcelle", "gombe", "kintambo", "ngaliema", "limete", "bandal", "locat", "louer", "vente", "bail"];
    const modeKeywords = ["robe", "costume", "chemise", "veste", "pantalon", "chaussure", "habit", "vetement", "vêtement", "sneakers", "talon", "sac", "mode"];
    const saveursKeywords = ["plat", "restaurant", "resto", "manger", "repas", "cuisine", "epice", "épice", "marmite", "saveur", "boisson", "traiteur", "chef"];

    if (immoKeywords.some(k => q.includes(k))) {
      router.push(`/rayon/immo?search=${encodeURIComponent(cleanQuery)}`);
      return;
    }
    if (modeKeywords.some(k => q.includes(k))) {
      router.push(`/rayon/mode?search=${encodeURIComponent(cleanQuery)}`);
      return;
    }
    if (saveursKeywords.some(k => q.includes(k))) {
      router.push(`/rayon/saveurs?search=${encodeURIComponent(cleanQuery)}`);
      return;
    }

    // Default to connect
    router.push(`/rayon/connect?search=${encodeURIComponent(cleanQuery)}`);
  };

  // Compute live matching items
  const cleanQ = query.trim().toLowerCase();
  const matchingProducts = cleanQ.length >= 2 ? products.filter(p => {
    const title = (p.title?.fr || p.title?.en || p.title || "").toString().toLowerCase();
    const brand = (p.brand || "").toString().toLowerCase();
    const cat = (p.category || "").toString().toLowerCase();
    return title.includes(cleanQ) || brand.includes(cleanQ) || cat.includes(cleanQ);
  }).slice(0, 4) : [];

  const matchingProperties = cleanQ.length >= 2 ? properties.filter(p => {
    const title = (p.title?.fr || p.title || "").toString().toLowerCase();
    const loc = (p.location || "").toString().toLowerCase();
    const type = (p.type || "").toString().toLowerCase();
    return title.includes(cleanQ) || loc.includes(cleanQ) || type.includes(cleanQ);
  }).slice(0, 3) : [];

  const hasLiveResults = matchingProducts.length > 0 || matchingProperties.length > 0;

  return (
    <div ref={containerRef} className="relative w-full max-w-3xl mx-auto z-30">
      
      {/* Category Pills */}
      <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-2 scrollbar-none mb-2 text-xs font-semibold">
        <button
          type="button"
          onClick={() => setSelectedRayon("all")}
          className={`px-3 py-1.5 rounded-full transition-all whitespace-nowrap flex items-center gap-1.5 ${
            selectedRayon === "all"
              ? "bg-[#C7D300] text-[#0F1D27] shadow-sm font-bold"
              : "bg-white/10 hover:bg-white/20 text-white/90 border border-white/10 backdrop-blur-md"
          }`}
        >
          <Sparkles size={13} />
          Tous les rayons
        </button>

        <button
          type="button"
          onClick={() => setSelectedRayon("connect")}
          className={`px-3 py-1.5 rounded-full transition-all whitespace-nowrap flex items-center gap-1.5 ${
            selectedRayon === "connect"
              ? "bg-[#00B5A5] text-white shadow-sm font-bold"
              : "bg-white/10 hover:bg-white/20 text-white/90 border border-white/10 backdrop-blur-md"
          }`}
        >
          <Wifi size={13} />
          Connect
        </button>

        <button
          type="button"
          onClick={() => setSelectedRayon("immo")}
          className={`px-3 py-1.5 rounded-full transition-all whitespace-nowrap flex items-center gap-1.5 ${
            selectedRayon === "immo"
              ? "bg-[#4C6EF5] text-white shadow-sm font-bold"
              : "bg-white/10 hover:bg-white/20 text-white/90 border border-white/10 backdrop-blur-md"
          }`}
        >
          <Building2 size={13} />
          Immo & Hôtels
        </button>

        <button
          type="button"
          onClick={() => setSelectedRayon("mode")}
          className={`px-3 py-1.5 rounded-full transition-all whitespace-nowrap flex items-center gap-1.5 ${
            selectedRayon === "mode"
              ? "bg-[#D4B08C] text-[#0F1D27] shadow-sm font-bold"
              : "bg-white/10 hover:bg-white/20 text-white/90 border border-white/10 backdrop-blur-md"
          }`}
        >
          <Shirt size={13} />
          Mode
        </button>

        <button
          type="button"
          onClick={() => setSelectedRayon("saveurs")}
          className={`px-3 py-1.5 rounded-full transition-all whitespace-nowrap flex items-center gap-1.5 ${
            selectedRayon === "saveurs"
              ? "bg-[#FF6B35] text-white shadow-sm font-bold"
              : "bg-white/10 hover:bg-white/20 text-white/90 border border-white/10 backdrop-blur-md"
          }`}
        >
          <UtensilsCrossed size={13} />
          Saveurs
        </button>
      </div>

      {/* Main Search Input Form */}
      <form onSubmit={handleSearchSubmit} className="relative flex items-center shadow-2xl rounded-2xl bg-white p-1.5 border border-white/20 focus-within:ring-4 focus-within:ring-[#C7D300]/30 transition-all">
        <div className="pl-3.5 pr-2 text-gray-400">
          <Search size={20} className="text-gray-500" />
        </div>

        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={
            selectedRayon === "immo"
              ? "Rechercher un hôtel, appartement, villa à Kinshasa (ex: Gombe, Ngaliema)..."
              : selectedRayon === "connect"
              ? "Rechercher un équipement tech (ex: Starlink, routeur Wi-Fi, caméra)..."
              : selectedRayon === "mode"
              ? "Rechercher un vêtement, costume, robe de créateur..."
              : selectedRayon === "saveurs"
              ? "Rechercher un plat, ustensile de cuisine, traiteur..."
              : "Rechercher sur tout Rayons (ex: Starlink, Hôtel Gombe, Veste, Repas)..."
          }
          className="w-full py-2.5 sm:py-3 text-sm sm:text-base text-gray-900 placeholder:text-gray-400 focus:outline-hidden bg-transparent pr-8"
        />

        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setIsOpen(false);
            }}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-full transition-colors mr-1"
            title="Effacer"
          >
            <X size={16} />
          </button>
        )}

        <button
          type="submit"
          className="shrink-0 bg-[#0F1D27] hover:bg-[#1a2d3b] text-white px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl font-heading font-bold text-xs sm:text-sm flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-md"
        >
          <span>Rechercher</span>
          <ArrowRight size={15} />
        </button>
      </form>

      {/* Live Auto-Suggest Dropdown */}
      {isOpen && cleanQ.length >= 2 && (
        <div className="absolute left-0 right-0 top-full mt-2 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden z-50 animate-in fade-in-50 duration-150">
          
          {hasLiveResults ? (
            <div className="divide-y divide-gray-100 max-h-[420px] overflow-y-auto">
              
              {/* Matching Products */}
              {matchingProducts.length > 0 && (
                <div className="p-3">
                  <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider px-2 mb-2 flex items-center gap-1">
                    <Tag size={12} /> Produits & Équipements
                  </div>
                  <div className="space-y-1">
                    {matchingProducts.map((prod) => (
                      <Link
                        key={prod.id}
                        href={`/product/${prod.id}`}
                        onClick={() => setIsOpen(false)}
                        className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-xl transition-colors group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-lg bg-gray-100 overflow-hidden shrink-0 relative">
                            {prod.imageUrl || prod.image ? (
                              <img 
                                src={prod.imageUrl || prod.image} 
                                alt={prod.title?.fr || prod.title || "Produit"} 
                                className="w-full h-full object-cover" 
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                                📦
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate group-hover:text-primary transition-colors">
                              {prod.title?.fr || prod.title?.en || prod.title}
                            </p>
                            <span className="text-xs text-gray-400 capitalize">
                              {prod.category || prod.rayon || "Article"}
                            </span>
                          </div>
                        </div>
                        <div className="text-right shrink-0 pl-2">
                          <span className="text-xs font-bold text-gray-900">{formatPrice(prod.price)}</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Matching Properties & Hotels */}
              {matchingProperties.length > 0 && (
                <div className="p-3 bg-gray-50/50">
                  <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider px-2 mb-2 flex items-center gap-1">
                    <Hotel size={12} /> Rayons Immo & Hôtels
                  </div>
                  <div className="space-y-1">
                    {matchingProperties.map((prop) => (
                      <Link
                        key={prop.id}
                        href={`/rayon/immo?search=${encodeURIComponent(prop.title?.fr || prop.title || prop.location || "")}`}
                        onClick={() => setIsOpen(false)}
                        className="flex items-center justify-between p-2 hover:bg-white rounded-xl transition-colors group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                            <Building2 size={18} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate group-hover:text-blue-600 transition-colors">
                              {prop.title?.fr || prop.title || "Bien immobilier"}
                            </p>
                            <span className="text-xs text-gray-400">
                              {prop.location || prop.typeTransaction || "Kinshasa"}
                            </span>
                          </div>
                        </div>
                        <div className="text-right shrink-0 pl-2">
                          <span className="text-xs font-bold text-blue-600">
                            {prop.price ? formatPrice(prop.price) : "Voir offre"}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* View all button in dropdown */}
              <div className="p-2.5 bg-gray-50 text-center">
                <button
                  type="button"
                  onClick={() => handleSearchSubmit()}
                  className="text-xs font-bold text-primary hover:underline flex items-center justify-center gap-1.5 w-full py-1"
                >
                  <span>Afficher tous les résultats pour "{query}"</span>
                  <ArrowRight size={13} />
                </button>
              </div>

            </div>
          ) : (
            <div className="p-6 text-center text-gray-500">
              <Search size={28} className="mx-auto text-gray-300 mb-2" />
              <p className="text-xs font-medium text-gray-700">Appuyez sur Entrée pour rechercher "{query}"</p>
              <button
                type="button"
                onClick={() => handleSearchSubmit()}
                className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
              >
                Lancer la recherche globale <ArrowRight size={13} />
              </button>
            </div>
          )}

        </div>
      )}

    </div>
  );
}
