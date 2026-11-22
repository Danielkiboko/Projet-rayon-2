import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Montserrat, Inter } from "next/font/google";
import "./globals.css";

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0F1D27",
};

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://rayons.net").replace(/\/$/, "");

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Rayons.net | Marketplace Officielle RDC — Tech, Immo, Mode & Saveurs",
    template: "%s | Rayons.net",
  },
  description:
    "Rayons.net est la marketplace officielle de référence en RDC : Technologies & Starlink (Rayons Connect), Immobilier & Hôtels (Rayons Immo), Prêt-à-porter & Luxe (Rayons Mode), Restaurants & Cuisine (Rayons Saveurs). Paiement sécurisé à la livraison.",
  keywords: [
    "Rayons.net",
    "marketplace RDC",
    "achat en ligne Kinshasa",
    "boutique en ligne Congo",
    "Starlink Kinshasa",
    "immobilier Kinshasa",
    "location appartement Gombe",
    "hôtel Kinshasa",
    "mode Kinshasa",
    "livraison Kinshasa",
    "M-Pesa",
    "Airtel Money",
    "Orange Money",
    "DRC marketplace",
    "刚果金电商平台",
    "金沙萨网上商城",
  ],
  alternates: {
    canonical: SITE_URL,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  verification: {
    google:
      process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION ||
      "iunagOxvWrLmqwCOdJWj9lbggVHnoCoJxG7huh2hwAE",
  },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "Rayons.net",
    title: "Rayons.net | Tout ce dont vous avez besoin, en un seul endroit",
    description:
      "Technologies & Starlink, Immobilier & Hôtels, Mode et Gastronomie en RDC. Commandez auprès de boutiques vérifiées avec paiement sécurisé.",
    locale: "fr_FR",
    alternateLocale: ["en_US", "zh_CN"],
    images: [{ url: "/supermarket-hero.jpg", width: 1200, height: 630, alt: "Rayons.net — Marketplace Officielle RDC" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Rayons.net | Marketplace Officielle RDC",
    description: "Tech, Immobilier & Hôtels, Mode et Saveurs en RDC avec paiement sécurisé à la livraison.",
    images: ["/supermarket-hero.jpg"],
  },
  icons: {
    icon: [
      { url: "/favicon.ico?v=4", sizes: "48x48", type: "image/x-icon" },
      { url: "/icon.png?v=4", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png?v=4", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png?v=4", sizes: "180x180", type: "image/png" },
    ],
    shortcut: "/favicon.ico?v=4",
  },
};

import { AuthProvider } from "@/context/AuthContext";
import { CurrencyProvider } from "@/context/CurrencyContext";
import { LanguageProvider } from "@/context/LanguageContext";
import { ChatProvider } from "@/context/ChatContext";
import { CartProvider } from "@/context/CartContext";
import { ThemeProvider } from "@/modules/shared/components/ThemeProvider";
import AdSense from "@/modules/shared/components/shared/AdSense";
import { CartDrawer } from "@/modules/client/components/cart/CartDrawer";
import { StructuredData } from "@/modules/shared/components/StructuredData";
import MobilePushManager from "@/modules/shared/components/notifications/MobilePushManager";
import GlobalUiTranslator from "@/modules/shared/components/GlobalUiTranslator";

import { Toaster } from "react-hot-toast";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="fr"
      className={`${montserrat.variable} ${inter.variable} font-sans h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-gray-50 dark:bg-[#0F1D27] text-[#0F1D27] dark:text-gray-100 transition-colors font-sans" suppressHydrationWarning>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <AuthProvider>
            <LanguageProvider>
              <CurrencyProvider>
                <ChatProvider>
                  <CartProvider>
                    {children}
                    <CartDrawer />
                    <MobilePushManager />
                    <GlobalUiTranslator />
                  </CartProvider>
                </ChatProvider>
              </CurrencyProvider>
            </LanguageProvider>
          </AuthProvider>
        </ThemeProvider>
        <StructuredData />
        <AdSense />
        <Toaster position="top-center" />
        
        {/* Google Analytics (GA4) — injecté dans le HTML SSR <head> pour détection immédiate Google */}
        <Script
          id="google-analytics-gtag"
          strategy="beforeInteractive"
          src="https://www.googletagmanager.com/gtag/js?id=G-HPP4V5XYSV"
        />
        <Script
          id="google-analytics"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'G-HPP4V5XYSV');
            `,
          }}
        />
      </body>
    </html>
  );
}
