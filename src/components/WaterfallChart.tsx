import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from "recharts";
import type { EntityMetrics } from "../lib/types";

interface Props {
  data: EntityMetrics;
  height?: number;
}

interface WaterfallItem {
  name: string;
  base: number;
  delta: number;
  isSubtotal: boolean;
  isNegative: boolean;
}

const X_AXIS_LABELS: Record<string, string> = {
  NII: "NII",
  "Net Fees": "Net Fees",
  "Trading & Other": "T&O",
  "Gross Margin": "Gross M.",
  Admin: "Admin",
  "D&A": "D&A",
  "Operating Profit": "Op Profit",
  "Prov. & Impairm.": "Prov+Imp",
  Other: "Other",
  "Pre-Tax Profit": "Pre-Tax",
  Tax: "Tax",
  "Net Profit": "Net Profit",
};

function buildWaterfallData(d: EntityMetrics): WaterfallItem[] {
  const nii = d.nii ?? 0;
  const nfi = d.net_fee_income ?? 0;
  const tao = d.trading_and_other ?? 0;
  const gm = d.gross_margin ?? 0;
  const admin = Math.abs(d.admin_expenses ?? 0);
  const depr = Math.abs(d.depreciation ?? 0);
  const noi = d.net_operating_income ?? (gm - admin - depr);
  const tpi = d.total_provisions_impairments ?? 0;
  // "Other" between operating profit and pre-tax: covers gains/losses not in provisions
  const ptp = d.pre_tax_profit ?? 0;
  const otherGainsLosses = ptp - noi + tpi;
  const tax = Math.abs(d.tax_charge ?? 0);
  const np = d.net_profit ?? 0;

  const items: WaterfallItem[] = [];
  let running = 0;

  // NII
  items.push({ name: "NII", base: 0, delta: nii, isSubtotal: false, isNegative: nii < 0 });
  running = nii;

  // Net Fee Income
  items.push({ name: "Net Fees", base: running, delta: nfi, isSubtotal: false, isNegative: nfi < 0 });
  running += nfi;

  // Trading & Other
  items.push({ name: "Trading & Other", base: running, delta: tao, isSubtotal: false, isNegative: tao < 0 });

  // Gross Margin subtotal
  items.push({ name: "Gross Margin", base: 0, delta: gm, isSubtotal: true, isNegative: false });

  // Admin Expenses (negative)
  items.push({ name: "Admin", base: gm, delta: -admin, isSubtotal: false, isNegative: true });

  // D&A (negative)
  items.push({ name: "D&A", base: gm - admin, delta: -depr, isSubtotal: false, isNegative: true });

  // Operating Profit subtotal
  items.push({ name: "Operating Profit", base: 0, delta: noi, isSubtotal: true, isNegative: noi < 0 });

  // Provisions & Impairments (negative)
  items.push({ name: "Prov. & Impairm.", base: noi, delta: -tpi, isSubtotal: false, isNegative: true });

  // Other gains/losses
  const otherBase = noi - tpi;
  items.push({ name: "Other", base: otherBase, delta: otherGainsLosses, isSubtotal: false, isNegative: otherGainsLosses < 0 });

  // Pre-Tax Profit subtotal
  items.push({ name: "Pre-Tax Profit", base: 0, delta: ptp, isSubtotal: true, isNegative: ptp < 0 });

  // Tax (negative)
  items.push({ name: "Tax", base: ptp, delta: -tax, isSubtotal: false, isNegative: true });

  // Net Profit subtotal
  items.push({ name: "Net Profit", base: 0, delta: np, isSubtotal: true, isNegative: np < 0 });

  return items;
}

function getBarColor(item: WaterfallItem): string {
  if (item.isSubtotal) return "#60a5fa"; // blue for subtotals
  if (item.isNegative || item.delta < 0) return "#f87171"; // red for expenses
  return "#34d399"; // green for income
}

export default function WaterfallChart({ data, height = 360 }: Props) {
  const items = buildWaterfallData(data);
  const gm = data.gross_margin ?? 1;

  const chartData = items.map((item) => ({
    name: item.name,
    base: item.delta >= 0 ? item.base : item.base + item.delta,
    delta: Math.abs(item.delta),
    rawDelta: item.delta,
    isSubtotal: item.isSubtotal,
    isNegative: item.isNegative,
    pctGM: gm !== 0 ? ((item.delta / gm) * 100).toFixed(1) : "0",
  }));

  return (
    <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-5">
      <h3 className="text-sm font-semibold text-slate-300 mb-4">P&L Waterfall</h3>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={chartData} margin={{ top: 20, right: 16, left: 8, bottom: 28 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fill: "#94a3b8", fontSize: 10 }}
            tickFormatter={(value: string) => X_AXIS_LABELS[value] ?? value}
            angle={0}
            textAnchor="middle"
            height={62}
            tickMargin={8}
            interval={0}
          />
          <YAxis
            tick={{ fill: "#94a3b8", fontSize: 12 }}
            tickFormatter={(v) => `${v.toFixed(0)}`}
          />
          <Tooltip
            content={(props) => {
              const { active, payload, label } = props as {
                active?: boolean;
                payload?: readonly { dataKey?: string; payload?: Record<string, unknown> }[];
                label?: string;
              };
              if (!active || !payload || payload.length === 0) return null;
              const deltaEntry = payload.find((p) => p.dataKey === "delta");
              const d = deltaEntry?.payload;
              if (!d) return null;

              const amount = d.rawDelta as number;
              const pct = d.pctGM as string;
              const itemName = (d.name as string) ?? label ?? "";

              return (
                <div
                  style={{
                    background: "#1e293b",
                    border: "1px solid #475569",
                    borderRadius: 10,
                    boxShadow: "0 8px 24px rgba(2, 6, 23, 0.45)",
                    padding: "10px 12px",
                    color: "#e2e8f0",
                    minWidth: 180,
                  }}
                >
                  <div style={{ fontSize: 12, color: "#cbd5e1", marginBottom: 4 }}>{itemName}</div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                    <span style={{ fontSize: 18, lineHeight: 1.1, fontWeight: 700, color: "#f8fafc" }}>
                      €{amount.toFixed(1)}M
                    </span>
                    <span style={{ fontSize: 11, color: "#94a3b8" }}>({pct}% of GM)</span>
                  </div>
                </div>
              );
            }}
            cursor={{ fill: "rgba(148, 163, 184, 0.08)" }}
          />
          <ReferenceLine y={0} stroke="#475569" />
          {/* Invisible base */}
          <Bar dataKey="base" stackId="waterfall" fill="transparent" />
          {/* Visible delta */}
          <Bar dataKey="delta" stackId="waterfall" radius={[2, 2, 0, 0]}>
            {chartData.map((_entry, index) => (
              <Cell key={index} fill={getBarColor(items[index])} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
