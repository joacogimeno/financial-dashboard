import { useState } from "react";
import type { TabId, AnnualJSON, QuarterlyJSON, EntityName } from "./lib/types";
import { ENTITY_NAMES } from "./lib/types";
import { ENTITY_COLORS } from "./lib/colors";
import type { EsiAnnualJSON, EsiQuarterlyJSON } from "./lib/esiTypes";
import {
  esiAnnualWithInversis, esiQuarterlyWithInversis,
  esiAnnualWithAverages, esiQuarterlyWithAverages,
} from "./lib/esiEntities";
import annualRaw from "./data/annual.json";
import quarterlyRaw from "./data/quarterly.json";
import esiAnnualRaw from "./data/esi_annual.json";
import esiQuarterlyRaw from "./data/esi_quarterly.json";
import ExecutiveSummary from "./tabs/ExecutiveSummary";
import IncomeStatement from "./tabs/IncomeStatement";
import Efficiency from "./tabs/Efficiency";
import Profitability from "./tabs/Profitability";
import Treasury from "./tabs/Treasury";
import QuarterlyView from "./tabs/QuarterlyView";
import CapitalPayout from "./tabs/CapitalPayout";
import MarketOverview from "./tabs/esi/MarketOverview";
import ComisionesRofBenchmark from "./tabs/esi/ComisionesRofBenchmark";
import PeerClientLeague from "./tabs/esi/PeerClientLeague";

const annual = annualRaw as unknown as AnnualJSON;
const quarterly = quarterlyRaw as unknown as QuarterlyJSON;

// ESI datasets: compute average-firm lines over the CNMV firms FIRST (so the
// per-firm average excludes Inversis, which is not part of the CNMV market total),
// then inject Inversis as the bank-basis reference line.
const esiAnnual = esiAnnualWithInversis(
  esiAnnualWithAverages(esiAnnualRaw as unknown as EsiAnnualJSON),
  annual,
);
const esiQuarterly = esiQuarterlyWithInversis(
  esiQuarterlyWithAverages(esiQuarterlyRaw as unknown as EsiQuarterlyJSON),
  quarterly,
);

type View = "banking" | "esi";
type EsiTabId = "esi_market" | "esi_benchmark" | "esi_league";

const TABS: { id: TabId; label: string }[] = [
  { id: "summary", label: "Executive Summary" },
  { id: "income_statement", label: "Income Statement" },
  { id: "quarterly", label: "Quarterly P&L" },
  { id: "profitability", label: "Profitability" },
  { id: "treasury", label: "Treasury & BS" },
  { id: "efficiency", label: "Efficiency" },
  { id: "capital_payout", label: "Capital & Payout" },
];

const ESI_TABS: { id: EsiTabId; label: string }[] = [
  { id: "esi_market", label: "Market Overview" },
  { id: "esi_benchmark", label: "Comisiones & ROF Benchmark" },
  { id: "esi_league", label: "Peer & Client League" },
];

