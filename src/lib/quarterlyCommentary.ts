import type { Commentary, EntityName, MetricKey, QuarterlyJSON } from "./types";
import { ENTITY_NAMES } from "./types";

// ---------------------------------------------------------------------------
// Quarterly automated intelligence.
//
// Unlike the annual generator (lib/commentary.ts), this operates on the
// standalone-quarter dataset and frames every statement around the two
// comparisons a CFO cares about each reporting cycle:
//   • QoQ  — the selected quarter vs the immediately prior quarter
//   • YoY  — the selected quarter vs the same quarter one year earlier
// Peer positioning uses ratios and YoY growth rates rather than absolute €M,
// so a small specialist (Inversis) is judged on efficiency and momentum
// instead of being penalised purely for scale.
// ---------------------------------------------------------------------------

function qv(
  data: QuarterlyJSON,
  q: string | null,
  entity: EntityName,
  metric: MetricKey,
): number | null {
  if (!q) return null;
  return (data.data[q]?.[entity]?.[metric] as number) ?? null;
}

// Percentage change on absolute values, so the sign always means
// "grew / shrank" regardless of how the metric is stored (costs are negative).
function pctChange(now: number | null, then: number | null): number | null {
  if (now == null || then == null || Math.abs(then) === 0) return null;
  return ((Math.abs(now) - Math.abs(then)) / Math.abs(then)) * 100;
}

function fmtPct(p: number | null): string {
  if (p == null) return "n/a";
  return `${p >= 0 ? "+" : ""}${p.toFixed(0)}%`;
}

function priorQuarter(quarters: string[], q: string): string | null {
  const i = quarters.indexOf(q);
  return i > 0 ? quarters[i - 1] : null;
}

function yearAgoQuarter(quarters: string[], q: string): string | null {
  const [y, qq] = q.split("-");
  const candidate = `${Number(y) - 1}-${qq}`;
  return quarters.includes(candidate) ? candidate : null;
}

// Rank entities by a point-in-time metric value in a given quarter.
function levelRank(
  data: QuarterlyJSON,
  q: string,
  metric: MetricKey,
  higherIsBetter: boolean,
): EntityName[] {
  const entries = ENTITY_NAMES.map((e) => ({ entity: e, value: qv(data, q, e, metric) })).filter(
    (e) => e.value != null,
  ) as { entity: EntityName; value: number }[];
  entries.sort((a, b) => (higherIsBetter ? b.value - a.value : a.value - b.value));
  return entries.map((e) => e.entity);
}

// Rank entities by YoY growth of a metric (higher growth is better).
function growthRank(
  data: QuarterlyJSON,
  q: string,
  yq: string,
  metric: MetricKey,
): EntityName[] {
  const entries = ENTITY_NAMES.map((e) => ({
    entity: e,
    value: pctChange(qv(data, q, e, metric), qv(data, yq, e, metric)),
  })).filter((e) => e.value != null) as { entity: EntityName; value: number }[];
  entries.sort((a, b) => b.value - a.value);
  return entries.map((e) => e.entity);
}

