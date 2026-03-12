import type { AnnualJSON, Commentary, EntityName, MetricKey } from "./types";
import { ENTITY_NAMES } from "./types";

// Update this each quarter to keep commentary accurate.
const MACRO_CONTEXT = {
  asOf: "2025-Q4",
  rateEnvironment: "cutting" as "cutting" | "hiking" | "neutral",
  // ECB deposit rate path: 4.00% (Jun'24) → 3.50% (Sep) → 3.25% (Oct) → 3.00% (Dec) → 2.75% (Jan'25) → 2.50% (Mar)
  // Further cuts expected in 2026; sector NII compression broadly visible in FY2025 results.
};

function val(data: AnnualJSON, year: string, entity: EntityName, metric: MetricKey): number | null {
  return (data.data[year]?.[entity]?.[metric] as number) ?? null;
}

function rank(data: AnnualJSON, year: string, metric: MetricKey, higherIsBetter: boolean): EntityName[] {
  const entries = ENTITY_NAMES
    .map((e) => ({ entity: e, value: val(data, year, e, metric) }))
    .filter((e) => e.value != null) as { entity: EntityName; value: number }[];
  entries.sort((a, b) => (higherIsBetter ? b.value - a.value : a.value - b.value));
  return entries.map((e) => e.entity);
}

