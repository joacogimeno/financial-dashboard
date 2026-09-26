import type { AnnualJSON, EntityName, KPIDef, MetricKey } from "./types";

const eur = (v: number) => `€${Math.abs(v).toFixed(1)}M`;
const pct = (v: number) => `${v.toFixed(1)}%`;
const bps = (v: number) => `${v.toFixed(0)} bps`;

// The comparison base for a YoY-growth metric. For a YTD year (whose entry
// carries a raw same-period prior-year snapshot) we compare like-for-like
// (H1 vs H1); otherwise we use the prior full year.
export function growthBase(
  annual: AnnualJSON,
  entity: EntityName,
  year: string,
  metric: MetricKey,
): number | null {
  const cur = annual.data[year]?.[entity];
  if (cur?.ytd_prior) return (cur.ytd_prior[metric] as number) ?? null;
  const years = annual._metadata.years.map(String);
  const idx = years.indexOf(year);
  if (idx <= 0) return null;
  return (annual.data[years[idx - 1]]?.[entity]?.[metric] as number) ?? null;
}

export const KPI_DEFS: KPIDef[] = [
  // ── Revenue ──────────────────────────────────────────────
  {
    key: "gross_margin",
    label: "Gross Income Growth",
    unit: "%",
    format: (v) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`,
    higherIsBetter: true,
    growthRate: true,
    description: "YoY growth of Gross Income. Measures top-line business momentum.",
    compute: (annual, entity, year) => {
      const curr = (annual.data[year]?.[entity]?.gross_margin as number) ?? null;
      const prev = growthBase(annual, entity, year, "gross_margin");
      if (curr == null || prev == null || prev === 0) return null;
      return ((curr - prev) / Math.abs(prev)) * 100;
    },
  },
  {
    key: "net_fee_income",
    label: "Income ex-NII Growth",
    unit: "%",
    format: (v) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`,
    higherIsBetter: true,
    growthRate: true,
    description: "YoY growth of Gross Income excluding NII. Measures fee-based revenue momentum.",
    compute: (annual, entity, year) => {
      const mCurr = annual.data[year]?.[entity];
      if (!mCurr) return null;
      const gm = (mCurr.gross_margin as number) ?? null;
      const nii = (mCurr.nii as number) ?? null;
      const gmPrev = growthBase(annual, entity, year, "gross_margin");
      const niiPrev = growthBase(annual, entity, year, "nii");
      if (gm == null || nii == null || gmPrev == null || niiPrev == null) return null;
      const curr = gm - nii;
      const prev = gmPrev - niiPrev;
      if (prev === 0) return null;
      return ((curr - prev) / Math.abs(prev)) * 100;
    },
  },
  {
    key: "net_fee_income",
    label: "Net Fee Income",
    unit: "€M",
    format: eur,
    higherIsBetter: true,
    description: "Fee Income minus Fee Expenses. Core recurring revenue for custodians.",
  },
  {
    key: "fee_mix_pct",
    label: "Fee Revenue Mix",
    unit: "%",
    format: pct,
    higherIsBetter: true,
    description: "Net Fee Income as % of Gross Margin. Higher = less rate-sensitive business model.",
  },
  {
    key: "nii_sensitivity_bps",
    label: "NII Yield",
    unit: "bps",
    format: bps,
    higherIsBetter: true,
    description: "NII / Tangible Assets. Measures interest rate contribution on earning assets.",
  },
  // ── Efficiency & Profitability ────────────────────────────
  {
    key: "cost_to_income_pct",
    label: "Cost-to-Income",
    unit: "%",
    format: pct,
    higherIsBetter: false,
    description: "(Admin + D&A) / Gross Margin. Standard efficiency ratio.",
    compute: (annual, entity, year) => {
      const m = annual.data[year]?.[entity];
      if (!m) return null;
      const admin = (m.admin_expenses as number) ?? null;
      const dep = (m.depreciation as number) ?? null;
      const gm = (m.gross_margin as number) ?? null;
      if (admin == null || dep == null || gm == null || gm === 0) return null;
      return (Math.abs(admin) + Math.abs(dep)) / Math.abs(gm) * 100;
    },
  },
  {
    key: "jaws_ratio",
    label: "Operating Leverage",
    unit: "%",
    format: (v) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}pp`,
    higherIsBetter: true,
    growthRate: true,
    description: "Revenue growth % minus cost growth %. Positive = revenues outpacing costs.",
    compute: (annual, entity, year) => {
      const mC = annual.data[year]?.[entity];
      if (!mC) return null;
      // YTD years carry a Jaws precomputed vs the same period prior year (H1 vs H1).
      if (mC.ytd_prior) return (mC.jaws_ratio as number) ?? null;
      const gmC = (mC.gross_margin as number) ?? null;
      const gmP = growthBase(annual, entity, year, "gross_margin");
      const adminP = growthBase(annual, entity, year, "admin_expenses");
      const deprP = growthBase(annual, entity, year, "depreciation");
      const costC = ((mC.admin_expenses as number) ?? 0) + ((mC.depreciation as number) ?? 0);
      const costP = (adminP ?? 0) + (deprP ?? 0);
      if (gmC == null || gmP == null || gmP === 0 || costP === 0) return null;
      const revGrowth = ((gmC - gmP) / Math.abs(gmP)) * 100;
      const costGrowth = ((costC - costP) / Math.abs(costP)) * 100;
      return revGrowth - costGrowth;
    },
  },
  {
    key: "roe_pct",
    label: "ROE",
    unit: "%",
    format: pct,
    higherIsBetter: true,
    description: "Net Profit / Equity. Shareholder return measure.",
  },
  // ── Capital ───────────────────────────────────────────────
  {
    key: "tangible_equity_ratio_pct",
    label: "Tangible Equity Ratio",
    unit: "%",
    format: pct,
    higherIsBetter: true,
    description: "(Equity − Intangibles) / Total Assets. Strips out goodwill and intangibles.",
  },
  // ── Costs ─────────────────────────────────────────────────
  {
    key: "admin_expenses",
    label: "Cost Growth",
    unit: "%",
    format: (v) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`,
    higherIsBetter: false, // rising costs are worse — lower / negative growth ranks best
    growthRate: true,
    description: "YoY growth of total operating costs (staff + general + D&A, incl. depreciation & amortisation).",
    compute: (annual, entity, year) => {
      const m = annual.data[year]?.[entity];
      if (!m) return null;
      const adminC = (m.admin_expenses as number) ?? null;
      const depC = (m.depreciation as number) ?? null;
      const adminP = growthBase(annual, entity, year, "admin_expenses");
      const depP = growthBase(annual, entity, year, "depreciation");
      if (adminC == null || depC == null || adminP == null || depP == null) return null;
      const costPrev = adminP + depP;
      if (costPrev === 0) return null;
      return ((adminC + depC - costPrev) / Math.abs(costPrev)) * 100;
    },
  },
];
