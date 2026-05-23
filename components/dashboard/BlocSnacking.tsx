"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import type { DevisFormData, SnackingItem, SnackingFormula, GuidedArticle } from "@/lib/types";
import { SNACKING_PRICES, GUIDED_ARTICLES } from "@/lib/pricing";
import { formatPrice } from "@/lib/calculations";

interface Props {
  form: DevisFormData;
  onChange: (patch: Partial<DevisFormData>) => void;
}

interface FormulaTemplate {
  formula: SnackingFormula;
  label: string;
  description: string;
  price: number | null;
  badge?: string;
}

const FORMULA_TEMPLATES: FormulaTemplate[] = [
  {
    formula: "dejeuner",
    label: "Formule Déjeuner",
    description: "Panini ou Croque Monsieur ou Hot Dog + boisson froide + boisson chaude",
    price: SNACKING_PRICES.dejeuner,
    badge: "Populaire",
  },
  {
    formula: "gouter",
    label: "Formule Goûter",
    description: "Crêpe sucrée maison ou Glace ou Cookie maison + boisson froide + boisson chaude",
    price: SNACKING_PRICES.gouter,
  },
  {
    formula: "dejeuner-gouter",
    label: "Formule Déjeuner + Goûter",
    description: "Les deux formules combinées",
    price: SNACKING_PRICES.dejeuner + SNACKING_PRICES.gouter,
    badge: "Combiné",
  },
  {
    formula: "guidee",
    label: "Formule sur mesure",
    description: "Construis ta formule article par article",
    price: null,
    badge: "Sur-mesure",
  },
  {
    formula: "personnalise",
    label: "Formule personnalisée",
    description: "Description libre + prix manuel",
    price: null,
  },
];

