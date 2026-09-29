import { useState } from "react";
import type { EsiAnnualJSON, EsiQuarterlyJSON } from "../../lib/esiTypes";
import {
  INVERSIS, MARKET_SV, MARKET_AV, AVG_SV, AVG_AV, INVERSIS_BASIS_NOTE,
} from "../../lib/esiEntities";
import {
  LINE_ITEMS, annualGrowth, verdict, marketShare, rankInSegment, val,
  fmtPct, fmtM, fmtPctPlain, type Verdict, type DisplayKey,
} from "../../lib/esiKpis";
import { esiCommentary } from "../../lib/esiCommentary";
import { POSITIVE_COLOR, NEGATIVE_COLOR, NEUTRAL_COLOR } from "../../lib/colors";
import EsiTrendChart from "../../components/esi/EsiTrendChart";
import CommentaryBox from "../../components/CommentaryBox";

const VERDICT_STYLE: Record<string, { color: string; bg: string }> = {
  AHEAD: { color: POSITIVE_COLOR, bg: "#065f4620" },
  "AT PACE": { color: "#fbbf24", bg: "#78350f20" },
  BEHIND: { color: NEGATIVE_COLOR, bg: "#7f1d1d20" },
};

function VerdictBadge({ v }: { v: Verdict }) {
  const s = VERDICT_STYLE[v.label];
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold"
      style={{ background: s.bg, color: s.color }}>
      {v.label}{v.gap != null ? ` ${v.gap >= 0 ? "+" : ""}${v.gap.toFixed(1)}pp` : ""}
    </span>
  );
}

interface Props {
  annual: EsiAnnualJSON;
  quarterly: EsiQuarterlyJSON;
}

