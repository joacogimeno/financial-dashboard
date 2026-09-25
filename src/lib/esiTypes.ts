// Types for the "Securities firms (ESI)" view — the CNMV Sociedades/Agencias de
// Valores market, benchmarked against Inversis. Kept separate from the banking
// types (types.ts) because the accounting basis differs (CNMV vs Banco de España).
import type { YtdMeta } from "./types";

export type EsiSegment = "SV" | "AV";
export type EsiKind = "market" | "firm" | "average";
// How an entity is treated in the Capital Markets view. Derived from esiEntities.ts,
// not stored in the data files.
export type EsiTag = "market" | "average" | "reference" | "peer" | "client" | "other";

export interface EsiMetrics {
  // Commissions (comisiones)
  comisiones_percibidas?: number | null;
  comisiones_satisfechas?: number | null;
  comisiones_netas?: number | null;
  // Commission sub-types — aggregate market lines only (not disclosed per firm,
  // nor for the Inversis bank-basis reference).
  com_ejecucion?: number | null;            // Tramitación y ejecución de órdenes
  com_deposito?: number | null;             // Depósito y anotación (custody)
  com_gestion_carteras?: number | null;     // Gestión de carteras
  com_asesoramiento?: number | null;        // Asesoramiento
  com_comercializacion_iic?: number | null; // Comercialización de IIC (fund distribution)
  // Other revenue
  margen_intereses?: number | null;
  rof?: number | null;                       // Resultado de operaciones financieras
  diferencias_cambio?: number | null;
  otros_explotacion?: number | null;
  margen_bruto?: number | null;
  // Costs & result
  gastos_explotacion?: number | null;
  gastos_personal?: number | null;
  gastos_generales?: number | null;
  amortizaciones?: number | null;
  resultado_explotacion?: number | null;
  resultado_antes_impuestos?: number | null;
  impuesto?: number | null;
  resultado_neto?: number | null;
  // Balance snapshot (individual firms)
  fondos_propios?: number | null;
  activos_totales?: number | null;
  // Same-period prior-year snapshot, present only on a YTD year's entry.
  ytd_prior?: EsiMetrics | null;
}

export type EsiMetricKey = keyof EsiMetrics;

export interface EsiEntityMeta {
  name: string;
  segment: EsiSegment;
  kind: EsiKind;
}

export interface EsiAnnualJSON {
  _metadata: {
    description: string;
    source: string;
    unit: string;
    entities: EsiEntityMeta[];
    years: number[];
    ytd?: Record<string, YtdMeta>;
  };
  data: Record<string, Record<string, EsiMetrics>>;
}

export interface EsiQuarterlyJSON {
  _metadata: {
    description: string;
    source: string;
    unit: string;
    entities: EsiEntityMeta[];
  };
  quarters: string[];
  data: Record<string, Record<string, EsiMetrics>>;
}
