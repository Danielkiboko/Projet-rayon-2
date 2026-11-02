"use client";

import Script from "next/script";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export default function AdSense() {
  const adSenseId = process.env.NEXT_PUBLIC_ADSENSE_ID;
  const [isDev, setIsDev] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      setIsDev(true);
    }
  }, []);

  if (!adSenseId) {
    return null;
  }

  // Do not show ads on control panels / dashboards
  const isDashboardRoute = pathname?.startsWith("/admin") || pathname?.startsWith("/supplier") || pathname?.startsWith("/dashboard");
  if (isDashboardRoute) {
    return null;
  }

  return (
    <>
      <Script
        async
        src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adSenseId}`}
        crossOrigin="anonymous"
        strategy="afterInteractive"
      />
      {isDev && (
        <div className="fixed bottom-[64px] sm:bottom-0 left-0 right-0 w-full bg-slate-200 dark:bg-slate-800 border-t border-slate-300 dark:border-slate-700 h-[60px] sm:h-[90px] flex items-center justify-center z-40 opacity-95 shadow-lg">
          <div className="text-center px-4">
            <span className="text-[10px] sm:text-xs text-slate-500 uppercase tracking-widest block mb-0.5">Espace Publicitaire (Simulation Localhost)</span>
            <span className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300">Votre publicité Google AdSense s'affichera ici en production</span>
          </div>
        </div>
      )}
    </>
  );
}
