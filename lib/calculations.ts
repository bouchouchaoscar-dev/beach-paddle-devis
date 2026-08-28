import type { DevisFormData, CalculationResult } from "./types";
import { getActivityPrice } from "./pricing";

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function calculateDevis(
  form: DevisFormData,
  acompteVerse?: number
): CalculationResult {
  const n = form.participantsCount || 0;

  // Activity
  const activityPricePerPerson =
    form.activity !== "none"
      ? getActivityPrice(form.activity, form.duration)
      : 0;
  const activitySubtotal = round2(activityPricePerPerson * n);

  // Coach — forfait fixe pour le groupe (pas multiplié par n)
  const coachSubtotal = form.coach.enabled ? round2(form.coach.price) : 0;

  // Snacking
  let snackingSubtotal = 0;
  for (const item of form.snackingItems) {
    const price =
      item.pricePerPerson !== null
        ? item.pricePerPerson
        : (item.manualPrice ?? 0);
    snackingSubtotal += price * n;
  }
  snackingSubtotal = round2(snackingSubtotal);

  const totalBrut = round2(activitySubtotal + coachSubtotal + snackingSubtotal);

  let discountAmount = 0;
  let accompagnatorsCost = 0;
  let extraDiscountAmount = 0;
  let totalDiscount = 0;
  let totalNet = totalBrut;

  if (form.discount.extraDiscountEnabled) {
    // Chemin legacy : anciens devis scolaire/loisirs créés avant l'uniformisation.
    // Accompagnateurs déduits en premier, remise supplémentaire appliquée sur le reste.
    if (form.discount.accompagnatorsEnabled && form.discount.accompagnatorsCount > 0 && n > 0) {
      accompagnatorsCost = round2(round2(totalBrut / n) * form.discount.accompagnatorsCount);
    }
    const afterAccompagnateurs = round2(totalBrut - accompagnatorsCost);
    extraDiscountAmount = round2(afterAccompagnateurs * (form.discount.extraDiscountRate / 100));
    totalDiscount = round2(accompagnatorsCost + extraDiscountAmount);
    totalNet = round2(totalBrut - totalDiscount);
  } else {
    // Chemin unifié : même logique pour tous les types de client.
    if (form.discount.discountEnabled) {
      discountAmount = round2(totalBrut * (form.discount.discountRate / 100));
    }
    if (form.discount.accompagnatorsEnabled && form.discount.accompagnatorsCount > 0 && n > 0) {
      accompagnatorsCost = round2(round2(totalBrut / n) * form.discount.accompagnatorsCount);
    }
    totalDiscount = round2(discountAmount + accompagnatorsCost);
    totalNet = round2(totalBrut - totalDiscount);
  }

  const exactRate = totalBrut > 0 ? (totalDiscount / totalBrut) * 100 : 0;
  const totalDiscountRate = Math.round(exactRate * 2) / 2; // arrondi au 0.5 le plus proche
  const totalDiscountRateIsExact = Math.abs(totalDiscountRate - exactRate) < 0.0001;

  const resteADue =
    acompteVerse !== undefined && acompteVerse > 0
      ? round2(totalNet - acompteVerse)
      : undefined;

  return {
    activitySubtotal,
    activityPricePerPerson,
    coachSubtotal,
    snackingSubtotal,
    totalBrut,
    discountAmount,
    accompagnatorsCost,
    extraDiscountAmount,
    totalDiscount,
    totalDiscountRate,
    totalDiscountRateIsExact,
    totalNet,
    resteADue,
  };
}

export function formatPrice(amount: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
