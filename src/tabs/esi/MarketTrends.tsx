import type { EsiAnnualJSON, EsiQuarterlyJSON } from "../../lib/esiTypes";
import { INVERSIS, MARKET_SV, MARKET_AV } from "../../lib/esiEntities";
import { val, fmtM, fmtPctPlain, type DisplayKey } from "../../lib/esiKpis";
import EsiTrendChart from "../../components/esi/EsiTrendChart";
import EsiStackedArea, { type Series } from "../../components/esi/EsiStackedArea";

// Commission pools disclosed by the CNMV for the market aggregate.
const POOLS: Series[] = [
  { key: "com_ejecucion", label: "Ejecución", color: "#2563eb" },
  { key: "com_comercializacion_iic", label: "Comercialización IIC", color: "#0d9488" },
  { key: "com_deposito", label: "Custodia", color: "#d97706" },
  { key: "com_gestion_carteras", label: "Gestión de carteras", color: "#7c3aed" },
  { key: "com_asesoramiento", label: "Asesoramiento", color: "#db2777" },
];
const COMP_YEARS = ["2022", "2023", "2024", "2025"]; // 2021 excluded (perimeter anomaly)

interface Props {
  annual: EsiAnnualJSON;
  quarterly: EsiQuarterlyJSON;
}

