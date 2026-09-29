import { useState } from "react";
import type { EsiAnnualJSON, EsiQuarterlyJSON } from "../../lib/esiTypes";
import { INVERSIS, MARKET_SV, MARKET_AV, AVG_SV } from "../../lib/esiEntities";
import { COMMISSION_SUBTYPES, val, annualGrowth, fmtM, fmtPct, fmtPctPlain, type DisplayKey } from "../../lib/esiKpis";

const ROF_INSTR: { key: DisplayKey; label: string }[] = [
  { key: "rof_renta_fija", label: "Renta fija" },
  { key: "rof_acciones", label: "Acciones" },
  { key: "rof_derivados", label: "Derivados negoc." },
  { key: "rof_otros", label: "Otros" },
];
import { ytdNote } from "../../lib/periods";
import type { AnnualJSON } from "../../lib/types";
import EsiTrendChart from "../../components/esi/EsiTrendChart";
import { esiColor, INVERSIS_BASIS_NOTE } from "../../lib/esiEntities";

interface Props {
  annual: EsiAnnualJSON;
  quarterly: EsiQuarterlyJSON;
}

export default function MarketOverview({ annual, quarterly }: Props) {
  const years = annual._metadata.years.map(String);
  const [year, setYear] = useState(years[years.length - 1]);
  const isYtd = annual._metadata.ytd?.[year] != null;
  // ytdNote reads only _metadata.ytd; safe to reuse via a structural cast.
  const note = isYtd ? ytdNote(annual as unknown as AnnualJSON, year) : null;

  const svCount = annual._metadata.entities.filter((e) => e.kind === "firm" && e.segment === "SV").length;
  const avCount = annual._metadata.entities.filter((e) => e.kind === "firm" && e.segment === "AV").length;

  // Headline KPIs per segment (SV block, then AV block): revenue → income → bottom
  // line → return → efficiency. Efficiency is derived (gastos_explotacion ÷ margen
  // bruto); ROE is the official CNMV pre-tax figure.
  const segments = [
    { name: MARKET_SV, label: "Sociedades de Valores", count: svCount },
    { name: MARKET_AV, label: "Agencias de Valores", count: avCount },
  ];
  const kpiDefs: { key: DisplayKey | "eficiencia"; label: string; fmt: (v: number) => string; growth: boolean; higherIsBetter?: boolean }[] = [
    { key: "comisiones_netas", label: "Comisiones netas", fmt: fmtM, growth: true },
    { key: "margen_bruto", label: "Margen bruto", fmt: fmtM, growth: true },
    { key: "resultado_antes_impuestos", label: "Resultado a. imptos.", fmt: fmtM, growth: true },
    { key: "roe_cnmv", label: "ROE (CNMV)", fmt: fmtPctPlain, growth: false },
    { key: "eficiencia", label: "Ratio de eficiencia", fmt: fmtPctPlain, growth: false, higherIsBetter: false },
  ];
  const kpiValue = (mkt: string, key: DisplayKey | "eficiencia"): number | null => {
    if (key === "eficiencia") {
      const c = val(annual.data[year]?.[mkt], "gastos_explotacion");
      const m = val(annual.data[year]?.[mkt], "margen_bruto");
      return c != null && m ? (c / m) * 100 : null;
    }
    return val(annual.data[year]?.[mkt], key);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">Securities-firms market — overview</h2>
          <p className="text-sm text-slate-400 mt-1">
            CNMV market totals ({svCount} Sociedades + {avCount} Agencias de Valores). Inversis (bank-basis) shown for reference.
          </p>
        </div>
        <select value={year} onChange={(e) => setYear(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200">
          {years.map((y) => <option key={y} value={y}>{annual._metadata.ytd?.[y] ? `${y} YTD` : `FY ${y}`}</option>)}
        </select>
      </div>

      {note && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-950/20 px-4 py-2.5">
          <span className="text-sm leading-none mt-0.5">🕐</span>
          <p className="text-xs text-slate-400 leading-relaxed">{note}</p>
        </div>
      )}

      {segments.map((seg) => (
        <div key={seg.name}>
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: esiColor(seg.name) }} />
            <h3 className="text-sm font-semibold text-slate-200">{seg.label}</h3>
            <span className="text-[11px] text-slate-500">· total de {seg.count} firmas</span>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {kpiDefs.map((k) => {
              const v = kpiValue(seg.name, k.key);
              const gr = k.growth && k.key !== "eficiencia" ? annualGrowth(annual, seg.name, year, k.key as DisplayKey) : null;
              return (
                <div key={k.key} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
                  <p className="text-[11px] text-slate-400 uppercase tracking-wider font-medium">{k.label}</p>
                  <p className="text-xl font-bold text-white mt-1">{v != null ? k.fmt(v) : "N/A"}</p>
                  {gr != null
                    ? <span className="text-xs" style={{ color: gr >= 0 ? "#34d399" : "#f87171" }}>{fmtPct(gr)} YoY</span>
                    : <span className="text-[10px] text-slate-500">{k.key === "eficiencia" ? "gastos ÷ margen bruto" : k.key === "roe_cnmv" ? "antes de imptos." : "total mercado"}</span>}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Commission composition — SV vs AV side by side (where the fees come from) */}
      <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-5">
        <h3 className="text-sm font-semibold text-slate-300 mb-1">
          ¿De dónde salen las comisiones? — composición por tipo, SV vs AV
        </h3>
        <p className="text-[11px] text-slate-500 mb-4">
          Comisiones percibidas por tipo (% del bruto y €M). Los dos segmentos ganan sus comisiones en sitios muy distintos.
        </p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <CommissionMix annual={annual} year={year} market={MARKET_SV} label="Sociedades de Valores" />
          <CommissionMix annual={annual} year={year} market={MARKET_AV} label="Agencias de Valores" />
        </div>
        <p className="text-[11px] text-slate-500 mt-4 leading-relaxed border-t border-slate-700/40 pt-3">
          <span className="text-slate-300 font-medium">Contraste clave:</span> las <span className="text-slate-300">Sociedades</span> viven
          sobre todo de la <span className="text-slate-300">ejecución de órdenes</span> (~40% de sus comisiones percibidas; la custodia pesa solo ~7-8%);
          las <span className="text-slate-300">Agencias</span>, de la <span className="text-slate-300">comercialización de IIC</span> (~50%) y el
          asesoramiento, casi sin ejecución ni custodia. Inversis —custodio y distribuidor de fondos B2B, con un ROF modesto— encaja mejor
          con el perfil «fee-led» de una Agencia que con el de una Sociedad. Los subtipos solo se publican a nivel agregado (no por firma).
        </p>
      </div>

      {/* ROF composition by instrument (SV vs AV market) */}
      <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-5">
        <h3 className="text-sm font-semibold text-slate-300 mb-1">
          ROF by instrument — where the market's trading result comes from
        </h3>
        <p className="text-[11px] text-slate-500 mb-4">
          Net result of proprietary activity (ganancias − pérdidas), from the CNMV P&L. Fixed income dominates.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[{ name: MARKET_SV, label: "Sociedades de Valores" }, { name: MARKET_AV, label: "Agencias de Valores" }].map((m) => {
            const total = val(annual.data[year]?.[m.name], "rof");
            const maxAbs = Math.max(1, ...ROF_INSTR.map((r) => Math.abs(val(annual.data[year]?.[m.name], r.key) ?? 0)));
            return (
              <div key={m.name}>
                <p className="text-xs font-medium text-slate-300 mb-2">
                  {m.label} <span className="text-slate-500">· ROF total {total != null ? fmtM(total) : "—"}</span>
                </p>
                <div className="space-y-2">
                  {ROF_INSTR.map((r) => {
                    const v = val(annual.data[year]?.[m.name], r.key);
                    const w = v != null ? (Math.abs(v) / maxAbs) * 100 : 0;
                    const neg = (v ?? 0) < 0;
                    return (
                      <div key={r.key} className="flex items-center gap-2">
                        <span className="text-xs text-slate-400 w-32 flex-shrink-0">{r.label}</span>
                        <div className="flex-1 h-3.5 bg-slate-800 rounded overflow-hidden">
                          <div className="h-full rounded" style={{ width: `${w}%`, background: neg ? "#f87171" : "#d97706" }} />
                        </div>
                        <span className="text-xs font-mono w-14 text-right" style={{ color: neg ? "#f87171" : "#cbd5e1" }}>
                          {v != null ? fmtM(Math.abs(v) < 0.05 ? 0 : v) : "—"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Market scale & activity (Cap.2) + on-exchange execution (Anexo A1) */}
      <ScaleActivity annual={annual} year={year} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <EsiTrendChart data={quarterly} metric="comisiones_netas"
          title="Comisiones netas — quarterly (€M)"
          entities={[INVERSIS, MARKET_SV, MARKET_AV, AVG_SV]} formatValue={fmtM} height={280} />
        <EsiTrendChart data={quarterly} metric="rof"
          title="ROF — quarterly (€M)"
          entities={[INVERSIS, MARKET_SV, MARKET_AV]} formatValue={fmtM} height={280} />
      </div>

      <p className="text-[11px] text-slate-500 leading-relaxed">{INVERSIS_BASIS_NOTE}</p>
    </div>
  );
}

// Commission composition of one market aggregate: sub-types as % of comisiones
// percibidas, plus an "Otras" residual so the bars close to the gross total.
function CommissionMix({ annual, year, market, label }: { annual: EsiAnnualJSON; year: string; market: string; label: string }) {
  const gross = val(annual.data[year]?.[market], "comisiones_percibidas");
  const color = esiColor(market);
  const parts = COMMISSION_SUBTYPES.map((s) => ({ key: s.key as string, label: s.label, v: val(annual.data[year]?.[market], s.key) }));
  const named = parts.reduce((s, p) => s + (p.v ?? 0), 0);
  const rows = [...parts, { key: "otras", label: "Otras comisiones", v: gross != null ? gross - named : null }];
  return (
    <div>
      <p className="text-xs font-medium text-slate-300 mb-2">
        {label} <span className="text-slate-500">· percibidas {gross != null ? fmtM(gross) : "—"}</span>
      </p>
      <div className="space-y-1.5">
        {rows.map((s) => {
          const pct = s.v != null && gross ? (s.v / gross) * 100 : null;
          return (
            <div key={s.key} className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400 w-32 flex-shrink-0 truncate" title={s.label}>{s.label}</span>
              <div className="flex-1 h-3.5 bg-slate-800 rounded overflow-hidden">
                <div className="h-full rounded" style={{ width: `${Math.max(0, pct ?? 0)}%`, background: s.key === "otras" ? "#475569" : color }} />
              </div>
              <span className="text-[11px] font-mono text-slate-300 w-24 text-right">
                {s.v != null ? fmtM(s.v) : "—"} {pct != null && <span className="text-slate-500">({fmtPctPlain(pct)})</span>}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ScaleActivity({ annual, year }: { annual: EsiAnnualJSON; year: string }) {
  const sv = (k: DisplayKey) => val(annual.data[year]?.[MARKET_SV], k);
  const g = (k: DisplayKey) => annualGrowth(annual, MARKET_SV, year, k);
  const months = annual._metadata.ytd?.[year]?.months ?? 12;
  const ytd = annual._metadata.ytd?.[year] != null;
  // €k of a flow per employee, annualised for YTD years, for either market.
  const perEmpOf = (market: string, k: DisplayKey) => {
    const v = val(annual.data[year]?.[market], k), emp = val(annual.data[year]?.[market], "empleados");
    return v != null && emp ? ((v * 12) / months / emp) * 1000 : null;
  };
  const fmtBig = (v: number) => (v >= 1e6 ? `€${(v / 1e6).toFixed(2)}tn` : v >= 1000 ? `€${(v / 1000).toFixed(0)}bn` : `€${v.toFixed(0)}M`);
  const exchange = annual._metadata.exchange_participation?.[year];
  const cards = [
    { label: "Volumen bolsa (RV)", v: sv("volumen_rv"), fmt: fmtBig, growth: g("volumen_rv"), sub: "intermediación equity" },
    { label: "Volumen renta fija", v: sv("volumen_rf"), fmt: fmtBig, growth: g("volumen_rf"), sub: "repo / OTC" },
    { label: "Gestión de carteras", v: sv("contratos_gestion"), fmt: (x: number) => x.toLocaleString("es"), growth: g("contratos_gestion"), sub: "contratos" },
    { label: "ROE (CNMV)", v: sv("roe_cnmv"), fmt: fmtPctPlain, growth: null as number | null, sub: "antes de impuestos" },
  ];
  return (
    <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-5">
      <h3 className="text-sm font-semibold text-slate-300 mb-1">Escala y actividad del mercado — SV vs AV</h3>
      <p className="text-[11px] text-slate-500 mb-4">
        Volúmenes intermediados, carteras gestionadas, productividad por empleado y ROE oficial (CNMV Cap.2 / Anexo A1).
        {ytd ? " Volúmenes en H1; productividad anualizada." : ""}
      </p>
      <p className="text-[11px] text-slate-400 uppercase tracking-wider mb-2">
        Volúmenes intermediados — Sociedades de Valores <span className="text-slate-600 normal-case">(la CNMV solo publica volúmenes por segmento para SV)</span>
      </p>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        {cards.map((c) => (
          <div key={c.label}>
            <p className="text-xs text-slate-400 uppercase tracking-wider">{c.label}</p>
            <p className="text-xl font-bold text-white mt-1">{c.v != null ? c.fmt(c.v) : "—"}</p>
            <div className="flex items-center gap-2 mt-0.5">
              {c.growth != null && <span className="text-xs" style={{ color: c.growth >= 0 ? "#34d399" : "#f87171" }}>{fmtPct(c.growth)}</span>}
              <span className="text-[10px] text-slate-500">{c.sub}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 border-t border-slate-700/50 pt-4">
        <div>
          <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">Escala y productividad — SV vs AV</p>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-500">
                <th className="text-left font-medium pb-1"></th>
                <th className="text-right font-medium pb-1">Sociedades</th>
                <th className="text-right font-medium pb-1">Agencias</th>
              </tr>
            </thead>
            <tbody className="text-slate-300">
              {[
                { label: "Empleados", sv: sv("empleados"), av: val(annual.data[year]?.[MARKET_AV], "empleados"), fmt: (x: number) => x.toLocaleString("es") },
                { label: "Com. netas / empleado", sv: perEmpOf(MARKET_SV, "comisiones_netas"), av: perEmpOf(MARKET_AV, "comisiones_netas"), fmt: (x: number) => `€${x.toFixed(0)}k` },
                { label: "Margen bruto / empleado", sv: perEmpOf(MARKET_SV, "margen_bruto"), av: perEmpOf(MARKET_AV, "margen_bruto"), fmt: (x: number) => `€${x.toFixed(0)}k` },
                { label: "ROE (CNMV, a.i.)", sv: sv("roe_cnmv"), av: val(annual.data[year]?.[MARKET_AV], "roe_cnmv"), fmt: fmtPctPlain },
                { label: "Contratos gestión", sv: sv("contratos_gestion"), av: val(annual.data[year]?.[MARKET_AV], "contratos_gestion"), fmt: (x: number) => x.toLocaleString("es") },
              ].map((r) => (
                <tr key={r.label} className="border-t border-slate-700/30">
                  <td className="py-1.5 text-slate-400">{r.label}</td>
                  <td className="py-1.5 text-right font-mono">{r.sv != null ? r.fmt(r.sv) : "—"}</td>
                  <td className="py-1.5 text-right font-mono">{r.av != null ? r.fmt(r.av) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-[10px] text-slate-500 mt-2">
            Las Agencias hacen muchos más contratos de gestión discrecional (canal de asesoramiento masivo); las Sociedades, más volumen de mercado.
          </p>
        </div>
        {exchange && (
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">Cuota en contratación bursátil (equity)</p>
            {exchange.inversis && (
              <p className="text-sm mb-2">
                <span className="text-blue-300 font-semibold">Inversis {fmtPctPlain(exchange.inversis.rv)}</span>
                <span className="text-slate-500"> · puesto #{exchange.inversis.rank} de {exchange.count} miembros</span>
              </p>
            )}
            <div className="space-y-1">
              {exchange.top.slice(0, 5).map((m) => (
                <div key={m.name} className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-400 w-36 truncate">{m.name}</span>
                  <div className="flex-1 h-2.5 bg-slate-800 rounded overflow-hidden">
                    <div className="h-full rounded" style={{ width: `${Math.min(100, (m.rv / (exchange.top[0]?.rv || 1)) * 100)}%`, background: "#64748b" }} />
                  </div>
                  <span className="text-[11px] font-mono text-slate-400 w-10 text-right">{m.rv}%</span>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-slate-500 mt-2">
              Universo = miembros del mercado bursátil (incluye bancos y brókeres internacionales). Inversis es un actor pequeño en ejecución directa.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
