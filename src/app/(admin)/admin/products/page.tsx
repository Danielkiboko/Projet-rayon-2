"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { hasAdminAccess } from "@/lib/permissions";
import { ShieldAlert } from "lucide-react";
import ProductManager from "@/modules/shared/components/products/ProductManager";

export default function AdminProductsPage() {
  const { user, userData, loading } = useAuth();
  const router = useRouter();
  const isAuthorized = hasAdminAccess(user, userData);
  
  // Protect route for Admin and authorized staff
  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push("/login");
      } else if (!isAuthorized) {
        router.push("/");
      }
    }
  }, [user?.uid, loading, router, isAuthorized]);

  if (loading || !user || !isAuthorized) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-white flex flex-col items-center">
          <ShieldAlert size={48} className="text-gray-500 mb-4 animate-pulse" />
          <p>Vérification des accès sécurisés...</p>
        </div>
      </div>
    );
  }

  return <ProductManager isAdmin={true} />;
}
