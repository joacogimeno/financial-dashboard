// Line-item catalogue + benchmarking maths for the ESI view.
import type { EsiAnnualJSON, EsiQuarterlyJSON, EsiMetrics, EsiMetricKey } from "./esiTypes";

// Display keys include one derived measure. CNMV does not disclose ROF per firm,
// only comisiones netas and margen bruto, so "non-fee income" (margen bruto −
// comisiones netas = ROF + intereses + FX + otros) is the per-firm trading proxy.
export type DisplayKey = EsiMetricKey | "no_fee_income";

export interface EsiLineItem {
  key: DisplayKey;
  label: string;
  group: string;
  higherIsBetter: boolean;
  format: (v: number) => string;
}

export const fmtM = (v: number) => `€${v.toFixed(1)}M`;
export const fmtM2 = (v: number) => `€${v.toFixed(2)}M`;
export const fmtPct = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
export const fmtPctPlain = (v: number) => `${v.toFixed(1)}%`;

// Comparable across Inversis (bank basis) and the CNMV market. Net commissions
// lead — they are consistent across all years, unlike gross comisiones which
// Banco de España reclassified for Inversis at year-end 2024.
export const LINE_ITEMS: EsiLineItem[] = [
  { key: "comisiones_netas", label: "Comisiones netas", group: "Comisiones", higherIsBetter: true, format: fmtM },
  { key: "comisiones_percibidas", label: "Comisiones percibidas (brutas)", group: "Comisiones", higherIsBetter: true, format: fmtM },
  { key: "rof", label: "ROF (result. op. financieras)", group: "Trading", higherIsBetter: true, format: fmtM2 },
  { key: "no_fee_income", label: "Ingresos no-comisiones (ROF + int. + otros)", group: "Trading", higherIsBetter: true, format: fmtM },
  { key: "margen_bruto", label: "Margen bruto", group: "Márgenes", higherIsBetter: true, format: fmtM },
  { key: "gastos_explotacion", label: "Gastos de explotación", group: "Costes", higherIsBetter: false, format: fmtM },
  { key: "resultado_antes_impuestos", label: "Resultado antes de impuestos", group: "Resultado", higherIsBetter: true, format: fmtM },
];

// Commission mix sub-types — market composition only (not disclosed per firm).
export const COMMISSION_SUBTYPES: EsiLineItem[] = [
  { key: "com_ejecucion", label: "Tramitación y ejecución", group: "Comisiones", higherIsBetter: true, format: fmtM },
  { key: "com_comercializacion_iic", label: "Comercialización de IIC", group: "Comisiones", higherIsBetter: true, format: fmtM },
  { key: "com_deposito", label: "Depósito y anotación", group: "Comisiones", higherIsBetter: true, format: fmtM },
  { key: "com_gestion_carteras", label: "Gestión de carteras", group: "Comisiones", higherIsBetter: true, format: fmtM },
  { key: "com_asesoramiento", label: "Asesoramiento", group: "Comisiones", higherIsBetter: true, format: fmtM },
];

export function val(rec: EsiMetrics | undefined, key: DisplayKey): number | null {
  if (!rec) return null;
  if (key === "no_fee_income") {
    const mb = rec.margen_bruto;
    const cn = rec.comisiones_netas;
    return typeof mb === "number" && typeof cn === "number" ? mb - cn : null;
  }
  const v = rec[key];
  return typeof v === "number" ? v : null;
}

function growthPct(cur: number | null, prior: number | null): number | null {
  if (cur == null || prior == null || prior === 0) return null;
  return ((cur - prior) / Math.abs(prior)) * 100;
}

// YoY growth for a year. In a YTD year (2026 = H1) compares to the same-period
// prior year via ytd_prior; otherwise to the previous full year.
export function annualGrowth(
  data: EsiAnnualJSON,
  entity: string,
  year: string,
  key: DisplayKey,
): number | null {
  const rec = data.data[year]?.[entity];
  const cur = val(rec, key);
  const isYtd = data._metadata.ytd?.[year] != null;
  if (isYtd) return growthPct(cur, val(rec?.ytd_prior ?? undefined, key));
  const years = data._metadata.years.map(String);
  const idx = years.indexOf(year);
  const prior = idx > 0 ? val(data.data[years[idx - 1]]?.[entity], key) : null;
  return growthPct(cur, prior);
}

export function qoqGrowth(
  data: EsiQuarterlyJSON,
  entity: string,
  quarter: string,
  key: DisplayKey,
): number | null {
  const idx = data.quarters.indexOf(quarter);
  if (idx <= 0) return null;
  return growthPct(val(data.data[quarter]?.[entity], key), val(data.data[data.quarters[idx - 1]]?.[entity], key));
}

// YoY growth in the quarterly series (same quarter, 4 periods back).
export function yoyGrowthQ(
  data: EsiQuarterlyJSON,
  entity: string,
  quarter: string,
  key: DisplayKey,
): number | null {
  const idx = data.quarters.indexOf(quarter);
  if (idx < 4) return null;
  return growthPct(val(data.data[quarter]?.[entity], key), val(data.data[data.quarters[idx - 4]]?.[entity], key));
}

export type VerdictLabel = "AHEAD" | "AT PACE" | "BEHIND";
export interface Verdict {
  label: VerdictLabel;
  gap: number | null; // percentage points of growth vs the market
  self: number | null;
  market: number | null;
}

// Compare an entity's growth to the market's growth. `gap` is "pp better than the
// market": for cost lines (higherIsBetter false) growing slower is good, so the
// sign is inverted. Threshold ±2pp.
export function verdict(
  self: number | null,
  market: number | null,
  higherIsBetter = true,
): Verdict {
  if (self == null || market == null) return { label: "AT PACE", gap: null, self, market };
  const gap = (self - market) * (higherIsBetter ? 1 : -1);
  const label: VerdictLabel = gap > 2 ? "AHEAD" : gap < -2 ? "BEHIND" : "AT PACE";
  return { label, gap, self, market };
}

// Inversis's share of a market aggregate for a line item (%).
export function marketShare(
  data: EsiAnnualJSON,
  entity: string,
  marketName: string,
  year: string,
  key: DisplayKey,
): number | null {
  const num = val(data.data[year]?.[entity], key);
  const den = val(data.data[year]?.[marketName], key);
  if (num == null || den == null || den === 0) return null;
  return (num / den) * 100;
}

// Rank of an entity among all firms for a line item (1 = highest).
export function rankInSegment(
  data: EsiAnnualJSON,
  entity: string,
  year: string,
  key: DisplayKey,
): { rank: number; total: number } | null {
  const firms = data._metadata.entities.filter((e) => e.kind === "firm").map((e) => e.name);
  const scored = firms
    .map((n) => ({ n, v: val(data.data[year]?.[n], key) }))
    .filter((x) => x.v != null) as { n: string; v: number }[];
  scored.sort((a, b) => b.v - a.v);
  const rank = scored.findIndex((x) => x.n === entity);
  if (rank < 0) return null;
  return { rank: rank + 1, total: scored.length };
}
