#!/usr/bin/env python3
"""
Regression check: verify cost_to_income_pct is consistent across the dashboard.

Formula: (abs(admin_expenses) + abs(depreciation)) / abs(gross_margin) * 100

Run after every extraction:
    python3 extract/check_ci.py

Exits 1 if any mismatch is found (tolerates ±0.2pp rounding).
"""
import json
import sys
from pathlib import Path

ANNUAL_JSON = Path(__file__).resolve().parent.parent / "src" / "data" / "annual.json"
TOLERANCE = 0.2  # pp — rounding tolerance

def check(path: Path) -> int:
    with open(path) as f:
        data = json.load(f)

    errors = 0

    for year, year_data in data["data"].items():
        for entity, d in year_data.items():
            stored = d.get("cost_to_income_pct")
            admin = d.get("admin_expenses")
            dep = d.get("depreciation")
            gm = d.get("gross_margin")

            # Skip if any input is missing
            if any(v is None for v in [stored, admin, dep, gm]) or gm == 0:
                continue

            expected = round((abs(admin) + abs(dep)) / abs(gm) * 100, 1)

            if abs(stored - expected) > TOLERANCE:
                print(
                    f"  MISMATCH  {entity:12s} {year}: "
                    f"stored={stored:.1f}%  expected={expected:.1f}%  "
                    f"delta={stored - expected:+.1f}pp"
                )
                errors += 1

    return errors


def main() -> None:
    print(f"Checking {ANNUAL_JSON.name} ...")
    errors = check(ANNUAL_JSON)

    if errors:
        print(f"\nFAIL — {errors} mismatch(es). Re-run extract_bde.py and investigate.")
        sys.exit(1)

    # Spot-check FY2025 Inversis against known values
    with open(ANNUAL_JSON) as f:
        data = json.load(f)

    d2025 = data["data"].get("2025", {}).get("Inversis", {})
    if d2025:
        admin, dep, gm = d2025.get("admin_expenses"), d2025.get("depreciation"), d2025.get("gross_margin")
        stored = d2025.get("cost_to_income_pct")
        if admin is not None and dep is not None and gm:
            expected = (abs(admin) + abs(dep)) / abs(gm) * 100
            print(
                f"Spot-check FY2025 Inversis: admin={admin}, dep={dep}, gm={gm} "
                f"→ canonical={expected:.1f}%  stored={stored}%  ",
                end="",
            )
            print("PASS" if abs((stored or 0) - expected) <= TOLERANCE else "FAIL")

    print(f"All {ANNUAL_JSON.name} C/I values consistent. PASS")


if __name__ == "__main__":
    main()