export function generateCommentary(
  data: AnnualJSON,
  entity: EntityName = "Inversis",
  selectedYear?: string,
): Commentary[] {
  const years = data._metadata.years.map(String);
  if (years.length < 2) return [];

  const latestAvailable = years[years.length - 1];
  const latest = selectedYear && years.includes(selectedYear) ? selectedYear : latestAvailable;
  const latestIdx = years.indexOf(latest);
  const prior = latestIdx > 0 ? years[latestIdx - 1] : years[0];
  const earliest = years[0];
  const commentaries: Commentary[] = [];

  // 1. Efficiency trend
  const ctiNow = val(data, latest, entity, "cost_to_income_pct");
  const ctiPrev = val(data, prior, entity, "cost_to_income_pct");
  const ctiEarliest = val(data, earliest, entity, "cost_to_income_pct");
  const ctiRank = rank(data, latest, "cost_to_income_pct", false);
  const bestCti = ctiRank[0];
  const bestCtiVal = val(data, latest, bestCti, "cost_to_income_pct");

  if (ctiNow != null && ctiEarliest != null && bestCtiVal != null) {
    const totalImprovement = ctiEarliest - ctiNow;
    const yoyChange = ctiPrev != null ? ctiPrev - ctiNow : 0;
    const gap = ctiNow - bestCtiVal;
    const rankPos = ctiRank.indexOf(entity) + 1;

    let trend = "";
    if (yoyChange > 1) trend = `improved ${yoyChange.toFixed(1)}pp YoY`;
    else if (yoyChange < -1) trend = `deteriorated ${Math.abs(yoyChange).toFixed(1)}pp YoY`;
    else trend = "was essentially flat YoY";

    const gapText = entity === bestCti
      ? `${entity} leads the peer group.`
      : `${bestCti} leads at ${bestCtiVal.toFixed(1)}% \u2014 a ${gap.toFixed(0)}pp gap. Reducing admin cost growth below revenue growth is the primary path to C/I convergence.`;

    commentaries.push({
      type: totalImprovement > 5 ? "insight" : "warning",
      title: "Efficiency Position",
      text: `${entity} Cost-to-Income ${trend} at ${ctiNow.toFixed(1)}%, ranking #${rankPos} of ${ctiRank.length} peers. Since ${earliest}, it has ${totalImprovement > 0 ? "improved" : "worsened"} ${Math.abs(totalImprovement).toFixed(1)}pp overall. ${gapText}`,
    });
  }

  // 2. NII sensitivity — includes sector peer comparison
  const niiNow = val(data, latest, entity, "nii");
  const niiPrior = val(data, prior, entity, "nii");
  const gmNow = val(data, latest, entity, "gross_margin");
  const niiEarliest = val(data, earliest, entity, "nii");

  if (niiNow != null && gmNow != null && niiEarliest != null) {
    const niiShare = (niiNow / gmNow) * 100;
    const gmEarliest = val(data, earliest, entity, "gross_margin") ?? 1;
    const niiShareEarliest = (niiEarliest / gmEarliest) * 100;
    const niiYoY = niiPrior != null && niiPrior !== 0
      ? ((niiNow - niiPrior) / Math.abs(niiPrior)) * 100
      : null;

    // Count how many peers saw NII decline YoY
    const peerNiiDeclines = ENTITY_NAMES.filter((e) => {
      const n = val(data, latest, e, "nii");
      const p = val(data, prior, e, "nii");
      return n != null && p != null && n < p;
    });

    if (niiShare > 15) {
      const niiGrowth = niiEarliest !== 0 ? ((niiNow / niiEarliest - 1) * 100) : 999;
      const niiTrendText = niiYoY != null
        ? `NII ${niiYoY >= 0 ? "grew" : "fell"} ${Math.abs(niiYoY).toFixed(0)}% YoY to \u20AC${niiNow.toFixed(1)}M`
        : `NII stands at \u20AC${niiNow.toFixed(1)}M`;
      const sectorText = peerNiiDeclines.length >= 3
        ? `${peerNiiDeclines.length} of 5 peers saw NII decline YoY, confirming sector-wide rate cut impact.`
        : `Most peers maintained NII through balance sheet growth.`;
      const rateText = MACRO_CONTEXT.rateEnvironment === "cutting"
        ? `ECB cuts have reduced the deposit rate to ~2.50% (${MACRO_CONTEXT.asOf}); further normalisation expected. Each additional -100bp represents ~\u20AC${(niiNow * 0.4).toFixed(0)}M at risk.`
        : MACRO_CONTEXT.rateEnvironment === "hiking"
          ? `Current hiking cycle (${MACRO_CONTEXT.asOf}) provides NII tailwind, but liability repricing risk is growing.`
          : `Monitor NII sensitivity as rate cycle evolves (${MACRO_CONTEXT.asOf}).`;
      commentaries.push({
        type: "warning",
        title: "Interest Rate Dependency",
        text: `NII represents ${niiShare.toFixed(0)}% of Gross Margin (from ${niiShareEarliest.toFixed(0)}% in ${earliest}; lifetime growth ${niiGrowth > 500 ? "over 40x" : niiGrowth.toFixed(0) + "%"}). ${niiTrendText}. ${sectorText} ${rateText} Prioritise fee income diversification to reduce rate sensitivity.`,
      });
    } else {
      const niiTrendText = niiYoY != null
        ? ` NII ${niiYoY >= 0 ? "grew" : "fell"} ${Math.abs(niiYoY).toFixed(0)}% YoY — ${niiYoY >= 0 ? "volume growth offsetting rate headwinds" : "reflecting ECB cut-through"}.`
        : "";
      commentaries.push({
        type: "insight",
        title: "Revenue Resilience",
        text: `NII accounts for only ${niiShare.toFixed(0)}% of ${entity}'s Gross Margin (\u20AC${niiNow.toFixed(1)}M of \u20AC${gmNow.toFixed(1)}M).${niiTrendText} This fee-dominated mix provides structural resilience in the current ECB cutting cycle \u2014 a competitive advantage relative to more rate-exposed peers.`,
      });
    }
  }

  // 3. ROE positioning & recommendation
  const roeNow = val(data, latest, entity, "roe_pct");
  const roePrev = val(data, prior, entity, "roe_pct");
  const roeRank = rank(data, latest, "roe_pct", true);
  const roePos = roeRank.indexOf(entity) + 1;
  const bestRoeEntity = roeRank[0];
  const bestRoe = val(data, latest, bestRoeEntity, "roe_pct");

  if (roeNow != null && bestRoe != null) {
    const roeChange = roePrev != null ? roeNow - roePrev : 0;
    const nfi = val(data, latest, entity, "net_fee_income");
    const nfiPrev = val(data, prior, entity, "net_fee_income");
    const nfiGrowth = nfi != null && nfiPrev != null && nfiPrev !== 0
      ? ((nfi / nfiPrev - 1) * 100).toFixed(1)
      : "N/A";

    const otherAdmin = Math.abs(val(data, latest, entity, "other_admin") ?? 0);
    const jawsNow = val(data, latest, entity, "jaws_ratio");

    const leaderText = entity === bestRoeEntity
      ? `${entity} leads the peer group at ${roeNow.toFixed(1)}%.`
      : `${bestRoeEntity} leads at ${bestRoe.toFixed(1)}%.`;

    const jawsText = jawsNow != null
      ? ` Operating leverage (Jaws) is ${jawsNow >= 0 ? "+" : ""}${jawsNow.toFixed(1)}pp, indicating revenues are ${jawsNow >= 0 ? "outpacing" : "trailing"} costs.`
      : "";

    commentaries.push({
      type: "recommendation",
      title: "Strategic Positioning",
      text: `${entity} ROE stands at ${roeNow.toFixed(1)}% (#${roePos}/${roeRank.length}), ${roeChange > 0 ? "up" : "down"} ${Math.abs(roeChange).toFixed(1)}pp YoY. ${leaderText} Net Fee Income grew ${nfiGrowth}% \u2014 the primary lever for ROE expansion.${jawsText} Priorities: (1) review the \u20AC${otherAdmin.toFixed(0)}M Other Admin cost line, (2) fee re-pricing on custody/platform services, (3) stress-test NII under further ECB normalisation.`,
    });
  }

  // 4. Provisions & Impairments trend
  const tpiNow = val(data, latest, entity, "total_provisions_impairments");
  const tpiPrev = val(data, prior, entity, "total_provisions_impairments");

  if (tpiNow != null && gmNow != null && gmNow > 0) {
    const tpiPctGm = (tpiNow / gmNow) * 100;
    if (tpiPctGm > 1) {
      const tpiChange = tpiPrev != null && tpiPrev !== 0
        ? ((tpiNow - tpiPrev) / tpiPrev * 100).toFixed(0)
        : null;
      const trendText = tpiChange != null
        ? (Number(tpiChange) > 0 ? `up ${tpiChange}% YoY` : `down ${Math.abs(Number(tpiChange))}% YoY`)
        : "no prior comparison";

      commentaries.push({
        type: tpiPctGm > 10 ? "warning" : "insight",
        title: "Provisions & Impairments",
        text: `${entity}'s total provisions and impairments are \u20AC${tpiNow.toFixed(1)}M (${tpiPctGm.toFixed(1)}% of Gross Margin), ${trendText}. ${tpiPctGm > 10 ? "This is a material drag on profitability \u2014 review the non-financial asset impairment schedule and intangible write-down policy." : "Monitor trend relative to asset book growth."}`,
      });
    }
  }

  // 5. Capital & Payout policy
  const divNow = val(data, latest, entity, "dividends_paid");
  const payoutNow = val(data, latest, entity, "payout_ratio_pct");
  const eqOpen = val(data, latest, entity, "equity_opening");
  const eqClose = val(data, latest, entity, "total_equity");
  const capActions = (val(data, latest, entity, "capital_increase") ?? 0)
    + (val(data, latest, entity, "capital_other_instruments") ?? 0)
    + (val(data, latest, entity, "business_combination_equity") ?? 0);

  if (divNow != null || eqOpen != null) {
    const divAbs = divNow != null ? Math.abs(divNow) : 0;
    const npVal = val(data, latest, entity, "net_profit");

    if (divAbs < 0.1) {
      // Full retention
      const eqGrowth = eqOpen != null && eqClose != null && eqOpen !== 0
        ? ((eqClose - eqOpen) / eqOpen) * 100 : null;
      commentaries.push({
        type: "insight",
        title: "Capital Policy",
        text: `${entity} pays no dividends — all earnings are retained. Equity ${eqGrowth != null ? `grew ${eqGrowth.toFixed(0)}% YoY to \u20AC${eqClose?.toFixed(0)}M` : `stands at \u20AC${eqClose?.toFixed(0)}M`}, driven by net profit and OCI. This supports balance sheet growth and regulatory capital without external issuance.`,
      });
    } else if (payoutNow != null && payoutNow >= 100) {
      // Payout exceeds earnings
      const capNote = capActions > 1
        ? ` A \u20AC${capActions.toFixed(0)}M capital action (issuances/combinations) partially offset the distribution.`
        : "";
      commentaries.push({
        type: payoutNow >= 300 ? "warning" : "insight",
        title: "Capital Policy",
        text: `${entity} distributed \u20AC${divAbs.toFixed(0)}M in dividends against \u20AC${npVal?.toFixed(0) ?? "N/A"}M net profit — a payout ratio of ${payoutNow >= 999 ? ">999" : payoutNow.toFixed(0)}%. Equity ${eqClose != null && eqOpen != null && eqClose < eqOpen ? `contracted \u20AC${(eqOpen - eqClose).toFixed(0)}M YoY to \u20AC${eqClose.toFixed(0)}M` : `stands at \u20AC${eqClose?.toFixed(0)}M`}.${capNote} Assess whether this reflects a deliberate capital repatriation policy or a one-off.`,
      });
    } else if (payoutNow != null) {
      // Normal payout
      const retainedVal = npVal != null ? npVal - divAbs : null;
      commentaries.push({
        type: "insight",
        title: "Capital Policy",
        text: `${entity} paid \u20AC${divAbs.toFixed(0)}M in dividends (${payoutNow.toFixed(0)}% payout), retaining \u20AC${retainedVal?.toFixed(0) ?? "N/A"}M. ${payoutNow > 75 ? "High payout leaves limited retained earnings for reinvestment — monitor capital adequacy under stress." : "Balanced payout preserves capital for growth while rewarding shareholders."}`,
      });
    }
  }

  // 6. OCI sensitivity — flag large mark-to-market swings
  const ociNow = val(data, latest, entity, "other_comprehensive_income");
  const eqNow = val(data, latest, entity, "total_equity");
  if (ociNow != null && eqNow != null && eqNow !== 0 && Math.abs(ociNow / eqNow) > 0.03) {
    const ociPct = (ociNow / eqNow) * 100;
    commentaries.push({
      type: ociPct < -5 ? "warning" : "insight",
      title: "OCI Mark-to-Market",
      text: `Other Comprehensive Income was \u20AC${ociNow.toFixed(1)}M (${ociPct.toFixed(1)}% of equity) in ${latest} — a${Math.abs(ociPct) > 8 ? " material" : " notable"} mark-to-market ${ociNow >= 0 ? "gain" : "loss"}. This is primarily driven by FVOCI securities and hedging positions. ${ociNow < 0 ? "Large negative OCI compresses reported equity and tangible equity ratios without affecting P&L." : "The gain strengthens equity, but can reverse if rates or credit spreads move."}`,
    });
  }

  // 7. Capital base changes that affect ROE interpretation
  const equityNow = val(data, latest, entity, "total_equity");
  const equityPrior = val(data, prior, entity, "total_equity");
  if (equityNow != null && equityPrior != null && equityPrior !== 0) {
    const equityGrowth = ((equityNow - equityPrior) / Math.abs(equityPrior)) * 100;
    const npNow = val(data, latest, entity, "net_profit");
    // Only flag when equity grew faster than profit (ROE dilution) or shrank (capital concern)
    if (equityGrowth > 20 && npNow != null) {
      const impliedRoeOnPriorEquity = (npNow / equityPrior) * 100;
      commentaries.push({
        type: "insight",
        title: "Capital Base Movement",
        text: `Equity grew ${equityGrowth.toFixed(0)}% YoY to \u20AC${equityNow.toFixed(0)}M, diluting the ROE denominator. On the prior-year equity base, ROE would have been ${impliedRoeOnPriorEquity.toFixed(1)}% vs reported ${val(data, latest, entity, "roe_pct")?.toFixed(1) ?? "N/A"}%. Assess whether the capital increase is earmarked for growth deployment or is regulatory-driven.`,
      });
    } else if (equityGrowth < -15) {
      commentaries.push({
        type: "warning",
        title: "Capital Reduction",
        text: `Equity contracted ${Math.abs(equityGrowth).toFixed(0)}% YoY to \u20AC${equityNow.toFixed(0)}M. This boosts reported ROE mechanically but warrants scrutiny \u2014 confirm whether the reduction reflects dividends/buybacks, losses, or goodwill write-downs.`,
      });
    }
  }

  return commentaries;
}

export function getEntityRank(
  data: AnnualJSON,
  year: string,
  metric: MetricKey,
  higherIsBetter: boolean,
  compute?: (annual: AnnualJSON, entity: EntityName, year: string) => number | null
): { entity: EntityName; value: number; rank: number }[] {
  const getValue = (e: EntityName) =>
    compute ? compute(data, e, year) : val(data, year, e, metric);
  const entries = ENTITY_NAMES
    .map((e) => ({ entity: e, value: getValue(e) }))
    .filter((e) => e.value != null) as { entity: EntityName; value: number }[];
  entries.sort((a, b) => (higherIsBetter ? b.value - a.value : a.value - b.value));
  return entries.map((e, i) => ({ ...e, rank: i + 1 }));
}