export default function App() {
  const [view, setView] = useState<View>("banking");
  const [activeTab, setActiveTab] = useState<TabId>("summary");
  const [esiTab, setEsiTab] = useState<EsiTabId>("esi_benchmark");
  const [selectedEntity, setSelectedEntity] = useState<EntityName>("Inversis");

  const esi = view === "esi";

  return (
    <div className="min-h-screen bg-navy-950">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-[1440px] mx-auto px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            {/* View toggle */}
            <div className="flex items-center rounded-lg bg-slate-800/70 p-0.5 ring-1 ring-slate-700">
              {([["banking", "Banking peers"], ["esi", "Securities firms (ESI)"]] as const).map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setView(id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                    view === id ? "bg-slate-700 text-white shadow" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="border-l border-slate-700 pl-4">
              {esi ? (
                <>
                  <h1 className="text-lg font-bold text-white tracking-tight">
                    Inversis <span className="text-blue-400 ml-1 font-normal">Capital Markets Benchmark</span>
                  </h1>
                  <p className="text-xs text-slate-500 mt-0.5">
                    vs CNMV Sociedades &amp; Agencias de Valores — comisiones, ROF &amp; peers
                  </p>
                </>
              ) : (
                <>
                  <h1 className="text-lg font-bold text-white tracking-tight">
                    {selectedEntity}
                    <span className="text-blue-400 ml-2 font-normal">Financial Intelligence Suite</span>
                  </h1>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Competitive benchmarking — {ENTITY_NAMES.filter((e) => e !== selectedEntity).join(", ")}
                  </p>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4">
            {!esi && (
              <div className="flex items-center gap-2">
                {ENTITY_NAMES.map((eName) => (
                  <button
                    key={eName}
                    onClick={() => setSelectedEntity(eName)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5 ${
                      eName === selectedEntity
                        ? "bg-slate-700 text-white ring-1 ring-blue-400/50"
                        : "bg-slate-800/50 text-slate-400 hover:bg-slate-700/50 hover:text-slate-300"
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full inline-block flex-shrink-0" style={{ background: ENTITY_COLORS[eName] }} />
                    {eName}
                  </button>
                ))}
              </div>
            )}
            <div className="text-right border-l border-slate-700 pl-4">
              <p className="text-xs text-slate-500">
                {esi ? "Source: CNMV — Estadísticas ESI" : "Source: Banco de España — Public Financial Statements"}
              </p>
              <p className="text-xs text-slate-600">
                {esi
                  ? `${esiAnnual._metadata.years[0]}–${esiAnnual._metadata.years[esiAnnual._metadata.years.length - 1]} | ${esiQuarterly.quarters.length} quarters | ${esiAnnual._metadata.entities.length} entities`
                  : `FY ${annual._metadata.years[0]}–${annual._metadata.years[annual._metadata.years.length - 1]} | ${quarterly.quarters.length} quarters`}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <nav className="border-b border-slate-800 bg-slate-900/50">
        <div className="max-w-[1440px] mx-auto px-6 flex gap-1">
          {esi
            ? ESI_TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setEsiTab(tab.id)}
                  className={`px-4 py-3 text-sm font-medium transition-colors relative ${
                    esiTab === tab.id ? "text-blue-400" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {tab.label}
                  {esiTab === tab.id && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-400 rounded-full" />}
                </button>
              ))
            : TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-3 text-sm font-medium transition-colors relative ${
                    activeTab === tab.id ? "text-blue-400" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {tab.label}
                  {activeTab === tab.id && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-400 rounded-full" />}
                </button>
              ))}
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-[1440px] mx-auto px-6 py-8">
        {esi ? (
          <>
            {esiTab === "esi_market" && <MarketOverview annual={esiAnnual} quarterly={esiQuarterly} />}
            {esiTab === "esi_benchmark" && <ComisionesRofBenchmark annual={esiAnnual} quarterly={esiQuarterly} />}
            {esiTab === "esi_league" && <PeerClientLeague annual={esiAnnual} quarterly={esiQuarterly} />}
          </>
        ) : (
          <>
            {activeTab === "summary" && <ExecutiveSummary annual={annual} entity={selectedEntity} />}
            {activeTab === "income_statement" && <IncomeStatement annual={annual} entity={selectedEntity} />}
            {activeTab === "efficiency" && <Efficiency annual={annual} entity={selectedEntity} />}
            {activeTab === "profitability" && <Profitability annual={annual} entity={selectedEntity} />}
            {activeTab === "treasury" && <Treasury annual={annual} quarterly={quarterly} entity={selectedEntity} />}
            {activeTab === "quarterly" && <QuarterlyView quarterly={quarterly} entity={selectedEntity} />}
            {activeTab === "capital_payout" && <CapitalPayout annual={annual} entity={selectedEntity} />}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-4 mt-8">
        <div className="max-w-[1440px] mx-auto px-6 flex items-center justify-between text-xs text-slate-600">
          <span>
            {esi
              ? "Data: CNMV — Estadísticas ESI (Sociedades y Agencias de Valores). Inversis figures bank-basis (Banco de España)."
              : "Data: Banco de España (Circular 4/2017) — Public individual financial statements"}
          </span>
          <span>Financial Intelligence Suite &mdash; Confidential</span>
        </div>
      </footer>
    </div>
  );
}
