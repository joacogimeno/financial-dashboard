#!/usr/bin/env python3
"""
Extract financial data from BdE public Excel statements and produce
annual.json + quarterly.json for the CFO Intelligence Dashboard.
"""
import json
import os
import sys
from pathlib import Path

import pandas as pd

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
EXCEL_DIR = Path(__file__).resolve().parent.parent.parent / "inversis-dashboard" / "Financial data"
OUTPUT_DIR = Path(__file__).resolve().parent.parent / "src" / "data"

ENTITIES = {
    "Inversis":  "0232 - BANCO INVERSIS",
    "Allfunds":  "0011 - ALLFUNDS BANK",
    "CACEIS":    "0038 - CACEIS BANK SPAIN",
    "Cecabank":  "2000 - CECABANK",
    "Renta 4":   "0083 - RENTA 4 BANCO",
}
ENTITY_NAMES = list(ENTITIES.keys())

# BdE file code → statement type
FILE_CODES = {
    "4701": "pl",           # Cuenta de Resultados
    "4702": "oci",          # Estado de Ingresos y Gastos Reconocidos (OCI)
    "2701": "assets",       # Balance — Activo
    "2702": "liabilities",  # Balance — Pasivo
    "2703": "equity",       # Balance — Patrimonio Neto
}

# 6794 = Estado Total de Cambios en el Patrimonio Neto (ECPN) — annual only
ECPN_FILE_CODE = "6794"

# ECPN row label fragments (startswith match) for each metric.
# Multiple variants handle BdE formatting differences across years.
ECPN_ROWS: dict[str, list[str]] = {
    "equity_opening": [
        "Saldo de apertura",
        "Saldo inicial",
    ],
    "total_comprehensive_income": [
        "Resultado global total del ejercicio",
        "Resultado global total",
    ],
    "capital_increase": [
        "Emisión de acciones ordinarias",
        "Emisi\u00f3n de acciones ordinarias",
    ],
    "capital_other_instruments": [
        "Emisión de otros instrumentos de patrimonio",
        "Emisi\u00f3n de otros instrumentos de patrimonio",
    ],
    "buybacks": [
        "Compra de acciones propias",
        "(Compra de acciones propias)",
        "Adquisición de acciones propias",
    ],
    "business_combination_equity": [
        "Combinaciones de negocios",
    ],
    "other_equity_movements": [
        "Otros aumentos o disminuciones",
        "Otras variaciones",
    ],
    "dividends_paid": [
        "Dividendos",
        "Distribución de dividendos",
    ],
}

# P&L row labels to extract (must match start of cell text)
PL_ROWS = {
    "A) MARGEN DE INTERESES":                              "nii",
    "Ingresos por comisiones":                             "fee_income",
    "(Gastos por comisiones)":                             "fee_expenses",
    # Between NII and Gross Margin
    "Ingresos por dividendos":                             "dividend_income",
    "Otros ingresos de explotación":                       "other_operating_income",
    "(Otros gastos de explotación)":                       "other_operating_expenses",
    "B) MARGEN BRUTO":                                     "gross_margin",
    "(Gastos de administración)":                          "admin_expenses",
    "(Gastos de personal)":                                "staff_costs",
    "(Otros gastos de administración)":                    "other_admin",
    "(Amortización)":                                      "depreciation",
    "Ingresos por intereses":                              "interest_income_gross",
    "(Gastos por intereses)":                              "interest_expenses",
    # Between Gross Margin and Pre-Tax Profit
    "(Provisiones o (-) reversión de provisiones)":        "provisions",
    "(Deterioro del valor o (-) reversión del deterioro del valor de activos financieros no valorados a valor razonable con cambios en resultados y pérdidas o (-) ganancias netas por modificación)": "impairment_financial_assets",
    "(Deterioro del valor o (-) reversión del deterioro del valor de inversiones en dependientes, negocios conjuntos o asociadas)": "impairment_subsidiaries",
    "(Deterioro del valor o (-) reversión del deterioro del valor de activos no financieros)": "impairment_non_financial",
    "Ganancias o (-) pérdidas al dar de baja en cuentas activos no financieros, netas": "gains_disposal_nfa",
    "Ganancias o (-) pérdidas procedentes de activos no corrientes y grupos enajenables de elementos clasificados como mantenidos para la venta no admisibles como actividades interrumpidas": "gains_held_for_sale",
    "C) GANANCIAS O (-) PÉRDIDAS ANTES DE IMPUESTOS":     "pre_tax_profit",
    # Tax
    "(Gastos o (-) ingresos por impuestos sobre los resultados de las actividades continuadas)": "tax_charge",
    "E) RESULTADO DEL EJERCICIO":                          "net_profit",
}

