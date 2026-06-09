"use client";

import type { DevisFormData, CalculationResult, DocumentType } from "@/lib/types";
import { formatPrice } from "@/lib/calculations";
import { ACTIVITY_LABELS, DURATION_LABELS } from "@/lib/pricing";

interface Props {
  form: DevisFormData;
  calc: CalculationResult;
  numero: string;
  documentType: DocumentType;
  acompteVerse?: number;
  documentDate?: string; // YYYY-MM-DD, date de génération (today)
}

const TEAL = "#0071E3";
const ORANGE = "#0071E3";
const RED = "#E03131";
const BLACK = "#1D1D1F";
const GRAY = "#6E6E73";

function formatH(h: string): string {
  const [hh, mm] = h.split(":");
  return !mm || mm === "00" ? `${parseInt(hh)}h` : `${parseInt(hh)}h${mm}`;
}

function getActivityDescription(
  activity: string,
  n: number,
  durationLabel: string,
  heureDebut: string
): string {
  const time = heureDebut ? `, à partir de ${formatH(heureDebut)}` : "";
  if (activity === "paddle") {
    return `Mise à disposition de Paddles, leash, pagaies et gilets de sauvetage pour ${n} personnes — ${durationLabel}${time}`;
  }
  if (activity === "kayak") {
    return `Mise à disposition de Kayaks, pagaies et gilets de sauvetage pour ${n} personnes — ${durationLabel}${time}`;
  }
  if (activity === "hybride") {
    return `Mise à disposition de Paddles, Kayaks, leash, pagaies et gilets de sauvetage pour ${n} personnes — ${durationLabel}${time}`;
  }
  return "";
}

