import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { AnnualJSON, EntityName } from "../lib/types";
import { ENTITY_NAMES } from "../lib/types";
import TrendChart from "../components/TrendChart";
import PeerTable from "../components/PeerTable";
import ChartTooltip from "../components/ChartTooltip";

interface Props {
  annual: AnnualJSON;
  entity: EntityName;
}

export default function Efficiency({ annual, entity }: Props) {
  const years = annual._metadata.years.map(String);
  const latestYear = years[years.length - 1];
  const jawsYears = years.filter((y) =>
    ENTITY_NAMES.some((e) => annual.data[y]?.[e]?.jaws_ratio != null)
  );
  const annualForJaws: AnnualJSON = {
    ...annual,
    _metadata: {
      ...annual._metadata,
      years: (jawsYears.length > 0 ? jawsYears : years).map(Number),
    },
  };

  // Gap-to-best analysis
  const bestCti = Math.min(
    ...ENTITY_NAMES.map((e) => (annual.data[latestYear]?.[e]?.cost_to_income_pct as number) ?? 999)
  );
  const entityCti = (annual.data[latestYear]?.[entity]?.cost_to_income_pct as number) ?? 0;
  const gap = entityCti - bestCti;

  // Jaws ratio
  const entityJaws = (annual.data[latestYear]?.[entity]?.jaws_ratio as number) ?? null;

  // Admin cost breakdown data for selected entity
  const breakdownData = years.map((y) => {
    const d = annual.data[y]?.[entity];
    return {
      year: y,
      "Staff Costs": d?.staff_costs != null ? Math.abs(d.staff_costs as number) : 0,
      "Other Admin": d?.other_admin != null ? Math.abs(d.other_admin as number) : 0,
      Depreciation: d?.depreciation != null ? Math.abs(d.depreciation as number) : 0,
    };
  });

  return (
    <div className="space-y-8">
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
          <p className="text-xs text-slate-400 uppercase tracking-wider">{entity} C/I Ratio</p>
          <p className="text-2xl font-bold text-blue-300 mt-1">{entityCti.toFixed(1)}%</p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
          <p className="text-xs text-slate-400 uppercase tracking-wider">Best-in-Class</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1">{bestCti.toFixed(1)}%</p>
          <p className="text-xs text-slate-500 mt-1">
            {ENTITY_NAMES.find(
              (e) => (annual.data[latestYear]?.[e]?.cost_to_income_pct as number) === bestCti
            )}
          </p>
        </div>
        <div className={`rounded-xl p-5 border ${gap > 0 ? "bg-red-950/20 border-red-500/30" : "bg-emerald-950/20 border-emerald-500/30"}`}>
          <p className="text-xs text-slate-400 uppercase tracking-wider">Gap to Close</p>
          <p className={`text-2xl font-bold mt-1 ${gap > 0 ? "text-red-400" : "text-emerald-400"}`}>{gap.toFixed(1)}pp</p>
          <p className="text-xs text-slate-500 mt-1">{gap > 0 ? "Improvement needed" : "Leading position"}</p>
        </div>
        <div className={`rounded-xl p-5 border ${entityJaws !== null && entityJaws > 0 ? "bg-emerald-950/20 border-emerald-500/30" : "bg-red-950/20 border-red-500/30"}`}>
          <p className="text-xs text-slate-400 uppercase tracking-wider">Jaws Ratio</p>
          <p className={`text-2xl font-bold mt-1 ${entityJaws !== null && entityJaws > 0 ? "text-emerald-400" : "text-red-400"}`}>
            {entityJaws !== null ? `${entityJaws > 0 ? "+" : ""}${entityJaws.toFixed(1)}pp` : "\u2014"}
          </p>
          <p className="text-xs text-slate-500 mt-1">Revenue vs cost growth</p>
        </div>
      </div>

      {/* Cost-to-Income Trend */}
      <TrendChart
        data={annual}
        metric="cost_to_income_pct"
        title="Cost-to-Income Ratio Trend (%)"
        unit="%"
        formatValue={(v) => `${v.toFixed(0)}%`}
        highlightEntity={entity}
      />

      {/* Jaws Ratio Trend */}
      <TrendChart
        data={annualForJaws}
        metric="jaws_ratio"
        title="Jaws Ratio (pp) &mdash; Revenue Growth minus Cost Growth (positive = operating leverage)"
        unit="pp"
        formatValue={(v) => `${v > 0 ? "+" : ""}${v.toFixed(1)}pp`}
        highlightEntity={entity}
        height={280}
      />

      {/* Staff Costs % of Gross Margin */}
      <TrendChart
        data={annual}
        metric="staff_costs_pct"
        title="Staff Costs as % of Gross Margin"
        unit="%"
        formatValue={(v) => `${v.toFixed(1)}%`}
        highlightEntity={entity}
        height={280}
      />

      {/* Admin Cost Breakdown */}
      <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-5">
        <h3 className="text-sm font-semibold text-slate-300 mb-4">
          {entity} Operating Cost Breakdown ({"\u20AC"}M)
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={breakdownData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
            <XAxis dataKey="year" tick={{ fill: "#94a3b8", fontSize: 12 }} />
            <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} tickFormatter={(v) => `\u20AC${v}M`} />
            <Tooltip content={<ChartTooltip formatter={(v) => `\u20AC${v.toFixed(1)}M`} />} />
            <Legend wrapperStyle={{ fontSize: 12 }} iconType="rect" />
            <Bar dataKey="Staff Costs" stackId="a" fill="#22d3ee" radius={[0, 0, 0, 0]} />
            <Bar dataKey="Other Admin" stackId="a" fill="#60a5fa" radius={[0, 0, 0, 0]} />
            <Bar dataKey="Depreciation" stackId="a" fill="#818cf8" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* OpEx / Assets */}
      <TrendChart
        data={annual}
        metric="opex_assets_bps"
        title="OpEx / Total Assets (bps) &mdash; Scale Efficiency"
        unit=" bps"
        formatValue={(v) => `${v.toFixed(0)}`}
        highlightEntity={entity}
        height={280}
      />

      {/* Peer Table */}
      <PeerTable
        data={annual}
        year={latestYear}
        highlightEntity={entity}
        title={`Efficiency Metrics — FY ${latestYear}`}
        columns={[
          { key: "cost_to_income_pct", label: "C/I Ratio", format: (v) => `${v.toFixed(1)}%`, higherIsBetter: false },
          { key: "jaws_ratio", label: "Jaws", format: (v) => `${v > 0 ? "+" : ""}${v.toFixed(1)}pp`, higherIsBetter: true },
          { key: "staff_costs_pct", label: "Staff/GM", format: (v) => `${v.toFixed(1)}%`, higherIsBetter: false },
          { key: "admin_expenses", label: "Admin", format: (v) => `\u20AC${Math.abs(v).toFixed(1)}M`, higherIsBetter: false },
          { key: "opex_assets_bps", label: "OpEx/Assets", format: (v) => `${v.toFixed(0)} bps`, higherIsBetter: false },
        ]}
      />
    </div>
  );
}
