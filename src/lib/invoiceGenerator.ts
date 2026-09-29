"use client";

export interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total?: number;
}

export interface InvoiceData {
  invoiceNumber?: string;
  type: "INVOICE" | "PROFORMA" | "RECEIPT" | "ORDER";
  rayon?: "mode" | "connect" | "immo" | "saveurs" | "general";
  immoBranch?: "habitation" | "hotel" | "generic";
  createdAt?: Date | string | { seconds: number };
  dueDate?: Date | string;
  status?: "PAID" | "UNPAID" | "DRAFT" | "CANCELLED" | "COMPLETED" | string;
  
  // Supplier / Emitter details
  supplierName: string;
  supplierEmail?: string;
  supplierPhone?: string;
  supplierAddress?: string;
  supplierRccm?: string;
  supplierIdNat?: string;
  supplierNif?: string;
  supplierLogo?: string;
  
  // Client details
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  clientAddress?: string;

  // Items & pricing
  items: InvoiceItem[];
  subtotal: number;
  taxRate?: number;
  taxAmount?: number;
  deliveryFee?: number;
  discount?: number;
  total: number;
  currency?: string;

  // Specific context details
  paymentMethod?: string;
  notes?: string;
  stayDetails?: {
    room?: string;
    checkIn?: string;
    checkOut?: string;
    nights?: number;
  };
  habitationDetails?: {
    property?: string;
    period?: string;
  };
}

