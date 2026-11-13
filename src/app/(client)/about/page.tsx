import type { Metadata } from "next";
import Link from "next/link";
import { OptimizedImage } from "@/modules/shared/components/OptimizedImage";
import { RayonsLogo } from "@/modules/shared/components/brand/RayonsLogo";
import { Footer } from "@/modules/shared/components/Footer";
import { 
  ShieldCheck, 
  Zap, 
  BadgeCheck, 
  Clock, 
  Store, 
  Users, 
  MapPin, 
  ArrowRight, 
  CheckCircle2, 
  HeartHandshake, 
  Lock, 
  Globe2,
  Sparkles,
  Phone
} from "lucide-react";

export const metadata: Metadata = {
  title: "À propos de Rayons | La marketplace unifiée de référence en RDC",
  description: "Découvrez la mission de Rayons.net : sécuriser le commerce en ligne en RDC grâce au paiement consigné, des commerçants physiques vérifiés et 4 rayons spécialisés (High-Tech, Immo, Mode, Saveurs).",
  alternates: {
    canonical: "https://rayons.net/about",
  },
  openGraph: {
    title: "À propos de Rayons | La marketplace unifiée de référence en RDC",
    description: "Commerce sécurisé, commerçants locaux vérifiés et paiement consigné en RDC.",
    url: "https://rayons.net/about",
    siteName: "Rayons.net",
    locale: "fr_FR",
    type: "website",
  },
};

