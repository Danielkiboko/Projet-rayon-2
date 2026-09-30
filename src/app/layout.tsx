import type { Metadata } from "next";
import Script from "next/script";
import { Montserrat, Inter } from "next/font/google";
import "./globals.css";
import { GlobalChatbot } from "@/modules/shared/components/GlobalChatbot";

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Rayons.net | Tout ce dont vous avez besoin, en un seul endroit",
  description: "Rayons est la marketplace de référence : Technologies & Objets connectés (Rayons Connect), Immobilier & Hôtels (Rayons Immo), Prêt-à-porter & Accessoires (Rayons Mode).",
};

import { AuthProvider } from "@/context/AuthContext";
import { CurrencyProvider } from "@/context/CurrencyContext";
import { ChatProvider } from "@/context/ChatContext";
import { CartProvider } from "@/context/CartContext";
import { ThemeProvider } from "@/modules/shared/components/ThemeProvider";
import AdSense from "@/modules/shared/components/shared/AdSense";
import { CartDrawer } from "@/modules/client/components/cart/CartDrawer";

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
            <CurrencyProvider>
              <ChatProvider>
                <CartProvider>
                  {children}
                  <GlobalChatbot />
                  <CartDrawer />
                </CartProvider>
              </ChatProvider>
            </CurrencyProvider>
          </AuthProvider>
        </ThemeProvider>
        <AdSense />
        <Toaster position="top-center" />
        
        {/* Google Analytics */}
        <Script
          strategy="afterInteractive"
          src={`https://www.googletagmanager.com/gtag/js?id=G-HPP4V5XYSV`}
        />
        <Script
          id="google-analytics"
          strategy="afterInteractive"
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
