import type { AnnualJSON, YtdMeta } from "./types";

// Helpers for handling partial (year-to-date) years in the annual dataset.
// A YTD year (e.g. 2026 while only H1 data exists) is a normal annual entry
// whose €M flows are actual half-year figures and whose flow-over-stock ratios
// have been annualised. _metadata.ytd carries the display metadata.

export function ytdInfo(annual: AnnualJSON, year: string): YtdMeta | null {
  return annual._metadata.ytd?.[year] ?? null;
}

export function isYtdYear(annual: AnnualJSON, year: string): boolean {
  return ytdInfo(annual, year) != null;
}

// Full title label, e.g. "FY 2025" or "2026 YTD (H1)".
export function yearLabel(annual: AnnualJSON, year: string, prefix = "FY"): string {
  const info = ytdInfo(annual, year);
  if (!info) return `${prefix} ${year}`;
  return `${year} YTD (${ytdPeriodTag(info)})`;
}

// Compact label for chart axes and table headers, e.g. "2026 YTD".
export function shortYearLabel(annual: AnnualJSON, year: string): string {
  return isYtdYear(annual, year) ? `${year} YTD` : year;
}

// Just the period tag, e.g. "H1", "9M", "Q1".
export function ytdPeriodTag(info: YtdMeta): string {
  const m = info.months;
  return m === 6 ? "H1" : m === 3 ? "Q1" : m === 9 ? "9M" : `${m}M`;
}

// One-line explanation shown as a caption near a YTD year's controls.
export function ytdNote(annual: AnnualJSON, year: string): string | null {
  const info = ytdInfo(annual, year);
  if (!info) return null;
  return `${info.label} year-to-date — €M figures are actual ${ytdPeriodTag(info)}; ratios (ROE, yields) annualised; growth vs same period prior year.`;
}
