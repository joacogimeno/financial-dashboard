import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import React from "react";
import type { AnnualJSON, QuarterlyJSON, EntityName } from "../lib/types";
import { ENTITY_NAMES } from "../lib/types";
import TrendChart from "../components/TrendChart";
import BarComparisonChart from "../components/BarComparisonChart";
import PeerTable from "../components/PeerTable";

interface Props {
  annual: AnnualJSON;
  quarterly: QuarterlyJSON;
  entity: EntityName;
}

export default function Treasury({ annual, quarterly, entity }: Props) {
  const years = annual._metadata.years.map(String);
  const latestYear = years[years.length - 1];
  const quarters = quarterly.quarters;

  // Entity summary stats
  const inv = annual.data[latestYear]?.[entity];
  const spread = (inv?.interest_spread_pct as number) ?? 0;
  const liqRatio = (inv?.liquidity_ratio_pct as number) ?? 0;
  const clientFunding = (inv?.client_funding_ratio_pct as number) ?? 0;
  const earningYield = (inv?.earning_asset_yield_pct as number) ?? 0;
  const fundingCost = (inv?.funding_cost_pct as number) ?? 0;

  // Quarterly asset composition for selected entity
  const assetComposition = quarters.map((q) => {
    const d = quarterly.data[q]?.[entity];
    const ta = (d?.total_assets as number) ?? 0;
    const cash = (d?.cash_and_central_bank as number) ?? 0;
    const securities = (d?.securities_fvoci as number) ?? 0;
    const loans = (d?.assets_amortized_cost as number) ?? 0;
    const intangibles = d?.intangible_assets != null ? Math.abs(d.intangible_assets as number) : 0;
    const other = Math.max(0, ta - cash - securities - loans - intangibles);
    return { quarter: q, Cash: cash, Securities: securities, Loans: loans, Intangibles: intangibles, Other: other };
  });

  // Quarterly funding composition for selected entity
  const fundingComposition = quarters.map((q) => {
    const d = quarterly.data[q]?.[entity];
    const clientDep = d?.client_deposits != null ? Math.abs(d.client_deposits as number) : 0;
    const interbankDep = d?.interbank_deposits != null ? Math.abs(d.interbank_deposits as number) : 0;
    const equity = (d?.total_equity as number) ?? 0;
    const tl = d?.total_liabilities != null ? Math.abs(d.total_liabilities as number) : 0;
    const otherLiab = Math.max(0, tl - clientDep - interbankDep);
    return { quarter: q, "Client Deposits": clientDep, "Interbank Deposits": interbankDep, "Other Liabilities": otherLiab, Equity: equity };
  });

  // Funding structure for latest year — all entities (bar comparison)
  const fundingPeerData = ENTITY_NAMES.map((eName) => {
    const d = annual.data[latestYear]?.[eName];
    return {
      entity: eName,
      "Client Deposits": d?.client_deposits != null ? Math.abs(d.client_deposits as number) : 0,
      "Interbank Deposits": d?.interbank_deposits != null ? Math.abs(d.interbank_deposits as number) : 0,
      Equity: (d?.total_equity as number) ?? 0,
    };
  });

  const tooltipStyle = { background: "#1e293b", border: "1px solid #475569", borderRadius: 8, fontSize: 13, color: "#e2e8f0" };
  const tooltipLabel = { color: "#94a3b8", marginBottom: 4 };
  const eurFmt = (value: number | undefined, name: string | undefined, item: { color?: string }) => [
    value != null ? `\u20AC${value.toFixed(0)}M` : "\u2014",
    <span style={{ color: item.color ?? "#94a3b8" }}>{name}</span>,
  ] as [string, React.ReactElement];

  return (
    <div className="space-y-8">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
          <p className="text-xs text-slate-400 uppercase tracking-wider">Interest Spread</p>
          <p className="text-2xl font-bold text-blue-300 mt-1">{spread.toFixed(2)}%</p>
          <p className="text-xs text-slate-500 mt-1">Yield minus cost</p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
          <p className="text-xs text-slate-400 uppercase tracking-wider">Earning Yield</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1">{earningYield.toFixed(2)}%</p>
          <p className="text-xs text-slate-500 mt-1">Int. Inc. / Tangible Assets</p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
          <p className="text-xs text-slate-400 uppercase tracking-wider">Funding Cost</p>
          <p className="text-2xl font-bold text-red-400 mt-1">{fundingCost.toFixed(2)}%</p>
          <p className="text-xs text-slate-500 mt-1">Int. Exp. / Total Liabilities</p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
          <p className="text-xs text-slate-400 uppercase tracking-wider">Liquidity Ratio</p>
          <p className="text-2xl font-bold text-blue-300 mt-1">{liqRatio.toFixed(1)}%</p>
          <p className="text-xs text-slate-500 mt-1">Cash / Total Assets</p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
          <p className="text-xs text-slate-400 uppercase tracking-wider">Client Funding</p>
          <p className="text-2xl font-bold text-blue-300 mt-1">{clientFunding.toFixed(1)}%</p>
          <p className="text-xs text-slate-500 mt-1">Client / Total Deposits</p>
        </div>
      </div>

      {/* Interest Spread Trend */}
      <TrendChart
        data={annual}
        metric="interest_spread_pct"
        title="Interest Spread Trend (%) &mdash; Earning Yield minus Funding Cost"
        unit="%"
        formatValue={(v) => `${v.toFixed(2)}%`}
        highlightEntity={entity}
      />

      {/* Earning Asset Yield vs Funding Cost */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TrendChart
          data={annual}
          metric="earning_asset_yield_pct"
          title="Earning Asset Yield (%) &mdash; Interest Income / Tangible Assets"
          unit="%"
          formatValue={(v) => `${v.toFixed(2)}%`}
          highlightEntity={entity}
          height={280}
        />
        <TrendChart
          data={annual}
          metric="funding_cost_pct"
          title="Funding Cost (%) &mdash; Interest Expenses / Total Liabilities"
          unit="%"
          formatValue={(v) => `${v.toFixed(2)}%`}
          highlightEntity={entity}
          height={280}
        />
      </div>

      {/* Quarterly Asset Composition — Area Chart */}
      <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-5">
        <h3 className="text-sm font-semibold text-slate-300 mb-4">
          {entity} Asset Composition — Quarterly ({"\u20AC"}M)
        </h3>
        <ResponsiveContainer width="100%" height={320}>
          <AreaChart data={assetComposition} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
            <XAxis dataKey="quarter" tick={{ fill: "#94a3b8", fontSize: 11 }} interval={1} />
            <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} tickFormatter={(v) => `\u20AC${v}M`} />
            <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabel} formatter={eurFmt} />
            <Legend wrapperStyle={{ fontSize: 12 }} iconType="rect" />
            <Area type="monotone" dataKey="Cash" stackId="1" stroke="#60a5fa" fill="#60a5fa" fillOpacity={0.7} />
            <Area type="monotone" dataKey="Securities" stackId="1" stroke="#34d399" fill="#34d399" fillOpacity={0.7} />
            <Area type="monotone" dataKey="Loans" stackId="1" stroke="#fbbf24" fill="#fbbf24" fillOpacity={0.7} />
            <Area type="monotone" dataKey="Intangibles" stackId="1" stroke="#94a3b8" fill="#94a3b8" fillOpacity={0.5} />
            <Area type="monotone" dataKey="Other" stackId="1" stroke="#475569" fill="#475569" fillOpacity={0.5} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Quarterly Funding Composition — Area Chart */}
      <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-5">
        <h3 className="text-sm font-semibold text-slate-300 mb-4">
          {entity} Funding Composition — Quarterly ({"\u20AC"}M)
        </h3>
        <ResponsiveContainer width="100%" height={320}>
          <AreaChart data={fundingComposition} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
            <XAxis dataKey="quarter" tick={{ fill: "#94a3b8", fontSize: 11 }} interval={1} />
            <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} tickFormatter={(v) => `\u20AC${v}M`} />
            <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabel} formatter={eurFmt} />
            <Legend wrapperStyle={{ fontSize: 12 }} iconType="rect" />
            <Area type="monotone" dataKey="Client Deposits" stackId="1" stroke="#60a5fa" fill="#60a5fa" fillOpacity={0.7} />
            <Area type="monotone" dataKey="Interbank Deposits" stackId="1" stroke="#f472b6" fill="#f472b6" fillOpacity={0.7} />
            <Area type="monotone" dataKey="Other Liabilities" stackId="1" stroke="#a78bfa" fill="#a78bfa" fillOpacity={0.5} />
            <Area type="monotone" dataKey="Equity" stackId="1" stroke="#34d399" fill="#34d399" fillOpacity={0.7} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Funding Structure — Peer Comparison */}
      <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-5">
        <h3 className="text-sm font-semibold text-slate-300 mb-4">
          Funding Structure — FY {latestYear} ({"\u20AC"}M)
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={fundingPeerData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
            <XAxis dataKey="entity" tick={{ fill: "#94a3b8", fontSize: 11 }} />
            <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} tickFormatter={(v) => `\u20AC${v}M`} />
            <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabel} formatter={eurFmt} />
            <Legend wrapperStyle={{ fontSize: 12 }} iconType="rect" />
            <Bar dataKey="Client Deposits" stackId="a" fill="#60a5fa" />
            <Bar dataKey="Interbank Deposits" stackId="a" fill="#f472b6" />
            <Bar dataKey="Equity" stackId="a" fill="#34d399" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Liquidity Ratio Trend */}
      <TrendChart
        data={annual}
        metric="liquidity_ratio_pct"
        title="Liquidity Ratio (%) &mdash; Cash & Central Bank / Total Assets"
        unit="%"
        formatValue={(v) => `${v.toFixed(1)}%`}
        highlightEntity={entity}
        height={280}
      />

      {/* Client Funding Ratio Comparison */}
      <BarComparisonChart
        data={annual}
        year={latestYear}
        metric="client_funding_ratio_pct"
        title={`Client Funding Ratio — FY ${latestYear} (%)`}
        formatValue={(v) => `${v.toFixed(1)}%`}
        highlightEntity={entity}
        matchTooltipValueColorToBar
      />

      {/* Full Peer Table */}
      <PeerTable
        data={annual}
        year={latestYear}
        highlightEntity={entity}
        title={`Treasury & Balance Sheet — FY ${latestYear}`}
        columns={[
          { key: "interest_spread_pct", label: "Spread", format: (v) => `${v.toFixed(2)}%`, higherIsBetter: true },
          { key: "earning_asset_yield_pct", label: "Earning Yield", format: (v) => `${v.toFixed(2)}%`, higherIsBetter: true },
          { key: "funding_cost_pct", label: "Funding Cost", format: (v) => `${v.toFixed(2)}%`, higherIsBetter: false },
          { key: "liquidity_ratio_pct", label: "Liquidity", format: (v) => `${v.toFixed(1)}%`, higherIsBetter: true },
          { key: "client_funding_ratio_pct", label: "Client Funding", format: (v) => `${v.toFixed(1)}%`, higherIsBetter: true },
          { key: "total_assets", label: "Total Assets", format: (v) => `\u20AC${v.toFixed(0)}M`, higherIsBetter: true },
        ]}
      />
    </div>
  );
}