export default function ComisionesRofBenchmark({ annual, quarterly }: Props) {
  const years = annual._metadata.years.map(String);
  const [year, setYear] = useState(years[years.length - 1]);
  const [indexed, setIndexed] = useState(false);
  // Inversis runs an agency-style model (fee-led, ~zero own-account ROF/NII), so the
  // Agencias de Valores are the more like-for-like peer set. Default to AV; let the
  // user switch to SV.
  const [market, setMarket] = useState<"AV" | "SV">("AV");
  const isYtd = annual._metadata.ytd?.[year] != null;
  const basis = isYtd ? annual._metadata.ytd![year].label + " vs prior-year H1" : "vs prior FY";

  const svCount = annual._metadata.entities.filter((e) => e.kind === "firm" && e.segment === "SV").length;
  const avCount = annual._metadata.entities.filter((e) => e.kind === "firm" && e.segment === "AV").length;

  const marketName = market === "AV" ? MARKET_AV : MARKET_SV;
  const otherName = market === "AV" ? MARKET_SV : MARKET_AV;
  const marketLabel = market === "AV" ? "AV market" : "SV market";
  const otherLabel = market === "AV" ? "SV market" : "AV market";
  const marketCount = market === "AV" ? avCount : svCount;

  const headline: { key: DisplayKey; label: string }[] = [
    { key: "comisiones_netas", label: "Comisiones netas" },
    { key: "rof", label: "ROF" },
    { key: "margen_bruto", label: "Margen bruto" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">Comisiones &amp; ROF — Inversis vs the market</h2>
          <p className="text-sm text-slate-400 mt-1">
            Growth pacing against the {market === "AV" ? "Agencias" : "Sociedades"} de Valores market ({basis}). Verdict threshold ±2pp of growth.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center rounded-lg bg-slate-800/70 p-0.5 ring-1 ring-slate-700 text-xs">
            {([["AV", "vs Agencias"], ["SV", "vs Sociedades"]] as const).map(([id, label]) => (
              <button key={id} onClick={() => setMarket(id)}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  market === id ? "bg-slate-700 text-white" : "text-slate-400 hover:text-slate-200"}`}>
                {label}
              </button>
            ))}
          </div>
          <select value={year} onChange={(e) => setYear(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200">
            {years.map((y) => (
              <option key={y} value={y}>{annual._metadata.ytd?.[y] ? `${y} YTD` : `FY ${y}`}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Why AV is the apter peer set */}
      <div className="rounded-lg border border-blue-500/25 bg-blue-950/20 px-4 py-3 text-xs text-slate-300 leading-relaxed">
        <span className="text-blue-300 font-semibold">Por qué comparamos contra Agencias de Valores:</span> el negocio de Inversis es
        <span className="text-white"> predominantemente de comisiones</span> (custodia y distribución de fondos B2B). Genera ROF, pero
        <span className="text-white"> modesto</span> (≈€4M/año, &lt;5% del margen bruto), no el trading por cuenta propia que caracteriza
        a las Sociedades. Las <span className="text-white">Agencias de Valores</span> comparten ese perfil «fee-led» (su ROF agregado es
        casi nulo), por lo que son el grupo comparable más limpio para las líneas de comisiones. Cambia a SV con el conmutador de arriba.
      </div>

      {/* What "market" means */}
      <div className="rounded-lg border border-slate-700/50 bg-slate-800/40 px-4 py-2.5 text-xs text-slate-400 leading-relaxed">
        <span className="text-slate-300 font-medium">Reading the comparison:</span> the “{marketLabel}” line is the
        <span className="text-slate-300"> combined total of all {marketCount} {market === "AV" ? "Agencias" : "Sociedades"} de Valores</span> —
        a sum, not an average. Growth % is scale-free, so it is the fair like-for-like. Where an absolute level matters, we also show the
        <span className="text-slate-300"> average firm</span> (market total ÷ number of firms) and Inversis's market share.
      </div>

      {/* Headline verdict cards — Inversis vs selected market (other market shown for context) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {headline.map(({ key, label }) => {
          const inv = annualGrowth(annual, INVERSIS, year, key);
          const mkt = annualGrowth(annual, marketName, year, key);
          const other = annualGrowth(annual, otherName, year, key);
          const v = verdict(inv, mkt);
          const share = marketShare(annual, INVERSIS, marketName, year, key);
          const rank = rankInSegment(annual, INVERSIS, year, key, market);
          return (
            <div key={key} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-slate-400 uppercase tracking-wider font-medium">{label}</p>
                <VerdictBadge v={v} />
              </div>
              <div className="flex items-end gap-4">
                <div>
                  <p className="text-[10px] text-slate-500 uppercase">Inversis growth</p>
                  <p className="text-2xl font-bold" style={{ color: inv == null ? NEUTRAL_COLOR : inv >= 0 ? POSITIVE_COLOR : NEGATIVE_COLOR }}>
                    {inv != null ? fmtPct(inv) : "N/A"}
                  </p>
                </div>
                <div className="pb-1">
                  <p className="text-[10px] text-slate-500 uppercase">{marketLabel}</p>
                  <p className="text-lg font-semibold text-slate-300">{mkt != null ? fmtPct(mkt) : "N/A"}</p>
                </div>
                <div className="pb-1">
                  <p className="text-[10px] text-slate-600 uppercase">{otherLabel}</p>
                  <p className="text-sm font-medium text-slate-500">{other != null ? fmtPct(other) : "N/A"}</p>
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                {share != null && share <= 100 && <>≈ {share.toFixed(0)}% of the {marketLabel}</>}
                {share != null && share <= 100 && rank && rank.total >= 5 && " · "}
                {rank && rank.total >= 5 && <>#{rank.rank} of {rank.total} {market} firms</>}
                {(share == null || share > 100) && !(rank && rank.total >= 5) && (
                  <span className="text-slate-600">sin cuota comparable (el mercado apenas hace esta línea)</span>
                )}
              </p>
            </div>
          );
        })}
      </div>

      {/* Multi-line-item scorecard */}
      <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-700/50">
          <h3 className="text-sm font-semibold text-slate-300">All line items — growth vs market</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700/50 text-xs text-slate-400 uppercase tracking-wider">
                <th className="text-left px-5 py-3 font-medium">Line item</th>
                <th className="text-right px-5 py-3 font-medium">Inversis (€M)</th>
                <th className="text-right px-5 py-3 font-medium">Inversis YoY</th>
                <th className={`text-right px-4 py-3 font-medium ${market === "SV" ? "text-slate-200" : ""}`}>SV (€M)</th>
                <th className={`text-right px-3 py-3 font-medium ${market === "SV" ? "text-slate-200" : ""}`}>SV YoY</th>
                <th className={`text-right px-4 py-3 font-medium ${market === "AV" ? "text-slate-200" : ""}`}>AV (€M)</th>
                <th className={`text-right px-3 py-3 font-medium ${market === "AV" ? "text-slate-200" : ""}`}>AV YoY</th>
                <th className="text-right px-5 py-3 font-medium">Verdict (vs {market})</th>
              </tr>
            </thead>
            <tbody>
              {LINE_ITEMS.map((li) => {
                const cur = val(annual.data[year]?.[INVERSIS], li.key);
                const svVal = val(annual.data[year]?.[MARKET_SV], li.key);
                const avVal = val(annual.data[year]?.[MARKET_AV], li.key);
                const inv = annualGrowth(annual, INVERSIS, year, li.key);
                const sv = annualGrowth(annual, MARKET_SV, year, li.key);
                const av = annualGrowth(annual, MARKET_AV, year, li.key);
                const v = verdict(inv, market === "AV" ? av : sv, li.higherIsBetter);
                const g = (x: number | null) =>
                  x == null ? <span className="text-slate-600">—</span>
                    : <span style={{ color: x >= 0 ? POSITIVE_COLOR : NEGATIVE_COLOR }}>{fmtPct(x)}</span>;
                return (
                  <tr key={li.key} className="border-b border-slate-700/30 hover:bg-slate-700/20">
                    <td className="px-5 py-3 text-slate-300">{li.label}</td>
                    <td className="text-right px-5 py-3 font-mono text-slate-300">{cur != null ? li.format(cur) : "—"}</td>
                    <td className="text-right px-5 py-3 font-mono">{g(inv)}</td>
                    <td className={`text-right px-4 py-3 font-mono ${market === "SV" ? "text-slate-300" : "text-slate-500"}`}>{svVal != null ? li.format(svVal) : "—"}</td>
                    <td className="text-right px-3 py-3 font-mono">{g(sv)}</td>
                    <td className={`text-right px-4 py-3 font-mono ${market === "AV" ? "text-slate-300" : "text-slate-500"}`}>{avVal != null ? li.format(avVal) : "—"}</td>
                    <td className="text-right px-3 py-3 font-mono">{g(av)}</td>
                    <td className="text-right px-5 py-3">{inv != null && (market === "AV" ? av : sv) != null ? <VerdictBadge v={v} /> : <span className="text-slate-600">—</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="px-5 py-2.5 text-[11px] text-slate-500 border-t border-slate-700/50">
          "Ingresos no-comisiones" = margen bruto − comisiones netas (ROF + intereses + FX + otros): the per-entity trading proxy,
          since CNMV discloses true ROF only for the market aggregate. Gross comisiones percibidas are omitted for Inversis before 2025 (see note below).
        </p>
      </div>

      {/* Revenue mix + trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-5">
          <h3 className="text-sm font-semibold text-slate-300 mb-4">Revenue mix — % of margen bruto (sums to 100%)</h3>
          <MixTable annual={annual} year={year} />
          <p className="text-[11px] text-slate-500 mt-3">
            The SV market earns far more of its margin from ROF (trading) than Inversis does — Inversis is fee-led.
          </p>
        </div>
        <div>
          <div className="flex justify-end mb-2">
            <div className="flex items-center rounded-lg bg-slate-800/70 p-0.5 ring-1 ring-slate-700 text-xs">
              {([["abs", "€M"], ["idx", "Indexed"]] as const).map(([id, label]) => (
                <button key={id} onClick={() => setIndexed(id === "idx")}
                  className={`px-2.5 py-1 rounded-md transition-all ${
                    (id === "idx") === indexed ? "bg-slate-700 text-white" : "text-slate-400 hover:text-slate-200"}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <EsiTrendChart
            data={quarterly}
            metric="comisiones_netas"
            title="Comisiones netas — quarterly"
            entities={[INVERSIS, marketName, otherName, market === "AV" ? AVG_AV : AVG_SV]}
            formatValue={fmtM}
            indexed={indexed}
            height={248}
          />
        </div>
      </div>

      {/* Commentary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {esiCommentary(annual, year).map((c, i) => <CommentaryBox key={i} commentary={c} />)}
      </div>

      <p className="text-[11px] text-slate-500 leading-relaxed">{INVERSIS_BASIS_NOTE}</p>
    </div>
  );
}

function MixTable({ annual, year }: { annual: EsiAnnualJSON; year: string }) {
  const entities = [
    { name: INVERSIS, label: "Inversis" },
    { name: MARKET_SV, label: "SV market" },
    { name: MARKET_AV, label: "AV market" },
  ];
  // Full decomposition of margen bruto (sums to ~100% per entity). "Otros" is the
  // residual (dividends, otros de explotación) so the column closes to 100%.
  const rows: { key: DisplayKey | "otros"; label: string }[] = [
    { key: "comisiones_netas", label: "Comisiones netas" },
    { key: "margen_intereses", label: "Margen intereses" },
    { key: "rof", label: "ROF" },
    { key: "diferencias_cambio", label: "Dif. de cambio (FX)" },
    { key: "otros", label: "Otros" },
  ];
  const pctOf = (name: string, key: DisplayKey): number | null => {
    const num = val(annual.data[year]?.[name], key);
    const den = val(annual.data[year]?.[name], "margen_bruto");
    return num != null && den != null && den !== 0 ? (num / den) * 100 : null;
  };
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-xs text-slate-400 uppercase tracking-wider">
          <th className="text-left py-2 font-medium">Component</th>
          {entities.map((e) => <th key={e.name} className="text-right py-2 font-medium">{e.label}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.key} className="border-t border-slate-700/30">
            <td className="py-2.5 text-slate-300">{r.label}</td>
            {entities.map((e) => {
              let pct: number | null;
              if (r.key === "otros") {
                const parts = (["comisiones_netas", "margen_intereses", "rof", "diferencias_cambio"] as DisplayKey[])
                  .map((k) => pctOf(e.name, k))
                  .filter((p): p is number => p != null);
                pct = parts.length ? 100 - parts.reduce((s, p) => s + p, 0) : null;
              } else {
                pct = pctOf(e.name, r.key);
              }
              return <td key={e.name} className="text-right py-2.5 font-mono text-slate-300">{pct != null ? fmtPctPlain(pct) : "—"}</td>;
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
