import type { AnnualJSON, EntityName } from "../lib/types";
import { ENTITY_NAMES } from "../lib/types";
import TrendChart from "../components/TrendChart";
import BarComparisonChart from "../components/BarComparisonChart";
import PeerTable from "../components/PeerTable";

interface Props {
  annual: AnnualJSON;
  entity: EntityName;
}

export default function Profitability({ annual, entity }: Props) {
  const years = annual._metadata.years.map(String);
  const latestYear = years[years.length - 1];
  const earliest = years[0];

  const roeStart = (annual.data[earliest]?.[entity]?.roe_pct as number) ?? 0;
  const roeEnd = (annual.data[latestYear]?.[entity]?.roe_pct as number) ?? 0;

  const npStart = (annual.data[earliest]?.[entity]?.net_profit as number) ?? 0;
  const npEnd = (annual.data[latestYear]?.[entity]?.net_profit as number) ?? 0;

  // Peer best ROE
  const bestRoeVal = Math.max(
    ...ENTITY_NAMES.map((e) => (annual.data[latestYear]?.[e]?.roe_pct as number) ?? -999)
  );
  const bestRoeEntity = ENTITY_NAMES.reduce((best, e) => {
    const v = (annual.data[latestYear]?.[e]?.roe_pct as number) ?? -999;
    const bestV = (annual.data[latestYear]?.[best]?.roe_pct as number) ?? -999;
    return v > bestV ? e : best;
  }, ENTITY_NAMES[0]);

  return (
    <div className="space-y-8">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
          <p className="text-xs text-slate-400 uppercase tracking-wider">{entity} ROE</p>
          <p className="text-2xl font-bold text-blue-300 mt-1">{roeEnd.toFixed(1)}%</p>
          <p className="text-xs text-slate-500 mt-1">
            {roeEnd > roeStart ? "\u25B2" : "\u25BC"} from {roeStart.toFixed(1)}% in {earliest}
          </p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
          <p className="text-xs text-slate-400 uppercase tracking-wider">Net Profit</p>
          <p className="text-2xl font-bold text-blue-300 mt-1">{`€${npEnd.toFixed(1)}M`}</p>
          <p className="text-xs text-slate-500 mt-1">
            from {`€${npStart.toFixed(1)}M`} in {earliest}
          </p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
          <p className="text-xs text-slate-400 uppercase tracking-wider">Peer Best ROE</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1">{bestRoeVal.toFixed(1)}%</p>
          <p className="text-xs text-slate-500 mt-1">{bestRoeEntity}</p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
          <p className="text-xs text-slate-400 uppercase tracking-wider">{entity} ROA</p>
          <p className="text-2xl font-bold text-blue-300 mt-1">
            {((annual.data[latestYear]?.[entity]?.roa_pct as number) ?? 0).toFixed(2)}%
          </p>
        </div>
      </div>

      {/* ROE Trend */}
      <TrendChart
        data={annual}
        metric="roe_pct"
        title="Return on Equity Trend (%)"
        unit="%"
        formatValue={(v) => `${v.toFixed(1)}%`}
        highlightEntity={entity}
      />

      {/* ROA Trend */}
      <TrendChart
        data={annual}
        metric="roa_pct"
        title="Return on Assets Trend (%)"
        unit="%"
        formatValue={(v) => `${v.toFixed(2)}%`}
        highlightEntity={entity}
        height={280}
      />

      {/* Net Profit Comparison */}
      <BarComparisonChart
        data={annual}
        year={latestYear}
        metric="net_profit"
        title={`Net Profit Comparison — FY ${latestYear} (€M)`}
        formatValue={(v) => `€${v.toFixed(0)}M`}
        highlightEntity={entity}
      />

      {/* Tangible Equity Ratio */}
      <TrendChart
        data={annual}
        metric="tangible_equity_ratio_pct"
        title="Tangible Equity Ratio — (Equity − Intangibles) / Total Assets (%)"
        unit="%"
        formatValue={(v) => `${v.toFixed(1)}%`}
        highlightEntity={entity}
        height={280}
      />

      {/* Tangible Equity Comparison */}
      <BarComparisonChart
        data={annual}
        year={latestYear}
        metric="tangible_equity"
        title={`Tangible Equity Comparison — FY ${latestYear} (€M)`}
        formatValue={(v) => `€${v.toFixed(0)}M`}
        highlightEntity={entity}
      />

      {/* Full Peer Table */}
      <PeerTable
        data={annual}
        year={latestYear}
        highlightEntity={entity}
        title={`Profitability & Solvency — FY ${latestYear}`}
        columns={[
          { key: "roe_pct", label: "ROE", format: (v) => `${v.toFixed(1)}%`, higherIsBetter: true },
          { key: "roa_pct", label: "ROA", format: (v) => `${v.toFixed(2)}%`, higherIsBetter: true },
          { key: "net_profit", label: "Net Profit", format: (v) => `€${v.toFixed(1)}M`, higherIsBetter: true },
          { key: "tangible_equity", label: "Tang. Equity", format: (v) => `€${v.toFixed(0)}M`, higherIsBetter: true },
          { key: "tangible_equity_ratio_pct", label: "TE Ratio", format: (v) => `${v.toFixed(1)}%`, higherIsBetter: true },
          { key: "effective_tax_rate_pct", label: "Eff. Tax Rate", format: (v) => `${v.toFixed(1)}%`, higherIsBetter: false },
        ]}
      />
    </div>
  );
}