# Balance sheet rows
BS_ROWS = {
    "assets": {
        "Efectivo, saldos en efectivo en bancos centrales y otros depósitos a la vista": "cash_and_central_bank",
        "Activos financieros a valor razonable con cambios en otro resultado global": "securities_fvoci",
        "Activos financieros a coste amortizado": "assets_amortized_cost",
        "Activos intangibles": "intangible_assets",
        "TOTAL ACTIVO": "total_assets",
    },
    "liabilities": {
        "Depósitos": "total_deposits",
        "Entidades de crédito": "interbank_deposits",
        "Clientela": "client_deposits",
        "TOTAL PASIVO": "total_liabilities",
    },
    "equity": {"TOTAL PATRIMONIO NETO": "total_equity"},
}


def find_entity_columns(df: pd.DataFrame) -> dict[str, int]:
    """Map entity names to column indices by matching header row (row 2)."""
    header = df.iloc[2]
    cols = {}
    for name, prefix in ENTITIES.items():
        matches = [idx for idx, val in enumerate(header)
                   if pd.notna(val) and prefix in str(val)]
        if len(matches) != 1:
            raise ValueError(
                f"Expected exactly 1 column for '{name}' (prefix='{prefix}'), "
                f"found {len(matches)}: columns {matches}"
            )
        cols[name] = matches[0]
    return cols


def extract_pl(filepath: str) -> dict[str, dict[str, float | None]]:
    """Extract P&L metrics from a 4701 file."""
    df = pd.read_excel(filepath, engine="openpyxl", header=None)
    cols = find_entity_columns(df)
    result: dict[str, dict[str, float | None]] = {e: {} for e in ENTITY_NAMES}

    matched: set[str] = set()
    for i in range(3, len(df)):
        label = str(df.iloc[i, 0]).strip()
        if label == "nan":
            continue
        for keyword, metric in PL_ROWS.items():
            if metric in matched:
                continue
            if label.startswith(keyword):
                for entity in ENTITY_NAMES:
                    if entity in cols:
                        val = df.iloc[i, cols[entity]]
                        result[entity][metric] = round(float(val) / 1e6, 2) if pd.notna(val) else None
                matched.add(metric)
                break
    return result


def extract_bs(filepath: str, stmt_type: str) -> dict[str, dict[str, float | None]]:
    """Extract balance sheet metrics from a 2701 or 2703 file."""
    df = pd.read_excel(filepath, engine="openpyxl", header=None)
    cols = find_entity_columns(df)
    result: dict[str, dict[str, float | None]] = {e: {} for e in ENTITY_NAMES}
    targets = BS_ROWS[stmt_type]

    matched: set[str] = set()
    for i in range(len(df)):
        label = str(df.iloc[i, 0]).strip()
        for target_label, metric in targets.items():
            if metric in matched:
                continue
            if label.upper() == target_label.upper() or label == target_label:
                # Check if any entity has data in this row (skip empty repeated labels)
                row_vals = {}
                has_any = False
                for entity in ENTITY_NAMES:
                    if entity in cols:
                        val = df.iloc[i, cols[entity]]
                        if pd.notna(val):
                            row_vals[entity] = round(float(val) / 1e6, 2)
                            has_any = True
                        else:
                            row_vals[entity] = None
                if has_any:
                    matched.add(metric)
                    for entity in ENTITY_NAMES:
                        if entity in row_vals:
                            result[entity][metric] = row_vals[entity]
                    break  # Found a valid match for this label, move to next row
    return result


