"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { ListTodo, History, User } from "lucide-react";

export default function DriverLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/driver/login";

  if (isLoginPage) {
    return <div className="bg-[#0b061c] min-h-screen text-white">{children}</div>;
  }

  const isMission = pathname.startsWith("/driver/mission");

  return (
    <div className="bg-[#0b061c] min-h-screen text-white flex flex-col max-w-md mx-auto border-x border-white/5 shadow-2xl relative">
      {/* Contenu principal */}
      <div className={`flex-1 overflow-y-auto ${isMission ? "" : "pb-20"}`}>
        {children}
      </div>

      {/* Bottom Nav — masquée sur la page mission (elle a son propre layout plein écran) */}
      {!isMission && (
        <nav className="absolute bottom-0 w-full h-16 bg-[#140b2e] border-t border-white/10 flex justify-around items-center px-2 z-50">
          <NavItem href="/driver" label="Missions" icon={ListTodo} active={pathname === "/driver"} />
          <NavItem href="/driver/history" label="Historique" icon={History} active={pathname === "/driver/history"} />
          <NavItem href="/driver/profile" label="Profil" icon={User} active={pathname === "/driver/profile"} />
        </nav>
      )}
    </div>
  );
}

function NavItem({ href, label, icon: Icon, active }: { href: string; label: string; icon: React.ElementType; active: boolean }) {
  return (
    <Link
      href={href}
      className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${
        active ? "text-primary-light" : "text-gray-500 hover:text-gray-300"
      }`}
    >
      <Icon size={22} />
      <span className="text-[10px] font-medium">{label}</span>
    </Link>
  );
}
