import { Line, LineChart, ResponsiveContainer } from "recharts";
import type { AnnualJSON, KPIDef, EntityName, MetricKey } from "../lib/types";
import { ENTITY_COLORS } from "../lib/colors";
import { POSITIVE_COLOR, NEGATIVE_COLOR } from "../lib/colors";
import { isYtdYear, ytdInfo, ytdPeriodTag } from "../lib/periods";

// €M flow metrics: for a YTD year these are actual part-year figures, so their
// momentum must be measured against the same period last year (ytd_prior), not
// the prior full year. Ratio/bps metrics are annualised and compare to prior FY.
const FLOW_EUR_KEYS = new Set<MetricKey>([
  "net_fee_income", "gross_margin", "nii", "net_profit", "admin_expenses",
  "staff_costs", "other_admin", "depreciation", "trading_and_other",
  "net_operating_income", "pre_tax_profit", "total_provisions_impairments",
]);

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

  // For a YTD year, €M flow metrics compare like-for-like against the same
  // period last year (ytd_prior); everything else compares to the prior year.
  const ytd = isYtdYear(data, selectedYear);
  const ytdPrior = ytd ? data.data[selectedYear]?.[entity]?.ytd_prior : null;
  const usedYtdPrior = !kpi.compute && ytdPrior != null && FLOW_EUR_KEYS.has(kpi.key);
  const priorVal = usedYtdPrior
    ? ((ytdPrior![kpi.key] as number) ?? null)
    : prior
      ? getValue(prior)
      : null;

  const isPct = kpi.unit === "%";
  const yoyDelta =
    currentVal != null && priorVal != null
      ? isPct
        ? currentVal - priorVal
        : priorVal !== 0
          ? ((currentVal - priorVal) / Math.abs(priorVal)) * 100
          : null
      : null;
  const unitLabel = isPct ? "pp" : "%";
  const prevShort = `'${String(Number(selectedYear) - 1).slice(-2)}`;
  const yoyLabel = usedYtdPrior
    ? `${unitLabel} vs ${ytdPeriodTag(ytdInfo(data, selectedYear)!)} ${prevShort}`
    : ytd
      ? `${unitLabel} vs FY${prevShort}`
      : `${unitLabel} YoY`;

  const sparkData = years.map((y) => ({
    year: y,
    value: getValue(y) ?? 0,
  }));

  const isPositiveMove =
    yoyDelta != null ? (kpi.higherIsBetter ? yoyDelta > 0 : yoyDelta < 0) : null;

  // For a growth-rate KPI in a YTD year the headline is already H1-vs-H1, so a
  // "change in growth rate" delta would confuse — show the comparison basis instead.
  const showBasisOnly = ytd && kpi.growthRate === true;
  const basisTag = ytd ? ytdPeriodTag(ytdInfo(data, selectedYear)!) : "";
  const basisText = showBasisOnly ? `${basisTag} vs ${basisTag} ${prevShort}` : "";

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
        {showBasisOnly ? (
          <span className="text-xs text-slate-500">{basisText}</span>
        ) : yoyDelta != null ? (
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
