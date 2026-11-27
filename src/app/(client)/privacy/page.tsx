import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck, Trash2, Lock, Mail, ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Politique de Confidentialité & Sécurité des Données | Rayons.net",
  description:
    "Politique officielle de confidentialité, sécurité des données et procédure de suppression de compte pour le site web et l'application mobile Rayons.net.",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-[#0F1D27] text-gray-100 py-10 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-semibold text-gray-300 hover:text-white bg-white/5 border border-white/10 px-3.5 py-2 rounded-xl transition-colors"
          >
            <ArrowLeft size={14} />
            <span>Retour sur Rayons.net</span>
          </Link>
          <span className="text-[11px] font-mono text-gray-400">Dernière mise à jour : 2026</span>
        </div>

        <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-6 sm:p-8 space-y-6">
          <div className="flex items-start gap-3 border-b border-white/10 pb-5">
            <div className="p-2.5 rounded-xl bg-[#C7D300]/15 border border-[#C7D300]/30 text-[#C7D300] shrink-0">
              <ShieldCheck size={22} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-white">
                Politique de Confidentialité — Rayons.net &amp; Application Mobile
              </h1>
              <p className="text-xs sm:text-sm text-gray-400 mt-1">
                Conforme aux exigences Google Play Data Safety, App Store et à la protection des données utilisateurs en RDC.
              </p>
            </div>
          </div>

          <section className="space-y-2 text-sm text-gray-300 leading-relaxed">
            <h2 className="text-base font-bold text-white">1. Données collectées</h2>
            <p>
              Pour fournir les services de marketplace (achat, livraison, gestion locative immobilière et espace vendeur), Rayons.net collecte uniquement les informations strictement nécessaires :
            </p>
            <ul className="list-disc pl-5 space-y-1 text-gray-300">
              <li><strong>Identité &amp; contact</strong> : nom, adresse email, numéro de téléphone, adresse de livraison.</li>
              <li><strong>Transactions &amp; baux</strong> : historique de commandes, factures proforma, contrats de bail et quittances de loyer.</li>
              <li><strong>Notifications Push</strong> : jeton d’appareil sécurisé (Firebase Cloud Messaging) afin d’envoyer les suivis de commande, rappels de loyer et alertes de panier.</li>
              <li><strong>Permissions mobiles (optionnelles)</strong> : appareil photo / galerie (uniquement lors de l’envoi d’une photo de produit ou d’un justificatif) et localisation (uniquement pour préciser une adresse de livraison).</li>
            </ul>
          </section>

          <section className="space-y-2 text-sm text-gray-300 leading-relaxed">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Lock size={15} className="text-emerald-400" />
              <span>2. Sécurité &amp; Paiements</span>
            </h2>
            <p>
              Toutes les communications entre l’application mobile, votre navigateur et nos serveurs sont chiffrées en <strong>HTTPS / TLS</strong>. Rayons.net ne stocke <strong>jamais</strong> les numéros complets de cartes bancaires Visa/Mastercard : les paiements par carte sont traités exclusivement sur des pages sécurisées certifiées PCI-DSS de nos partenaires de paiement.
            </p>
          </section>

          <section className="space-y-2 text-sm text-gray-300 leading-relaxed">
            <h2 className="text-base font-bold text-white">3. Partage &amp; conservation des données</h2>
            <p>
              Vos données personnelles ne sont <strong>jamais vendues</strong> à des tiers. Elles ne sont partagées qu’avec le vendeur ou le livreur directement concerné par votre commande, ou avec votre bailleur dans le cadre d’un contrat de bail actif.
            </p>
          </section>

          <section
            id="delete-account"
            className="bg-rose-500/10 border border-rose-500/25 rounded-xl p-5 space-y-2 text-sm text-gray-200"
          >
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Trash2 size={16} className="text-rose-400" />
              <span>4. Suppression de votre compte et de vos données</span>
            </h2>
            <p className="text-xs sm:text-sm text-gray-300 leading-relaxed">
              Vous pouvez demander la suppression définitive de votre compte et de vos données personnelles à tout moment :
            </p>
            <ul className="list-disc pl-5 space-y-1 text-xs sm:text-sm text-gray-300">
              <li>
                <strong>Directement dans l’application / site web</strong> : connectez-vous dans{" "}
                <Link href="/dashboard" className="text-[#C7D300] underline font-semibold">
                  Mon Compte / Paramètres
                </Link>{" "}
                et utilisez l’option de suppression de compte.
              </li>
              <li>
                <strong>Par email</strong> : écrivez à{" "}
                <a href="mailto:support@rayons.net" className="text-[#C7D300] underline font-semibold">
                  support@rayons.net
                </a>{" "}
                depuis l’adresse email associée à votre compte. La suppression effective est traitée sous 30 jours maximum (les écritures comptables légales anonymisées étant conservées conformément à la loi).
              </li>
            </ul>
          </section>

          <div className="pt-3 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-gray-400">
            <div className="flex items-center gap-2">
              <Mail size={14} className="text-[#C7D300]" />
              <span>Contact DPO &amp; Support : support@rayons.net</span>
            </div>
            <Link href="/legal" className="text-sky-400 hover:text-sky-300 underline">
              Voir les Mentions Légales &amp; CGU
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
