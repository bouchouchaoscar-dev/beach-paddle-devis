import { DURATION_LABELS } from "./pricing";
import type { DevisFormData } from "./types";

function formatHeure(h: string): string {
  const [hh, mm] = h.split(":");
  return !mm || mm === "00" ? `${parseInt(hh)}h` : `${parseInt(hh)}h${mm}`;
}

const MONTHS_FR = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

function formatDateCourt(dateStr: string): string {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return "";
  return `le ${d} ${MONTHS_FR[m - 1]}`;
}

function buildMegaPaddlePhrase(mp: number, me: number, group: string, dur: string, dateTime: string): string {
  const prep = (n: number) => n === 1 ? "d'" : "de ";
  const mpLabel = (n: number) => n === 1 ? "1 MégaPaddle" : `${n} MégaPaddles`;
  const meLabel = (n: number) => {
    const seats = n === 1 ? " (4 sièges)" : " (4 sièges chacun)";
    return n === 1 ? `1 MégaScape${seats}` : `${n} MégaScapes${seats}`;
  };
  if (mp > 0 && me > 0) {
    return `Location ${prep(mp)}${mpLabel(mp)} et ${meLabel(me)} ${group} — ${dur}${dateTime}.`;
  }
  if (mp > 0) return `Location ${prep(mp)}${mpLabel(mp)} ${group} — ${dur}${dateTime}.`;
  if (me > 0) return `Location ${prep(me)}${meLabel(me)} ${group} — ${dur}${dateTime}.`;
  return `Location de MégaPaddle ${group} — ${dur}${dateTime}.`;
}

function buildGroupPhrase(form: DevisFormData): string {
  const n = form.participantsCount;
  const z = form.discount.accompagnatorsCount;
  if (form.clientType === "scolaire" || form.clientType === "loisirs") {
    const y = Math.max(0, n - z);
    return `pour un groupe de ${n} personnes dont ${y} élèves et ${z} accompagnateurs`;
  }
  if (form.clientType === "association" && form.discount.accompagnatorsEnabled && z > 0) {
    const y = Math.max(0, n - z);
    return `pour un groupe de ${n} personnes dont ${y} membres et ${z} accompagnateurs`;
  }
  return `pour ${n} personnes`;
}

export function buildAutoDescription(form: DevisFormData): string {
  const group = buildGroupPhrase(form);
  const durationLabel = DURATION_LABELS[form.duration];
  const datePart = (!form.dateADefinir && form.date) ? ` ${formatDateCourt(form.date)}` : "";
  const timePart = (!form.dateADefinir && form.heureDebut) ? ` à ${formatHeure(form.heureDebut)}` : "";
  const dateTime = datePart || timePart ? `,${datePart}${timePart}` : "";

  const parts: string[] = [];

  if (form.activity === "paddle") {
    parts.push(`Location de Paddle ${group} — ${durationLabel}${dateTime}.`);
  } else if (form.activity === "kayak") {
    parts.push(`Location de Kayak ${group} — ${durationLabel}${dateTime}.`);
  } else if (form.activity === "hybride") {
    parts.push(`Location de Paddle et Kayak ${group} — ${durationLabel}${dateTime}.`);
  } else if (form.activity === "mega_paddle") {
    parts.push(buildMegaPaddlePhrase(form.megaPaddleCount ?? 1, form.megaEscapeCount ?? 0, group, durationLabel, dateTime));
  }

  for (const item of form.snackingItems) {
    const prefix = item.label.startsWith("Formule") ? "" : "Formule ";
    const biereSuffix = item.formula === "dejeuner" && item.biereIncluse ? " (avec bière)" : "";
    parts.push(`+ ${prefix}${item.label} incluse${biereSuffix}.`);
  }

  if (form.coach.enabled) {
    parts.push(`+ Encadrement et initiation par un Coach Beach Paddle.`);
  }

  return parts.join(" ");
}

/** Retourne true si la description stockée correspond à une description auto-générée */
export function isAutoDescription(form: DevisFormData): boolean {
  return form.prestationDescription === buildAutoDescription(form);
}