export default function AboutPage() {
  const departments = [
    {
      id: "connect",
      name: "Rayons Connect",
      tagline: "High-Tech & Connectivité",
      desc: "Starlink, smartphones, informatique, télécoms, matériel audiovisuel et équipements professionnels certifiés.",
      color: "#00B5A5",
      href: "/rayon/connect",
    },
    {
      id: "immo",
      name: "Rayons Immo",
      tagline: "Immobilier & Résidences",
      desc: "Villas, appartements, bureaux et hôtels avec génération de baux conformes et sécurisation de la caution.",
      color: "#4C6EF5",
      href: "/rayon/immo",
    },
    {
      id: "mode",
      name: "Rayons Mode",
      tagline: "Prêt-à-porter & Créateurs",
      desc: "Collections urbaines, créateurs congolais, accessoires, maroquinerie et tenues de prestige.",
      color: "#D4B08C",
      href: "/rayon/mode",
    },
    {
      id: "saveurs",
      name: "Rayons Saveurs",
      tagline: "Gastronomie & Traiteurs",
      desc: "Restaurants locaux, traiteurs d'exception, épicerie fine et caves livrés dans votre ville.",
      color: "#FF6B35",
      href: "/rayon/saveurs",
    },
  ];

  const pillars = [
    {
      icon: ShieldCheck,
      title: "Paiement Consigné (Escrow)",
      desc: "Votre argent est retenu en sécurité lors de la commande. Le commerçant n'est crédité que lorsque vous inspectez et validez le produit en main propre.",
    },
    {
      icon: BadgeCheck,
      title: "Commerçants Réels & Audités",
      desc: "Chaque boutique sur Rayons dispose d'une adresse physique en RDC, d'un registre de commerce (RCCM/NIF/ID Nat) et de gérants vérifiés.",
    },
    {
      icon: Zap,
      title: "Factures Proformas & Devis",
      desc: "Idéal pour les entreprises, ONG et particuliers : négociez en direct avec le vendeur et éditez vos factures proformas officielles en 2 clics.",
    },
    {
      icon: Clock,
      title: "Assistance Locale 7j/7",
      desc: "Des équipes basées à Kinshasa et Lubumbashi à votre écoute par WhatsApp direct et téléphone pour débloquer toute situation.",
    },
  ];

  return (
    <div className="min-h-screen bg-[#0F1D27] text-white flex flex-col font-sans">
      {/* Header Minimalist */}
      <header className="sticky top-0 z-40 bg-[#0F1D27]/90 backdrop-blur-xl border-b border-white/10 px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <RayonsLogo size="md" variant="dark" href="/" />
        <nav className="flex items-center gap-4 text-xs font-semibold">
          <Link href="/" className="text-gray-300 hover:text-white transition-colors">Accueil</Link>
          <Link href="/about" className="text-[#C7D300] font-bold">À propos</Link>
          <Link href="/contact" className="text-gray-300 hover:text-white transition-colors">Contact</Link>
          <Link href="/help" className="text-gray-300 hover:text-white transition-colors">Aide</Link>
          <Link 
            href="/login" 
            className="hidden sm:inline-block px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 transition-colors"
          >
            Connexion
          </Link>
        </nav>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative px-4 sm:px-8 pt-16 pb-20 max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#C7D300]/15 border border-[#C7D300]/30 text-[#C7D300] text-xs font-bold uppercase tracking-wider mb-6">
            <Sparkles size={14} />
            <span>La Marketplace Unifiée en RDC</span>
          </div>
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold text-white tracking-tight leading-tight mb-6">
            Construire la confiance dans le commerce numérique congolais.
          </h1>
          <p className="text-base sm:text-xl text-gray-300 leading-relaxed max-w-3xl mx-auto">
            Rayons.net réunit en un seul endroit les meilleurs fournisseurs de technologies, d&apos;immobilier, de mode et de restauration de Kinshasa, Lubumbashi et des grandes villes de la RDC.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3 text-xs sm:text-sm">
            <Link
              href="/"
              className="inline-flex items-center gap-2 bg-[#C7D300] text-[#0F1D27] font-bold px-6 py-3 rounded-xl hover:bg-[#b5c000] transition-transform active:scale-95 shadow-lg shadow-[#C7D300]/20"
            >
              <span>Explorer la marketplace</span>
              <ArrowRight size={16} />
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 bg-white/10 text-white font-semibold px-5 py-3 rounded-xl hover:bg-white/15 border border-white/15 transition-colors"
            >
              <Phone size={15} />
              <span>Contacter l&apos;équipe</span>
            </Link>
          </div>
        </section>

        {/* Notre Histoire & Mission */}
        <section className="px-4 sm:px-8 py-16 bg-white/[0.02] border-y border-white/10">
          <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
            <div className="space-y-4">
              <span className="text-[#C7D300] text-xs font-bold uppercase tracking-widest">Notre Vision</span>
              <h2 className="text-2xl sm:text-3xl font-bold text-white">Pourquoi Rayons.net ?</h2>
              <p className="text-gray-300 text-sm leading-relaxed">
                Le commerce en RDC a longtemps souffert de l&apos;incertitude : fausses annonces sur les réseaux sociaux, produits non conformes reçus après paiement, ou encore litiges sur les cautions de loyer et les acomptes.
              </p>
              <p className="text-gray-300 text-sm leading-relaxed">
                <strong>Rayons.net a été conçu pour résoudre cette fracture de confiance.</strong> En combinant des adresses de magasins physiques contrôlées, un mécanisme de paiement bloqué jusqu&apos;à la livraison effective, et des livreurs formés, nous créons l&apos;environnement le plus sûr pour les acheteurs et les commerçants.
              </p>
              <div className="pt-2 flex items-center gap-4 text-xs text-gray-400">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 size={16} className="text-[#C7D300]" />
                  <span>100% RDC</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 size={16} className="text-[#C7D300]" />
                  <span>Audit des vendeurs</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 size={16} className="text-[#C7D300]" />
                  <span>Support 7j/7</span>
                </div>
              </div>
            </div>

            <div className="bg-[#0B0F17] border border-white/15 rounded-2xl p-6 sm:p-8 space-y-6 shadow-2xl">
              <h3 className="font-bold text-lg text-white flex items-center gap-2">
                <Globe2 className="text-[#00B5A5]" size={20} />
                <span>Nos Chiffres &amp; Présence</span>
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/5 p-4 rounded-xl border border-white/10">
                  <div className="text-2xl sm:text-3xl font-black text-[#C7D300]">240+</div>
                  <div className="text-xs text-gray-400 mt-1">Boutiques auditées</div>
                </div>
                <div className="bg-white/5 p-4 rounded-xl border border-white/10">
                  <div className="text-2xl sm:text-3xl font-black text-[#00B5A5]">4 800+</div>
                  <div className="text-xs text-gray-400 mt-1">Produits &amp; biens</div>
                </div>
                <div className="bg-white/5 p-4 rounded-xl border border-white/10">
                  <div className="text-2xl sm:text-3xl font-black text-[#4C6EF5]">12 000+</div>
                  <div className="text-xs text-gray-400 mt-1">Clients servis</div>
                </div>
                <div className="bg-white/5 p-4 rounded-xl border border-white/10">
                  <div className="text-2xl sm:text-3xl font-black text-[#FF6B35]">6</div>
                  <div className="text-xs text-gray-400 mt-1">Villes en RDC</div>
                </div>
              </div>
              <p className="text-xs text-gray-400 italic">
                Présents activement à Kinshasa (Gombe, Limete, Bandalungwa, Kintambo) et à Lubumbashi, avec expéditions vers Goma, Kolwezi et Matadi.
              </p>
            </div>
          </div>
        </section>

        {/* Les 4 Rayons Spécialisés */}
        <section className="px-4 sm:px-8 py-20 max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-[#C7D300] text-xs font-bold uppercase tracking-widest">Organisation</span>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-white mt-2">Nos 4 Départements Spécialisés</h2>
            <p className="text-gray-400 text-sm max-w-xl mx-auto mt-2">
              Chaque rayon répond à des exigences techniques et logistiques adaptées aux réalités du marché.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {departments.map((dept) => (
              <Link
                key={dept.id}
                href={dept.href}
                className="group p-6 rounded-2xl bg-[#0B0F17] border border-white/10 hover:border-white/30 transition-all hover:bg-white/[0.04] flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span 
                      className="text-xs font-bold px-2.5 py-1 rounded-md"
                      style={{ backgroundColor: `${dept.color}20`, color: dept.color }}
                    >
                      {dept.tagline}
                    </span>
                    <ArrowRight size={16} className="text-gray-500 group-hover:text-white transition-colors" />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">{dept.name}</h3>
                  <p className="text-xs text-gray-400 leading-relaxed">{dept.desc}</p>
                </div>
                <span className="text-xs font-semibold text-[#C7D300] mt-4 inline-block group-hover:underline">
                  Découvrir le rayon &rarr;
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* Piliers de confiance */}
        <section className="px-4 sm:px-8 py-20 bg-white/[0.02] border-t border-white/10">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <span className="text-[#C7D300] text-xs font-bold uppercase tracking-widest">Nos Engagements</span>
              <h2 className="text-2xl sm:text-4xl font-extrabold text-white mt-2">La Sécurité au Cœur de Chaque Transaction</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {pillars.map((pillar, i) => (
                <div key={i} className="p-6 rounded-2xl bg-[#0B0F17] border border-white/10 flex items-start gap-4">
                  <div className="p-3 rounded-xl bg-[#C7D300]/15 text-[#C7D300] shrink-0">
                    <pillar.icon size={22} />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-white mb-1.5">{pillar.title}</h3>
                    <p className="text-xs text-gray-400 leading-relaxed">{pillar.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Devenir Vendeur / Contact */}
        <section className="px-4 sm:px-8 py-16 max-w-4xl mx-auto text-center">
          <div className="p-8 sm:p-12 rounded-3xl bg-gradient-to-b from-white/10 to-white/5 border border-white/15">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-3">
              Vous êtes commerçant, bailleur ou entrepreneur en RDC ?
            </h2>
            <p className="text-sm text-gray-300 max-w-xl mx-auto mb-6">
              Rejoignez plus de 240 prestataires vérifiés et développez vos ventes auprès d&apos;une clientèle qualifiée avec zéro risque d&apos;impayé.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/supplier/register"
                className="bg-[#C7D300] text-[#0F1D27] font-bold px-6 py-3 rounded-xl hover:bg-[#b5c000] text-xs sm:text-sm shadow-md"
              >
                Créer ma boutique sur Rayons
              </Link>
              <Link
                href="/contact"
                className="bg-white/10 hover:bg-white/20 text-white font-semibold px-6 py-3 rounded-xl text-xs sm:text-sm border border-white/15"
              >
                Parler à un conseiller commercial
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
