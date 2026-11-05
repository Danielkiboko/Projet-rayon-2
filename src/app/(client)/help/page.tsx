"use client";

import { useState } from "react";
import Link from "next/link";
import { 
  LifeBuoy, 
  Search, 
  MessageSquare, 
  Phone, 
  Mail, 
  Truck, 
  ShieldCheck, 
  CreditCard, 
  ChevronDown, 
  ChevronUp, 
  ArrowRight, 
  Store, 
  Bike, 
  CheckCircle2, 
  HelpCircle,
  Home,
  ShoppingBag
} from "lucide-react";
import { RayonsLogo } from "@/modules/shared/components/brand/RayonsLogo";
import { Footer } from "@/modules/shared/components/Footer";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";

interface FAQItem {
  question: string;
  answer: string;
  category: "orders" | "delivery" | "payment" | "guarantee" | "partners";
}

const FAQS: FAQItem[] = [
  {
    category: "orders",
    question: "Comment passer une commande sur Rayons.net ?",
    answer: "Vous avez deux façons simples de commander : soit directement en cliquant sur « Acheter Express » sur un produit pour renseigner votre commune à Kinshasa et payer à la livraison, soit en cliquant sur « Discuter avec le vendeur » pour négocier un prix de gros ou demander une facture proforma personnalisée."
  },
  {
    category: "orders",
    question: "Puis-je commander sans créer de compte ?",
    answer: "Oui, parfaitement ! Vous pouvez commander en tant qu'invité (Achat Express). Il vous suffit de renseigner votre nom, votre numéro de téléphone et votre commune de livraison. Vous recevrez le suivi par SMS."
  },
  {
    category: "delivery",
    question: "Quels sont les tarifs et délais de livraison à Kinshasa ?",
    answer: "Les livraisons s'effectuent généralement le jour même ou sous 24h ouvrées. Les tarifs dépendent de votre commune : 3 $ pour les communes centrales (Gombe, Kintambo, Lingwala, Barumbu, Bandalungwa, Kasa-Vubu), 5 $ pour la zone intermédiaire (Ngaliema, Limete, Lemba, Matete), 8 $ pour les zones périphériques (Mont-Ngafula, Masina, Ndjili, Kimbanseke) et 15-20 $ pour Nsele et Maluku."
  },
  {
    category: "delivery",
    question: "Comment suivre l'arrivée de mon livreur en temps réel ?",
    answer: "Dès qu'un coursier accepte votre course, vous pouvez suivre sa progression sur une carte GPS interactive via la page de suivi de commande (/order/[id]/tracking). Le livreur vous contacte également par appel ou SMS lorsqu'il approche de votre domicile."
  },
  {
    category: "payment",
    question: "Quels sont les moyens de paiement acceptés ?",
    answer: "Nous acceptons le paiement en espèces à la livraison (Cash on Delivery), ainsi que les paiements Mobile Money en Francs Congolais ou en Dollars américains via M-Pesa (Vodacom), Orange Money et Airtel Money."
  },
  {
    category: "payment",
    question: "Quel est le taux de change appliqué entre le Dollar et le Franc Congolais ?",
    answer: "Le taux de change est mis à jour quotidiennement en temps réel sur la plateforme selon le cours officiel moyen du marché en RDC (actuellement autour de 2 850 FC pour 1 USD). Vous pouvez basculer l'affichage dans la devise de votre choix dans le sélecteur en haut de page."
  },
  {
    category: "guarantee",
    question: "Qu'est-ce que la Garantie Rayons Trade Assurance ?",
    answer: "C'est notre bouclier de sécurité acheteur : lorsque vous payez via proforma ou en ligne, vos fonds restent sous séquestre sécurisé par Rayons.net et ne sont déversés au commerçant qu'après vérification physique et confirmation de conformité du produit lors de la livraison. Si l'article est non conforme, vous êtes intégralement remboursé."
  },
  {
    category: "guarantee",
    question: "Que faire si un article livré est défectueux ou non conforme ?",
    answer: "Vous avez le droit de vérifier l'article devant le livreur. Si l'article n'est pas conforme à votre commande, vous pouvez le refuser immédiatement sans frais. Si vous constatez une anomalie après le départ du coursier, ouvrez un ticket dans votre Espace Client ou contactez notre assistance WhatsApp dans les 48 heures."
  },
  {
    category: "partners",
    question: "Comment ouvrir une boutique fournisseur sur Rayons.net ?",
    answer: "Cliquez sur « Devenir Fournisseur » depuis le menu ou rendez-vous sur /supplier/register. Après validation de votre dossier commercial par notre équipe, vous accédez à votre cPanel pour publier vos produits ou biens immobiliers, gérer votre caisse et recevoir des paiements."
  },
  {
    category: "partners",
    question: "Comment postuler pour devenir livreur partenaire ?",
    answer: "Vous pouvez télécharger l'application officielle Livreur Android sur /download/driver-apk ou postuler auprès de l'un des fournisseurs partenaires de votre commune. Les livreurs bénéficient d'alertes instantanées de courses avec calcul automatique de leurs gains journaliers."
  }
];

