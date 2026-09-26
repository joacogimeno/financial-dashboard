import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import type { EsiAnnualJSON } from "../../lib/esiTypes";
import { val, type DisplayKey } from "../../lib/esiKpis";
import ChartTooltip from "../ChartTooltip";

export interface Series {
  key: DisplayKey;
  label: string;
  color: string;
}

interface Props {
  data: EsiAnnualJSON;
  entity: string;
  series: Series[];
  years: string[];           // e.g. ["2022","2023","2024","2025"]
  title: string;
  formatValue?: (v: number) => string;
  height?: number;
}

// Stacked-area evolution of several metrics for ONE entity over time — used for
// the market's commission-pool composition ("where the fees come from").
export default function EsiStackedArea({ data, entity, series, years, title, formatValue, height = 300 }: Props) {
  const fmt = formatValue ?? ((v: number) => v.toFixed(0));
  const chartData = years.map((y) => {
    const row: Record<string, string | number | null> = { period: y };
    for (const s of series) row[s.key] = val(data.data[y]?.[entity], s.key);
    return row;
  });
  return (
    <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-5">
      <h3 className="text-sm font-semibold text-slate-300 mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis dataKey="period" tick={{ fill: "#94a3b8", fontSize: 12 }} />
          <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} tickFormatter={(v) => fmt(v as number)} />
          <Tooltip content={<ChartTooltip formatter={(v: unknown) => fmt(v as number)} />} />
          <Legend wrapperStyle={{ fontSize: 12, color: "#94a3b8" }} iconType="circle" iconSize={8} />
          {series.map((s) => (
            <Area key={s.key} type="monotone" dataKey={s.key} name={s.label} stackId="1"
              stroke={s.color} fill={s.color} fillOpacity={0.8} strokeWidth={1} isAnimationActive={false} />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
