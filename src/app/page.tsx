"use client";

import { useState, useEffect, useRef } from "react";
import { OptimizedImage } from "@/modules/shared/components/OptimizedImage";
import Link from "next/link";
import {
  Search, User, Menu, MapPin, ChevronRight, Star, Heart, TrendingUp,
  Home as HomeIcon, Wifi, Building, Globe, ArrowRight, Shirt,
  MessageCircle, Sparkles, UtensilsCrossed, ShoppingBag, X,
  CheckCircle, Shield, Zap, Clock, Package, Users, PlayCircle,
  Quote, ChevronDown, Send, ShieldCheck, BadgeCheck, Lock,
  ShoppingBasket
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Footer } from "@/modules/shared/components/Footer";
import { useChat } from "@/context/ChatContext";
import { useCart } from "@/context/CartContext";
import { useCurrency } from "@/context/CurrencyContext";
import { db } from "@/lib/firebase";
import { collection, query, getDocs, limit, where } from "firebase/firestore";
import { CurrencySelector } from "@/modules/shared/components/CurrencySelector";
import { RayonsLogo } from "@/modules/shared/components/brand/RayonsLogo";
import { UniversalSearchBar } from "@/modules/client/components/home/UniversalSearchBar";
import NotificationBell from "@/modules/shared/components/notifications/NotificationBell";

// --- Animated Counter Hook ---
function useCounter(target: number, duration = 2000, start = false) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!start) return;
    let startTime: number | null = null;
    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      setCount(Math.floor(progress * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration, start]);
  return count;
}

// --- Testimonials data ---
const testimonials = [
  {
    quote: "En trois semaines, j'ai listé mon appartement et trouvé un locataire sérieux. Le processus avec le séquestre était incroyablement simple.",
    name: "Marie-Claire N.",
    role: "Propriétaire à Kinshasa",
    avatar: "MC",
    rayon: "Immo",
    rayonColor: "#4C6EF5",
    stars: 5,
  },
  {
    quote: "Je vends mes plats préparés depuis chez moi. Rayons m'a donné une vraie vitrine professionnelle sans frais énormes.",
    name: "Patrick B.",
    role: "Chef cuisinier indépendant",
    avatar: "PB",
    rayon: "Saveurs",
    rayonColor: "#FF6B35",
    stars: 5,
  },
  {
    quote: "J'ai commandé du matériel tech pour mon bureau. Livraison rapide, produit conforme et paiement sécurisé. Je recommande sans hésiter.",
    name: "Astrid K.",
    role: "Directrice d'agence",
    avatar: "AK",
    rayon: "Connect",
    rayonColor: "#00B5A5",
    stars: 5,
  },
];

// --- Stats ---
const stats = [
  { label: "Fournisseurs actifs vérifiés", value: 240, suffix: "+" },
  { label: "Produits & biens listés", value: 4800, suffix: "+" },
  { label: "Clients & acheteurs satisfaits", value: 12000, suffix: "+" },
  { label: "Villes couvertes en RDC", value: 6, suffix: "" },
];

// --- Rayons config ---
const rayons = [
  {
    id: "connect",
    href: "/rayon/connect",
    color: "#00B5A5",
    glowColor: "rgba(0, 181, 165, 0.25)",
    icon: Wifi,
    tag: "Innovation & Tech",
    title: "Rayons Connect",
    desc: "Starlink, smartphones, audio haut de gamme, domotique et équipements connectés.",
    badge: "Tech & Gadgets",
  },
  {
    id: "immo",
    href: "/rayon/immo",
    color: "#4C6EF5",
    glowColor: "rgba(76, 110, 245, 0.25)",
    icon: Building,
    tag: "Immobilier & Hôtellerie",
    title: "Rayons Immo",
    desc: "Villas, appartements, bureaux modernes et réservations d'hôtels de standing certifiés.",
    badge: "Locations & Hôtels",
  },
  {
    id: "mode",
    href: "/rayon/mode",
    color: "#D4B08C",
    glowColor: "rgba(212, 176, 140, 0.25)",
    icon: Shirt,
    tag: "Mode & Lifestyle",
    title: "Rayons Mode",
    desc: "Prêt-à-porter haut de gamme, maroquinerie, accessoires de luxe et collections exclusives.",
    badge: "Tendances & Luxe",
  },
  {
    id: "saveurs",
    href: "/rayon/saveurs",
    color: "#FF6B35",
    glowColor: "rgba(255, 107, 53, 0.25)",
    icon: UtensilsCrossed,
    tag: "Gastronomie & Cuisine",
    title: "Rayons Saveurs",
    desc: "Restaurants réputés, plats préparés par des chefs et équipements culinaires de qualité.",
    badge: "Plats & Équipements",
  },
];

