import { Fragment, useMemo, useState } from "react";
import type { EsiAnnualJSON, EsiQuarterlyJSON, EsiTag } from "../../lib/esiTypes";
import { esiTag, esiDisplayName, esiColor, AVG_SV, AVG_AV } from "../../lib/esiEntities";
import { val, annualGrowth, feeRetention, fmtM, fmtM2, fmtPct, fmtPctPlain, type DisplayKey } from "../../lib/esiKpis";
import { POSITIVE_COLOR, NEGATIVE_COLOR } from "../../lib/colors";
import EsiTrendChart from "./EsiTrendChart";

type Filter = "peers" | "all" | "clients" | "SV" | "AV";
type SortKey = DisplayKey | "netasG" | "nofeeG" | "retention";

const COLUMNS: { key: DisplayKey; label: string; growthKey?: SortKey; fmt: (v: number) => string }[] = [
  { key: "comisiones_netas", label: "Com. netas", growthKey: "netasG", fmt: fmtM },
  { key: "no_fee_income", label: "Ingresos no-com. (ROF+)", growthKey: "nofeeG", fmt: fmtM2 },
  { key: "margen_bruto", label: "Margen bruto", fmt: fmtM },
  { key: "gastos_explotacion", label: "Gastos expl.", fmt: fmtM },
  { key: "resultado_antes_impuestos", label: "Rtdo. a.i.", fmt: fmtM },
  { key: "cuota_bolsa_rv", label: "Cuota bolsa", fmt: fmtPctPlain },
];

const FILTERS: { id: Filter; label: string }[] = [
  { id: "peers", label: "Peers + clients" },
  { id: "all", label: "All firms" },
  { id: "clients", label: "Clients" },
  { id: "SV", label: "Sociedades" },
  { id: "AV", label: "Agencias" },
];

const TAG_CHIP: Record<EsiTag, { label: string; cls: string } | null> = {
  reference: { label: "Inversis", cls: "bg-blue-500/20 text-blue-300" },
  peer: { label: "peer", cls: "bg-fuchsia-500/15 text-fuchsia-300" },
  client: { label: "client", cls: "bg-emerald-500/20 text-emerald-300" },
  market: null,
  average: null,
  other: null,
};

interface Props {
  data: EsiAnnualJSON;
  quarterly: EsiQuarterlyJSON;
  year: string;
}

