export default function GlobalLoading() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0F1D27]/80 backdrop-blur-md text-white transition-opacity duration-300">
      <div className="relative flex items-center justify-center">
        {/* Outer pulsating glow */}
        <div className="absolute w-20 h-20 rounded-full bg-[#C7D300]/20 animate-ping" />
        
        {/* Rotating ring */}
        <div className="w-16 h-16 rounded-full border-3 border-white/10 border-t-[#C7D300] animate-spin" />
        
        {/* Core dot */}
        <div className="absolute w-3 h-3 rounded-full bg-[#C7D300] shadow-lg shadow-[#C7D300]" />
      </div>

      <div className="mt-5 text-center">
        <p className="font-heading font-black text-sm tracking-wider uppercase text-white">
          Rayons<span className="text-[#C7D300]">.net</span>
        </p>
        <p className="text-[11px] text-gray-400 mt-0.5 animate-pulse">
          Chargement sécurisé en cours...
        </p>
      </div>
    </div>
  );
}
