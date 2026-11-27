import { z } from "zod";

/**
 * Schémas Zod partagés pour les routes financières et critiques de Rayons.net.
 */

export const orderItemInputSchema = z.object({
  id: z.string().trim().min(1).max(160).optional(),
  productId: z.string().trim().min(1).max(160).optional(),
  title: z.string().max(200).optional(),
  price: z.coerce.number().min(0).optional(),
  quantity: z.coerce.number().int().min(1).max(500).default(1),
  image: z.string().max(50000).optional(),
  imageUrl: z.string().max(50000).optional(),
  supplierId: z.string().max(160).optional(),
  rayon: z.string().max(60).optional(),
  category: z.string().max(60).optional(),
});

export const orderCreateSchema = z.object({
  items: z.array(orderItemInputSchema).max(50).optional(),
  product: z.record(z.string(), z.unknown()).optional(),
  quantity: z.coerce.number().int().min(1).max(500).default(1),
  clientName: z.string().trim().min(1, "Le nom du client est requis.").max(140),
  clientPhone: z.string().trim().min(4, "Le numéro de téléphone est requis.").max(40),
  clientEmail: z.string().trim().email().optional().nullable().or(z.literal("")),
  deliveryDetails: z.object({
    city: z.string().trim().max(120).optional(),
    commune: z.string().trim().max(120).optional(),
    customDestination: z.string().trim().max(160).optional().nullable(),
    deliveryFeeNegotiated: z.boolean().optional(),
    address: z.string().trim().min(2, "L'adresse de livraison est requise.").max(300),
    deliveryFee: z.coerce.number().min(0).max(500).optional(),
  }),
  paymentMethod: z.enum(["CASH_ON_DELIVERY", "MOBILE_MONEY", "CARD"]).default("CASH_ON_DELIVERY"),
  mobileMoneyOperator: z.string().max(40).optional().nullable(),
  currency: z.enum(["USD", "FC", "CDF", "EUR"]).default("USD"),
  notes: z.string().max(500).optional().nullable(),
});

export const financeEntrySchema = z.object({
  kind: z.enum(["OTHER_INCOME", "EXPENSE", "ADJUSTMENT"]),
  amount: z.coerce.number().refine((v) => Number.isFinite(v) && v !== 0, "Montant non nul requis."),
  label: z.string().trim().max(240).optional(),
  reason: z.string().trim().max(160).optional(),
  referencePiece: z.string().trim().max(120).optional(),
  accountingScope: z.string().trim().max(60).optional(),
});

export const paymentIntentSchema = z.object({
  reference: z.string().trim().max(120).optional(),
  operatorTxRef: z.string().trim().max(120).optional(),
  email: z.string().trim().email("Adresse email valide requise.").max(140),
  phone: z.string().trim().max(40).optional(),
  paymentPhone: z.string().trim().max(40).optional(),
  paymentMethod: z.enum(["mobile_money", "card"]).default("mobile_money"),
  operator: z.string().trim().max(30).optional(),
  amount: z.coerce.number().min(1).max(5000).default(50),
  promoCode: z.string().trim().max(40).optional(),
});
