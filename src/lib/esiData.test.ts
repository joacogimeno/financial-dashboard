import { describe, it, expect } from "vitest";
import type { EsiAnnualJSON, EsiQuarterlyJSON } from "./esiTypes";
import annualJson from "../data/esi_annual.json";
import quarterlyJson from "../data/esi_quarterly.json";

// Integrity checks on the generated CNMV datasets — these fail loudly if a future
// re-extraction breaks an invariant.
const A = annualJson as unknown as EsiAnnualJSON;
const Q = quarterlyJson as unknown as EsiQuarterlyJSON;
const MARKETS = ["Sociedades de Valores", "Agencias de Valores"];
const num = (v: unknown): number | null => (typeof v === "number" ? v : null);

describe("esi_annual.json integrity", () => {
  it("ROF by instrument sums to total ROF for each market/year", () => {
    for (const mkt of MARKETS) {
      for (const [year, byEnt] of Object.entries(A.data)) {
        const d = byEnt[mkt] as Record<string, number | null> | undefined;
        if (!d) continue;
        const parts = ["rof_renta_fija", "rof_acciones", "rof_derivados", "rof_otros"].map((k) => num(d[k]));
        if (parts.every((p) => p != null) && d.rof != null) {
          const sum = parts.reduce((s, p) => s + (p as number), 0);
          expect(Math.abs(sum - d.rof), `${mkt} ${year}`).toBeLessThan(0.15);
        }
      }
    }
  });

  it("market net commissions are never negative", () => {
    for (const mkt of MARKETS) {
      for (const [year, byEnt] of Object.entries(A.data)) {
        const v = num((byEnt[mkt] as Record<string, unknown>)?.comisiones_netas);
        if (v != null) expect(v, `${mkt} ${year}`).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("has no duplicate entity names and does not list Inversis (a bank)", () => {
    const names = A._metadata.entities.map((e) => e.name);
    expect(new Set(names).size).toBe(names.length);
    expect(names).not.toContain("Inversis");
  });
});

describe("market scale (Cap.2) + exchange participation (Anexo A1)", () => {
  it("SV market carries scale metrics for recent years", () => {
    for (const yr of ["2025", "2026"]) {
      const sv = A.data[yr]["Sociedades de Valores"] as Record<string, unknown>;
      for (const k of ["empleados", "roe_cnmv", "volumen_rv", "volumen_rf", "contratos_gestion"]) {
        expect(num(sv[k]), `${yr}.${k}`).not.toBeNull();
        expect(num(sv[k])!, `${yr}.${k}`).toBeGreaterThan(0);
      }
    }
  });
  it("exchange participation includes Inversis with a plausible rank", () => {
    const ex = A._metadata.exchange_participation?.["2026"];
    expect(ex).toBeTruthy();
    expect(ex!.inversis).toBeTruthy();
    expect(ex!.inversis!.rv).toBeGreaterThan(0);
    expect(ex!.inversis!.rank).toBeGreaterThan(0);
    expect(ex!.inversis!.rank).toBeLessThanOrEqual(ex!.count);
    expect(ex!.top.length).toBeGreaterThan(0);
  });
});

describe("esi_quarterly.json reconciles to annual", () => {
  it("FY = Σ of the 4 standalone quarters (market comisiones netas & margen bruto)", () => {
    for (const mkt of MARKETS) {
      for (const yr of ["2022", "2023", "2024", "2025"]) {
        const qs = [1, 2, 3, 4].map((i) => `${yr}-Q${i}`);
        if (!qs.every((q) => Q.data[q])) continue;
        for (const k of ["comisiones_netas", "margen_bruto"] as const) {
          const sum = qs.reduce((s, q) => s + (num((Q.data[q][mkt] as Record<string, unknown>)?.[k]) ?? 0), 0);
          const annual = num((A.data[yr][mkt] as Record<string, unknown>)?.[k]);
          if (annual != null) expect(Math.abs(sum - annual), `${mkt} ${yr} ${k}`).toBeLessThan(0.6);
        }
      }
    }
  });
});