export default function EsiLeagueTable({ data, quarterly, year }: Props) {
  const [filter, setFilter] = useState<Filter>("peers");
  const [sortKey, setSortKey] = useState<SortKey>("comisiones_netas");
  const [desc, setDesc] = useState(true);
  const [open, setOpen] = useState<string | null>(null);

  const rows = useMemo(() => {
    const names = data._metadata.entities.filter((e) => e.kind === "firm").map((e) => e.name);
    const segOf = (n: string) => data._metadata.entities.find((e) => e.name === n)?.segment;
    const filtered = names.filter((n) => {
      const tag = esiTag(n);
      if (filter === "all") return true;
      if (filter === "peers") return tag === "peer" || tag === "client" || tag === "reference";
      if (filter === "clients") return tag === "client" || tag === "reference";
      return segOf(n) === filter;
    });
    const built = filtered.map((n) => ({
      name: n,
      tag: esiTag(n),
      seg: segOf(n),
      netasG: annualGrowth(data, n, year, "comisiones_netas"),
      nofeeG: annualGrowth(data, n, year, "no_fee_income"),
      retention: feeRetention(data.data[year]?.[n]),
      vals: Object.fromEntries(COLUMNS.map((c) => [c.key, val(data.data[year]?.[n], c.key)])) as Record<DisplayKey, number | null>,
    }));
    const pick = (r: (typeof built)[number]) =>
      sortKey === "netasG" ? r.netasG : sortKey === "nofeeG" ? r.nofeeG
        : sortKey === "retention" ? r.retention : r.vals[sortKey as DisplayKey];
    built.sort((a, b) => {
      const av = pick(a), bv = pick(b);
      if (av == null) return 1;
      if (bv == null) return -1;
      return desc ? bv - av : av - bv;
    });
    return built;
  }, [data, year, filter, sortKey, desc]);

  const clickSort = (k: SortKey) => {
    if (k === sortKey) setDesc((d) => !d);
    else { setSortKey(k); setDesc(true); }
  };
  const arrow = (k: SortKey) => (sortKey === k ? (desc ? " ▼" : " ▲") : "");
  const growthCell = (g: number | null) =>
    g != null ? <span style={{ color: g >= 0 ? POSITIVE_COLOR : NEGATIVE_COLOR }}>{fmtPct(g)}</span> : <span className="text-slate-600">—</span>;

  return (
    <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-700/50 flex items-center justify-between flex-wrap gap-3">
        <h3 className="text-sm font-semibold text-slate-300">
          League table <span className="text-slate-500 font-normal">· {rows.length} firms · click a row for quarterly evolution</span>
        </h3>
        <div className="flex gap-1">
          {FILTERS.map((f) => (
            <button key={f.id} onClick={() => setFilter(f.id)}
              className={`px-2.5 py-1 text-xs rounded-lg transition-colors ${
                filter === f.id ? "bg-slate-700 text-white" : "bg-slate-800/50 text-slate-400 hover:text-slate-200"}`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700/50 text-xs text-slate-400 uppercase tracking-wider">
              <th className="text-left px-4 py-2.5 font-medium">Firm</th>
              {COLUMNS.map((c) => (
                <Fragment key={c.key}>
                  <th className="text-right px-4 py-2.5 font-medium cursor-pointer hover:text-slate-200 whitespace-nowrap"
                    onClick={() => clickSort(c.key)}>
                    {c.label}{arrow(c.key)}
                  </th>
                  {c.growthKey && (
                    <th className="text-right px-3 py-2.5 font-medium cursor-pointer hover:text-slate-200 whitespace-nowrap"
                      onClick={() => clickSort(c.growthKey!)}>
                      YoY{arrow(c.growthKey)}
                    </th>
                  )}
                </Fragment>
              ))}
              <th className="text-right px-4 py-2.5 font-medium cursor-pointer hover:text-slate-200 whitespace-nowrap"
                onClick={() => clickSort("retention")} title="Comisiones netas ÷ percibidas — cuánto del bruto retiene la firma tras retrocesiones">
                % net/bruto{arrow("retention")}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const chip = TAG_CHIP[r.tag];
              const hi = r.tag === "reference";
              const isClient = r.tag === "client";
              const isOpen = open === r.name;
              const avgName = r.seg === "AV" ? AVG_AV : AVG_SV;
              return (
                <Fragment key={r.name}>
                  <tr
                    onClick={() => setOpen(isOpen ? null : r.name)}
                    className={`border-b border-slate-700/30 cursor-pointer ${
                      hi ? "bg-blue-950/30" : isClient ? "bg-emerald-950/20" : isOpen ? "bg-slate-700/30" : "hover:bg-slate-700/20"}`}>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-600 text-xs w-3">{isOpen ? "▾" : "▸"}</span>
                        <span className="w-2 h-2 rounded-full inline-block flex-shrink-0" style={{ background: esiColor(r.name) }} />
                        <span className={hi ? "text-blue-300 font-semibold" : "text-slate-300"}>{esiDisplayName(r.name)}</span>
                        {chip && <span className={`text-[10px] px-1.5 py-0.5 rounded ${chip.cls}`}>{chip.label}</span>}
                      </div>
                    </td>
                    {COLUMNS.map((c) => (
                      <Fragment key={c.key}>
                        <td className={`text-right px-4 py-2.5 font-mono ${hi ? "text-blue-200" : "text-slate-300"}`}>
                          {r.vals[c.key] != null ? c.fmt(r.vals[c.key]!) : <span className="text-slate-600">—</span>}
                        </td>
                        {c.growthKey && (
                          <td className="text-right px-3 py-2.5 font-mono">
                            {growthCell(c.growthKey === "netasG" ? r.netasG : r.nofeeG)}
                          </td>
                        )}
                      </Fragment>
                    ))}
                    <td className={`text-right px-4 py-2.5 font-mono ${hi ? "text-blue-200" : "text-slate-300"}`}>
                      {r.retention != null ? fmtPctPlain(r.retention) : <span className="text-slate-600">—</span>}
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="bg-slate-900/40 border-b border-slate-700/40">
                      <td colSpan={2 + COLUMNS.length + COLUMNS.filter((c) => c.growthKey).length} className="px-4 py-4">
                        <p className="text-xs text-slate-400 mb-3">
                          {esiDisplayName(r.name)} — quarterly evolution vs the average {r.seg === "AV" ? "Agencia" : "Sociedad"} de Valores firm.
                          "Ingresos no-comisiones" = margen bruto − comisiones netas (ROF + intereses + FX + otros); CNMV does not disclose ROF per firm.
                        </p>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          <EsiTrendChart data={quarterly} metric="comisiones_netas"
                            title="Comisiones netas — quarterly (€M)" entities={[r.name, avgName]}
                            highlight={r.name} formatValue={fmtM2} height={200} />
                          <EsiTrendChart data={quarterly} metric="no_fee_income"
                            title="Ingresos no-comisiones / ROF+ — quarterly (€M)" entities={[r.name, avgName]}
                            highlight={r.name} formatValue={fmtM2} height={200} />
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="px-5 py-2.5 text-[11px] text-slate-500 border-t border-slate-700/50">
        "Ingresos no-com. (ROF+)" = margen bruto − comisiones netas. For the CNMV firms this is mostly trading/ROF;
        for the <span className="text-blue-300">Inversis</span> row (bank-basis) it is dominated by net interest income,
        so that single cell is not directly comparable to the securities firms.
        <br />"% net/bruto" = comisiones netas ÷ percibidas: how much of gross fees the firm keeps after retrocessions.
        A low ratio flags a distribution-heavy model (fees largely passed through to introducers); a high ratio, an own-client/own-product model.
        It is the only per-firm window into commission economics the CNMV discloses (no per-firm sub-type split exists).
      </p>
    </div>
  );
}
