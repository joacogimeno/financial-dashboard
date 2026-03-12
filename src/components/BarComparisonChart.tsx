import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { AnnualJSON, MetricKey, EntityName } from "../lib/types";
import { ENTITY_NAMES } from "../lib/types";
import { ENTITY_COLORS } from "../lib/colors";

interface Props {
  data: AnnualJSON;
  year: string;
  metric: MetricKey;
  title: string;
  formatValue?: (v: number) => string;
  height?: number;
  highlightEntity?: EntityName;
  matchTooltipValueColorToBar?: boolean;
}

export default function BarComparisonChart({
  data,
  year,
  metric,
  title,
  formatValue,
  height = 280,
  highlightEntity = "Inversis",
  matchTooltipValueColorToBar = false,
}: Props) {
  const yearData = data.data[year];
  if (!yearData) return null;

  const chartData = ENTITY_NAMES
    .map((entity) => ({
      entity,
      value: (yearData[entity]?.[metric] as number | undefined) ?? null,
    }))
    .filter((d) => d.value !== null) as { entity: EntityName; value: number }[];

  const fmt = formatValue ?? ((v: number) => v.toFixed(1));

  return (
    <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-5">
      <h3 className="text-sm font-semibold text-slate-300 mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
          <XAxis dataKey="entity" tick={{ fill: "#94a3b8", fontSize: 11 }} />
          <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} tickFormatter={(v) => fmt(v)} />
          {matchTooltipValueColorToBar ? (
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload || payload.length === 0) return null;
                const row = payload[0];
                const entity = ((row?.payload as { entity?: EntityName } | undefined)?.entity ?? label ?? "") as EntityName | string;
                const value = typeof row?.value === "number" ? row.value : null;
                const valueColor = entity in ENTITY_COLORS ? ENTITY_COLORS[entity as EntityName] : "#e2e8f0";

                return (
                  <div
                    style={{
                      background: "#1e293b",
                      border: "1px solid #475569",
                      borderRadius: 8,
                      fontSize: 13,
                      padding: "10px 12px",
                      boxShadow: "0 8px 24px rgba(2, 6, 23, 0.45)",
                    }}
                  >
                    <div style={{ color: "#e2e8f0", fontWeight: 600, marginBottom: 4 }}>{entity}</div>
                    <div style={{ color: valueColor, fontSize: 18, fontWeight: 700 }}>
                      {value != null ? fmt(value) : "—"}
                    </div>
                  </div>
                );
              }}
              cursor={{ fill: "rgba(148, 163, 184, 0.08)" }}
            />
          ) : (
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload || payload.length === 0) return null;
                const row = payload[0];
                const entity = ((row?.payload as { entity?: EntityName } | undefined)?.entity ?? label ?? "") as EntityName | string;
                const value = typeof row?.value === "number" ? row.value : null;
                const entityColor = entity in ENTITY_COLORS ? ENTITY_COLORS[entity as EntityName] : "#e2e8f0";
                return (
                  <div style={{ background: "#1e293b", border: "1px solid #475569", borderRadius: 8, fontSize: 13, padding: "10px 12px", boxShadow: "0 8px 24px rgba(2,6,23,0.45)" }}>
                    <div style={{ color: entityColor, fontWeight: 600, marginBottom: 4 }}>{entity}</div>
                    <div style={{ color: "#e2e8f0", fontSize: 16, fontWeight: 700 }}>{value != null ? fmt(value) : "—"}</div>
                  </div>
                );
              }}
              cursor={{ fill: "rgba(148, 163, 184, 0.08)" }}
            />
          )}
          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
            {chartData.map((entry) => (
              <Cell
                key={entry.entity}
                fill={ENTITY_COLORS[entry.entity as EntityName]}
                opacity={entry.entity === highlightEntity ? 1 : 0.7}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
