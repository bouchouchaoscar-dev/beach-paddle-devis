// Server-only — imported exclusively in /api/generate-pdf.
// Do NOT import in any "use client" component.
import React from "react";
import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
} from "@react-pdf/renderer";
import type { DevisFormData, CalculationResult, DocumentType } from "@/lib/types";
import { formatPrice } from "@/lib/calculations";
import { ACTIVITY_LABELS, DURATION_LABELS } from "@/lib/pricing";

const TEAL = "#0071E3";
const RED = "#E03131";
const BLACK = "#1D1D1F";
const GRAY = "#6E6E73";
const LIGHT_GRAY = "#8E8E93";

export interface DevisDocumentProps {
  form: DevisFormData;
  calc: CalculationResult;
  numero: string;
  documentType: DocumentType;
  acompteVerse?: number;
  documentDate: string;
  logoBase64: string | null;
}

function activityDesc(activity: string, n: number, dur: string, heure: string): string {
  const t = heure ? `, à partir de ${heure}` : "";
  if (activity === "paddle")
    return `Mise à disposition de Paddles, leash, pagaies et gilets de sauvetage pour ${n} personnes — ${dur}${t}`;
  if (activity === "kayak")
    return `Mise à disposition de Kayaks, pagaies et gilets de sauvetage pour ${n} personnes — ${dur}${t}`;
  if (activity === "hybride")
    return `Mise à disposition de Paddles, Kayaks, leash, pagaies et gilets de sauvetage pour ${n} personnes — ${dur}${t}`;
  return "";
}

