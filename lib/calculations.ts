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

  // Discount
  let discountAmount = 0;
  let accompagnatorsCost = 0;
  let extraDiscountAmount = 0;
  let totalDiscount = 0;
  let totalNet = totalBrut;

  if (form.clientType === "entreprise" && form.discount.discountEnabled) {
    discountAmount = round2(totalBrut * (form.discount.discountRate / 100));
    totalDiscount = discountAmount;
    totalNet = round2(totalBrut - discountAmount);
  } else if (form.clientType === "association") {
    if (form.discount.discountEnabled) {
      discountAmount = round2(totalBrut * (form.discount.discountRate / 100));
    }
    if (form.discount.accompagnatorsEnabled && form.discount.accompagnatorsCount > 0) {
      const pricePerPerson = totalBrut > 0 ? round2(totalBrut / n) : 0;
      accompagnatorsCost = round2(pricePerPerson * form.discount.accompagnatorsCount);
    }
    totalDiscount = round2(discountAmount + accompagnatorsCost);
    totalNet = round2(totalBrut - totalDiscount);
  } else if (
    form.clientType === "scolaire" ||
    form.clientType === "loisirs"
  ) {
    // Step 1: accompagnateurs offerts
    if (
      form.discount.accompagnatorsEnabled &&
      form.discount.accompagnatorsCount > 0
    ) {
      const pricePerPerson =
        totalBrut > 0 ? round2(totalBrut / n) : 0;
      accompagnatorsCost = round2(
        pricePerPerson * form.discount.accompagnatorsCount
      );
    }

    const afterAccompagnators = round2(totalBrut - accompagnatorsCost);

    // Step 2: remise supplémentaire
    if (form.discount.extraDiscountEnabled) {
      extraDiscountAmount = round2(
        afterAccompagnators * (form.discount.extraDiscountRate / 100)
      );
    }

    totalDiscount = round2(accompagnatorsCost + extraDiscountAmount);
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
