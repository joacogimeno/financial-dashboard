import { describe, it, expect } from "vitest";
import type { EsiAnnualJSON } from "./esiTypes";
import { val, annualGrowth, verdict, marketShare, rankInSegment } from "./esiKpis";

// Small synthetic dataset. Firm C is an Agencia de Valores (AV) so it must NOT
// count when ranking Inversis (an SV) — that was the rank-universe bug.
const D = {
  _metadata: {
    description: "", source: "", unit: "EUR millions",
    entities: [
      { name: "Sociedades de Valores", segment: "SV", kind: "market" },
      { name: "Agencias de Valores", segment: "AV", kind: "market" },
      { name: "Inversis", segment: "SV", kind: "firm" },
      { name: "Firm A", segment: "SV", kind: "firm" },
      { name: "Firm B", segment: "SV", kind: "firm" },
      { name: "Firm C", segment: "AV", kind: "firm" },
    ],
    years: [2024, 2025, 2026],
    ytd: { "2026": { period: "202606", months: 6, label: "H1 2026", quarters: ["2026-Q1", "2026-Q2"] } },
  },
  data: {
    "2024": {
      "Sociedades de Valores": { comisiones_netas: 200, margen_bruto: 300, rof: 40 },
      "Inversis": { comisiones_netas: 60, margen_bruto: 120 },
      "Firm A": { comisiones_netas: 50, margen_bruto: 60 },
      "Firm B": { comisiones_netas: 30, margen_bruto: 40 },
      "Firm C": { comisiones_netas: 90, margen_bruto: 100 }, // AV firm — bigger, but different segment
    },
    "2025": {
      "Sociedades de Valores": { comisiones_netas: 230, margen_bruto: 330, rof: 44 },
      "Inversis": { comisiones_netas: 75, margen_bruto: 150 },
      "Firm A": { comisiones_netas: 55, margen_bruto: 66 },
      "Firm B": { comisiones_netas: 33, margen_bruto: 44 },
      "Firm C": { comisiones_netas: 99, margen_bruto: 110 },
    },
    "2026": {
      "Sociedades de Valores": { comisiones_netas: 120, margen_bruto: 170, rof: 24, ytd_prior: { comisiones_netas: 110, margen_bruto: 160, rof: 22 } },
      "Inversis": { comisiones_netas: 44, margen_bruto: 66, ytd_prior: { comisiones_netas: 37, margen_bruto: 60 } },
    },
  },
} as unknown as EsiAnnualJSON;

describe("val", () => {
  it("reads a stored metric", () => {
    expect(val(D.data["2025"]["Inversis"], "comisiones_netas")).toBe(75);
  });
  it("derives no_fee_income = margen bruto − comisiones netas", () => {
    expect(val(D.data["2025"]["Inversis"], "no_fee_income")).toBe(75); // 150 − 75
  });
  it("returns null when a component is missing", () => {
    expect(val({ comisiones_netas: 10 }, "no_fee_income")).toBeNull();
    expect(val(undefined, "comisiones_netas")).toBeNull();
  });
});

describe("annualGrowth", () => {
  it("computes YoY vs the previous full year", () => {
    expect(annualGrowth(D, "Sociedades de Valores", "2025", "comisiones_netas")).toBeCloseTo(15, 5); // (230−200)/200
    expect(annualGrowth(D, "Inversis", "2025", "comisiones_netas")).toBeCloseTo(25, 5); // (75−60)/60
  });
  it("uses ytd_prior for a YTD year (H1 vs H1)", () => {
    expect(annualGrowth(D, "Inversis", "2026", "comisiones_netas")).toBeCloseTo((44 - 37) / 37 * 100, 5);
    expect(annualGrowth(D, "Sociedades de Valores", "2026", "rof")).toBeCloseTo((24 - 22) / 22 * 100, 5);
  });
  it("returns null with no prior", () => {
    expect(annualGrowth(D, "Inversis", "2024", "comisiones_netas")).toBeNull(); // 2024 is first year
  });
});

describe("verdict", () => {
  it("AHEAD/BEHIND/AT PACE on a higher-is-better line", () => {
    expect(verdict(25, 15).label).toBe("AHEAD");
    expect(verdict(10, 15).label).toBe("BEHIND");
    expect(verdict(15.5, 15).label).toBe("AT PACE"); // within ±2pp
  });
  it("inverts for cost lines (growing slower is good)", () => {
    expect(verdict(5, 20, false).label).toBe("AHEAD"); // costs grew far less → good
    expect(verdict(20, 5, false).label).toBe("BEHIND");
    expect(verdict(5, 20, false).gap).toBeCloseTo(15, 5);
  });
  it("is AT PACE with null inputs", () => {
    expect(verdict(null, 10).label).toBe("AT PACE");
  });
});

describe("marketShare", () => {
  it("is entity ÷ market for the metric", () => {
    expect(marketShare(D, "Inversis", "Sociedades de Valores", "2025", "comisiones_netas"))
      .toBeCloseTo(75 / 230 * 100, 5);
  });
});

describe("rankInSegment", () => {
  it("ranks Inversis among SV firms ONLY (excludes AV firms)", () => {
    // SV firms with data: Inversis 75, Firm A 55, Firm B 33 → Inversis #1 of 3.
    // Firm C (AV, 99) must NOT appear despite being larger.
    const r = rankInSegment(D, "Inversis", "2025", "comisiones_netas");
    expect(r).toEqual({ rank: 1, total: 3 });
  });
  it("ranks an AV firm within its own segment", () => {
    const r = rankInSegment(D, "Firm C", "2025", "comisiones_netas");
    expect(r).toEqual({ rank: 1, total: 1 });
  });
  it("returns null when the entity has no value for the metric", () => {
    expect(rankInSegment(D, "Inversis", "2025", "rof")).toBeNull(); // firms have no rof
  });
});
