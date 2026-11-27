import { describe, expect, it } from "vitest";
import {
  getDeliveryFeeForCommune,
  isNegotiatedDeliveryCommune,
  OTHER_DESTINATION_VALUE,
} from "@/lib/kinshasaDelivery";
import { orderCreateSchema, paymentIntentSchema } from "@/server/schemas";

describe("Kinshasa delivery fees & negotiated destination", () => {
  it("returns exact fees for standard Kinshasa zones", () => {
    expect(getDeliveryFeeForCommune("Gombe")).toBe(3);
    expect(getDeliveryFeeForCommune("Ngaliema")).toBe(5);
    expect(getDeliveryFeeForCommune("Masina")).toBe(8);
    expect(getDeliveryFeeForCommune("Nsele")).toBe(15);
    expect(getDeliveryFeeForCommune("Maluku")).toBe(20);
  });

  it("returns 0 and marks negotiated for 'Autre' destination", () => {
    expect(isNegotiatedDeliveryCommune(OTHER_DESTINATION_VALUE)).toBe(true);
    expect(isNegotiatedDeliveryCommune("autre destination")).toBe(true);
    expect(getDeliveryFeeForCommune(OTHER_DESTINATION_VALUE)).toBe(0);
    expect(isNegotiatedDeliveryCommune("Gombe")).toBe(false);
  });
});

describe("orderCreateSchema Zod validation", () => {
  it("accepts a valid checkout payload with negotiated destination", () => {
    const res = orderCreateSchema.safeParse({
      items: [{ id: "prod_1", title: "iPhone 15", price: 850, quantity: 1 }],
      clientName: "Daniel Kiboko",
      clientPhone: "+243810000000",
      clientEmail: "client@rayons.net",
      deliveryDetails: {
        commune: "Autre",
        customDestination: "Lubumbashi - Centre",
        deliveryFeeNegotiated: true,
        address: "Avenue Mobutu 42",
        deliveryFee: 0,
      },
      paymentMethod: "CASH_ON_DELIVERY",
      currency: "USD",
    });
    expect(res.success).toBe(true);
  });

  it("rejects negative prices, excessive quantities, or missing phone", () => {
    const res = orderCreateSchema.safeParse({
      items: [{ id: "prod_1", price: -10, quantity: 9999 }],
      clientName: "",
      clientPhone: "12",
      deliveryDetails: { address: "A" },
    });
    expect(res.success).toBe(false);
  });

  it("validates supplier paymentIntentSchema strictly", () => {
    const ok = paymentIntentSchema.safeParse({
      email: "vendeur@rayons.net",
      paymentMethod: "mobile_money",
      amount: 50,
    });
    expect(ok.success).toBe(true);

    const bad = paymentIntentSchema.safeParse({
      email: "not-an-email",
      amount: 0,
    });
    expect(bad.success).toBe(false);
  });
});