def extract_oci(filepath: str) -> dict[str, dict[str, float | None]]:
    """Extract OCI metrics from a 4702 file (wide format, entity per column)."""
    df = pd.read_excel(filepath, engine="openpyxl", header=None)
    cols = find_entity_columns(df)
    result: dict[str, dict[str, float | None]] = {e: {} for e in ENTITY_NAMES}

    # Fixed row indices in 4702 (0-indexed, 42 rows total)
    OCI_ROWS = {
        3:  "other_comprehensive_income_net_profit",  # Resultado del ejercicio (reconciliation)
        4:  "other_comprehensive_income",             # Otro resultado global
        41: "total_comprehensive_income",             # Resultado global total
    }
    for row_idx, metric in OCI_ROWS.items():
        for entity in ENTITY_NAMES:
            if entity in cols:
                v = df.iloc[row_idx, cols[entity]]
                result[entity][metric] = round(float(v) / 1e6, 2) if pd.notna(v) else None
    return result


def find_ecpn_total_column(df: pd.DataFrame) -> int:
    """Find the 'Total' column index in a 6794 ECPN file by scanning header rows."""
    for row_idx in range(min(6, len(df))):
        for col_idx in range(len(df.columns)):
            cell = str(df.iloc[row_idx, col_idx]).strip().lower()
            if cell == "total":
                return col_idx
    return 12  # fallback to historically observed column


def extract_ecpn(filepath: str) -> dict[str, dict[str, float | None]]:
    """Extract equity change metrics from a 6794 file using label-based row matching.

    The 6794 file is a tall-format matrix: each entity occupies a block of ~30 rows
    in column 0, and all entities share the same column layout.  The 'Total' column
    is detected dynamically; metrics are located by matching row labels (col 0) within
    each entity's block rather than relying on fixed offsets.
    """
    df = pd.read_excel(filepath, engine="openpyxl", header=None)
    result: dict[str, dict[str, float | None]] = {e: {} for e in ENTITY_NAMES}
    total_col = find_ecpn_total_column(df)

    for entity, prefix in ENTITIES.items():
        code = prefix.split(" - ")[0].strip()  # e.g. "0232"

        # Locate entity block start: first row in col 0 that starts with the entity code
        block_start: int | None = None
        for i in range(len(df)):
            cell = str(df.iloc[i, 0]).strip()
            if cell.startswith(code + " -") or cell.startswith(code + "- "):
                block_start = i
                break

        if block_start is None:
            print(f"  ECPN WARN: block not found for {entity} (code={code})")
            continue

        # Determine block end: next entity's header row or +40 rows
        block_end = min(block_start + 40, len(df))
        for i in range(block_start + 1, min(block_start + 45, len(df))):
            cell = str(df.iloc[i, 0]).strip()
            for other_prefix in ENTITIES.values():
                if other_prefix == prefix:
                    continue
                other_code = other_prefix.split(" - ")[0].strip()
                if cell.startswith(other_code + " -") or cell.startswith(other_code + "- "):
                    block_end = i
                    break
            else:
                continue
            break

        # Within the block, locate each metric by matching row labels
        for metric, labels in ECPN_ROWS.items():
            found = False
            for row_idx in range(block_start, block_end):
                if row_idx >= len(df):
                    break
                cell = str(df.iloc[row_idx, 0]).strip()
                for label in labels:
                    if cell.startswith(label):
                        v = df.iloc[row_idx, total_col]
                        result[entity][metric] = (
                            round(float(v) / 1e6, 2) if pd.notna(v) else None
                        )
                        found = True
                        break
                if found:
                    break
            # Absence of a label is non-fatal; the metric stays None for this entity/year

    return result


