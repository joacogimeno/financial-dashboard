import { useState } from "react";
import type { AnnualJSON, EntityName, EntityMetrics, MetricKey } from "../lib/types";
import WaterfallChart from "../components/WaterfallChart";
import TrendChart from "../components/TrendChart";
import PeerTable from "../components/PeerTable";

interface Props {
  annual: AnnualJSON;
  entity: EntityName;
}

interface PLRow {
  key: MetricKey | null;
  label: string;
  indent?: boolean;
  isSubtotal?: boolean;
  isSeparator?: boolean;
  negate?: boolean;
  compute?: (d: EntityMetrics) => number | null;
}

const PL_ROWS: PLRow[] = [
  { key: "interest_income_gross", label: "Interest Income (Gross)" },
  { key: "interest_expenses", label: "(Interest Expenses)", negate: true },
  { key: "nii", label: "A) NET INTEREST INCOME", isSubtotal: true },
  { key: "net_fee_income", label: "Net Fee Income" },
  { key: "trading_and_other", label: "Trading & Other Income" },
  { key: "gross_margin", label: "B) GROSS MARGIN", isSubtotal: true },
  { key: "admin_expenses", label: "(Admin Expenses)", negate: true },
  { key: "staff_costs", label: "of which: Staff Costs", indent: true, negate: true },
  { key: "other_admin", label: "of which: Other Admin", indent: true, negate: true },
  {
    key: null,
    label: "EBITDA",
    isSubtotal: true,
    compute: (d) => {
      const noi = d.net_operating_income as number | null | undefined;
      const dep = d.depreciation as number | null | undefined;
      if (noi == null || dep == null) return null;
      return noi + Math.abs(dep);
    },
  },
  { key: "depreciation", label: "(Depreciation & Amort.)", negate: true, indent: true },
  { key: "net_operating_income", label: "NET OPERATING INCOME (EBIT)", isSubtotal: true },
  { key: "provisions", label: "(Provisions)", negate: true },
  { key: "impairment_financial_assets", label: "(Impairment Fin. Assets)", negate: true },
  { key: "impairment_subsidiaries", label: "(Impairment Subsidiaries)", negate: true },
  { key: "impairment_non_financial", label: "(Other Impairments)", negate: true },
  { key: "gains_disposal_nfa", label: "Gains on Disposal NFA" },
  { key: "gains_held_for_sale", label: "Gains Held for Sale" },
  { key: "pre_tax_profit", label: "C) PRE-TAX PROFIT", isSubtotal: true },
  { key: "tax_charge", label: "(Tax)", negate: true },
  { key: "net_profit", label: "E) NET PROFIT", isSubtotal: true },
  { key: null, label: "", isSeparator: true },
  { key: "effective_tax_rate_pct", label: "Effective Tax Rate" },
  { key: "cost_of_risk_bps", label: "Cost of Risk (bps)" },
];

function fmtVal(v: number | null | undefined, key: MetricKey | null): string {
  if (v == null) return "—";
  if (key === "effective_tax_rate_pct") return `${v.toFixed(1)}%`;
  if (key === "cost_of_risk_bps") return `${v.toFixed(1)}`;
  return `€${v.toFixed(1)}M`;
}

function yoyPct(curr: number | null | undefined, prev: number | null | undefined): string | null {
  if (curr == null || prev == null || prev === 0) return null;
  const pct = ((curr - prev) / Math.abs(prev)) * 100;
  return `${pct > 0 ? "+" : ""}${pct.toFixed(0)}%`;
}

