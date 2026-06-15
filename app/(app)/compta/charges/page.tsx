"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  getCharges, saveCharge, updateCharge, deleteCharge,
  getEmployees, saveEmployee, updateEmployee, deleteEmployee,
  getWorkSessions, saveWorkSession, deleteWorkSession, updateWorkSessionPaye,
  getImmobilisations, saveImmobilisation, updateImmobilisation, deleteImmobilisation,
} from "@/lib/compta";
import { formatPrice } from "@/lib/calculations";
import {
  MOIS_FULL,
  CHARGE_LABELS, SAISONS,
  type Charge, type Employee, type WorkSession, type ChargeCategory,
  type Immobilisation,
  computeAmortissement, getDotationForYear, getMonthlyDotation,
} from "@/lib/compta-types";
import { useComptaSaison } from "../ComptaSaisonProvider";
import { NumericInput } from "@/components/ui/NumericInput";
import { DatePicker } from "@/components/ui/DatePicker";

const CATEGORIES: ChargeCategory[] = ["restauration_metro", "restauration_autre", "equipement", "salaire", "autre"];
const MODES_PAIEMENT = ["CB", "Espèces", "Virement", "Chèque"];

type Tab = "upload" | "manuel" | "employes" | "immobilisations";

type VirtualChargeRow = {
  id: string;
  isVirtual: true;
  immoNom: string;
  montant: number;
  date: string;
  categorie: "equipement";
  description: string;
};

interface ExtractedData {
  date?: string;
  montant_total?: number;
  fournisseur?: string;
  description?: string;
  categorie?: ChargeCategory;
  items?: { date?: string; montant_total?: number; fournisseur?: string; description?: string; categorie?: ChargeCategory }[];
}

const emptyChargeForm = () => ({
  date: new Date().toISOString().split("T")[0],
  montant: "",
  categorie: "autre" as ChargeCategory,
  fournisseur: "",
  description: "",
  mode_paiement: "CB",
  statut_paiement: "paye",
});

