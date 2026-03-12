import { Line, LineChart, ResponsiveContainer } from "recharts";
import type { AnnualJSON, KPIDef, EntityName } from "../lib/types";
import { ENTITY_COLORS } from "../lib/colors";
import { POSITIVE_COLOR, NEGATIVE_COLOR } from "../lib/colors";

interface Props {
  kpi: KPIDef;
  data: AnnualJSON;
  entity: EntityName;
  selectedYear: string;
  peerRank: number;
  peerTotal: number;
}

export default function KPICard({ kpi, data, entity, selectedYear, peerRank, peerTotal }: Props) {
  const years = data._metadata.years.map(String);
  const latest = selectedYear;
  const idx = years.indexOf(selectedYear);
  const prior = idx > 0 ? years[idx - 1] : null;

  const getValue = (y: string) =>
    kpi.compute ? kpi.compute(data, entity, y) : (data.data[y]?.[entity]?.[kpi.key] as number) ?? null;

  const currentVal = getValue(latest);
  const priorVal = prior ? getValue(prior) : null;

  const isPct = kpi.unit === "%";
  const yoyDelta =
    currentVal != null && priorVal != null
      ? isPct
        ? currentVal - priorVal
        : priorVal !== 0
          ? ((currentVal - priorVal) / Math.abs(priorVal)) * 100
          : null
      : null;
  const yoyLabel = isPct ? "pp YoY" : "% YoY";

  const sparkData = years.map((y) => ({
    year: y,
    value: getValue(y) ?? 0,
  }));

  const isPositiveMove =
    yoyDelta != null ? (kpi.higherIsBetter ? yoyDelta > 0 : yoyDelta < 0) : null;

  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5 hover:border-slate-600 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-xs text-slate-400 uppercase tracking-wider font-medium">{kpi.label}</p>
          <p className="text-2xl font-bold text-white mt-1">
            {currentVal != null ? kpi.format(currentVal) : "N/A"}
          </p>
        </div>
        <div className="text-right">
          <span
            className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
            style={{
              background: peerRank <= 2 ? "#065f4620" : peerRank >= 4 ? "#7f1d1d20" : "#78350f20",
              color: peerRank <= 2 ? POSITIVE_COLOR : peerRank >= 4 ? NEGATIVE_COLOR : "#fbbf24",
            }}
          >
            #{peerRank}/{peerTotal}
          </span>
        </div>
      </div>

      <div className="h-10 mb-3">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={sparkData}>
            <Line
              type="monotone"
              dataKey="value"
              stroke={ENTITY_COLORS[entity]}
              strokeWidth={2}
              dot={({ cx, cy, payload }) =>
                payload.year === selectedYear ? (
                  <circle key="sel" cx={cx} cy={cy} r={3} fill={ENTITY_COLORS[entity]} stroke="white" strokeWidth={1} />
                ) : <g key="empty" />
              }
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center justify-between">
        {yoyDelta != null ? (
          <span
            className="text-xs font-medium flex items-center gap-1"
            style={{ color: isPositiveMove ? POSITIVE_COLOR : NEGATIVE_COLOR }}
          >
            {isPositiveMove ? "\u25B2" : "\u25BC"} {Math.abs(yoyDelta).toFixed(1)}{yoyLabel}
          </span>
        ) : (
          <span className="text-xs text-slate-500">No prior data</span>
        )}
        <span className="text-[10px] text-slate-500">{kpi.description.slice(0, 45)}...</span>
      </div>
    </div>
  );
}
