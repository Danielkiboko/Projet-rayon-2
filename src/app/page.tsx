"use client";

import { useState, useEffect, useRef } from "react";
import { OptimizedImage } from "@/modules/shared/components/OptimizedImage";
import Link from "next/link";
import {
  Search, User, Menu, MapPin, ChevronRight, Star, Heart, TrendingUp,
  Home as HomeIcon, Wifi, Building, Globe, ArrowRight, Shirt,
  MessageCircle, Sparkles, UtensilsCrossed, ShoppingBag, X,
  CheckCircle, Shield, Zap, Clock, Package, Users, PlayCircle,
  Quote, ChevronDown, Send
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Footer } from "@/modules/shared/components/Footer";
import { useChat } from "@/context/ChatContext";
import { useCart } from "@/context/CartContext";
import { useCurrency, CurrencyCode } from "@/context/CurrencyContext";
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

// --- Intersection Observer Hook ---
function useInView(threshold = 0.2) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setInView(true);
    }, { threshold });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [threshold]);
  return { ref, inView };
}

// --- Testimonials data ---
const testimonials = [
  {
    quote: "En trois semaines, j'ai listé mon appartement et trouvé un locataire sérieux. Le processus était incroyablement simple.",
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
    quote: "J'ai commandé du matériel tech pour mon bureau. Livraison rapide, produit conforme. Je recommande sans hésiter.",
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
  { label: "Fournisseurs actifs", value: 240, suffix: "+" },
  { label: "Produits & biens listés", value: 4800, suffix: "+" },
  { label: "Clients satisfaits", value: 12000, suffix: "+" },
  { label: "Villes couvertes", value: 6, suffix: "" },
];

// --- Rayons config ---
const rayons = [
  {
    id: "connect",
    href: "/rayon/connect",
    color: "#00B5A5",
    bgLight: "bg-[#00B5A5]/8",
    border: "hover:border-[#00B5A5]/50",
    icon: Wifi,
    tag: "Innovation & Tech",
    title: "Rayons Connect",
    desc: "Starlink, smartphones, audio, domotique et équipements professionnels connectés.",
    emoji: "📡",
  },
  {
    id: "immo",
    href: "/rayon/immo",
    color: "#4C6EF5",
    bgLight: "bg-[#4C6EF5]/8",
    border: "hover:border-[#4C6EF5]/50",
    icon: Building,
    tag: "Immobilier & Hôtellerie",
    title: "Rayons Immo",
    desc: "Villas, appartements, bureaux premium et réservations d'hôtels de prestige.",
    emoji: "🏢",
  },
  {
    id: "mode",
    href: "/rayon/mode",
    color: "#D4B08C",
    bgLight: "bg-[#D4B08C]/15",
    border: "hover:border-[#D4B08C]/60",
    icon: Shirt,
    tag: "Mode & Lifestyle",
    title: "Rayons Mode",
    desc: "Prêt-à-porter haut de gamme, maroquinerie, accessoires et collections exclusives.",
    emoji: "👗",
  },
  {
    id: "saveurs",
    href: "/rayon/saveurs",
    color: "#FF6B35",
    bgLight: "bg-[#FF6B35]/8",
    border: "hover:border-[#FF6B35]/60",
    icon: UtensilsCrossed,
    tag: "Gastronomie & Cuisine",
    title: "Rayons Saveurs",
    desc: "Restaurants, plats de chefs en livraison rapide et ustensiles & équipements de cuisine.",
    emoji: "🍽️",
  },
];

// --- Why Rayons features ---
const whyFeatures = [
  {
    icon: Shield,
    title: "Paiement 100% sécurisé",
    desc: "Vos transactions sont protégées. Achetez en toute confiance.",
    color: "#4C6EF5",
  },
  {
    icon: Zap,
    title: "Mise en ligne en minutes",
    desc: "Fournisseurs, publiez vos produits ou biens en quelques clics.",
    color: "#C7D300",
  },
  {
    icon: Clock,
    title: "Support réactif",
    desc: "Notre équipe répond rapidement. Un vrai humain, pas un bot.",
    color: "#FF6B35",
  },
  {
    icon: Package,
    title: "Livraison suivie",
    desc: "Commandes trackées de chez le fournisseur jusqu'à votre porte.",
    color: "#00B5A5",
  },
];

export default function Home() {
  const { user, userData, signOut } = useAuth();
  const { toggleChat, openChatForProduct } = useChat();
  const { currency, setCurrency, formatPrice } = useCurrency();
  const { totalItems, openCart } = useCart();

  const [dbProducts, setDbProducts] = useState<any[]>([]);
  const [dbProperties, setDbProperties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeTestimonial, setActiveTestimonial] = useState(0);
  const [heroVisible, setHeroVisible] = useState(false);

  const statsRef = useRef<HTMLDivElement>(null);
  const [statsInView, setStatsInView] = useState(false);

  useEffect(() => {
    setHeroVisible(true);
  }, []);

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
          getDocs(query(collection(db, "products"), limit(50))),
          getDocs(query(collection(db, "properties"), where("status", "==", "Disponible"), limit(4)))
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

  const allProducts = dbProducts;
  const s0 = useCounter(stats[0].value, 1800, statsInView);
  const s1 = useCounter(stats[1].value, 2000, statsInView);
  const s2 = useCounter(stats[2].value, 2200, statsInView);
  const s3 = useCounter(stats[3].value, 1400, statsInView);
  const statCounts = [s0, s1, s2, s3];

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans selection:bg-[#C7D300]/30 selection:text-[#0F1D27]">

      {/* ═══════════════════════════════════════════════════════
          HEADER
      ═══════════════════════════════════════════════════════ */}
      <header className="bg-white/96 backdrop-blur-lg sticky top-0 z-50 border-b border-gray-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">

          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 -ml-2 text-gray-600 hover:text-[#0F1D27] lg:hidden rounded-lg hover:bg-gray-100 transition"
            >
              {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
            <RayonsLogo size="md" href="/" />
          </div>

          <nav className="hidden lg:flex items-center gap-1 bg-gray-50 p-1 rounded-full border border-gray-100">
            <Link href="/" className="flex items-center gap-2 text-sm font-semibold text-[#0F1D27] bg-white shadow-sm px-4 py-1.5 rounded-full">
              <HomeIcon size={15} /> Accueil
            </Link>
            <Link href="/rayon/connect" className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-[#00B5A5] hover:bg-white px-4 py-1.5 rounded-full transition-all">
              <Wifi size={15} className="text-[#00B5A5]" /> Connect
            </Link>
            <Link href="/rayon/immo" className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-[#4C6EF5] hover:bg-white px-4 py-1.5 rounded-full transition-all">
              <Building size={15} className="text-[#4C6EF5]" /> Immo
            </Link>
            <Link href="/rayon/mode" className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-[#9C764D] hover:bg-white px-4 py-1.5 rounded-full transition-all">
              <Shirt size={15} className="text-[#D4B08C]" /> Mode
            </Link>
            <Link href="/rayon/saveurs" className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-[#FF6B35] hover:bg-white px-4 py-1.5 rounded-full transition-all">
              <UtensilsCrossed size={15} className="text-[#FF6B35]" /> Saveurs
            </Link>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden sm:block"><CurrencySelector /></div>

            {user ? (
              <div className="flex items-center gap-2">
                <Link href="/dashboard" className="flex items-center gap-1.5 text-sm font-bold text-[#0F1D27] bg-gray-100 hover:bg-gray-200 px-3.5 py-2 rounded-full transition-colors">
                  <User size={15} />
                  <span className="hidden sm:block">{userData?.displayName || user.displayName || "Mon espace"}</span>
                </Link>
                <button onClick={signOut} className="hidden sm:block text-sm font-bold text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-2 rounded-full transition-colors">
                  Déconnexion
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link href="/login" className="text-sm font-semibold text-gray-600 hover:text-[#0F1D27] px-3 py-2 rounded-full transition-colors">
                  Connexion
                </Link>
                <Link href="/supplier/register" className="text-sm font-bold text-[#0F1D27] bg-[#C7D300] hover:bg-[#b5c000] px-4 py-2 rounded-full transition-all shadow-sm shadow-[#C7D300]/30">
                  Devenir partenaire
                </Link>
              </div>
            )}
            <NotificationBell />
            <button
              onClick={openCart}
              className="relative p-2.5 text-[#0F1D27] hover:bg-gray-100 rounded-full transition-colors group cursor-pointer"
              title="Votre Panier"
            >
              <ShoppingBag size={21} className="group-hover:scale-110 transition-transform" />
              {totalItems > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-[#C7D300] text-[#0F1D27] text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                  {totalItems}
                </span>
              )}
            </button>
            <button onClick={toggleChat} className="relative p-2.5 text-[#0F1D27] hover:bg-gray-100 rounded-full transition-colors group" title="Messagerie">
              <MessageCircle size={21} className="group-hover:scale-110 transition-transform" />
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-gray-100 bg-white px-4 py-3 flex flex-col gap-1">
            {[
              { href: "/rayon/connect", icon: Wifi, label: "Rayons Connect", color: "#00B5A5" },
              { href: "/rayon/immo", icon: Building, label: "Rayons Immo", color: "#4C6EF5" },
              { href: "/rayon/mode", icon: Shirt, label: "Rayons Mode", color: "#9C764D" },
              { href: "/rayon/saveurs", icon: UtensilsCrossed, label: "Rayons Saveurs", color: "#FF6B35" },
            ].map(item => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 transition-colors"
              >
                <item.icon size={18} style={{ color: item.color }} />
                <span className="font-semibold text-sm text-gray-700">{item.label}</span>
              </Link>
            ))}
          </div>
        )}
      </header>

      {/* ═══════════════════════════════════════════════════════
          HERO — Humain, narratif, premium
      ═══════════════════════════════════════════════════════ */}
      <section className="relative min-h-[88vh] flex items-center bg-[#0F1D27] overflow-hidden">
        {/* Background image */}
        <OptimizedImage
          src="https://images.unsplash.com/photo-1556761175-5973dc0f32d7?auto=format&fit=crop&q=80&w=2400"
          alt="Rayons marketplace"
          fill
          priority
          className="absolute inset-0 object-cover opacity-25 mix-blend-luminosity"
          sizes="100vw"
        />
        {/* Gradient layers */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#0F1D27] via-[#0F1D27]/90 to-[#0F1D27]/70" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0F1D27] via-transparent to-transparent" />

        {/* Decorative blobs */}
        <div className="absolute top-20 right-0 w-[500px] h-[500px] bg-[#C7D300]/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-20 w-[300px] h-[300px] bg-[#4C6EF5]/8 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-20 w-full">
          <div className="max-w-3xl">

            {/* Human trust signal */}
            <div
              className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-white/8 border border-white/15 backdrop-blur-sm mb-8 w-max"
              style={{
                opacity: heroVisible ? 1 : 0,
                transform: heroVisible ? "translateY(0)" : "translateY(12px)",
                transition: "opacity 0.7s ease, transform 0.7s ease",
              }}
            >
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

            {/* Main headline — conversational, human */}
            <h1
              className="font-heading text-4xl sm:text-5xl md:text-6xl font-extrabold text-white leading-[1.08] mb-6 tracking-tight"
              style={{
                opacity: heroVisible ? 1 : 0,
                transform: heroVisible ? "translateY(0)" : "translateY(20px)",
                transition: "opacity 0.8s ease 0.1s, transform 0.8s ease 0.1s",
              }}
            >
              Ce que vous cherchez{" "}
              <span className="text-[#C7D300] relative">
                existe ici.
                <svg className="absolute -bottom-1 left-0 w-full" height="6" viewBox="0 0 200 6" fill="none">
                  <path d="M0 5 Q50 1 100 5 Q150 1 200 5" stroke="#C7D300" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.6" />
                </svg>
              </span>
            </h1>

            {/* Subheadline — real words, not corporate */}
            <p
              className="text-gray-300 text-lg sm:text-xl mb-10 max-w-xl leading-relaxed"
              style={{
                opacity: heroVisible ? 1 : 0,
                transform: heroVisible ? "translateY(0)" : "translateY(20px)",
                transition: "opacity 0.8s ease 0.2s, transform 0.8s ease 0.2s",
              }}
            >
              Immobilier, mode, tech ou gastronomie — Rayons connecte les acheteurs aux meilleurs fournisseurs locaux, simplement.
            </p>

            {/* Search bar */}
            <div
              className="mb-10 max-w-2xl"
              style={{
                opacity: heroVisible ? 1 : 0,
                transform: heroVisible ? "translateY(0)" : "translateY(20px)",
                transition: "opacity 0.9s ease 0.3s, transform 0.9s ease 0.3s",
              }}
            >
              <UniversalSearchBar products={dbProducts} properties={dbProperties} />
            </div>

            {/* CTAs */}
            <div
              className="flex flex-wrap items-center gap-4"
              style={{
                opacity: heroVisible ? 1 : 0,
                transform: heroVisible ? "translateY(0)" : "translateY(20px)",
                transition: "opacity 1s ease 0.4s, transform 1s ease 0.4s",
              }}
            >
              <button
                onClick={() => document.getElementById("rayons")?.scrollIntoView({ behavior: "smooth" })}
                className="inline-flex items-center gap-2 bg-[#C7D300] text-[#0F1D27] font-heading font-bold px-7 py-3.5 rounded-xl hover:bg-[#b5c000] active:scale-95 transition-all shadow-lg shadow-[#C7D300]/25 text-base cursor-pointer"
              >
                Explorer les rayons
                <ArrowRight size={18} />
              </button>
              <Link
                href="/supplier/register"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl text-white font-semibold text-base bg-white/10 hover:bg-white/16 border border-white/20 backdrop-blur-sm transition-all"
              >
                Devenir fournisseur
              </Link>
            </div>

          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-white/30 animate-bounce">
          <ChevronDown size={22} />
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          STATS — Social proof with animated counters
      ═══════════════════════════════════════════════════════ */}
      <div ref={statsRef} className="bg-[#0F1D27] border-t border-white/5">
        <div className="max-w-7xl mx-auto px-4 py-12 grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-4">
          {stats.map((stat, i) => (
            <div key={i} className="text-center">
              <div className="text-3xl sm:text-4xl font-heading font-extrabold text-white mb-1">
                {statCounts[i].toLocaleString()}{stat.suffix}
              </div>
              <p className="text-sm text-gray-400 font-medium">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════
          MAIN CONTENT
      ═══════════════════════════════════════════════════════ */}
      <main className="max-w-7xl mx-auto px-4 pt-16 pb-20 space-y-20">

        {/* ── LES RAYONS ── */}
        <section id="rayons" className="scroll-mt-20">
          <div className="text-center mb-12">
            <span className="inline-block text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">
              Quatre univers, une seule plateforme
            </span>
            <h2 className="text-3xl sm:text-4xl font-heading font-extrabold text-[#0F1D27] tracking-tight">
              Explorez les Rayons
            </h2>
            <p className="text-gray-500 mt-3 max-w-lg mx-auto text-base">
              Chaque rayon a son équipe, ses fournisseurs vérifiés et ses standards qualité. Cliquez pour entrer.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {rayons.map((r) => (
              <Link
                key={r.id}
                href={r.href}
                className={`group relative bg-white rounded-2xl p-6 border border-gray-100 ${r.border} hover:shadow-xl transition-all duration-300 flex flex-col gap-4 overflow-hidden`}
              >
                {/* Subtle radial glow on hover */}
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                  style={{ background: `radial-gradient(circle at top right, ${r.color}10, transparent 65%)` }}
                />

                <div className="relative z-10">
                  {/* Icon */}
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-all duration-300 group-hover:scale-110"
                    style={{ backgroundColor: `${r.color}18`, color: r.color }}
                  >
                    <r.icon size={24} />
                  </div>

                  {/* Tag */}
                  <span
                    className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-md mb-2 inline-block"
                    style={{ backgroundColor: `${r.color}15`, color: r.color }}
                  >
                    {r.tag}
                  </span>

                  <h3 className="text-lg font-heading font-extrabold text-[#0F1D27] mb-1.5 flex items-center gap-1">
                    {r.title}
                    <ChevronRight
                      size={16}
                      className="opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all"
                      style={{ color: r.color }}
                    />
                  </h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{r.desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* ── POURQUOI RAYONS — Human copywriting ── */}
        <section className="rounded-3xl bg-[#0F1D27] px-6 sm:px-12 py-14 relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,#C7D30012,transparent_60%)] pointer-events-none" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,#4C6EF508,transparent_60%)] pointer-events-none" />

          <div className="relative z-10 text-center mb-12">
            <span className="inline-block text-xs font-bold uppercase tracking-widest text-[#C7D300]/70 mb-3">
              Pourquoi nous choisir
            </span>
            <h2 className="text-3xl sm:text-4xl font-heading font-extrabold text-white tracking-tight">
              Simple. Fiable. Humain.
            </h2>
            <p className="text-gray-400 mt-3 max-w-lg mx-auto">
              On ne promet pas la lune — on s'assure juste que ça marche, à chaque fois.
            </p>
          </div>

          <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {whyFeatures.map((f, i) => (
              <div
                key={i}
                className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:bg-white/8 hover:border-white/20 transition-all group"
              >
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"
                  style={{ backgroundColor: `${f.color}20`, color: f.color }}
                >
                  <f.icon size={22} />
                </div>
                <h3 className="font-heading font-bold text-white text-base mb-2">{f.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── PRODUCTS SECTIONS BY RAYON ── */}
        {(() => {
          const renderProductGrid = (title: string, subtitle: string, categoryFilter: string, link: string, accentColor: string) => {
            const isImmoSection = categoryFilter.toLowerCase() === "immo";
            const isSaveursSection = categoryFilter.toLowerCase() === "saveurs";

            const items = isImmoSection
              ? dbProperties.slice(0, 4)
              : allProducts.filter(p => {
                  const cat = (p.category || "").toLowerCase();
                  if (isSaveursSection) {
                    return cat.includes("saveurs") || cat.includes("resto") || cat.includes("cuisine") || cat.includes("repas") || cat.includes("food");
                  }
                  return cat.includes(categoryFilter.toLowerCase());
                }).slice(0, 4);

            return (
              <section key={categoryFilter} className="mt-2">
                <div className="flex flex-col mb-6 px-1 gap-2">
                  <div>
                    <span
                      className="text-[11px] font-bold px-3 py-1 rounded-full uppercase tracking-wider border inline-block"
                      style={{ color: accentColor, backgroundColor: `${accentColor}15`, borderColor: `${accentColor}30` }}
                    >
                      {subtitle}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-end justify-between gap-4">
                    <h2 className="text-2xl sm:text-3xl font-heading font-extrabold text-[#0F1D27] tracking-tight">
                      {title}
                    </h2>
                    <Link
                      href={link}
                      className="text-sm font-bold flex items-center gap-1 transition-colors hover:opacity-80"
                      style={{ color: accentColor }}
                    >
                      Voir tout <ChevronRight size={16} />
                    </Link>
                  </div>
                </div>

                {loading ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
                    {[1, 2, 3, 4].map(i => (
                      <div key={i} className="animate-pulse bg-white rounded-2xl h-64 border border-gray-100" />
                    ))}
                  </div>
                ) : items.length === 0 ? (
                  <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-gray-200">
                    <p className="text-gray-400 font-medium">Bientôt de nouveaux articles dans ce rayon.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
                    {items.map((item) => {
                      const itemName = item.title?.fr || item.title || item.name || "Article";
                      const itemImage = item.image || item.images?.[0] || "https://images.unsplash.com/photo-1522071820081-009f0129c71c";
                      const itemCategory = isImmoSection
                        ? (item.immoBranch === "hotel" ? "Hôtel / Nuitée" : item.typeTransaction || "Immobilier")
                        : (item.category || "Produit");

                      return (
                        <div
                          key={item.id}
                          className="group bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 border border-gray-100 flex flex-col"
                        >
                          <div className="relative aspect-square overflow-hidden bg-gray-100">
                            <OptimizedImage
                              src={itemImage}
                              alt={itemName}
                              fill
                              sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
                              className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500"
                            />
                            <button className="absolute top-3 right-3 w-8 h-8 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center text-gray-400 hover:text-red-500 shadow-sm transition-all active:scale-90">
                              <Heart size={15} />
                            </button>
                          </div>
                          <div className="p-4 flex flex-col flex-1">
                            <p className="text-xs font-semibold text-gray-400 mb-1 truncate">{itemCategory}</p>
                            <h3 className="font-bold text-gray-900 text-sm leading-snug mb-2 line-clamp-2 group-hover:text-[#0F1D27] transition-colors">
                              {itemName}
                            </h3>
                            <div className="mt-auto flex items-center justify-between pt-3 border-t border-gray-50">
                              <span className="font-bold text-base text-gray-900">
                                {formatPrice(item.price)}
                                {isImmoSection && item.immoBranch === "hotel" && <span className="text-xs text-gray-400 font-normal"> / nuit</span>}
                                {isImmoSection && item.typeTransaction?.toLowerCase().includes("locat") && <span className="text-xs text-gray-400 font-normal"> / mois</span>}
                              </span>
                              <button
                                onClick={() => openChatForProduct({ id: item.id, supplierId: item.supplierId || "admin", name: itemName })}
                                className="w-8 h-8 rounded-full bg-gray-100 text-gray-700 flex items-center justify-center hover:bg-[#0F1D27] hover:text-white transition-all active:scale-90"
                                title="Poser une question"
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
            <>
              {renderProductGrid("Populaire en Mode", "Mode & Accessoires", "Mode", "/rayon/mode", "#D4B08C")}
              {renderProductGrid("Dernières technologies", "Tech & Services", "Connect", "/rayon/connect", "#00B5A5")}
              {renderProductGrid("Délices & Cuisine", "Gastronomie & Cuisine", "Saveurs", "/rayon/saveurs", "#FF6B35")}
              {renderProductGrid("Biens immobiliers", "Immobilier & Hôtellerie", "Immo", "/rayon/immo", "#4C6EF5")}
            </>
          );
        })()}

        {/* ── TESTIMONIALS ── */}
        <section className="mt-4">
          <div className="text-center mb-10">
            <span className="inline-block text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">
              Ils témoignent
            </span>
            <h2 className="text-3xl sm:text-4xl font-heading font-extrabold text-[#0F1D27] tracking-tight">
              Ce qu'ils en pensent vraiment
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {testimonials.map((t, i) => (
              <div
                key={i}
                className={`bg-white rounded-2xl p-6 border transition-all duration-300 ${i === activeTestimonial ? "border-[#C7D300] shadow-md shadow-[#C7D300]/10" : "border-gray-100"}`}
              >
                {/* Stars */}
                <div className="flex gap-0.5 mb-4">
                  {Array.from({ length: t.stars }).map((_, s) => (
                    <Star key={s} size={14} className="text-[#C7D300] fill-[#C7D300]" />
                  ))}
                </div>

                {/* Quote */}
                <blockquote className="text-gray-700 text-sm leading-relaxed mb-5 italic">
                  "{t.quote}"
                </blockquote>

                {/* Author */}
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-[#0F1D27] text-xs font-extrabold ring-2 ring-white shadow-sm"
                    style={{ backgroundColor: `${t.rayonColor}25`, color: t.rayonColor }}
                  >
                    {t.avatar}
                  </div>
                  <div>
                    <p className="font-bold text-sm text-[#0F1D27]">{t.name}</p>
                    <p className="text-xs text-gray-400">{t.role}</p>
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

        {/* ── CTA PARTNER BANNER ── */}
        <section className="rounded-3xl overflow-hidden relative bg-gradient-to-br from-[#0F1D27] to-[#1a3040] p-10 sm:p-14 flex flex-col md:flex-row items-center gap-8 md:gap-12">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_50%,#C7D30010,transparent_60%)] pointer-events-none" />

          <div className="relative z-10 flex-1 text-center md:text-left">
            <span className="inline-block text-xs font-bold uppercase tracking-widest text-[#C7D300]/70 mb-3">
              Vous êtes un professionnel ?
            </span>
            <h2 className="text-3xl sm:text-4xl font-heading font-extrabold text-white mb-4 leading-tight">
              Rejoignez les{" "}
              <span className="text-[#C7D300]">240+ fournisseurs</span>{" "}
              qui vendent sur Rayons.
            </h2>
            <p className="text-gray-300 text-base max-w-xl leading-relaxed">
              Créez votre espace en 15 minutes. Profitez de 15 jours d'essai gratuit pour tester la plateforme sans risque.
            </p>
          </div>

          <div className="relative z-10 flex flex-col sm:flex-row md:flex-col gap-3 shrink-0">
            <Link
              href="/supplier/register"
              className="inline-flex items-center justify-center gap-2 bg-[#C7D300] text-[#0F1D27] font-heading font-bold px-8 py-4 rounded-xl hover:bg-[#b5c000] active:scale-95 transition-all shadow-lg shadow-[#C7D300]/25 text-base whitespace-nowrap"
            >
              Créer mon espace gratuitement
              <ArrowRight size={18} />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 px-6 py-4 rounded-xl text-white font-semibold text-sm bg-white/10 hover:bg-white/15 border border-white/20 transition-all"
            >
              J'ai déjà un compte
            </Link>
          </div>
        </section>

      </main>

      <Footer />
    </div>
  );
}
