#!/usr/bin/env python3
"""
Extract CNMV ESI (Empresas de Servicios de Inversión) statistics and produce
esi_annual.json + esi_quarterly.json for the CFO Dashboard's "Securities firms"
view — benchmarking Inversis's comisiones / ROF against the Sociedades de Valores
(SV) and Agencias de Valores (AV) market.

Two public CNMV sources (quarterly, cumulative YTD "desde enero", thousands of €):

  * Aggregate P&L per entity type  (page tipo=E01-YYYYMM, "Cuenta de pérdidas y
    ganancias") → the SV-total and AV-total market lines, full rich P&L incl. ROF
    and comisiones sub-types (execution / custody / fund distribution ...).
  * Individual-entity summary       (page tipo=EA2-YYYYMM, Anexo A.2.1 SV / A.2.2 AV)
    → per-firm comisiones, margen bruto, gastos, resultado, fondos propios, activos
    for named peers and Inversis clients.

The raw workbooks are downloaded by fetch_cnmv.py into
  <inversis-dashboard>/CNMV data/raw/<period>/{pyl,ind}_<i>.xls
(run that first). This script is pure offline parsing of that cache. Both old
.xls (BIFF, single period, Total/SV/AV columns) and new .xlsx (per-entity,
trailing-5-quarter columns) layouts are handled by content, not position.

Output mirrors the banking datasets: cumulative periods are differenced into
standalone quarters (esi_quarterly.json, 2021-Q4 …) and December cumulatives are
the full-year figures (esi_annual.json, + current partial year as YTD).
"""
import json
import re
import sys
from pathlib import Path

import pandas as pd

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
INVERSIS_DIR = Path("/Users/joaco/inversis-dashboard")
RAW_DIR = INVERSIS_DIR / "CNMV data" / "raw"
OUTPUT_DIR = Path(__file__).resolve().parent.parent / "src" / "data"

# Cumulative quarter-end periods to parse (YYYYMM). 202109 anchors 2021-Q4.
PERIODS = [
    "202109", "202112",
    "202203", "202206", "202209", "202212",
    "202303", "202306", "202309", "202312",
    "202403", "202406", "202409", "202412",
    "202503", "202506", "202509", "202512",
    "202603", "202606",
]

ROMAN = {"03": "I", "06": "II", "09": "III", "12": "IV"}


def period_to_quarter(period: str) -> str:
    """202606 -> '2026-Q2'."""
    q = {"03": "Q1", "06": "Q2", "09": "Q3", "12": "Q4"}[period[4:6]]
    return f"{period[:4]}-{q}"


# ---------------------------------------------------------------------------
# P&L line-item mapping. Matched on the leading numeric token (robust to text
# truncation / wording changes) or, for subtotal lines with no number, on an
# uppercase keyword. Values are in thousands of euros.
# ---------------------------------------------------------------------------
PYL_BY_PREFIX = {
    "1.": "margen_intereses",
    "2.": "comisiones_netas",
    "2.1.": "comisiones_percibidas",
    "2.1.1.": "com_ejecucion",          # Tramitación y ejecución de órdenes
    "2.1.3.": "com_deposito",           # Depósito y anotación de valores (custody)
    "2.1.4.": "com_gestion_carteras",   # Gestión de carteras
    "2.1.5.": "com_asesoramiento",      # Asesoramiento en materia de inversión
    "2.1.8.": "com_comercializacion_iic",  # Comercialización de IIC (fund distribution)
    "2.2.": "comisiones_satisfechas",
    "3.": "rof",                        # Resultado de inversiones financieras
    "4.": "diferencias_cambio",
    "5.": "otros_explotacion",
    "6.": "gastos_explotacion",
    "6.1.": "gastos_personal",
    "6.2.": "gastos_generales",
    "7.": "amortizaciones",
    "10.": "impuesto",
}
PYL_BY_KEYWORD = {
    "MARGEN BRUTO": "margen_bruto",
    "RESULTADO DE EXPLOTACIÓN": "resultado_explotacion",
    "RESULTADO ANTES DE IMPUESTOS": "resultado_antes_impuestos",
    "RESULTADO NETO DEL EJERCICIO": "resultado_neto",
}

# Individual-entity summary columns (Anexo A.2.x), stable positional layout after
# the "Denominación" header row.
IND_COLS = {
    1: "fondos_propios",
    2: "activos_totales",
    3: "comisiones_percibidas",
    4: "comisiones_netas",
    5: "margen_bruto",
    6: "gastos_explotacion",
    7: "resultado_antes_impuestos",
}


