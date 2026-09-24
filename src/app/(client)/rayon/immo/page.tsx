"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { 
  Home as HomeIcon, Wifi, Building2, Globe, MapPin, Maximize, 
  BedDouble, Bath, ChevronRight, Shirt, User, MessageSquare,
  Hotel, Star, Sparkles, Zap, Waves, CalendarCheck
} from "lucide-react";
import { RayonNavbar } from "@/modules/client/components/rayon/RayonNavbar";
import { collection, onSnapshot, query, where, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ProductSkeleton } from "@/modules/shared/components/ui/Skeleton";
import { useAuth } from "@/context/AuthContext";
import { useChat } from "@/context/ChatContext";
import { useCurrency } from "@/context/CurrencyContext";
import { ImmoContactModal } from "@/modules/client/components/ImmoContactModal";
import PropertyDetailModal from "@/modules/shared/components/properties/PropertyDetailModal";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

const DICT = {
  fr: {
    home: "Accueil",
    connect: "Connect",
    immo: "Immo",
    mode: "Mode",
    saveurs: "Saveurs",
    login: "Se connecter",
    title: "Trouvez le bien de vos rêves",
    subtitle: "Découvrez notre sélection exclusive : habitations de standing (villas, appartements) et établissements hôteliers de prestige.",
    tag: "Immobilier & Hôtellerie Premium",
    all: "Tous les biens",
    sale: "🏠 Habitation : À Vendre",
    rent: "🏠 Habitation : À Louer",
    hotels: "🏨 Hôtels & Nuitées",
    appointment: "Prendre RDV",
  },
  en: {
    home: "Home",
    connect: "Connect",
    immo: "Immo",
    mode: "Fashion",
    saveurs: "Flavors",
    login: "Login",
    title: "Find your dream home",
    subtitle: "Discover our exclusive selection: residential homes (villas, apartments) and prestigious hotels.",
    tag: "Premium Real Estate & Hospitality",
    all: "All properties",
    sale: "🏠 Homes: For Sale",
    rent: "🏠 Homes: For Rent",
    hotels: "🏨 Hotels & Stays",
    appointment: "Book Appointment",
  }
};

