"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/login");
    } else {
      setChecked(true);
    }
  }, [router]);

  if (!checked) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-surface">
        <div className="flex flex-col items-center gap-3">
          <div
            className="w-8 h-8 rounded-full border-2 border-transparent animate-spin"
            style={{ borderTopColor: "#0071E3", borderRightColor: "#0071E3" }}
          />
          <span className="text-sm text-ink-muted">Chargement…</span>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
