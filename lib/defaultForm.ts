import type { DevisFormData } from "./types";

export function getTodayString(): string {
  return new Date().toISOString().split("T")[0];
}

export function getDefaultForm(): DevisFormData {
  return {
    date: getTodayString(),
    dateADefinir: false,
    heureDebut: "14:00",
    clientType: "entreprise",
    clientName: "",
    clientAddress: "",
    prestationDescription: "",
    participantsCount: 20,
    activity: "paddle",
    duration: "1h30",
    megaPaddleCount: 1,
    megaEscapeCount: 0,
    coach: { enabled: false, description: "Coach Beach Paddle", price: 30 },
    snackingItems: [],
    discount: {
      discountRate: 10,
      discountEnabled: true,
      accompagnatorsEnabled: true,
      accompagnatorsCount: 2,
      extraDiscountEnabled: true,
      extraDiscountRate: 10,
    },
    documentType: "devis",
  };
}
