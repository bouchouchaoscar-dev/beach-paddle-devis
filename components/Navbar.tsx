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

  const navLinks = [
    {
      href: "/dashboard",
      label: "Nouveau devis",
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="12 8 12 12 14 14"/>
          <path d="M3.05 11a9 9 0 1 1 .5 4m-.5 5v-5h5"/>
        </svg>
      ),
    },
  ];

  return (
    <nav className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-surface-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        {/* Logo + Brand */}
        <Link href="/dashboard" className="flex items-center gap-2.5 shrink-0">
          <div className="relative w-10 h-10">
            <Image src="/logo.png" alt="Beach Paddle" fill className="object-contain" />
          </div>
          <span
            className="text-lg font-bold tracking-tight hidden sm:block"
            style={{ color: "#1D1D1F" }}
          >
            Beach Paddle
          </span>
        </Link>

        {/* Nav links */}
        <div className="flex items-center gap-1">
          {navLinks.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  active
                    ? "bg-brand-orange-light text-brand-orange"
                    : "text-ink-secondary hover:bg-surface-muted hover:text-ink"
                }`}
              >
                <span className={active ? "text-brand-orange" : "text-ink-muted"}>
                  {link.icon}
                </span>
                {link.label}
              </Link>
            );
          })}
        </div>

        {/* User + Logout */}
        <div className="flex items-center gap-2 shrink-0">
          {session && (
            <span className="text-xs text-ink-muted hidden sm:block">
              {session.displayName}
            </span>
          )}
          <button
            onClick={handleLogout}
            className="btn-ghost text-xs px-3 py-1.5"
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
