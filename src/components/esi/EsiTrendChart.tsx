import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import type { EsiAnnualJSON, EsiQuarterlyJSON } from "../../lib/esiTypes";
import { esiColor, esiDisplayName, esiTag, INVERSIS } from "../../lib/esiEntities";
import { val, type DisplayKey } from "../../lib/esiKpis";
import ChartTooltip from "../ChartTooltip";

interface Props {
  data: EsiAnnualJSON | EsiQuarterlyJSON;
  metric: DisplayKey;
  title: string;
  entities: string[];
  formatValue?: (v: number) => string;
  highlight?: string;
  height?: number;
  // Rebase every series to 100 at its first non-null point — compares PACE not
  // level, so a single firm and a whole-market total sit on the same axis.
  indexed?: boolean;
}

function isAnnual(d: EsiAnnualJSON | EsiQuarterlyJSON): d is EsiAnnualJSON {
  return "years" in d._metadata;
}

export default function EsiTrendChart({
  data, metric, title, entities, formatValue, highlight = INVERSIS, height = 300, indexed = false,
}: Props) {
  const ytd = isAnnual(data) ? data._metadata.ytd : undefined;
  const periods = isAnnual(data) ? data._metadata.years.map(String) : data.quarters;
  const baseFmt = formatValue ?? ((v: number) => v.toFixed(1));
  const fmt = indexed ? (v: number) => v.toFixed(0) : baseFmt;

  // For indexed mode, find each entity's first non-null value as the base=100.
  const base: Record<string, number | null> = {};
  if (indexed) {
    for (const e of entities) {
      base[e] = null;
      for (const p of periods) {
        const v = val(data.data[p]?.[e], metric);
        if (v != null && v !== 0) { base[e] = v; break; }
      }
    }
  }

  const chartData = periods.map((p) => {
    const row: Record<string, string | number | null> = { period: ytd?.[p] ? `${p} YTD` : p };
    for (const e of entities) {
      const v = val(data.data[p]?.[e], metric);
      row[e] = indexed ? (v != null && base[e] ? (v / base[e]!) * 100 : null) : v;
    }
    return row;
  });

  return (
    <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-5">
      <h3 className="text-sm font-semibold text-slate-300 mb-4">
        {title}{indexed && <span className="text-slate-500 font-normal"> · indexed to 100</span>}
      </h3>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis dataKey="period" tick={{ fill: "#94a3b8", fontSize: 12 }} />
          <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} tickFormatter={(v) => fmt(v as number)} />
          <Tooltip content={<ChartTooltip formatter={(v: unknown) => fmt(v as number)} />} />
          <Legend wrapperStyle={{ fontSize: 12, color: "#94a3b8" }} iconType="circle" iconSize={8} />
          {entities.map((e) => (
            <Line
              key={e}
              type="monotone"
              dataKey={e}
              name={esiDisplayName(e)}
              stroke={esiColor(e)}
              strokeWidth={e === highlight ? 3 : 1.5}
              strokeDasharray={esiTag(e) === "average" ? "5 4" : undefined}
              dot={{ r: e === highlight ? 4 : 2 }}
              activeDot={{ r: 6 }}
              connectNulls
              opacity={e === highlight ? 1 : 0.75}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
