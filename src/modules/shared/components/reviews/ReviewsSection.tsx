"use client";

import { useState, useEffect } from "react";
import { Star, CheckCircle2, MessageSquare, Send, Loader2, Sparkles, User, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { collection, query, orderBy, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";

interface ReviewItem {
  id: string;
  clientId: string;
  clientName: string;
  rating: number;
  comment: string;
  createdAt?: any;
}

interface ReviewsSectionProps {
  targetType: "property" | "product";
  targetId: string;
  targetTitle?: string;
  initialAverage?: number;
  initialCount?: number;
  onRatingUpdated?: (newAvg: number, newCount: number) => void;
}

export default function ReviewsSection({
  targetType,
  targetId,
  targetTitle = "cette offre",
  initialAverage = 0,
  initialCount = 0,
  onRatingUpdated,
}: ReviewsSectionProps) {
  const { user } = useAuth();

  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [averageRating, setAverageRating] = useState(initialAverage);
  const [ratingsCount, setRatingsCount] = useState(initialCount);

  // Form states
  const [selectedStars, setSelectedStars] = useState(5);
  const [hoverStars, setHoverStars] = useState(0);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successFeedback, setSuccessFeedback] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [showForm, setShowForm] = useState(false);

  const starDescriptions: Record<number, string> = {
    1: "Très décevant",
    2: "Insatisfaisant",
    3: "Correct / Conforme",
    4: "Très bien",
    5: "Exceptionnel & Recommandé !",
  };

  const fetchReviews = async () => {
    try {
      setIsLoading(true);
      const colName = targetType === "product" ? "products" : "properties";
      const q = query(
        collection(db, colName, targetId, "reviews"),
        orderBy("createdAt", "desc")
      );
      const snap = await getDocs(q);
      const list: ReviewItem[] = [];
      let total = 0;

      snap.forEach((docSnap) => {
        const d = docSnap.data();
        const r = typeof d.rating === "number" ? d.rating : 5;
        total += r;
        list.push({
          id: docSnap.id,
          clientId: d.clientId || "",
          clientName: d.clientName || "Client Rayons",
          rating: r,
          comment: d.comment || "",
          createdAt: d.createdAt?.toDate ? d.createdAt.toDate() : d.createdAt || new Date(),
        });
      });

      setReviews(list);
      if (list.length > 0) {
        const avg = Math.round((total / list.length) * 10) / 10;
        setAverageRating(avg);
        setRatingsCount(list.length);
      }
    } catch (err) {
      console.error("Erreur chargement avis:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (targetId) {
      fetchReviews();
    }
  }, [targetId, targetType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setErrorMessage("Vous devez être connecté pour publier une évaluation.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");
    setSuccessFeedback("");

    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/reviews/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          targetType,
          targetId,
          clientId: user.uid,
          clientName: user.displayName || user.email?.split("@")[0] || "Client Rayons",
          clientEmail: user.email,
          rating: selectedStars,
          comment,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "Impossible d'enregistrer votre avis.");
      }

      setSuccessFeedback("Merci ! Votre avis et votre note ont été enregistrés avec succès.");
      setComment("");
      setShowForm(false);
      setAverageRating(data.newAverage);
      setRatingsCount(data.ratingsCount);
      if (onRatingUpdated) {
        onRatingUpdated(data.newAverage, data.ratingsCount);
      }
      await fetchReviews();

      setTimeout(() => setSuccessFeedback(""), 6000);
    } catch (err: any) {
      console.error("Submit review error:", err);
      setErrorMessage(err.message || "Une erreur est survenue.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Distribution calculation
  const distribution = [5, 4, 3, 2, 1].map((star) => {
    const count = reviews.filter((r) => r.rating === star).length;
    const percentage = ratingsCount > 0 ? Math.round((count / ratingsCount) * 100) : 0;
    return { star, count, percentage };
  });

  return (
    <div className="space-y-6 pt-4 border-t border-gray-100">
      {/* Header with Title & Action Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-lg sm:text-xl font-extrabold text-gray-900 flex items-center gap-2">
            <Sparkles className="text-amber-500" size={20} />
            <span>Avis & Évaluations Clients</span>
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Retours d'expérience et notes vérifiées de la communauté Rayons.
          </p>
        </div>

        {user ? (
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold text-xs sm:text-sm rounded-xl transition-all shadow-md flex items-center justify-center gap-2 shrink-0"
          >
            <Star size={16} className="fill-white" />
            <span>{showForm ? "Fermer le formulaire" : "Donner mon avis"}</span>
          </button>
        ) : (
          <Link
            href="/login"
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 shrink-0"
          >
            <User size={14} />
            <span>Connectez-vous pour noter</span>
          </Link>
        )}
      </div>

      {/* Success Notification */}
      {successFeedback && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2"
        >
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <span>{successFeedback}</span>
        </motion.div>
      )}

      {/* Write a Review Modal/Form */}
      <AnimatePresence>
        {showForm && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={handleSubmit}
            className="bg-amber-50/50 border border-amber-200/80 p-5 rounded-2xl space-y-4 overflow-hidden"
          >
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-sm text-gray-900">Votre évaluation</h4>
              <span className="text-xs font-semibold text-amber-700">
                {starDescriptions[hoverStars || selectedStars]}
              </span>
            </div>

            {/* Interactive Stars */}
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  type="button"
                  key={star}
                  onClick={() => setSelectedStars(star)}
                  onMouseEnter={() => setHoverStars(star)}
                  onMouseLeave={() => setHoverStars(0)}
                  className="p-1.5 rounded-lg transition-transform hover:scale-125 focus:outline-none"
                >
                  <Star
                    size={28}
                    className={`transition-colors ${
                      star <= (hoverStars || selectedStars)
                        ? "text-amber-500 fill-amber-400 drop-shadow-xs"
                        : "text-gray-300"
                    }`}
                  />
                </button>
              ))}
              <span className="text-sm font-extrabold text-amber-700 ml-2">
                {selectedStars} / 5
              </span>
            </div>

            {/* Comment Textarea */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Commentaire ou retour d'expérience (optionnel)
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={`Qu'avez-vous pensé de ${targetTitle} ? (accueil, propreté, conformité, équipements...)`}
                rows={3}
                className="w-full p-3 bg-white border border-gray-200 rounded-xl text-xs sm:text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent placeholder-gray-400"
              />
            </div>

            {errorMessage && (
              <div className="p-2.5 bg-red-50 text-red-700 text-xs rounded-lg flex items-center gap-1.5">
                <AlertCircle size={14} className="shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-xs font-semibold text-gray-500 hover:text-gray-800 transition-colors"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 bg-gray-900 hover:bg-black text-white font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Envoi...</span>
                  </>
                ) : (
                  <>
                    <Send size={13} />
                    <span>Publier mon avis</span>
                  </>
                )}
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Global Score Summary Bar */}
      <div className="bg-gray-50 border border-gray-100 rounded-2xl p-5 flex flex-col md:flex-row items-center gap-6">
        {/* Big Score */}
        <div className="text-center md:text-left md:border-r border-gray-200 md:pr-6 shrink-0">
          <div className="text-4xl sm:text-5xl font-extrabold text-gray-900 flex items-baseline justify-center md:justify-start gap-1">
            <span>{averageRating > 0 ? averageRating.toFixed(1) : "—"}</span>
            <span className="text-base font-medium text-gray-400">/ 5</span>
          </div>
          <div className="flex items-center justify-center md:justify-start gap-1 text-amber-500 my-1">
            {[1, 2, 3, 4, 5].map((s) => (
              <Star
                key={s}
                size={16}
                className={s <= Math.round(averageRating) ? "fill-amber-400 text-amber-400" : "text-gray-200"}
              />
            ))}
          </div>
          <p className="text-xs text-gray-500 font-medium">
            {ratingsCount > 0 ? `${ratingsCount} avis client${ratingsCount > 1 ? "s" : ""}` : "Aucun avis pour l'instant"}
          </p>
        </div>

        {/* Breakdown Progress Bars */}
        <div className="flex-1 w-full space-y-1.5">
          {distribution.map(({ star, count, percentage }) => (
            <div key={star} className="flex items-center gap-2 text-xs text-gray-600">
              <span className="w-6 font-semibold">{star} ★</span>
              <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-400 rounded-full transition-all duration-500"
                  style={{ width: `${percentage}%` }}
                />
              </div>
              <span className="w-8 text-right font-medium text-gray-400">{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Reviews List */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="py-8 text-center text-gray-400 text-xs flex items-center justify-center gap-2">
            <Loader2 size={16} className="animate-spin text-amber-500" />
            <span>Chargement des avis...</span>
          </div>
        ) : reviews.length === 0 ? (
          <div className="py-8 text-center bg-gray-50/70 border border-dashed border-gray-200 rounded-2xl p-6">
            <MessageSquare size={32} className="mx-auto text-gray-300 mb-2" />
            <p className="text-sm font-semibold text-gray-700">Aucun avis pour l'instant</p>
            <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
              Soyez le premier à partager votre expérience pour guider les futurs clients et voyageurs !
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {reviews.map((rev) => {
              const formattedDate = rev.createdAt
                ? new Date(rev.createdAt).toLocaleDateString("fr-FR", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })
                : "Récemment";

              return (
                <div
                  key={rev.id}
                  className="bg-white border border-gray-100 p-4 rounded-2xl shadow-xs space-y-2 hover:border-gray-200 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-500 to-amber-600 text-white font-bold text-xs flex items-center justify-center uppercase shadow-xs">
                        {rev.clientName.charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className="font-bold text-xs sm:text-sm text-gray-900">{rev.clientName}</p>
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded-full border border-emerald-200/60">
                            <CheckCircle2 size={10} />
                            Avis vérifié
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-400">{formattedDate}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-0.5 text-amber-500">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          size={13}
                          className={s <= rev.rating ? "fill-amber-400 text-amber-400" : "text-gray-200"}
                        />
                      ))}
                    </div>
                  </div>

                  {rev.comment ? (
                    <p className="text-xs sm:text-sm text-gray-600 leading-relaxed whitespace-pre-line pl-10">
                      {rev.comment}
                    </p>
                  ) : (
                    <p className="text-xs text-gray-400 italic pl-10">
                      Note attribuée sans commentaire détaillé.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