// --- Why Rayons features ---
const whyFeatures = [
  {
    icon: ShieldCheck,
    title: "Séquestre Garanti 100%",
    desc: "Votre argent reste bloqué sur compte séquestre Rayons et n'est remis au vendeur qu'après vérification du colis.",
    color: "#C7D300",
  },
  {
    icon: Zap,
    title: "Devis & Proformas Directs",
    desc: "Négociez en direct avec les fournisseurs et recevez une facture proforma officielle en 1 clic.",
    color: "#00B5A5",
  },
  {
    icon: BadgeCheck,
    title: "Fournisseurs Vérifiés (KYC)",
    desc: "Tous les vendeurs font l'objet d'un contrôle rigoureux de leur identité et de leur boutique physique.",
    color: "#4C6EF5",
  },
  {
    icon: Clock,
    title: "Assistance & Support 7j/7",
    desc: "Une équipe dédiée vous accompagne en temps réel avec suivi de tickets et médiation impartiale.",
    color: "#FF6B35",
  },
];

export default function Home() {
  const { user, userData, signOut } = useAuth();
  const { openChatForProduct } = useChat();
  const { formatPrice } = useCurrency();
  const { totalItems, openCart } = useCart();

  const [dbProducts, setDbProducts] = useState<any[]>([]);
  const [dbProperties, setDbProperties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeTestimonial, setActiveTestimonial] = useState(0);
  const [selectedQuickRayon, setSelectedQuickRayon] = useState<string>("all");

  const statsRef = useRef<HTMLDivElement>(null);
  const [statsInView, setStatsInView] = useState(false);

  // Stats intersection observer
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setStatsInView(true);
    }, { threshold: 0.3 });
    if (statsRef.current) observer.observe(statsRef.current);
    return () => observer.disconnect();
  }, []);

  // Auto-rotate testimonials
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveTestimonial(prev => (prev + 1) % testimonials.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  // Fetch real products & properties from Firebase
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [prodSnap, propSnap] = await Promise.all([
          getDocs(query(collection(db, "products"), limit(24))),
          getDocs(query(collection(db, "properties"), where("status", "==", "Disponible"), limit(6)))
        ]);

        const prods: any[] = [];
        prodSnap.forEach(doc => {
          const data = doc.data();
          if (data.status !== "REJECTED") {
            prods.push({ id: doc.id, ...data });
          }
        });
        setDbProducts(prods);

        const props: any[] = [];
        propSnap.forEach(doc => {
          props.push({ id: doc.id, ...doc.data() });
        });
        setDbProperties(props);
      } catch (error) {
        console.error("Erreur de chargement des données d'accueil:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const s0 = useCounter(stats[0].value, 1800, statsInView);
  const s1 = useCounter(stats[1].value, 2000, statsInView);
  const s2 = useCounter(stats[2].value, 2200, statsInView);
  const s3 = useCounter(stats[3].value, 1400, statsInView);
  const statCounts = [s0, s1, s2, s3];

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans selection:bg-[#C7D300]/30 selection:text-[#0F1D27]">

      {/* ═══════════════════════════════════════════════════════
          HEADER — Floating Ultra-Glass Navbar
      ═══════════════════════════════════════════════════════ */}
      <header className="sticky top-2 z-50 px-3 sm:px-6">
        <div className="max-w-7xl mx-auto bg-[#0F1D27]/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl shadow-black/30 px-4 h-16 flex items-center justify-between gap-3 text-white">

          {/* Logo & Mobile Menu Trigger */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 -ml-2 text-gray-300 hover:text-white lg:hidden rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
              aria-label="Menu"
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <RayonsLogo size="md" href="/" />
          </div>

          {/* Desktop Categories Hub */}
          <nav className="hidden lg:flex items-center gap-1 bg-white/5 border border-white/10 p-1 rounded-full">
            <Link
              href="/"
              className="flex items-center gap-2 text-xs font-bold text-[#0F1D27] bg-[#C7D300] px-4 py-1.5 rounded-full shadow-md shadow-[#C7D300]/20 transition-all"
            >
              <HomeIcon size={14} />
              <span>Accueil</span>
            </Link>

            <Link
              href="/rayon/connect"
              className="flex items-center gap-2 text-xs font-semibold text-gray-300 hover:text-white hover:bg-white/10 px-3.5 py-1.5 rounded-full transition-all group"
            >
              <span className="w-2 h-2 rounded-full bg-[#00B5A5] group-hover:scale-125 transition-transform" />
              <span>Connect</span>
            </Link>

            <Link
              href="/rayon/immo"
              className="flex items-center gap-2 text-xs font-semibold text-gray-300 hover:text-white hover:bg-white/10 px-3.5 py-1.5 rounded-full transition-all group"
            >
              <span className="w-2 h-2 rounded-full bg-[#4C6EF5] group-hover:scale-125 transition-transform" />
              <span>Immobilier</span>
            </Link>

            <Link
              href="/rayon/mode"
              className="flex items-center gap-2 text-xs font-semibold text-gray-300 hover:text-white hover:bg-white/10 px-3.5 py-1.5 rounded-full transition-all group"
            >
              <span className="w-2 h-2 rounded-full bg-[#D4B08C] group-hover:scale-125 transition-transform" />
              <span>Mode</span>
            </Link>

            <Link
              href="/rayon/saveurs"
              className="flex items-center gap-2 text-xs font-semibold text-gray-300 hover:text-white hover:bg-white/10 px-3.5 py-1.5 rounded-full transition-all group"
            >
              <span className="w-2 h-2 rounded-full bg-[#FF6B35] group-hover:scale-125 transition-transform" />
              <span>Saveurs</span>
            </Link>
          </nav>

          {/* Right Utilities */}
          <div className="flex items-center gap-2 sm:gap-3">
            <CurrencySelector />

            {user ? (
              <div className="flex items-center gap-2">
                <Link
                  href="/dashboard"
                  className="flex items-center gap-1.5 text-xs font-bold text-white bg-white/10 hover:bg-white/20 border border-white/15 px-3.5 py-2 rounded-xl transition-all"
                >
                  <User size={14} className="text-[#C7D300]" />
                  <span className="hidden sm:inline-block max-w-[120px] truncate">
                    {userData?.displayName || user.displayName || "Mon espace"}
                  </span>
                </Link>
                <button
                  onClick={signOut}
                  className="hidden md:block text-xs font-medium text-rose-300 hover:text-rose-200 bg-rose-500/10 hover:bg-rose-500/20 px-3 py-2 rounded-xl transition-colors cursor-pointer"
                >
                  Déconnexion
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <Link
                  href="/login"
                  className="text-xs font-bold text-gray-200 hover:text-white bg-white/10 hover:bg-white/15 border border-white/10 px-3.5 py-2 rounded-xl transition-colors"
                >
                  Connexion
                </Link>
              </div>
            )}

            <NotificationBell />

            {/* Cart Trigger */}
            <button
              onClick={openCart}
              className="relative p-2.5 text-white bg-white/10 hover:bg-[#C7D300] hover:text-[#0F1D27] rounded-xl border border-white/15 transition-all duration-200 group cursor-pointer shadow-md"
              title="Votre Panier & Factures Proformas"
            >
              <ShoppingBag size={19} className="group-hover:scale-110 transition-transform" />
              {totalItems > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-[#FF6B35] text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-[#0F1D27] shadow-sm animate-pulse">
                  {totalItems}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden mt-2 max-w-7xl mx-auto bg-[#0F1D27]/95 backdrop-blur-2xl border border-white/10 rounded-2xl p-4 flex flex-col gap-1 shadow-2xl text-white animate-in slide-in-from-top-2 duration-200">
            {[
              { href: "/rayon/connect", icon: Wifi, label: "Rayon Connect & Tech", color: "#00B5A5" },
              { href: "/rayon/immo", icon: Building, label: "Rayon Immobilier & Hôtels", color: "#4C6EF5" },
              { href: "/rayon/mode", icon: Shirt, label: "Rayon Mode & Lifestyle", color: "#D4B08C" },
              { href: "/rayon/saveurs", icon: UtensilsCrossed, label: "Rayon Saveurs & Restos", color: "#FF6B35" },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 px-3.5 py-3 rounded-xl hover:bg-white/10 transition-colors text-sm font-medium"
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${item.color}20`, color: item.color }}
                >
                  <item.icon size={16} />
                </div>
                <span>{item.label}</span>
              </Link>
            ))}
            <div className="border-t border-white/10 mt-2 pt-3 flex gap-2">
              <Link
                href="/supplier/register"
                onClick={() => setMobileMenuOpen(false)}
                className="flex-1 py-2.5 text-center text-xs font-bold bg-[#C7D300] text-[#0F1D27] rounded-xl"
              >
                Devenir Fournisseur
              </Link>
              <Link
                href="/help"
                onClick={() => setMobileMenuOpen(false)}
                className="py-2.5 px-4 text-center text-xs font-semibold bg-white/10 text-white rounded-xl"
              >
                Aide
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* ═══════════════════════════════════════════════════════
          HERO SECTION — Luxury Ambient Glow & High CRO
      ═══════════════════════════════════════════════════════ */}
      <section className="relative min-h-[92vh] flex items-center bg-[#0F1D27] overflow-hidden -mt-20 pt-28 pb-16">
        {/* Ambient Glow mesh */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-gradient-to-tr from-[#C7D300]/15 via-[#00B5A5]/15 to-[#4C6EF5]/15 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute top-10 right-10 w-[350px] h-[350px] bg-[#FF6B35]/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(#ffffff0a_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none" />

        {/* Supermarket Photo Panel on Right (Desktop) */}
        <div className="absolute right-0 top-0 bottom-0 w-[52%] hidden lg:block pointer-events-none">
          <OptimizedImage
            src="/supermarket-hero.jpg"
            alt="Rayons d'un supermarché — Rayons marketplace"
            fill
            priority
            className="object-cover"
            sizes="52vw"
          />
          {/* Left fade to blend seamlessly with dark background */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#0F1D27] via-[#0F1D27]/30 to-transparent" />
          {/* Bottom fade */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0F1D27]/60 via-transparent to-transparent" />
          
          {/* Floating badge */}
          <div className="absolute bottom-12 right-8 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl px-5 py-4 flex items-center gap-3 shadow-2xl">
            <span className="text-2xl">🛒</span>
            <div>
              <p className="text-white font-bold text-sm">4 800+ produits</p>
              <p className="text-gray-400 text-xs">disponibles maintenant</p>
            </div>
          </div>
        </div>

        {/* Content Container */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 w-full">
          <div className="max-w-3xl lg:max-w-[52%]">

            {/* Human trust signal with customer avatars */}
            <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-white/8 border border-white/15 backdrop-blur-sm mb-6 w-max">
              <div className="flex -space-x-1.5">
                {["MC", "PB", "AK"].map((init, i) => (
                  <div
                    key={i}
                    className="w-6 h-6 rounded-full bg-gradient-to-br from-[#C7D300] to-[#96a000] flex items-center justify-center text-[9px] font-black text-[#0F1D27] ring-2 ring-[#0F1D27]"
                  >
                    {init}
                  </div>
                ))}
              </div>
              <span className="text-sm font-medium text-gray-300">
                +12 000 clients nous font déjà confiance
              </span>
              <span className="text-[#C7D300] text-xs font-bold">★★★★★</span>
            </div>

            {/* Original main headline */}
            <h1 className="font-heading text-4xl sm:text-5xl md:text-6xl font-extrabold text-white leading-[1.08] mb-6 tracking-tight">
              Ce que vous cherchez{" "}
              <span className="text-[#C7D300] relative">
                existe ici.
                <svg className="absolute -bottom-1 left-0 w-full" height="6" viewBox="0 0 200 6" fill="none">
                  <path d="M0 5 Q50 1 100 5 Q150 1 200 5" stroke="#C7D300" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.6" />
                </svg>
              </span>
            </h1>

            {/* Original subheadline */}
            <p className="text-gray-300 text-lg sm:text-xl mb-8 max-w-xl leading-relaxed">
              Immobilier, mode, tech ou gastronomie — Rayons connecte les acheteurs aux meilleurs fournisseurs locaux, simplement.
            </p>

            {/* Universal Search Bar with Glass Glow */}
            <div className="mb-8 max-w-2xl p-1 bg-white/10 backdrop-blur-2xl border border-white/20 rounded-2xl shadow-2xl">
              <UniversalSearchBar products={dbProducts} properties={dbProperties} />
            </div>

            {/* Primary Action Buttons */}
            <div className="flex flex-wrap items-center gap-3.5">
              <button
                onClick={() => document.getElementById("rayons")?.scrollIntoView({ behavior: "smooth" })}
                className="inline-flex items-center gap-2 bg-[#C7D300] text-[#0F1D27] font-heading font-extrabold px-7 py-4 rounded-xl hover:bg-[#b5c000] active:scale-95 transition-all shadow-xl shadow-[#C7D300]/25 text-sm sm:text-base cursor-pointer"
              >
                <span>Explorer les Rayons</span>
                <ArrowRight size={18} />
              </button>

              <Link
                href="/supplier/register"
                className="inline-flex items-center gap-2 px-6 py-4 rounded-xl text-white font-bold text-sm sm:text-base bg-white/10 hover:bg-white/20 border border-white/20 backdrop-blur-md transition-all active:scale-95"
              >
                <span>Devenir Fournisseur</span>
                <BadgeCheck size={18} className="text-[#C7D300]" />
              </Link>
            </div>

            {/* Trust Mini-Bar */}
            <div className="mt-10 pt-6 border-t border-white/10 flex flex-wrap items-center gap-6 text-xs text-gray-400">
              <div className="flex items-center gap-2">
                <CheckCircle size={15} className="text-[#C7D300]" />
                <span>Paiement consigné et protégé</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle size={15} className="text-[#00B5A5]" />
                <span>Facturation proforma en direct</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle size={15} className="text-[#4C6EF5]" />
                <span>Fournisseurs audités en RDC</span>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          STATS COUNTER BAR — Social Proof
      ═══════════════════════════════════════════════════════ */}
      <section ref={statsRef} className="bg-[#0F1D27] border-y border-white/10 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 py-10 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {stats.map((stat, i) => (
            <div key={i} className="flex flex-col items-center">
              <div className="text-3xl sm:text-5xl font-heading font-black text-white mb-1 tracking-tight">
                <span className="bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent">
                  {statCounts[i].toLocaleString()}
                </span>
                <span className="text-[#C7D300]">{stat.suffix}</span>
              </div>
              <p className="text-xs sm:text-sm text-gray-400 font-medium">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          MAIN CONTENT — BENTO SHOWCASE & PRODUCT GRIDS
      ═══════════════════════════════════════════════════════ */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-16 pb-24 space-y-24">

        {/* ── SECTION : LES 4 RAYONS EN BENTO GRID ── */}
        <section id="rayons" className="scroll-mt-24">
          <div className="text-center mb-12">
            <span className="inline-block text-xs font-bold uppercase tracking-widest text-emerald-600 bg-emerald-50 border border-emerald-200/60 px-3.5 py-1 rounded-full mb-3">
              Quatre univers d&apos;excellence
            </span>
            <h2 className="text-3xl sm:text-5xl font-heading font-black text-[#0F1D27] tracking-tight">
              Explorez les Rayons
            </h2>
            <p className="text-gray-500 mt-3 max-w-xl mx-auto text-sm sm:text-base">
              Chaque rayon bénéficie de fournisseurs certifiés, d&apos;un catalogue spécifique et de la garantie de livraison Rayons.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {rayons.map((r) => (
              <Link
                key={r.id}
                href={r.href}
                className="group relative bg-white rounded-3xl p-6 border border-slate-200/90 hover:border-slate-300 shadow-sm hover:shadow-2xl hover:-translate-y-1.5 transition-all duration-300 flex flex-col justify-between overflow-hidden"
              >
                {/* Glow ring on hover */}
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                  style={{ background: `radial-gradient(circle at top right, ${r.glowColor}, transparent 65%)` }}
                />

                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-5">
                    <div
                      className="w-12 h-12 rounded-2xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110 shadow-sm"
                      style={{ backgroundColor: `${r.color}18`, color: r.color }}
                    >
                      <r.icon size={24} />
                    </div>
                    <span
                      className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg border"
                      style={{ color: r.color, backgroundColor: `${r.color}10`, borderColor: `${r.color}30` }}
                    >
                      {r.badge}
                    </span>
                  </div>

                  <h3 className="text-xl font-heading font-extrabold text-[#0F1D27] mb-2 flex items-center justify-between">
                    <span>{r.title}</span>
                    <ChevronRight
                      size={18}
                      className="text-gray-400 group-hover:translate-x-1 transition-transform"
                      style={{ color: r.color }}
                    />
                  </h3>
                  <p className="text-xs text-gray-500 leading-relaxed">{r.desc}</p>
                </div>

                <div className="relative z-10 pt-5 mt-4 border-t border-gray-100 flex items-center justify-between text-xs font-bold" style={{ color: r.color }}>
                  <span>Découvrir le rayon</span>
                  <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* ── SECTION : TRADE ASSURANCE & SÉQUESTRE ── */}
        <section className="rounded-3xl bg-[#0F1D27] px-6 sm:px-12 py-16 relative overflow-hidden text-white shadow-2xl">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,#C7D30015,transparent_55%)] pointer-events-none" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,#00B5A510,transparent_55%)] pointer-events-none" />

          <div className="relative z-10 text-center mb-12">
            <span className="inline-block text-xs font-bold uppercase tracking-widest text-[#C7D300] bg-[#C7D300]/10 border border-[#C7D300]/30 px-3.5 py-1 rounded-full mb-3">
              Sécurité & Confiance Absolue
            </span>
            <h2 className="text-3xl sm:text-5xl font-heading font-black tracking-tight text-white">
              Comment fonctionne le Séquestre Rayons ?
            </h2>
            <p className="text-gray-400 mt-3 max-w-xl mx-auto text-sm sm:text-base">
              Fini les craintes d&apos;arnaque ou de marchandise non reçue. Votre argent est en lieu sûr.
            </p>
          </div>

          <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {whyFeatures.map((f, i) => (
              <div
                key={i}
                className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:bg-white/10 hover:border-white/20 transition-all flex flex-col justify-between group"
              >
                <div>
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-md"
                    style={{ backgroundColor: `${f.color}20`, color: f.color }}
                  >
                    <f.icon size={24} />
                  </div>
                  <h3 className="font-heading font-bold text-white text-base mb-2">{f.title}</h3>
                  <p className="text-xs text-gray-400 leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── SECTION : GRILLES PRODUITS PAR RAYONS ── */}
        {(() => {
          const renderProductGrid = (
            title: string,
            subtitle: string,
            categoryFilter: string,
            link: string,
            accentColor: string
          ) => {
            const isImmoSection = categoryFilter.toLowerCase() === "immo";
            const isSaveursSection = categoryFilter.toLowerCase() === "saveurs";

            const items = isImmoSection
              ? dbProperties.slice(0, 4)
              : dbProducts.filter((p) => {
                  const cat = (p.category || "").toLowerCase();
                  if (isSaveursSection) {
                    return (
                      cat.includes("saveurs") ||
                      cat.includes("resto") ||
                      cat.includes("cuisine") ||
                      cat.includes("repas") ||
                      cat.includes("food")
                    );
                  }
                  return cat.includes(categoryFilter.toLowerCase());
                }).slice(0, 4);

            return (
              <section key={categoryFilter} className="mt-4">
                <div className="flex flex-col mb-6 px-1 gap-1">
                  <div>
                    <span
                      className="text-[11px] font-bold px-3 py-1 rounded-full uppercase tracking-wider border inline-block"
                      style={{
                        color: accentColor,
                        backgroundColor: `${accentColor}12`,
                        borderColor: `${accentColor}30`,
                      }}
                    >
                      {subtitle}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-end justify-between gap-4">
                    <h2 className="text-2xl sm:text-3xl font-heading font-black text-[#0F1D27] tracking-tight">
                      {title}
                    </h2>
                    <Link
                      href={link}
                      className="text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all hover:translate-x-1"
                      style={{ color: accentColor }}
                    >
                      <span>Consulter tout le rayon</span>
                      <ChevronRight size={16} />
                    </Link>
                  </div>
                </div>

                {loading ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="animate-pulse bg-white rounded-2xl h-60 border border-gray-100 p-4" />
                    ))}
                  </div>
                ) : items.length === 0 ? (
                  <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-gray-200">
                    <p className="text-gray-400 text-xs font-medium">Bientôt de nouvelles offres dans ce rayon.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {items.map((item) => {
                      const itemName = item.title?.fr || item.title || item.name || "Article";
                      const itemImage =
                        item.image ||
                        item.images?.[0] ||
                        "https://images.unsplash.com/photo-1522071820081-009f0129c71c";
                      const itemCategory = isImmoSection
                        ? item.immoBranch === "hotel"
                          ? "Hôtel / Nuitée"
                          : item.typeTransaction || "Immobilier"
                        : item.category || "Produit";

                      return (
                        <div
                          key={item.id}
                          className="group bg-white rounded-2xl overflow-hidden shadow-xs hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border border-slate-200/80 flex flex-col justify-between"
                        >
                          <div className="relative aspect-4/3 overflow-hidden bg-gray-100">
                            <OptimizedImage
                              src={itemImage}
                              alt={itemName}
                              fill
                              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                              className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500"
                            />
                            <div className="absolute top-2 left-2 flex items-center gap-1 bg-white/90 backdrop-blur-md px-2 py-0.5 rounded-md border border-gray-100 shadow-xs text-[10px] font-bold text-gray-700">
                              <ShieldCheck size={11} className="text-emerald-600" />
                              <span>Vérifié</span>
                            </div>
                            <button
                              className="absolute top-2 right-2 w-7 h-7 bg-white/90 backdrop-blur-md rounded-full flex items-center justify-center text-gray-400 hover:text-red-500 shadow-xs transition-all active:scale-90"
                              title="Favoris"
                            >
                              <Heart size={13} />
                            </button>
                          </div>

                          <div className="p-3.5 flex flex-col flex-1">
                            <p className="text-[10px] font-semibold text-gray-400 mb-0.5 truncate uppercase">
                              {itemCategory}
                            </p>
                            <h3 className="font-bold text-gray-900 text-xs sm:text-sm leading-snug mb-2 line-clamp-2 group-hover:text-[#0F1D27] transition-colors">
                              {itemName}
                            </h3>

                            <div className="mt-auto flex items-center justify-between pt-2.5 border-t border-gray-100">
                              <span className="font-heading font-black text-sm sm:text-base text-[#0F1D27]">
                                {formatPrice(item.price)}
                                {isImmoSection && item.immoBranch === "hotel" && (
                                  <span className="text-[10px] text-gray-400 font-normal"> / nuit</span>
                                )}
                                {isImmoSection && item.typeTransaction?.toLowerCase().includes("locat") && (
                                  <span className="text-[10px] text-gray-400 font-normal"> / mois</span>
                                )}
                              </span>

                              <button
                                onClick={() =>
                                  openChatForProduct({
                                    id: item.id,
                                    supplierId: item.supplierId || "admin",
                                    name: itemName,
                                    price: item.price,
                                    image: item.images?.[0] || item.imageUrl || "",
                                  })
                                }
                                className="w-8 h-8 rounded-xl bg-gray-100 text-[#0F1D27] hover:bg-[#C7D300] flex items-center justify-center transition-all active:scale-90 cursor-pointer shadow-xs"
                                title="Discuter / Négocier le devis"
                              >
                                <MessageCircle size={15} />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          };

          return (
            <div className="space-y-16">
              {renderProductGrid("Populaire en Mode & Luxe", "Collections Tendance", "Mode", "/rayon/mode", "#D4B08C")}
              {renderProductGrid("Innovations & Tech Connect", "Starlink & Électronique", "Connect", "/rayon/connect", "#00B5A5")}
              {renderProductGrid("Saveurs & Restaurants Locaux", "Gastronomie & Livraisons", "Saveurs", "/rayon/saveurs", "#FF6B35")}
              {renderProductGrid("Biens Immobiliers & Hôtels", "Résidences & Hôtellerie", "Immo", "/rayon/immo", "#4C6EF5")}
            </div>
          );
        })()}

        {/* ── SECTION : TÉMOIGNAGES CLIENTS ── */}
        <section className="mt-8">
          <div className="text-center mb-10">
            <span className="inline-block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">
              Retours d&apos;expérience
            </span>
            <h2 className="text-3xl sm:text-4xl font-heading font-black text-[#0F1D27] tracking-tight">
              Ce que disent nos clients
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {testimonials.map((t, i) => (
              <div
                key={i}
                className={`bg-white rounded-3xl p-6 border transition-all duration-300 shadow-sm ${
                  i === activeTestimonial
                    ? "border-[#C7D300] ring-2 ring-[#C7D300]/20 shadow-xl"
                    : "border-slate-200/80"
                }`}
              >
                <div className="flex gap-1 mb-4">
                  {Array.from({ length: t.stars }).map((_, s) => (
                    <Star key={s} size={15} className="text-[#C7D300] fill-[#C7D300]" />
                  ))}
                </div>

                <blockquote className="text-gray-700 text-xs sm:text-sm leading-relaxed mb-6 italic">
                  &ldquo;{t.quote}&rdquo;
                </blockquote>

                <div className="flex items-center gap-3 pt-3 border-t border-gray-100">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-[#0F1D27] text-xs font-black shadow-xs"
                    style={{ backgroundColor: `${t.rayonColor}20`, color: t.rayonColor }}
                  >
                    {t.avatar}
                  </div>
                  <div>
                    <p className="font-bold text-xs text-[#0F1D27]">{t.name}</p>
                    <p className="text-[11px] text-gray-400">{t.role}</p>
                  </div>
                  <span
                    className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: `${t.rayonColor}15`, color: t.rayonColor }}
                  >
                    {t.rayon}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── SECTION : CTA FOURNISSEUR PREMIUM ── */}
        <section className="rounded-3xl overflow-hidden relative bg-gradient-to-br from-[#0F1D27] to-[#152a38] p-8 sm:p-14 flex flex-col md:flex-row items-center justify-between gap-8 text-white shadow-2xl border border-white/10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_50%,#C7D30015,transparent_60%)] pointer-events-none" />

          <div className="relative z-10 flex-1 text-center md:text-left">
            <span className="inline-block text-xs font-bold uppercase tracking-widest text-[#C7D300] bg-[#C7D300]/10 border border-[#C7D300]/30 px-3 py-1 rounded-full mb-3">
              Fournisseurs & Professionnels
            </span>
            <h2 className="text-3xl sm:text-4xl font-heading font-black mb-3 leading-tight">
              Rejoignez les <span className="text-[#C7D300]">240+ vendeurs</span> certifiés sur Rayons.
            </h2>
            <p className="text-gray-300 text-xs sm:text-sm max-w-lg leading-relaxed">
              Ouvrez votre boutique officielle, vendez dans toute la RDC et bénéficiez de notre système de séquestre sécurisé.
            </p>
          </div>

          <div className="relative z-10 flex flex-col sm:flex-row gap-3 shrink-0 w-full sm:w-auto">
            <Link
              href="/supplier/register"
              className="inline-flex items-center justify-center gap-2 bg-[#C7D300] text-[#0F1D27] font-heading font-black px-7 py-3.5 rounded-xl hover:bg-[#b5c000] active:scale-95 transition-all shadow-xl shadow-[#C7D300]/20 text-xs sm:text-sm whitespace-nowrap"
            >
              <span>Créer mon espace vendeur</span>
              <ArrowRight size={16} />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center px-5 py-3.5 rounded-xl text-white font-semibold text-xs bg-white/10 hover:bg-white/15 border border-white/20 transition-all text-center"
            >
              J&apos;ai déjà un compte
            </Link>
          </div>
        </section>

      </main>

      <Footer />
    </div>
  );
}
