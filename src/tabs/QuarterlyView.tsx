import { useState } from "react";
import type { QuarterlyJSON, EntityName, EntityMetrics } from "../lib/types";
import { ENTITY_NAMES } from "../lib/types";
import { ENTITY_COLORS } from "../lib/colors";
import TrendChart from "../components/TrendChart";

interface Props {
  quarterly: QuarterlyJSON;
  entity: EntityName;
}

interface QRow {
  key: string | null;
  label: string;
  format?: (v: number) => string;
  isSubtotal?: boolean;
  indent?: boolean;
  isSeparator?: boolean;
  lowerIsBetter?: boolean; // costs, provisions, C/I: growth = bad = red
  compute?: (d: EntityMetrics) => number | null;
}

const eurFmt = (v: number) => `€${Math.abs(v).toFixed(1)}M`;
const pctFmt = (v: number) => `${v.toFixed(1)}%`;

const Q_ROWS: QRow[] = [
  { key: "nii",               label: "Net Interest Income",       format: eurFmt },
  { key: "net_fee_income",    label: "Net Fee Income",            format: eurFmt },
  { key: "trading_and_other", label: "Trading & Other",           format: eurFmt },
  { key: "gross_margin",      label: "GROSS MARGIN",              format: eurFmt, isSubtotal: true },
  { key: "admin_expenses",    label: "(Admin Expenses)",          format: eurFmt, lowerIsBetter: true },
  { key: "staff_costs",       label: "of which: Staff Costs",     format: eurFmt, indent: true, lowerIsBetter: true },
  { key: "other_admin",       label: "of which: Other Admin",     format: eurFmt, indent: true, lowerIsBetter: true },
  {
    key: null,
    label: "EBITDA",
    format: eurFmt,
    isSubtotal: true,
    compute: (d) => {
      const noi = d.net_operating_income as number | null | undefined;
      const dep = d.depreciation as number | null | undefined;
      if (noi == null || dep == null) return null;
      return noi + Math.abs(dep);
    },
  },
  { key: "depreciation",                label: "(Depreciation)",        format: eurFmt, indent: true, lowerIsBetter: true },
  { key: "net_operating_income",         label: "OPERATING PROFIT",      format: eurFmt, isSubtotal: true },
  { key: "total_provisions_impairments", label: "(Prov. & Impairments)", format: eurFmt, lowerIsBetter: true },
  { key: "pre_tax_profit",               label: "PRE-TAX PROFIT",        format: eurFmt, isSubtotal: true },
  { key: "tax_charge",                   label: "(Tax)",                  format: eurFmt, lowerIsBetter: true },
  { key: "net_profit",                   label: "NET PROFIT",             format: eurFmt, isSubtotal: true },
  { key: null, label: "", isSeparator: true },
  { key: "cost_to_income_pct", label: "Cost-to-Income",      format: pctFmt, lowerIsBetter: true },
  { key: "roe_pct",            label: "ROE (annualized est.)", format: pctFmt },
];

function getVal(row: QRow, d: EntityMetrics | undefined): number | null {
  if (!d) return null;
  if (row.compute) return row.compute(d);
  if (!row.key) return null;
  return (d[row.key as keyof EntityMetrics] as number | null | undefined) ?? null;
}

