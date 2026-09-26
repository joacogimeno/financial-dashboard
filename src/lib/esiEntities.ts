// Entity configuration for the Securities-firms (ESI) view: which CNMV firms are
// highlighted competitors ("peers") or Inversis clients, how Inversis's own
// (bank-basis) figures are injected as a reference line, and colour assignment.
import type { AnnualJSON, QuarterlyJSON, EntityMetrics } from "./types";
import type {
  EsiAnnualJSON,
  EsiQuarterlyJSON,
  EsiMetrics,
  EsiTag,
} from "./esiTypes";

// The two market lines are TOTALS — the sum of every Sociedad / Agencia de
// Valores that reports to CNMV (not an average). Averages are separate entities.
export const MARKET_SV = "Sociedades de Valores";
export const MARKET_AV = "Agencias de Valores";
export const AVG_SV = "Media por Sociedad de Valores";
export const AVG_AV = "Media por Agencia de Valores";
export const INVERSIS = "Inversis";
export const MARKET_NAMES = [MARKET_SV, MARKET_AV];

// Highlighted competitors. `name` must match the CNMV denominación exactly;
// `short` is the label shown in the UI. Edit freely.
export const PEERS: { name: string; short: string }[] = [
  { name: "MAPFRE INVERSION S.V.", short: "Mapfre Inversión" },
  { name: "TRESSIS, S.V.", short: "Tressis" },
  { name: "GVC GAESCO VALORES S.V., S.A.", short: "GVC Gaesco" },
  { name: "ALTURA MARKETS, S.V., S.A.", short: "Altura Markets" },
  { name: "FINECO, S.V.", short: "Fineco" },
  { name: "JB CAPITAL MARKETS, S.V., S.A.", short: "JB Capital" },
  { name: "DIAPHANUM VALORES S.V., S.A.U.", short: "Diaphanum" },
  { name: "INTERMONEY VALORES, S.V.", short: "Intermoney" },
  { name: "AURIGA GLOBAL INVESTORS SOCIEDAD DE VALORES, S.A.", short: "Auriga" },
  { name: "RENTA 4, S.V.", short: "Renta 4 SV" },
  { name: "KUTXABANK INVESTMENT, S.V., S.A.", short: "Kutxabank Inv." },
  { name: "ABANTE ASESORES DISTRIBUCION, A.V.", short: "Abante" },
  { name: "MUTUACTIVOS INVERSIONES, A.V., S.A.", short: "Mutuactivos" },
  { name: "ORIENTA WEALTH AGENCIA DE VALORES S.A.", short: "Orienta Wealth" },
  { name: "INDEXA CAPITAL A.V., S.A.", short: "Indexa Capital" },
];

// CNMV firms that are Inversis custody/execution clients. INTERNAL KNOWLEDGE —
// seed with exact CNMV denominaciones (see the league table for the full list of
// names). Left empty by design: tagging a firm a client asserts a real business
// relationship, so this must be filled in by Inversis, not guessed.
export const CLIENTS: string[] = [
  // "EXAMPLE VALORES, S.V., S.A.",
];

const PEER_BY_NAME = new Map(PEERS.map((p) => [p.name, p]));
const CLIENT_SET = new Set(CLIENTS);

export function esiTag(name: string): EsiTag {
  if (name === INVERSIS) return "reference";
  if (name === MARKET_SV || name === MARKET_AV) return "market";
  if (name === AVG_SV || name === AVG_AV) return "average";
  if (CLIENT_SET.has(name)) return "client";
  if (PEER_BY_NAME.has(name)) return "peer";
  return "other";
}

const VERBATIM = new Set([INVERSIS, MARKET_SV, MARKET_AV, AVG_SV, AVG_AV]);

