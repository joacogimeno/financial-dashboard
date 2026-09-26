// Auto-generated Capital-Markets commentary for the ESI benchmark: the
// ahead/at-pace/behind verdict on Inversis vs the market, plus which peers and
// clients are outperforming and a data-grounded hypothesis on why.
import type { Commentary } from "./types";
import type { EsiAnnualJSON } from "./esiTypes";
import { INVERSIS, MARKET_SV, PEERS, CLIENTS, esiDisplayName, esiTag } from "./esiEntities";
import { annualGrowth, val, verdict, fmtPct, marketShare } from "./esiKpis";

function pacePhrase(label: string): string {
  return label === "AHEAD" ? "ahead of" : label === "BEHIND" ? "behind" : "in line with";
}

interface PeerMove {
  name: string;
  comG: number;
  resG: number | null;
  tag: string;
}

export function esiCommentary(annual: EsiAnnualJSON, year: string): Commentary[] {
  const out: Commentary[] = [];
  const isYtd = annual._metadata.ytd?.[year] != null;
  const basis = isYtd ? `${annual._metadata.ytd![year].label} vs same period prior year` : `FY ${year} vs prior year`;

  // 1) Headline: comisiones netas vs the SV market.
  const invCom = annualGrowth(annual, INVERSIS, year, "comisiones_netas");
  const mktCom = annualGrowth(annual, MARKET_SV, year, "comisiones_netas");
  const vCom = verdict(invCom, mktCom);
  const share = marketShare(annual, INVERSIS, MARKET_SV, year, "comisiones_netas");
  if (invCom != null && mktCom != null) {
    out.push({
      type: vCom.label === "BEHIND" ? "warning" : "insight",
      title: `Comisiones netas ${pacePhrase(vCom.label)} the market`,
      text:
        `Inversis net commissions grew ${fmtPct(invCom)} (${basis}) vs the Sociedades de Valores ` +
        `market total at ${fmtPct(mktCom)} — a ${vCom.gap! >= 0 ? "+" : ""}${vCom.gap!.toFixed(1)}pp gap. ` +
        (share != null ? `Inversis alone is ~${share.toFixed(0)}% of the combined SV market's net commissions. ` : "") +
        `Inversis is bank-basis (Banco de España); net commissions map directly to the CNMV line and are comparable across all years.`,
    });
  }

  // 2) ROF vs the SV market.
  const invRof = annualGrowth(annual, INVERSIS, year, "rof");
  const mktRof = annualGrowth(annual, MARKET_SV, year, "rof");
  const vRof = verdict(invRof, mktRof);
  if (invRof != null && mktRof != null) {
    out.push({
      type: vRof.label === "BEHIND" ? "warning" : "insight",
      title: `ROF ${pacePhrase(vRof.label)} the market`,
      text:
        `Inversis ROF (resultado de operaciones financieras) moved ${fmtPct(invRof)} vs the SV market at ` +
        `${fmtPct(mktRof)}. ROF is small and volatile for both, so read the trajectory rather than any single quarter.`,
    });
  }

  // 3) Who's outperforming — peers (and any tagged clients) by comisiones growth.
  const universe = [...PEERS.map((p) => p.name), ...CLIENTS];
  const moves: PeerMove[] = [];
  for (const name of universe) {
    const comG = annualGrowth(annual, name, year, "comisiones_netas");
    const cur = val(annual.data[year]?.[name], "comisiones_netas");
    if (comG == null || cur == null || cur < 1) continue; // ignore sub-€1M noise
    moves.push({
      name,
      comG,
      resG: annualGrowth(annual, name, year, "resultado_antes_impuestos"),
      tag: esiTag(name),
    });
  }
  moves.sort((a, b) => b.comG - a.comG);
  const leaders = moves.slice(0, 3);
  if (leaders.length && mktCom != null) {
    const parts = leaders.map((m) => {
      // A pre-tax growth beyond ±200% is a small-base artifact, not real leverage —
      // suppress it so the commentary doesn't quote misleading four-digit percentages.
      const showRes = m.resG != null && Math.abs(m.resG) <= 200;
      const driver =
        showRes && m.resG! > m.comG + 5
          ? "operating leverage"
          : m.comG > mktCom + 10
            ? "strong fee momentum"
            : "steady growth";
      const clientTag = m.tag === "client" ? " (client)" : "";
      return `${esiDisplayName(m.name)}${clientTag} ${fmtPct(m.comG)}${showRes ? `, pre-tax ${fmtPct(m.resG!)}` : ""} — ${driver}`;
    });
    out.push({
      type: "recommendation",
      title: "Peers pulling ahead — worth studying",
      text:
        `Fastest comisiones growth among tracked peers (${basis}): ${parts.join("; ")}. ` +
        `Where a name is beating the market, dig into what changed — client wins, pricing, or a product mix shift.`,
    });
  }

  if (!CLIENTS.length) {
    out.push({
      type: "insight",
      title: "Tag Inversis clients to track them here",
      text:
        "No CNMV firms are tagged as Inversis clients yet. Add their exact denominaciones to CLIENTS in " +
        "src/lib/esiEntities.ts and they'll be highlighted across the league table and this commentary, so you " +
        "can see how your own clients are performing versus the market.",
    });
  }

  return out;
}
