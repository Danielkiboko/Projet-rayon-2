"use client";

import { useState } from "react";
import Link from "next/link";
import { RayonsLogo } from "@/modules/shared/components/brand/RayonsLogo";
import { Footer } from "@/modules/shared/components/Footer";
import { 
  Phone, 
  Mail, 
  MapPin, 
  Clock, 
  MessageCircle, 
  Send, 
  CheckCircle2, 
  HelpCircle,
  Sparkles,
  ShieldCheck,
  Building2,
  ArrowRight
} from "lucide-react";
import toast from "react-hot-toast";

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    rayon: "connect",
    subject: "",
    message: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.phone || !formData.message) {
      toast.error("Veuillez remplir au moins votre nom, téléphone et votre message.");
      return;
    }

    setIsSubmitting(true);
    // Simuler l'envoi et proposer la bascule WhatsApp immédiate si souhaitée
    setTimeout(() => {
      setIsSubmitting(false);
      setSubmitted(true);
      toast.success("Votre message a été transmis à notre service client !");
    }, 700);
  };

  const handleOpenWhatsApp = () => {
    const text = encodeURIComponent(
      `Bonjour Rayons, je vous contacte depuis le site web.\nNom: ${formData.name || "Client"}\nMessage: ${formData.message || "J'ai besoin d'une assistance."}`
    );
    window.open(`https://wa.me/243859180031?text=${text}`, "_blank");
  };

  return (
    <div className="min-h-screen bg-[#0F1D27] text-white flex flex-col font-sans">
      {/* Header Minimalist */}
      <header className="sticky top-0 z-40 bg-[#0F1D27]/90 backdrop-blur-xl border-b border-white/10 px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <RayonsLogo size="md" variant="dark" href="/" />
        <nav className="flex items-center gap-4 text-xs font-semibold">
          <Link href="/" className="text-gray-300 hover:text-white transition-colors">Accueil</Link>
          <Link href="/about" className="text-gray-300 hover:text-white transition-colors">À propos</Link>
          <Link href="/contact" className="text-[#C7D300] font-bold">Contact</Link>
          <Link href="/help" className="text-gray-300 hover:text-white transition-colors">Aide</Link>
          <Link 
            href="/login" 
            className="hidden sm:inline-block px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 transition-colors"
          >
            Connexion
          </Link>
        </nav>
      </header>

      <main className="flex-1 px-4 sm:px-8 py-12 sm:py-16 max-w-6xl mx-auto w-full">
        {/* Titre & Sous-titre */}
        <div className="text-center max-w-2xl mx-auto mb-12 sm:mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#C7D300]/15 border border-[#C7D300]/30 text-[#C7D300] text-xs font-bold uppercase tracking-wider mb-4">
            <Sparkles size={14} />
            <span>Support &amp; Relations Clients</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight mb-4">
            Contactez notre équipe locale
          </h1>
          <p className="text-sm sm:text-base text-gray-300 leading-relaxed">
            Une question sur une commande, un litige, un partenariat ou une inscription commerçant ? Nous vous répondons 7 jours sur 7.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Bloc Coordonnées & Canaux Directs (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            {/* WhatsApp Direct Highlight */}
            <div className="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 relative overflow-hidden">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                  <MessageCircle size={22} />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Assistance WhatsApp Direct</h3>
                  <span className="text-[11px] text-emerald-300 font-medium">Réponse moyenne en moins de 15 minutes</span>
                </div>
              </div>
              <p className="text-xs text-gray-300 mb-4 leading-relaxed">
                Le canal le plus rapide pour joindre nos conseillers à Kinshasa et Lubumbashi, envoyer une photo d&apos;article ou demander un devis.
              </p>
              <a
                href="https://wa.me/243859180031?text=Bonjour%20Rayons,%20j%27ai%20besoin%20d%27une%20assistance"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-bold py-3 px-4 rounded-xl text-xs sm:text-sm transition-all shadow-md"
              >
                <span>Ouvrir WhatsApp (+243 85 91 800 31)</span>
                <ArrowRight size={16} />
              </a>
            </div>

            {/* Téléphone & Email */}
            <div className="p-6 rounded-2xl bg-[#0B0F17] border border-white/10 space-y-5">
              <h3 className="font-bold text-white text-sm uppercase tracking-wider text-[#C7D300]">
                Coordonnées Officielles
              </h3>

              <div className="space-y-4 text-xs sm:text-sm">
                <div className="flex items-start gap-3.5">
                  <div className="p-2.5 rounded-lg bg-white/5 text-gray-300 shrink-0">
                    <Phone size={18} />
                  </div>
                  <div>
                    <span className="text-gray-400 text-xs block">Téléphone direct</span>
                    <a href="tel:+243859180031" className="font-semibold text-white hover:underline">
                      +243 85 91 800 31
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-3.5">
                  <div className="p-2.5 rounded-lg bg-white/5 text-gray-300 shrink-0">
                    <Mail size={18} />
                  </div>
                  <div>
                    <span className="text-gray-400 text-xs block">Courriers électroniques</span>
                    <a href="mailto:contact@rayons.net" className="font-semibold text-white hover:underline block">
                      contact@rayons.net
                    </a>
                    <a href="mailto:support@rayons.net" className="text-gray-400 text-xs hover:underline block mt-0.5">
                      support@rayons.net
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-3.5">
                  <div className="p-2.5 rounded-lg bg-white/5 text-gray-300 shrink-0">
                    <MapPin size={18} />
                  </div>
                  <div>
                    <span className="text-gray-400 text-xs block">Bureaux &amp; Plateformes RDC</span>
                    <span className="font-semibold text-white block">Kinshasa : Boulevard du 30 Juin, Gombe</span>
                    <span className="text-gray-400 text-xs block mt-0.5">Lubumbashi : Centre-Ville, Haut-Katanga</span>
                  </div>
                </div>

                <div className="flex items-start gap-3.5">
                  <div className="p-2.5 rounded-lg bg-white/5 text-gray-300 shrink-0">
                    <Clock size={18} />
                  </div>
                  <div>
                    <span className="text-gray-400 text-xs block">Heures d&apos;ouverture</span>
                    <span className="font-semibold text-white block">Du Lundi au Dimanche (7j/7)</span>
                    <span className="text-gray-400 text-xs block mt-0.5">08h00 &ndash; 21h00 (Heure de Kinshasa / GMT+1)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Assistance rapide */}
            <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                <HelpCircle size={20} className="text-[#C7D300]" />
                <div>
                  <span className="font-bold text-white block">Besoin d&apos;une réponse immédiate ?</span>
                  <span className="text-gray-400 text-[11px]">Consultez notre foire aux questions</span>
                </div>
              </div>
              <Link href="/help" className="text-[#C7D300] font-bold hover:underline">
                FAQ &rarr;
              </Link>
            </div>
          </div>

          {/* Formulaire de Contact (7 cols) */}
          <div className="lg:col-span-7 bg-[#0B0F17] border border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl">
            {submitted ? (
              <div className="text-center py-12 space-y-4">
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                  <CheckCircle2 size={36} />
                </div>
                <h3 className="text-2xl font-bold text-white">Message bien reçu !</h3>
                <p className="text-sm text-gray-300 max-w-md mx-auto leading-relaxed">
                  Merci <strong>{formData.name}</strong>, notre service d&apos;assistance a bien pris note de votre demande. Un conseiller vous recontactera très rapidement.
                </p>
                <div className="pt-4 flex flex-wrap justify-center gap-3">
                  <button
                    type="button"
                    onClick={handleOpenWhatsApp}
                    className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-bold px-5 py-2.5 rounded-xl text-xs"
                  >
                    <MessageCircle size={16} />
                    <span>Poursuivre sur WhatsApp</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSubmitted(false);
                      setFormData({ name: "", email: "", phone: "", rayon: "connect", subject: "", message: "" });
                    }}
                    className="bg-white/10 text-white font-medium px-4 py-2.5 rounded-xl text-xs hover:bg-white/15"
                  >
                    Envoyer un autre message
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <h2 className="text-xl font-bold text-white mb-1">Envoyez-nous un message</h2>
                  <p className="text-xs text-gray-400">Remplissez ce formulaire et notre équipe vous recontactera sous 2 heures ouvrées.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                      Votre Nom complet <span className="text-[#C7D300]">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Jean Mukendi"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-black/40 border border-white/15 rounded-xl text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-[#C7D300]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                      Numéro de Téléphone / WhatsApp <span className="text-[#C7D300]">*</span>
                    </label>
                    <input
                      type="tel"
                      required
                      placeholder="Ex: +243 85 000 0000"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-black/40 border border-white/15 rounded-xl text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-[#C7D300]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                      Adresse Email (facultatif)
                    </label>
                    <input
                      type="email"
                      placeholder="jean@exemple.cd"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-black/40 border border-white/15 rounded-xl text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-[#C7D300]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                      Rayon concerné
                    </label>
                    <select
                      value={formData.rayon}
                      onChange={(e) => setFormData({ ...formData, rayon: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-black/40 border border-white/15 rounded-xl text-sm text-white focus:outline-none focus:border-[#C7D300] cursor-pointer"
                    >
                      <option value="connect">Rayon Connect (Tech, Télécoms, Starlink)</option>
                      <option value="immo">Rayon Immo (Immobilier, Baux, Cautions)</option>
                      <option value="mode">Rayon Mode (Vêtements, Créateurs)</option>
                      <option value="saveurs">Rayon Saveurs (Gastronomie, Traiteurs)</option>
                      <option value="autre">Autre / Partenariat / Fournisseur</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                    Sujet de votre message
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Demande de devis pour équipement de bureau"
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-black/40 border border-white/15 rounded-xl text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-[#C7D300]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                    Votre Message <span className="text-[#C7D300]">*</span>
                  </label>
                  <textarea
                    required
                    rows={5}
                    placeholder="Détaillez votre demande ou votre question..."
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-black/40 border border-white/15 rounded-xl text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-[#C7D300] resize-none"
                  />
                </div>

                <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full sm:w-auto flex-1 inline-flex items-center justify-center gap-2 bg-[#C7D300] hover:bg-[#b5c000] text-[#0F1D27] font-bold py-3 px-6 rounded-xl text-sm transition-all shadow-md cursor-pointer disabled:opacity-50"
                  >
                    <Send size={16} />
                    <span>{isSubmitting ? "Envoi en cours..." : "Envoyer le message"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleOpenWhatsApp}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 font-semibold py-3 px-5 rounded-xl text-sm transition-colors cursor-pointer"
                  >
                    <MessageCircle size={16} />
                    <span>WhatsApp direct</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