export default function HelpPage() {
  const { user } = useAuth();
  const { totalItems, openCart } = useCart();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const filteredFaqs = FAQS.filter((f) => {
    const matchCat = activeCategory === "all" || f.category === activeCategory;
    const matchQuery = search.trim() === "" || 
      f.question.toLowerCase().includes(search.toLowerCase()) || 
      f.answer.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchQuery;
  });

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 text-[#0F1D27]">
      {/* ── Top Navigation Bar ── */}
      <header className="sticky top-0 z-40 bg-[#0F1D27] text-white border-b border-white/10 px-4 py-3 sm:px-8">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2 hover:opacity-95 transition-opacity">
            <RayonsLogo size="md" />
          </Link>

          <div className="flex items-center gap-3 sm:gap-4">
            <Link 
              href="/" 
              className="text-xs text-gray-300 hover:text-white font-medium hidden sm:inline-flex items-center gap-1.5 transition-colors"
            >
              <Home size={14} />
              <span>Accueil</span>
            </Link>

            <button
              type="button"
              onClick={openCart}
              className="relative p-2 text-gray-300 hover:text-white rounded-xl bg-white/5 border border-white/10 transition-colors cursor-pointer"
              title="Panier"
            >
              <ShoppingBag size={18} />
              {totalItems > 0 && (
                <span className="absolute -top-1 -right-1 bg-[#C7D300] text-[#0F1D27] text-[10px] font-black rounded-full w-4 h-4 flex items-center justify-center">
                  {totalItems}
                </span>
              )}
            </button>

            {user ? (
              <Link
                href="/dashboard/client"
                className="px-3.5 py-1.5 bg-[#C7D300] text-[#0F1D27] text-xs font-bold rounded-xl hover:bg-[#b5c000] transition-colors"
              >
                Mon Espace
              </Link>
            ) : (
              <Link
                href="/login"
                className="px-3.5 py-1.5 bg-white/10 text-white hover:bg-white/20 text-xs font-semibold rounded-xl transition-colors"
              >
                Connexion
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* ── Hero Search Section ── */}
      <section className="bg-gradient-to-b from-[#0F1D27] to-[#142430] text-white py-12 px-4 sm:px-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(#C7D300_1px,transparent_1px)] [background-size:24px_24px] opacity-10 pointer-events-none" />
        
        <div className="max-w-4xl mx-auto text-center relative z-10 space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#C7D300]/15 text-[#C7D300] border border-[#C7D300]/30 text-xs font-bold">
            <LifeBuoy size={14} />
            <span>Centre d'Assistance Rayons.net</span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-heading font-black tracking-tight">
            Comment pouvons-nous vous aider aujourd'hui ?
          </h1>
          <p className="text-gray-300 text-xs sm:text-sm max-w-xl mx-auto leading-relaxed">
            Consultez nos réponses fréquentes sur les livraisons à Kinshasa, les paiements sécurisés et la garantie acheteur, ou discutez directement avec notre équipe.
          </p>

          {/* Search Box */}
          <div className="max-w-xl mx-auto mt-6 relative">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Ex: frais de livraison, mobile money, retour produit..."
              className="w-full pl-11 pr-4 py-3.5 bg-white text-gray-900 rounded-2xl shadow-lg border border-gray-100 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#C7D300] placeholder-gray-400"
            />
          </div>
        </div>
      </section>

      {/* ── Fast Contact Channels (3 Cards) ── */}
      <section className="max-w-6xl mx-auto px-4 -mt-8 relative z-20 w-full">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 1. WhatsApp Direct */}
          <a
            href="https://wa.me/243859180031?text=Bonjour%20Rayons%20Support,%20j'ai%20besoin%20d'aide%20concernant..."
            target="_blank"
            rel="noopener noreferrer"
            className="bg-white p-5 rounded-2xl border border-emerald-100 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group"
          >
            <div>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold mb-3 group-hover:scale-105 transition-transform">
                <MessageSquare size={20} />
              </div>
              <h3 className="font-heading font-bold text-sm text-gray-900 mb-1">Assistance WhatsApp Direct</h3>
              <p className="text-xs text-gray-500 mb-3 leading-relaxed">
                Échangez directement avec un conseiller local. Réponse instantanée pour vos questions ou urgences de livraison.
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 pt-2 border-t border-gray-100">
              <span>+243 85 91 800 31</span>
              <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </div>
          </a>

          {/* 2. Appel Téléphonique */}
          <a
            href="tel:+243859180031"
            className="bg-white p-5 rounded-2xl border border-blue-100 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group"
          >
            <div>
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold mb-3 group-hover:scale-105 transition-transform">
                <Phone size={20} />
              </div>
              <h3 className="font-heading font-bold text-sm text-gray-900 mb-1">Ligne Téléphonique Client</h3>
              <p className="text-xs text-gray-500 mb-3 leading-relaxed">
                Disponible 7j/7 de 8h à 20h pour le suivi des commandes, réservations et signalements de livraison.
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-blue-600 pt-2 border-t border-gray-100">
              <span>Appeler le support</span>
              <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </div>
          </a>

          {/* 3. Ticket Support Dédié */}
          <Link
            href={user ? "/dashboard/client?tab=tickets" : "/login?redirect=/dashboard/client?tab=tickets"}
            className="bg-white p-5 rounded-2xl border border-[#C7D300]/40 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group"
          >
            <div>
              <div className="w-10 h-10 rounded-xl bg-[#C7D300]/20 text-[#0F1D27] flex items-center justify-center font-bold mb-3 group-hover:scale-105 transition-transform">
                <LifeBuoy size={20} />
              </div>
              <h3 className="font-heading font-bold text-sm text-gray-900 mb-1">Ticket de Réclamation</h3>
              <p className="text-xs text-gray-500 mb-3 leading-relaxed">
                Suivez vos échanges écrits avec la direction et les fournisseurs certifiés avec archivage et notifications mail.
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#0F1D27] pt-2 border-t border-gray-100">
              <span>{user ? "Ouvrir ou consulter un ticket" : "Connexion pour ouvrir un ticket"}</span>
              <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>
        </div>
      </section>

      {/* ── FAQ Categories & Accordion ── */}
      <main className="max-w-4xl mx-auto px-4 py-12 flex-1 w-full">
        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-6 scrollbar-none">
          {[
            { id: "all", label: "Toutes les questions" },
            { id: "orders", label: "Commandes & Achats" },
            { id: "delivery", label: "Livraison & Kinshasa" },
            { id: "payment", label: "Paiements & Devises" },
            { id: "guarantee", label: "Garantie & Retours" },
            { id: "partners", label: "Vendeurs & Livreurs" },
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                activeCategory === cat.id
                  ? "bg-[#0F1D27] text-white shadow-sm"
                  : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* FAQ Accordion List */}
        <div className="space-y-3">
          {filteredFaqs.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-gray-200">
              <HelpCircle size={36} className="mx-auto text-gray-400 mb-2" />
              <h3 className="font-bold text-gray-800 text-sm">Aucune réponse trouvée</h3>
              <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
                Essayez d'autres mots-clés ou écrivez-nous directement sur WhatsApp pour une réponse instantanée.
              </p>
            </div>
          ) : (
            filteredFaqs.map((faq, idx) => {
              const isOpen = openIndex === idx;
              return (
                <div
                  key={idx}
                  className="bg-white rounded-2xl border border-gray-200/80 overflow-hidden shadow-2xs transition-all"
                >
                  <button
                    type="button"
                    onClick={() => setOpenIndex(isOpen ? null : idx)}
                    className="w-full p-4 sm:p-5 text-left flex items-center justify-between gap-4 font-heading font-bold text-xs sm:text-sm text-gray-900 hover:text-[#0F1D27] cursor-pointer"
                  >
                    <span>{faq.question}</span>
                    <span className="p-1 rounded-lg bg-gray-100 text-gray-500 shrink-0">
                      {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </span>
                  </button>

                  {isOpen && (
                    <div className="px-4 pb-5 sm:px-5 text-xs text-gray-600 leading-relaxed border-t border-gray-100 pt-3">
                      <p>{faq.answer}</p>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Reassurance Banner */}
        <div className="mt-12 bg-white rounded-3xl p-6 border border-emerald-200/60 shadow-xs flex flex-col sm:flex-row items-center gap-5">
          <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
            <ShieldCheck size={32} />
          </div>
          <div className="flex-1 text-center sm:text-left">
            <h3 className="font-heading font-bold text-base text-gray-900">
              Une question spécifique sur votre livraison en cours ?
            </h3>
            <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
              Nos agents à Kinshasa et Lubumbashi interviennent directement pour faciliter la remise en main propre avec votre coursier.
            </p>
          </div>
          <a
            href="https://wa.me/243859180031"
            target="_blank"
            rel="noopener noreferrer"
            className="px-5 py-3 bg-[#0F1D27] hover:bg-[#142430] text-white text-xs font-bold rounded-xl transition-colors whitespace-nowrap shadow-sm"
          >
            Contacter un Conseiller
          </a>
        </div>
      </main>

      {/* ── Footer ── */}
      <Footer />
    </div>
  );
}
