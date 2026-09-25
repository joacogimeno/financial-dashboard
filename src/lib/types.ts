export const ENTITY_NAMES = ["Inversis", "Allfunds", "CACEIS", "Cecabank", "Renta 4"] as const;
export type EntityName = (typeof ENTITY_NAMES)[number];

export interface EntityMetrics {
  // P&L (EUR millions)
  nii?: number | null;
  fee_income?: number | null;
  fee_expenses?: number | null;
  gross_margin?: number | null;
  admin_expenses?: number | null;
  staff_costs?: number | null;
  other_admin?: number | null;
  depreciation?: number | null;
  interest_income_gross?: number | null;
  interest_expenses?: number | null;
  pre_tax_profit?: number | null;
  net_profit?: number | null;
  // P&L — Between NII and Gross Margin
  dividend_income?: number | null;
  other_operating_income?: number | null;
  other_operating_expenses?: number | null;
  // P&L — Between Gross Margin and Pre-Tax Profit
  provisions?: number | null;
  impairment_financial_assets?: number | null;
  impairment_subsidiaries?: number | null;
  impairment_non_financial?: number | null;
  gains_disposal_nfa?: number | null;
  gains_held_for_sale?: number | null;
  // P&L — Tax
  tax_charge?: number | null;
  // Trading / financial operations (ROF, bank basis) + FX, isolated from the
  // 4701 P&L for benchmarking against the CNMV securities-firms market.
  rof?: number | null;
  fx_result?: number | null;
  // Derived — P&L Waterfall
  trading_and_other?: number | null;
  net_operating_income?: number | null;
  total_provisions_impairments?: number | null;
  effective_tax_rate_pct?: number | null;
  cost_of_risk_bps?: number | null;
  // Balance sheet — Assets
  total_assets?: number | null;
  cash_and_central_bank?: number | null;
  securities_fvoci?: number | null;
  assets_amortized_cost?: number | null;
  intangible_assets?: number | null;
  // Balance sheet — Liabilities
  total_liabilities?: number | null;
  total_deposits?: number | null;
  interbank_deposits?: number | null;
  client_deposits?: number | null;
  // Balance sheet — Equity
  total_equity?: number | null;
  // Derived — Core KPIs
  net_fee_income?: number | null;
  fee_mix_pct?: number | null;
  cost_to_income_pct?: number | null;
  roe_pct?: number | null;
  roa_pct?: number | null;
  nii_sensitivity_bps?: number | null;
  opex_assets_bps?: number | null;
  tangible_equity?: number | null;
  tangible_equity_ratio_pct?: number | null;
  // Derived — Treasury & Balance Sheet
  earning_asset_yield_pct?: number | null;
  funding_cost_pct?: number | null;
  interest_spread_pct?: number | null;
  liquidity_ratio_pct?: number | null;
  client_funding_ratio_pct?: number | null;
  // Derived — Efficiency
  staff_costs_pct?: number | null;
  jaws_ratio?: number | null;
  // OCI Statement (4702 — quarterly + annual)
  other_comprehensive_income?: number | null;
  total_comprehensive_income?: number | null;
  // Equity Statement (6794 ECPN — annual only)
  equity_opening?: number | null;
  dividends_paid?: number | null;
  capital_increase?: number | null;
  capital_other_instruments?: number | null;
  buybacks?: number | null;
  business_combination_equity?: number | null;
  other_equity_movements?: number | null;
  // Derived — Capital & Payout
  payout_ratio_pct?: number | null;
  retention_rate_pct?: number | null;
  dividend_yield_on_equity_pct?: number | null;
  // YTD (partial-year) support: raw same-period prior-year snapshot, attached only
  // to a YTD year's entry so growth can be measured like-for-like (H1 vs H1).
  ytd_prior?: EntityMetrics | null;
}

// Describes a partial (year-to-date) entry in the annual dataset. Present in
// AnnualJSON._metadata.ytd keyed by the calendar year (e.g. "2026").
export interface YtdMeta {
  period: string; // source BdE period, e.g. "202606"
  months: number; // months of data covered, e.g. 6 for H1
  label: string; // display label, e.g. "H1 2026"
  quarters: string[]; // quarter labels covered, e.g. ["2026-Q1", "2026-Q2"]
}

export type PeriodData = Record<EntityName, EntityMetrics>;

export interface AnnualJSON {
  _metadata: {
    description: string;
    source: string;
    entities: string[];
    years: number[];
    ytd?: Record<string, YtdMeta>;
  };
  data: Record<string, PeriodData>;
}

export interface QuarterlyJSON {
  _metadata: {
    description: string;
    source: string;
    entities: string[];
  };
  quarters: string[];
  data: Record<string, PeriodData>;
}

export type MetricKey = keyof EntityMetrics;

export interface KPIDef {
  key: MetricKey;
  label: string;
  unit: string;
  format: (v: number) => string;
  higherIsBetter: boolean;
  description: string;
  compute?: (annual: AnnualJSON, entity: EntityName, year: string) => number | null;
  // The metric's value is itself a YoY growth/change figure. In a YTD year its
  // headline is already H1-vs-H1, so the card shows the basis rather than a delta.
  growthRate?: boolean;
}

export interface Commentary {
  type: "insight" | "warning" | "recommendation";
  title: string;
  text: string;
}

export type TabId = "summary" | "income_statement" | "efficiency" | "profitability" | "treasury" | "quarterly" | "capital_payout";
