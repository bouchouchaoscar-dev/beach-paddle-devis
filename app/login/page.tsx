"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { login, isAuthenticated } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (isAuthenticated()) {
      router.replace("/dashboard");
    }
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    await new Promise((r) => setTimeout(r, 600));
    const session = login(username.trim(), password);
    if (session) {
      router.replace("/dashboard");
    } else {
      setError("Identifiants incorrects. Vérifie ton nom d'utilisateur et mot de passe.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-surface relative overflow-hidden">
      {/* Background decoration */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(0,113,227,0.06) 0%, transparent 60%), radial-gradient(ellipse 60% 50% at 100% 80%, rgba(0,113,227,0.04) 0%, transparent 50%)",
        }}
      />
      <div
        className="absolute top-0 left-0 right-0 h-1 opacity-80"
        style={{
          background: "linear-gradient(90deg, #0071E3 0%, #0052A3 100%)",
        }}
      />

      {/* Card */}
      <div
        className="relative w-full max-w-md mx-4 animate-scale-in"
        style={{ opacity: 0, animation: "scaleIn 0.4s cubic-bezier(0.16,1,0.3,1) 0.1s forwards" }}
      >
        <div className="bg-white rounded-3xl shadow-float border border-surface-border overflow-hidden">
          {/* Header */}
          <div className="px-8 pt-10 pb-6 text-center border-b border-surface-border bg-surface-muted/40">
            <div className="flex justify-center mb-5">
              <div className="relative w-20 h-20">
                <Image
                  src="/logo.png"
                  alt="Beach Paddle"
                  fill
                  className="object-contain"
                  priority
                />
              </div>
            </div>
            <h1
              className="text-2xl font-bold tracking-tight"
              style={{ color: "#1D1D1F" }}
            >
              BEACH PADDLE
            </h1>
            <p className="text-sm text-ink-secondary mt-1 font-medium">
              Outil de génération de devis
            </p>
          </div>

          {/* Form */}
          <div className="px-8 py-8">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="username" className="label">
                  Nom d&apos;utilisateur
                </label>
                <input
                  id="username"
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="input-field"
                  placeholder="oscar"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label htmlFor="password" className="label">
                  Mot de passe
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input-field pr-12"
                    placeholder="••••••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink-secondary transition-colors p-1"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                        <line x1="1" y1="1" x2="23" y2="23"/>
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {error && (
                <div
                  className="flex items-start gap-2.5 p-3 rounded-xl text-sm text-brand-red border animate-slide-up"
                  style={{
                    backgroundColor: "rgba(224,49,49,0.06)",
                    borderColor: "rgba(224,49,49,0.2)",
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 mt-0.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !username || !password}
                className="btn-primary w-full py-3 text-base mt-2"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                    </svg>
                    Connexion…
                  </span>
                ) : (
                  "Se connecter"
                )}
              </button>
            </form>
          </div>
        </div>

        <p className="text-center text-xs text-ink-muted mt-5">
          Usage interne — Beach Paddle © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