def compute_ratios(
    data: dict[str, dict[str, float | None]],
    preserve: set[str] | None = None,
) -> dict[str, dict[str, float | None]]:
    """Add derived KPI ratios to each entity's data.

    preserve: set of metric keys that have already been correctly computed
    (e.g. by YTD differencing) and must not be overwritten.
    """
    preserve = preserve or set()
    for entity in ENTITY_NAMES:
        d = data.get(entity, {})

        # Net Fee Income
        fi = d.get("fee_income")
        fe = d.get("fee_expenses")
        if fi is not None and fe is not None and "net_fee_income" not in preserve:
            d["net_fee_income"] = round(fi - abs(fe), 2)

        # Fee Mix (%)
        nfi = d.get("net_fee_income")
        gm = d.get("gross_margin")
        if nfi is not None and gm is not None and gm != 0:
            d["fee_mix_pct"] = round(nfi / gm * 100, 1)

        # Cost-to-Income (%) — (Admin + D&A) / Gross Margin
        # Canonical single-denominator definition: Gross Margin is the authoritative
        # top-line figure and avoids double-counting sub-components.
        admin = d.get("admin_expenses")
        depr = d.get("depreciation")
        gm_ci = d.get("gross_margin")
        if admin is not None and depr is not None and gm_ci is not None and gm_ci != 0:
            total_cost = abs(admin) + abs(depr)
            d["cost_to_income_pct"] = round(total_cost / abs(gm_ci) * 100, 1)

        # ROE (%)
        np_ = d.get("net_profit")
        eq = d.get("total_equity")
        if np_ is not None and eq is not None and eq != 0:
            d["roe_pct"] = round(np_ / eq * 100, 1)

        # ROA (%)
        ta = d.get("total_assets")
        intangibles = d.get("intangible_assets")
        if np_ is not None and ta is not None and ta != 0:
            d["roa_pct"] = round(np_ / ta * 100, 2)

        # NII Yield on Tangible Assets (bps) — NII / (Total Assets - Intangibles) * 10000
        nii = d.get("nii")
        tangible_assets = ta - abs(intangibles) if (ta is not None and intangibles is not None) else ta
        if nii is not None and tangible_assets is not None and tangible_assets != 0:
            d["nii_sensitivity_bps"] = round(nii / tangible_assets * 10000, 1)

        # OpEx / Assets (bps)
        if admin is not None and ta is not None and ta != 0:
            total_cost = abs(admin) + (abs(depr) if depr else 0)
            d["opex_assets_bps"] = round(total_cost / ta * 10000, 0)

        # Tangible Equity
        if eq is not None and intangibles is not None:
            d["tangible_equity"] = round(eq - abs(intangibles), 2)
        elif eq is not None:
            d["tangible_equity"] = eq  # fallback if no intangibles data

        # Tangible Equity Ratio (%)
        te = d.get("tangible_equity")
        if te is not None and ta is not None and ta != 0:
            d["tangible_equity_ratio_pct"] = round(te / ta * 100, 1)

        # --- Treasury & Balance Sheet ratios ---

        # Earning Asset Yield (%) — Interest Income / (Total Assets - Intangibles)
        int_inc = d.get("interest_income_gross")
        if int_inc is not None and tangible_assets is not None and tangible_assets != 0:
            d["earning_asset_yield_pct"] = round(abs(int_inc) / tangible_assets * 100, 2)

        # Funding Cost (%) — Interest Expenses / Total Liabilities
        int_exp = d.get("interest_expenses")
        tl = d.get("total_liabilities")
        if int_exp is not None and tl is not None and tl != 0:
            d["funding_cost_pct"] = round(abs(int_exp) / abs(tl) * 100, 2)

        # Interest Spread (%) — Earning Asset Yield - Funding Cost
        eay = d.get("earning_asset_yield_pct")
        fc = d.get("funding_cost_pct")
        if eay is not None and fc is not None:
            d["interest_spread_pct"] = round(eay - fc, 2)

        # Liquidity Ratio (%) — Cash & Central Bank / Total Assets
        cash = d.get("cash_and_central_bank")
        if cash is not None and ta is not None and ta != 0:
            d["liquidity_ratio_pct"] = round(cash / ta * 100, 1)

        # Client Funding Ratio (%) — Client Deposits / Total Deposits
        client_dep = d.get("client_deposits")
        total_dep = d.get("total_deposits")
        if client_dep is not None and total_dep is not None and total_dep != 0:
            d["client_funding_ratio_pct"] = round(abs(client_dep) / abs(total_dep) * 100, 1)

        # Staff Costs % of Gross Margin
        sc = d.get("staff_costs")
        if sc is not None and gm is not None and gm != 0:
            d["staff_costs_pct"] = round(abs(sc) / gm * 100, 1)

        # --- P&L Waterfall derived metrics ---

        # Trading & Other Income (derived from Gross Margin identity)
        # = Gross Margin - NII - Net Fee Income
        nfi = d.get("net_fee_income")
        if gm is not None and nii is not None and nfi is not None and "trading_and_other" not in preserve:
            d["trading_and_other"] = round(gm - nii - nfi, 2)

        # Net Operating Income = Gross Margin - |Admin| - |Depreciation|
        if gm is not None and admin is not None and "net_operating_income" not in preserve:
            d["net_operating_income"] = round(
                gm - abs(admin) - (abs(depr) if depr else 0), 2
            )

        # Total Provisions & Impairments
        prov = d.get("provisions")
        imp_fa = d.get("impairment_financial_assets")
        imp_sub = d.get("impairment_subsidiaries")
        imp_nf = d.get("impairment_non_financial")
        prov_parts = [v for v in [prov, imp_fa, imp_sub, imp_nf] if v is not None]
        if prov_parts:
            d["total_provisions_impairments"] = round(sum(abs(v) for v in prov_parts), 2)

        # Effective Tax Rate (%) = |tax_charge| / pre_tax_profit * 100
        tax = d.get("tax_charge")
        ptp = d.get("pre_tax_profit")
        if tax is not None and ptp is not None and ptp > 0:
            d["effective_tax_rate_pct"] = round(abs(tax) / ptp * 100, 1)

        # Cost of Risk (bps) = |impairment_financial_assets| / total_assets * 10000
        if imp_fa is not None and ta is not None and ta != 0:
            d["cost_of_risk_bps"] = round(abs(imp_fa) / ta * 10000, 1)

        # --- Capital & Payout derived metrics ---

        # Payout Ratio (%) = |dividends_paid| / net_profit * 100
        # Capped at 999% to handle near-zero or negative profit years
        div = d.get("dividends_paid")
        np_ = d.get("net_profit")
        if div is not None and np_ is not None and np_ > 0:
            d["payout_ratio_pct"] = round(min(abs(div) / np_ * 100, 999.0), 1)
        elif div is not None and np_ is not None and np_ <= 0 and abs(div) > 0:
            d["payout_ratio_pct"] = 999.0  # Loss year but still paying dividends

        # Retention Rate (%) = 100 - payout_ratio (floored at 0, capped at 100)
        pr = d.get("payout_ratio_pct")
        if pr is not None:
            d["retention_rate_pct"] = round(max(0.0, min(100.0, 100.0 - pr)), 1)

        # Dividend Yield on Opening Equity (%) = |dividends| / opening_equity * 100
        eq_open = d.get("equity_opening")
        if div is not None and eq_open is not None and eq_open != 0:
            d["dividend_yield_on_equity_pct"] = round(abs(div) / eq_open * 100, 1)

    return data