function genId() {
  return `snk_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

function calcGuidedPrice(articles: GuidedArticle[]): number {
  if (!articles.length) return 0;
  let total = 0;
  let groupMax = articles[0].price * (articles[0].quantity ?? 1);
  for (let i = 1; i < articles.length; i++) {
    const val = articles[i].price * (articles[i].quantity ?? 1);
    if (articles[i].operatorBefore === "ET") {
      total += groupMax;
      groupMax = val;
    } else {
      groupMax = Math.max(groupMax, val);
    }
  }
  return Math.round((total + groupMax) * 100) / 100;
}

function buildGuidedLabel(articles: GuidedArticle[]): string {
  return articles
    .map((a, i) => {
      const qty = (a.quantity ?? 1) > 1 ? ` ×${a.quantity}` : "";
      const opLabel = a.operatorBefore === "ET" ? "+" : a.operatorBefore === "OU" ? "ou" : "";
      return i === 0 ? `${a.name}${qty}` : `${opLabel} ${a.name}${qty}`;
    })
    .join(" ");
}

function GuidedBuilder({
  item,
  onUpdate,
}: {
  item: SnackingItem;
  onUpdate: (patch: Partial<SnackingItem>) => void;
}) {
  const articles = item.guidedArticles ?? [];
  const etBtnRef = React.useRef<HTMLButtonElement>(null);
  const ouBtnRef = React.useRef<HTMLButtonElement>(null);
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const [openMenu, setOpenMenu] = useState<"ET" | "OU" | null>(null);
  const [menuPos, setMenuPos] = useState<{ top?: number; bottom?: number; left: number } | null>(null);
  const isFirst = articles.length === 0;

  useEffect(() => {
    if (!openMenu) return;
    function handleOutside(e: MouseEvent) {
      const t = e.target as Node;
      if (
        dropdownRef.current?.contains(t) ||
        etBtnRef.current?.contains(t) ||
        ouBtnRef.current?.contains(t)
      ) return;
      setOpenMenu(null);
      setMenuPos(null);
    }
    document.addEventListener("mousedown", handleOutside);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
    };
  }, [openMenu]);

  function findArticle(name: string): { name: string; price: number } | null {
    for (const items of Object.values(GUIDED_ARTICLES)) {
      const found = items.find((a) => a.name === name);
      if (found) return { name: found.name, price: found.price };
    }
    return null;
  }

  function handleFirstSelect(e: React.ChangeEvent<HTMLSelectElement>) {
    const name = e.target.value;
    if (!name) return;
    const found = findArticle(name);
    if (!found) return;
    const newArticles: GuidedArticle[] = [{ name: found.name, price: found.price, quantity: 1 }];
    onUpdate({
      guidedArticles: newArticles,
      label: buildGuidedLabel(newArticles),
      manualPrice: calcGuidedPrice(newArticles),
    });
    e.target.value = "";
  }

  function addArticleWithOp(articleName: string, op: "ET" | "OU") {
    const found = findArticle(articleName);
    if (!found) return;
    const newArticles: GuidedArticle[] = [
      ...articles,
      { name: found.name, price: found.price, quantity: 1, operatorBefore: op },
    ];
    onUpdate({
      guidedArticles: newArticles,
      label: buildGuidedLabel(newArticles),
      manualPrice: calcGuidedPrice(newArticles),
    });
    setOpenMenu(null);
    setMenuPos(null);
  }

  function handleOpClick(op: "ET" | "OU") {
    if (openMenu === op) {
      setOpenMenu(null);
      setMenuPos(null);
      return;
    }
    const btn = op === "ET" ? etBtnRef.current : ouBtnRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const menuWidth = 300;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Horizontal: aligne à gauche du bouton, repli si débordement à droite
    const left = rect.left + menuWidth <= vw
      ? rect.left
      : Math.max(8, vw - menuWidth - 8);

    // Vertical: si plus de place au-dessus → ouvre vers le haut, sinon vers le bas
    const spaceAbove = rect.top;
    const spaceBelow = vh - rect.bottom;
    const pos: { top?: number; bottom?: number; left: number } =
      spaceAbove > spaceBelow
        ? { bottom: vh - rect.top, left }  // ancré en haut du bouton, grandit vers le haut
        : { top: rect.bottom, left };       // ancré en bas du bouton, grandit vers le bas

    setMenuPos(pos);
    setOpenMenu(op);
  }

  function updateQuantity(idx: number, delta: number) {
    const newArticles = articles.map((a, i) =>
      i !== idx ? a : { ...a, quantity: Math.max(1, (a.quantity ?? 1) + delta) }
    );
    onUpdate({
      guidedArticles: newArticles,
      label: buildGuidedLabel(newArticles),
      manualPrice: calcGuidedPrice(newArticles),
    });
  }

  function removeArticle(idx: number) {
    const newArticles = articles.filter((_, i) => i !== idx);
    if (idx === 0 && newArticles.length > 0) {
      newArticles[0] = { ...newArticles[0], operatorBefore: undefined };
    }
    onUpdate({
      guidedArticles: newArticles,
      label: buildGuidedLabel(newArticles) || "Formule sur mesure",
      manualPrice: calcGuidedPrice(newArticles),
    });
  }

  const qtyBtn: React.CSSProperties = {
    width: "18px", height: "18px", borderRadius: "50%",
    background: "#E5E5EA", border: "none", cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
    padding: 0, flexShrink: 0,
  };

  function opBtnStyle(op: "ET" | "OU"): React.CSSProperties {
    const isET = op === "ET";
    const isOpen = openMenu === op;
    return {
      height: "38px",
      padding: "0 20px",
      borderRadius: "100px",
      border: "none",
      backgroundColor: isOpen
        ? (isET ? "#005BBF" : "#505055")
        : (isET ? "#0071E3" : "#6E6E73"),
      color: "white",
      fontSize: "13px",
      fontWeight: 700,
      letterSpacing: "0.05em",
      cursor: "pointer",
      flexShrink: 0,
      transition: "background-color 0.12s, box-shadow 0.12s",
      boxShadow: isOpen
        ? `0 3px 10px ${isET ? "rgba(0,113,227,0.4)" : "rgba(110,110,115,0.4)"}`
        : `0 1px 4px ${isET ? "rgba(0,113,227,0.25)" : "rgba(110,110,115,0.25)"}`,
    };
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>

      {/* ── Tags ── */}
      {articles.length > 0 && (
        <div style={{
          display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px",
          padding: "10px 12px", background: "white",
          borderRadius: "10px", border: "1px solid #D2D2D7", minHeight: "46px",
        }}>
          {articles.map((art, i) => {
            const qty = art.quantity ?? 1;
            return (
              <span key={i} style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                {i > 0 && (
                  <span style={{
                    fontSize: "10px", fontWeight: 800, padding: "2px 8px", borderRadius: "100px",
                    background: art.operatorBefore === "ET" ? "#E8F1FB" : "#F2F2F2",
                    color: art.operatorBefore === "ET" ? "#0071E3" : "#6E6E73",
                    letterSpacing: "0.05em",
                  }}>
                    {art.operatorBefore === "ET" ? "+" : "ou"}
                  </span>
                )}
                <span style={{
                  display: "flex", alignItems: "center", gap: "4px",
                  padding: "3px 6px 3px 10px", borderRadius: "100px",
                  background: "#F5F5F7", border: "1px solid #D2D2D7",
                }}>
                  <span style={{ fontSize: "12px", fontWeight: 500, color: "#1D1D1F", whiteSpace: "nowrap" }}>
                    {art.name}
                    {qty > 1 && <span style={{ fontWeight: 700, color: "#0071E3" }}> ×{qty}</span>}
                  </span>
                  <button type="button" onClick={() => updateQuantity(i, -1)} style={qtyBtn}>
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#3D3D3F" strokeWidth="3" strokeLinecap="round">
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                  </button>
                  <span style={{ fontSize: "11px", fontWeight: 700, minWidth: "12px", textAlign: "center", color: "#1D1D1F" }}>{qty}</span>
                  <button type="button" onClick={() => updateQuantity(i, +1)} style={qtyBtn}>
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#3D3D3F" strokeWidth="3" strokeLinecap="round">
                      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                  </button>
                  <span style={{ width: "1px", height: "14px", background: "#D2D2D7", flexShrink: 0 }} />
                  <button type="button" onClick={() => removeArticle(i)} style={{ ...qtyBtn, background: "transparent" }}>
                    <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="#8E8E93" strokeWidth="3.5" strokeLinecap="round">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </span>
              </span>
            );
          })}
        </div>
      )}

      {/* ── Add row ── */}
      {isFirst ? (
        /* First article: dropdown adds directly on selection */
        <select
          defaultValue=""
          onChange={handleFirstSelect}
          className="input-field appearance-none cursor-pointer"
          style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239C9890' stroke-width='2.5' stroke-linecap='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center", paddingRight: "32px" }}
        >
          <option value="">Choisir un article…</option>
          {Object.entries(GUIDED_ARTICLES).map(([cat, items]) => (
            <optgroup key={cat} label={cat}>
              {items.map((a) => (
                <option key={a.name} value={a.name}>
                  {a.name} — {formatPrice(a.price)}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      ) : (
        /* Subsequent articles: ET / oubuttons — menu rendered via portal */
        <div style={{ display: "flex", gap: "8px" }}>
          <button ref={etBtnRef} type="button" onClick={() => handleOpClick("ET")} style={opBtnStyle("ET")}>+</button>
          <button ref={ouBtnRef} type="button" onClick={() => handleOpClick("OU")} style={opBtnStyle("OU")}>ou</button>
        </div>
      )}

      {/* Dropdown portal — rendu dans body pour échapper aux overflow:hidden parents */}
      {openMenu && menuPos && createPortal(
        <div
          ref={dropdownRef}
          onWheel={(e) => e.stopPropagation()}
          style={{
            position: "fixed",
            top: menuPos.top,
            bottom: menuPos.bottom,
            left: menuPos.left,
            zIndex: 9999,
            background: "white", borderRadius: "14px",
            border: "1px solid #D2D2D7",
            boxShadow: "0 8px 28px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)",
            width: "300px", maxHeight: "50vh", overflowY: "auto",
            padding: "6px",
          }}
        >
          <div style={{ padding: "8px 10px 8px", marginBottom: "2px" }}>
            <span style={{
              fontSize: "11px", fontWeight: 800, letterSpacing: "0.07em",
              textTransform: "uppercase",
              color: openMenu === "ET" ? "#0071E3" : "#6E6E73",
            }}>
              Ajouter avec {openMenu === "ET" ? "+" : "ou"}
            </span>
          </div>
          {Object.entries(GUIDED_ARTICLES).map(([cat, items]) => (
            <div key={cat}>
              <p style={{
                fontSize: "10px", fontWeight: 700, color: "#ABABAB",
                letterSpacing: "0.09em", textTransform: "uppercase",
                padding: "8px 10px 4px", margin: 0,
              }}>
                {cat}
              </p>
              {items.map((a) => (
                <button
                  key={a.name}
                  type="button"
                  onClick={() => addArticleWithOp(a.name, openMenu)}
                  style={{
                    width: "100%", display: "flex", alignItems: "center",
                    justifyContent: "space-between", gap: "12px",
                    padding: "9px 10px", border: "none", background: "transparent",
                    borderRadius: "8px", cursor: "pointer", textAlign: "left",
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background =
                      openMenu === "ET" ? "rgba(0,113,227,0.07)" : "rgba(110,110,115,0.07)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = "transparent";
                  }}
                >
                  <span style={{ fontSize: "13px", fontWeight: 500, color: "#1D1D1F" }}>{a.name}</span>
                  <span style={{
                    fontSize: "12px", fontWeight: 700,
                    color: openMenu === "ET" ? "#0071E3" : "#6E6E73",
                    fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap",
                    flexShrink: 0,
                  }}>
                    {formatPrice(a.price)}
                  </span>
                </button>
              ))}
            </div>
          ))}
        </div>,
        document.body
      )}

      {/* ── Price stepper ── */}
      {articles.length > 0 && (
        <div className="flex items-center gap-2">
          <label className="text-xs text-ink-secondary whitespace-nowrap">Prix / pers. :</label>
          <div className="flex items-center gap-0">
            <button
              type="button"
              onClick={() => onUpdate({ manualPrice: Math.max(0, Math.round(((item.manualPrice ?? 0) - 0.5) * 100) / 100) })}
              className="flex items-center justify-center w-8 h-9 rounded-l-xl border border-r-0 border-surface-border bg-surface-muted text-ink-secondary hover:bg-surface-border transition-colors active:scale-95"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
            <div className="relative">
              <input
                type="number"
                value={item.manualPrice ?? 0}
                min={0}
                step={0.5}
                onChange={(e) => onUpdate({ manualPrice: parseFloat(e.target.value) || 0 })}
                className="w-20 h-9 border border-surface-border bg-white text-center text-sm font-bold font-mono text-ink outline-none pr-5 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-muted text-sm pointer-events-none">€</span>
            </div>
            <button
              type="button"
              onClick={() => onUpdate({ manualPrice: Math.round(((item.manualPrice ?? 0) + 0.5) * 100) / 100 })}
              className="flex items-center justify-center w-8 h-9 rounded-r-xl border border-l-0 border-surface-border bg-surface-muted text-ink-secondary hover:bg-surface-border transition-colors active:scale-95"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function BlocSnacking({ form, onChange }: Props) {
  function addFormula(template: FormulaTemplate) {
    const item: SnackingItem = {
      id: genId(),
      formula: template.formula,
      label: template.label,
      description: template.description,
      pricePerPerson: template.price,
      manualPrice: template.price === null ? 0 : undefined,
      manualLabel: template.formula === "personnalise" ? "" : undefined,
      guidedArticles: template.formula === "guidee" ? [] : undefined,
    };
    onChange({ snackingItems: [...form.snackingItems, item] });
  }

  function removeItem(id: string) {
    onChange({ snackingItems: form.snackingItems.filter((i) => i.id !== id) });
  }

  function updateItem(id: string, patch: Partial<SnackingItem>) {
    onChange({
      snackingItems: form.snackingItems.map((i) =>
        i.id === id ? { ...i, ...patch } : i
      ),
    });
  }

  return (
    <section className="card p-6 space-y-5">
      <p className="section-title">3 — Prestations complémentaires</p>

      {/* Formula grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {FORMULA_TEMPLATES.map((tmpl) => {
          const already = form.snackingItems.some((i) => i.formula === tmpl.formula);
          const canAddMultiple = false;
          return (
            <button
              key={tmpl.formula}
              type="button"
              onClick={() => {
                if (already && !canAddMultiple) {
                  const item = form.snackingItems.find((i) => i.formula === tmpl.formula);
                  if (item) removeItem(item.id);
                } else {
                  addFormula(tmpl);
                }
              }}
              disabled={false}
              className={`flex items-start gap-3 p-3.5 rounded-xl border-2 text-left transition-all duration-200 ${
                already && !canAddMultiple
                  ? "border-brand-teal bg-brand-teal-light cursor-default"
                  : "border-surface-border bg-white hover:border-brand-teal/40 hover:bg-brand-teal-light/30 hover:shadow-soft"
              }`}
            >
              <div
                className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                  already && !canAddMultiple ? "border-brand-teal bg-brand-teal" : "border-surface-border"
                }`}
              >
                {already && !canAddMultiple && (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-sm font-semibold ${already && !canAddMultiple ? "text-brand-teal" : "text-ink"}`}>
                    {tmpl.label}
                  </span>
                  {tmpl.badge && (
                    <span className="badge text-xs px-1.5 py-0.5" style={{ backgroundColor: "rgba(0,113,227,0.1)", color: "#0071E3" }}>
                      {tmpl.badge}
                    </span>
                  )}
                </div>
                <p className="text-xs text-ink-muted mt-0.5 leading-relaxed">{tmpl.description}</p>
                {tmpl.price !== null && (
                  <p className="text-xs font-bold font-mono mt-1" style={{ color: "#0071E3" }}>
                    {formatPrice(tmpl.price)} / pers.
                  </p>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected items */}
      {form.snackingItems.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider">Prestations sélectionnées</p>
          {form.snackingItems.map((item) => (
            <div
              key={item.id}
              className="flex items-start gap-3 p-3 rounded-xl bg-surface-muted border border-surface-border"
            >
              <div className="flex-1 space-y-2">
                {item.formula === "guidee" && (
                  <GuidedBuilder
                    item={item}
                    onUpdate={(patch) => updateItem(item.id, patch)}
                  />
                )}
                {item.formula === "personnalise" && (
                  <input
                    type="text"
                    value={item.manualLabel ?? item.label}
                    onChange={(e) => updateItem(item.id, { manualLabel: e.target.value, label: e.target.value })}
                    className="input-field text-sm"
                    placeholder="Intitulé de la prestation"
                  />
                )}
                {item.formula === "personnalise" && (
                  <textarea
                    value={item.description}
                    onChange={(e) => updateItem(item.id, { description: e.target.value })}
                    rows={1}
                    className="input-field text-sm resize-none"
                    placeholder="Description (optionnel)"
                  />
                )}
                {item.formula !== "guidee" && item.pricePerPerson === null && (
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-ink-secondary whitespace-nowrap">Prix / pers. :</label>
                    <div className="relative flex-1 max-w-32">
                      <input
                        type="number"
                        value={item.manualPrice ?? 0}
                        min={0}
                        step={0.5}
                        onChange={(e) =>
                          updateItem(item.id, { manualPrice: parseFloat(e.target.value) || 0 })
                        }
                        className="input-field pr-7 text-sm font-mono"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted text-sm">€</span>
                    </div>
                  </div>
                )}
                {item.pricePerPerson !== null && (
                  <span className="text-xs text-ink-secondary">
                    {item.label} — <span className="font-mono font-semibold">{formatPrice(item.pricePerPerson)} / pers.</span>
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => removeItem(item.id)}
                className="text-ink-muted hover:text-brand-red transition-colors p-1 mt-0.5 shrink-0"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {form.snackingItems.length === 0 && (
        <p className="text-center text-sm text-ink-muted py-2">
          Aucune prestation snacking sélectionnée
        </p>
      )}
    </section>
  );
}
