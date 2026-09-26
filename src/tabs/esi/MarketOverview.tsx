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

  const stat = (name: string, key: Parameters<typeof val>[1]) => ({
    v: val(annual.data[year]?.[name], key),
    g: annualGrowth(annual, name, year, key),
  });
  const svCount = annual._metadata.entities.filter((e) => e.kind === "firm" && e.segment === "SV").length;
  const avCount = annual._metadata.entities.filter((e) => e.kind === "firm" && e.segment === "AV").length;

  const cards = [
    { label: `Sociedades de Valores · comisiones netas`, sub: `total of ${svCount} firms`, ...stat(MARKET_SV, "comisiones_netas"), color: esiColor(MARKET_SV) },
    { label: `Agencias de Valores · comisiones netas`, sub: `total of ${avCount} firms`, ...stat(MARKET_AV, "comisiones_netas"), color: esiColor(MARKET_AV) },
    { label: "Sociedades de Valores · ROF", sub: "market total", ...stat(MARKET_SV, "rof"), color: esiColor(MARKET_SV) },
    { label: "Sociedades de Valores · margen bruto", sub: "market total", ...stat(MARKET_SV, "margen_bruto"), color: esiColor(MARKET_SV) },
  ];

  // SV market commission composition (sub-types as % of comisiones percibidas).
  const svComTotal = val(annual.data[year]?.[MARKET_SV], "comisiones_percibidas");

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

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 rounded-full" style={{ background: c.color }} />
              <p className="text-xs text-slate-400 uppercase tracking-wider font-medium">{c.label}</p>
            </div>
            <p className="text-2xl font-bold text-white">{c.v != null ? fmtM(c.v) : "N/A"}</p>
            <div className="flex items-center gap-2 mt-1">
              {c.g != null && <span className="text-xs" style={{ color: c.g >= 0 ? "#34d399" : "#f87171" }}>{fmtPct(c.g)} YoY</span>}
              <span className="text-[10px] text-slate-500">{c.sub}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Commission composition of the SV market */}
      <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-5">
        <h3 className="text-sm font-semibold text-slate-300 mb-4">
          SV market commission mix — where the fees come from
        </h3>
        <div className="space-y-2.5">
          {COMMISSION_SUBTYPES.map((s) => {
            const v = val(annual.data[year]?.[MARKET_SV], s.key);
            const pct = v != null && svComTotal ? (v / svComTotal) * 100 : null;
            return (
              <div key={s.key} className="flex items-center gap-3">
                <span className="text-xs text-slate-400 w-44 flex-shrink-0">{s.label}</span>
                <div className="flex-1 h-4 bg-slate-800 rounded overflow-hidden">
                  <div className="h-full rounded" style={{ width: `${pct ?? 0}%`, background: esiColor(MARKET_SV) }} />
                </div>
                <span className="text-xs font-mono text-slate-300 w-28 text-right">
                  {v != null ? fmtM(v) : "—"} {pct != null && <span className="text-slate-500">({fmtPctPlain(pct)})</span>}
                </span>
              </div>
            );
          })}
        </div>
        <p className="text-[11px] text-slate-500 mt-3">
          Sub-types are disclosed only at the market-aggregate level (not per firm). "Tramitación y ejecución" ≈ execution,
          "Depósito y anotación" ≈ custody, "Comercialización de IIC" ≈ fund distribution.
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

function ScaleActivity({ annual, year }: { annual: EsiAnnualJSON; year: string }) {
  const sv = (k: DisplayKey) => val(annual.data[year]?.[MARKET_SV], k);
  const g = (k: DisplayKey) => annualGrowth(annual, MARKET_SV, year, k);
  const months = annual._metadata.ytd?.[year]?.months ?? 12;
  const ytd = annual._metadata.ytd?.[year] != null;
  const perEmp = (k: DisplayKey) => {
    const v = sv(k), emp = sv("empleados");
    return v != null && emp ? ((v * 12) / months / emp) * 1000 : null; // €k/employee, annualised
  };
  const emp = sv("empleados");
  const contratos = sv("contratos_gestion");
  const fmtBig = (v: number) => (v >= 1e6 ? `€${(v / 1e6).toFixed(2)}tn` : v >= 1000 ? `€${(v / 1000).toFixed(0)}bn` : `€${v.toFixed(0)}M`);
  const exchange = annual._metadata.exchange_participation?.[year];
  const cards = [
    { label: "Volumen bolsa (RV)", v: sv("volumen_rv"), fmt: fmtBig, growth: g("volumen_rv"), sub: "intermediación equity" },
    { label: "Volumen renta fija", v: sv("volumen_rf"), fmt: fmtBig, growth: g("volumen_rf"), sub: "repo / OTC" },
    { label: "Gestión de carteras", v: contratos, fmt: (x: number) => x.toLocaleString("es"), growth: g("contratos_gestion"), sub: "contratos" },
    { label: "ROE (CNMV)", v: sv("roe_cnmv"), fmt: fmtPctPlain, growth: null as number | null, sub: "antes de impuestos" },
  ];
  return (
    <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-5">
      <h3 className="text-sm font-semibold text-slate-300 mb-1">Market scale &amp; activity — Sociedades de Valores</h3>
      <p className="text-[11px] text-slate-500 mb-4">
        Volumes intermediated, managed portfolios, headcount productivity and official ROE (CNMV Cap.2 / Anexo A1).
        {ytd ? " Volumes are H1; productivity annualised." : ""}
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
          <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">Productividad del mercado</p>
          <p className="text-sm text-slate-300">
            {emp != null ? `${emp.toLocaleString("es")} empleados` : "—"}
            {perEmp("comisiones_netas") != null && <> · <span className="text-white font-semibold">€{perEmp("comisiones_netas")!.toFixed(0)}k</span> comisiones netas / empleado</>}
            {perEmp("margen_bruto") != null && <> · €{perEmp("margen_bruto")!.toFixed(0)}k margen bruto / empleado</>}
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