# ---------------------------------------------------------------------------
# Load cached raw workbooks (populated by fetch_cnmv.py)
# ---------------------------------------------------------------------------
def load_period(period: str) -> dict:
    """Return {'pyl': [paths], 'ind': [paths]} from the raw cache for a period."""
    pdir = RAW_DIR / period
    if not pdir.is_dir():
        raise SystemExit(f"No raw cache for {period} at {pdir} — run fetch_cnmv.py first")
    return {
        "pyl": sorted(pdir.glob("pyl_*.xls")),
        "ind": sorted(pdir.glob("ind_*.xls")),
    }


# ---------------------------------------------------------------------------
# Read a workbook regardless of .xls (BIFF) / .xlsx underlying format
# ---------------------------------------------------------------------------
def read_any(path: Path) -> pd.DataFrame:
    head = path.read_bytes()[:4]
    engine = "openpyxl" if head[:2] == b"PK" else "xlrd"
    return pd.read_excel(path, engine=engine, header=None)


def _num(v):
    if pd.isna(v):
        return None
    if isinstance(v, str):
        v = v.strip().replace(".", "").replace(",", ".")
        if v in ("", "-", "n.d.", "N/A"):
            return None
        try:
            v = float(v)
        except ValueError:
            return None
    return float(v)


def _match_field(label: str):
    """Map a P&L row label to a metric field, longest numeric prefix first."""
    lab = label.strip()
    up = lab.upper()
    for kw, field in PYL_BY_KEYWORD.items():
        if up.startswith(kw):
            return field
    m = re.match(r"^(\d+(?:\.\d+)*\.)", lab)
    if m:
        return PYL_BY_PREFIX.get(m.group(1))
    return None


# ---------------------------------------------------------------------------
# Parse aggregate P&L (a period's SV-total and AV-total market lines)
# ---------------------------------------------------------------------------
def parse_pyl_period(paths: list[Path], period: str) -> dict:
    """Return {'SV': {field: value_k€}, 'AV': {...}} cumulative at `period`."""
    result = {"SV": {}, "AV": {}}
    year, roman = period[:4], ROMAN[period[4:6]]

    def norm(v):
        return re.sub(r"\s+", " ", str(v)).strip().lower() if pd.notna(v) else ""

    for path in paths:
        df = read_any(path)
        # Only P&L statements (skip balance / entity-count cuadros).
        joined = " ".join(
            norm(df.iat[r, c])
            for r in range(min(6, df.shape[0]))
            for c in range(df.shape[1])
        )
        if "pérdidas y ganancias" not in joined and "perdidas y ganancias" not in joined:
            continue

        # Old combined layout has a column-header row with "Sociedades de valores"
        # and "Agencias de valores" in DISTINCT cells. (The title row mentions both
        # in one cell — not a match.) If found, this file carries both columns.
        hdr = sv_col = av_col = None
        for r in range(min(15, df.shape[0])):
            cells = {c: norm(df.iat[r, c]) for c in range(df.shape[1])}
            s = [c for c, t in cells.items() if t == "sociedades de valores"]
            a = [c for c, t in cells.items() if t == "agencias de valores"]
            if s and a:
                hdr, sv_col, av_col = r, s[0], a[0]
                break

        if hdr is not None:
            for r in range(hdr + 1, df.shape[0]):
                field = _match_field(str(df.iat[r, 0])) if pd.notna(df.iat[r, 0]) else None
                if not field:
                    continue
                result["SV"].setdefault(field, _num(df.iat[r, sv_col]))
                result["AV"].setdefault(field, _num(df.iat[r, av_col]))
        else:
            # New per-entity layout: one file each for Total / SV / AV, with
            # year/quarter columns. Skip the Total file; pick the column matching
            # this period (fallback: rightmost data column).
            if "total sociedades y agencias" in joined or "sociedades y agencias de valores" in joined:
                continue
            if "sociedades de valores" in joined:
                entity = "SV"
            elif "agencias de valores" in joined:
                entity = "AV"
            else:
                continue
            # Anchor on the quarter-label row (roman numerals never appear in the
            # data body, unlike 20xx-looking amounts) and read years from the row
            # directly above it.
            romans = ("I", "II", "III", "IV")
            qr_row = next(
                (r for r in range(min(8, df.shape[0]))
                 if sum(str(df.iat[r, c]).strip() in romans for c in range(df.shape[1])) >= 2),
                None,
            )
            if qr_row is None:
                continue
            yr_row = qr_row - 1
            roman_cols, target_col, cur_year = [], None, None
            for c in range(df.shape[1]):
                yv = str(df.iat[yr_row, c]).strip() if yr_row >= 0 else ""
                if re.fullmatch(r"(19|20)\d\d", yv):
                    cur_year = yv
                qv = str(df.iat[qr_row, c]).strip()
                if qv in romans:
                    roman_cols.append(c)
                    if cur_year == year and qv == roman:
                        target_col = c
            if target_col is None:  # fallback: latest cumulative column (never %Var)
                target_col = roman_cols[-1] if roman_cols else None
            if target_col is None:
                continue
            for r in range(df.shape[0]):
                field = _match_field(str(df.iat[r, 0])) if pd.notna(df.iat[r, 0]) else None
                if field:
                    result[entity].setdefault(field, _num(df.iat[r, target_col]))
    return result


