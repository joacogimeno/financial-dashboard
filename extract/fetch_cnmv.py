#!/usr/bin/env python3
"""
Download CNMV ESI (Sociedades / Agencias de Valores) quarterly statistics into
the raw cache consumed by extract_cnmv.py.

For each quarter-end period it fetches two CNMV pages and harvests the Excel
download links (opaque /webservices/verdocumento tokens):
  * E01-YYYYMM  → aggregate P&L cuadros ("Cuenta de pérdidas y ganancias")
  * EA2-YYYYMM  → individual-entity anexos A.2.1 (SV) / A.2.2 (AV)
and caches every workbook under:
  <inversis-dashboard>/CNMV data/raw/<period>/{pyl,ind}_<i>.xls

Idempotent: skips links/files already on disk. Run before extract_cnmv.py.

Usage:  python extract/fetch_cnmv.py [YYYYMM ...]   (default: all PERIODS)
"""
import re
import ssl
import sys
import urllib.request
from pathlib import Path

# Reuse the period list + cache location from the extractor.
from extract_cnmv import PERIODS, RAW_DIR

BASE = "https://www.cnmv.es/portal/publicaciones/ConsultasEstadisticas?id=ESI"
UA = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"}

# CNMV's TLS chain fails Python's bundled CA verification on some machines
# (corporate proxy / macOS keychain root absent from certifi); curl trusts it.
# These are public, non-sensitive statistics, so fall back to an unverified
# context if the default verified fetch raises.
_VERIFIED = ssl.create_default_context()
_UNVERIFIED = ssl._create_unverified_context()


def _get(url: str, timeout: int = 40) -> bytes:
    req = urllib.request.Request(url, headers=UA)
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=_VERIFIED) as r:
            return r.read()
    except ssl.SSLError:
        with urllib.request.urlopen(req, timeout=timeout, context=_UNVERIFIED) as r:
            return r.read()


def _excel_links(html: str) -> list[str]:
    """Excel links carry the …F7mr05 token suffix; PDF links end …ONkBCrD."""
    links = re.findall(
        r'https://www\.cnmv\.es/webservices/verdocumento/ver\?e=[^"]+', html
    )
    return [u for u in links if u.endswith("F7mr05")]


def fetch_period(period: str) -> None:
    pdir = RAW_DIR / period
    pdir.mkdir(parents=True, exist_ok=True)
    for tag, code in (("pyl", "E01"), ("ind", "EA2")):
        manifest = pdir / f"{tag}_links.txt"
        if manifest.exists() and manifest.read_text().strip():
            links = manifest.read_text().split()
        else:
            html = _get(f"{BASE}&tipo={code}-{period}").decode("latin-1", "replace")
            links = _excel_links(html)
            manifest.write_text("\n".join(links))
        for i, url in enumerate(links):
            dest = pdir / f"{tag}_{i}.xls"
            if not dest.exists() or dest.stat().st_size == 0:
                dest.write_bytes(_get(url))
        print(f"  {period}/{tag}: {len(links)} files")


def main():
    for p in sys.argv[1:] or PERIODS:
        print(f"[{p}]")
        fetch_period(p)
    print("done")


if __name__ == "__main__":
    main()