export default function QuarterlyView({ quarterly, entity }: Props) {
  const quarters = quarterly.quarters;
  const [selectedQ, setSelectedQ] = useState(quarters[quarters.length - 1]);

  const qData = quarterly.data[selectedQ];

  const qIdx = quarters.indexOf(selectedQ);
  const priorQ = qIdx > 0 ? quarters[qIdx - 1] : null;
  const priorData = priorQ ? quarterly.data[priorQ] : null;

  return (
    <div className="space-y-8">
      {/* Quarter Selector */}
      <div className="flex items-center gap-4 flex-wrap">
        <label className="text-sm text-slate-400 font-medium">Select Quarter:</label>
        <div className="flex gap-1 flex-wrap">
          {quarters.map((q) => (
            <button
              key={q}
              onClick={() => setSelectedQ(q)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                q === selectedQ
                  ? "bg-blue-600 text-white"
                  : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-300"
              }`}
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Quarterly P&L Table */}
      <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-700/50">
          <h3 className="text-sm font-semibold text-slate-300">
            Standalone Quarter P&L — {selectedQ}
            {priorQ && <span className="text-slate-500 font-normal ml-2">(vs {priorQ})</span>}
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700/50">
                <th className="text-left px-5 py-3 text-xs text-slate-400 uppercase tracking-wider font-medium w-[220px]">
                  Line Item
                </th>
                {ENTITY_NAMES.map((eName) => (
                  <th
                    key={eName}
                    className="text-right px-4 py-3 text-xs text-slate-400 uppercase tracking-wider font-medium"
                  >
                    <span className="flex items-center justify-end gap-1.5">
                      <span
                        className="w-2 h-2 rounded-full inline-block"
                        style={{ background: ENTITY_COLORS[eName] }}
                      />
                      {eName}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Q_ROWS.map((row, idx) => {
                if (row.isSeparator) {
                  return (
                    <tr key={idx}>
                      <td colSpan={ENTITY_NAMES.length + 1} className="py-1 border-t border-slate-600/40" />
                    </tr>
                  );
                }

                return (
                  <tr
                    key={idx}
                    className={`border-b border-slate-700/30 ${
                      row.isSubtotal
                        ? "bg-slate-700/25"
                        : row.indent
                        ? ""
                        : "hover:bg-slate-700/20"
                    }`}
                  >
                    <td
                      className={
                        row.isSubtotal
                          ? "px-5 py-2.5 font-bold text-slate-200 tracking-wide text-xs uppercase"
                          : row.indent
                          ? "pl-9 py-2 text-xs text-slate-500"
                          : "px-5 py-2.5 text-slate-300"
                      }
                    >
                      {row.label}
                    </td>
                    {ENTITY_NAMES.map((eName) => {
                      const v = getVal(row, qData?.[eName]);
                      const pv = priorData ? getVal(row, priorData[eName]) : null;
                      const isHighlighted = eName === entity;

                      // Use absolute values for QoQ so sign always means "grew/shrank"
                      // regardless of whether the metric is stored as negative
                      let qoq: number | null = null;
                      if (v != null && pv != null && Math.abs(pv) !== 0) {
                        qoq = ((Math.abs(v) - Math.abs(pv)) / Math.abs(pv)) * 100;
                      }

                      const fmt = row.format ?? eurFmt;
                      const qoqGood = row.lowerIsBetter ? qoq != null && qoq < 0 : qoq != null && qoq > 0;
                      const qoqBad  = row.lowerIsBetter ? qoq != null && qoq > 0 : qoq != null && qoq < 0;

                      return (
                        <td
                          key={eName}
                          className={`text-right px-4 font-mono ${
                            row.indent ? "py-2 text-xs text-slate-500" : "py-2.5 text-sm"
                          } ${
                            row.isSubtotal
                              ? "font-bold text-slate-200"
                              : isHighlighted
                              ? "text-blue-200 font-semibold bg-blue-950/20"
                              : "text-slate-300"
                          }`}
                        >
                          {v != null ? fmt(v) : "—"}
                          {qoq != null && (
                            <span
                              className="ml-1.5 text-[10px] font-normal"
                              style={{ color: qoqGood ? "#34d399" : qoqBad ? "#f87171" : "#94a3b8" }}
                            >
                              {qoq > 0 ? "+" : ""}
                              {qoq.toFixed(0)}%
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quarterly Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TrendChart
          data={quarterly}
          metric="gross_margin"
          title="Gross Margin by Quarter (€M)"
          formatValue={(v) => `€${v.toFixed(0)}M`}
          highlightEntity={entity}
          height={260}
        />
        <TrendChart
          data={quarterly}
          metric="cost_to_income_pct"
          title="Cost-to-Income by Quarter (%)"
          formatValue={(v) => `${v.toFixed(0)}%`}
          highlightEntity={entity}
          height={260}
        />
      </div>
    </div>
  );
}
