"use client";

export interface LeaseData {
  leaseNumber?: string;
  leaseType?: "Habitation" | "Commercial" | "Mixte";
  createdAt?: Date | string;
  
  // Agence / Bailleur
  agencyName: string;
  agencyPhone?: string;
  agencyEmail?: string;
  agencyAddress?: string;
  agencyRccm?: string;
  agencyIdNat?: string;
  agencyNif?: string;
  ownerName?: string;

  // Preneur / Locataire
  tenantName: string;
  tenantPhone: string;
  tenantEmail?: string;
  tenantIdCard?: string;
  tenantProfession?: string;

  // Bien loué
  propertyName: string;
  unitName?: string;
  propertyAddress: string;
  city?: string;
  propertyDescription?: string;

  // Conditions financières
  monthlyRent: number;
  currency?: string;
  depositAmount: number;
  depositMonths?: number;
  paymentPeriodicity?: string; // "Mensuel", "Trimestriel"
  paymentDueDay?: number; // ex: 5 de chaque mois

  // Durée
  startDate: string;
  endDate?: string;
  durationMonths?: number;
  noticePeriodMonths?: number; // délai de préavis, ex: 3 mois
}

export async function generateFormalLeasePDF(data: LeaseData) {
  const { default: jsPDF } = await import("jspdf");
  await import("jspdf-autotable");

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4"
  });

  const currency = data.currency || "USD";
  const primaryColor = [15, 29, 39]; // Bleu foncé #0F1D27
  const accentColor = [76, 110, 245]; // Bleu Immo #4C6EF5

  const dateObj = data.createdAt ? new Date(data.createdAt) : new Date();
  const year = dateObj.getFullYear();
  const leaseRef = data.leaseNumber || `BAIL-${year}-${Math.floor(10000 + Math.random() * 90000)}`;

  // --- PAGE 1 : EN-TÊTE & ARTICLES 1 À 5 ---
  // Header background
  doc.setFillColor(15, 29, 39);
  doc.rect(0, 0, 210, 36, "F");
  doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
  doc.rect(0, 36, 210, 2.5, "F");

  // Logo Rayons
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("RAYONS", 14, 16);
  doc.setTextColor(199, 211, 0);
  doc.text(".NET", 48, 16);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(200, 210, 240);
  doc.text("RAYONS IMMO • CONTRAT OFFICIEL DE GESTION LOCATIVE", 14, 24);
  doc.text(`Réf. : ${leaseRef} | Date : ${dateObj.toLocaleDateString("fr-FR")}`, 14, 30);

  // Agency info top right
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text(data.agencyName || "AGENCE IMMOBILIÈRE PARTENAIRE", 196, 14, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(210, 210, 210);
  if (data.agencyPhone) doc.text(`Tél : ${data.agencyPhone}`, 196, 20, { align: "right" });
  if (data.agencyAddress) doc.text(data.agencyAddress, 196, 25, { align: "right" });
  if (data.agencyRccm) doc.text(`RCCM : ${data.agencyRccm} | NIF : ${data.agencyNif || "N/A"}`, 196, 30, { align: "right" });

  // Title Banner
  doc.setFillColor(243, 246, 254);
  doc.roundedRect(14, 43, 182, 14, 2, 2, "F");
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text(`CONTRAT DE BAIL À USAGE D'${(data.leaseType || "HABITATION").toUpperCase()}`, 105, 52, { align: "center" });

  let y = 64;

  // Section : Les Parties
  doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
  doc.rect(14, y, 3, 7, "F");
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text("ENTRE LES SOUSSIGNÉS :", 20, y + 5);
  y += 11;

  // Bailleur / Mandataire
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.text("1. LE BAILLEUR (ou son mandataire légal) :", 16, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.text(`Nom de l'Agence / Gestionnaire : ${data.agencyName}`, 20, y);
  y += 4.5;
  if (data.ownerName) {
    doc.text(`Agissant pour le compte du Propriétaire : ${data.ownerName}`, 20, y);
    y += 4.5;
  }
  doc.text(`Adresse : ${data.agencyAddress || "Kinshasa, RDC"} | Contact : ${data.agencyPhone || "N/A"}`, 20, y);
  y += 4.5;
  doc.text("Ci-après dénommé « LE BAILLEUR », d'une part,", 20, y);
  y += 8;

  // Preneur / Locataire
  doc.setFont("helvetica", "bold");
  doc.text("2. LE PRENEUR (Le Locataire) :", 16, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.text(`Nom complet : ${data.tenantName}`, 20, y);
  y += 4.5;
  doc.text(`Téléphone : ${data.tenantPhone} | Email : ${data.tenantEmail || "Non renseigné"}`, 20, y);
  y += 4.5;
  if (data.tenantIdCard) {
    doc.text(`Pièce d'identité / Passeport N° : ${data.tenantIdCard}`, 20, y);
    y += 4.5;
  }
  doc.text("Ci-après dénommé « LE PRENEUR », d'autre part.", 20, y);
  y += 9;

  // Intro text
  doc.setFontSize(8);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(80, 80, 80);
  doc.text("IL A ÉTÉ CONVENU ET ARRÊTÉ CE QUI SUIT :", 14, y);
  y += 7;

  const articles = [
    {
      title: "ARTICLE 1 : OBJET & DÉSIGNATION DES LIEUX",
      content: `Le Bailleur donne à bail au Preneur, qui accepte, les locaux désignés ci-après : \nBien : ${data.propertyName}${data.unitName ? ` (Porte/Unité : ${data.unitName})` : ""}.\nAdresse des lieux : ${data.propertyAddress || "Kinshasa, RDC"}.\nDestination : Les lieux loués sont exclusivement destinés à l'usage d'${data.leaseType || "Habitation"}. Toute sous-location totale ou partielle est formellement interdite sans accord écrit préalable.`
    },
    {
      title: "ARTICLE 2 : DURÉE DU CONTRAT & RENOUVELLEMENT",
      content: `Le présent bail est consenti et accepté pour une durée de ${data.durationMonths || 12} mois consécutifs, prenant effet à compter du ${data.startDate}${data.endDate ? ` pour se terminer le ${data.endDate}` : ""}.\nIl est renouvelable par tacite reconduction sauf préavis écrit notifié par l'une des parties au moins ${data.noticePeriodMonths || 3} mois à l'avance.`
    },
    {
      title: "ARTICLE 3 : LOYER ET MODALITÉS DE RÈGLEMENT",
      content: `Le montant du loyer est fixé à la somme de ${data.monthlyRent.toLocaleString()} ${currency} par mois (périodicité : ${data.paymentPeriodicity || "Mensuel"}).\nLe loyer est payable d'avance au plus tard le ${data.paymentDueDay || 5} de chaque mois contre délivrance d'une quittance de loyer officielle émise par l'Agence.`
    },
    {
      title: "ARTICLE 4 : GARANTIE LOCATIVE (CAUTION)",
      content: `À titre de garantie pour l'exécution des obligations du présent contrat, le Preneur verse ce jour la somme de ${data.depositAmount.toLocaleString()} ${currency} équivalant à ${data.depositMonths || Math.round((data.depositAmount / (data.monthlyRent || 1)) * 10) / 10} mois de loyer.\nCette caution ne pourra en aucun cas s'imputer sur les derniers mois de loyer. Elle sera restituée au Preneur en fin de bail, dans un délai maximum de 30 jours après remise des clés, déduction faite des éventuelles dettes de loyer ou réparations locatives consécutives à l'état des lieux de sortie.`
    },
    {
      title: "ARTICLE 5 : ÉTAT DES LIEUX & CHARGES LOCATIVES",
      content: `Un état des lieux contradictoire d'entrée est dressé lors de la remise des clés et annexé aux présentes. Le Preneur s'engage à maintenir les lieux en bon état d'entretien locatif.\nLe Preneur supporte les abonnements et consommations personnelles (eau de la Régideso, électricité SNEL, poubelles, internet, gardiennage et entretien des parties privatives).`
    }
  ];

  articles.forEach((art) => {
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text(art.title, 14, y);
    y += 4;

    doc.setFontSize(7.8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(60, 60, 60);
    const splitText = doc.splitTextToSize(art.content, 182);
    doc.text(splitText, 14, y);
    y += (splitText.length * 3.6) + 5;
  });

  // --- PAGE 2 : ARTICLES 6 À 9, FISCALITÉ, CLAUSE RÉSOLUTOIRE & SIGNATURES ---
  doc.addPage();

  // Mini Header Page 2
  doc.setFillColor(15, 29, 39);
  doc.rect(0, 0, 210, 18, "F");
  doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
  doc.rect(0, 18, 210, 1.5, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("CONTRAT DE BAIL — CONDITIONS GÉNÉRALES & SIGNATURES", 14, 12);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(`Réf : ${leaseRef} | Page 2/2`, 196, 12, { align: "right" });

  let y2 = 30;

  const page2Articles = [
    {
      title: "ARTICLE 6 : OBLIGATIONS DU PRENEUR",
      content: `Le Preneur s'oblige expressément à : \n1. Jouir des lieux paisiblement en bon père de famille conformément à leur destination exclusive.\n2. Ne faire aucune modification, percement ou démolition sans l'accord exprès et écrit du Bailleur.\n3. Laisser visiter les lieux par le Bailleur ou son délégué en cas de réparations urgentes ou lors du préavis de sortie.\n4. Informer immédiatement le Bailleur de tout sinistre, fuite ou dégradation dans les 48 heures.`
    },
    {
      title: "ARTICLE 7 : CLAUSE RÉSOLUTOIRE DE PLEIN DROIT",
      content: `À défaut de paiement d'un seul terme de loyer à son échéance exacte, ou en cas d'inexécution de l'une des clauses du présent bail, le contrat sera résilié de plein droit 15 jours après une simple mise en demeure par lettre recommandée ou exploit restée infructueuse, sans préjudice de tous dommages et intérêts. L'expulsion pourra avoir lieu sur simple ordonnance de référé rendue par la juridiction compétente.`
    },
    {
      title: "ARTICLE 8 : FISCALITÉ ET DROITS D'ENREGISTREMENT",
      content: `Conformément à la législation fiscale en vigueur en République Démocratique du Congo, les impôts et taxes légaux (notamment l'Impôt sur les Revenus Locatifs) ainsi que les droits d'enregistrement du présent bail auprès des services communaux compétents sont répartis ou acquittés conformément à la loi.`
    },
    {
      title: "ARTICLE 9 : ATTRIBUTION DE JURIDICTION",
      content: `Pour l'exécution des présentes et de leurs suites, les parties font élection de domicile : le Bailleur à son adresse professionnelle et le Preneur dans les lieux loués. Tout litige relatif au présent bail sera soumis à la compétence exclusive des Tribunaux de Paix ou de Grande Instance du ressort de la situation de l'immeuble.`
    }
  ];

  page2Articles.forEach((art) => {
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text(art.title, 14, y2);
    y2 += 4;

    doc.setFontSize(7.8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(60, 60, 60);
    const splitText = doc.splitTextToSize(art.content, 182);
    doc.text(splitText, 14, y2);
    y2 += (splitText.length * 3.6) + 5;
  });

  y2 += 6;

  // Closing text
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(40, 40, 40);
  doc.text(`Fait à Kinshasa, le ${dateObj.toLocaleDateString("fr-FR")}, en deux exemplaires originaux rédigés de bonne foi.`, 14, y2);
  y2 += 12;

  // Signatures Box
  const boxWidth = 86;
  const boxHeight = 44;

  // Bailleur Signature Box
  doc.setDrawColor(200, 210, 230);
  doc.setFillColor(250, 252, 255);
  doc.roundedRect(14, y2, boxWidth, boxHeight, 2, 2, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text("POUR LE BAILLEUR / L'AGENCE", 18, y2 + 8);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 100, 100);
  doc.text(`Représenté par : ${data.agencyName}`, 18, y2 + 14);
  doc.text("Mention : « Lu et approuvé »", 18, y2 + 19);
  doc.text("Signature & Cachet :", 18, y2 + 25);

  // Preneur Signature Box
  doc.roundedRect(110, y2, boxWidth, boxHeight, 2, 2, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text("POUR LE PRENEUR (LOCATAIRE)", 114, y2 + 8);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 100, 100);
  doc.text(`Nom : ${data.tenantName}`, 114, y2 + 14);
  doc.text("Mention manuscrite : « Bon pour accord »", 114, y2 + 19);
  doc.text("Signature :", 114, y2 + 25);

  // Footer
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text("Document certifié généré sur Rayons.net — Plateforme Sécurisée de Gestion Immobilière", 105, 288, { align: "center" });

  doc.save(`Contrat_Bail_${data.tenantName.replace(/\s+/g, "_")}_${leaseRef}.pdf`);
}

// -------------------------------------------------------------
// FICHE D'ÉTAT DES LIEUX OFFICIELLE (INSPECTION CHECKLIST)
// -------------------------------------------------------------
export async function generateInspectionChecklistPDF(data: {
  inspectionType: "ENTRÉE" | "SORTIE";
  agencyName: string;
  tenantName: string;
  propertyName: string;
  unitName?: string;
  inspectionDate?: string;
}) {
  const { default: jsPDF } = await import("jspdf");
  const autoTableModule = await import("jspdf-autotable");
  const autoTable = (autoTableModule.default || autoTableModule) as any;

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4"
  });

  const primaryColor = [15, 29, 39];
  const accentColor = [76, 110, 245];

  // Header
  doc.setFillColor(15, 29, 39);
  doc.rect(0, 0, 210, 30, "F");
  doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
  doc.rect(0, 30, 210, 2, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("RAYONS IMMO", 14, 15);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(200, 210, 240);
  doc.text("PROCÈS-VERBAL CONTRADICTOIRE D'ÉTAT DES LIEUX", 14, 22);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(`ÉTAT DES LIEUX D'${data.inspectionType}`, 196, 18, { align: "right" });

  // Summary box
  let y = 38;
  doc.setFillColor(245, 247, 250);
  doc.roundedRect(14, y, 182, 22, 2, 2, "F");
  doc.setFontSize(8.5);
  doc.setTextColor(30, 30, 30);
  doc.setFont("helvetica", "bold");
  doc.text(`Bien : ${data.propertyName} ${data.unitName ? `(Porte : ${data.unitName})` : ""}`, 18, y + 7);
  doc.text(`Locataire : ${data.tenantName}`, 18, y + 14);
  doc.setFont("helvetica", "normal");
  doc.text(`Agence : ${data.agencyName}`, 110, y + 7);
  doc.text(`Date de l'état des lieux : ${data.inspectionDate || new Date().toLocaleDateString("fr-FR")}`, 110, y + 14);

  y += 28;

  // Checklist table
  const tableRows = [
    ["1. Clés & Accès", "Clés portail principal, porte d'entrée, chambres", "Bon état", "___ clés remises"],
    ["2. Murs & Peintures", "Salon, couloir, chambres (propreté, trous, traces)", "Bon état", "Peinture propre"],
    ["3. Portes & Fenêtres", "Poignées, serrures, vitres, persiennes", "Bon état", "Aucun bris de vitre"],
    ["4. Plomberie & Eau", "Robinetterie, lavabo, WC, évacuation, compteur Régideso", "Fonctionnel", "Index compteur : _______"],
    ["5. Électricité & SNEL", "Interrupteurs, prises, disjoncteur, compteur à prépaiement", "Fonctionnel", "Index / KWh restant : _______"],
    ["6. Cuisine & Sanitaires", "Évier, carrelage, douche, chauffe-eau", "Bon état", "Fonctionnement vérifié"],
    ["7. Climatisation / Groupe", "Télécommandes, split clim, inverseur de courant", "Fonctionnel", "Testé en marche"]
  ];

  autoTable(doc, {
    startY: y,
    head: [["Élément inspecté", "Description / Détail", "État constaté", "Observations contradictoires"]],
    body: tableRows,
    theme: "grid",
    headStyles: {
      fillColor: [15, 29, 39],
      textColor: [255, 255, 255],
      fontSize: 8.5,
      fontStyle: "bold"
    },
    styles: {
      fontSize: 8,
      cellPadding: 3.5,
      textColor: [40, 40, 40]
    },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 40 },
      1: { cellWidth: 55 },
      2: { cellWidth: 30 },
      3: { cellWidth: 57 }
    }
  });

  const finalY = (doc as any).lastAutoTable?.finalY || 160;

  // Signatures
  let sigY = finalY + 12;
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "italic");
  doc.text("Dressé contradictoirement entre les parties soussignées qui reconnaissent l'exactitude des constatations ci-dessus.", 14, sigY);
  sigY += 8;

  doc.roundedRect(14, sigY, 86, 35, 2, 2);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text("LE GESTIONNAIRE / BAILLEUR", 18, sigY + 7);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text("Signature :", 18, sigY + 20);

  doc.roundedRect(110, sigY, 86, 35, 2, 2);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text("LE LOCATAIRE PRENEUR", 114, sigY + 7);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text("Signature :", 114, sigY + 20);

  doc.save(`Etat_des_lieux_${data.inspectionType}_${data.tenantName.replace(/\s+/g, "_")}.pdf`);
}

// -------------------------------------------------------------
// QUITTANCE / REÇU DE LOYER OFFICIEL
// -------------------------------------------------------------
export interface RentReceiptData {
  receiptRef?: string;

  // Agence / Bailleur
  agencyName: string;
  agencyPhone?: string;
  agencyEmail?: string;
  agencyAddress?: string;
  agencyRccm?: string;
  agencyNif?: string;

  // Locataire
  tenantName: string;
  tenantPhone?: string;
  tenantEmail?: string;

  // Bien
  propertyName: string;
  unitName?: string;
  propertyAddress?: string;

  // Paiement
  amount: number;
  currency?: string;
  periodicity?: string;
  paymentReference?: string;
  paymentMethod?: string;
  periodLabel?: string; // ex: "Octobre 2024"
  paymentDate?: string; // ex: "24/09/2024"

  // Bail
  monthlyRent?: number;
  leaseStartDate?: string;
}

export async function generateRentReceiptPDF(data: RentReceiptData) {
  const { default: jsPDF } = await import("jspdf");
  const autoTableModule = await import("jspdf-autotable");
  const autoTable = (autoTableModule.default || autoTableModule) as any;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const currency = data.currency || "USD";
  const primaryColor = [15, 29, 39];
  const accentColor  = [76, 110, 245];
  const greenColor   = [34, 197, 94];

  const now = new Date();
  const year = now.getFullYear();
  const receiptRef = data.receiptRef || `QIT-${year}-${Math.floor(10000 + Math.random() * 90000)}`;
  const dateStr = data.paymentDate || now.toLocaleDateString("fr-FR");
  const period  = data.periodLabel  || now.toLocaleString("fr-FR", { month: "long", year: "numeric" });

  // ── HEADER ──────────────────────────────────────────────────
  doc.setFillColor(...(primaryColor as [number,number,number]));
  doc.rect(0, 0, 210, 34, "F");
  doc.setFillColor(...(accentColor as [number,number,number]));
  doc.rect(0, 34, 210, 2, "F");

  // Logo
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("RAYONS", 14, 16);
  doc.setTextColor(199, 211, 0);
  doc.text(".NET", 48, 16);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(200, 210, 240);
  doc.text("RAYONS IMMO • QUITTANCE DE LOYER OFFICIELLE", 14, 23);
  doc.text(`Réf. : ${receiptRef} | Émise le : ${dateStr}`, 14, 29);

  // Agence (droite)
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text(data.agencyName, 196, 12, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(210, 210, 210);
  if (data.agencyPhone)   doc.text(`Tél : ${data.agencyPhone}`, 196, 18, { align: "right" });
  if (data.agencyAddress) doc.text(data.agencyAddress, 196, 23, { align: "right" });
  if (data.agencyRccm)    doc.text(`RCCM : ${data.agencyRccm}`, 196, 28, { align: "right" });

  // ── BADGE REÇU ──────────────────────────────────────────────
  doc.setFillColor(...(greenColor as [number,number,number]));
  doc.roundedRect(14, 42, 182, 16, 3, 3, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text(`✔ QUITTANCE DE LOYER — ${period.toUpperCase()}`, 105, 52, { align: "center" });

  // ── PARTIES ─────────────────────────────────────────────────
  let y = 66;

  // Bailleur
  doc.setFillColor(245, 247, 252);
  doc.roundedRect(14, y, 87, 26, 2, 2, "F");
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...(primaryColor as [number,number,number]));
  doc.text("BAILLEUR / AGENCE", 18, y + 7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(50, 50, 50);
  doc.text(data.agencyName, 18, y + 13);
  if (data.agencyPhone) doc.text(`Tél : ${data.agencyPhone}`, 18, y + 18.5);
  if (data.agencyEmail) doc.text(`Email : ${data.agencyEmail}`, 18, y + 23.5);

  // Locataire
  doc.setFillColor(245, 247, 252);
  doc.roundedRect(109, y, 87, 26, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...(primaryColor as [number,number,number]));
  doc.text("LOCATAIRE (PRENEUR)", 113, y + 7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(50, 50, 50);
  doc.text(data.tenantName, 113, y + 13);
  if (data.tenantPhone) doc.text(`Tél : ${data.tenantPhone}`, 113, y + 18.5);
  if (data.tenantEmail) doc.text(`Email : ${data.tenantEmail}`, 113, y + 23.5);

  y += 34;

  // ── BIEN LOUÉ ────────────────────────────────────────────────
  doc.setFillColor(230, 240, 255);
  doc.roundedRect(14, y, 182, 14, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...(primaryColor as [number,number,number]));
  doc.text("BIEN LOUÉ :", 18, y + 6);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(30, 30, 30);
  const propLabel = `${data.propertyName}${data.unitName ? ` — Porte/Unité : ${data.unitName}` : ""}${data.propertyAddress ? ` — ${data.propertyAddress}` : ""}`;
  doc.text(propLabel, 50, y + 6);
  y += 22;

  // ── TABLEAU DE DÉTAIL DU PAIEMENT ────────────────────────────
  autoTable(doc, {
    startY: y,
    head: [["Désignation", "Détail / Référence", "Montant"]],
    body: [
      [
        `Loyer ${data.periodicity || "Mensuel"} — ${period}`,
        `Réf. paiement : ${data.paymentReference || receiptRef}\nMode : ${data.paymentMethod || "Caisse / Mobile Money"}\nPériode couverte : ${period}`,
        `${Number(data.amount).toLocaleString("fr-FR")} ${currency}`
      ],
      ...(data.monthlyRent && data.amount !== data.monthlyRent ? [[
        "Rappel : Loyer mensuel de référence",
        `Fixé par bail du ${data.leaseStartDate || "—"}`,
        `${Number(data.monthlyRent).toLocaleString("fr-FR")} ${currency}`
      ]] : []),
      ["TOTAL ENCAISSÉ", `Paiement reçu le ${dateStr}`, `${Number(data.amount).toLocaleString("fr-FR")} ${currency}`]
    ],
    theme: "grid",
    headStyles: {
      fillColor: primaryColor as [number,number,number],
      textColor: [255, 255, 255],
      fontSize: 8.5,
      fontStyle: "bold",
      halign: "center"
    },
    styles: { fontSize: 8, cellPadding: 4, textColor: [30, 30, 30] },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 65 },
      1: { cellWidth: 90 },
      2: { fontStyle: "bold", halign: "right", cellWidth: 27 }
    },
    willDrawCell: (hookData: any) => {
      // Mettre la ligne TOTAL en vert
      if (hookData.row.index === hookData.table.body.length - 1) {
        doc.setFillColor(220, 252, 231);
      }
    }
  });

  const finalY = (doc as any).lastAutoTable?.finalY || 180;

  // ── MENTION LÉGALE ───────────────────────────────────────────
  let mY = finalY + 10;
  doc.setFontSize(8);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(80, 80, 80);
  const mention = `La présente quittance atteste que ${data.agencyName} déclare avoir reçu de ${data.tenantName} la somme de ${Number(data.amount).toLocaleString("fr-FR")} ${currency} au titre du loyer de la période ${period} pour le bien désigné ci-dessus, et que ce paiement est complet pour la période considérée.`;
  const mentionLines = doc.splitTextToSize(mention, 182);
  doc.text(mentionLines, 14, mY);
  mY += mentionLines.length * 4 + 8;

  // ── SIGNATURES ───────────────────────────────────────────────
  const bW = 86;
  const bH = 36;

  // Bailleur
  doc.setDrawColor(200, 210, 230);
  doc.setFillColor(250, 252, 255);
  doc.roundedRect(14, mY, bW, bH, 2, 2, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...(primaryColor as [number,number,number]));
  doc.text("LE BAILLEUR / L'AGENCE", 18, mY + 8);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 100, 100);
  doc.text(data.agencyName, 18, mY + 14);
  doc.text("Signature & Cachet :", 18, mY + 22);

  // Locataire
  doc.roundedRect(110, mY, bW, bH, 2, 2, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...(primaryColor as [number,number,number]));
  doc.text("LE LOCATAIRE", 114, mY + 8);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 100, 100);
  doc.text(data.tenantName, 114, mY + 14);
  doc.text("Bon reçu :", 114, mY + 22);

  // ── FOOTER ───────────────────────────────────────────────────
  doc.setFontSize(7);
  doc.setTextColor(160, 160, 160);
  doc.text("Document officiel généré sur Rayons.net — Gestion Locative Certifiée", 105, 288, { align: "center" });

  doc.save(`Quittance_Loyer_${data.tenantName.replace(/\s+/g, "_")}_${period.replace(/\s+/g, "_")}_${receiptRef}.pdf`);
}