const s = StyleSheet.create({
  page: {
    flexDirection: "column",
    backgroundColor: "#ffffff",
    paddingTop: "12mm",
    paddingLeft: "14mm",
    paddingRight: "14mm",
    paddingBottom: "16mm",
    fontFamily: "Helvetica",
    fontSize: 10,
    color: BLACK,
  },

  // ── HEADER ────────────────────────────────────────────
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "6mm",
    paddingBottom: "5mm",
    borderBottomWidth: 2,
    borderBottomColor: TEAL,
    borderBottomStyle: "solid",
  },
  headerLeft: { flexDirection: "column", flex: 1 },
  numero: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: GRAY,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: "1mm",
  },
  brandName: {
    fontSize: 26,
    fontFamily: "Helvetica-Bold",
    color: BLACK,
    marginBottom: "2.5mm",
  },
  addrLine: { fontSize: 9, color: GRAY, lineHeight: 1.6 },
  siret: { fontSize: 7.5, color: LIGHT_GRAY, marginTop: "1mm" },
  headerRight: { flexDirection: "column", alignItems: "flex-end" },
  logo: { width: "26mm", height: "26mm", objectFit: "contain", marginBottom: "3mm" },
  docType: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: TEAL,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: "2mm",
  },
  docDate: { fontSize: 9, color: GRAY },

  // ── CLIENT BLOCK ──────────────────────────────────────
  clientBlock: {
    flexDirection: "row",
    marginBottom: "6mm",
    paddingTop: "5mm",
    paddingBottom: "5mm",
    paddingLeft: "6mm",
    paddingRight: "6mm",
    backgroundColor: "#F8F8F8",
    borderBottomWidth: 1.5,
    borderBottomColor: "#E0E0E0",
    borderBottomStyle: "solid",
  },
  clientLeft: { flexDirection: "column", flex: 3, marginRight: "6mm" },
  clientRight: { flexDirection: "column", flex: 2, alignItems: "flex-end" },
  blockLabel: {
    fontSize: 6.5,
    fontFamily: "Helvetica-Bold",
    color: GRAY,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: "2mm",
  },
  clientDesc: {
    fontSize: 9,
    color: TEAL,
    fontFamily: "Helvetica-Oblique",
    lineHeight: 1.55,
  },
  clientName: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: BLACK,
    textAlign: "right",
  },
  clientAddr: { fontSize: 9, color: GRAY, marginTop: "1.5mm", textAlign: "right" },

  // ── TABLE HEADER ──────────────────────────────────────
  tableHead: {
    flexDirection: "row",
    paddingTop: "2mm",
    paddingBottom: "2mm",
    paddingLeft: "3mm",
    paddingRight: "3mm",
    backgroundColor: "#F0F0F5",
    borderRadius: 2,
    marginBottom: "2mm",
  },
  thCell: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: GRAY,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },

  // ── SECTION ───────────────────────────────────────────
  section: { marginBottom: "3mm" },
  sectionTitle: {
    paddingTop: "4mm",
    paddingBottom: "1.5mm",
    borderBottomWidth: 1,
    borderBottomColor: "#C5DFFF",
    borderBottomStyle: "solid",
    marginBottom: "1.5mm",
    alignItems: "center",
  },
  sectionTitleTxt: {
    textAlign: "center",
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: TEAL,
    letterSpacing: 1,
    textTransform: "uppercase",
    textDecoration: "underline",
  },
  row: {
    flexDirection: "row",
    paddingLeft: "3mm",
    paddingRight: "3mm",
    paddingTop: "1.5mm",
    paddingBottom: "1.5mm",
  },
  rowLbl: { fontSize: 9, fontFamily: "Helvetica-Bold", color: TEAL, marginBottom: "0.5mm" },
  rowDsc: { fontSize: 9, color: GRAY, fontFamily: "Helvetica-Oblique" },
  rowVal: { fontSize: 9, fontFamily: "Helvetica-Bold", color: BLACK },

  // ── TOTALS ────────────────────────────────────────────
  totals: {
    marginTop: "3mm",
    borderTopWidth: 2,
    borderTopColor: "#D2D2D7",
    borderTopStyle: "solid",
    paddingTop: "3mm",
  },
  totalLine: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingLeft: "3mm",
    paddingRight: "3mm",
    paddingTop: "1mm",
    paddingBottom: "1mm",
  },
  totalLbl: { fontSize: 9, color: GRAY, marginRight: "5mm" },
  totalVal: { fontSize: 9, fontFamily: "Helvetica-Bold", minWidth: "22mm", textAlign: "right" },
  remiseBlock: {
    marginTop: "2mm",
    marginBottom: "2mm",
    paddingTop: "3mm",
    paddingBottom: "3mm",
    paddingLeft: "3mm",
    paddingRight: "3mm",
    backgroundColor: "#FFF5F5",
    borderRadius: 2,
    borderLeftWidth: 3,
    borderLeftColor: RED,
    borderLeftStyle: "solid",
  },
  remiseTitleTxt: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: RED,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: "1.5mm",
  },
  remiseLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: "0.5mm",
  },
  remiseTxt: { fontSize: 8.5, color: RED },
  remiseTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: "1mm",
    paddingTop: "1mm",
    borderTopWidth: 1,
    borderTopColor: "#F8C8C8",
    borderTopStyle: "solid",
  },
  totalNetBox: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    paddingTop: "2mm",
    paddingBottom: "2mm",
    paddingLeft: "3mm",
    paddingRight: "3mm",
    backgroundColor: "#EBF4FF",
    borderRadius: 2,
    borderWidth: 1.5,
    borderColor: TEAL,
    borderStyle: "solid",
    marginTop: "2mm",
  },
  totalNetLbl: { fontSize: 10, fontFamily: "Helvetica-Bold", color: BLACK, marginRight: "5mm" },
  totalNetVal: { fontSize: 12, fontFamily: "Helvetica-Bold", color: BLACK, minWidth: "28mm", textAlign: "right" },
  acompteRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingLeft: "3mm",
    paddingRight: "3mm",
    paddingTop: "1.5mm",
    paddingBottom: "1.5mm",
  },
  acompteLbl: { fontSize: 9, color: GRAY },
  acompteVal: { fontSize: 9, fontFamily: "Helvetica-Bold", color: GRAY },

  // ── FOOTER ────────────────────────────────────────────
  spacer: { flexGrow: 1, minHeight: "8mm" },
  footer: {
    flexDirection: "row",
    paddingTop: "8mm",
    borderTopWidth: 1,
    borderTopColor: "#D2D2D7",
    borderTopStyle: "solid",
  },
  footerLeft: { flexDirection: "column", flex: 1, marginRight: "6mm" },
  footerAsso: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: TEAL,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: "1.5mm",
  },
  footerRibLbl: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: LIGHT_GRAY,
    marginTop: "3mm",
    marginBottom: "2mm",
  },
  footerGray: { fontSize: 7.5, color: GRAY, lineHeight: 1.7 },
  footerRight: { flexDirection: "column", flex: 1 },
  sigBox: {
    paddingTop: "4mm",
    paddingBottom: "4mm",
    paddingLeft: "5mm",
    paddingRight: "5mm",
    borderWidth: 1,
    borderColor: "#D2D2D7",
    borderStyle: "solid",
    borderRadius: 2,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: "2.5mm",
    minHeight: "14mm",
  },
  sigTxt: { fontSize: 9, color: GRAY, textAlign: "center", lineHeight: 1.6 },
  sigBold: { fontSize: 9, fontFamily: "Helvetica-Bold", color: BLACK, textAlign: "center" },
  acompteBox: {
    paddingTop: "4mm",
    paddingBottom: "4mm",
    paddingLeft: "5mm",
    paddingRight: "5mm",
    borderWidth: 1.5,
    borderColor: "#F0A0A0",
    borderStyle: "solid",
    borderRadius: 2,
    alignItems: "center",
    justifyContent: "center",
    minHeight: "14mm",
    backgroundColor: "#FFF5F5",
  },
  acompteBoxTxt: {
    fontSize: 9,
    color: RED,
    fontFamily: "Helvetica-BoldOblique",
    textAlign: "center",
    lineHeight: 1.6,
  },
});

