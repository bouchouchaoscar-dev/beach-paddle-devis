"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  getCharges, saveCharge, updateCharge, deleteCharge,
  getEmployees, saveEmployee, updateEmployee,
  getWorkSessions, saveWorkSession, deleteWorkSession,
} from "@/lib/compta";
import { formatPrice } from "@/lib/calculations";
import {
  MOIS_FULL,
  CHARGE_LABELS, SAISONS,
  type Charge, type Employee, type WorkSession, type ChargeCategory,
} from "@/lib/compta-types";
import { useComptaSaison } from "../ComptaSaisonProvider";
import { DatePicker } from "@/components/ui/DatePicker";

const CATEGORIES: ChargeCategory[] = ["restauration_metro", "restauration_autre", "equipement", "salaire", "autre"];
const MODES_PAIEMENT = ["CB", "Espèces", "Virement", "Chèque"];

type Tab = "upload" | "manuel" | "employes";

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
  const [activeTab, setActiveTab] = useState<Tab>("upload");
  const [charges, setCharges] = useState<Charge[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [sessions, setSessions] = useState<WorkSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filterCat, setFilterCat] = useState<ChargeCategory | "all">("all");
  const [filterMois, setFilterMois] = useState<string>("all");
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
  const [sessionForm, setSessionForm] = useState({
    employeeId: "",
    date: new Date().toISOString().split("T")[0],
    heureDebut: "",
    heureFin: "",
    heures: "",
    tarif: "",
    notes: "",
  });
  const [viewingEmpId, setViewingEmpId] = useState<string | null>(null);

  const isAll = saison === "all";

  const load = useCallback(async () => {
    setLoading(true);
    const [c, e, s] = await Promise.all([
      getCharges(isAll ? undefined : saison),
      getEmployees(),
      getWorkSessions(isAll ? undefined : saison),
    ]);
    setCharges(c);
    setEmployees(e);
    setSessions(s);
    setLoading(false);
  }, [saison]);

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
    const montant = heures * tarif;
    setSaving(true);
    try {
      await saveWorkSession({
        employee_id: emp.id,
        date: sessionForm.date,
        heure_debut: sessionForm.heureDebut || undefined,
        heure_fin: sessionForm.heureFin || undefined,
        heures,
        montant,
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
        description: `${heures}h — ${emp.nom}`,
        saison: sessionForm.date.slice(0, 4),
        statut_paiement: "paye",
        created_by: "",
      });
      setSessionForm((f) => ({ ...f, heures: "", notes: "", heureDebut: "", heureFin: "", tarif: String(emp.tarif_horaire) }));
      await load();
    } finally {
      setSaving(false);
    }
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
    return matchCat && matchMois;
  });
  const totalFiltered = filteredCharges.reduce((s, c) => s + c.montant, 0);

  const sessionsByEmp = viewingEmpId
    ? sessions.filter((s) => s.employee_id === viewingEmpId)
    : [];
  const viewingEmp = employees.find((e) => e.id === viewingEmpId);

  const sessionHoursPreview = sessionForm.heureDebut && sessionForm.heureFin
    ? calcSessionHours(sessionForm.heureDebut, sessionForm.heureFin)
    : parseFloat(sessionForm.heures) || 0;
  const selectedEmp = employees.find((e) => e.id === sessionForm.employeeId);
  const sessionTarifPreview = parseFloat(sessionForm.tarif) || selectedEmp?.tarif_horaire || 0;
  const sessionMontantPreview = sessionHoursPreview > 0 && selectedEmp
    ? sessionHoursPreview * sessionTarifPreview
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
        className="flex items-center gap-1 p-1 bg-surface-muted rounded-xl border border-surface-border w-fit"
        style={{ opacity: 0, animation: "slideUp 0.4s cubic-bezier(0.16,1,0.3,1) 0.1s forwards" }}
      >
        {([
          { id: "upload", label: "Upload & IA" },
          { id: "manuel", label: "Saisie manuelle" },
          { id: "employes", label: "Employés" },
        ] as { id: Tab; label: string }[]).map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
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
                      <input type="number" inputMode="decimal" value={chargeForm.montant} min={0} step={1} placeholder="0" autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} onChange={(e) => setChargeForm((f) => ({ ...f, montant: e.target.value }))} className="w-full h-9 border border-surface-border bg-white text-center text-sm font-bold font-mono text-ink outline-none pr-6 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
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
                      <input type="number" inputMode="decimal" value={chargeForm.montant} min={0} step={1} placeholder="0" autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} onChange={(e) => setChargeForm((f) => ({ ...f, montant: e.target.value }))} className="w-full h-9 border border-surface-border bg-white text-center text-sm font-bold font-mono text-ink outline-none pr-6 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
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
            <div className="card p-5">
              <h2 className="text-sm font-semibold text-ink mb-4">Équipe</h2>

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
                        {emp.actif && (
                          <button
                            onClick={(ev) => { ev.stopPropagation(); updateEmployee(emp.id, { actif: false }).then(load); }}
                            className="text-xs text-ink-muted hover:text-brand-red transition-colors px-2 py-1 rounded-lg hover:bg-brand-red-light"
                          >
                            Désactiver
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add employee */}
              <div className="border-t border-surface-border pt-4 space-y-2">
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
                      <input type="number" inputMode="decimal" value={newEmpTarif} min={0} step={0.5} placeholder="0" autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} onChange={(e) => setNewEmpTarif(e.target.value)} className="w-full h-9 border border-surface-border bg-white text-center text-sm font-bold font-mono text-ink outline-none pr-8 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
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

              {/* View employee sessions */}
              {viewingEmpId && viewingEmp && (
                <div className="mt-4 border-t border-surface-border pt-4">
                  <p className="text-xs font-semibold text-ink mb-2">{viewingEmp.nom} — Sessions {saison !== "all" ? saison : ""}</p>
                  {sessionsByEmp.length === 0 ? (
                    <p className="text-xs text-ink-muted">Aucune session</p>
                  ) : (
                    <div className="space-y-1">
                      {sessionsByEmp.map((s) => (
                        <div key={s.id} className="flex items-center justify-between text-xs px-2 py-1.5 rounded-lg bg-surface-muted">
                          <span className="text-ink-muted font-mono">{fmtDate(s.date)}</span>
                          <span className="text-ink">{s.heures}h</span>
                          <span className="text-ink font-semibold font-mono">{formatPrice(s.montant)}</span>
                          <button onClick={() => deleteWorkSession(s.id).then(load)} className="text-ink-muted hover:text-brand-red ml-1">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                          </button>
                        </div>
                      ))}
                      <div className="mt-1 px-2 py-2 rounded-xl bg-brand-teal-light border border-brand-teal/20">
                        <div className="flex justify-between text-xs font-semibold text-brand-teal">
                          <span>{sessionsByEmp.length} session{sessionsByEmp.length > 1 ? "s" : ""} · {sessionsByEmp.reduce((s, ws) => s + ws.heures, 0)}h</span>
                          <span className="font-mono">{formatPrice(sessionsByEmp.reduce((s, ws) => s + ws.montant, 0))}</span>
                        </div>
                      </div>
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="label">Heure début</label>
                    <input type="time" value={sessionForm.heureDebut} onChange={(e) => setSessionForm((f) => ({ ...f, heureDebut: e.target.value }))} className="input-field w-full" />
                  </div>
                  <div>
                    <label className="label">Heure fin</label>
                    <input type="time" value={sessionForm.heureFin} onChange={(e) => setSessionForm((f) => ({ ...f, heureFin: e.target.value }))} className="input-field w-full" />
                  </div>
                </div>
                <div>
                  <label className="label">Ou nb heures (si pas d&apos;horaires)</label>
                  <div className="flex items-center gap-0">
                    <button type="button" onClick={() => setSessionForm((f) => ({ ...f, heures: String(Math.max(0, Math.round(((parseFloat(f.heures) || 0) - 0.5) * 100) / 100)) }))} className="flex items-center justify-center w-9 h-9 rounded-l-xl border border-r-0 border-surface-border bg-surface-muted text-ink-secondary hover:bg-surface-border hover:text-ink transition-colors active:scale-95">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    </button>
                    <div className="relative flex-1">
                      <input type="number" inputMode="decimal" value={sessionForm.heures} min={0} step={0.5} placeholder="0" autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} onChange={(e) => setSessionForm((f) => ({ ...f, heures: e.target.value }))} className="w-full h-9 border border-surface-border bg-white text-center text-sm font-bold font-mono text-ink outline-none pr-6 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
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
                      <input type="number" inputMode="decimal" value={sessionForm.tarif} min={0} step={0.5} placeholder={selectedEmp ? `${selectedEmp.tarif_horaire}` : "0"} autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} onChange={(e) => setSessionForm((f) => ({ ...f, tarif: e.target.value }))} className="w-full h-9 border border-surface-border bg-white text-center text-sm font-bold font-mono text-ink outline-none pr-8 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-muted text-xs pointer-events-none">€/h</span>
                    </div>
                    <button type="button" onClick={() => setSessionForm((f) => ({ ...f, tarif: String(Math.round(((parseFloat(f.tarif) || 0) + 0.5) * 100) / 100) }))} className="flex items-center justify-center w-9 h-9 rounded-r-xl border border-l-0 border-surface-border bg-surface-muted text-ink-secondary hover:bg-surface-border hover:text-ink transition-colors active:scale-95">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    </button>
                  </div>
                </div>
                <div>
                  <label className="label">Notes</label>
                  <input type="text" value={sessionForm.notes} placeholder="Optionnel" onChange={(e) => setSessionForm((f) => ({ ...f, notes: e.target.value }))} className="input-field" />
                </div>

                {sessionHoursPreview > 0 && selectedEmp && (
                  <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-brand-teal-light border border-brand-teal/20 text-sm">
                    <span className="text-ink-secondary">{sessionHoursPreview}h × {sessionTarifPreview}€</span>
                    <span className="font-bold font-mono text-brand-teal">{formatPrice(sessionMontantPreview)}</span>
                  </div>
                )}

                <button onClick={handleSaveSession} disabled={saving || !sessionForm.employeeId || !sessionForm.date || sessionHoursPreview <= 0} className="btn-primary w-full">
                  Enregistrer la session
                </button>
              </div>
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
        <div className="flex items-center justify-between flex-wrap gap-3 p-5 border-b border-surface-border">
          <div>
            <h2 className="text-sm font-semibold text-ink">Liste des charges</h2>
            <p className="text-xs text-ink-muted mt-0.5">
              {filteredCharges.length} dépense{filteredCharges.length !== 1 ? "s" : ""} — Total : <span className="font-mono font-bold text-brand-red">{formatPrice(totalFiltered)}</span>
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

        {loading ? (
          <div className="p-5 space-y-2">
            {[...Array(4)].map((_, i) => <div key={i} className="h-10 rounded-lg bg-surface-muted animate-pulse" />)}
          </div>
        ) : filteredCharges.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-10 h-10 rounded-xl bg-surface-muted flex items-center justify-center mb-3">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8E8E93" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
            </div>
            <p className="text-sm font-medium text-ink">Aucune charge</p>
            <p className="text-xs text-ink-muted mt-0.5">Uploader un ticket ou saisir manuellement</p>
          </div>
        ) : (
          <div className="divide-y divide-surface-border">
            {filteredCharges.map((c) => (
              <div key={c.id} className="flex items-center gap-4 px-5 py-3 hover:bg-surface-muted group transition-colors">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: c.categorie === "restauration_metro" ? "#0071E3" : c.categorie === "restauration_autre" ? "#16A34A" : c.categorie === "equipement" ? "#F59E0B" : c.categorie === "salaire" ? "#8B5CF6" : "#8E8E93" }} />
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
                  <span className="text-xs text-ink-muted hidden sm:block shrink-0">{c.mode_paiement}</span>
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
            ))}
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
                    <input type="number" inputMode="decimal" value={editForm.montant} min={0} step={1} autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} onChange={(e) => setEditForm((f) => ({ ...f, montant: e.target.value }))} className="w-full h-9 border border-surface-border bg-white text-center text-sm font-bold font-mono text-ink outline-none pr-6 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
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
    </div>
  );
}
