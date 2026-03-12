import type { AnnualJSON, EntityName } from "../lib/types";
import { useState } from "react";
import { KPI_DEFS } from "../lib/kpis";
import { generateCommentary, getEntityRank } from "../lib/commentary";
import KPICard from "../components/KPICard";
import CommentaryBox from "../components/CommentaryBox";
import PeerTable from "../components/PeerTable";

interface Props {
  annual: AnnualJSON;
  entity: EntityName;
}

export default function ExecutiveSummary({ annual, entity }: Props) {
  const years = annual._metadata.years.map(String);
  const latestYear = years[years.length - 1];
  const [selectedYear, setSelectedYear] = useState(latestYear);
  const commentaries = generateCommentary(annual, entity, selectedYear);

  return (
    <div className="space-y-8">
      {/* KPI Cards */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-200">
            Key Performance Indicators — FY {selectedYear}
          </h2>
          <div className="flex items-center gap-1">
            {years.map((y) => (
              <button
                key={y}
                onClick={() => setSelectedYear(y)}
                className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                  y === selectedYear
                    ? "bg-blue-500/20 text-blue-400 ring-1 ring-blue-400/50"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/50"
                }`}
              >
                {y}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {KPI_DEFS.map((kpi) => {
            const ranked = getEntityRank(annual, selectedYear, kpi.key, kpi.higherIsBetter, kpi.compute);
            const entityRank = ranked.find((r) => r.entity === entity)?.rank ?? 0;
            return (
              <KPICard
                key={kpi.label}
                kpi={kpi}
                data={annual}
                entity={entity}
                selectedYear={selectedYear}
                peerRank={entityRank}
                peerTotal={ranked.length}
              />
            );
          })}
        </div>
      </div>

      {/* AI Commentary */}
      <div>
        <h2 className="text-lg font-semibold text-slate-200 mb-4">
          Automated Intelligence
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {commentaries.map((c, i) => (
            <CommentaryBox key={i} commentary={c} />
          ))}
        </div>
      </div>

      {/* Peer Comparison Table */}
      <PeerTable
        data={annual}
        year={selectedYear}
        highlightEntity={entity}
        title={`Peer Comparison — FY ${selectedYear}`}
        columns={[
          { key: "gross_margin", label: "Gross Margin", format: (v) => `€${v.toFixed(1)}M`, higherIsBetter: true },
          { key: "net_fee_income", label: "Net Fee Inc.", format: (v) => `€${v.toFixed(1)}M`, higherIsBetter: true },
          { key: "cost_to_income_pct", label: "C/I Ratio", format: (v) => `${v.toFixed(1)}%`, higherIsBetter: false },
          { key: "roe_pct", label: "ROE", format: (v) => `${v.toFixed(1)}%`, higherIsBetter: true },
          { key: "net_profit", label: "Net Profit", format: (v) => `€${v.toFixed(1)}M`, higherIsBetter: true },
          { key: "tangible_equity_ratio_pct", label: "TE Ratio", format: (v) => `${v.toFixed(1)}%`, higherIsBetter: true },
        ]}
      />
    </div>
  );
}
