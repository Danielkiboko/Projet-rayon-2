"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/context/AuthContext"
import { motion } from "framer-motion"
import { isSupplier, isTeamMember, hasAdminAccess } from "@/lib/permissions"

export default function DashboardRedirect() {
  const router = useRouter()
  const { user, userData, loading } = useAuth()

  useEffect(() => {
    if (loading) return
    if (!user) {
      router.replace("/login")
      return
    }

    // userData might still be null briefly — wait for it
    if (userData === null) return;

    let role = (userData?.role || '').toUpperCase();
    
    // Hardcode super admin email for redirect if no role is explicitly set in Firestore
    if (!role && user?.email === "danielkiboko218@gmail.com") {
      role = "SUPER_ADMIN";
    }

    // If userData exists with a role, proceed to route — otherwise wait more
    if (!role && userData !== undefined) {
      // Try from token claims as last resort
      user.getIdTokenResult().then((tokenResult) => {
        const claimRole = (tokenResult.claims.role as string || '').toUpperCase();
        if (claimRole && ['SUPPLIER', 'SUPPLIER_IMMO', 'SUB_SUPPLIER', 'SUPPLIER_SAVEURS', 'SUPPLIER_MODE', 'SUPPLIER_CONNECT'].includes(claimRole)) {
          router.replace("/supplier");
        } else if (claimRole && ['SUPERADMIN', 'SUPER_ADMIN', 'ADMIN', 'SUB_ADMIN', 'ADMIN_FINANCE', 'ADMIN_DB', 'ADMIN_OPS'].includes(claimRole)) {
          router.replace("/admin/dashboard");
        }
      }).catch(() => {});
      return;
    }

    if (isSupplier(userData)) {
      router.replace("/supplier");
      return;
    }

    if (hasAdminAccess(user, userData) || isTeamMember(userData)) {
      router.replace("/admin/dashboard");
      return;
    }

    switch (role) {
      case "DELIVERY":
      case "DRIVER":
      case "LIVREUR":
        router.replace("/driver")
        break
      case "CLIENT":
      default:
        // Par défaut pour tout utilisateur authentifié (client ou compte standard)
        router.replace("/dashboard/client")
        break
    }
  }, [loading, user, userData, router])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0b061c] text-white">
      <div className="relative">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
          className="w-24 h-24 rounded-full border-4 border-white/10 border-t-primary border-l-primary"
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
            className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center backdrop-blur-sm border border-primary/50"
          >
            <span className="text-xl font-bold text-white tracking-wider">R<span className="text-primary-light">.</span></span>
          </motion.div>
        </div>
      </div>
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="mt-8 text-lg font-medium text-gray-400 tracking-wide"
      >
        Préparation de votre espace...
      </motion.p>
    </div>
  )
}
