import { useState } from "react";
import type { EsiAnnualJSON, EsiQuarterlyJSON } from "../../lib/esiTypes";
import EsiLeagueTable from "../../components/esi/EsiLeagueTable";
import CommentaryBox from "../../components/CommentaryBox";
import { esiCommentary } from "../../lib/esiCommentary";

interface Props {
  annual: EsiAnnualJSON;
  quarterly: EsiQuarterlyJSON;
}

export default function PeerClientLeague({ annual, quarterly }: Props) {
  const years = annual._metadata.years.map(String);
  const [year, setYear] = useState(years[years.length - 1]);
  const notes = esiCommentary(annual, year).filter(
    (c) => c.type === "recommendation" || c.title.startsWith("Tag Inversis"),
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">Peer &amp; client league table</h2>
          <p className="text-sm text-slate-400 mt-1">
            Which firms are outperforming — sort any column, filter, and <span className="text-slate-300">click a firm for its quarterly evolution</span>.
            Client rows are highlighted.
          </p>
        </div>
        <select value={year} onChange={(e) => setYear(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200">
          {years.map((y) => <option key={y} value={y}>{annual._metadata.ytd?.[y] ? `${y} YTD` : `FY ${y}`}</option>)}
        </select>
      </div>

      <EsiLeagueTable data={annual} quarterly={quarterly} year={year} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {notes.map((c, i) => <CommentaryBox key={i} commentary={c} />)}
      </div>
    </div>
  );
}
