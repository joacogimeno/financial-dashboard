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
  // ROF net result by instrument (market aggregates only)
  rof_renta_fija?: number | null;
  rof_acciones?: number | null;
  rof_derivados?: number | null;
  rof_otros?: number | null;
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
  // Cap.2 market-scale (aggregates) + Anexo A1 per-firm exchange share
  empleados?: number | null;                 // headcount (market)
  roe_cnmv?: number | null;                  // official CNMV ROE, pre-tax (market)
  contratos_gestion?: number | null;         // discretionary-mgmt contracts (market)
  volumen_rv?: number | null;                // equity intermediation volume €M (market)
  volumen_rf?: number | null;                // fixed-income intermediation volume €M (market)
  cuota_bolsa_rv?: number | null;            // on-exchange equity share % (firm)
  cuota_bolsa_total?: number | null;         // on-exchange total share % (firm)
  // Same-period prior-year snapshot, present only on a YTD year's entry.
  ytd_prior?: EsiMetrics | null;
}

export type EsiMetricKey = keyof EsiMetrics;

export interface EsiEntityMeta {
  name: string;
  segment: EsiSegment;
  kind: EsiKind;
}

export interface ExchangeRanking {
  inversis: { rv: number; rank: number } | null;
  top: { name: string; rv: number }[];
  count: number;
}

export interface EsiAnnualJSON {
  _metadata: {
    description: string;
    source: string;
    unit: string;
    entities: EsiEntityMeta[];
    years: number[];
    ytd?: Record<string, YtdMeta>;
    exchange_participation?: Record<string, ExchangeRanking>;
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