export async function generateFormalInvoicePDF(data: InvoiceData) {
  const { default: jsPDF } = await import("jspdf");
  await import("jspdf-autotable");

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4"
  });

  const currency = data.currency || "USD";
  const rayon = data.rayon || (data.immoBranch ? "immo" : "general");

  // Determine brand colors based on universe
  let primaryColor = [15, 29, 39]; // #0F1D27 (Bleu Rayons)
  let accentColor = [199, 211, 0]; // #C7D300 (Vert Rayons)
  let badgeLabel = "PLATEFORME OFFICIELLE RAYONS.NET";

  if (rayon === "connect") {
    primaryColor = [0, 181, 165]; // #00B5A5
    badgeLabel = "RAYONS CONNECT • TECH & RESEAUX";
  } else if (rayon === "immo") {
    primaryColor = [76, 110, 245]; // #4C6EF5
    badgeLabel = data.immoBranch === "hotel" 
      ? "RAYONS IMMO & HÔTELS • HOSPITALITY" 
      : "RAYONS IMMO • GESTION LOCATIVE";
  } else if (rayon === "mode") {
    primaryColor = [156, 118, 77]; // #9C764D
    badgeLabel = "RAYONS MODE • LIFESTYLE & CRÉATEURS";
  } else if (rayon === "saveurs") {
    primaryColor = [255, 107, 53]; // #FF6B35
    badgeLabel = "RAYONS SAVEURS • GASTRONOMIE & CUISINE";
  }

  // Document title
  let docTitle = "FACTURE COMMERCIALE";
  if (data.immoBranch === "hotel") {
    docTitle = data.type === "PROFORMA" ? "NOTE D'HÔTEL PROFORMA" : "NOTE D'HÔTEL & FACTURE DE SÉJOUR";
  } else if (data.immoBranch === "habitation") {
    docTitle = data.type === "PROFORMA" ? "PROFORMA DE LOCATION" : "QUITTANCE DE LOYER";
  } else if (data.type === "PROFORMA") {
    docTitle = "FACTURE PROFORMA / DEVIS";
  } else if (data.type === "RECEIPT") {
    docTitle = "REÇU OFFICIEL DE PAIEMENT";
  } else if (data.type === "ORDER") {
    docTitle = "FACTURE DE COMMANDE";
  }

  // Auto-generate formal document number if missing
  const dateObj = data.createdAt 
    ? (typeof data.createdAt === "object" && "seconds" in data.createdAt 
        ? new Date(data.createdAt.seconds * 1000) 
        : new Date(data.createdAt))
    : new Date();
  
  const year = dateObj.getFullYear();
  const dateStr = dateObj.toLocaleDateString("fr-FR");
  const docRef = data.invoiceNumber || `RAY-${data.type === "PROFORMA" ? "PRO" : "FAC"}-${year}-${Math.floor(10000 + Math.random() * 90000)}`;

  // 1. Header background banner
  doc.setFillColor(15, 29, 39); // Dark blue header
  doc.rect(0, 0, 210, 38, "F");

  // Accent band
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(0, 38, 210, 2.5, "F");

  // Logo text Rayons.net
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("RAYONS", 14, 18);

  doc.setTextColor(199, 211, 0);
  doc.text(".NET", 50, 18);

  // Subtitle badge
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(200, 200, 200);
  doc.text(badgeLabel, 14, 26);

  // Document Title & Number on top right
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text(docTitle, 196, 16, { align: "right" });

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(primaryColor[0] === 15 ? 199 : primaryColor[0], primaryColor[1] === 29 ? 211 : primaryColor[1], primaryColor[2] === 39 ? 0 : primaryColor[2]);
  doc.text(`N° ${docRef}`, 196, 23, { align: "right" });

  doc.setTextColor(180, 180, 180);
  doc.setFontSize(8.5);
  doc.text(`Date : ${dateStr}`, 196, 30, { align: "right" });

  // 2. Issuer & Client Information Blocks
  doc.setTextColor(40, 40, 40);
  
  // Left Box: Issuer (Fournisseur / Rayons)
  let issuerX = 14;
  if (data.supplierLogo) {
    try {
      const logoFmt = data.supplierLogo.includes("webp") ? "WEBP" : data.supplierLogo.includes("png") ? "PNG" : "JPEG";
      doc.addImage(data.supplierLogo, logoFmt, 14, 46, 18, 18);
      issuerX = 36;
    } catch (e) {
      console.warn("Logo PDF rendering fallback:", e);
      issuerX = 14;
    }
  }

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text("ÉMETTEUR / FOURNISSEUR", issuerX, 48);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(15, 29, 39);
  doc.text(data.supplierName || "Rayons.net Partner", issuerX, 54);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(80, 80, 80);
  let currentY = 59;
  if (data.supplierAddress) {
    doc.text(`Adresse : ${data.supplierAddress}`, issuerX, currentY);
    currentY += 4.5;
  }
  if (data.supplierPhone) {
    doc.text(`Tél : ${data.supplierPhone}`, issuerX, currentY);
    currentY += 4.5;
  }
  if (data.supplierEmail) {
    doc.text(`Email : ${data.supplierEmail}`, issuerX, currentY);
    currentY += 4.5;
  }
  if (data.supplierRccm || data.supplierNif || data.supplierIdNat) {
    const legals = [
      data.supplierRccm ? `RCCM : ${data.supplierRccm}` : null,
      data.supplierNif ? `NIF : ${data.supplierNif}` : null,
      data.supplierIdNat ? `Id.Nat : ${data.supplierIdNat}` : null
    ].filter(Boolean).join(" | ");
    doc.text(legals, issuerX, currentY);
    currentY += 4.5;
  }

  // Right Box: Client / Facturé à
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text("FACTURÉ À / CLIENT", 120, 48);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(15, 29, 39);
  doc.text(data.clientName || "Client Rayons", 120, 54);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(80, 80, 80);
  let clientY = 59;
  if (data.clientAddress) {
    doc.text(`Adresse : ${data.clientAddress}`, 120, clientY);
    clientY += 4.5;
  }
  if (data.clientPhone) {
    doc.text(`Tél : ${data.clientPhone}`, 120, clientY);
    clientY += 4.5;
  }
  if (data.clientEmail) {
    doc.text(`Email : ${data.clientEmail}`, 120, clientY);
    clientY += 4.5;
  }

  // Contextual Banner (Hôtel ou Habitation)
  let tableStartY = Math.max(currentY, clientY) + 6;

  if (data.immoBranch === "hotel" && data.stayDetails) {
    doc.setFillColor(255, 248, 235);
    doc.roundedRect(14, tableStartY, 182, 9, 1.5, 1.5, "F");
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(180, 100, 0);
    const stayInfo = `Séjour Hôtelier : Chambre ${data.stayDetails.room || "-"} | Arrivée : ${data.stayDetails.checkIn || "-"} | Départ : ${data.stayDetails.checkOut || "-"} (${data.stayDetails.nights || 1} nuitée(s))`;
    doc.text(stayInfo, 18, tableStartY + 6);
    tableStartY += 13;
  } else if (data.immoBranch === "habitation" && data.habitationDetails) {
    doc.setFillColor(238, 250, 243);
    doc.roundedRect(14, tableStartY, 182, 9, 1.5, 1.5, "F");
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(20, 110, 60);
    const rentInfo = `Location Immobilière : Bien : ${data.habitationDetails.property || "-"} | Période : ${data.habitationDetails.period || "En cours"}`;
    doc.text(rentInfo, 18, tableStartY + 6);
    tableStartY += 13;
  }

  // 3. Line Items Table with jspdf-autotable
  const tableRows = data.items.map((item) => [
    item.description,
    item.quantity.toString(),
    `${item.unitPrice.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`,
    `${(item.quantity * item.unitPrice).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`
  ]);

  (doc as any).autoTable({
    startY: tableStartY,
    head: [['Désignation des prestations / articles', 'Qté', 'Prix unitaire', 'Total']],
    body: tableRows,
    theme: 'grid',
    headStyles: {
      fillColor: [15, 29, 39],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
      halign: 'left'
    },
    styles: {
      fontSize: 8.5,
      cellPadding: 3.5,
      textColor: [30, 30, 30]
    },
    columnStyles: {
      0: { cellWidth: 105 },
      1: { cellWidth: 20, halign: 'center' },
      2: { cellWidth: 30, halign: 'right' },
      3: { cellWidth: 27, halign: 'right', fontStyle: 'bold' }
    }
  });

  const finalY = (doc as any).lastAutoTable.finalY || tableStartY + 40;

  // 4. Financial Summary & Status
  const summaryX = 120;
  let runningY = finalY + 8;

  // Status Stamp Box
  const statusNorm = (data.status || "UNPAID").toUpperCase();
  const isPaid = statusNorm === "PAID" || statusNorm === "COMPLETED" || statusNorm === "LIVRÉE" || statusNorm === "DELIVERED";
  
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  if (isPaid) {
    doc.setFillColor(236, 253, 245);
    doc.setDrawColor(16, 185, 129);
    doc.roundedRect(14, finalY + 8, 80, 20, 2, 2, "FD");
    doc.setTextColor(16, 185, 129);
    doc.text("✓ FACTURE ACQUITTÉE & RÉGLÉE", 20, finalY + 16);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Règlement confirmé via ${data.paymentMethod || "Plateforme Sécurisée"}`, 20, finalY + 22);
  } else if (data.type === "PROFORMA") {
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(148, 163, 184);
    doc.roundedRect(14, finalY + 8, 80, 20, 2, 2, "FD");
    doc.setTextColor(71, 85, 105);
    doc.text("• DEVIS / PROFORMA SANS ENGAGEMENT", 20, finalY + 16);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text("Valable 30 jours à compter de la date d'émission.", 20, finalY + 22);
  } else {
    doc.setFillColor(254, 242, 242);
    doc.setDrawColor(239, 68, 68);
    doc.roundedRect(14, finalY + 8, 80, 20, 2, 2, "FD");
    doc.setTextColor(220, 38, 38);
    doc.text("! EN ATTENTE DE RÈGLEMENT", 20, finalY + 16);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Échéance : ${data.dueDate ? new Date(data.dueDate).toLocaleDateString("fr-FR") : "À réception"}`, 20, finalY + 22);
  }

  // Summary figures
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(70, 70, 70);

  doc.text("Sous-total HT :", summaryX, runningY);
  doc.text(`${data.subtotal.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} ${currency}`, 196, runningY, { align: "right" });
  runningY += 5.5;

  if (data.taxRate && data.taxRate > 0) {
    const taxAmt = data.taxAmount ?? ((data.subtotal * data.taxRate) / 100);
    doc.text(`TVA (${data.taxRate}%) :`, summaryX, runningY);
    doc.text(`${taxAmt.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} ${currency}`, 196, runningY, { align: "right" });
    runningY += 5.5;
  }

  if (data.deliveryFee && data.deliveryFee > 0) {
    doc.text("Frais de livraison :", summaryX, runningY);
    doc.text(`${data.deliveryFee.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} ${currency}`, 196, runningY, { align: "right" });
    runningY += 5.5;
  }

  if (data.discount && data.discount > 0) {
    doc.text("Remise appliquée :", summaryX, runningY);
    doc.text(`-${data.discount.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} ${currency}`, 196, runningY, { align: "right" });
    runningY += 5.5;
  }

  // Total Net à payer
  doc.setDrawColor(220, 220, 220);
  doc.line(summaryX, runningY, 196, runningY);
  runningY += 5;

  doc.setFillColor(15, 29, 39);
  doc.roundedRect(summaryX - 2, runningY - 4, 78, 10, 1.5, 1.5, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(255, 255, 255);
  doc.text("TOTAL NET :", summaryX + 2, runningY + 2.5);

  doc.setTextColor(199, 211, 0);
  doc.text(`${data.total.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} ${currency}`, 194, runningY + 2.5, { align: "right" });

  // 5. Footer & Legal Disclaimers
  const pageHeight = doc.internal.pageSize.height;
  
  doc.setDrawColor(225, 225, 225);
  doc.line(14, pageHeight - 20, 196, pageHeight - 20);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(15, 29, 39);
  doc.text("Rayons.net • Plateforme Intégrée de Commerce, Immobilier, Hôtellerie & Gastronomie", 105, pageHeight - 15, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(120, 120, 120);
  doc.text(
    "Ce document électronique est émis conformément aux normes comptables et commerciales. Toute contestation doit être notifiée sous 8 jours.",
    105,
    pageHeight - 11,
    { align: "center" }
  );
  doc.text(
    "Rayons.net SARL • Kinshasa, RDC • contact@rayons.net • +243 85 91 800 31",
    105,
    pageHeight - 7.5,
    { align: "center" }
  );

  // Save the generated PDF
  const filename = `${docRef.replace(/[^a-zA-Z0-9-_]/g, "_")}.pdf`;
  doc.save(filename);
}

/**
 * Generate formal invoice specifically for an order
 */
export async function generateOrderInvoicePDF(order: any, supplier?: any, currency = "USD") {
  const items: InvoiceItem[] = (order.items || []).map((item: any) => ({
    description: item.productName || item.title?.fr || item.name || "Article commandé",
    quantity: item.quantity || 1,
    unitPrice: item.price || 0,
    total: (item.quantity || 1) * (item.price || 0)
  }));

  const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  const total = order.totalAmount || order.total || subtotal;
  const deliveryFee = order.deliveryFee || 0;

  const clientAddress = order.deliveryDetails?.address
    ? `${order.deliveryDetails.address}, ${order.deliveryDetails.commune || ""}, Kinshasa`
    : order.clientAddress || (order.clientLocation?.commune ? `${order.clientLocation.commune}, Kinshasa` : "Kinshasa, RDC");

  const clientName = order.deliveryDetails?.recipientName || order.clientName || order.guestName || "Client Rayons";
  const clientPhone = order.deliveryDetails?.recipientPhone || order.clientPhone || "";

  await generateFormalInvoicePDF({
    invoiceNumber: `RAY-CMD-${order.id ? order.id.slice(0, 8).toUpperCase() : Math.floor(10000 + Math.random() * 90000)}`,
    type: "ORDER",
    rayon: (order.rayon as any) || (order.category?.toLowerCase().includes("saveur") ? "saveurs" : order.category?.toLowerCase().includes("connect") ? "connect" : "mode"),
    createdAt: order.createdAt,
    status: order.status || "COMPLETED",
    supplierName: supplier?.displayName || supplier?.company || supplier?.name || order.supplierName || "Fournisseur Rayons.net",
    supplierPhone: supplier?.phone || supplier?.phoneNumber,
    supplierEmail: supplier?.email,
    supplierAddress: supplier?.address,
    supplierRccm: supplier?.rccm || order.supplierRccm,
    supplierIdNat: supplier?.idNat || order.supplierIdNat,
    supplierNif: supplier?.nif || order.supplierNif,
    supplierLogo: supplier?.logoUrl || supplier?.logo || supplier?.pendingProfile?.logoUrl || order.supplierLogo,
    clientName,
    clientPhone,
    clientAddress,
    items,
    subtotal,
    deliveryFee,
    total,
    currency,
    paymentMethod: order.paymentMethod || "Paiement sécurisé Rayons"
  });
}

/**
 * Generate formal voucher / stay receipt specifically for hotel bookings
 */
export async function generateHotelBookingReceiptPDF(booking: any, currency = "USD") {
  const checkIn = booking.checkInDate || "Date d'arrivée";
  const checkOut = booking.checkOutDate || "Date de départ";
  
  let nights = 1;
  if (booking.checkInDate && booking.checkOutDate) {
    const diffMs = new Date(booking.checkOutDate).getTime() - new Date(booking.checkInDate).getTime();
    if (!isNaN(diffMs) && diffMs > 0) {
      nights = Math.max(1, Math.round(diffMs / (1000 * 3600 * 24)));
    }
  }

  const total = booking.totalPrice || (booking.price ? booking.price * nights : 100);
  const nightlyRate = Math.round((total / nights) * 100) / 100;

  const items: InvoiceItem[] = [
    {
      description: `Séjour : ${booking.propertyTitle || "Chambre d'Hôtel"} (${booking.roomType || "Standard"}) - Du ${checkIn} au ${checkOut} (${booking.guestsCount || 1} personne(s))`,
      quantity: nights,
      unitPrice: nightlyRate,
      total: total
    }
  ];

  await generateFormalInvoicePDF({
    invoiceNumber: `RAY-HOTEL-${booking.id ? booking.id.slice(0, 8).toUpperCase() : Math.floor(10000 + Math.random() * 90000)}`,
    type: "RECEIPT",
    rayon: "immo",
    immoBranch: "hotel",
    createdAt: booking.createdAt,
    status: booking.status === "CONFIRMED" || booking.status === "CHECKED_OUT" ? "PAID" : "UNPAID",
    supplierName: booking.propertyTitle || "Établissement Hôtelier Partenaire",
    supplierAddress: booking.propertyLocation || "Kinshasa, RDC",
    supplierLogo: booking.supplierLogo || booking.hotelLogo || booking.logoUrl,
    clientName: booking.guestName || "Client Voyageur",
    clientPhone: booking.guestPhone || "",
    stayDetails: {
      room: booking.roomType || "Chambre Standard",
      checkIn: checkIn,
      checkOut: checkOut,
      nights: nights
    },
    items,
    subtotal: total,
    total: total,
    currency,
    paymentMethod: booking.paymentMethod || "Règlement Caisse / Réception",
    notes: "Document officiel Rayons.net à présenter lors du Check-in à la réception de l'établissement."
  });
}