export function DevisDocument({
  form, calc, numero, documentType, acompteVerse, documentDate, logoBase64,
}: DevisDocumentProps) {
  const n = form.participantsCount;
  const isFacture = documentType === "facture";
  const hasDiscount = calc.totalDiscount > 0;

  const dateFormatted = documentDate
    ? new Date(documentDate + "T12:00:00").toLocaleDateString("fr-FR", {
        day: "2-digit", month: "long", year: "numeric",
      })
    : "";

  const clientLabel =
    form.clientType === "entreprise" ? "SOCIÉTÉ" :
    form.clientType === "loisirs" ? "SERVICE JEUNESSE" : "ÉTABLISSEMENT";

  const discountLabel =
    form.clientType === "entreprise"
      ? "REMISE EXCEPTIONNELLE GROUPE ENTREPRISE"
      : form.clientType === "scolaire"
      ? "REMISE EXCEPTIONNELLE ÉTABLISSEMENT SCOLAIRE"
      : "REMISE EXCEPTIONNELLE SERVICE JEUNESSE";

  return (
    <Document>
      <Page size="A4" style={s.page}>

        {/* ── HEADER ── */}
        <View style={s.header}>
          <View style={s.headerLeft}>
            <Text style={s.numero}>{numero}</Text>
            <Text style={s.brandName}>BEACH PADDLE</Text>
            <Text style={s.addrLine}>86 ter, rue de Verdun</Text>
            <Text style={s.addrLine}>94500 Champigny sur Marne</Text>
            <Text style={s.addrLine}>06 46 86 04 26 — oscar@beachpaddle.fr</Text>
            <Text style={s.siret}>SIRET : 84118702400010</Text>
          </View>
          <View style={s.headerRight}>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            {logoBase64 ? <Image src={logoBase64} style={s.logo} /> : null}
            <Text style={s.docType}>{isFacture ? "FACTURE" : "DEVIS"}</Text>
            <Text style={s.docDate}>{dateFormatted}</Text>
          </View>
        </View>

        {/* ── CLIENT BLOCK ── */}
        <View style={s.clientBlock}>
          <View style={s.clientLeft}>
            <Text style={s.blockLabel}>Pour</Text>
            <Text style={s.clientDesc}>{form.prestationDescription || "—"}</Text>
          </View>
          <View style={s.clientRight}>
            <Text style={s.blockLabel}>{clientLabel}</Text>
            <Text style={s.clientName}>{form.clientName || "—"}</Text>
            {form.clientAddress ? <Text style={s.clientAddr}>{form.clientAddress}</Text> : null}
          </View>
        </View>

        {/* ── TABLE HEADER ── */}
        <View style={s.tableHead}>
          <Text style={[s.thCell, { flex: 1 }]}>Description</Text>
          <Text style={[s.thCell, { width: "28mm", textAlign: "center" }]}>Prix / pers.</Text>
          <Text style={[s.thCell, { width: "28mm", textAlign: "center" }]}>Nb pers.</Text>
          <Text style={[s.thCell, { width: "30mm", textAlign: "right" }]}>Sous-total</Text>
        </View>

        {/* ── ACTIVITÉ ── */}
        {form.activity !== "none" && (
          <View style={s.section}>
            <View style={s.sectionTitle}>
              <Text style={s.sectionTitleTxt}>
                ACTIVITÉ {(ACTIVITY_LABELS[form.activity] || form.activity).toUpperCase()}
              </Text>
            </View>
            <View style={s.row}>
              <View style={{ flex: 1 }}>
                <Text style={s.rowLbl}>
                  {ACTIVITY_LABELS[form.activity]} — {DURATION_LABELS[form.duration]}
                </Text>
                <Text style={s.rowDsc}>
                  {activityDesc(form.activity, n, DURATION_LABELS[form.duration], form.heureDebut)}
                </Text>
              </View>
              <Text style={[s.rowVal, { width: "28mm", textAlign: "center" }]}>
                {formatPrice(calc.activityPricePerPerson)}
              </Text>
              <Text style={[s.rowVal, { width: "28mm", textAlign: "center" }]}>{n}</Text>
              <Text style={[s.rowVal, { width: "30mm", textAlign: "right" }]}>
                {formatPrice(calc.activitySubtotal)}
              </Text>
            </View>
            {form.coach.enabled && calc.coachSubtotal > 0 && (
              <View style={s.row}>
                <Text style={[s.rowLbl, { flex: 1 }]}>
                  {form.coach.description || "Coach Beach Paddle"} — pour encadrer les participants
                </Text>
                <Text style={[s.rowVal, { width: "30mm", textAlign: "right" }]}>
                  {formatPrice(calc.coachSubtotal)}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* ── SNACKING ── */}
        {form.snackingItems.map((item) => {
          const price = item.pricePerPerson !== null ? item.pricePerPerson : (item.manualPrice ?? 0);
          const subtotal = price * n;
          const title =
            item.formula === "dejeuner" || item.formula === "dejeuner-gouter" ? "DÉJEUNER" :
            item.formula === "gouter" ? "GOÛTER" :
            item.formula === "apero" ? "APÉRITIF" : "PRESTATION COMPLÉMENTAIRE";
          return (
            <View key={item.id} style={s.section}>
              <View style={s.sectionTitle}>
                <Text style={s.sectionTitleTxt}>{title}</Text>
              </View>
              <View style={s.row}>
                <View style={{ flex: 1 }}>
                  <Text style={s.rowLbl}>{item.label}</Text>
                  {item.description ? <Text style={s.rowDsc}>{item.description}</Text> : null}
                </View>
                <Text style={[s.rowVal, { width: "28mm", textAlign: "center" }]}>
                  {formatPrice(price)}
                </Text>
                <Text style={[s.rowVal, { width: "28mm", textAlign: "center" }]}>{n}</Text>
                <Text style={[s.rowVal, { width: "30mm", textAlign: "right" }]}>
                  {formatPrice(subtotal)}
                </Text>
              </View>
            </View>
          );
        })}

        {/* ── TOTAUX ── */}
        <View style={s.totals} wrap={false}>
          <View style={s.totalLine}>
            <Text style={s.totalLbl}>TOTAL :</Text>
            <Text style={s.totalVal}>{formatPrice(calc.totalBrut)}</Text>
          </View>

          {hasDiscount && (
            <View style={s.remiseBlock}>
              <Text style={s.remiseTitleTxt}>{discountLabel}</Text>
              {calc.accompagnatorsCost > 0 && (
                <View style={s.remiseLine}>
                  <Text style={s.remiseTxt}>
                    Offert pour {form.discount.accompagnatorsCount} accompagnateur
                    {form.discount.accompagnatorsCount > 1 ? "s" : ""}
                  </Text>
                  <Text style={s.remiseTxt}>-{formatPrice(calc.accompagnatorsCost)}</Text>
                </View>
              )}
              {calc.extraDiscountAmount > 0 && (
                <View style={s.remiseLine}>
                  <Text style={s.remiseTxt}>
                    {form.discount.extraDiscountRate}% de remise supplémentaire
                  </Text>
                  <Text style={s.remiseTxt}>-{formatPrice(calc.extraDiscountAmount)}</Text>
                </View>
              )}
              {calc.discountAmount > 0 && (
                <View style={s.remiseLine}>
                  <Text style={s.remiseTxt}>Remise groupe {form.discount.discountRate}%</Text>
                  <Text style={s.remiseTxt}>-{formatPrice(calc.discountAmount)}</Text>
                </View>
              )}
              <View style={s.remiseTotalRow}>
                <Text style={[s.remiseTxt, { fontFamily: "Helvetica-Bold" }]}>
                  Remise totale {calc.totalDiscountRateIsExact ? "=" : "≈"} {calc.totalDiscountRate}%
                </Text>
                <Text style={[s.remiseTxt, { fontFamily: "Helvetica-Bold" }]}>
                  -{formatPrice(calc.totalDiscount)}
                </Text>
              </View>
            </View>
          )}

          <View style={s.totalNetBox}>
            <Text style={s.totalNetLbl}>{hasDiscount ? "TOTAL AVEC REMISE :" : "TOTAL :"}</Text>
            <Text style={s.totalNetVal}>{formatPrice(calc.totalNet)}</Text>
          </View>

          {isFacture && acompteVerse !== undefined && acompteVerse > 0 && (
            <>
              <View style={s.acompteRow}>
                <Text style={s.acompteLbl}>Acompte déjà versé :</Text>
                <Text style={s.acompteVal}>-{formatPrice(acompteVerse)}</Text>
              </View>
              <View style={[s.totalNetBox, { marginTop: 4, marginBottom: 8 }]}>
                <Text style={s.totalNetLbl}>RESTANT DÛ :</Text>
                <Text style={s.totalNetVal}>{formatPrice(calc.totalNet - acompteVerse)}</Text>
              </View>
            </>
          )}
        </View>

        {/* Spacer pousse le footer vers le bas sur les documents courts */}
        <View style={s.spacer} />

        {/* ── FOOTER ── */}
        <View style={s.footer} wrap={false}>
          <View style={s.footerLeft}>
            <Text style={s.footerAsso}>Association loi 1901, non assujettie à la TVA</Text>
            <Text style={s.footerRibLbl}>Coordonnées bancaires</Text>
            <Text style={s.footerGray}>IBAN : FR14 2004 1000 0168 5155 3W02 021</Text>
            <Text style={s.footerGray}>BIC : PSSTFRPPPAR</Text>
            <Text style={s.footerGray}>La Banque Postale — 75900 Paris Cedex 15</Text>
          </View>
          <View style={s.footerRight}>
            <View style={s.sigBox}>
              <Text style={s.sigTxt}>
                Date, signature et tampon, précédés de la mention
              </Text>
              <Text style={s.sigBold}>BON POUR ACCORD</Text>
            </View>
            {!isFacture && (
              <View style={s.acompteBox}>
                <Text style={s.acompteBoxTxt}>
                  Afin de valider la réservation, un acompte de 30% sera nécessaire.
                </Text>
              </View>
            )}
          </View>
        </View>

      </Page>
    </Document>
  );
}
