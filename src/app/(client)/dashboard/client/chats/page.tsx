"use client";

import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ClientChatsWidget } from "@/modules/supplier/components/ClientChatsWidget";
import AlibabaClientBottomNav from "@/modules/client/components/AlibabaClientBottomNav";

export default function ClientChatsPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col pb-20 sm:pb-8">
      <div className="max-w-6xl mx-auto w-full px-2 sm:px-4 py-4 sm:py-6 flex-1 flex flex-col">
        
        {/* Desktop Header */}
        <div className="mb-4 hidden sm:flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link 
              href="/dashboard/client" 
              className="p-2 hover:bg-gray-200 rounded-full transition-colors"
              title="Retour à mon espace"
            >
              <ArrowLeft size={22} className="text-gray-600" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Messagerie Acheteur</h1>
              <p className="text-xs text-gray-500">Échangez directement avec vos vendeurs et négociez en direct</p>
            </div>
          </div>
        </div>

        <Suspense fallback={<div className="min-h-[500px] bg-white rounded-2xl border border-gray-200 flex items-center justify-center text-gray-400">Chargement de la messagerie Alibaba...</div>}>
          <ClientChatsWidget embedded={false} />
        </Suspense>

      </div>

      {/* Alibaba 5-Tab Mobile Navigation Bar */}
      <AlibabaClientBottomNav />
    </div>
  );
}
