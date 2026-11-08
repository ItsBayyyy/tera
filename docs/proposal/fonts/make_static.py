"""Make static Plus Jakarta Sans instances for the proposal PDF.

Chromium embeds variable fonts in PDFs as Type 3 glyph drawings, which some PDF checkers report as
"not embedded". Static instances are embedded as regular TrueType subsets instead.

Source: the Latin subset of the variable font that next/font downloads at build time (SIL OFL 1.1,
Copyright 2020 The Plus Jakarta Sans Project Authors). Run from the repo root with fontTools and
brotli installed:  python docs/proposal/fonts/make_static.py
"""

from pathlib import Path

from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

HERE = Path(__file__).parent
SOURCE = HERE / "PlusJakartaSans-latin.woff2"
WEIGHTS = (400, 500, 600, 700, 800)

for weight in WEIGHTS:
    font = instantiateVariableFont(TTFont(SOURCE), {"wght": weight}, updateFontNames=True)
    font.flavor = "woff2"
    font.save(HERE / f"PlusJakartaSans-{weight}.woff2")
    print(f"PlusJakartaSans-{weight}.woff2")
