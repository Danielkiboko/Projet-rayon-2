# Plan d'Implémentation : Refonte Espace Client (Style Alibaba) & Optimisation Responsive Espace Fournisseur

## 1. Contexte & Objectifs

L'objectif de cette intervention est double :
1. **Moderniser intégralement l'Espace Client** (`/dashboard/client`) en s'inspirant des standards d'excellence d'**Alibaba (Buyer Center / My Alibaba)** :
   - Pipeline de commandes avec filtres par statut (Toutes, En attente de paiement/devis, En préparation, En cours de livraison, Livrées, Annulées/Litiges).
   - Cartes de commande enrichies avec stepper visuel de suivi, vignettes produits, actions rapides (suivi GPS livreur, facture PDF, re-commander, chat direct vendeur).
   - Gestionnaire de devis et factures proforma (RFQ / Devis en attente).
   - Profil acheteur VIP avec badge "Acheteur Vérifié" / Garantie Rayons Assurance (équivalent Trade Assurance d'Alibaba).
   - Prise en charge fluide des services spécifiques : Réservations d'hôtels, visites immobilières, centre de tickets & assistance.
2. **Optimiser le Responsive Mobile & Tablette de l'Espace Fournisseur** (`/supplier/*` et `DashboardLayout`) :
   - Ajout d'une **Bottom Navigation Bar mobile** tactile pour accéder immédiatement aux fonctions clés (Dashboard, Biens/Produits, Ventes, Messages avec badge, Menu complet).
   - Remplacement du scroll horizontal des tableaux (`orders`, `finance`, `properties`, `products`) par des **vues cartes responsive** sur smartphone (<640px).
   - Optimisation des fenêtres modales (proformas, broadcast, profil) pour éviter les débordements sur écran tactile.
   - Header compact et fluide sur mobile avec switcher de rayon horizontal adapté au glissement du doigt.

---

## 2. Architecture & Composants Cibles

### A. Espace Client (Style Alibaba)

| Composant / Fichier | Rôle & Améliorations |
| :--- | :--- |
| `src/app/(client)/dashboard/client/page.tsx` | Page principale refondue avec profil VIP, statistiques acheteur, onglets Alibaba, gestion des commandes, proformas, séjours, visites et tickets. |
| `src/modules/client/components/ClientOrderCardAlibaba.tsx` | Composant carte de commande style Alibaba : en-tête fournisseur, stepper de livraison, vignettes, boutons d'action (facture PDF, tracking, chat, re-commander). |
| `src/modules/client/components/ClientProformaSection.tsx` | Gestionnaire de factures proforma et devis reçus : acceptation en 1 clic, paiement proforma ou discussion. |
| `src/modules/client/components/ClientBuyerProtectionBanner.tsx` | Bannière de réassurance "Garantie Rayons Trade Assurance" (paiements protégés, livraison garantie, support 7j/7). |
| `src/modules/client/components/ClientQuickStats.tsx` | Cartes métriques acheteur : Commandes en cours, Devis en attente, Réservations actives, Économies / Points. |

### B. Espace Fournisseur (Optimisation Responsive)

| Composant / Fichier | Améliorations Responsive |
| :--- | :--- |
| `src/modules/shared/components/layouts/DashboardLayout.tsx` | Ajout de la **Mobile Bottom Navigation Bar** fixée en bas sur mobile, adaptation de la topbar (titre, cloche, profil), marges `p-3 sm:p-6`. |
| `src/app/(supplier)/supplier/orders/page.tsx` | Vue double : table sur desktop (`hidden sm:block`) et **cartes tactiles compactes** sur mobile (`sm:hidden`). |
| `src/app/(supplier)/supplier/finance/page.tsx` | Cartes de transactions bancaires et de caisse sur mobile au lieu du tableau large défilant. |
| `src/app/(supplier)/supplier/products/page.tsx` & `properties/page.tsx` | Grilles dynamiques `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4` avec filtres repliables sur mobile. |
| `src/modules/supplier/components/dashboards/ImmoDashboard.tsx` etc. | Cartes d'indicateurs KPI et graphiques avec hauteur dynamique et gestion propre des petits écrans (360px - 430px). |

---

## 3. Détail des Fonctionnalités à Implémenter

### Phase 1 : Espace Client "Alibaba Experience"

1. **En-tête de Profil Acheteur VIP** :
   - Avatar client avec badge de fidélité / Acheteur Rayons.
   - Coordonnées (téléphone, ville, email).
   - 4 cartes d'accès rapide avec compteurs dynamiques en temps réel :
     - 📦 **Commandes en cours**
     - 📄 **Devis / Proformas en attente**
     - 🏨 **Réservations Hôtels & Immo**
     - 🛡️ **Rayons Assurance Protection**

2. **Pipeline de Commandes Segmenté (Filtres Alibaba)** :
   - `Toutes` (avec compteur)
   - `En attente de paiement` (proformas non soldées)
   - `En préparation` (acceptées par le commerçant / restaurant)
   - `En cours de livraison` (avec nom et téléphone du livreur)
   - `Livrées` (avec confirmation et téléchargement facture)
   - `Annulées`

3. **Cartes de Commande Haut de Gamme** :
   - Badge boutique avec lien vers le fournisseur et bouton "Discuter".
   - Stepper visuel 4 étapes : *Validée ➔ En préparation ➔ Prise en charge coursier ➔ Livrée*.
   - Aperçu des articles avec images, quantités et sous-totaux.
   - Boutons d'action tactiles : Facture PDF instantanée, Suivi en direct, Re-commander.

4. **Devis / RFQ & Factures Proforma** :
   - Liste des proformas envoyées par les fournisseurs (Immo, Mode, Connect, Hôtels).
   - Visualisation du détail (quantité, prix unitaire, frais de livraison, validité).
   - Bouton d'action directe : "Payer le devis" (redirection sécurisée vers `/checkout/pay/[orderId]`).

---

### Phase 2 : Responsive Mobile & Tablette Espace Fournisseur

1. **Mobile Bottom Navigation Bar** :
   - Barre d'onglets ergonomique en bas d'écran (`fixed bottom-0 left-0 right-0 z-40 lg:hidden bg-[#0F1D27]/95 backdrop-blur-md border-t border-white/10`).
   - 5 onglets à accès rapide avec icônes et badges :
     - 🏠 **Accueil** (`/supplier`)
     - 📦 **Catalogue** (Biens / Produits)
     - 🛍️ **Ventes** (`/supplier/orders`)
     - 💬 **Messages** (avec bulle rouge si non lu)
     - ☰ **Menu Plus** (ouvre le tiroir complet pour Finances, Rapports, Équipe, Paramètres)
   - Padding inférieur automatique sur le contenu principal (`pb-20 lg:pb-8`) pour ne rien masquer.

2. **Cartes de Commandes Mobile (`/supplier/orders`)** :
   - Fiches individuelles compactes sur mobile affichant :
     - N° Commande, Date, Badge de statut
     - Nom / Téléphone du client
     - Liste condensée des articles
     - Total en gros et bouton direct "Facture PDF" et changement de statut rapide.

3. **Fluidité des Tableaux de Bord Fournisseurs** :
   - Ajustement des cartes KPI pour éviter les coupures de texte sur petits écrans (iPhone SE / Galaxy S).
   - Boutons d'action rapides (Ajouter un bien, diffuser un communiqué, filtrer) faciles à toucher au doigt (min 44px de hauteur).

---

## 4. Plan de Vérification & Tests

### Vérification Technique
- **TypeScript** : `npx tsc --noEmit` avec 0 erreur.
- **Next.js Production Build** : `npm run build` pour vérifier la compilation de toutes les 73 routes.

### Vérification Fonctionnelle
1. **Espace Client** :
   - Connexion avec un compte client ou navigation sur `/dashboard/client`.
   - Test des filtres de commandes, affichage des proformas, téléchargement de facture PDF, redirection vers le suivi en direct.
2. **Espace Fournisseur sur Mobile** :
   - Test avec émulateur mobile (375px, 390px, 430px) et tablette (768px).
   - Vérification de la Bottom Bar, des cartes de commande, du tiroir de menu, et des modales.