export function generateQuarterlyCommentary(
  data: QuarterlyJSON,
  entity: EntityName,
  selectedQ: string,
): Commentary[] {
  const quarters = data.quarters;
  if (!quarters.includes(selectedQ)) return [];

  const pq = priorQuarter(quarters, selectedQ);
  const yq = yearAgoQuarter(quarters, selectedQ);
  const out: Commentary[] = [];

  // 1. Revenue momentum — Gross Margin with driver attribution ----------------
  const gm = qv(data, selectedQ, entity, "gross_margin");
  if (gm != null) {
    const gmQoQ = pctChange(gm, qv(data, pq, entity, "gross_margin"));
    const gmYoY = pctChange(gm, qv(data, yq, entity, "gross_margin"));
    const niiYoY = pctChange(qv(data, selectedQ, entity, "nii"), qv(data, yq, entity, "nii"));
    const nfiYoY = pctChange(
      qv(data, selectedQ, entity, "net_fee_income"),
      qv(data, yq, entity, "net_fee_income"),
    );

    let driver = "";
    if (niiYoY != null && nfiYoY != null) {
      if (niiYoY < 0 && nfiYoY > 0) {
        driver = ` Net fee income (${fmtPct(nfiYoY)} YoY) offset an NII decline (${fmtPct(niiYoY)} YoY) as ECB easing compressed rate income.`;
      } else if (niiYoY >= 0 && nfiYoY >= 0) {
        driver = ` Both engines contributed — fees ${fmtPct(nfiYoY)} and NII ${fmtPct(niiYoY)} YoY.`;
      } else if (nfiYoY < 0 && niiYoY >= 0) {
        driver = ` NII (${fmtPct(niiYoY)} YoY) carried the quarter while fee income softened (${fmtPct(nfiYoY)} YoY).`;
      } else {
        driver = ` Both fees (${fmtPct(nfiYoY)} YoY) and NII (${fmtPct(niiYoY)} YoY) contracted.`;
      }
    }

    const growing = (gmYoY ?? 0) >= 0;
    out.push({
      type: growing ? "insight" : "warning",
      title: "Revenue Momentum",
      text: `${entity} gross margin was €${gm.toFixed(1)}M in ${selectedQ} (${fmtPct(gmQoQ)} QoQ, ${fmtPct(gmYoY)} YoY).${driver}`,
    });
  }

  // 2. Earnings & ROE positioning --------------------------------------------
  const np = qv(data, selectedQ, entity, "net_profit");
  const roe = qv(data, selectedQ, entity, "roe_pct");
  if (np != null && roe != null) {
    const npQoQ = pctChange(np, qv(data, pq, entity, "net_profit"));
    const npYoY = pctChange(np, qv(data, yq, entity, "net_profit"));
    const roeR = levelRank(data, selectedQ, "roe_pct", true);
    const pos = roeR.indexOf(entity) + 1;
    const leader = roeR[0];
    const leaderVal = qv(data, selectedQ, leader, "roe_pct");
    const leaderText =
      entity === leader
        ? `${entity} leads the peer group on annualised ROE.`
        : `${leader} leads at ${leaderVal?.toFixed(1)}%.`;

    out.push({
      type: "recommendation",
      title: "Earnings & Returns",
      text: `Net profit of €${np.toFixed(1)}M (${fmtPct(npQoQ)} QoQ, ${fmtPct(npYoY)} YoY) lifts annualised ROE to ${roe.toFixed(1)}%, ranking #${pos}/${roeR.length} of peers. ${leaderText}`,
    });
  }

  // 3. Cost efficiency vs peers (pp deltas) ----------------------------------
  const cti = qv(data, selectedQ, entity, "cost_to_income_pct");
  if (cti != null) {
    const ctiPrior = qv(data, pq, entity, "cost_to_income_pct");
    const ctiYear = qv(data, yq, entity, "cost_to_income_pct");
    const qoqPp = ctiPrior != null ? cti - ctiPrior : null;
    const yoyPp = ctiYear != null ? cti - ctiYear : null;
    const ctiR = levelRank(data, selectedQ, "cost_to_income_pct", false);
    const pos = ctiR.indexOf(entity) + 1;
    const best = ctiR[0];
    const bestVal = qv(data, selectedQ, best, "cost_to_income_pct");
    const gap = bestVal != null ? cti - bestVal : null;

    const ppText = (pp: number | null): string =>
      pp == null ? "n/a" : `${pp <= 0 ? "" : "+"}${pp.toFixed(1)}pp`;

    const gapText =
      entity === best
        ? `${entity} runs the leanest cost base in the peer set.`
        : `${best} leads at ${bestVal?.toFixed(1)}% — a ${gap?.toFixed(0)}pp gap. Holding admin-cost growth below revenue growth is the primary route to closing it.`;

    const lagging = pos >= ctiR.length - 1;
    out.push({
      type: lagging ? "warning" : "insight",
      title: "Cost Efficiency",
      text: `Cost-to-income was ${cti.toFixed(1)}% (${ppText(qoqPp)} QoQ, ${ppText(yoyPp)} YoY), ranking #${pos}/${ctiR.length}. ${gapText}`,
    });
  }

  // 4. Rate sensitivity (NII) -------------------------------------------------
  const nii = qv(data, selectedQ, entity, "nii");
  if (nii != null && gm != null && gm !== 0) {
    const niiYoY = pctChange(nii, qv(data, yq, entity, "nii"));
    const niiShare = (nii / gm) * 100;
    const peersDown = yq
      ? ENTITY_NAMES.filter((e) => {
          const c = pctChange(qv(data, selectedQ, e, "nii"), qv(data, yq, e, "nii"));
          return c != null && c < 0;
        }).length
      : 0;
    const sectorText = yq
      ? ` ${peersDown} of ${ENTITY_NAMES.length} peers posted lower NII YoY.`
      : "";

    if (niiShare > 40) {
      out.push({
        type: "warning",
        title: "Interest-Rate Dependency",
        text: `NII of €${nii.toFixed(1)}M is ${niiShare.toFixed(0)}% of gross margin (${fmtPct(niiYoY)} YoY) — a high exposure as the ECB eases.${sectorText} Each leg of rate normalisation puts a material slice of revenue at risk; fee diversification is the structural hedge.`,
      });
    } else {
      out.push({
        type: "insight",
        title: "Rate Resilience",
        text: `NII is only ${niiShare.toFixed(0)}% of ${entity}'s gross margin (€${nii.toFixed(1)}M, ${fmtPct(niiYoY)} YoY).${sectorText} A fee-dominated mix cushions the earnings base against ECB rate cuts — a structural advantage over more rate-geared peers.`,
      });
    }
  }

  // 5. Peer scorecard — where the entity over/under-performs ------------------
  type Card = { label: string; rankArr: EntityName[] };
  const cards: Card[] = [
    { label: "ROE", rankArr: levelRank(data, selectedQ, "roe_pct", true) },
    { label: "cost efficiency", rankArr: levelRank(data, selectedQ, "cost_to_income_pct", false) },
  ];
  if (yq) {
    cards.push(
      { label: "revenue growth", rankArr: growthRank(data, selectedQ, yq, "gross_margin") },
      { label: "fee-income growth", rankArr: growthRank(data, selectedQ, yq, "net_fee_income") },
      { label: "earnings growth", rankArr: growthRank(data, selectedQ, yq, "net_profit") },
    );
  }

  const scored = cards
    .map((c) => ({ label: c.label, pos: c.rankArr.indexOf(entity) + 1, total: c.rankArr.length }))
    .filter((c) => c.pos > 0);

  if (scored.length) {
    const over = scored.filter((c) => c.pos <= 2).map((c) => c.label);
    const under = scored.filter((c) => c.pos >= c.total - 1).map((c) => c.label);
    const worst = scored.reduce((a, b) => (b.pos > a.pos ? b : a));

    const overText = over.length
      ? `${entity} overperforms peers on ${list(over)}.`
      : `${entity} does not rank top-2 on any core metric this quarter.`;
    const underText = under.length
      ? ` It underperforms on ${list(under)}.`
      : ` It holds a mid-pack position across the remaining metrics.`;
    const watchText = ` Subject to scrutiny: ${worst.label} (#${worst.pos}/${worst.total}) — the clearest gap to the peer frontier and the priority lever for the next quarter.`;

    out.push({
      type: "recommendation",
      title: "Peer Positioning Scorecard",
      text: `${overText}${underText}${watchText}`,
    });
  }

  return out;
}

// Join a list with commas and a trailing "and" ("a, b and c").
function list(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}
