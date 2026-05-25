"use client";

import { createContext, useContext, useState } from "react";
import { CURRENT_SAISON } from "@/lib/compta-types";

interface ComptaSaisonCtx {
  saison: string;
  setSaison: (s: string) => void;
}

const ComptaSaisonContext = createContext<ComptaSaisonCtx>({
  saison: CURRENT_SAISON,
  setSaison: () => {},
});

export function ComptaSaisonProvider({ children }: { children: React.ReactNode }) {
  const [saison, setSaison] = useState(CURRENT_SAISON);
  return (
    <ComptaSaisonContext.Provider value={{ saison, setSaison }}>
      {children}
    </ComptaSaisonContext.Provider>
  );
}

export function useComptaSaison() {
  return useContext(ComptaSaisonContext);
}