// Short display name: Inversis / market / average lines verbatim, peers via their
// `short`, otherwise a lightly cleaned CNMV denominación.
export function esiDisplayName(name: string): string {
  if (VERBATIM.has(name)) return name;
  const peer = PEER_BY_NAME.get(name);
  if (peer) return peer.short;
  return name
    .replace(/,?\s*(S\.?V\.?|A\.?V\.?|SOCIEDAD DE VALORES|AGENCIA DE VALORES)(,?\s*S\.?A\.?U?\.?)?$/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// Colours: Inversis is the protagonist blue; the two market lines are neutral
// reference tones; peers cycle a categorical palette; everything else is dim.
const PEER_PALETTE = [
  "#f472b6", "#34d399", "#fbbf24", "#a78bfa", "#22d3ee", "#fb923c",
  "#4ade80", "#e879f9", "#facc15", "#38bdf8", "#f87171", "#c084fc",
  "#2dd4bf", "#fdba74", "#818cf8",
];
const PEER_COLOR = new Map(PEERS.map((p, i) => [p.name, PEER_PALETTE[i % PEER_PALETTE.length]]));

export const ESI_COLORS: Record<string, string> = {
  [INVERSIS]: "#60a5fa",
  [MARKET_SV]: "#cbd5e1",
  [MARKET_AV]: "#f59e0b",
  [AVG_SV]: "#94a3b8",
  [AVG_AV]: "#94a3b8",
};

export function esiColor(name: string): string {
  return ESI_COLORS[name] ?? PEER_COLOR.get(name) ?? "#64748b";
}

// ---------------------------------------------------------------------------
// Inversis reference line: map its bank-basis (Banco de España) figures onto the
// ESI line items. Comisiones and ROF map cleanly; margen bruto / costs are the
// bank equivalents (margen bruto includes NII, so composition — not just level —
// differs). Commission sub-types are not disclosed for banks → left undefined.
// ---------------------------------------------------------------------------
function mapBankToEsi(b: EntityMetrics | undefined | null): EsiMetrics | null {
  if (!b) return null;
  return {
    comisiones_percibidas: b.fee_income ?? null,
    comisiones_satisfechas: b.fee_expenses ?? null,
    comisiones_netas: b.net_fee_income ?? null,
    margen_intereses: b.nii ?? null,
    rof: b.rof ?? null,
    diferencias_cambio: b.fx_result ?? null,
    margen_bruto: b.gross_margin ?? null,
    gastos_explotacion: b.admin_expenses ?? null,
    gastos_personal: b.staff_costs ?? null,
    gastos_generales: b.other_admin ?? null,
    amortizaciones: b.depreciation ?? null,
    resultado_explotacion: b.net_operating_income ?? null,
    resultado_antes_impuestos: b.pre_tax_profit ?? null,
    resultado_neto: b.net_profit ?? null,
    fondos_propios: b.total_equity ?? null,
    activos_totales: b.total_assets ?? null,
  };
}

const INVERSIS_META = { name: INVERSIS, segment: "SV" as const, kind: "firm" as const };

// Inversis is bank-basis (Banco de España). Its net commissions, ROF, margen
// bruto and result are consistent across the whole series, so they are shown for
// every period. Only GROSS commissions (percibidas / satisfechas) were
// reclassified by Banco de España at year-end 2024 (FY2023 ≈ €182M → FY2024 ≈
// €68M gross, while net commissions grew smoothly), so those two gross lines are
// suppressed for Inversis before 2025 rather than plotted on a broken basis.
export const INVERSIS_GROSS_FROM_YEAR = 2025;
export const INVERSIS_GROSS_FROM_QUARTER = "2025-Q1"; // lexical compare on "YYYY-QN" is safe
export const INVERSIS_BASIS_NOTE =
  "Inversis is bank-basis (Banco de España); its net commissions, ROF and margins map to the CNMV lines and " +
  "are comparable across all periods. Only gross commissions before 2025 are omitted — Banco de España " +
  "reclassified Inversis's gross fee income at year-end 2024 (net commissions were unaffected).";

// Blank the two reclassification-affected gross lines before the cutoff.
function gateInvGross(m: EsiMetrics, comparable: boolean): EsiMetrics {
  if (comparable) return m;
  return { ...m, comisiones_percibidas: null, comisiones_satisfechas: null };
}

export function esiAnnualWithInversis(esi: EsiAnnualJSON, bank: AnnualJSON): EsiAnnualJSON {
  const data: EsiAnnualJSON["data"] = {};
  for (const [year, byEntity] of Object.entries(esi.data)) {
    const merged: Record<string, EsiMetrics> = { ...byEntity };
    const inv = mapBankToEsi(bank.data[year]?.Inversis);
    if (inv) {
      const gross = Number(year) >= INVERSIS_GROSS_FROM_YEAR;
      const prior = mapBankToEsi(bank.data[year]?.Inversis?.ytd_prior);
      const rec = gateInvGross(inv, gross);
      merged[INVERSIS] = prior ? { ...rec, ytd_prior: gateInvGross(prior, gross) } : rec;
    }
    data[year] = merged;
  }
  return withMeta(esi, data, INVERSIS_META);
}

export function esiQuarterlyWithInversis(esi: EsiQuarterlyJSON, bank: QuarterlyJSON): EsiQuarterlyJSON {
  const data: EsiQuarterlyJSON["data"] = {};
  for (const [q, byEntity] of Object.entries(esi.data)) {
    const inv = mapBankToEsi(bank.data[q]?.Inversis);
    data[q] = inv ? { ...byEntity, [INVERSIS]: gateInvGross(inv, q >= INVERSIS_GROSS_FROM_QUARTER) } : { ...byEntity };
  }
  return withMeta(esi, data, INVERSIS_META);
}

function withMeta<T extends EsiAnnualJSON | EsiQuarterlyJSON>(
  esi: T,
  data: T["data"],
  ...extra: { name: string; segment: "SV" | "AV"; kind: "firm" | "average" }[]
): T {
  return {
    ...esi,
    _metadata: { ...esi._metadata, entities: [...esi._metadata.entities, ...extra] },
    data,
  } as T;
}

// ---------------------------------------------------------------------------
// Average-firm lines: the market total divided by the number of reporting firms
// of that segment in each period — a like-scale yardstick for a single firm.
// Every stored metric scales linearly, so total/count is the per-firm average.
// ---------------------------------------------------------------------------
const AVG_META = [
  { name: AVG_SV, segment: "SV" as const, kind: "average" as const },
  { name: AVG_AV, segment: "AV" as const, kind: "average" as const },
];

// Only these fields are meaningful as a "per-firm average" and are the ones the
// UI plots for the average lines. ROF, its instrument split and commission
// sub-types are NOT per-firm concepts, so they are deliberately excluded (net
// fee income and margen bruto also feed the derived no_fee_income line).
const AVG_FIELDS: (keyof EsiMetrics)[] = [
  "comisiones_percibidas", "comisiones_netas", "comisiones_satisfechas",
  "margen_bruto", "gastos_explotacion", "resultado_antes_impuestos",
];

function averageRecords<T extends EsiAnnualJSON | EsiQuarterlyJSON>(esi: T): T {
  const firms = esi._metadata.entities.filter((e) => e.kind === "firm");
  const data: T["data"] = {} as T["data"];
  for (const [period, byEntity] of Object.entries(esi.data)) {
    const merged: Record<string, EsiMetrics> = { ...byEntity };
    for (const [mktName, avgName, seg] of [
      [MARKET_SV, AVG_SV, "SV"],
      [MARKET_AV, AVG_AV, "AV"],
    ] as const) {
      const mkt = byEntity[mktName];
      const n = firms.filter(
        (f) => f.segment === seg && typeof byEntity[f.name]?.comisiones_netas === "number",
      ).length;
      if (mkt && n > 0) {
        const avg: EsiMetrics = {};
        for (const k of AVG_FIELDS) {
          const v = mkt[k];
          if (typeof v === "number") (avg as Record<string, number | null>)[k] = v / n;
        }
        merged[avgName] = avg;
      }
    }
    (data as Record<string, Record<string, EsiMetrics>>)[period] = merged;
  }
  return withMeta(esi, data, ...AVG_META);
}

export const esiAnnualWithAverages = (esi: EsiAnnualJSON) => averageRecords(esi);
export const esiQuarterlyWithAverages = (esi: EsiQuarterlyJSON) => averageRecords(esi);