function ImmoContent() {
  const [lang, setLang] = useState<"fr" | "en">("fr");
  const t = DICT[lang];
  const { user, loading, signOut } = useAuth();
  const { openChatForProduct } = useChat();
  const { formatPrice } = useCurrency();
  const [products, setProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<"all" | "sale" | "rent" | "hotel">("all");
  
  // Recherche avancée et filtres multicritères
  const [searchQuery, setSearchQuery] = useState("");
  const searchParams = useSearchParams();

  useEffect(() => {
    const s = searchParams.get("search");
    const c = searchParams.get("category");
    if (s) setSearchQuery(s);
    if (c && ["all", "sale", "rent", "hotel"].includes(c)) {
      setSelectedCategory(c as any);
    }
  }, [searchParams]);
  const [minPrice, setMinPrice] = useState<number | "">("");
  const [maxPrice, setMaxPrice] = useState<number | "">("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [bedFilter, setBedFilter] = useState("all");
  const [filterGenerator, setFilterGenerator] = useState(false);
  const [filterAc, setFilterAc] = useState(false);
  const [filterPool, setFilterPool] = useState(false);

  // Modales
  const [contactProperty, setContactProperty] = useState<any | null>(null);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [selectedDetailProperty, setSelectedDetailProperty] = useState<any | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  useEffect(() => {
    const q = query(
      collection(db, "properties"), 
      where("status", "==", "Disponible"),
      limit(50)
    );
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const productsList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setProducts(productsList);
      setIsLoading(false);
    }, (error) => {
      console.error("Error subscribing to properties:", error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filteredProducts = products.filter(property => {
    const trans = (property.typeTransaction || "").toLowerCase().trim();
    const type = (property.type || "").toLowerCase().trim();
    const isHotel = property.immoBranch === "hotel" || type === "hotel" || trans.includes("hotel") || trans.includes("nuit") || trans.includes("réservation") || trans.includes("reservation") || trans.includes("journali") || !!property.hotelDetails;

    // 1. Category Tab Filter
    if (selectedCategory === "hotel" && !isHotel) return false;
    if (selectedCategory === "sale" && (isHotel || (!trans.includes("vent") && !trans.includes("vendre") && trans !== "sale"))) return false;
    if (selectedCategory === "rent" && (isHotel || (!trans.includes("locat") && !trans.includes("lou") && !trans.includes("coloc") && trans !== "rent" && (!trans && property.immoBranch !== "habitation")))) return false;

    // 2. Text Search Query (Location, Title, Description)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const titleMatch = (property.title?.[lang] || property.title?.fr || property.title || "").toLowerCase().includes(q);
      const locMatch = (property.location || "").toLowerCase().includes(q);
      const descMatch = (property.description || "").toLowerCase().includes(q);
      if (!titleMatch && !locMatch && !descMatch) return false;
    }

    // 3. Price Filter
    const price = Number(property.price || 0);
    if (minPrice !== "" && price < Number(minPrice)) return false;
    if (maxPrice !== "" && price > Number(maxPrice)) return false;

    // 4. Property Type Filter
    if (typeFilter !== "all") {
      if (typeFilter === "hotel" && !isHotel) return false;
      if (typeFilter !== "hotel" && type !== typeFilter) return false;
    }

    // 5. Bedrooms Filter
    if (bedFilter !== "all") {
      const beds = Number(property.immoDetails?.beds || 0);
      const targetBeds = parseInt(bedFilter);
      if (beds < targetBeds) return false;
    }

    // 6. Amenities Filter
    if (filterGenerator && !property.hotelDetails?.amenities?.includes("generator") && !property.amenities?.includes("generator")) {
      return false;
    }
    if (filterAc && !property.hotelDetails?.amenities?.includes("ac") && !property.amenities?.includes("ac")) {
      return false;
    }
    if (filterPool && !property.hotelDetails?.amenities?.includes("pool") && !property.amenities?.includes("pool")) {
      return false;
    }

    return true;
  });

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <RayonNavbar 
        category="immo"
        lang={lang}
        setLang={setLang}
        t={t}
      />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Immo Hero */}
        <div className="relative rounded-2xl sm:rounded-3xl overflow-hidden mb-6 sm:mb-8 shadow-lg h-[220px] sm:h-[280px]">
          <img 
            src="https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&q=80&w=2000" 
            alt="Modern House" 
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-green-950/90 via-green-900/60 to-transparent"></div>
          <div className="absolute inset-0 flex flex-col justify-center px-6 sm:px-10 md:px-14 w-full md:w-2/3">
            <span className="inline-block px-2.5 py-0.5 bg-white/20 text-white text-[11px] font-bold tracking-wider rounded-full mb-2.5 border border-white/30 uppercase w-max">
              {t.tag}
            </span>
            <motion.h1 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white tracking-tight leading-tight mb-2"
            >
              {t.title}
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.15 }}
              className="text-xs sm:text-sm text-green-50/90 max-w-lg hidden sm:block"
            >
              {t.subtitle}
            </motion.p>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex space-x-3 mb-6 overflow-x-auto pb-2">
          <button 
            onClick={() => setSelectedCategory("all")}
            className={`px-5 py-2 font-semibold rounded-full text-sm transition-all whitespace-nowrap ${
              selectedCategory === "all" ? "bg-gray-900 text-white shadow-md" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            {t.all}
          </button>
          <button 
            onClick={() => setSelectedCategory("hotel")}
            className={`px-5 py-2 font-semibold rounded-full text-sm transition-all whitespace-nowrap flex items-center gap-1.5 ${
              selectedCategory === "hotel" 
                ? "bg-gray-900 text-white shadow-md" 
                : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300"
            }`}
          >
            <Hotel size={16} className={selectedCategory === "hotel" ? "text-amber-400" : "text-amber-600"} />
            <span>{t.hotels}</span>
          </button>
          <button 
            onClick={() => setSelectedCategory("sale")}
            className={`px-5 py-2 font-semibold rounded-full text-sm transition-all whitespace-nowrap ${
              selectedCategory === "sale" ? "bg-green-700 text-white shadow-md" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            {t.sale}
          </button>
          <button 
            onClick={() => setSelectedCategory("rent")}
            className={`px-5 py-2 font-semibold rounded-full text-sm transition-all whitespace-nowrap ${
              selectedCategory === "rent" ? "bg-blue-700 text-white shadow-md" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            {t.rent}
          </button>
        </div>

        {/* Multi-Criteria Advanced Search Toolbar */}
        <div className="bg-white border border-gray-200/80 rounded-2xl p-3.5 sm:p-4 mb-6 shadow-xs space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            {/* Search Input */}
            <div className="md:col-span-5 relative">
              <input
                type="text"
                placeholder="Rechercher par commune, quartier, mot-clé (ex: Gombe, Piscine, Villa)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-4 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-600"
              />
            </div>

            {/* Type Filter */}
            <div className="md:col-span-3">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-600"
              >
                <option value="all">Tous les types de biens</option>
                <option value="appartement">Appartement</option>
                <option value="villa">Villa / Maison</option>
                <option value="studio">Studio</option>
                <option value="bureau">Bureau / Local commercial</option>
                <option value="terrain">Terrain</option>
                <option value="hotel">Chambre / Suite d'Hôtel</option>
              </select>
            </div>

            {/* Price Range */}
            <div className="md:col-span-2">
              <input
                type="number"
                placeholder="Prix Min ($)"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value === "" ? "" : Number(e.target.value))}
                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-600"
              />
            </div>
            <div className="md:col-span-2">
              <input
                type="number"
                placeholder="Prix Max ($)"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value === "" ? "" : Number(e.target.value))}
                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-600"
              />
            </div>
          </div>

          {/* Secondary Quick Filters: Bedrooms & Amenities */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-gray-100">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-500 uppercase">Chambres :</span>
              {["all", "1", "2", "3", "4"].map((b) => (
                <button
                  key={b}
                  onClick={() => setBedFilter(b)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                    bedFilter === b
                      ? "bg-gray-900 text-white shadow-xs"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {b === "all" ? "Toutes" : `${b}+`}
                </button>
              ))}
            </div>

            {/* Amenities toggles */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-gray-500 uppercase">Commodités :</span>
              <button
                onClick={() => setFilterGenerator(!filterGenerator)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
                  filterGenerator ? "bg-amber-500 text-black shadow-xs font-bold" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                ⚡ <span>Groupe 24/7</span>
              </button>
              <button
                onClick={() => setFilterAc(!filterAc)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
                  filterAc ? "bg-sky-500 text-white shadow-xs font-bold" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                ❄️ <span>Clim</span>
              </button>
              <button
                onClick={() => setFilterPool(!filterPool)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
                  filterPool ? "bg-teal-500 text-white shadow-xs font-bold" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                🏊 <span>Piscine</span>
              </button>

              {(searchQuery || minPrice !== "" || maxPrice !== "" || typeFilter !== "all" || bedFilter !== "all" || filterGenerator || filterAc || filterPool) && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setMinPrice("");
                    setMaxPrice("");
                    setTypeFilter("all");
                    setBedFilter("all");
                    setFilterGenerator(false);
                    setFilterAc(false);
                    setFilterPool(false);
                  }}
                  className="text-xs text-red-600 hover:underline font-medium ml-2"
                >
                  Réinitialiser les filtres
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Results Counter */}
        <div className="mb-6 flex items-center justify-between text-sm text-gray-500">
          <span>{filteredProducts.length} bien(s) correspondant à vos critères</span>
        </div>

        {/* Properties Grid - Dense Compact Alibaba/Booking style */}
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
          {isLoading ? (
            Array.from({ length: 10 }).map((_, i) => (
              <ProductSkeleton key={i} />
            ))
          ) : filteredProducts.length === 0 ? (
            <div className="col-span-full py-16 text-center text-gray-500 bg-white rounded-2xl border border-gray-100">
              <Hotel size={48} className="mx-auto text-gray-300 mb-3" />
              <p className="font-semibold">Aucun bien disponible dans cette catégorie pour le moment.</p>
              <button onClick={() => setSelectedCategory("all")} className="mt-3 text-sm text-green-700 hover:underline">
                Voir tous les biens
              </button>
            </div>
          ) : (
            filteredProducts.map((property, idx) => {
              const trans = (property.typeTransaction || "").toLowerCase().trim();
              const isHotel = property.immoBranch === "hotel" || property.type === "hotel" || trans.includes("hotel") || trans.includes("nuit") || trans.includes("réservation") || trans.includes("reservation") || trans.includes("journali") || !!property.hotelDetails;
              const isSale = !isHotel && (trans.includes("vent") || trans.includes("vendre") || trans === "sale");

              return (
                <motion.div
                  key={property.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(idx * 0.05, 0.4), duration: 0.35 }}
                  className="bg-white rounded-xl sm:rounded-2xl border border-gray-200/75 shadow-2xs hover:shadow-md transition-all duration-300 group flex flex-col overflow-hidden"
                >
                  {/* Image with click to open detail - Aspect 4/3 */}
                  <div 
                    onClick={() => {
                      setSelectedDetailProperty(property);
                      setIsDetailModalOpen(true);
                    }}
                    className="relative aspect-[4/3] w-full overflow-hidden cursor-pointer bg-gray-100"
                  >
                    <img 
                      src={property.image} 
                      alt={property.title?.[lang] || property.title?.fr || property.title}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    
                    {/* Badge top left */}
                    <div className="absolute top-2 left-2">
                      {isHotel ? (
                        <span className="px-2 py-0.5 text-[9px] sm:text-[10px] font-bold tracking-wider rounded-md uppercase bg-black/85 text-white border border-white/20 backdrop-blur-md shadow-xs flex items-center gap-1">
                          <Hotel size={10} className="text-amber-400" />
                          {property.hotelDetails?.stars && !isNaN(parseInt(property.hotelDetails.stars)) ? (
                            <>
                              <span className="text-amber-400 font-bold">{property.hotelDetails.stars}★</span>
                              <span className="text-gray-100 font-semibold hidden sm:inline">HÔTEL</span>
                            </>
                          ) : (
                            <span>HÔTEL</span>
                          )}
                        </span>
                      ) : (
                        <span className={`px-2 py-0.5 text-[9px] sm:text-[10px] font-bold tracking-wider rounded-md border uppercase backdrop-blur-md shadow-xs ${
                          isSale 
                            ? "bg-white/95 text-emerald-800 border-emerald-200/80" 
                            : "bg-white/95 text-blue-800 border-blue-200/80"
                        }`}>
                          {isSale ? "À Vendre" : "À Louer"}
                        </span>
                      )}
                    </div>

                    {/* Rating badge top right */}
                    <div className="absolute top-2 right-2">
                      <span className="px-1.5 py-0.5 text-[9px] sm:text-[10px] font-bold rounded-md bg-black/75 text-amber-400 border border-white/20 backdrop-blur-md shadow-xs flex items-center gap-0.5">
                        <Star size={10} className="fill-amber-400 text-amber-400" />
                        <span>{property.averageRating ? property.averageRating.toFixed(1) : "5.0"}</span>
                      </span>
                    </div>

                    {/* Price overlay bottom */}
                    <div className="absolute bottom-0 inset-x-0 p-2 sm:p-2.5 bg-gradient-to-t from-black/85 via-black/40 to-transparent">
                      <div className="text-sm sm:text-base font-extrabold text-white drop-shadow-xs flex items-baseline gap-1">
                        {formatPrice(property.price)}
                        {isHotel ? (
                          <span className="text-[10px] sm:text-xs font-normal text-gray-200">/ nuit</span>
                        ) : !isSale ? (
                          <span className="text-[10px] sm:text-xs font-normal text-gray-200">/ mois</span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  {/* Info Body */}
                  <div className="p-2.5 sm:p-3 flex-1 flex flex-col justify-between">
                    <div>
                      <h3 
                        onClick={() => {
                          setSelectedDetailProperty(property);
                          setIsDetailModalOpen(true);
                        }}
                        className="text-xs sm:text-sm font-bold text-gray-900 leading-snug cursor-pointer hover:text-green-700 transition-colors line-clamp-1 mb-1"
                        title={property.title?.[lang] || property.title?.fr || property.title}
                      >
                        {property.title?.[lang] || property.title?.fr || property.title}
                      </h3>
                      
                      <div className="flex items-center text-gray-500 text-[11px] mb-2">
                        <MapPin size={12} className="mr-0.5 text-green-600 shrink-0" />
                        <span className="truncate">{property.location}</span>
                      </div>

                      {/* Features / Prestations */}
                      {isHotel ? (
                        <div className="flex items-center gap-1 text-[10px] text-gray-600 py-1 border-t border-b border-gray-100 mb-2.5 flex-wrap">
                          {property.hotelDetails?.amenities?.includes("generator") && (
                            <span className="px-1.5 py-0.5 bg-amber-50 text-amber-800 rounded font-medium text-[9px] sm:text-[10px]">
                              ⚡ 24/7
                            </span>
                          )}
                          {property.hotelDetails?.amenities?.includes("wifi") && (
                            <span className="px-1.5 py-0.5 bg-blue-50 text-blue-800 rounded font-medium text-[9px] sm:text-[10px]">
                              📶 Wifi
                            </span>
                          )}
                          {property.hotelDetails?.amenities?.includes("ac") && (
                            <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-800 rounded font-medium text-[9px] sm:text-[10px]">
                              ❄️ Clim
                            </span>
                          )}
                          {property.hotelDetails?.amenities?.includes("pool") && (
                            <span className="px-1.5 py-0.5 bg-cyan-50 text-cyan-800 rounded font-medium text-[9px] sm:text-[10px]">
                              🏊 Piscine
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center justify-between text-[10px] sm:text-[11px] text-gray-600 py-1 border-t border-b border-gray-100 mb-2.5 font-medium">
                          {property.immoDetails?.area ? (
                            <div className="flex items-center gap-1">
                              <Maximize size={12} className="text-gray-400" />
                              <span>{property.immoDetails.area} m²</span>
                            </div>
                          ) : null}
                          {property.immoDetails?.beds > 0 ? (
                            <div className="flex items-center gap-1">
                              <BedDouble size={12} className="text-gray-400" />
                              <span>{property.immoDetails.beds} ch</span>
                            </div>
                          ) : null}
                          {property.immoDetails?.baths > 0 ? (
                            <div className="flex items-center gap-1">
                              <Bath size={12} className="text-gray-400" />
                              <span>{property.immoDetails.baths} sdb</span>
                            </div>
                          ) : null}
                        </div>
                      )}
                    </div>
                    
                    {/* Actions */}
                    <div className="mt-auto flex items-center gap-1.5 pt-1">
                      <button 
                        onClick={() => {
                          setContactProperty(property);
                          setIsContactModalOpen(true);
                        }}
                        className={`flex-1 py-1.5 sm:py-2 px-2 text-white text-[11px] sm:text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 shadow-2xs ${
                          isHotel 
                            ? "bg-gradient-to-r from-gray-900 via-neutral-900 to-black hover:bg-black border border-amber-500/20" 
                            : "bg-gray-900 hover:bg-gray-800"
                        }`}
                      >
                        <CalendarCheck size={13} className={isHotel ? "text-amber-400" : "text-white"} />
                        <span className="truncate">{isHotel ? "Réserver" : "Prendre RDV"}</span>
                      </button>

                      <button 
                        onClick={() => {
                          openChatForProduct({
                            id: property.id,
                            supplierId: property.supplierId || "admin",
                            name: property.title?.[lang] || property.title?.fr || property.title,
                            type: isHotel ? "hotel" : "property"
                          });
                        }}
                        title={isHotel ? "Contacter l'hôtel" : "Discuter directement"}
                        className="p-1.5 sm:p-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors shrink-0"
                      >
                        <MessageSquare size={13} />
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>

      </main>

      {/* Property Detail Modal */}
      <PropertyDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        property={selectedDetailProperty}
        lang={lang}
        onBook={(prop) => {
          setContactProperty(prop);
          setIsContactModalOpen(true);
        }}
        onChat={(prop) => {
          const trans = (prop.typeTransaction || "").toLowerCase();
          const isHotel = prop.immoBranch === "hotel" || prop.type === "hotel" || trans.includes("hotel") || trans.includes("nuit");
          openChatForProduct({
            id: prop.id,
            supplierId: prop.supplierId || "admin",
            name: prop.title?.[lang] || prop.title?.fr || prop.title,
            type: isHotel ? "hotel" : "property"
          });
        }}
      />

      {/* Contact / Reservation Modal */}
      <ImmoContactModal 
        isOpen={isContactModalOpen} 
        onClose={() => setIsContactModalOpen(false)} 
        property={contactProperty} 
      />
    </div>
  );
}

export default function ImmoPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-500 font-medium">Chargement Rayons Immo...</div>}>
      <ImmoContent />
    </Suspense>
  );
}
