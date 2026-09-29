"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

type ActionItem = {
  title: string;
  description: string;
  buttonText: string;
  href?: string;
  onClick?: () => void;
  buttonColor?: string; // e.g. "bg-amber-600 hover:bg-amber-700"
  hoverBorderColor?: string; // e.g. "hover:border-amber-500/20"
};

interface ActionCardProps {
  title: string;
  actions: ActionItem[];
  bgGradientColor?: string; // e.g. "bg-amber-500/5"
}

export default function ActionCard({ 
  title, 
  actions, 
  bgGradientColor = "bg-blue-500/5" 
}: ActionCardProps) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5, duration: 0.4 }}
      className="bg-[#0F1D27] border border-white/10 rounded-3xl p-6 shadow-xl relative overflow-hidden"
    >
      <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl -mr-10 -mt-10 ${bgGradientColor}`} />
      <h2 className="text-base font-semibold text-white mb-4 text-center relative z-10">{title}</h2>
      
      {actions.map((action, idx) => {
        const hoverBorderColor = action.hoverBorderColor || "hover:border-blue-500/20";
        const buttonColor = action.buttonColor || "bg-blue-600 hover:bg-blue-700";
        
        return (
          <motion.div 
            key={idx}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={`group relative z-10 bg-white/5 rounded-xl p-4 border border-white/5 transition-all mb-4 cursor-pointer hover:shadow-lg hover:shadow-black/20 ${hoverBorderColor}`} 
            onClick={() => {
              if (action.onClick) {
                action.onClick();
              } else if (action.href) {
                window.location.href = action.href;
              }
            }}
          >
            <h3 className="text-sm font-semibold text-white mb-2">{action.title}</h3>
            <p className="text-xs text-gray-400 mb-4 leading-relaxed">
              {action.description}
            </p>
            <button className={`${buttonColor} flex items-center justify-center space-x-2 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors w-full`}>
              <span>{action.buttonText}</span>
              <ArrowRight size={16} className="transform transition-transform group-hover:translate-x-1" />
            </button>
          </motion.div>
        );
      })}
    </motion.div>
  );
}

