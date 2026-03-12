import { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine, Legend, LineChart, Line,
} from "recharts";
import type { AnnualJSON, EntityName } from "../lib/types";
import { ENTITY_NAMES } from "../lib/types";
import { ENTITY_COLORS, POSITIVE_COLOR, NEGATIVE_COLOR } from "../lib/colors";
import PeerTable from "../components/PeerTable";

interface Props {
  annual: AnnualJSON;
  entity: EntityName;
}

// ─── Equity Bridge ────────────────────────────────────────────────────────────

interface BridgeItem {
  name: string;
  base: number;
  delta: number;
  isSubtotal: boolean;
  color: string;
}

function buildEquityBridge(annual: AnnualJSON, entity: EntityName, year: string): BridgeItem[] | null {
  const d = annual.data[year]?.[entity];
  if (!d) return null;

  const opening = (d.equity_opening as number) ?? null;
  const closing = (d.total_equity as number) ?? null;
  const np = (d.net_profit as number) ?? null;
  const oci = (d.other_comprehensive_income as number) ?? null;
  const div = (d.dividends_paid as number) ?? null;
  const capInc = (d.capital_increase as number) ?? null;
  const capOther = (d.capital_other_instruments as number) ?? null;
  const bizComb = (d.business_combination_equity as number) ?? null;

  if (opening == null || closing == null || np == null) return null;

  const tci = (d.total_comprehensive_income as number) ?? (np + (oci ?? 0));
  const capActions = (capInc ?? 0) + (capOther ?? 0) + (bizComb ?? 0);
  const divVal = div ?? 0;
  const other = closing - opening - tci - divVal - capActions;

  const items: BridgeItem[] = [];
  let running = 0;

  items.push({ name: "Opening\nEquity", base: 0, delta: opening, isSubtotal: true, color: "#60a5fa" });
  running = opening;

  items.push({ name: "Net\nProfit", base: running, delta: np, isSubtotal: false, color: np >= 0 ? POSITIVE_COLOR : NEGATIVE_COLOR });
  running += np;

  const ociVal = tci - np;
  if (Math.abs(ociVal) > 0.01) {
    items.push({ name: "OCI", base: ociVal >= 0 ? running : running + ociVal, delta: Math.abs(ociVal), isSubtotal: false, color: ociVal >= 0 ? "#34d399" : NEGATIVE_COLOR });
    running += ociVal;
  }

  if (Math.abs(divVal) > 0.01) {
    items.push({ name: "Dividends", base: running + divVal, delta: Math.abs(divVal), isSubtotal: false, color: NEGATIVE_COLOR });
    running += divVal;
  }

  if (Math.abs(capActions) > 0.1) {
    items.push({ name: "Capital\nActions", base: capActions >= 0 ? running : running + capActions, delta: Math.abs(capActions), isSubtotal: false, color: capActions >= 0 ? "#a78bfa" : NEGATIVE_COLOR });
    running += capActions;
  }

  if (Math.abs(other) > 0.1) {
    items.push({ name: "Other", base: other >= 0 ? running : running + other, delta: Math.abs(other), isSubtotal: false, color: other >= 0 ? POSITIVE_COLOR : NEGATIVE_COLOR });
    running += other;
  }

  items.push({ name: "Closing\nEquity", base: 0, delta: closing, isSubtotal: true, color: "#60a5fa" });

  return items;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CapitalPayout({ annual, entity }: Props) {
  const years = annual._metadata.years.map(String);
  const latestYear = years[years.length - 1];
  const [selectedYear, setSelectedYear] = useState(latestYear);

  const d = annual.data[selectedYear]?.[entity];
  const payout = (d?.payout_ratio_pct as number) ?? null;
  const retention = (d?.retention_rate_pct as number) ?? null;
  const divYield = (d?.dividend_yield_on_equity_pct as number) ?? null;
  const divPaid = (d?.dividends_paid as number) ?? null;
  const np = (d?.net_profit as number) ?? null;
  const capActions = ((d?.capital_increase as number) ?? 0)
    + ((d?.capital_other_instruments as number) ?? 0)
    + ((d?.business_combination_equity as number) ?? 0);

  // ECPN data availability: equity_opening is the first field extracted from the block.
  // If null, the entity block was not found in the ECPN file for this year.
  const hasEcpnData = (d?.equity_opening as number | null | undefined) != null;

  // Payout policy label — distinguish "no data" from "full retention"
  // null divPaid + hasEcpnData = blank dividends row = full retention
  // null divPaid + !hasEcpnData = no ECPN extraction = no data
  const payoutLabel = !hasEcpnData
    ? "No Data"
    : Math.abs(divPaid ?? 0) < 0.01
      ? "Full Retention"
      : payout != null && payout >= 999
        ? "Dividends > Earnings"
        : payout != null && payout > 100
          ? "Payout > 100%"
          : payout != null && payout > 75
            ? "High Payout"
            : payout != null && payout > 40
              ? "Moderate Payout"
              : "Conservative Payout";

  // Equity bridge
  const bridgeItems = buildEquityBridge(annual, entity, selectedYear);
  const bridgeData = bridgeItems?.map((item) => ({
    name: item.name,
    base: item.isSubtotal ? 0 : item.base,
    delta: item.delta,
    isSubtotal: item.isSubtotal,
    color: item.color,
  }));

  // Peer payout comparison — ALL entities included, null vs zero handled explicitly
  const peerPayoutData = ENTITY_NAMES.map((e) => {
    const ed = annual.data[selectedYear]?.[e];
    const rawPayout = (ed?.payout_ratio_pct as number) ?? null;
    const hasData = (ed?.equity_opening as number | null | undefined) != null;
    return {
      entity: e,
      payout: rawPayout,
      // Display value: cap at 110; full-retention entities (hasData, no payout) → 0; no ECPN → null (no bar)
      displayPayout: rawPayout != null
        ? Math.min(rawPayout, 110)
        : hasData ? 0 : null,
      hasData,
      dividends: ed?.dividends_paid != null ? Math.abs(ed.dividends_paid as number) : null,
      netProfit: (ed?.net_profit as number) ?? null,
    };
  });

  // Dividend history — stacked bar per entity per year
  const divHistoryData = years.map((y) => {
    const row: Record<string, string | number | null> = { year: y };
    for (const e of ENTITY_NAMES) {
      const val = annual.data[y]?.[e]?.dividends_paid;
      row[e] = val != null ? Math.abs(val as number) : 0;
    }
    return row;
  });

  // Payout ratio trend — all entities included
  // Full retention (ECPN present, null payout) → 0 so the line appears at the baseline
  // No ECPN data → null so no dot is rendered
  const payoutTrendData = years.map((y) => {
    const row: Record<string, string | number | null> = { year: y };
    for (const e of ENTITY_NAMES) {
      const ed = annual.data[y]?.[e];
      const pr = ed?.payout_ratio_pct as number | undefined;
      const hasData = (ed?.equity_opening as number | null | undefined) != null;
      if (pr != null && pr < 999) {
        row[e] = pr;
      } else if (pr != null && pr >= 999) {
        row[e] = 110; // display cap for loss-year payouts
      } else {
        row[e] = hasData ? 0 : null;
      }
    }
    return row;
  });

  const tooltipStyle   = { background: "#1e293b", border: "1px solid #475569", borderRadius: 8, fontSize: 13, color: "#e2e8f0" };
  const tooltipLabel   = { color: "#94a3b8", marginBottom: 2 };
  const tooltipItem    = { color: "#e2e8f0" };
  const hasBridgeData = bridgeData != null && bridgeData.length > 0;

  // Dynamic interpretation note for the selected entity and year
  const interpretationNote = (() => {
    if (!hasEcpnData) {
      return `No equity statement (ECPN) data is available for ${entity} in ${selectedYear}.`;
    }
    if (Math.abs(divPaid ?? 0) < 0.01) {
      return `${entity} paid no dividends in ${selectedYear}, fully retaining its net profit of \u20AC${np?.toFixed(0) ?? "N/A"}M. Equity growth is driven entirely by earnings and OCI mark-to-market movements.`;
    }
    if (payout != null && payout >= 999) {
      return `${entity} paid \u20AC${Math.abs(divPaid!).toFixed(0)}M in dividends in ${selectedYear} despite near-zero or negative earnings \u2014 equity is being actively reduced.`;
    }
    if (payout != null && payout > 100) {
      return `${entity} distributed \u20AC${Math.abs(divPaid!).toFixed(0)}M in ${selectedYear}, exceeding its net profit of \u20AC${np?.toFixed(0) ?? "N/A"}M (${payout.toFixed(0)}% payout ratio). Distributions to shareholders exceed current-year earnings.`;
    }
    const retained = np != null && divPaid != null ? np - Math.abs(divPaid) : null;
    return `${entity} paid \u20AC${Math.abs(divPaid!).toFixed(0)}M in dividends in ${selectedYear} \u2014 a ${payout?.toFixed(0) ?? "N/A"}% payout on \u20AC${np?.toFixed(0) ?? "N/A"}M net profit \u2014 retaining \u20AC${retained?.toFixed(0) ?? "N/A"}M for equity growth.`;
  })();

  return (
    <div className="space-y-8">

      {/* Year selector */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-200">Capital & Payout Analysis</h2>
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

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
          <p className="text-xs text-slate-400 uppercase tracking-wider">Payout Ratio</p>
          <p className="text-2xl font-bold text-blue-300 mt-1">
            {!hasEcpnData ? "N/A" : payout == null ? "0%" : payout >= 999 ? ">999%" : `${payout.toFixed(0)}%`}
          </p>
          <p className="text-xs text-slate-500 mt-1">{payoutLabel}</p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
          <p className="text-xs text-slate-400 uppercase tracking-wider">Retention Rate</p>
          <p className="text-2xl font-bold text-blue-300 mt-1">
            {!hasEcpnData ? "N/A" : retention == null ? "100%" : `${retention.toFixed(0)}%`}
          </p>
          <p className="text-xs text-slate-500 mt-1">Earnings reinvested</p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
          <p className="text-xs text-slate-400 uppercase tracking-wider">Div. / Open. Equity</p>
          <p className="text-2xl font-bold text-blue-300 mt-1">
            {!hasEcpnData ? "N/A" : divYield == null ? "0.0%" : `${divYield.toFixed(1)}%`}
          </p>
          <p className="text-xs text-slate-500 mt-1">Yield on book</p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
          <p className="text-xs text-slate-400 uppercase tracking-wider">Dividends Paid</p>
          <p className="text-2xl font-bold text-blue-300 mt-1">
            {!hasEcpnData ? "N/A" : divPaid == null || Math.abs(divPaid) < 0.01 ? "\u20AC0M" : `\u20AC${Math.abs(divPaid).toFixed(0)}M`}
          </p>
          <p className="text-xs text-slate-500 mt-1">vs \u20AC{np != null ? np.toFixed(0) : "N/A"}M net profit</p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
          <p className="text-xs text-slate-400 uppercase tracking-wider">Capital Actions</p>
          <p className={`text-2xl font-bold mt-1 ${Math.abs(capActions) > 0.1 ? (capActions > 0 ? "text-violet-400" : "text-red-400") : "text-slate-500"}`}>
            {Math.abs(capActions) > 0.1 ? `\u20AC${capActions > 0 ? "+" : ""}${capActions.toFixed(0)}M` : "None"}
          </p>
          <p className="text-xs text-slate-500 mt-1">Issuances & combinations</p>
        </div>
      </div>

      {/* Equity Bridge + Peer Payout side-by-side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Equity Bridge Waterfall */}
        <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-5">
          <h3 className="text-sm font-semibold text-slate-300 mb-4">
            Equity Bridge — {entity} FY {selectedYear}
          </h3>
          {hasBridgeData ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={bridgeData} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 10 }} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} tickFormatter={(v) => `${v.toFixed(0)}`} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelStyle={tooltipLabel}
                  itemStyle={tooltipItem}
                  labelFormatter={() => ""}
                  formatter={(_v: number | undefined, _n: string | undefined, props: { payload?: Record<string, unknown> }) => {
                    const item = props.payload;
                    if (_n === "base") return [null, null] as [null, null];
                    const label = (item?.name as string ?? "").replace(/\n/g, " ");
                    return [`\u20AC${(item?.delta as number)?.toFixed(1)}M`, label] as [string, string];
                  }}
                />
                <ReferenceLine y={0} stroke="#475569" />
                <Bar dataKey="base" stackId="bridge" fill="transparent" />
                <Bar dataKey="delta" stackId="bridge" radius={[3, 3, 0, 0]}>
                  {bridgeData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} opacity={entry.isSubtotal ? 1 : 0.85} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-64 text-slate-500 text-sm">
              Equity statement data not available for this year
            </div>
          )}
          <p className="text-[10px] text-slate-500 mt-2">
            Capital Actions = share issuances + other instruments + business combinations.
            Other = residual reconciling item.
          </p>
        </div>

        {/* Peer Payout Comparison */}
        <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-5">
          <h3 className="text-sm font-semibold text-slate-300 mb-4">
            Peer Payout Comparison — FY {selectedYear}
          </h3>
          <p className="text-[10px] text-slate-500 mb-3">
            Bar shows display value (capped at 110%). Tooltip and table show actual payout ratio. Zero bar = full retention.
          </p>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart
              data={peerPayoutData}
              layout="vertical"
              margin={{ top: 0, right: 40, left: 70, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
              <XAxis
                type="number"
                domain={[0, 110]}
                tick={{ fill: "#94a3b8", fontSize: 11 }}
                tickFormatter={(v) => `${v}%`}
              />
              <YAxis type="category" dataKey="entity" tick={{ fill: "#94a3b8", fontSize: 11 }} width={65} />
              <Tooltip
                contentStyle={tooltipStyle}
                labelStyle={tooltipLabel}
                itemStyle={tooltipItem}
                labelFormatter={(label) => label}
                formatter={(_value: number | undefined, _name: string | undefined, props: { payload?: Record<string, unknown> }) => {
                  const actualPayout = props.payload?.payout as number | null ?? null;
                  const hasData = props.payload?.hasData as boolean ?? false;
                  return [
                    !hasData ? "N/A" : actualPayout == null ? "0%" : actualPayout >= 999 ? ">999%" : `${actualPayout.toFixed(0)}%`,
                    "Payout",
                  ] as [string, string];
                }}
              />
              <ReferenceLine x={100} stroke="#f87171" strokeDasharray="4 2" />
              <Bar dataKey="displayPayout" radius={[0, 3, 3, 0]} maxBarSize={18}>
                {peerPayoutData.map((entry) => (
                  <Cell
                    key={entry.entity}
                    fill={entry.entity === entity ? ENTITY_COLORS[entry.entity as EntityName] : "#475569"}
                    opacity={entry.payout != null && entry.payout >= 100 ? 1 : 0.8}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          {/* Dividends vs Net Profit table */}
          <div className="mt-3 space-y-1">
            {peerPayoutData.map((row) => {
              const isOver100 = row.payout != null && row.payout >= 100;
              const payoutDisplay = !row.hasData
                ? "N/A"
                : row.payout == null
                  ? "0%"
                  : row.payout >= 999
                    ? ">999%"
                    : `${row.payout.toFixed(0)}%`;
              return (
                <div
                  key={row.entity}
                  className={`flex items-center justify-between text-xs px-2 py-1 rounded ${row.entity === entity ? "bg-slate-700/40" : ""}`}
                >
                  <span className="text-slate-300 w-20">{row.entity}</span>
                  <span className="text-slate-400">
                    \u20AC{row.hasData ? (row.dividends?.toFixed(0) ?? "0") : "N/A"}M div
                  </span>
                  <span className="text-slate-400">\u20AC{row.netProfit?.toFixed(0) ?? "N/A"}M profit</span>
                  <span className={isOver100 ? "text-red-400 font-semibold" : row.hasData ? "text-slate-300" : "text-slate-500"}>
                    {payoutDisplay}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Dividend History */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-5">
          <h3 className="text-sm font-semibold text-slate-300 mb-4">Dividends Paid (\u20ACM)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={divHistoryData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
              <XAxis dataKey="year" tick={{ fill: "#94a3b8", fontSize: 12 }} />
              <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} tickFormatter={(v) => `\u20AC${v}M`} />
              <Tooltip
                contentStyle={tooltipStyle}
                labelStyle={tooltipLabel}
                itemStyle={tooltipItem}
                formatter={(value: number | undefined, name: string | undefined): [string, string] =>
                  [value != null ? `\u20AC${value.toFixed(0)}M` : "\u2014", name ?? ""]
                }
              />
              <Legend wrapperStyle={{ fontSize: 11, color: "#94a3b8" }} iconType="circle" iconSize={8} />
              {ENTITY_NAMES.map((e) => (
                <Bar key={e} dataKey={e} stackId="div" fill={ENTITY_COLORS[e]} opacity={e === entity ? 1 : 0.6} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Payout Ratio Trend — all entities, full-retention shown at 0% */}
        <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-5">
          <h3 className="text-sm font-semibold text-slate-300 mb-4">Payout Ratio Trend (%)</h3>
          <p className="text-[10px] text-slate-500 mb-3">
            Capped at 110% for display. Zero = full retention. Values &gt;100% indicate dividends exceed earnings.
          </p>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={payoutTrendData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="year" tick={{ fill: "#94a3b8", fontSize: 12 }} />
              <YAxis
                domain={[0, 115]}
                tick={{ fill: "#94a3b8", fontSize: 11 }}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                labelStyle={tooltipLabel}
                itemStyle={tooltipItem}
                formatter={(value: number | undefined, name: string | undefined): [string, string] =>
                  [value != null ? `${value.toFixed(0)}%` : "N/A", name ?? ""]
                }
              />
              <ReferenceLine y={100} stroke="#f87171" strokeDasharray="4 2" label={{ value: "100%", fill: "#f87171", fontSize: 10, position: "right" }} />
              <Legend wrapperStyle={{ fontSize: 11, color: "#94a3b8" }} iconType="circle" iconSize={8} />
              {ENTITY_NAMES.map((e) => (
                <Line
                  key={e}
                  type="monotone"
                  dataKey={e}
                  stroke={ENTITY_COLORS[e]}
                  strokeWidth={e === entity ? 3 : 1.5}
                  dot={{ r: e === entity ? 4 : 2.5 }}
                  connectNulls
                  opacity={e !== entity ? 0.65 : 1}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Capital Actions — entities with non-zero capital events (signed values) */}
      {years.some((y) => ENTITY_NAMES.some((e) => {
        const ed = annual.data[y]?.[e];
        return Math.abs(
          ((ed?.capital_increase as number) ?? 0)
          + ((ed?.capital_other_instruments as number) ?? 0)
          + ((ed?.business_combination_equity as number) ?? 0)
        ) > 0.1;
      })) && (
        <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-5">
          <h3 className="text-sm font-semibold text-slate-300 mb-1">Capital Actions — Issuances & Business Combinations (\u20ACM)</h3>
          <p className="text-[10px] text-slate-500 mb-4">
            Includes ordinary share issuances, other equity instruments, and equity recognised from business combinations.
            Negative values indicate capital reductions or buybacks.
          </p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={years.map((y) => {
                const row: Record<string, string | number | null> = { year: y };
                for (const e of ENTITY_NAMES) {
                  const ed = annual.data[y]?.[e];
                  const total = ((ed?.capital_increase as number) ?? 0)
                    + ((ed?.capital_other_instruments as number) ?? 0)
                    + ((ed?.business_combination_equity as number) ?? 0);
                  row[e] = Math.abs(total) > 0.01 ? total : null;
                }
                return row;
              })}
              margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
              <XAxis dataKey="year" tick={{ fill: "#94a3b8", fontSize: 12 }} />
              <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} tickFormatter={(v) => `\u20AC${v}M`} />
              <ReferenceLine y={0} stroke="#475569" />
              <Tooltip
                contentStyle={tooltipStyle}
                labelStyle={tooltipLabel}
                itemStyle={tooltipItem}
                formatter={(value: number | undefined, name: string | undefined): [string, string] =>
                  [value != null ? `\u20AC${value > 0 ? "+" : ""}${value.toFixed(0)}M` : "\u2014", name ?? ""]
                }
              />
              <Legend wrapperStyle={{ fontSize: 11, color: "#94a3b8" }} iconType="circle" iconSize={8} />
              {ENTITY_NAMES.map((e) => (
                <Bar key={e} dataKey={e} radius={[3, 3, 0, 0]} opacity={e === entity ? 1 : 0.65}>
                  {years.map((y, i) => {
                    const ed = annual.data[y]?.[e];
                    const total = ((ed?.capital_increase as number) ?? 0)
                      + ((ed?.capital_other_instruments as number) ?? 0)
                      + ((ed?.business_combination_equity as number) ?? 0);
                    return <Cell key={i} fill={total < 0 ? NEGATIVE_COLOR : ENTITY_COLORS[e]} opacity={e === entity ? 1 : 0.65} />;
                  })}
                </Bar>
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Peer Table */}
      <PeerTable
        data={annual}
        year={selectedYear}
        highlightEntity={entity}
        title={`Capital & Payout — FY ${selectedYear}`}
        columns={[
          { key: "dividends_paid", label: "Dividends (\u20ACM)", format: (v) => v === 0 ? "\u2014" : `\u20AC${Math.abs(v).toFixed(0)}M`, higherIsBetter: false },
          { key: "net_profit", label: "Net Profit", format: (v) => `\u20AC${v.toFixed(0)}M`, higherIsBetter: true },
          { key: "payout_ratio_pct", label: "Payout %", format: (v) => v >= 999 ? ">999%" : `${v.toFixed(0)}%`, higherIsBetter: false },
          { key: "retention_rate_pct", label: "Retention %", format: (v) => `${v.toFixed(0)}%`, higherIsBetter: true },
          { key: "dividend_yield_on_equity_pct", label: "Div Yield/Eq", format: (v) => `${v.toFixed(1)}%`, higherIsBetter: false },
          { key: "total_equity", label: "Closing Equity", format: (v) => `\u20AC${v.toFixed(0)}M`, higherIsBetter: true },
        ]}
      />

      {/* OCI Sensitivity — show if any entity has material OCI */}
      {years.some((y) => ENTITY_NAMES.some((e) => {
        const oci = annual.data[y]?.[e]?.other_comprehensive_income as number | undefined;
        const eq = annual.data[y]?.[e]?.total_equity as number | undefined;
        return oci != null && eq != null && eq !== 0 && Math.abs(oci / eq) > 0.02;
      })) && (
        <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-5">
          <h3 className="text-sm font-semibold text-slate-300 mb-1">OCI Mark-to-Market Volatility (\u20ACM)</h3>
          <p className="text-[10px] text-slate-500 mb-4">
            Other Comprehensive Income — primarily FVOCI securities, pension actuarial, and hedging moves. Large swings indicate balance sheet sensitivity to rates/markets.
          </p>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart
              data={years.map((y) => {
                const row: Record<string, string | number | null> = { year: y };
                for (const e of ENTITY_NAMES) {
                  const oci = annual.data[y]?.[e]?.other_comprehensive_income as number | undefined;
                  row[e] = oci ?? null;
                }
                return row;
              })}
              margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
              <XAxis dataKey="year" tick={{ fill: "#94a3b8", fontSize: 12 }} />
              <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} tickFormatter={(v) => `\u20AC${v}M`} />
              <ReferenceLine y={0} stroke="#475569" />
              <Tooltip
                contentStyle={tooltipStyle}
                labelStyle={tooltipLabel}
                itemStyle={tooltipItem}
                formatter={(value: number | undefined, name: string | undefined): [string, string] =>
                  [value != null ? `\u20AC${value.toFixed(1)}M` : "\u2014", name ?? ""]
                }
              />
              <Legend wrapperStyle={{ fontSize: 11, color: "#94a3b8" }} iconType="circle" iconSize={8} />
              {ENTITY_NAMES.map((e) => (
                <Bar key={e} dataKey={e} fill={ENTITY_COLORS[e]} radius={[2, 2, 0, 0]} opacity={e === entity ? 1 : 0.6}>
                  {years.map((y, i) => {
                    const v = annual.data[y]?.[e]?.other_comprehensive_income as number | undefined;
                    return <Cell key={i} fill={v != null && v < 0 ? NEGATIVE_COLOR : ENTITY_COLORS[e]} opacity={e === entity ? 1 : 0.6} />;
                  })}
                </Bar>
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Dynamic interpretation note */}
      <div className="bg-slate-800/20 border border-slate-700/30 rounded-xl p-4 text-xs text-slate-400">
        <p>
          <span className="text-slate-300 font-medium">{entity} {selectedYear}: </span>
          {interpretationNote}
        </p>
      </div>

    </div>
  );
}