# ---------------------------------------------------------------------------
# Parse individual-entity summaries (named peers + clients)
# ---------------------------------------------------------------------------
def parse_individual_period(paths: list[Path]) -> dict:
    """Return {firm_name: {field: value_k€, '_type': 'SV'|'AV'}}."""
    firms = {}
    for path in paths:
        df = read_any(path)
        joined = " ".join(
            str(df.iat[r, c]) for r in range(min(4, df.shape[0]))
            for c in range(df.shape[1]) if pd.notna(df.iat[r, c])
        ).lower()
        etype = "SV" if "sociedades de valores" in joined else ("AV" if "agencias de valores" in joined else None)
        if etype is None:
            continue
        hdr = None
        for r in range(min(12, df.shape[0])):
            if pd.notna(df.iat[r, 0]) and str(df.iat[r, 0]).strip().lower().startswith("denominaci"):
                hdr = r
                break
        if hdr is None:
            continue
        for r in range(hdr + 1, df.shape[0]):
            name = df.iat[r, 0]
            if pd.isna(name):
                continue
            name = str(name).strip()
            if name.upper().startswith("TOTAL"):
                break  # everything below the total row is footnotes
            if not name[:1].isalpha():  # skip numbered notes / "*" / "(" markers
                continue
            rec = {"_type": etype}
            for c, field in IND_COLS.items():
                if c < df.shape[1]:
                    rec[field] = _num(df.iat[r, c])
            firms[name] = rec
    return firms


# ---------------------------------------------------------------------------
# Assemble the dashboard JSON (values converted k€ → €M to match the banking
# datasets, so the UI can plot Inversis's bank-basis figures alongside).
# ---------------------------------------------------------------------------
UNIT = 1000.0  # thousands of euros per €M
MARKET = {"SV": "Sociedades de Valores", "AV": "Agencias de Valores"}
STOCK_FIELDS = {"fondos_propios", "activos_totales"}  # balance snapshots, never differenced

# Standalone-quarter map: (label, period, prior period to subtract | None for Q1).
QUARTERS = [
    ("2021-Q4", "202112", "202109"),
    ("2022-Q1", "202203", None), ("2022-Q2", "202206", "202203"),
    ("2022-Q3", "202209", "202206"), ("2022-Q4", "202212", "202209"),
    ("2023-Q1", "202303", None), ("2023-Q2", "202306", "202303"),
    ("2023-Q3", "202309", "202306"), ("2023-Q4", "202312", "202309"),
    ("2024-Q1", "202403", None), ("2024-Q2", "202406", "202403"),
    ("2024-Q3", "202409", "202406"), ("2024-Q4", "202412", "202409"),
    ("2025-Q1", "202503", None), ("2025-Q2", "202506", "202503"),
    ("2025-Q3", "202509", "202506"), ("2025-Q4", "202512", "202509"),
    ("2026-Q1", "202603", None), ("2026-Q2", "202606", "202603"),
]
FY = {"2021": "202112", "2022": "202212", "2023": "202312", "2024": "202412", "2025": "202512"}
YTD_YEAR, YTD_PERIOD, YTD_PRIOR = "2026", "202606", "202506"  # H1 2026 vs H1 2025


def _to_m(vals: dict) -> dict:
    return {k: (round(v / UNIT, 3) if v is not None else None)
            for k, v in vals.items() if not k.startswith("_")}