export default function MarketTrends({ annual, quarterly }: Props) {
  // Fee-pool share shift (% of comisiones percibidas), first vs last comparable year.
  const share = (market: string, year: string, key: DisplayKey) => {
    const num = val(annual.data[year]?.[market], key);
    const den = val(annual.data[year]?.[market], "comisiones_percibidas");
    return num != null && den ? (num / den) * 100 : null;
  };
  const y0 = COMP_YEARS[0], y1 = COMP_YEARS[COMP_YEARS.length - 1];
  const shiftRow = (market: string) => POOLS.map((p) => {
    const s0 = share(market, y0, p.key), s1 = share(market, y1, p.key);
    return { ...p, s0, s1, delta: s0 != null && s1 != null ? s1 - s0 : null };
  });
  const shiftsSV = shiftRow(MARKET_SV);
  const shiftsAV = shiftRow(MARKET_AV);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Tendencias y dirección del mercado</h2>
        <p className="text-sm text-slate-400 mt-1">
          Vista multi-año de dónde viene y hacia dónde va el mercado de Sociedades y Agencias de Valores — sin comparar año a año
          manualmente. Contrastada con el contexto macro-normativo y sectorial (ver «Dirección de viaje»).
        </p>
      </div>

      {/* 1) Fee-pool composition over time — SV vs AV side by side */}
      <h3 className="text-sm font-semibold text-slate-300">¿Dónde se generan las comisiones y cómo evoluciona? — SV vs AV ({y0}–{y1})</h3>
      <p className="text-[11px] text-slate-500 -mt-1">
        Comisiones <span className="text-slate-300">percibidas (brutas)</span> por tipo, €M. Antes de restar comisiones satisfechas (retrocesiones).
      </p>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <EsiStackedArea
          data={annual} entity={MARKET_SV} series={POOLS} years={COMP_YEARS}
          title="Sociedades de Valores — comisión percibida por tipo (€M)"
          formatValue={(v) => `${v.toFixed(0)}`} height={280}
        />
        <EsiStackedArea
          data={annual} entity={MARKET_AV} series={POOLS} years={COMP_YEARS}
          title="Agencias de Valores — comisión percibida por tipo (€M)"
          formatValue={(v) => `${v.toFixed(0)}`} height={280}
        />
      </div>

      {/* Structural-shift comparison SV vs AV */}
      <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-5">
        <h3 className="text-sm font-semibold text-slate-300 mb-1">Cambio estructural del mix — SV vs AV</h3>
        <p className="text-[11px] text-slate-500 mb-3">Peso de cada grupo sobre comisiones percibidas, {y0}→{y1} (puntos porcentuales).</p>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-slate-400 uppercase tracking-wider">
              <th className="text-left py-2 font-medium">Grupo de comisión</th>
              <th className="text-right py-2 font-medium">SV {y0}→{y1}</th>
              <th className="text-right py-2 font-medium">Δ SV</th>
              <th className="text-right py-2 font-medium">AV {y0}→{y1}</th>
              <th className="text-right py-2 font-medium">Δ AV</th>
            </tr>
          </thead>
          <tbody>
            {POOLS.map((p, i) => {
              const sv = shiftsSV[i], av = shiftsAV[i];
              const deltaCell = (d: number | null) => d == null ? <span className="text-slate-600">—</span>
                : <span className="font-semibold" style={{ color: d >= 0 ? "#34d399" : "#f87171" }}>{d >= 0 ? "+" : ""}{d.toFixed(1)}pp</span>;
              const rangeCell = (s: { s0: number | null; s1: number | null }) =>
                <span className="text-slate-500 font-mono text-xs">{s.s0 != null ? fmtPctPlain(s.s0) : "—"}→{s.s1 != null ? fmtPctPlain(s.s1) : "—"}</span>;
              return (
                <tr key={p.key} className="border-t border-slate-700/30">
                  <td className="py-2 text-slate-300 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: p.color }} />{p.label}
                  </td>
                  <td className="py-2 text-right">{rangeCell(sv)}</td>
                  <td className="py-2 text-right">{deltaCell(sv.delta)}</td>
                  <td className="py-2 text-right">{rangeCell(av)}</td>
                  <td className="py-2 text-right">{deltaCell(av.delta)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="text-[11px] text-slate-500 mt-3 leading-relaxed">
          Ambos segmentos migran hacia <span className="text-slate-300">gestión de carteras y asesoramiento</span> (pago por consejo)
          y la <span className="text-slate-300">custodia</span> pierde peso. Pero el punto de partida es opuesto: las
          <span className="text-slate-300"> SV</span> dependen de la ejecución; las <span className="text-slate-300">AV</span>, de la
          comercialización de IIC — el pool más relevante para el modelo de plataforma de Inversis.
        </p>
      </div>

      {/* 2) Key line-item trends (full quarterly series, no toggling) */}
      <h3 className="text-sm font-semibold text-slate-300 pt-2">Evolución multi-trimestral de las líneas clave</h3>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <EsiTrendChart data={quarterly} metric="comisiones_netas" title="Comisiones netas (€M)"
          entities={[INVERSIS, MARKET_SV, MARKET_AV]} formatValue={fmtM} height={240} />
        <EsiTrendChart data={quarterly} metric="margen_intereses" title="Margen de intereses — el ciclo de tipos (€M)"
          entities={[INVERSIS, MARKET_SV, MARKET_AV]} formatValue={fmtM} height={240} />
        <EsiTrendChart data={quarterly} metric="rof" title="ROF (€M)"
          entities={[INVERSIS, MARKET_SV, MARKET_AV]} formatValue={fmtM} height={240} />
        <EsiTrendChart data={quarterly} metric="margen_bruto" title="Margen bruto (€M)"
          entities={[INVERSIS, MARKET_SV, MARKET_AV]} formatValue={fmtM} height={240} />
      </div>

      {/* 3) Direction of travel — data trends contrasted with market context */}
      <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-5">
        <h3 className="text-sm font-semibold text-slate-300 mb-1">Dirección de viaje — contexto de mercado</h3>
        <p className="text-[11px] text-slate-500 mb-4">
          Lo que dicen los datos de la CNMV, contrastado con el contexto macroeconómico, regulatorio y sectorial
          (cualitativo; no cifras de terceros).
        </p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {DIRECTION.map((d) => (
            <div key={d.title} className="border-l-2 pl-3" style={{ borderColor: d.color }}>
              <p className="text-sm font-semibold text-slate-200">{d.title}</p>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">{d.body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const DIRECTION: { title: string; body: string; color: string }[] = [
  {
    title: "Tipos de interés → margen de intereses a la baja",
    color: "#2563eb",
    body:
      "Los datos muestran el NII del mercado SV y de Inversis en máximos en 2024 y ya cayendo en 2025–1S 2026. " +
      "Coincide con el ciclo del BCE (subidas 2022–23 hasta ~4%, bajadas 2024–25, entorno ~2% esperado 2026–27): " +
      "la contribución de tesorería por remuneración de saldos se comprime. Es el principal viento de cara del presupuesto.",
  },
  {
    title: "De custodia a asesoramiento y gestión discrecional",
    color: "#7c3aed",
    body:
      "El desglose de comisiones muestra gestión de carteras y asesoramiento ganando peso mientras la custodia lo pierde. " +
      "Encaja con el marco MiFID II y la Retail Investment Strategy de la UE (empuje al modelo de pago por asesoramiento) " +
      "y con la presión de precios estructural sobre la custodia. Favorece a plataformas con escala y servicios de valor añadido.",
  },
  {
    title: "Crecimiento del patrimonio y de la actividad",
    color: "#0d9488",
    body:
      "Los contratos de gestión discrecional crecen con fuerza (Cap.2 CNMV) y el volumen de renta variable repuntó (+28% 1S). " +
      "En línea con el crecimiento sostenido del patrimonio en fondos en España (datos Inverco/CNMV de IIC), que sostiene " +
      "las comisiones de distribución de IIC y de depósito por volumen aunque el margen unitario se estreche.",
  },
  {
    title: "Consolidación del sector y concentración de la ejecución",
    color: "#db2777",
    body:
      "El universo de Sociedades de Valores se reduce y el crecimiento agregado se concentra en pocas firmas (interdealer). " +
      "En ejecución bursátil dominan grandes bancos y brókeres internacionales; Inversis es un actor pequeño en ejecución " +
      "directa (~0,6% equity), coherente con su modelo de plataforma/custodia B2B más que de trading direccional.",
  },
];
