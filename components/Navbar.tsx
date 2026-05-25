"use client";

import { useRouter, usePathname } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { logout, getSession } from "@/lib/auth";

export function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const session = getSession();

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  const devisLinks = [
    {
      href: "/dashboard",
      label: "Nouveau devis",
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="12" y1="11" x2="12" y2="17"/>
          <line x1="9" y1="14" x2="15" y2="14"/>
        </svg>
      ),
    },
    {
      href: "/historique",
      label: "Archives",
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="12 8 12 12 14 14"/>
          <path d="M3.05 11a9 9 0 1 1 .5 4m-.5 5v-5h5"/>
        </svg>
      ),
    },
  ];

  const comptaLinks = [
    {
      href: "/compta/chiffres",
      label: "CA",
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
        </svg>
      ),
    },
    {
      href: "/compta/charges",
      label: "Charges",
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="5" width="20" height="14" rx="2"/>
          <line x1="2" y1="10" x2="22" y2="10"/>
        </svg>
      ),
    },
    {
      href: "/compta/resultat",
      label: "Résultat",
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="1" x2="12" y2="23"/>
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
        </svg>
      ),
    },
    {
      href: "/compta/analyse",
      label: "Analyse",
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
          <polyline points="7.5 4.21 12 6.81 16.5 4.21"/>
          <polyline points="7.5 19.79 7.5 14.6 3 12"/>
          <polyline points="21 12 16.5 14.6 16.5 19.79"/>
          <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
          <line x1="12" y1="22.08" x2="12" y2="12"/>
        </svg>
      ),
    },
  ];

  return (
    <nav className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-surface-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
        {/* Logo + Brand */}
        <Link href="/dashboard" className="flex items-center gap-2.5 shrink-0">
          <div className="relative w-9 h-9">
            <Image src="/logo.png" alt="Beach Paddle" fill className="object-contain" />
          </div>
          <div className="hidden sm:flex flex-col leading-none gap-0.5">
            <span className="text-sm font-bold tracking-tight" style={{ color: "#1D1D1F" }}>
              Beach Paddle
            </span>
            <span className="text-[10px] font-semibold" style={{ color: "#0071E3" }}>
              Admin
            </span>
          </div>
        </Link>

        {/* Nav links — horizontal scroll on mobile */}
        <div className="flex-1 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <div className="flex items-center gap-0.5 min-w-max">
            {/* Devis group */}
            {devisLinks.map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 whitespace-nowrap ${
                    active
                      ? "bg-brand-orange-light text-brand-orange"
                      : "text-ink-secondary hover:bg-surface-muted hover:text-ink"
                  }`}
                >
                  <span className={active ? "text-brand-orange" : "text-ink-muted"}>
                    {link.icon}
                  </span>
                  <span className="hidden sm:inline">{link.label}</span>
                </Link>
              );
            })}

            {/* Separator */}
            <div className="w-px h-5 bg-surface-border mx-1.5 shrink-0" />

            {/* Compta group */}
            {comptaLinks.map((link) => {
              const active = pathname?.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 whitespace-nowrap ${
                    active
                      ? "bg-brand-teal-light text-brand-teal"
                      : "text-ink-secondary hover:bg-surface-muted hover:text-ink"
                  }`}
                >
                  <span className={active ? "text-brand-teal" : "text-ink-muted"}>
                    {link.icon}
                  </span>
                  {link.label}
                </Link>
              );
            })}
          </div>
        </div>

        {/* User + Logout */}
        <div className="flex items-center gap-1.5 shrink-0">
          {session && (
            <span className="text-xs text-ink-muted hidden md:block">{session.displayName}</span>
          )}
          <button
            onClick={handleLogout}
            className="btn-ghost text-xs px-2.5 py-1.5"
            title="Se déconnecter"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            <span className="hidden sm:inline">Déconnexion</span>
          </button>
        </div>
      </div>
    </nav>
  );
}
