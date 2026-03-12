import { useState } from "react";
import type { TabId, AnnualJSON, QuarterlyJSON, EntityName } from "./lib/types";
import { ENTITY_NAMES } from "./lib/types";
import { ENTITY_COLORS } from "./lib/colors";
import annualRaw from "./data/annual.json";
import quarterlyRaw from "./data/quarterly.json";
import ExecutiveSummary from "./tabs/ExecutiveSummary";
import IncomeStatement from "./tabs/IncomeStatement";
import Efficiency from "./tabs/Efficiency";
import Profitability from "./tabs/Profitability";
import Treasury from "./tabs/Treasury";
import QuarterlyView from "./tabs/QuarterlyView";
import CapitalPayout from "./tabs/CapitalPayout";

const annual = annualRaw as unknown as AnnualJSON;
const quarterly = quarterlyRaw as unknown as QuarterlyJSON;

const TABS: { id: TabId; label: string }[] = [
  { id: "summary", label: "Executive Summary" },
  { id: "income_statement", label: "Income Statement" },
  { id: "quarterly", label: "Quarterly P&L" },
  { id: "profitability", label: "Profitability" },
  { id: "treasury", label: "Treasury & BS" },
  { id: "capital_payout", label: "Capital & Payout" },
  { id: "efficiency", label: "Efficiency" },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>("summary");
  const [selectedEntity, setSelectedEntity] = useState<EntityName>("Inversis");

  return (
    <div className="min-h-screen bg-navy-950">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-[1440px] mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight">
              {selectedEntity}
              <span className="text-blue-400 ml-2 font-normal">Financial Intelligence Suite</span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Competitive benchmarking — {ENTITY_NAMES.filter((e) => e !== selectedEntity).join(", ")}
            </p>
          </div>
          <div className="flex items-center gap-4">
            {/* Entity Selector */}
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
                  <span
                    className="w-2 h-2 rounded-full inline-block flex-shrink-0"
                    style={{ background: ENTITY_COLORS[eName] }}
                  />
                  {eName}
                </button>
              ))}
            </div>
            <div className="text-right border-l border-slate-700 pl-4">
              <p className="text-xs text-slate-500">
                Source: Banco de Espa&ntilde;a &mdash; Public Financial Statements
              </p>
              <p className="text-xs text-slate-600">
                FY {annual._metadata.years[0]}&ndash;{annual._metadata.years[annual._metadata.years.length - 1]} |{" "}
                {quarterly.quarters.length} quarters
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <nav className="border-b border-slate-800 bg-slate-900/50">
        <div className="max-w-[1440px] mx-auto px-6 flex gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium transition-colors relative ${
                activeTab === tab.id
                  ? "text-blue-400"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {tab.label}
              {activeTab === tab.id && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-400 rounded-full" />
              )}
            </button>
          ))}
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-[1440px] mx-auto px-6 py-8">
        {activeTab === "summary" && <ExecutiveSummary annual={annual} entity={selectedEntity} />}
        {activeTab === "income_statement" && <IncomeStatement annual={annual} entity={selectedEntity} />}
        {activeTab === "efficiency" && <Efficiency annual={annual} entity={selectedEntity} />}
        {activeTab === "profitability" && <Profitability annual={annual} entity={selectedEntity} />}
        {activeTab === "treasury" && <Treasury annual={annual} quarterly={quarterly} entity={selectedEntity} />}
        {activeTab === "quarterly" && <QuarterlyView quarterly={quarterly} entity={selectedEntity} />}
        {activeTab === "capital_payout" && <CapitalPayout annual={annual} entity={selectedEntity} />}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-4 mt-8">
        <div className="max-w-[1440px] mx-auto px-6 flex items-center justify-between text-xs text-slate-600">
          <span>
            Data: Banco de Espa&ntilde;a (Circular 4/2017) &mdash; Public individual financial statements
          </span>
          <span>Financial Intelligence Suite &mdash; Confidential</span>
        </div>
      </footer>
    </div>
  );
}
