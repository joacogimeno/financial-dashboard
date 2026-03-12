import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { AnnualJSON, QuarterlyJSON, MetricKey, EntityName } from "../lib/types";
import { ENTITY_NAMES } from "../lib/types";
import { ENTITY_COLORS } from "../lib/colors";

interface Props {
  data: AnnualJSON | QuarterlyJSON;
  metric: MetricKey;
  title: string;
  unit?: string;
  formatValue?: (v: number) => string;
  entities?: readonly EntityName[];
  highlightEntity?: EntityName;
  height?: number;
}

function isAnnual(d: AnnualJSON | QuarterlyJSON): d is AnnualJSON {
  return "_metadata" in d && "years" in d._metadata;
}

export default function TrendChart({
  data,
  metric,
  title,
  unit = "",
  formatValue,
  entities = ENTITY_NAMES,
  highlightEntity = "Inversis",
  height = 300,
}: Props) {
  const periods = isAnnual(data)
    ? data._metadata.years.map(String)
    : (data as QuarterlyJSON).quarters;

  const chartData = periods.map((p) => {
    const row: Record<string, string | number | null> = { period: p };
    for (const entity of entities) {
      row[entity] = (data.data[p]?.[entity]?.[metric] as number) ?? null;
    }
    return row;
  });

  const fmt = formatValue ?? ((v: number) => `${v.toFixed(1)}${unit}`);

  return (
    <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-5">
      <h3 className="text-sm font-semibold text-slate-300 mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis dataKey="period" tick={{ fill: "#94a3b8", fontSize: 12 }} />
          <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} tickFormatter={(v) => fmt(v)} />
          <Tooltip
            contentStyle={{
              background: "#1e293b",
              border: "1px solid #475569",
              borderRadius: 8,
              fontSize: 13,
              color: "#e2e8f0",
            }}
            labelStyle={{ color: "#94a3b8", fontWeight: 600, marginBottom: 4 }}
            formatter={(value: number | undefined, name: string | undefined, item: { color?: string }) => [
              value != null ? fmt(value) : "\u2014",
              <span style={{ color: item.color ?? "#94a3b8" }}>{name}</span>,
            ]}
          />
          <Legend
            wrapperStyle={{ fontSize: 12, color: "#94a3b8" }}
            iconType="circle"
            iconSize={8}
          />
          {entities.map((entity) => (
            <Line
              key={entity}
              type="monotone"
              dataKey={entity}
              stroke={ENTITY_COLORS[entity]}
              strokeWidth={entity === highlightEntity ? 3 : 1.5}
              dot={{ r: entity === highlightEntity ? 4 : 2.5 }}
              activeDot={{ r: 6 }}
              connectNulls
              opacity={entity !== highlightEntity ? 0.6 : 1}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