export default function ChargesPage() {
  const { saison, setSaison } = useComptaSaison();
  const [activeTab, setActiveTab] = useState<Tab>("employes");
  const [charges, setCharges] = useState<Charge[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [sessions, setSessions] = useState<WorkSession[]>([]);
  const [immobilisations, setImmobilisations] = useState<Immobilisation[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filterCat, setFilterCat] = useState<ChargeCategory | "all">("all");
  const [filterMois, setFilterMois] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [editingCharge, setEditingCharge] = useState<typeof charges[0] | null>(null);
  const [editForm, setEditForm] = useState({ date: "", montant: "", categorie: "autre" as ChargeCategory, fournisseur: "", description: "" });
  const [editSaving, setEditSaving] = useState(false);

  // Upload + AI
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [extracted, setExtracted] = useState<ExtractedData | null>(null);
  const [chargeForm, setChargeForm] = useState(emptyChargeForm());

  // Employee management
  const [newEmpNom, setNewEmpNom] = useState("");
  const [newEmpTarif, setNewEmpTarif] = useState("10");
  const [addingEmp, setAddingEmp] = useState(false);
  const [sessionPayeFilter, setSessionPayeFilter] = useState<"all" | "payees" | "non_payees">("all");
  const [togglingPayeId, setTogglingPayeId] = useState<string | null>(null);
  const [sessionForm, setSessionForm] = useState({
    employeeId: "",
    date: new Date().toISOString().split("T")[0],
    heureDebut: "",
    heureFin: "",
    heures: "",
    tarif: "",
    bonus: "0",
    notes: "",
  });
  const [viewingEmpId, setViewingEmpId] = useState<string | null>(null);
  const [deletingEmpId, setDeletingEmpId] = useState<string | null>(null);

  // Immobilisations
  const [immoForm, setImmoForm] = useState({
    nom: "",
    date_achat: new Date().toISOString().split("T")[0],
    montant_total: "",
    duree_amortissement: "3",
    fournisseur: "",
    description: "",
  });
  const [immoSaving, setImmoSaving] = useState(false);
  const [expandedImmoId, setExpandedImmoId] = useState<string | null>(null);
  const [editingImmo, setEditingImmo] = useState<Immobilisation | null>(null);
  const [editImmoForm, setEditImmoForm] = useState({
    nom: "",
    date_achat: "",
    montant_total: "",
    duree_amortissement: "3",
    fournisseur: "",
    description: "",
  });
  const [editImmoSaving, setEditImmoSaving] = useState(false);

  const isAll = saison === "all";

  const load = useCallback(async () => {
    setLoading(true);
    const [c, e, s, immo] = await Promise.all([
      getCharges(isAll ? undefined : saison),
      getEmployees(),
      getWorkSessions(isAll ? undefined : saison),
      getImmobilisations(),
    ]);
    setCharges(c);
    setEmployees(e);
    setSessions(s);
    setImmobilisations(immo);
    setLoading(false);
  }, [saison, isAll]);

  useEffect(() => { load(); }, [load]);

  // ── Upload & AI ────────────────────────────────────────────────────────────

  async function handleFileSelect(file: File) {
    setSelectedFile(file);
    setExtracted(null);
  }

  async function handleAnalyze() {
    if (!selectedFile) return;
    setAnalyzing(true);
    try {
      const reader = new FileReader();
      const base64: string = await new Promise((res) => {
        reader.onload = (e) => res((e.target!.result as string).split(",")[1]);
        reader.readAsDataURL(selectedFile);
      });
      const response = await fetch("/api/analyze-receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: base64, mimeType: selectedFile.type }),
      });
      const result = await response.json();

      if (result.error) throw new Error(result.error);

      // Route now returns { data: parsed, _raw: text }
      const parsed = result.data ?? result;
      const item = Array.isArray(parsed) ? parsed[0] : parsed;

      // Validate that at least some fields were extracted
      if (!item || (!item.montant_total && !item.fournisseur && !item.date)) {
        throw new Error("L'IA n'a pas pu extraire les données — vérifier la réponse brute ci-dessous");
      }

      setExtracted(parsed);
      setChargeForm({
        date: item.date ?? new Date().toISOString().split("T")[0],
        montant: String(item.montant_total ?? ""),
        categorie: item.categorie ?? "autre",
        fournisseur: item.fournisseur ?? "",
        description: item.description ?? "",
        mode_paiement: "CB",
        statut_paiement: "paye",
      });
    } catch (err) {
      setExtracted({ description: err instanceof Error ? err.message : "Erreur d'analyse — remplir manuellement" });
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleSaveCharge() {
    const montant = parseFloat(chargeForm.montant);
    if (!chargeForm.date || isNaN(montant)) return;
    setSaving(true);
    try {
      await saveCharge({
        date: chargeForm.date,
        montant,
        categorie: chargeForm.categorie,
        fournisseur: chargeForm.fournisseur || undefined,
        description: chargeForm.description || undefined,
        mode_paiement: chargeForm.mode_paiement,
        statut_paiement: chargeForm.statut_paiement,
        saison: chargeForm.date.slice(0, 4),
        created_by: "",
      });
      setChargeForm(emptyChargeForm());
      setSelectedFile(null);
      setExtracted(null);
      await load();
    } finally {
      setSaving(false);
    }
  }

  // ── Employees ──────────────────────────────────────────────────────────────

  async function handleAddEmployee() {
    if (!newEmpNom.trim()) return;
    setAddingEmp(true);
    try {
      await saveEmployee({
        nom: newEmpNom.trim(),
        tarif_horaire: parseFloat(newEmpTarif) || 10,
        actif: true,
        saison_debut: saison,
      });
      setNewEmpNom("");
      setNewEmpTarif("10");
      await load();
    } finally {
      setAddingEmp(false);
    }
  }

  async function handleDeleteEmployee(id: string) {
    await deleteEmployee(id);
    setDeletingEmpId(null);
    if (viewingEmpId === id) setViewingEmpId(null);
    await load();
  }

  function calcSessionHours(debut: string, fin: string): number {
    if (!debut || !fin) return 0;
    const [dh, dm] = debut.split(":").map(Number);
    const [fh, fm] = fin.split(":").map(Number);
    return Math.max(0, (fh * 60 + fm - (dh * 60 + dm)) / 60);
  }

  async function handleSaveSession() {
    const emp = employees.find((e) => e.id === sessionForm.employeeId);
    if (!emp || !sessionForm.date) return;
    let heures = parseFloat(sessionForm.heures);
    if (isNaN(heures) || heures <= 0) {
      heures = calcSessionHours(sessionForm.heureDebut, sessionForm.heureFin);
    }
    if (heures <= 0) return;
    const tarif = parseFloat(sessionForm.tarif) || emp.tarif_horaire;
    const bonus = parseFloat(sessionForm.bonus) || 0;
    const montant = heures * tarif + bonus;
    setSaving(true);
    try {
      await saveWorkSession({
        employee_id: emp.id,
        date: sessionForm.date,
        heure_debut: sessionForm.heureDebut || undefined,
        heure_fin: sessionForm.heureFin || undefined,
        heures,
        montant,
        bonus: bonus > 0 ? bonus : undefined,
        notes: sessionForm.notes || undefined,
        saison: sessionForm.date.slice(0, 4),
        created_by: "",
      });
      // Also create a charge entry for salary
      await saveCharge({
        date: sessionForm.date,
        montant,
        categorie: "salaire",
        fournisseur: emp.nom,
        description: `${heures}h — ${emp.nom}${bonus > 0 ? ` + ${bonus}€ bonus` : ""}`,
        saison: sessionForm.date.slice(0, 4),
        statut_paiement: "paye",
        created_by: "",
      });
      setSessionForm((f) => ({ ...f, heures: "", notes: "", heureDebut: "", heureFin: "", tarif: String(emp.tarif_horaire), bonus: "0" }));
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveImmo() {
    const montant = parseFloat(immoForm.montant_total);
    if (!immoForm.nom.trim() || !immoForm.date_achat || isNaN(montant)) return;
    setImmoSaving(true);
    try {
      await saveImmobilisation({
        nom: immoForm.nom.trim(),
        date_achat: immoForm.date_achat,
        montant_total: montant,
        duree_amortissement: parseInt(immoForm.duree_amortissement),
        methode: "lineaire",
        fournisseur: immoForm.fournisseur || undefined,
        description: immoForm.description || undefined,
        annee_achat: immoForm.date_achat.slice(0, 4),
        actif: true,
        created_by: "",
      });
      setImmoForm({ nom: "", date_achat: new Date().toISOString().split("T")[0], montant_total: "", duree_amortissement: "3", fournisseur: "", description: "" });
      await load();
    } finally { setImmoSaving(false); }
  }

  function openEditImmo(immo: Immobilisation) {
    setEditingImmo(immo);
    setEditImmoForm({
      nom: immo.nom,
      date_achat: immo.date_achat,
      montant_total: String(immo.montant_total),
      duree_amortissement: String(immo.duree_amortissement),
      fournisseur: immo.fournisseur ?? "",
      description: immo.description ?? "",
    });
  }

  async function handleUpdateImmo() {
    if (!editingImmo) return;
    const montant = parseFloat(editImmoForm.montant_total);
    if (!editImmoForm.nom.trim() || !editImmoForm.date_achat || isNaN(montant)) return;
    setEditImmoSaving(true);
    try {
      await updateImmobilisation(editingImmo.id, {
        nom: editImmoForm.nom.trim(),
        date_achat: editImmoForm.date_achat,
        montant_total: montant,
        duree_amortissement: parseInt(editImmoForm.duree_amortissement),
        fournisseur: editImmoForm.fournisseur || undefined,
        description: editImmoForm.description || undefined,
        annee_achat: editImmoForm.date_achat.slice(0, 4),
      });
      setEditingImmo(null);
      await load();
    } finally { setEditImmoSaving(false); }
  }

  function openEdit(c: typeof charges[0]) {
    setEditingCharge(c);
    setEditForm({ date: c.date, montant: String(c.montant), categorie: c.categorie, fournisseur: c.fournisseur ?? "", description: c.description ?? "" });
  }

  async function handleUpdateCharge() {
    if (!editingCharge) return;
    const montant = parseFloat(editForm.montant);
    if (!editForm.date || isNaN(montant)) return;
    setEditSaving(true);
    try {
      await updateCharge(editingCharge.id, {
        date: editForm.date, montant, categorie: editForm.categorie,
        fournisseur: editForm.fournisseur || undefined,
        description: editForm.description || undefined,
      });
      setEditingCharge(null);
      await load();
    } finally {
      setEditSaving(false);
    }
  }

  // ── Derived ────────────────────────────────────────────────────────────────

  const filteredCharges = charges.filter((c) => {
    const matchCat = filterCat === "all" || c.categorie === filterCat;
    const matchMois = filterMois === "all" || c.date.startsWith(filterMois);
    const q = searchQuery.trim().toLowerCase();
    const matchSearch = !q || (
      (c.fournisseur ?? "").toLowerCase().includes(q) ||
      (c.description ?? "").toLowerCase().includes(q) ||
      CHARGE_LABELS[c.categorie].toLowerCase().includes(q)
    );
    return matchCat && matchMois && matchSearch;
  });

  const virtualAmortRows: VirtualChargeRow[] = (() => {
    if (filterCat !== "all" && filterCat !== "equipement") return [];
    const activeImmos = immobilisations.filter((i) => i.actif);
    const q = searchQuery.trim().toLowerCase();

    return activeImmos.flatMap((immo): VirtualChargeRow[] => {
      if (q) {
        const matchSearch =
          immo.nom.toLowerCase().includes(q) ||
          (immo.fournisseur ?? "").toLowerCase().includes(q) ||
          "amortissement".includes(q) ||
          "équipement".includes(q) ||
          CHARGE_LABELS.equipement.toLowerCase().includes(q);
        if (!matchSearch) return [];
      }

      if (filterMois !== "all") {
        const year = parseInt(filterMois.slice(0, 4));
        const month = parseInt(filterMois.slice(5, 7));
        const monthly = getMonthlyDotation(immo, year, month);
        if (monthly === 0) return [];
        return [{ id: `virtual-${immo.id}-${filterMois}`, isVirtual: true, immoNom: immo.nom, montant: monthly, date: `${filterMois}-01`, categorie: "equipement", description: "Dotation mensuelle" }];
      } else if (!isAll) {
        const annual = getDotationForYear(immo, parseInt(saison));
        if (annual === 0) return [];
        return [{ id: `virtual-${immo.id}-${saison}`, isVirtual: true, immoNom: immo.nom, montant: annual, date: `${saison}-12-31`, categorie: "equipement", description: "Dotation annuelle" }];
      } else {
        const maxYear = new Date().getFullYear();
        let total = 0;
        for (let y = parseInt(immo.annee_achat); y <= maxYear; y++) total += getDotationForYear(immo, y);
        if (total === 0) return [];
        return [{ id: `virtual-${immo.id}-all`, isVirtual: true, immoNom: immo.nom, montant: total, date: `${maxYear}-06-01`, categorie: "equipement", description: "Amortissements cumulés" }];
      }
    });
  })();

  const displayCharges: (Charge | VirtualChargeRow)[] = [...filteredCharges, ...virtualAmortRows];
  const totalFiltered = displayCharges.reduce((s, c) => s + c.montant, 0);

  const sessionsByEmp = viewingEmpId
    ? sessions.filter((s) => s.employee_id === viewingEmpId)
    : [];
  const sessionsByEmpFiltered = sessionsByEmp.filter((s) => {
    if (sessionPayeFilter === "payees") return s.paye === true;
    if (sessionPayeFilter === "non_payees") return s.paye !== true;
    return true;
  });
  const viewingEmp = employees.find((e) => e.id === viewingEmpId);

  async function handleTogglePaye(sessionId: string, newPaye: boolean) {
    setTogglingPayeId(sessionId);
    try {
      await updateWorkSessionPaye(sessionId, newPaye);
      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, paye: newPaye } : s))
      );
    } catch (e) {
      console.warn("[paye] toggle error", e);
    } finally {
      setTogglingPayeId(null);
    }
  }

  const sessionHoursPreview = sessionForm.heureDebut && sessionForm.heureFin
    ? calcSessionHours(sessionForm.heureDebut, sessionForm.heureFin)
    : parseFloat(sessionForm.heures) || 0;
  const selectedEmp = employees.find((e) => e.id === sessionForm.employeeId);
  const sessionTarifPreview = parseFloat(sessionForm.tarif) || selectedEmp?.tarif_horaire || 0;
  const sessionBonusPreview = parseFloat(sessionForm.bonus) || 0;
  const sessionMontantPreview = sessionHoursPreview > 0 && selectedEmp
    ? sessionHoursPreview * sessionTarifPreview + sessionBonusPreview
    : 0;

  function fmtDate(d: string) {
    return new Date(d + "T12:00:00").toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">

      {/* ── Header ── */}
      <div
        className="flex items-center justify-between flex-wrap gap-3"
        style={{ opacity: 0, animation: "slideUp 0.4s cubic-bezier(0.16,1,0.3,1) 0.05s forwards" }}
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Charges &amp; Dépenses</h1>
          <p className="text-sm text-ink-secondary mt-0.5">Factures, tickets, salaires</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={saison}
            onChange={(e) => setSaison(e.target.value)}
            className="input-field !w-auto !py-1.5 !px-3 text-sm font-medium"
          >
            <option value="all">Toutes les saisons</option>
            {[...SAISONS].reverse().map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div
        className="flex items-center gap-0.5 p-1 bg-surface-muted rounded-xl border border-surface-border w-full sm:w-fit overflow-x-auto"
        style={{ opacity: 0, animation: "slideUp 0.4s cubic-bezier(0.16,1,0.3,1) 0.1s forwards" }}
      >
        {([
          { id: "employes", label: "Employés" },
          { id: "manuel", label: "Saisie manuelle" },
          { id: "upload", label: "Upload & IA" },
          { id: "immobilisations", label: "Immo." },
        ] as { id: Tab; label: string }[]).map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex-1 sm:flex-none whitespace-nowrap px-2.5 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 ${
              activeTab === t.id
                ? "bg-white shadow-soft text-brand-teal"
                : "text-ink-secondary hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab content ── */}
      <div style={{ opacity: 0, animation: "slideUp 0.4s cubic-bezier(0.16,1,0.3,1) 0.15s forwards" }}>

        {/* Upload & IA */}
        {activeTab === "upload" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Drop zone */}
            <div className="card p-5 space-y-4">
              <h2 className="text-sm font-semibold text-ink">Analyser un ticket / facture</h2>

              <div
                className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
                  dragOver
                    ? "border-brand-teal bg-brand-teal-light"
                    : "border-surface-border hover:border-brand-teal hover:bg-brand-teal-light/30"
                }`}
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  const f = e.dataTransfer.files[0];
                  if (f) handleFileSelect(f);
                }}
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }}
                />
                <div className="w-12 h-12 rounded-2xl bg-brand-teal-light flex items-center justify-center mx-auto mb-3">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0071E3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
                    <polyline points="21 15 16 10 5 21"/>
                  </svg>
                </div>
                {selectedFile ? (
                  <p className="text-sm font-medium text-ink">{selectedFile.name}</p>
                ) : (
                  <>
                    <p className="text-sm font-medium text-ink">Glisser une image ou PDF</p>
                    <p className="text-xs text-ink-muted mt-1">ou cliquer pour sélectionner</p>
                  </>
                )}
              </div>

              {selectedFile && (
                <button
                  onClick={handleAnalyze}
                  disabled={analyzing}
                  className="btn-primary w-full gap-2"
                  style={{ backgroundColor: "#0071E3" }}
                >
                  {analyzing ? (
                    <>
                      <svg className="animate-spin" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                      Analyse en cours…
                    </>
                  ) : (
                    <>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                      </svg>
                      Analyser avec l&apos;IA
                    </>
                  )}
                </button>
              )}

              {Array.isArray(extracted) && extracted.length > 1 && (
                <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
                  {extracted.length} tickets détectés — seul le premier est pré-rempli.
                </div>
              )}

            </div>

            {/* Pre-filled form */}
            <div className="card p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-ink">
                  {extracted
                    ? (extracted.description?.startsWith("L'IA") || extracted.description?.startsWith("Erreur")
                      ? extracted.description
                      : "Données extraites — vérifier avant sauvegarde")
                    : "Données de la dépense"}
                </h2>
                {extracted && (
                  <span className={`badge text-[10px] shrink-0 ${
                    extracted.description?.startsWith("L'IA") || extracted.description?.startsWith("Erreur")
                      ? "bg-red-100 text-red-700"
                      : "bg-green-100 text-green-700"
                  }`}>
                    IA
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Date</label>
                  <DatePicker value={chargeForm.date} onChange={(v) => setChargeForm((f) => ({ ...f, date: v }))} allowPast />
                </div>
                <div>
                  <label className="label">Montant (€)</label>
                  <div className="flex items-center gap-0">
                    <button type="button" onClick={() => setChargeForm((f) => ({ ...f, montant: String(Math.max(0, (parseFloat(f.montant) || 0) - 1)) }))} className="flex items-center justify-center w-9 h-9 rounded-l-xl border border-r-0 border-surface-border bg-surface-muted text-ink-secondary hover:bg-surface-border hover:text-ink transition-colors active:scale-95">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    </button>
                    <div className="relative flex-1">
                      <NumericInput inputMode="decimal" value={chargeForm.montant} min={0} step={1} placeholder="0" onChange={(e) => setChargeForm((f) => ({ ...f, montant: e.target.value }))} className="w-full h-9 border border-surface-border bg-white text-center text-sm font-bold font-mono text-ink outline-none pr-6 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-muted text-sm pointer-events-none">€</span>
                    </div>
                    <button type="button" onClick={() => setChargeForm((f) => ({ ...f, montant: String((parseFloat(f.montant) || 0) + 1) }))} className="flex items-center justify-center w-9 h-9 rounded-r-xl border border-l-0 border-surface-border bg-surface-muted text-ink-secondary hover:bg-surface-border hover:text-ink transition-colors active:scale-95">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="label">Catégorie</label>
                <select value={chargeForm.categorie} onChange={(e) => setChargeForm((f) => ({ ...f, categorie: e.target.value as ChargeCategory }))} className="input-field">
                  {CATEGORIES.map((c) => <option key={c} value={c}>{CHARGE_LABELS[c]}</option>)}
                </select>
              </div>

              <div>
                <label className="label">Fournisseur</label>
                <input type="text" value={chargeForm.fournisseur} placeholder="Métro, Carrefour…" onChange={(e) => setChargeForm((f) => ({ ...f, fournisseur: e.target.value }))} className="input-field" />
              </div>

              <div>
                <label className="label">Description</label>
                <input type="text" value={chargeForm.description} placeholder="Résumé des achats" onChange={(e) => setChargeForm((f) => ({ ...f, description: e.target.value }))} className="input-field" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Mode de paiement</label>
                  <select value={chargeForm.mode_paiement} onChange={(e) => setChargeForm((f) => ({ ...f, mode_paiement: e.target.value }))} className="input-field">
                    {MODES_PAIEMENT.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Statut</label>
                  <select value={chargeForm.statut_paiement} onChange={(e) => setChargeForm((f) => ({ ...f, statut_paiement: e.target.value }))} className="input-field">
                    <option value="paye">Payé</option>
                    <option value="en_attente">En attente</option>
                  </select>
                </div>
              </div>

              <button onClick={handleSaveCharge} disabled={saving || !chargeForm.montant} className="btn-primary w-full">
                {saving ? <svg className="animate-spin" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                Enregistrer la charge
              </button>
            </div>
          </div>
        )}

        {/* Saisie manuelle */}
        {activeTab === "manuel" && (
          <div className="card p-5 max-w-xl">
            <h2 className="text-sm font-semibold text-ink mb-4">Saisie manuelle d&apos;une charge</h2>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Date</label>
                  <DatePicker value={chargeForm.date} onChange={(v) => setChargeForm((f) => ({ ...f, date: v }))} allowPast />
                </div>
                <div>
                  <label className="label">Montant (€)</label>
                  <div className="flex items-center gap-0">
                    <button type="button" onClick={() => setChargeForm((f) => ({ ...f, montant: String(Math.max(0, (parseFloat(f.montant) || 0) - 1)) }))} className="flex items-center justify-center w-9 h-9 rounded-l-xl border border-r-0 border-surface-border bg-surface-muted text-ink-secondary hover:bg-surface-border hover:text-ink transition-colors active:scale-95">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    </button>
                    <div className="relative flex-1">
                      <NumericInput inputMode="decimal" value={chargeForm.montant} min={0} step={1} placeholder="0" onChange={(e) => setChargeForm((f) => ({ ...f, montant: e.target.value }))} className="w-full h-9 border border-surface-border bg-white text-center text-sm font-bold font-mono text-ink outline-none pr-6 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-muted text-sm pointer-events-none">€</span>
                    </div>
                    <button type="button" onClick={() => setChargeForm((f) => ({ ...f, montant: String((parseFloat(f.montant) || 0) + 1) }))} className="flex items-center justify-center w-9 h-9 rounded-r-xl border border-l-0 border-surface-border bg-surface-muted text-ink-secondary hover:bg-surface-border hover:text-ink transition-colors active:scale-95">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    </button>
                  </div>
                </div>
              </div>
              <div>
                <label className="label">Catégorie</label>
                <select value={chargeForm.categorie} onChange={(e) => setChargeForm((f) => ({ ...f, categorie: e.target.value as ChargeCategory }))} className="input-field">
                  {CATEGORIES.map((c) => <option key={c} value={c}>{CHARGE_LABELS[c]}</option>)}
                </select>
              </div>
              <div><label className="label">Fournisseur</label><input type="text" value={chargeForm.fournisseur} placeholder="Nom du fournisseur" onChange={(e) => setChargeForm((f) => ({ ...f, fournisseur: e.target.value }))} className="input-field" /></div>
              <div><label className="label">Description</label><input type="text" value={chargeForm.description} placeholder="Détail des achats" onChange={(e) => setChargeForm((f) => ({ ...f, description: e.target.value }))} className="input-field" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Mode de paiement</label>
                  <select value={chargeForm.mode_paiement} onChange={(e) => setChargeForm((f) => ({ ...f, mode_paiement: e.target.value }))} className="input-field">
                    {MODES_PAIEMENT.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Statut</label>
                  <select value={chargeForm.statut_paiement} onChange={(e) => setChargeForm((f) => ({ ...f, statut_paiement: e.target.value }))} className="input-field">
                    <option value="paye">Payé</option>
                    <option value="en_attente">En attente</option>
                  </select>
                </div>
              </div>
              <button onClick={handleSaveCharge} disabled={saving || !chargeForm.montant} className="btn-primary w-full">Enregistrer</button>
            </div>
          </div>
        )}

        {/* Employés */}
        {activeTab === "employes" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Employee list */}
            <div className="card p-5 order-last lg:order-none">
              <h2 className="text-sm font-semibold text-ink mb-4">Équipe</h2>

              {/* Add employee */}
              <div className="border-b border-surface-border pb-4 mb-4 space-y-2">
                <p className="text-xs font-medium text-ink-muted">Ajouter un employé</p>
                <input
                  type="text"
                  value={newEmpNom}
                  placeholder="Prénom Nom"
                  onChange={(e) => setNewEmpNom(e.target.value)}
                  className="input-field w-full"
                />
                <div className="flex items-center gap-2">
                  <label className="text-xs text-ink-secondary whitespace-nowrap">Tarif :</label>
                  <div className="flex items-center gap-0 flex-1">
                    <button type="button" onClick={() => setNewEmpTarif((v) => String(Math.max(0, (parseFloat(v) || 0) - 0.5)))} className="flex items-center justify-center w-8 h-9 rounded-l-xl border border-r-0 border-surface-border bg-surface-muted text-ink-secondary hover:bg-surface-border hover:text-ink transition-colors active:scale-95">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    </button>
                    <div className="relative flex-1">
                      <NumericInput inputMode="decimal" value={newEmpTarif} min={0} step={0.5} placeholder="0" onChange={(e) => setNewEmpTarif(e.target.value)} className="w-full h-9 border border-surface-border bg-white text-center text-sm font-bold font-mono text-ink outline-none pr-8 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-muted text-xs pointer-events-none">€/h</span>
                    </div>
                    <button type="button" onClick={() => setNewEmpTarif((v) => String((parseFloat(v) || 0) + 0.5))} className="flex items-center justify-center w-8 h-9 rounded-r-xl border border-l-0 border-surface-border bg-surface-muted text-ink-secondary hover:bg-surface-border hover:text-ink transition-colors active:scale-95">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    </button>
                  </div>
                  <button onClick={handleAddEmployee} disabled={addingEmp || !newEmpNom.trim()} className="btn-primary px-3 h-9">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  </button>
                </div>
              </div>

              {employees.length === 0 ? (
                <p className="text-sm text-ink-muted py-4 text-center">Aucun employé enregistré</p>
              ) : (
                <div className="space-y-1 mb-4">
                  {employees.map((emp) => (
                    <div
                      key={emp.id}
                      className={`flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all cursor-pointer ${
                        viewingEmpId === emp.id
                          ? "border-brand-teal bg-brand-teal-light"
                          : "border-surface-border hover:border-brand-teal/30 hover:bg-surface-muted"
                      } ${!emp.actif ? "opacity-50" : ""}`}
                      onClick={() => setViewingEmpId(viewingEmpId === emp.id ? null : emp.id)}
                    >
                      <div>
                        <p className={`text-sm font-semibold ${viewingEmpId === emp.id ? "text-brand-teal" : "text-ink"}`}>
                          {emp.nom}
                        </p>
                        <p className="text-xs text-ink-muted">{emp.tarif_horaire}€/h</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {(() => {
                          const empSessions = sessions.filter((s) => s.employee_id === emp.id);
                          const totalMontant = empSessions.reduce((s, ws) => s + ws.montant, 0);
                          const totalHeures = empSessions.reduce((s, ws) => s + ws.heures, 0);
                          return totalMontant > 0 ? (
                            <div className="text-right">
                              <p className="text-xs font-mono font-semibold text-ink-secondary">{formatPrice(totalMontant)}</p>
                              <p className="text-[10px] text-ink-muted">{totalHeures}h · {empSessions.length} sess.</p>
                            </div>
                          ) : null;
                        })()}
                        {deletingEmpId === emp.id ? (
                          <div className="flex items-center gap-1" onClick={(ev) => ev.stopPropagation()}>
                            <span className="text-xs text-brand-red font-medium">Supprimer ?</span>
                            <button
                              onClick={() => handleDeleteEmployee(emp.id)}
                              className="text-xs font-semibold text-white bg-brand-red px-2 py-1 rounded-lg hover:opacity-80 transition-opacity"
                            >
                              Oui
                            </button>
                            <button
                              onClick={() => setDeletingEmpId(null)}
                              className="text-xs text-ink-muted px-2 py-1 rounded-lg hover:bg-surface-muted transition-colors"
                            >
                              Non
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1" onClick={(ev) => ev.stopPropagation()}>
                            {emp.actif && (
                              <button
                                onClick={() => updateEmployee(emp.id, { actif: false }).then(load)}
                                className="text-xs text-ink-muted hover:text-brand-red transition-colors px-2 py-1 rounded-lg hover:bg-brand-red-light"
                              >
                                Désactiver
                              </button>
                            )}
                            <button
                              onClick={() => setDeletingEmpId(emp.id)}
                              className="p-1.5 rounded-lg text-ink-muted hover:text-brand-red hover:bg-brand-red-light transition-colors"
                              title="Supprimer l'employé"
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* View employee sessions */}
              {viewingEmpId && viewingEmp && (
                <div className="mt-4 border-t border-surface-border pt-4">
                  <p className="text-xs font-semibold text-ink mb-3">{viewingEmp.nom} — Sessions {saison !== "all" ? saison : ""}</p>

                  {/* Filtres paiement */}
                  {sessionsByEmp.length > 0 && (
                    <div className="flex items-center gap-1 mb-2 p-0.5 bg-surface-muted rounded-lg border border-surface-border w-fit">
                      {([
                        { key: "all",       label: "Toutes" },
                        { key: "payees",    label: "✅ Payées" },
                        { key: "non_payees", label: "⏳ Non payées" },
                      ] as const).map(({ key, label }) => (
                        <button
                          key={key}
                          onClick={() => setSessionPayeFilter(key)}
                          className={`px-2 py-1 rounded-md text-[10px] font-semibold transition-all ${
                            sessionPayeFilter === key
                              ? "bg-white shadow-sm text-ink"
                              : "text-ink-muted hover:text-ink"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  )}

                  {sessionsByEmp.length === 0 ? (
                    <p className="text-xs text-ink-muted">Aucune session</p>
                  ) : sessionsByEmpFiltered.length === 0 ? (
                    <p className="text-xs text-ink-muted italic">Aucune session dans ce filtre</p>
                  ) : (
                    <div className="space-y-1">
                      {sessionsByEmpFiltered.map((s) => {
                        const isPaye = s.paye === true;
                        const isToggling = togglingPayeId === s.id;
                        return (
                          <div
                            key={s.id}
                            className={`text-xs px-2 py-1.5 rounded-lg transition-colors ${
                              isPaye ? "bg-green-50 border border-green-100" : "bg-surface-muted"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className={`font-mono ${isPaye ? "text-green-700/70" : "text-ink-muted"}`}>{fmtDate(s.date)}</span>
                              <span className={isPaye ? "text-green-700/70" : "text-ink"}>{s.heures}h</span>
                              <div className="flex items-center gap-1.5 ml-auto">
                                {(s.bonus ?? 0) > 0 && (
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 font-semibold text-[10px]">
                                    🎁 +{formatPrice(s.bonus!)}
                                  </span>
                                )}
                                <span className={`font-semibold font-mono ${isPaye ? "text-green-700/70" : "text-ink"}`}>{formatPrice(s.montant)}</span>
                              </div>
                              {/* Bouton paiement */}
                              <button
                                onClick={() => handleTogglePaye(s.id, !isPaye)}
                                disabled={isToggling}
                                title={isPaye ? "Annuler le paiement" : "Marquer comme payé"}
                                className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-semibold transition-all disabled:opacity-50 ${
                                  isPaye
                                    ? "bg-green-100 text-green-700 hover:bg-green-200"
                                    : "bg-surface-border text-ink-muted hover:bg-[#E8820C]/10 hover:text-[#E8820C]"
                                }`}
                              >
                                {isToggling ? (
                                  <svg className="animate-spin" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                                ) : isPaye ? (
                                  <span>✅ Payé</span>
                                ) : (
                                  <span>💰 Payer</span>
                                )}
                              </button>
                              <button onClick={() => deleteWorkSession(s.id).then(load)} className="text-ink-muted hover:text-brand-red shrink-0">
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                              </button>
                            </div>
                          </div>
                        );
                      })}

                      {(() => {
                        const totalBase   = sessionsByEmp.reduce((acc, ws) => acc + ws.montant - (ws.bonus ?? 0), 0);
                        const totalBonus  = sessionsByEmp.reduce((acc, ws) => acc + (ws.bonus ?? 0), 0);
                        const totalGlobal = sessionsByEmp.reduce((acc, ws) => acc + ws.montant, 0);
                        const totalPaye   = sessionsByEmp.filter((ws) => ws.paye === true).reduce((acc, ws) => acc + ws.montant, 0);
                        const totalNonPaye = totalGlobal - totalPaye;
                        return (
                          <div className="mt-1 space-y-1">
                            {/* Récap payé / non payé */}
                            <div className="px-2 py-2 rounded-xl bg-green-50 border border-green-100 flex items-center justify-between text-xs">
                              <span className="text-green-700 font-semibold">✅ Payé</span>
                              <span className="font-mono font-bold text-green-700">{formatPrice(totalPaye)}</span>
                            </div>
                            <div className="px-2 py-2 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-between text-xs">
                              <span className="text-amber-700 font-semibold">⏳ Non payé</span>
                              <span className="font-mono font-bold text-amber-700">{formatPrice(totalNonPaye)}</span>
                            </div>
                            {/* Total global inchangé */}
                            <div className="px-2 py-2 rounded-xl bg-brand-teal-light border border-brand-teal/20">
                              {totalBonus > 0 ? (
                                <div className="space-y-0.5 text-xs">
                                  <div className="flex justify-between text-ink-secondary">
                                    <span>Base ({sessionsByEmp.length} sess. · {sessionsByEmp.reduce((acc, ws) => acc + ws.heures, 0)}h)</span>
                                    <span className="font-mono">{formatPrice(totalBase)}</span>
                                  </div>
                                  <div className="flex justify-between text-green-700 font-semibold">
                                    <span>Bonus</span>
                                    <span className="font-mono">+{formatPrice(totalBonus)}</span>
                                  </div>
                                  <div className="flex justify-between font-bold text-brand-teal border-t border-brand-teal/20 pt-1">
                                    <span>Total global</span>
                                    <span className="font-mono">{formatPrice(totalGlobal)}</span>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex justify-between text-xs font-semibold text-brand-teal">
                                  <span>{sessionsByEmp.length} session{sessionsByEmp.length > 1 ? "s" : ""} · {sessionsByEmp.reduce((acc, ws) => acc + ws.heures, 0)}h</span>
                                  <span className="font-mono">{formatPrice(totalGlobal)}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Session form */}
            <div className="card p-5">
              <h2 className="text-sm font-semibold text-ink mb-4">Saisir une session de travail</h2>
              <div className="space-y-3">
                <div>
                  <label className="label">Employé</label>
                  <select value={sessionForm.employeeId} onChange={(e) => {
                    const newId = e.target.value;
                    const emp = employees.find((emp) => emp.id === newId);
                    setSessionForm((f) => ({ ...f, employeeId: newId, tarif: emp ? String(emp.tarif_horaire) : "" }));
                  }} className="input-field">
                    <option value="">— Choisir —</option>
                    {employees.filter((e) => e.actif).map((e) => (
                      <option key={e.id} value={e.id}>{e.nom} ({e.tarif_horaire}€/h)</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Date</label>
                  <DatePicker value={sessionForm.date} onChange={(v) => setSessionForm((f) => ({ ...f, date: v }))} allowPast />
                </div>
                <div>
                  <label className="label">Heure début</label>
                  <select
                    value={sessionForm.heureDebut}
                    onChange={(e) => setSessionForm((f) => ({ ...f, heureDebut: e.target.value }))}
                    className="input-field w-full appearance-none cursor-pointer"
                    style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239C9890' stroke-width='2.5' stroke-linecap='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center", paddingRight: "32px" }}
                  >
                    <option value="">— Non définie</option>
                    {Array.from({ length: 29 }, (_, i) => {
                      const totalMinutes = 8 * 60 + i * 30;
                      const h = Math.floor(totalMinutes / 60);
                      const m = totalMinutes % 60;
                      const val = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
                      return <option key={val} value={val}>{val}</option>;
                    })}
                  </select>
                </div>
                <div>
                  <label className="label">Heure fin</label>
                  <select
                    value={sessionForm.heureFin}
                    onChange={(e) => setSessionForm((f) => ({ ...f, heureFin: e.target.value }))}
                    className="input-field w-full appearance-none cursor-pointer"
                    style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239C9890' stroke-width='2.5' stroke-linecap='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center", paddingRight: "32px" }}
                  >
                    <option value="">— Non définie</option>
                    {Array.from({ length: 29 }, (_, i) => {
                      const totalMinutes = 8 * 60 + i * 30;
                      const h = Math.floor(totalMinutes / 60);
                      const m = totalMinutes % 60;
                      const val = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
                      return <option key={val} value={val}>{val}</option>;
                    })}
                  </select>
                </div>
                <div>
                  <label className="label">Ou nb heures (si pas d&apos;horaires)</label>
                  <div className="flex items-center gap-0">
                    <button type="button" onClick={() => setSessionForm((f) => ({ ...f, heures: String(Math.max(0, Math.round(((parseFloat(f.heures) || 0) - 0.5) * 100) / 100)) }))} className="flex items-center justify-center w-9 h-9 rounded-l-xl border border-r-0 border-surface-border bg-surface-muted text-ink-secondary hover:bg-surface-border hover:text-ink transition-colors active:scale-95">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    </button>
                    <div className="relative flex-1">
                      <NumericInput inputMode="decimal" value={sessionForm.heures} min={0} step={0.5} placeholder="0" onChange={(e) => setSessionForm((f) => ({ ...f, heures: e.target.value }))} className="w-full h-9 border border-surface-border bg-white text-center text-sm font-bold font-mono text-ink outline-none pr-6 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-muted text-sm pointer-events-none">h</span>
                    </div>
                    <button type="button" onClick={() => setSessionForm((f) => ({ ...f, heures: String(Math.round(((parseFloat(f.heures) || 0) + 0.5) * 100) / 100) }))} className="flex items-center justify-center w-9 h-9 rounded-r-xl border border-l-0 border-surface-border bg-surface-muted text-ink-secondary hover:bg-surface-border hover:text-ink transition-colors active:scale-95">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    </button>
                  </div>
                </div>
                <div>
                  <label className="label">Tarif horaire (€/h)</label>
                  <div className="flex items-center gap-0">
                    <button type="button" onClick={() => setSessionForm((f) => ({ ...f, tarif: String(Math.max(0, Math.round(((parseFloat(f.tarif) || 0) - 0.5) * 100) / 100)) }))} className="flex items-center justify-center w-9 h-9 rounded-l-xl border border-r-0 border-surface-border bg-surface-muted text-ink-secondary hover:bg-surface-border hover:text-ink transition-colors active:scale-95">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    </button>
                    <div className="relative flex-1">
                      <NumericInput inputMode="decimal" value={sessionForm.tarif} min={0} step={0.5} placeholder={selectedEmp ? `${selectedEmp.tarif_horaire}` : "0"} onChange={(e) => setSessionForm((f) => ({ ...f, tarif: e.target.value }))} className="w-full h-9 border border-surface-border bg-white text-center text-sm font-bold font-mono text-ink outline-none pr-8 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-muted text-xs pointer-events-none">€/h</span>
                    </div>
                    <button type="button" onClick={() => setSessionForm((f) => ({ ...f, tarif: String(Math.round(((parseFloat(f.tarif) || 0) + 0.5) * 100) / 100) }))} className="flex items-center justify-center w-9 h-9 rounded-r-xl border border-l-0 border-surface-border bg-surface-muted text-ink-secondary hover:bg-surface-border hover:text-ink transition-colors active:scale-95">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    </button>
                  </div>
                </div>
                <div>
                  <label className="label">Bonus exceptionnel (optionnel)</label>
                  <div className="flex items-center gap-0">
                    <button type="button" onClick={() => setSessionForm((f) => ({ ...f, bonus: String(Math.max(0, (parseFloat(f.bonus) || 0) - 5)) }))} className="flex items-center justify-center w-9 h-9 rounded-l-xl border border-r-0 border-surface-border bg-surface-muted text-ink-secondary hover:bg-surface-border hover:text-ink transition-colors active:scale-95">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    </button>
                    <div className="relative flex-1">
                      <NumericInput inputMode="decimal" value={sessionForm.bonus} min={0} step={5} placeholder="0" onChange={(e) => setSessionForm((f) => ({ ...f, bonus: e.target.value }))} className="w-full h-9 border border-surface-border bg-white text-center text-sm font-bold font-mono text-ink outline-none pr-6 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-muted text-sm pointer-events-none">€</span>
                    </div>
                    <button type="button" onClick={() => setSessionForm((f) => ({ ...f, bonus: String((parseFloat(f.bonus) || 0) + 5) }))} className="flex items-center justify-center w-9 h-9 rounded-r-xl border border-l-0 border-surface-border bg-surface-muted text-ink-secondary hover:bg-surface-border hover:text-ink transition-colors active:scale-95">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    </button>
                  </div>
                </div>
                <div>
                  <label className="label">Notes</label>
                  <input type="text" value={sessionForm.notes} placeholder="Optionnel" onChange={(e) => setSessionForm((f) => ({ ...f, notes: e.target.value }))} className="input-field" />
                </div>

                {sessionHoursPreview > 0 && selectedEmp && (
                  <div className="px-4 py-2.5 rounded-xl bg-brand-teal-light border border-brand-teal/20 text-sm">
                    {sessionBonusPreview > 0 ? (
                      <div className="space-y-0.5">
                        <div className="flex items-center justify-between text-ink-secondary">
                          <span>{sessionHoursPreview}h × {sessionTarifPreview}€</span>
                          <span className="font-mono">{formatPrice(sessionHoursPreview * sessionTarifPreview)}</span>
                        </div>
                        <div className="flex items-center justify-between text-green-700">
                          <span>Bonus exceptionnel</span>
                          <span className="font-mono">+{formatPrice(sessionBonusPreview)}</span>
                        </div>
                        <div className="flex items-center justify-between font-bold font-mono text-brand-teal border-t border-brand-teal/20 pt-1 mt-1">
                          <span>Total</span>
                          <span>{formatPrice(sessionMontantPreview)}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <span className="text-ink-secondary">{sessionHoursPreview}h × {sessionTarifPreview}€</span>
                        <span className="font-bold font-mono text-brand-teal">{formatPrice(sessionMontantPreview)}</span>
                      </div>
                    )}
                  </div>
                )}

                <button onClick={handleSaveSession} disabled={saving || !sessionForm.employeeId || !sessionForm.date || sessionHoursPreview <= 0} className="btn-primary w-full">
                  Enregistrer la session
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Immobilisations */}
        {activeTab === "immobilisations" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Formulaire d'ajout */}
            <div className="card p-5">
              <h2 className="text-sm font-semibold text-ink mb-4">Ajouter une immobilisation</h2>
              <div className="space-y-3">
                <div>
                  <label className="label">Nom du bien</label>
                  <input type="text" value={immoForm.nom} placeholder="Flotte Kayak 2026" onChange={(e) => setImmoForm((f) => ({ ...f, nom: e.target.value }))} className="input-field" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Date d&apos;achat</label>
                    <DatePicker value={immoForm.date_achat} onChange={(v) => setImmoForm((f) => ({ ...f, date_achat: v }))} allowPast />
                  </div>
                  <div>
                    <label className="label">Montant total (€)</label>
                    <div className="flex items-center gap-0">
                      <button type="button" onClick={() => setImmoForm((f) => ({ ...f, montant_total: String(Math.max(0, (parseFloat(f.montant_total) || 0) - 100)) }))} className="flex items-center justify-center w-9 h-9 rounded-l-xl border border-r-0 border-surface-border bg-surface-muted text-ink-secondary hover:bg-surface-border hover:text-ink transition-colors active:scale-95">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
                      </button>
                      <div className="relative flex-1">
                        <NumericInput inputMode="decimal" value={immoForm.montant_total} min={0} step={100} placeholder="0" onChange={(e) => setImmoForm((f) => ({ ...f, montant_total: e.target.value }))} className="w-full h-9 border border-surface-border bg-white text-center text-sm font-bold font-mono text-ink outline-none pr-6 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-muted text-sm pointer-events-none">€</span>
                      </div>
                      <button type="button" onClick={() => setImmoForm((f) => ({ ...f, montant_total: String((parseFloat(f.montant_total) || 0) + 100) }))} className="flex items-center justify-center w-9 h-9 rounded-r-xl border border-l-0 border-surface-border bg-surface-muted text-ink-secondary hover:bg-surface-border hover:text-ink transition-colors active:scale-95">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                      </button>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="label">Durée d&apos;amortissement</label>
                  <select value={immoForm.duree_amortissement} onChange={(e) => setImmoForm((f) => ({ ...f, duree_amortissement: e.target.value }))} className="input-field">
                    {[2, 3, 4, 5].map((d) => <option key={d} value={d}>{d} ans ({d} saison{d > 1 ? "s" : ""})</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Fournisseur (optionnel)</label>
                  <input type="text" value={immoForm.fournisseur} placeholder="Décathlon, Amazon…" onChange={(e) => setImmoForm((f) => ({ ...f, fournisseur: e.target.value }))} className="input-field" />
                </div>
                <div>
                  <label className="label">Description (optionnel)</label>
                  <input type="text" value={immoForm.description} placeholder="Détail" onChange={(e) => setImmoForm((f) => ({ ...f, description: e.target.value }))} className="input-field" />
                </div>
                <button onClick={handleSaveImmo} disabled={immoSaving || !immoForm.nom.trim() || !immoForm.montant_total} className="btn-primary w-full">
                  {immoSaving ? <svg className="animate-spin" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>}
                  Ajouter l&apos;immobilisation
                </button>
              </div>
            </div>

            {/* Liste des immobilisations */}
            <div className="card p-5">
              <h2 className="text-sm font-semibold text-ink mb-4">
                Parc matériel
                {immobilisations.length > 0 && (
                  <span className="ml-2 text-xs font-normal text-ink-muted">
                    {immobilisations.filter((i) => i.actif).length} bien{immobilisations.filter((i) => i.actif).length > 1 ? "s" : ""}
                  </span>
                )}
              </h2>
              {loading ? (
                <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-14 rounded-xl bg-surface-muted animate-pulse" />)}</div>
              ) : immobilisations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <div className="w-10 h-10 rounded-xl bg-surface-muted flex items-center justify-center mb-3">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8E8E93" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                  </div>
                  <p className="text-sm font-medium text-ink">Aucune immobilisation</p>
                  <p className="text-xs text-ink-muted mt-0.5">Ajouter un équipement durable</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {immobilisations.map((immo) => {
                    const schedule = computeAmortissement(immo);
                    const currentYear = new Date().getFullYear();
                    const lastLine = schedule.filter((l) => l.year <= currentYear).at(-1);
                    const vnc = lastLine?.vnc ?? immo.montant_total;
                    const isFullyAmortized = vnc < 0.01;
                    const isExpanded = expandedImmoId === immo.id;

                    return (
                      <div key={immo.id} className="border border-surface-border rounded-xl overflow-hidden">
                        <div
                          className="flex items-center gap-3 px-3 py-3 cursor-pointer hover:bg-surface-muted/50 transition-colors"
                          onClick={() => setExpandedImmoId(isExpanded ? null : immo.id)}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-semibold text-ink truncate">{immo.nom}</p>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${isFullyAmortized ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                                {isFullyAmortized ? "Amorti" : "En cours"}
                              </span>
                            </div>
                            <p className="text-xs text-ink-muted mt-0.5">
                              {fmtDate(immo.date_achat)} · {formatPrice(immo.montant_total)} · {immo.duree_amortissement} an{immo.duree_amortissement > 1 ? "s" : ""}
                              {immo.fournisseur ? ` · ${immo.fournisseur}` : ""}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-xs text-ink-muted">VNC</p>
                            <p className="text-sm font-bold font-mono text-ink">{formatPrice(vnc)}</p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button onClick={(e) => { e.stopPropagation(); openEditImmo(immo); }} className="p-1.5 rounded-lg text-ink-muted hover:text-brand-teal hover:bg-brand-teal-light transition-colors">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); deleteImmobilisation(immo.id).then(load); }} className="p-1.5 rounded-lg text-ink-muted hover:text-brand-red hover:bg-brand-red-light transition-colors">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                            </button>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8E8E93" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}><polyline points="6 9 12 15 18 9"/></svg>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="border-t border-surface-border px-3 pb-3 pt-2 bg-surface-muted/30">
                            <p className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider mb-2">Plan d&apos;amortissement</p>
                            <div className="overflow-x-auto">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="border-b border-surface-border">
                                    <th className="text-left text-ink-muted font-semibold pb-1 pr-3">Année / Saison</th>
                                    <th className="text-right text-ink-muted font-semibold pb-1 pr-3">Dotation</th>
                                    <th className="text-right text-ink-muted font-semibold pb-1">VNC</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-surface-border">
                                  {schedule.map((line) => (
                                    <tr key={line.year} className={line.year === currentYear ? "bg-brand-teal-light/30" : ""}>
                                      <td className="py-1.5 pr-3 font-mono font-semibold text-ink">
                                        {line.year}
                                        {line.year === currentYear && <span className="ml-1.5 text-[9px] text-brand-teal font-semibold">← actuel</span>}
                                      </td>
                                      <td className="py-1.5 pr-3 text-right font-mono text-brand-red">{formatPrice(line.dotation)}</td>
                                      <td className="py-1.5 text-right font-mono font-semibold text-ink">{formatPrice(line.vnc)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                                <tfoot>
                                  <tr className="border-t-2 border-surface-border">
                                    <td className="pt-1.5 pr-3 font-bold text-ink">Total</td>
                                    <td className="pt-1.5 pr-3 text-right font-mono font-bold text-brand-red">{formatPrice(schedule.reduce((s, l) => s + l.dotation, 0))}</td>
                                    <td className="pt-1.5 text-right font-mono font-bold text-ink">—</td>
                                  </tr>
                                </tfoot>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Charges list ── */}
      <div
        className="card"
        style={{ opacity: 0, animation: "slideUp 0.4s cubic-bezier(0.16,1,0.3,1) 0.25s forwards" }}
      >
        {/* List header */}
        <div className="flex flex-col gap-3 p-5 border-b border-surface-border">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-sm font-semibold text-ink">Liste des charges</h2>
              <p className="text-xs text-ink-muted mt-0.5">
                {filteredCharges.length} dépense{filteredCharges.length !== 1 ? "s" : ""}{virtualAmortRows.length > 0 ? ` + ${virtualAmortRows.length} amort.` : ""} — Total : <span className="font-mono font-bold text-brand-red">{formatPrice(totalFiltered)}</span>
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={filterCat}
                onChange={(e) => setFilterCat(e.target.value as ChargeCategory | "all")}
                className="input-field !w-auto !py-1.5 !px-3 text-xs"
              >
                <option value="all">Toutes catégories</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{CHARGE_LABELS[c]}</option>)}
              </select>
              {!isAll && (
                <select
                  value={filterMois}
                  onChange={(e) => setFilterMois(e.target.value)}
                  className="input-field !w-auto !py-1.5 !px-3 text-xs"
                >
                  <option value="all">Tous les mois</option>
                  {MOIS_FULL.map((m, i) => {
                    const key = `${saison}-${String(i + 1).padStart(2, "0")}`;
                    return <option key={key} value={key}>{m} {saison}</option>;
                  })}
                </select>
              )}
            </div>
          </div>
          {/* Search */}
          <div className="relative w-full">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-ink-muted" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher une charge..."
              className="input-field !pl-9 !py-1.5 text-sm w-full"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink transition-colors"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="p-5 space-y-2">
            {[...Array(4)].map((_, i) => <div key={i} className="h-10 rounded-lg bg-surface-muted animate-pulse" />)}
          </div>
        ) : displayCharges.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-10 h-10 rounded-xl bg-surface-muted flex items-center justify-center mb-3">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8E8E93" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
            </div>
            <p className="text-sm font-medium text-ink">{searchQuery.trim() ? "Aucune charge trouvée" : "Aucune charge"}</p>
            <p className="text-xs text-ink-muted mt-0.5">{searchQuery.trim() ? `Aucun résultat pour "${searchQuery.trim()}"` : "Uploader un ticket ou saisir manuellement"}</p>
          </div>
        ) : (
          <div className="divide-y divide-surface-border">
            {virtualAmortRows.map((c) => {
              const amberDot = <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: "#F59E0B" }} />;
              return (
                <div key={c.id} className="bg-amber-50/40 hover:bg-amber-50/70 transition-colors">
                  {/* Mobile */}
                  <div className="sm:hidden px-4 py-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {amberDot}
                        <span className="text-xs font-mono text-ink-muted">{fmtDate(c.date)}</span>
                      </div>
                      <span className="text-sm font-bold font-mono" style={{ color: "#F59E0B" }}>{formatPrice(c.montant)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-ink truncate">{c.immoNom}</p>
                        <p className="text-xs text-ink-muted truncate">Équipement · {c.description}</p>
                      </div>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold bg-amber-100 text-amber-700 shrink-0">Amortissement</span>
                    </div>
                  </div>
                  {/* Desktop */}
                  <div className="hidden sm:flex items-center gap-4 px-5 py-3">
                    {amberDot}
                    <div className="w-14 shrink-0">
                      <span className="text-xs font-mono text-ink-muted">{fmtDate(c.date)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-ink truncate">{c.immoNom}</p>
                      <p className="text-xs text-ink-muted truncate">{c.description}</p>
                    </div>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold bg-amber-100 text-amber-700 shrink-0">Amortissement</span>
                    <span className="text-sm font-bold font-mono shrink-0" style={{ color: "#F59E0B" }}>
                      {formatPrice(c.montant)}
                    </span>
                  </div>
                </div>
              );
            })}
            {filteredCharges.map((c) => {
              const dot = <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: c.categorie === "restauration_metro" ? "#0071E3" : c.categorie === "restauration_autre" ? "#16A34A" : c.categorie === "equipement" ? "#F59E0B" : c.categorie === "salaire" ? "#8B5CF6" : "#8E8E93" }} />;
              return (
                <div key={c.id} className="hover:bg-surface-muted group transition-colors">

                  {/* ── Mobile layout (2 lignes) ── */}
                  <div className="sm:hidden px-4 py-3 space-y-1">
                    {/* Ligne 1 : date + montant */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {dot}
                        <span className="text-xs font-mono text-ink-muted">{fmtDate(c.date)}</span>
                      </div>
                      <span className="text-sm font-bold font-mono text-brand-red">{formatPrice(c.montant)}</span>
                    </div>
                    {/* Ligne 2 : catégorie/fournisseur + boutons */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-ink truncate">
                          {c.fournisseur || CHARGE_LABELS[c.categorie]}
                        </p>
                        <p className="text-xs text-ink-muted truncate">
                          {CHARGE_LABELS[c.categorie]}{c.description ? ` · ${c.description}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center shrink-0">
                        <button
                          onClick={() => openEdit(c)}
                          className="flex items-center justify-center w-11 h-11 rounded-xl text-ink-muted hover:text-brand-teal hover:bg-brand-teal-light active:scale-95 transition-all"
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button
                          onClick={() => deleteCharge(c.id).then(load)}
                          className="flex items-center justify-center w-11 h-11 rounded-xl text-ink-muted hover:text-brand-red hover:bg-brand-red-light active:scale-95 transition-all"
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* ── Desktop layout (1 ligne) ── */}
                  <div className="hidden sm:flex items-center gap-4 px-5 py-3">
                    {dot}
                    <div className="w-14 shrink-0">
                      <span className="text-xs font-mono text-ink-muted">{fmtDate(c.date)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-ink truncate">
                        {c.fournisseur || CHARGE_LABELS[c.categorie]}
                      </p>
                      {c.description && (
                        <p className="text-xs text-ink-muted truncate">{c.description}</p>
                      )}
                    </div>
                    <span className="badge text-xs shrink-0 bg-surface-muted text-ink-secondary">
                      {CHARGE_LABELS[c.categorie]}
                    </span>
                    {c.mode_paiement && (
                      <span className="text-xs text-ink-muted shrink-0">{c.mode_paiement}</span>
                    )}
                    <span className="text-sm font-bold font-mono text-brand-red shrink-0">
                      {formatPrice(c.montant)}
                    </span>
                    <button
                      onClick={() => openEdit(c)}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-ink-muted hover:text-brand-teal hover:bg-brand-teal-light transition-all shrink-0"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button
                      onClick={() => deleteCharge(c.id).then(load)}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-ink-muted hover:text-brand-red hover:bg-brand-red-light transition-all shrink-0"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                    </button>
                  </div>

                </div>
              );
            })}
          </div>
        )}
      </div>
      {/* ── Edit charge modal ── */}
      {editingCharge && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.3)", backdropFilter: "blur(4px)" }}
          onClick={() => setEditingCharge(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-ink">Modifier la charge</h3>
              <button
                onClick={() => setEditingCharge(null)}
                className="p-1 rounded-md text-ink-muted hover:text-ink hover:bg-surface-muted transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Date</label>
                <DatePicker value={editForm.date} onChange={(v) => setEditForm((f) => ({ ...f, date: v }))} allowPast />
              </div>
              <div>
                <label className="label">Montant (€)</label>
                <div className="flex items-center gap-0">
                  <button type="button" onClick={() => setEditForm((f) => ({ ...f, montant: String(Math.max(0, (parseFloat(f.montant) || 0) - 1)) }))} className="flex items-center justify-center w-9 h-9 rounded-l-xl border border-r-0 border-surface-border bg-surface-muted text-ink-secondary hover:bg-surface-border hover:text-ink transition-colors active:scale-95">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  </button>
                  <div className="relative flex-1">
                    <NumericInput inputMode="decimal" value={editForm.montant} min={0} step={1} onChange={(e) => setEditForm((f) => ({ ...f, montant: e.target.value }))} className="w-full h-9 border border-surface-border bg-white text-center text-sm font-bold font-mono text-ink outline-none pr-6 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-muted text-sm pointer-events-none">€</span>
                  </div>
                  <button type="button" onClick={() => setEditForm((f) => ({ ...f, montant: String((parseFloat(f.montant) || 0) + 1) }))} className="flex items-center justify-center w-9 h-9 rounded-r-xl border border-l-0 border-surface-border bg-surface-muted text-ink-secondary hover:bg-surface-border hover:text-ink transition-colors active:scale-95">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  </button>
                </div>
              </div>
            </div>
            <div>
              <label className="label">Catégorie</label>
              <select value={editForm.categorie} onChange={(e) => setEditForm((f) => ({ ...f, categorie: e.target.value as ChargeCategory }))} className="input-field">
                {CATEGORIES.map((c) => <option key={c} value={c}>{CHARGE_LABELS[c]}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Fournisseur</label>
              <input type="text" value={editForm.fournisseur} onChange={(e) => setEditForm((f) => ({ ...f, fournisseur: e.target.value }))} className="input-field" />
            </div>
            <div>
              <label className="label">Description</label>
              <input type="text" value={editForm.description} onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))} className="input-field" />
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setEditingCharge(null)} className="btn-secondary flex-1">
                Annuler
              </button>
              <button onClick={handleUpdateCharge} disabled={editSaving || !editForm.montant} className="btn-primary flex-1">
                {editSaving ? (
                  <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                )}
                Sauvegarder
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit immobilisation modal ── */}
      {editingImmo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.3)", backdropFilter: "blur(4px)" }}
          onClick={() => setEditingImmo(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-ink">Modifier l&apos;immobilisation</h3>
              <button onClick={() => setEditingImmo(null)} className="p-1 rounded-md text-ink-muted hover:text-ink hover:bg-surface-muted transition-colors">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div>
              <label className="label">Nom du bien</label>
              <input type="text" value={editImmoForm.nom} onChange={(e) => setEditImmoForm((f) => ({ ...f, nom: e.target.value }))} className="input-field" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Date d&apos;achat</label>
                <DatePicker value={editImmoForm.date_achat} onChange={(v) => setEditImmoForm((f) => ({ ...f, date_achat: v }))} allowPast />
              </div>
              <div>
                <label className="label">Montant (€)</label>
                <input type="number" value={editImmoForm.montant_total} onChange={(e) => setEditImmoForm((f) => ({ ...f, montant_total: e.target.value }))} className="input-field font-mono" />
              </div>
            </div>
            <div>
              <label className="label">Durée d&apos;amortissement</label>
              <select value={editImmoForm.duree_amortissement} onChange={(e) => setEditImmoForm((f) => ({ ...f, duree_amortissement: e.target.value }))} className="input-field">
                {[2, 3, 4, 5].map((d) => <option key={d} value={d}>{d} ans ({d} saison{d > 1 ? "s" : ""})</option>)}
              </select>
            </div>
            <div>
              <label className="label">Fournisseur</label>
              <input type="text" value={editImmoForm.fournisseur} onChange={(e) => setEditImmoForm((f) => ({ ...f, fournisseur: e.target.value }))} className="input-field" />
            </div>
            <div>
              <label className="label">Description</label>
              <input type="text" value={editImmoForm.description} onChange={(e) => setEditImmoForm((f) => ({ ...f, description: e.target.value }))} className="input-field" />
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setEditingImmo(null)} className="btn-secondary flex-1">Annuler</button>
              <button onClick={handleUpdateImmo} disabled={editImmoSaving || !editImmoForm.nom.trim() || !editImmoForm.montant_total} className="btn-primary flex-1">
                {editImmoSaving ? <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                Sauvegarder
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
