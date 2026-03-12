import type { KPIDef } from "./types";

const eur = (v: number) => `\u20AC${Math.abs(v).toFixed(1)}M`;
const pct = (v: number) => `${v.toFixed(1)}%`;
const bps = (v: number) => `${v.toFixed(0)} bps`;

export const KPI_DEFS: KPIDef[] = [
  // ── Revenue ──────────────────────────────────────────────
  {
    key: "gross_margin",
    label: "Gross Income Growth",
    unit: "%",
    format: (v) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`,
    higherIsBetter: true,
    description: "YoY growth of Gross Income. Measures top-line business momentum.",
    compute: (annual, entity, year) => {
      const years = annual._metadata.years.map(String);
      const idx = years.indexOf(year);
      if (idx <= 0) return null;
      const prior = years[idx - 1];
      const curr = (annual.data[year]?.[entity]?.gross_margin as number) ?? null;
      const prev = (annual.data[prior]?.[entity]?.gross_margin as number) ?? null;
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
    description: "YoY growth of Gross Income excluding NII. Measures fee-based revenue momentum.",
    compute: (annual, entity, year) => {
      const years = annual._metadata.years.map(String);
      const idx = years.indexOf(year);
      if (idx <= 0) return null;
      const prior = years[idx - 1];
      const mCurr = annual.data[year]?.[entity];
      const mPrev = annual.data[prior]?.[entity];
      if (!mCurr || !mPrev) return null;
      const gm = (mCurr.gross_margin as number) ?? null;
      const nii = (mCurr.nii as number) ?? null;
      const gmPrev = (mPrev.gross_margin as number) ?? null;
      const niiPrev = (mPrev.nii as number) ?? null;
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
    unit: "\u20ACM",
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
    description: "Revenue growth % minus cost growth %. Positive = revenues outpacing costs.",
    compute: (annual, entity, year) => {
      const years = annual._metadata.years.map(String);
      const idx = years.indexOf(year);
      if (idx <= 0) return null;
      const prior = years[idx - 1];
      const mC = annual.data[year]?.[entity];
      const mP = annual.data[prior]?.[entity];
      if (!mC || !mP) return null;
      const gmC = (mC.gross_margin as number) ?? null;
      const gmP = (mP.gross_margin as number) ?? null;
      const costC = ((mC.admin_expenses as number) ?? 0) + ((mC.depreciation as number) ?? 0);
      const costP = ((mP.admin_expenses as number) ?? 0) + ((mP.depreciation as number) ?? 0);
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
    description: "(Equity \u2212 Intangibles) / Total Assets. Strips out goodwill and intangibles.",
  },
  // ── Investment ────────────────────────────────────────────
  {
    key: "depreciation",
    label: "D&A / Total Costs",
    unit: "%",
    format: pct,
    higherIsBetter: false,
    description: "D&A as % of total cost base (Admin + D&A). Capital intensity of cost structure.",
    compute: (annual, entity, year) => {
      const m = annual.data[year]?.[entity];
      if (!m) return null;
      const dep = (m.depreciation as number) ?? null;
      const admin = (m.admin_expenses as number) ?? null;
      if (dep == null || admin == null || (admin + dep) === 0) return null;
      return (dep / (admin + dep)) * 100;
    },
  },
];
