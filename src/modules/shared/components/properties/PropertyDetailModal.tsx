"use client";

import { useState } from "react";
import { 
  X, MapPin, Maximize, BedDouble, Bath, Hotel, 
  CalendarCheck, MessageSquare, Zap, Wifi, Waves, 
  Shield, Sparkles, ChevronLeft, ChevronRight, CheckCircle2,
  Star
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ReviewsSection from "@/modules/shared/components/reviews/ReviewsSection";
import { useCurrency } from "@/context/CurrencyContext";

interface PropertyDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  property: any | null;
  lang?: "fr" | "en";
  onBook: (property: any) => void;
  onChat: (property: any) => void;
}

export default function PropertyDetailModal({
  isOpen,
  onClose,
  property,
  lang = "fr",
  onBook,
  onChat
}: PropertyDetailModalProps) {
  const { formatPrice } = useCurrency();
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);

  if (!isOpen || !property) return null;

  const title = property.title?.[lang] || property.title?.fr || property.title;
  const description = property.description || "Aucune description détaillée fournie pour ce bien.";
  
  const trans = (property.typeTransaction || "").toLowerCase().trim();
  const isHotel = property.immoBranch === "hotel" || property.type === "hotel" || trans.includes("hotel") || trans.includes("nuit") || trans.includes("réservation") || !!property.hotelDetails;
  const isSale = !isHotel && (trans.includes("vent") || trans.includes("vendre") || trans === "sale");

  // Photos list: main image + any extra photos
  const photos: string[] = [
    property.image,
    ...(property.gallery || property.photos || [])
  ].filter(Boolean);

  const nextPhoto = () => {
    setActivePhotoIndex((prev) => (prev + 1) % photos.length);
  };

  const prevPhoto = () => {
    setActivePhotoIndex((prev) => (prev - 1 + photos.length) % photos.length);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden my-8 max-h-[92vh] flex flex-col text-gray-900 border border-gray-100"
        >
          {/* Top Bar with Title & Close */}
          <div className="flex items-center justify-between p-5 border-b border-gray-100 bg-gray-50/80 sticky top-0 z-20">
            <div className="flex items-center gap-2">
              <span className={`px-3 py-1 text-xs font-bold uppercase rounded-full tracking-wider ${
                isHotel 
                  ? "bg-amber-100 text-amber-900 border border-amber-300"
                  : isSale 
                  ? "bg-emerald-100 text-emerald-900 border border-emerald-300"
                  : "bg-blue-100 text-blue-900 border border-blue-300"
              }`}>
                {isHotel ? "🏨 Établissement Hôtelier" : isSale ? "🏠 Habitation À Vendre" : "🏠 Habitation À Louer"}
              </span>
              {property.status === "Disponible" && (
                <span className="px-2.5 py-0.5 bg-green-50 text-green-700 text-xs font-semibold rounded-full flex items-center gap-1 border border-green-200">
                  <CheckCircle2 size={12} />
                  <span>Disponible</span>
                </span>
              )}
            </div>

            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-200 rounded-full transition-colors"
            >
              <X size={22} />
            </button>
          </div>

          {/* Modal Body */}
          <div className="overflow-y-auto p-6 space-y-6 flex-1">
            {/* Photo Gallery & Carousel */}
            <div className="space-y-3">
              <div className="relative h-80 sm:h-96 rounded-2xl overflow-hidden bg-gray-900 shadow-inner group">
                <img
                  src={photos[activePhotoIndex] || property.image}
                  alt={title}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                />

                {/* Left/Right buttons */}
                {photos.length > 1 && (
                  <>
                    <button
                      onClick={prevPhoto}
                      className="absolute left-3 top-1/2 -translate-y-1/2 p-2.5 bg-black/60 hover:bg-black/80 text-white rounded-full backdrop-blur-sm transition-all shadow-lg"
                    >
                      <ChevronLeft size={20} />
                    </button>
                    <button
                      onClick={nextPhoto}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 bg-black/60 hover:bg-black/80 text-white rounded-full backdrop-blur-sm transition-all shadow-lg"
                    >
                      <ChevronRight size={20} />
                    </button>
                    <div className="absolute bottom-3 right-3 px-3 py-1 bg-black/70 backdrop-blur-md rounded-full text-white text-xs font-bold">
                      {activePhotoIndex + 1} / {photos.length}
                    </div>
                  </>
                )}

                {/* Price Badge Overlay */}
                <div className="absolute bottom-4 left-4 p-3 bg-black/80 backdrop-blur-md rounded-2xl text-white shadow-xl">
                  <div className="text-2xl sm:text-3xl font-extrabold text-amber-400 flex items-baseline gap-1">
                    {formatPrice(property.price)}
                    {isHotel ? (
                      <span className="text-xs font-normal text-gray-200">/ nuitée</span>
                    ) : !isSale ? (
                      <span className="text-xs font-normal text-gray-200">/ mois</span>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* Thumbnails strip */}
              {photos.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {photos.map((ph, idx) => (
                    <button
                      key={idx}
                      onClick={() => setActivePhotoIndex(idx)}
                      className={`relative w-20 h-16 rounded-xl overflow-hidden shrink-0 border-2 transition-all ${
                        activePhotoIndex === idx
                          ? "border-amber-500 scale-95 shadow-md"
                          : "border-transparent opacity-60 hover:opacity-100"
                      }`}
                    >
                      <img src={ph} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Title & Location & Rating */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight leading-snug">
                  {title}
                </h1>
                <div className="flex items-center text-gray-600 text-sm mt-2">
                  <MapPin size={18} className="text-emerald-600 mr-1.5 shrink-0" />
                  <span className="font-medium">{property.location || "Kinshasa, RDC"}</span>
                </div>
              </div>

              {/* Rating pill */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200/80 rounded-2xl shrink-0 self-start">
                <Star size={16} className="text-amber-500 fill-amber-400" />
                <span className="text-sm font-extrabold text-amber-900">
                  {property.averageRating ? property.averageRating.toFixed(1) : "5.0"}
                </span>
                <span className="text-xs text-amber-700 font-medium">
                  ({property.ratingsCount || 0} avis)
                </span>
              </div>
            </div>

            {/* Quick Specs Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-gray-50 border border-gray-100 p-4 rounded-2xl">
              {isHotel ? (
                <>
                  <div className="p-3 bg-white rounded-xl shadow-xs border border-gray-100">
                    <p className="text-xs text-gray-500">Heure d'arrivée</p>
                    <p className="font-bold text-gray-900 mt-0.5">{property.hotelDetails?.checkInTime || "14h00"}</p>
                  </div>
                  <div className="p-3 bg-white rounded-xl shadow-xs border border-gray-100">
                    <p className="text-xs text-gray-500">Heure de départ</p>
                    <p className="font-bold text-gray-900 mt-0.5">{property.hotelDetails?.checkOutTime || "12h00"}</p>
                  </div>
                  <div className="p-3 bg-white rounded-xl shadow-xs border border-gray-100">
                    <p className="text-xs text-gray-500">Standing / Étoiles</p>
                    <p className="font-bold text-amber-600 mt-0.5">{property.hotelDetails?.stars || 4} ★</p>
                  </div>
                  <div className="p-3 bg-white rounded-xl shadow-xs border border-gray-100">
                    <p className="text-xs text-gray-500">Type de chambre</p>
                    <p className="font-bold text-gray-900 mt-0.5 capitalize">{property.hotelDetails?.subtype?.replace("_", " ") || "Standard"}</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="p-3 bg-white rounded-xl shadow-xs border border-gray-100 flex items-center gap-3">
                    <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                      <Maximize size={18} />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Superficie</p>
                      <p className="font-bold text-gray-900">{property.immoDetails?.area || "—"} m²</p>
                    </div>
                  </div>

                  <div className="p-3 bg-white rounded-xl shadow-xs border border-gray-100 flex items-center gap-3">
                    <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                      <BedDouble size={18} />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Chambres</p>
                      <p className="font-bold text-gray-900">{property.immoDetails?.beds || 0}</p>
                    </div>
                  </div>

                  <div className="p-3 bg-white rounded-xl shadow-xs border border-gray-100 flex items-center gap-3">
                    <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                      <Bath size={18} />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Salles de bain</p>
                      <p className="font-bold text-gray-900">{property.immoDetails?.baths || 0}</p>
                    </div>
                  </div>

                  <div className="p-3 bg-white rounded-xl shadow-xs border border-gray-100 flex items-center gap-3">
                    <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
                      <Sparkles size={18} />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Type</p>
                      <p className="font-bold text-gray-900 capitalize">{property.type || "Appartement"}</p>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Amenities & Prestations */}
            <div className="space-y-3">
              <h3 className="text-base font-bold text-gray-900">Équipements & Prestations</h3>
              <div className="flex flex-wrap gap-2">
                <span className="px-3 py-1.5 bg-amber-50 text-amber-900 border border-amber-200/80 rounded-xl text-xs font-semibold flex items-center gap-1.5">
                  <Zap size={14} className="text-amber-600" />
                  <span>Groupe Électrogène 24/7</span>
                </span>
                <span className="px-3 py-1.5 bg-blue-50 text-blue-900 border border-blue-200/80 rounded-xl text-xs font-semibold flex items-center gap-1.5">
                  <Wifi size={14} className="text-blue-600" />
                  <span>Wifi Haut Débit</span>
                </span>
                <span className="px-3 py-1.5 bg-cyan-50 text-cyan-900 border border-cyan-200/80 rounded-xl text-xs font-semibold flex items-center gap-1.5">
                  <Waves size={14} className="text-cyan-600" />
                  <span>Eau Courante & Réserve</span>
                </span>
                <span className="px-3 py-1.5 bg-indigo-50 text-indigo-900 border border-indigo-200/80 rounded-xl text-xs font-semibold flex items-center gap-1.5">
                  <Shield size={14} className="text-indigo-600" />
                  <span>Sécurité & Gardiennage 24/7</span>
                </span>
                {property.hotelDetails?.amenities?.includes("pool") && (
                  <span className="px-3 py-1.5 bg-teal-50 text-teal-900 border border-teal-200/80 rounded-xl text-xs font-semibold flex items-center gap-1.5">
                    🏊 <span>Piscine</span>
                  </span>
                )}
                {property.hotelDetails?.amenities?.includes("ac") && (
                  <span className="px-3 py-1.5 bg-sky-50 text-sky-900 border border-sky-200/80 rounded-xl text-xs font-semibold flex items-center gap-1.5">
                    ❄️ <span>Climatisation</span>
                  </span>
                )}
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <h3 className="text-base font-bold text-gray-900">Description Complète</h3>
              <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line bg-gray-50 p-4 rounded-2xl border border-gray-100">
                {description}
              </p>
            </div>

            {/* Reviews & Ratings Section */}
            <ReviewsSection
              targetType="property"
              targetId={property.id}
              targetTitle={title}
              initialAverage={property.averageRating || 0}
              initialCount={property.ratingsCount || 0}
              onRatingUpdated={(newAvg, newCount) => {
                property.averageRating = newAvg;
                property.ratingsCount = newCount;
              }}
            />
          </div>

          {/* Bottom Action Footer */}
          <div className="p-5 border-t border-gray-100 bg-gray-50 flex items-center gap-3">
            <button
              onClick={() => {
                onClose();
                onBook(property);
              }}
              className={`flex-1 py-3.5 text-white font-bold rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg ${
                isHotel
                  ? "bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600"
                  : "bg-gray-900 hover:bg-black"
              }`}
            >
              <CalendarCheck size={18} />
              <span>{isHotel ? "Réserver une Nuitée" : "Prendre RDV / Visiter ce bien"}</span>
            </button>

            <button
              onClick={() => {
                onClose();
                onChat(property);
              }}
              className="px-5 py-3.5 bg-white border border-gray-300 hover:bg-gray-100 text-gray-800 font-bold rounded-2xl transition-all flex items-center gap-2 shadow-xs"
            >
              <MessageSquare size={18} className="text-primary" />
              <span className="hidden sm:inline">Discuter avec l'Agent</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