export default function IncomeStatement({ annual, entity }: Props) {
  const years = annual._metadata.years.map(String);
  const latestYear = years[years.length - 1];
  const [selectedYear, setSelectedYear] = useState(latestYear);
  const selectedData = annual.data[selectedYear]?.[entity] ?? ({} as EntityMetrics);

  // Summary cards
  const feeMix = selectedData.fee_mix_pct;
  const costToIncome = selectedData.cost_to_income_pct;
  const jaws = selectedData.jaws_ratio;
  const ebitda =
    selectedData.net_operating_income != null && selectedData.depreciation != null
      ? (selectedData.net_operating_income as number) + Math.abs(selectedData.depreciation as number)
      : null;

  return (
    <div className="space-y-8">
      {/* Year Selector */}
      <div className="flex items-center gap-4">
        <label className="text-sm text-slate-400 font-medium">Year:</label>
        <div className="flex gap-1">
          {years.map((y) => (
            <button
              key={y}
              onClick={() => setSelectedYear(y)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                y === selectedYear
                  ? "bg-blue-600 text-white"
                  : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-300"
              }`}
            >
              {y}
            </button>
          ))}
        </div>
      </div>

      {/* Waterfall Chart */}
      <WaterfallChart data={selectedData} />

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
          <p className="text-xs text-slate-400 uppercase tracking-wider">Fee Mix</p>
          <p className="text-2xl font-bold text-blue-300 mt-1">
            {feeMix != null ? `${feeMix.toFixed(1)}%` : "—"}
          </p>
          <p className="text-xs text-slate-500 mt-1">Net Fee Income / Gross Margin</p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
          <p className="text-xs text-slate-400 uppercase tracking-wider">Cost-to-Income</p>
          <p className="text-2xl font-bold text-blue-300 mt-1">
            {costToIncome != null ? `${costToIncome.toFixed(1)}%` : "—"}
          </p>
          <p className="text-xs text-slate-500 mt-1">(|Admin| + |D&A|) / Gross Margin</p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
          <p className="text-xs text-slate-400 uppercase tracking-wider">Operating Leverage (Jaws)</p>
          <p className={`text-2xl font-bold mt-1 ${jaws != null && jaws >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {jaws != null ? `${jaws >= 0 ? "+" : ""}${jaws.toFixed(1)}pp` : "—"}
          </p>
          <p className="text-xs text-slate-500 mt-1">YoY Gross Margin growth - YoY operating cost growth</p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
          <p className="text-xs text-slate-400 uppercase tracking-wider">EBITDA</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1">
            {ebitda != null ? `€${ebitda.toFixed(1)}M` : "—"}
          </p>
          <p className="text-xs text-slate-500 mt-1">Op. Profit + D&A</p>
        </div>
      </div>

      {/* Detailed P&L Table */}
      <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-700/50">
          <h3 className="text-sm font-semibold text-slate-300">
            {entity} — Income Statement ({years[0]}–{latestYear})
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700/50">
                <th className="text-left px-5 py-3 text-xs text-slate-400 uppercase tracking-wider font-medium w-[260px]">
                  Line Item
                </th>
                {years.map((y) => (
                  <th
                    key={y}
                    className="text-right px-4 py-3 text-xs text-slate-400 uppercase tracking-wider font-medium"
                  >
                    {y}
                  </th>
                ))}
                <th className="text-right px-4 py-3 text-xs text-slate-400 uppercase tracking-wider font-medium">
                  YoY %
                </th>
              </tr>
            </thead>
            <tbody>
              {PL_ROWS.map((row, idx) => {
                if (row.isSeparator) {
                  return (
                    <tr key={idx} className="border-t border-slate-600/50">
                      <td colSpan={years.length + 2} className="py-1" />
                    </tr>
                  );
                }

                const values = years.map((y) => {
                  const d = annual.data[y]?.[entity];
                  if (!d) return null;
                  if (row.compute) return row.compute(d);
                  return row.key ? (d[row.key] as number | null | undefined) ?? null : null;
                });

                const latestVal = values[values.length - 1];
                const priorVal = values.length > 1 ? values[values.length - 2] : null;
                const yoy = yoyPct(latestVal, priorVal);

                return (
                  <tr
                    key={idx}
                    className={`border-b border-slate-700/30 ${
                      row.isSubtotal ? "bg-slate-700/20" : idx % 2 === 0 ? "bg-slate-800/10" : ""
                    } hover:bg-slate-700/20`}
                  >
                    <td
                      className={`px-5 py-2.5 ${
                        row.isSubtotal
                          ? "font-bold text-slate-200"
                          : row.indent
                          ? "pl-10 text-slate-400 text-xs"
                          : "text-slate-300"
                      }`}
                    >
                      {row.label}
                    </td>
                    {values.map((v, vi) => (
                      <td
                        key={vi}
                        className={`text-right px-4 py-2.5 font-mono text-sm ${
                          row.isSubtotal ? "font-bold text-slate-200" : "text-slate-300"
                        } ${v != null && v < 0 ? "text-red-400" : ""}`}
                      >
                        {fmtVal(v, row.key)}
                      </td>
                    ))}
                    <td className="text-right px-4 py-2.5 font-mono text-xs">
                      {yoy ? (
                        <span
                          style={{
                            color: yoy.startsWith("+") ? "#34d399" : yoy.startsWith("-") ? "#f87171" : "#94a3b8",
                          }}
                        >
                          {yoy}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Provisions & Impairments Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TrendChart
          data={annual}
          metric="total_provisions_impairments"
          title="Total Provisions & Impairments (€M)"
          unit="M"
          formatValue={(v) => `€${v.toFixed(1)}M`}
          highlightEntity={entity}
        />
        <TrendChart
          data={annual}
          metric="effective_tax_rate_pct"
          title="Effective Tax Rate (%)"
          unit="%"
          formatValue={(v) => `${v.toFixed(1)}%`}
          highlightEntity={entity}
        />
      </div>

      {/* Peer P&L Comparison */}
      <PeerTable
        data={annual}
        year={latestYear}
        highlightEntity={entity}
        title={`Peer P&L Comparison — FY ${latestYear}`}
        columns={[
          { key: "gross_margin", label: "Gross Margin", format: (v) => `€${v.toFixed(0)}M`, higherIsBetter: true },
          { key: "net_operating_income", label: "Op. Profit", format: (v) => `€${v.toFixed(0)}M`, higherIsBetter: true },
          { key: "total_provisions_impairments", label: "Prov. & Imp.", format: (v) => `€${v.toFixed(1)}M`, higherIsBetter: false },
          { key: "pre_tax_profit", label: "Pre-Tax", format: (v) => `€${v.toFixed(0)}M`, higherIsBetter: true },
          { key: "effective_tax_rate_pct", label: "Tax Rate", format: (v) => `${v.toFixed(1)}%`, higherIsBetter: false },
          { key: "net_profit", label: "Net Profit", format: (v) => `€${v.toFixed(0)}M`, higherIsBetter: true },
        ]}
      />

      {/* Legacy Revenue Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TrendChart
          data={annual}
          metric="net_fee_income"
          title="Net Fee Income Trend (€M)"
          unit="M"
          formatValue={(v) => `€${v.toFixed(0)}M`}
          highlightEntity={entity}
        />
        <TrendChart
          data={annual}
          metric="nii"
          title="Net Interest Income Trend (€M)"
          unit="M"
          formatValue={(v) => `€${v.toFixed(0)}M`}
          highlightEntity={entity}
        />
      </div>

      {/* Fee Mix */}
      <TrendChart
        data={annual}
        metric="fee_mix_pct"
        title="Fee Revenue Mix — Net Fee Income as % of Gross Margin"
        unit="%"
        formatValue={(v) => `${v.toFixed(0)}%`}
        highlightEntity={entity}
        height={280}
      />
    </div>
  );
}
