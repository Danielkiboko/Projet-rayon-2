import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  buildVisaPaymentUrl,
  sanitizeHttpsPaymentUrl,
} from "@/lib/visaPayments";

describe("Visa payment URL sanitization & construction", () => {
  it("blocks javascript:, data:, and insecure http:// URLs", () => {
    expect(sanitizeHttpsPaymentUrl("javascript:alert(1)")).toBe("");
    expect(sanitizeHttpsPaymentUrl("data:text/html,<script>alert(1)</script>")).toBe("");
    expect(sanitizeHttpsPaymentUrl("http://buy.stripe.com/test")).toBe("");
    expect(sanitizeHttpsPaymentUrl("https://localhost/pay")).toBe("");
  });

  it("accepts valid HTTPS gateway URLs", () => {
    expect(sanitizeHttpsPaymentUrl("https://buy.stripe.com/live_abc123")).toBe(
      "https://buy.stripe.com/live_abc123"
    );
  });

  it("injects client_reference_id & prefilled_email without overriding Stripe amount", () => {
    const stripeUrl = buildVisaPaymentUrl("https://buy.stripe.com/live_abc123", {
      referenceId: "sub_uid123",
      email: "Vendeur@Rayons.net",
      amount: 50,
      currency: "USD",
    });
    const parsed = new URL(stripeUrl);
    expect(parsed.searchParams.get("client_reference_id")).toBe("sub_uid123");
    expect(parsed.searchParams.get("prefilled_email")).toBe("vendeur@rayons.net");
    expect(parsed.searchParams.get("amount")).toBeNull();
  });

  it("injects amount & currency for non-Stripe hosted gateways", () => {
    const fwUrl = buildVisaPaymentUrl("https://checkout.flutterwave.com/v3/hosted/pay", {
      referenceId: "ord_7788",
      email: "client@rayons.net",
      amount: 125.5,
      currency: "usd",
    });
    const parsed = new URL(fwUrl);
    expect(parsed.searchParams.get("client_reference_id")).toBe("ord_7788");
    expect(parsed.searchParams.get("amount")).toBe("125.5");
    expect(parsed.searchParams.get("currency")).toBe("USD");
  });

  it("verifies HMAC-SHA256 webhook signature timing-safely", () => {
    const secret = "whsec_test_secret_123";
    const timestamp = Math.floor(Date.now() / 1000);
    const payload = JSON.stringify({ id: "evt_1", type: "checkout.session.completed" });
    const expected = crypto
      .createHmac("sha256", secret)
      .update(`${timestamp}.${payload}`, "utf8")
      .digest("hex");

    const actual = crypto
      .createHmac("sha256", secret)
      .update(`${timestamp}.${payload}`, "utf8")
      .digest("hex");

    expect(
      crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(actual, "hex"))
    ).toBe(true);
  });
});
