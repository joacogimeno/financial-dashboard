import { useState } from "react";
import type { QuarterlyJSON, EntityName } from "../lib/types";
import { ENTITY_NAMES } from "../lib/types";
import { ENTITY_COLORS } from "../lib/colors";
import TrendChart from "../components/TrendChart";

interface Props {
  quarterly: QuarterlyJSON;
  entity: EntityName;
}

export default function QuarterlyView({ quarterly, entity }: Props) {
  const quarters = quarterly.quarters;
  const [selectedQ, setSelectedQ] = useState(quarters[quarters.length - 1]);

  const qData = quarterly.data[selectedQ];

  // Find prior quarter for QoQ comparison
  const qIdx = quarters.indexOf(selectedQ);
  const priorQ = qIdx > 0 ? quarters[qIdx - 1] : null;
  const priorData = priorQ ? quarterly.data[priorQ] : null;

  const metrics: {
    key: string;
    label: string;
    format: (v: number) => string;
  }[] = [
    { key: "nii", label: "Net Interest Income", format: (v) => `\u20AC${v.toFixed(1)}M` },
    { key: "net_fee_income", label: "Net Fee Income", format: (v) => `\u20AC${v.toFixed(1)}M` },
    { key: "gross_margin", label: "Gross Margin", format: (v) => `\u20AC${v.toFixed(1)}M` },
    { key: "admin_expenses", label: "Admin Expenses", format: (v) => `\u20AC${Math.abs(v).toFixed(1)}M` },
    { key: "net_operating_income", label: "Operating Profit", format: (v) => `\u20AC${v.toFixed(1)}M` },
    { key: "provisions", label: "Provisions", format: (v) => `\u20AC${v.toFixed(1)}M` },
    { key: "total_provisions_impairments", label: "Prov. & Impairm.", format: (v) => `\u20AC${v.toFixed(1)}M` },
    { key: "pre_tax_profit", label: "Pre-Tax Profit", format: (v) => `\u20AC${v.toFixed(1)}M` },
    { key: "tax_charge", label: "Tax", format: (v) => `\u20AC${v.toFixed(1)}M` },
    { key: "net_profit", label: "Net Profit", format: (v) => `\u20AC${v.toFixed(1)}M` },
    { key: "cost_to_income_pct", label: "Cost-to-Income", format: (v) => `${v.toFixed(1)}%` },
    { key: "roe_pct", label: "ROE (annualized est.)", format: (v) => `${v.toFixed(1)}%` },
  ];

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
                <th className="text-left px-5 py-3 text-xs text-slate-400 uppercase tracking-wider font-medium">
                  Metric
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
              {metrics.map((m) => (
                <tr key={m.key} className="border-b border-slate-700/30 hover:bg-slate-700/20">
                  <td className="px-5 py-3 text-slate-300 font-medium">{m.label}</td>
                  {ENTITY_NAMES.map((eName) => {
                    const v = (qData?.[eName]?.[m.key as keyof typeof qData.Inversis] as number) ?? null;
                    const pv = priorData
                      ? ((priorData[eName]?.[m.key as keyof typeof priorData.Inversis] as number) ?? null)
                      : null;
                    const isHighlighted = eName === entity;

                    let qoq: number | null = null;
                    if (v != null && pv != null && pv !== 0) {
                      qoq = ((v - pv) / Math.abs(pv)) * 100;
                    }

                    return (
                      <td
                        key={eName}
                        className={`text-right px-4 py-3 font-mono text-sm ${
                          isHighlighted ? "text-blue-200 font-semibold bg-blue-950/20" : "text-slate-300"
                        }`}
                      >
                        {v != null ? m.format(v) : "\u2014"}
                        {qoq != null && (
                          <span
                            className="ml-1.5 text-[10px]"
                            style={{ color: qoq > 0 ? "#34d399" : qoq < 0 ? "#f87171" : "#94a3b8" }}
                          >
                            {qoq > 0 ? "+" : ""}
                            {qoq.toFixed(0)}%
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quarterly Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TrendChart
          data={quarterly}
          metric="gross_margin"
          title="Gross Margin by Quarter (\u20ACM)"
          formatValue={(v) => `\u20AC${v.toFixed(0)}M`}
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
