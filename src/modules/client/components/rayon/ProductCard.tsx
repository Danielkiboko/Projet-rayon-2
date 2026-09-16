import Link from "next/link";
import { ShieldCheck, Star, ShoppingBag, ShoppingCart } from "lucide-react";
import { motion } from "framer-motion";
import { evaluateProductVerification } from "@/lib/productVerification";
import { useCart } from "@/context/CartContext";
import { useCurrency } from "@/context/CurrencyContext";

interface ProductCardProps {
  product: any;
  lang: "fr" | "en";
  t: any;
  category: "mode" | "connect" | "saveurs";
  index: number;
  handleChat: (product: any) => void;
  onBuy?: (product: any) => void;
}

export function ProductCard({ product, lang, t, category, index, handleChat, onBuy }: ProductCardProps) {
  const { addToCart } = useCart();
  const { formatPrice } = useCurrency();
  const isMode = category === "mode";
  const isSaveurs = category === "saveurs";
  const verification = evaluateProductVerification(product);
  
  const bgClass = isMode 
    ? "bg-[#D4B08C] hover:bg-[#c49f7b] text-[#0F1D27] font-bold" 
    : isSaveurs
    ? "bg-[#FF6B35] hover:bg-[#e85d04] text-white font-bold"
    : "bg-[#00B5A5] hover:bg-[#009e90] text-white font-bold";

  const tagTextClass = isMode 
    ? "text-[#9C764D]" 
    : isSaveurs 
    ? "text-[#FF6B35]" 
    : "text-[#00B5A5]";

  const defaultTag = isMode ? "Mode" : isSaveurs ? "Saveurs" : "Connect";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: (index % 4) * 0.1, duration: 0.5 }}
      className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-all group flex flex-col"
    >
      {/* Product Image */}
      <div className="relative h-36 overflow-hidden bg-gray-50">
        <img 
          src={product.image} 
          alt={product.title?.[lang] || product.title?.fr || "Produit"}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute top-2 left-2">
          <span className={`px-2 py-0.5 bg-white/90 backdrop-blur-md ${tagTextClass} text-[9px] font-bold tracking-wider rounded border border-gray-200 shadow-sm uppercase`}>
            {product.tag?.[lang] || defaultTag}
          </span>
        </div>
      </div>

      {/* Product Info */}
      <div className="p-3 flex-1 flex flex-col">
        <div className="flex items-center justify-between mb-1">
          <span className="text-gray-400 text-[10px] font-bold tracking-wider truncate max-w-[60%]">{product.brand || "Marque"}</span>
          
          {/* Verification Badge (compact) */}
          {verification.badgeType === "admin_official" ? (
            <span className="flex items-center bg-[#0F1D27]/10 text-[#0F1D27] px-1.5 py-0.5 rounded text-[9px] font-bold border border-[#0F1D27]/20" title="Certifié Rayons">
              <ShieldCheck size={10} className="mr-0.5 text-[#C7D300]" /> Certifié
            </span>
          ) : verification.badgeType === "community_verified" ? (
            <span className="flex items-center bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded text-[9px] font-bold border border-emerald-200">
              <ShieldCheck size={10} className="mr-0.5 text-emerald-600" /> ★{verification.averageRating.toFixed(1)}
            </span>
          ) : verification.ratingsCount > 0 ? (
            <span className="flex items-center text-gray-400 text-[9px]">
              <Star size={9} className="mr-0.5 text-amber-400 fill-amber-400" />
              {verification.averageRating.toFixed(1)}
            </span>
          ) : (
            <span className="text-[9px] text-gray-300">Nouveau</span>
          )}
        </div>
        
        <h3 className="text-xs font-semibold text-gray-900 mb-1 leading-snug line-clamp-2">
          {product.title?.[lang] || product.title?.fr || product.title}
        </h3>
        
        <div className="text-sm font-bold text-gray-900 mb-2">
          {formatPrice(product.price)}
        </div>
      
        {/* Actions — compact row */}
        <div className="flex gap-1.5 mt-auto">
          {onBuy && (
            <button 
              type="button"
              onClick={() => onBuy(product)}
              className="flex-1 py-1.5 bg-[#0F1D27] hover:bg-[#1a2e3b] text-[#C7D300] text-[10px] font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer"
              title="Achat express"
            >
              <ShoppingBag size={11} />
              <span>Acheter</span>
            </button>
          )}
          <button 
            type="button"
            onClick={() => addToCart(product, 1)}
            className="flex-1 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-[10px] font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer"
            title="Panier"
          >
            <ShoppingCart size={11} className="text-primary" />
            <span>Panier</span>
          </button>
          <Link 
            href={`/product/${product.id}`}
            className="flex-1 py-1.5 bg-white hover:bg-gray-50 border border-gray-200 text-gray-600 text-[10px] font-semibold rounded-lg transition-colors flex items-center justify-center"
          >
            {t.details || "Détails"}
          </Link>
        </div>
      </div>
    </motion.div>
  );
}
