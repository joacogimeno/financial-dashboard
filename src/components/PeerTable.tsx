import type { AnnualJSON, MetricKey, EntityName } from "../lib/types";
import { ENTITY_NAMES } from "../lib/types";
import { ENTITY_COLORS } from "../lib/colors";

interface Column {
  key: MetricKey;
  label: string;
  format: (v: number) => string;
  higherIsBetter: boolean;
}

interface Props {
  data: AnnualJSON;
  year: string;
  columns: Column[];
  title?: string;
  highlightEntity?: EntityName;
}

export default function PeerTable({ data, year, columns, title, highlightEntity = "Inversis" }: Props) {
  const yearData = data.data[year];
  if (!yearData) return null;

  // Compute rankings for each column
  const rankings: Record<string, EntityName[]> = {};
  for (const col of columns) {
    const sorted = [...ENTITY_NAMES]
      .map((e) => ({ entity: e, value: (yearData[e]?.[col.key] as number) ?? -Infinity }))
      .filter((e) => e.value !== -Infinity)
      .sort((a, b) => (col.higherIsBetter ? b.value - a.value : a.value - b.value));
    rankings[col.key] = sorted.map((e) => e.entity);
  }

  return (
    <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 overflow-hidden">
      {title && (
        <div className="px-5 py-3 border-b border-slate-700/50">
          <h3 className="text-sm font-semibold text-slate-300">{title}</h3>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700/50">
              <th className="text-left px-5 py-3 text-xs text-slate-400 uppercase tracking-wider font-medium">
                Entity
              </th>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="text-right px-5 py-3 text-xs text-slate-400 uppercase tracking-wider font-medium"
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ENTITY_NAMES.map((entity) => {
              const isHighlighted = entity === highlightEntity;
              return (
                <tr
                  key={entity}
                  className={`border-b border-slate-700/30 ${isHighlighted ? "bg-blue-950/30" : "hover:bg-slate-700/20"}`}
                >
                  <td className="px-5 py-3 font-medium flex items-center gap-2">
                    <span
                      className="w-2 h-2 rounded-full inline-block flex-shrink-0"
                      style={{ background: ENTITY_COLORS[entity] }}
                    />
                    <span className={isHighlighted ? "text-blue-300 font-semibold" : "text-slate-300"}>
                      {entity}
                    </span>
                  </td>
                  {columns.map((col) => {
                    const v = (yearData[entity]?.[col.key] as number) ?? null;
                    const r = rankings[col.key]?.indexOf(entity) ?? -1;
                    const isBest = r === 0;
                    const isWorst = r === rankings[col.key].length - 1;
                    return (
                      <td
                        key={col.key}
                        className={`text-right px-5 py-3 font-mono text-sm ${
                          isHighlighted ? "text-blue-200 font-semibold" : "text-slate-300"
                        }`}
                      >
                        <span className={isBest ? "text-emerald-400" : isWorst ? "text-red-400" : ""}>
                          {v != null ? col.format(v) : "\u2014"}
                        </span>
                        {isBest && <span className="ml-1.5 text-[10px] text-emerald-500">#1</span>}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