def period_to_quarter(period: str) -> str:
    """Convert YYYYMM to 'YYYY-Q#' label."""
    year = period[:4]
    month = int(period[4:6])
    q_map = {3: "Q1", 6: "Q2", 9: "Q3", 12: "Q4"}
    return f"{year}-{q_map.get(month, f'M{month}')}"


def main():
    if not EXCEL_DIR.exists():
        print(f"ERROR: Excel directory not found: {EXCEL_DIR}")
        sys.exit(1)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Discover all files
    files: dict[str, dict[str, str]] = {}  # {period: {stmt_type: filepath}}
    for fname in sorted(os.listdir(EXCEL_DIR)):
        if not fname.endswith(".xls"):
            continue
        parts = fname.replace(".xls", "").split("_")
        if len(parts) != 2:
            continue
        code, period = parts
        if code not in FILE_CODES:
            continue
        stmt_type = FILE_CODES[code]
        files.setdefault(period, {})[stmt_type] = str(EXCEL_DIR / fname)

    all_periods = sorted(files.keys())
    print(f"Found {len(all_periods)} periods: {all_periods[0]} to {all_periods[-1]}")

    # Extract all data
    period_data: dict[str, dict[str, dict[str, float | None]]] = {}

    for period in all_periods:
        print(f"  Extracting {period}...", end="")
        merged: dict[str, dict[str, float | None]] = {e: {} for e in ENTITY_NAMES}

        for stmt_type, fpath in files[period].items():
            if stmt_type == "pl":
                extracted = extract_pl(fpath)
            elif stmt_type == "oci":
                extracted = extract_oci(fpath)
            else:
                extracted = extract_bs(fpath, stmt_type)

            for entity in ENTITY_NAMES:
                merged[entity].update(extracted.get(entity, {}))

        merged = compute_ratios(merged)
        period_data[period] = merged
        print(" OK")

    # --- Load ECPN (6794) — annual year-end files only ---
    ecpn_data: dict[str, dict[str, dict[str, float | None]]] = {}
    for fname in sorted(os.listdir(EXCEL_DIR)):
        if not (fname.startswith(ECPN_FILE_CODE + "_") and fname.endswith(".xls")):
            continue
        period = fname.replace(".xls", "").split("_")[1]
        if not period.endswith("12"):
            continue  # ECPN is annual (December only)
        fpath = str(EXCEL_DIR / fname)
        print(f"  Loading ECPN {period}...", end="")
        ecpn_data[period] = extract_ecpn(fpath)
        print(" OK")

    # --- Build annual.json (December periods only) ---
    annual_periods = sorted([p for p in all_periods if p.endswith("12")])
    annual_output = {
        "_metadata": {
            "description": "Annual financial data from BdE public statements",
            "source": "Banco de Espana - Estados financieros publicos individuales",
            "entities": ENTITY_NAMES,
            "years": [int(p[:4]) for p in annual_periods],
        },
        "data": {},
    }
    for period in annual_periods:
        year = int(period[:4])
        annual_output["data"][str(year)] = period_data[period]

    # Merge ECPN equity-change data into annual output and recompute payout ratios
    for period, ecpn in ecpn_data.items():
        year = str(int(period[:4]))
        if year not in annual_output["data"]:
            continue
        for entity in ENTITY_NAMES:
            if entity in ecpn:
                annual_output["data"][year][entity].update(ecpn[entity])
        # Recompute payout/retention/yield now that dividends_paid and equity_opening are present
        for entity in ENTITY_NAMES:
            d = annual_output["data"][year].get(entity, {})
            div = d.get("dividends_paid")
            np_ = d.get("net_profit")
            eq_open = d.get("equity_opening")
            if div is not None and np_ is not None and np_ > 0:
                d["payout_ratio_pct"] = round(min(abs(div) / np_ * 100, 999.0), 1)
            elif div is not None and np_ is not None and np_ <= 0 and abs(div) > 0:
                d["payout_ratio_pct"] = 999.0
            pr = d.get("payout_ratio_pct")
            if pr is not None:
                d["retention_rate_pct"] = round(max(0.0, min(100.0, 100.0 - pr)), 1)
            if div is not None and eq_open is not None and eq_open != 0:
                d["dividend_yield_on_equity_pct"] = round(abs(div) / eq_open * 100, 1)

    # Compute Jaws ratio (YoY: revenue growth - cost growth) for annual data
    for i in range(1, len(annual_periods)):
        curr_year = str(int(annual_periods[i][:4]))
        prev_year = str(int(annual_periods[i - 1][:4]))
        for entity in ENTITY_NAMES:
            curr = annual_output["data"][curr_year].get(entity, {})
            prev = annual_output["data"][prev_year].get(entity, {})
            gm_curr = curr.get("gross_margin")
            gm_prev = prev.get("gross_margin")
            admin_curr = curr.get("admin_expenses")
            admin_prev = prev.get("admin_expenses")
            depr_curr = curr.get("depreciation")
            depr_prev = prev.get("depreciation")
            if all(v is not None for v in [gm_curr, gm_prev, admin_curr, admin_prev]) and gm_prev != 0 and admin_prev != 0:
                rev_growth = (gm_curr - gm_prev) / abs(gm_prev) * 100
                cost_curr = abs(admin_curr) + (abs(depr_curr) if depr_curr else 0)
                cost_prev = abs(admin_prev) + (abs(depr_prev) if depr_prev else 0)
                cost_growth = (cost_curr - cost_prev) / cost_prev * 100 if cost_prev != 0 else 0
                curr["jaws_ratio"] = round(rev_growth - cost_growth, 1)

    annual_path = OUTPUT_DIR / "annual.json"
    with open(annual_path, "w") as f:
        json.dump(annual_output, f, indent=2, ensure_ascii=False)
    print(f"\nWrote {annual_path} ({len(annual_periods)} years)")

    # --- Build quarterly.json (standalone quarter figures) ---
    # BdE reports YTD cumulative — isolate standalone quarters by subtraction
    quarterly_output: dict = {
        "_metadata": {
            "description": "Standalone quarterly financial data (YTD differences)",
            "source": "Banco de Espana - Estados financieros publicos individuales",
            "entities": ENTITY_NAMES,
        },
        "quarters": [],
        "data": {},
    }

    # Metrics that are YTD cumulative in BdE (P&L items)
    ytd_metrics = set(PL_ROWS.values()) | {
        "net_fee_income", "trading_and_other", "net_operating_income",
        "total_provisions_impairments",
    }
    # Metrics that are point-in-time (balance sheet) — no subtraction needed
    pit_metrics = {
        "total_assets", "total_equity", "intangible_assets",
        "cash_and_central_bank", "securities_fvoci", "assets_amortized_cost",
        "total_deposits", "interbank_deposits", "client_deposits", "total_liabilities",
    }
    # Ratios will be recomputed after isolation

    for period in all_periods:
        q_label = period_to_quarter(period)
        month = int(period[4:6])
        year = period[:4]

        standalone: dict[str, dict[str, float | None]] = {e: {} for e in ENTITY_NAMES}

        # Find the prior quarter's YTD in the same fiscal year
        prior_period = None
        if month == 6:
            prior_period = f"{year}03"
        elif month == 9:
            prior_period = f"{year}06"
        elif month == 12:
            prior_period = f"{year}09"
        # Q1 (month=3): YTD = standalone, no prior

        for entity in ENTITY_NAMES:
            current = period_data[period].get(entity, {})

            for metric, val in current.items():
                if metric in ytd_metrics:
                    if prior_period and prior_period in period_data:
                        prior_val = period_data[prior_period].get(entity, {}).get(metric)
                        if val is not None and prior_val is not None:
                            standalone[entity][metric] = round(val - prior_val, 2)
                        else:
                            standalone[entity][metric] = val
                    else:
                        # Q1 or no prior available — YTD IS standalone
                        standalone[entity][metric] = val
                elif metric in pit_metrics:
                    standalone[entity][metric] = val
                # Skip ratio metrics — will recompute

        # Recompute ratios on standalone figures, but preserve metrics that
        # were already correctly isolated by YTD differencing.
        standalone = compute_ratios(standalone, preserve=ytd_metrics)

        quarterly_output["quarters"].append(q_label)
        quarterly_output["data"][q_label] = standalone

    quarterly_path = OUTPUT_DIR / "quarterly.json"
    with open(quarterly_path, "w") as f:
        json.dump(quarterly_output, f, indent=2, ensure_ascii=False)
    print(f"Wrote {quarterly_path} ({len(all_periods)} quarters)")

    # --- Reconciliation: quarterly Q1+Q2+Q3+Q4 should approximate annual ---
    RECONCILE_METRICS = ["gross_margin", "nii", "net_fee_income", "admin_expenses", "net_profit"]
    TOLERANCE = 1.0  # EUR millions
    recon_warnings = 0
    for period in annual_periods:
        yr = period[:4]
        q_labels = [f"{yr}-Q1", f"{yr}-Q2", f"{yr}-Q3", f"{yr}-Q4"]
        for entity in ENTITY_NAMES:
            for metric in RECONCILE_METRICS:
                annual_val = annual_output["data"][yr].get(entity, {}).get(metric)
                if annual_val is None:
                    continue
                quarterly_vals = [
                    quarterly_output["data"].get(q, {}).get(entity, {}).get(metric)
                    for q in q_labels
                    if q in quarterly_output["data"]
                ]
                if not all(v is not None for v in quarterly_vals):
                    continue
                q_sum = sum(quarterly_vals)  # type: ignore[arg-type]
                if abs(q_sum - annual_val) > TOLERANCE:
                    print(
                        f"  RECON WARN: {entity} {yr} {metric}: "
                        f"Q-sum={q_sum:.2f} vs annual={annual_val:.2f} "
                        f"(diff={q_sum - annual_val:+.2f})"
                    )
                    recon_warnings += 1
    if recon_warnings == 0:
        print("Reconciliation: all checks passed.")
    else:
        print(f"Reconciliation: {recon_warnings} warning(s) — review before publishing.")

    # --- Summary stats ---
    latest_year = str(max(int(p[:4]) for p in annual_periods))
    print(f"\n--- Latest Annual ({latest_year}) ---")
    for entity in ENTITY_NAMES:
        d = annual_output["data"][latest_year].get(entity, {})
        print(f"  {entity:12s}: GM={d.get('gross_margin', '?'):>8} | C/I={d.get('cost_to_income_pct', '?'):>5}% | ROE={d.get('roe_pct', '?'):>5}% | NFI={d.get('net_fee_income', '?'):>8}")


if __name__ == "__main__":
    main()
