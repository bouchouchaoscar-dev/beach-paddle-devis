// Server-only — imported exclusively in /api/generate-pdf-libre.
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
import type { ClientType, FactureLibreLigne } from "@/lib/types";
import { formatPrice } from "@/lib/calculations";

function pricePdf(amount: number): string {
  return formatPrice(amount).replace(/[  ]/g, " ");
}

const TEAL = "#0071E3";
const BLACK = "#1D1D1F";
const GRAY = "#6E6E73";
const LIGHT_GRAY = "#8E8E93";

export interface FactureLibreDocumentProps {
  numero: string;
  date: string;
  clientType: ClientType;
  clientName: string;
  clientAddress?: string;
  objet?: string;
  lignes: FactureLibreLigne[];
  notes?: string;
  logoBase64: string | null;
  username?: string;
}

const CONTACT_BY_USER: Record<string, { phone: string; email: string }> = {
  oscar: { phone: "06 46 86 04 26", email: "oscar@beachpaddle.fr" },
  pascal: { phone: "07 60 83 98 30", email: "contact@beachpaddle.fr" },
};

const CLIENT_LABELS: Record<string, string> = {
  entreprise: "SOCIÉTÉ",
  association: "ASSOCIATION",
  scolaire: "ÉTABLISSEMENT",
  loisirs: "SERVICE JEUNESSE",
  organisme_public: "ORGANISME PUBLIC",
  particulier: "PARTICULIER",
};

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
  tableHead: {
    flexDirection: "row",
    paddingTop: "2mm",
    paddingBottom: "2mm",
    paddingLeft: "3mm",
    paddingRight: "3mm",
    backgroundColor: "#F0F0F5",
    borderRadius: 2,
    marginBottom: "1mm",
  },
  thCell: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: GRAY,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  row: {
    flexDirection: "row",
    paddingLeft: "3mm",
    paddingRight: "3mm",
    paddingTop: "3mm",
    paddingBottom: "3mm",
    borderBottomWidth: 0.5,
    borderBottomColor: "#E8E8ED",
    borderBottomStyle: "solid",
  },
  rowDsc: { fontSize: 9.5, color: BLACK, flex: 1 },
  rowVal: {
    fontSize: 9.5,
    fontFamily: "Helvetica-Bold",
    color: BLACK,
    width: "35mm",
    textAlign: "right",
  },
  totals: {
    marginTop: "4mm",
    borderTopWidth: 2,
    borderTopColor: "#D2D2D7",
    borderTopStyle: "solid",
    paddingTop: "3mm",
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
  totalNetLbl: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: BLACK,
    marginRight: "5mm",
  },
  totalNetVal: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: BLACK,
    minWidth: "28mm",
    textAlign: "right",
  },
  notesBlock: {
    marginTop: "5mm",
    paddingTop: "3mm",
    paddingBottom: "3mm",
    paddingLeft: "4mm",
    paddingRight: "4mm",
    backgroundColor: "#F8F8F8",
    borderRadius: 2,
  },
  notesLabel: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: GRAY,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: "1.5mm",
  },
  notesTxt: { fontSize: 9, color: GRAY, lineHeight: 1.6 },
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
    minHeight: "14mm",
  },
  sigBold: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: BLACK,
    textAlign: "center",
  },
});

export function FactureLibreDocument({
  numero, date, clientType, clientName, clientAddress, objet, lignes, notes, logoBase64, username,
}: FactureLibreDocumentProps) {
  const contact = CONTACT_BY_USER[username?.toLowerCase() ?? ""] ?? CONTACT_BY_USER["oscar"];
  const clientLabel = CLIENT_LABELS[clientType] ?? "CLIENT";

  const dateFormatted = date
    ? new Date(date + "T12:00:00").toLocaleDateString("fr-FR", {
        day: "2-digit", month: "long", year: "numeric",
      })
    : "";

  const totalNet = lignes.reduce((sum, l) => sum + l.montant, 0);

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
            <Text style={s.addrLine}>{contact.phone} — {contact.email}</Text>
            <Text style={s.siret}>SIRET : 84118702400010</Text>
          </View>
          <View style={s.headerRight}>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            {logoBase64 ? <Image src={logoBase64} style={s.logo} /> : null}
            <Text style={s.docType}>FACTURE</Text>
            <Text style={s.docDate}>{dateFormatted}</Text>
          </View>
        </View>

        {/* ── CLIENT BLOCK ── */}
        <View style={s.clientBlock}>
          <View style={s.clientLeft}>
            <Text style={s.blockLabel}>Objet</Text>
            <Text style={s.clientDesc}>{objet || "—"}</Text>
          </View>
          <View style={s.clientRight}>
            <Text style={s.blockLabel}>{clientLabel}</Text>
            <Text style={s.clientName}>{clientName || "—"}</Text>
            {clientAddress ? <Text style={s.clientAddr}>{clientAddress}</Text> : null}
          </View>
        </View>

        {/* ── TABLE HEADER ── */}
        <View style={s.tableHead}>
          <Text style={[s.thCell, { flex: 1 }]}>Description</Text>
          <Text style={[s.thCell, { width: "35mm", textAlign: "right" }]}>Montant</Text>
        </View>

        {/* ── LIGNES ── */}
        {lignes.map((ligne) => (
          <View key={ligne.id} style={s.row}>
            <Text style={s.rowDsc}>{ligne.description}</Text>
            <Text style={s.rowVal}>{pricePdf(ligne.montant)}</Text>
          </View>
        ))}

        {/* ── TOTAL ── */}
        <View style={s.totals} wrap={false}>
          <View style={s.totalNetBox}>
            <Text style={s.totalNetLbl}>TOTAL :</Text>
            <Text style={s.totalNetVal}>{pricePdf(totalNet)}</Text>
          </View>
        </View>

        {/* ── NOTES ── */}
        {notes ? (
          <View style={s.notesBlock}>
            <Text style={s.notesLabel}>Notes</Text>
            <Text style={s.notesTxt}>{notes}</Text>
          </View>
        ) : null}

        {/* Spacer */}
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
              <Text style={s.sigBold}>Date et signature</Text>
            </View>
          </View>
        </View>

      </Page>
    </Document>
  );
}
