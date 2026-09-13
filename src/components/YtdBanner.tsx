import type { AnnualJSON } from "../lib/types";
import { ytdInfo, ytdNote } from "../lib/periods";

interface Props {
  annual: AnnualJSON;
  year: string;
}

// Small inline caption shown when the selected year is a partial (year-to-date)
// period, explaining how its figures are presented. Renders nothing otherwise.
export default function YtdBanner({ annual, year }: Props) {
  const info = ytdInfo(annual, year);
  if (!info) return null;
  return (
    <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-950/20 px-4 py-2.5">
      <span className="text-sm leading-none mt-0.5">🕐</span>
      <div>
        <span className="text-xs font-bold uppercase tracking-widest text-amber-400">
          {info.label} · Year-to-date
        </span>
        <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{ytdNote(annual, year)}</p>
      </div>
    </div>
  );
}