def entity_records(agg_p: dict, ind_p: dict) -> dict:
    """{entity_name: {field: value_€M}} for one cumulative period (market + firms)."""
    recs = {}
    for seg, name in MARKET.items():
        recs[name] = _to_m(agg_p[seg])
    for firm, vals in ind_p.items():
        recs[firm] = _to_m(vals)
    return recs


def diff_records(cur: dict, prev: dict | None) -> dict:
    """Standalone-quarter records: flows differenced, stocks snapshot, Q1 = cumulative."""
    out = {}
    for name, cvals in cur.items():
        pvals = prev.get(name) if prev else None
        rec = {}
        for k, v in cvals.items():
            if k in STOCK_FIELDS or prev is None:
                rec[k] = v
            elif pvals is not None and v is not None and pvals.get(k) is not None:
                rec[k] = round(v - pvals[k], 3)
            else:
                rec[k] = None
        out[name] = rec
    return out


def main():
    agg, ind = {}, {}
    for p in PERIODS:
        print(f"· {p} …", end=" ", flush=True)
        files = load_period(p)
        agg[p] = parse_pyl_period(files["pyl"], p)
        ind[p] = parse_individual_period(files["ind"])
        print(f"SV mb={agg[p]['SV'].get('margen_bruto')} "
              f"AV mb={agg[p]['AV'].get('margen_bruto')} firms={len(ind[p])}")

    # Entity metadata: market aggregates + every individual firm seen (union).
    segment = {MARKET["SV"]: "SV", MARKET["AV"]: "AV"}
    kind = {MARKET["SV"]: "market", MARKET["AV"]: "market"}
    for p in PERIODS:
        for firm, vals in ind[p].items():
            segment.setdefault(firm, vals["_type"])
            kind.setdefault(firm, "firm")
    entities_meta = [{"name": n, "segment": segment[n], "kind": kind[n]}
                     for n in [MARKET["SV"], MARKET["AV"]] + sorted(
                         n for n in segment if kind[n] == "firm")]

    source = "CNMV - Estadísticas ESI (Sociedades y Agencias de Valores)"

    # Annual: FY (December cumulative) + current year as H1 YTD, with a same-period
    # prior-year snapshot (ytd_prior) per entity for like-for-like growth.
    annual_data = {y: entity_records(agg[p], ind[p]) for y, p in FY.items()}
    ytd_cur = entity_records(agg[YTD_PERIOD], ind[YTD_PERIOD])
    ytd_prior = entity_records(agg[YTD_PRIOR], ind[YTD_PRIOR])
    for name, rec in ytd_cur.items():
        rec["ytd_prior"] = ytd_prior.get(name)
    annual_data[YTD_YEAR] = ytd_cur

    annual = {
        "_metadata": {
            "description": "Annual CNMV ESI data (December = full year; current year = H1 YTD). Amounts in EUR millions.",
            "source": source,
            "unit": "EUR millions",
            "entities": entities_meta,
            "years": [int(y) for y in FY] + [int(YTD_YEAR)],
            "ytd": {YTD_YEAR: {"period": YTD_PERIOD, "months": 6, "label": "H1 2026",
                                "quarters": ["2026-Q1", "2026-Q2"]}},
        },
        "data": annual_data,
    }

    # Quarterly: standalone quarters (cumulative differences).
    quarterly_data = {}
    for label, p, prev in QUARTERS:
        quarterly_data[label] = diff_records(
            entity_records(agg[p], ind[p]),
            entity_records(agg[prev], ind[prev]) if prev else None,
        )
    quarterly = {
        "_metadata": {
            "description": "Standalone quarterly CNMV ESI data (YTD differences). Amounts in EUR millions.",
            "source": source,
            "unit": "EUR millions",
            "entities": entities_meta,
        },
        "quarters": [q[0] for q in QUARTERS],
        "data": quarterly_data,
    }

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUTPUT_DIR / "esi_annual.json").write_text(
        json.dumps(annual, ensure_ascii=False, indent=1))
    (OUTPUT_DIR / "esi_quarterly.json").write_text(
        json.dumps(quarterly, ensure_ascii=False, indent=1))
    print(f"\nWrote esi_annual.json ({len(annual_data)} years) + "
          f"esi_quarterly.json ({len(quarterly_data)} quarters), "
          f"{len(entities_meta)} entities.")


if __name__ == "__main__":
    main()
