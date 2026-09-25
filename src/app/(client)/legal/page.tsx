"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Shield, FileText, Eye, ChevronDown, ChevronUp } from "lucide-react";

const TABS = [
  { id: "cgu", label: "CGU", icon: FileText },
  { id: "privacy", label: "Confidentialité", icon: Eye },
  { id: "legal", label: "Mentions légales", icon: Shield },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border border-gray-100 rounded-2xl overflow-hidden mb-4">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-6 py-4 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        <h3 className="font-bold text-gray-900 text-base">{title}</h3>
        {open ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
      </button>
      {open && (
        <div className="px-6 py-5 text-sm text-gray-600 leading-relaxed space-y-3">
          {children}
        </div>
      )}
    </div>
  );
}

export default function LegalPage() {
  const [activeTab, setActiveTab] = useState("cgu");

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      {/* Header */}
      <div className="bg-[#0F1D27] text-white">
        <div className="max-w-3xl mx-auto px-4 py-6 flex items-center gap-4">
          <Link href="/" className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-xl font-bold">Informations légales</h1>
            <p className="text-gray-300 text-sm">Rayons.net — Mise à jour : Septembre 2026</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-3xl mx-auto px-4 flex gap-1 pb-4">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                activeTab === tab.id
                  ? "bg-[#C7D300] text-[#0F1D27]"
                  : "text-gray-300 hover:bg-white/10"
              }`}
            >
              <tab.icon size={14} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8">

        {/* ────────── CGU ────────── */}
        {activeTab === "cgu" && (
          <div>
            <div className="bg-[#C7D300]/10 border border-[#C7D300]/30 rounded-2xl p-5 mb-6">
              <p className="text-sm text-gray-700">
                Les présentes Conditions Générales d'Utilisation régissent l'accès et l'utilisation de la plateforme <strong>Rayons.net</strong>.
                En utilisant nos services, vous acceptez ces conditions dans leur intégralité.
              </p>
            </div>

            <Section title="1. Présentation de la plateforme">
              <p>
                Rayons.net est une marketplace multi-rayons exploitée par <strong>Rayons SAS</strong>, société dont le siège
                social est situé à Kinshasa, République Démocratique du Congo. La plateforme propose quatre univers :
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Rayons Connect</strong> — équipements et services technologiques</li>
                <li><strong>Rayons Immo</strong> — immobilier résidentiel et hôtellerie</li>
                <li><strong>Rayons Mode</strong> — habillement et accessoires</li>
                <li><strong>Rayons Saveurs</strong> — restauration et art culinaire</li>
              </ul>
            </Section>

            <Section title="2. Accès au service">
              <p>L'accès aux services de Rayons.net est réservé aux personnes physiques ou morales capables de contracter. En vous inscrivant, vous déclarez :</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Être âgé(e) d'au moins 18 ans ou avoir l'autorisation d'un représentant légal</li>
                <li>Fournir des informations exactes et complètes lors de votre inscription</li>
                <li>Être responsable de la confidentialité de vos identifiants de connexion</li>
              </ul>
            </Section>

            <Section title="3. Rôles et responsabilités">
              <p><strong>Clients :</strong> Les clients peuvent consulter les offres, passer des commandes et payer via les méthodes proposées. Toute commande passée constitue un engagement de paiement.</p>
              <p><strong>Fournisseurs :</strong> Les fournisseurs inscrits s'engagent à fournir des produits et services conformes à leurs descriptions, à respecter les délais de livraison et les réglementations locales en vigueur.</p>
              <p><strong>Livreurs :</strong> Les livreurs partenaires agissent comme prestataires indépendants. Rayons.net n'est pas responsable des retards dus à des circonstances extérieures (trafic, météo, force majeure).</p>
            </Section>

            <Section title="4. Commandes et paiements">
              <p>Les prix affichés sont en <strong>dollars américains (USD)</strong> ou dans la devise sélectionnée par l'utilisateur. Rayons.net se réserve le droit de modifier les prix à tout moment. Les commandes confirmées sont engageantes.</p>
              <p>Les paiements sont sécurisés via les passerelles partenaires. Un acompte est requis à la commande ; le solde est réglé à la livraison.</p>
            </Section>

            <Section title="5. Annulation et remboursements">
              <p>Toute annulation doit être effectuée avant la prise en charge par un livreur. Passé ce délai, les frais d'approche ne sont pas remboursables. Les litiges sont traités dans un délai de 7 jours ouvrés via le support Rayons.net.</p>
              <p>Contact : <a href="mailto:support@rayons.net" className="text-[#0F1D27] underline font-semibold">support@rayons.net</a></p>
            </Section>

            <Section title="6. Propriété intellectuelle">
              <p>L'ensemble du contenu présent sur Rayons.net (logo, design, textes, code) est protégé par le droit d'auteur. Toute reproduction, même partielle, sans autorisation écrite préalable est strictement interdite.</p>
            </Section>

            <Section title="7. Modification des CGU">
              <p>Rayons.net se réserve le droit de modifier les présentes CGU à tout moment. Les utilisateurs seront notifiés par e-mail des changements substantiels. La poursuite de l'utilisation du service après notification vaut acceptation des nouvelles conditions.</p>
            </Section>

            <Section title="8. Droit applicable et juridiction">
              <p>Les présentes CGU sont soumises au droit congolais. En cas de litige, les parties s'efforceront de trouver une solution amiable. À défaut, les tribunaux compétents de Kinshasa seront seuls habilités à connaître du différend.</p>
            </Section>
          </div>
        )}

        {/* ────────── CONFIDENTIALITÉ ────────── */}
        {activeTab === "privacy" && (
          <div>
            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 mb-6">
              <p className="text-sm text-gray-700">
                Rayons.net s'engage à protéger vos données personnelles. Cette politique décrit comment nous collectons,
                utilisons et protégeons vos informations.
              </p>
            </div>

            <Section title="1. Données collectées">
              <p>Nous collectons les données que vous nous fournissez directement :</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Nom, prénom, adresse e-mail, numéro de téléphone</li>
                <li>Adresse de livraison</li>
                <li>Données de transaction (montants, références de commandes)</li>
                <li>Photos de profil (si téléchargées)</li>
              </ul>
              <p>Nous collectons également automatiquement : adresse IP, type de navigateur, pages visitées, durée de navigation.</p>
            </Section>

            <Section title="2. Finalités du traitement">
              <p>Vos données sont utilisées pour :</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Gérer votre compte et authentifier votre identité</li>
                <li>Traiter et suivre vos commandes</li>
                <li>Vous envoyer des notifications (SMS, e-mail) relatives à vos commandes</li>
                <li>Prévenir la fraude et sécuriser la plateforme</li>
                <li>Améliorer nos services grâce à des analyses anonymisées</li>
                <li>Vous contacter en cas de litige ou de demande de support</li>
              </ul>
            </Section>

            <Section title="3. Partage des données">
              <p>Rayons.net ne vend jamais vos données personnelles. Nous partageons uniquement les informations nécessaires avec :</p>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Les fournisseurs</strong> : pour préparer votre commande (nom, adresse de livraison)</li>
                <li><strong>Les livreurs</strong> : votre adresse et numéro de téléphone pour la livraison</li>
                <li><strong>Prestataires SMS/Email</strong> : MobiShastra, Hostinger (envoi de notifications)</li>
                <li><strong>Firebase (Google)</strong> : hébergement sécurisé de la base de données</li>
              </ul>
            </Section>

            <Section title="4. Durée de conservation">
              <p>Vos données sont conservées :</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Données de compte : pendant toute la durée d'activité de votre compte + 1 an</li>
                <li>Données de commande : 5 ans (obligations comptables et légales)</li>
                <li>Logs de navigation : 3 mois</li>
              </ul>
            </Section>

            <Section title="5. Vos droits">
              <p>Conformément aux lois applicables, vous disposez des droits suivants :</p>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Accès</strong> : obtenir une copie de vos données</li>
                <li><strong>Rectification</strong> : corriger des données inexactes</li>
                <li><strong>Suppression</strong> : demander l'effacement de vos données</li>
                <li><strong>Opposition</strong> : vous opposer à certains traitements</li>
                <li><strong>Portabilité</strong> : recevoir vos données dans un format lisible</li>
              </ul>
              <p>Pour exercer ces droits : <a href="mailto:privacy@rayons.net" className="text-[#0F1D27] underline font-semibold">privacy@rayons.net</a></p>
            </Section>

            <Section title="6. Cookies">
              <p>Rayons.net utilise uniquement des cookies fonctionnels nécessaires au bon fonctionnement du service (authentification, préférences de langue). Aucun cookie publicitaire tiers n'est utilisé.</p>
            </Section>

            <Section title="7. Sécurité des données">
              <p>Nous mettons en œuvre des mesures techniques appropriées : chiffrement des données en transit (HTTPS/TLS), authentification Firebase sécurisée, sessions avec déconnexion automatique selon votre rôle, accès restreint aux données selon les permissions.</p>
            </Section>
          </div>
        )}

        {/* ────────── MENTIONS LÉGALES ────────── */}
        {activeTab === "legal" && (
          <div>
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5 mb-6">
              <p className="text-sm text-gray-700">
                Conformément aux dispositions légales en vigueur, voici les mentions légales de la plateforme Rayons.net.
              </p>
            </div>

            <Section title="Éditeur de la plateforme">
              <div className="space-y-2">
                <p><strong>Raison sociale :</strong> Rayons SAS</p>
                <p><strong>Activité :</strong> Marketplace multi-secteurs (commerce, immobilier, technologie, restauration)</p>
                <p><strong>Siège social :</strong> Kinshasa, République Démocratique du Congo</p>
                <p><strong>E-mail :</strong> <a href="mailto:admin@rayons.net" className="text-[#0F1D27] underline font-semibold">admin@rayons.net</a></p>
                <p><strong>Téléphone :</strong> +243 85 91 800 31</p>
              </div>
            </Section>

            <Section title="Directeur de la publication">
              <p>Le directeur de la publication est le représentant légal de Rayons SAS.</p>
            </Section>

            <Section title="Hébergement">
              <div className="space-y-2">
                <p><strong>Hébergeur web :</strong> Vercel Inc., 340 Pine Street Suite 900, San Francisco, CA 94104, USA</p>
                <p><strong>Base de données :</strong> Google Firebase (Google LLC), 1600 Amphitheatre Parkway, Mountain View, CA 94043, USA</p>
                <p><strong>Messagerie :</strong> Hostinger International Ltd, 61 Lordou Vironos str., Limassol 4796, Chypre</p>
              </div>
            </Section>

            <Section title="Propriété intellectuelle">
              <p>L'ensemble des éléments composant le site Rayons.net (graphismes, textes, logos, icônes, images, sons, logiciels) est la propriété exclusive de Rayons SAS et est protégé par les lois relatives à la propriété intellectuelle.</p>
              <p>Toute reproduction, représentation, modification, publication, adaptation de tout ou partie des éléments du site, quel que soit le moyen ou le procédé utilisé, est interdite sans l'autorisation écrite préalable de Rayons SAS.</p>
            </Section>

            <Section title="Limitation de responsabilité">
              <p>Rayons.net ne saurait être tenu responsable :</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Des interruptions de service dues à des maintenances ou incidents techniques</li>
                <li>Des informations publiées par les fournisseurs tiers</li>
                <li>Des retards de livraison liés à des événements de force majeure</li>
                <li>De l'utilisation frauduleuse des identifiants par des tiers</li>
              </ul>
            </Section>

            <Section title="Contact & Réclamations">
              <div className="space-y-2">
                <p><strong>Support client :</strong> <a href="mailto:support@rayons.net" className="text-[#0F1D27] underline font-semibold">support@rayons.net</a></p>
                <p><strong>Données personnelles :</strong> <a href="mailto:privacy@rayons.net" className="text-[#0F1D27] underline font-semibold">privacy@rayons.net</a></p>
                <p><strong>Partenariats :</strong> <a href="mailto:partners@rayons.net" className="text-[#0F1D27] underline font-semibold">partners@rayons.net</a></p>
                <p className="text-xs text-gray-400 pt-2">Délai de réponse : 2 à 5 jours ouvrés</p>
              </div>
            </Section>
          </div>
        )}

        {/* Footer note */}
        <div className="mt-8 text-center text-xs text-gray-400">
          Rayons.net — © 2026 Tous droits réservés · <Link href="/" className="underline hover:text-gray-600">Retour à l'accueil</Link>
        </div>
      </div>
    </div>
  );
}