export function DocumentTemplate({
  form,
  calc,
  numero,
  documentType,
  acompteVerse,
  documentDate,
}: Props) {
  const n = form.participantsCount;
  const isFacture = documentType === "facture";
  const hasDiscount = calc.totalDiscount > 0;

  const displayDate = documentDate ?? form.date;
  const dateFormatted = displayDate
    ? new Date(displayDate + "T12:00:00").toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : "";

  const clientLabel =
    form.clientType === "entreprise"
      ? "SOCIÉTÉ"
      : form.clientType === "loisirs"
      ? "SERVICE JEUNESSE"
      : "ÉTABLISSEMENT";
  const discountLabel =
    form.clientType === "entreprise"
      ? "REMISE EXCEPTIONNELLE GROUPE ENTREPRISE"
      : form.clientType === "scolaire"
      ? "REMISE EXCEPTIONNELLE ÉTABLISSEMENT SCOLAIRE"
      : "REMISE EXCEPTIONNELLE SERVICE JEUNESSE";

  return (
    <div
      id="document-template"
      style={{
        width: "210mm",
        minHeight: "297mm",
        backgroundColor: "white",
        fontFamily: "'Outfit', 'Segoe UI', Arial, sans-serif",
        color: BLACK,
        padding: "12mm 14mm 16mm",
        fontSize: "10pt",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* ── HEADER ──────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "6mm",
          paddingBottom: "5mm",
          borderBottom: `2px solid ${ORANGE}`,
        }}
      >
        {/* Left: info société */}
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: "7.5pt",
              fontWeight: 700,
              color: GRAY,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              marginBottom: "1mm",
            }}
          >
            {numero}
          </div>
          <div
            style={{
              fontSize: "26pt",
              fontWeight: 800,
              color: "#1D1D1F",
              letterSpacing: "-0.01em",
              lineHeight: 1.1,
              marginBottom: "3mm",
            }}
          >
            BEACH PADDLE
          </div>
          <div style={{ fontSize: "9pt", color: GRAY, lineHeight: 1.6 }}>
            <div>86 ter, rue de Verdun</div>
            <div>94500 Champigny sur Marne</div>
            <div>06 46 86 04 26 — oscar@beachpaddle.fr</div>
            <div style={{ color: "#8E8E93", fontSize: "7.5pt" }}>
              SIRET : 84118702400010
            </div>
          </div>
        </div>

        {/* Right: logo + doc type */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "3mm" }}>
          <div style={{ width: "28mm", height: "28mm", position: "relative", marginTop: "-4mm" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.png"
              alt="Beach Paddle"
              style={{ width: "100%", height: "100%", objectFit: "contain" }}
            />
          </div>
          <div
            style={{
              fontSize: "13pt",
              fontWeight: 800,
              color: isFacture ? TEAL : ORANGE,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            {isFacture ? "FACTURE" : "DEVIS"}
          </div>
          <div style={{ fontSize: "9pt", color: GRAY }}>
            {dateFormatted}
          </div>
        </div>
      </div>

      {/* ── BLOC CLIENT ─────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "6mm",
          marginBottom: "6mm",
          padding: "5mm 6mm",
          backgroundColor: "#F8F8F8",
          borderBottom: "1.5px solid #E0E0E0",
        }}
      >
        {/* Colonne gauche — Pour (60%) */}
        <div style={{ flex: "0 0 60%", maxWidth: "60%" }}>
          <div
            style={{
              fontSize: "6.5pt",
              fontWeight: 700,
              color: GRAY,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              marginBottom: "2mm",
            }}
          >
            Pour
          </div>
          <div
            style={{
              fontSize: "9pt",
              color: TEAL,
              fontStyle: "italic",
              lineHeight: 1.55,
            }}
          >
            {form.prestationDescription || "—"}
          </div>
        </div>

        {/* Colonne droite — Client (40%) */}
        <div style={{ flex: "0 0 calc(40% - 6mm)", textAlign: "right" }}>
          <div
            style={{
              fontSize: "6.5pt",
              fontWeight: 700,
              color: GRAY,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              marginBottom: "2mm",
            }}
          >
            {clientLabel}
          </div>
          <div
            style={{
              fontSize: "13pt",
              fontWeight: 800,
              color: BLACK,
              lineHeight: 1.2,
              wordBreak: "break-word",
            }}
          >
            {form.clientName || "—"}
          </div>
          {form.clientAddress && (
            <div style={{ fontSize: "9pt", color: GRAY, marginTop: "1.5mm", lineHeight: 1.4 }}>
              {form.clientAddress}
            </div>
          )}
        </div>
      </div>

      {/* ── TABLEAU DESCRIPTION ─────────────────────────── */}
      <div style={{ flex: 1, marginBottom: "5mm" }}>
        {/* Table header */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 28mm 28mm 30mm",
            gap: "2mm",
            padding: "2mm 3mm",
            backgroundColor: "#F0F0F5",
            borderRadius: "2mm",
            fontSize: "7.5pt",
            fontWeight: 700,
            color: GRAY,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            marginBottom: "2mm",
          }}
        >
          <span>Description</span>
          <span style={{ textAlign: "center" }}>Prix / pers.</span>
          <span style={{ textAlign: "center" }}>Nb pers.</span>
          <span style={{ textAlign: "right" }}>Sous-total</span>
        </div>

        {/* Activity row */}
        {form.activity !== "none" && (
          <div style={{ marginBottom: "3mm" }}>
            {/* Section title — correction 1: espace au-dessus + soulignement */}
            <div
              style={{
                textAlign: "center",
                fontSize: "9pt",
                fontWeight: 800,
                color: TEAL,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                padding: "4mm 0 1.5mm 0",
                borderBottom: `1px solid ${TEAL}20`,
                marginBottom: "1.5mm",
                textDecoration: "underline",
                textDecorationColor: TEAL,
              }}
            >
              ACTIVITÉ {ACTIVITY_LABELS[form.activity].toUpperCase()}
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 28mm 28mm 30mm",
                gap: "2mm",
                padding: "1.5mm 3mm",
                alignItems: "start",
              }}
            >
              {/* correction 6: deux lignes — nom+durée en bleu gras, description en gris italique */}
              <div>
                <div style={{ color: TEAL, fontWeight: 700, fontSize: "9pt" }}>
                  {ACTIVITY_LABELS[form.activity]} — {DURATION_LABELS[form.duration]}
                </div>
                <div style={{ color: GRAY, fontStyle: "italic", fontSize: "9pt", marginTop: "0.5mm" }}>
                  {getActivityDescription(form.activity, n, DURATION_LABELS[form.duration], form.heureDebut)}
                </div>
              </div>
              {/* correction 2: supprimer le soulignement sur prix et nb pers */}
              <div style={{ textAlign: "center" }}>
                <span style={{ fontSize: "9pt", fontWeight: 700, color: BLACK }}>
                  {formatPrice(calc.activityPricePerPerson)}
                </span>
              </div>
              <div style={{ textAlign: "center" }}>
                <span style={{ fontSize: "9pt", fontWeight: 700, color: BLACK }}>
                  {n}
                </span>
              </div>
              <div style={{ textAlign: "right", fontSize: "9pt", fontWeight: 700, color: BLACK }}>
                {formatPrice(calc.activitySubtotal)}
              </div>
            </div>

            {/* Coach — forfait fixe, ligne pleine largeur */}
            {form.coach.enabled && calc.coachSubtotal > 0 && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "1.5mm 3mm",
                  gap: "4mm",
                }}
              >
                <span style={{ color: TEAL, fontWeight: 700, fontSize: "9pt", flex: 1 }}>
                  {form.coach.description || "Coach Beach Paddle"} — pour encadrer les participants
                </span>
                <div style={{ textAlign: "right", fontSize: "9pt", fontWeight: 700, color: BLACK, whiteSpace: "nowrap" }}>
                  {formatPrice(calc.coachSubtotal)}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Snacking rows */}
        {form.snackingItems.map((item) => {
          const price =
            item.pricePerPerson !== null
              ? item.pricePerPerson
              : (item.manualPrice ?? 0);
          const subtotal = price * n;
          const sectionTitle =
            item.formula === "dejeuner"
              ? "DÉJEUNER"
              : item.formula === "gouter"
              ? "GOÛTER"
              : item.formula === "apero"
              ? "APÉRITIF"
              : "PRESTATION COMPLÉMENTAIRE";

          return (
            <div key={item.id} style={{ marginBottom: "3mm" }}>
              {/* Section title — correction 1: espace au-dessus + soulignement */}
              <div
                style={{
                  textAlign: "center",
                  fontSize: "9pt",
                  fontWeight: 800,
                  color: TEAL,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  padding: "4mm 0 1.5mm 0",
                  borderBottom: `1px solid ${TEAL}20`,
                  marginBottom: "1.5mm",
                  textDecoration: "underline",
                  textDecorationColor: TEAL,
                }}
              >
                {sectionTitle}
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 28mm 28mm 30mm",
                  gap: "2mm",
                  padding: "1.5mm 3mm",
                  alignItems: "start",
                }}
              >
                <div>
                  <div style={{ color: TEAL, fontWeight: 700, fontSize: "9pt" }}>
                    {item.label}
                  </div>
                  {item.description && (
                    <div style={{ color: GRAY, fontSize: "9pt", marginTop: "0.5mm" }}>
                      {item.description}
                    </div>
                  )}
                </div>
                {/* correction 2: supprimer le soulignement sur prix et nb pers */}
                <div style={{ textAlign: "center" }}>
                  <span style={{ fontSize: "9pt", fontWeight: 700 }}>
                    {formatPrice(price)}
                  </span>
                </div>
                <div style={{ textAlign: "center" }}>
                  <span style={{ fontSize: "9pt", fontWeight: 700 }}>
                    {n}
                  </span>
                </div>
                <div style={{ textAlign: "right", fontSize: "9pt", fontWeight: 700 }}>
                  {formatPrice(subtotal)}
                </div>
              </div>
            </div>
          );
        })}

        {/* Totals */}
        <div
          style={{
            marginTop: "3mm",
            borderTop: `2px solid #D2D2D7`,
            paddingTop: "3mm",
          }}
        >
          {/* Sous-total brut */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "5mm",
              padding: "1mm 3mm",
              fontSize: "9pt",
            }}
          >
            <span style={{ color: GRAY }}>TOTAL :</span>
            <span style={{ fontWeight: 700, minWidth: "22mm", textAlign: "right" }}>
              {formatPrice(calc.totalBrut)}
            </span>
          </div>

          {/* Remise */}
          {hasDiscount && (
            <div
              style={{
                margin: "2mm 0",
                padding: "3mm",
                backgroundColor: "rgba(224,49,49,0.05)",
                borderRadius: "2mm",
                borderLeft: `3px solid ${RED}`,
              }}
            >
              <div
                style={{
                  fontSize: "7.5pt",
                  fontWeight: 700,
                  color: RED,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  marginBottom: "1.5mm",
                }}
              >
                {discountLabel}
              </div>

              {calc.accompagnatorsCost > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "8.5pt", color: RED, marginBottom: "0.5mm" }}>
                  <span>
                    Offert pour {form.discount.accompagnatorsCount} accompagnateur
                    {form.discount.accompagnatorsCount > 1 ? "s" : ""}
                  </span>
                  <span style={{ fontWeight: 700 }}>-{formatPrice(calc.accompagnatorsCost)}</span>
                </div>
              )}

              {calc.extraDiscountAmount > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "8.5pt", color: RED, marginBottom: "0.5mm" }}>
                  <span>{form.discount.extraDiscountRate}% de remise supplémentaire</span>
                  <span style={{ fontWeight: 700 }}>-{formatPrice(calc.extraDiscountAmount)}</span>
                </div>
              )}

              {calc.discountAmount > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "8.5pt", color: RED, marginBottom: "0.5mm" }}>
                  <span>Remise groupe {form.discount.discountRate}%</span>
                  <span style={{ fontWeight: 700 }}>-{formatPrice(calc.discountAmount)}</span>
                </div>
              )}

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "8.5pt",
                  color: RED,
                  fontWeight: 700,
                  marginTop: "1mm",
                  paddingTop: "1mm",
                  borderTop: `1px solid ${RED}30`,
                }}
              >
                <span>Remise totale {calc.totalDiscountRateIsExact ? "=" : "≈"} {calc.totalDiscountRate}%</span>
                <span>-{formatPrice(calc.totalDiscount)}</span>
              </div>
            </div>
          )}

          {/* Total net — correction 3: alignItems center pour aligner label et montant */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              alignItems: "center",
              gap: "5mm",
              padding: "2mm 3mm",
              backgroundColor: "rgba(0,113,227,0.04)",
              borderRadius: "2mm",
              border: `1.5px solid ${ORANGE}`,
              marginTop: "2mm",
            }}
          >
            <span
              style={{
                fontSize: "10pt",
                fontWeight: 800,
                color: "#1D1D1F",
                letterSpacing: "0.04em",
              }}
            >
              {hasDiscount ? "TOTAL AVEC REMISE :" : "TOTAL :"}
            </span>
            <span
              style={{
                fontSize: "12pt",
                fontWeight: 800,
                color: "#1D1D1F",
                minWidth: "28mm",
                textAlign: "right",
              }}
            >
              {formatPrice(calc.totalNet)}
            </span>
          </div>

          {/* Facture: acompte + restant dû */}
          {isFacture && acompteVerse !== undefined && acompteVerse > 0 && (
            <>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "1.5mm 3mm",
                  fontSize: "9pt",
                  color: GRAY,
                  marginTop: "1mm",
                }}
              >
                <span>Acompte déjà versé :</span>
                <span style={{ fontWeight: 700 }}>-{formatPrice(acompteVerse)}</span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  alignItems: "center",
                  gap: "5mm",
                  padding: "2mm 3mm",
                  backgroundColor: "rgba(0,113,227,0.04)",
                  borderRadius: "2mm",
                  border: `1.5px solid ${ORANGE}`,
                  marginTop: "2mm",
                  marginBottom: "6mm",
                }}
              >
                <span
                  style={{
                    fontSize: "10pt",
                    fontWeight: 800,
                    color: "#1D1D1F",
                    letterSpacing: "0.04em",
                  }}
                >
                  RESTANT DÛ :
                </span>
                <span
                  style={{
                    fontSize: "12pt",
                    fontWeight: 800,
                    color: "#1D1D1F",
                    minWidth: "28mm",
                    textAlign: "right",
                  }}
                >
                  {formatPrice(calc.totalNet - acompteVerse)}
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── FOOTER ──────────────────────────────────────── */}
      <div
        id="document-footer"
        style={{
          marginTop: "auto",
          paddingTop: "8mm",
          borderTop: `1px solid #D2D2D7`,
        }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6mm" }}>
          {/* Left: asso + RIB */}
          <div style={{ fontSize: "7.5pt", color: GRAY, lineHeight: 1.7 }}>
            <div
              style={{
                fontWeight: 700,
                color: TEAL,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: "1.5mm",
              }}
            >
              Association loi 1901, non assujettie à la TVA
            </div>
            <div style={{ color: "#8E8E93", fontWeight: 600, marginBottom: "0.5mm" }}>
              Coordonnées bancaires
            </div>
            <div>IBAN : FR14 2004 1000 0168 5155 3W02 021</div>
            <div>BIC : PSSTFRPPPAR</div>
            <div>La Banque Postale — 75900 Paris Cedex 15</div>
          </div>

          {/* Right: signature + acompte */}
          <div style={{ display: "flex", flexDirection: "column", gap: "2.5mm" }}>
            <div
              style={{
                fontSize: "9pt",
                color: GRAY,
                border: `1px solid #D2D2D7`,
                borderRadius: "2mm",
                padding: "4mm 5mm",
                lineHeight: 1.6,
                minHeight: "14mm",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
              }}
            >
              Date, signature et tampon, précédés de la mention{" "}
              <strong style={{ color: BLACK }}>&nbsp;BON POUR ACCORD</strong>
            </div>

            {!isFacture && (
              <div
                style={{
                  fontSize: "9pt",
                  color: RED,
                  fontStyle: "italic",
                  fontWeight: 700,
                  border: `1.5px solid ${RED}60`,
                  borderRadius: "2mm",
                  padding: "4mm 5mm",
                  backgroundColor: "rgba(224,49,49,0.04)",
                  lineHeight: 1.6,
                  minHeight: "14mm",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  textAlign: "center",
                }}
              >
                Afin de valider la réservation, un acompte de 30% sera nécessaire.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
