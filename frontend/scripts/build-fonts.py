"""Build the self-hosted webfonts in `public/fonts` from their sources.

Three things happen here, all of them lossless for this site:

1. Recursive  — the upstream variable font carries five axes (MONO, CASL,
   wght, slnt, CRSV). Every one of them costs glyph-delta data, so the two
   voices the theme actually uses are baked out separately:

     * Display  — MONO 0, CASL 0.45, with only `wght` left variable.
     * Mono     — MONO 1, CASL 0.3, pinned at one weight: no axes at all,
                  which drops the gvar table entirely.

   Shipping one three-axis file for both voices meant paying for the MONO and
   CASL deltas everywhere; splitting them is what actually cuts the bytes.
2. Golos UI   — the body face is split by script. Latin rides in the main file;
   Cyrillic moves to a sibling that browsers only fetch if the page ever needs
   it, which for an English tech digest is never.
3. Geist Pixel Square — an accent face used for issue numbers, countdowns and
   short dates. Only the Latin-1 block plus common punctuation is kept.

Run after any font package upgrade:

    python3 scripts/build-fonts.py

Requires: fonttools, brotli
"""

from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public/fonts"
SOURCES = ROOT / "font-sources"

RECURSIVE_SRC = ROOT / "node_modules/@fontsource-variable/recursive/files"
GOLOS_SRC = ROOT / "node_modules/@fontsource/golos-ui/files"

# Never used by the theme, so they are pinned for both voices.
ALWAYS_PINNED = {
    "slnt": 0.0,  # slant
    "CRSV": 0.5,  # cursive (0.5 is the upstream default)
}

# voice -> axes to pin on top of ALWAYS_PINNED.
# `wght` is a tuple for display: the axis stays variable but only spans the
# two weights the design system asks for (540 and 720), so the deltas outside
# that window are discarded. Mono pins a single weight and becomes a static
# font, which is why it carries no gvar table at all.
RECURSIVE_VOICES = {
    "display": {"MONO": 0.0, "CASL": 0.45, "wght": (500, 720)},
    "mono": {"MONO": 1.0, "CASL": 0.3, "wght": 500.0},
}

RECURSIVE_SUBSETS = {
    "latin": "recursive-latin-full-normal.woff2",
    "latin-ext": "recursive-latin-ext-full-normal.woff2",
}

GOLOS_WEIGHTS = (400, 500, 600)

# Ranges that belong to the Cyrillic file. Everything else stays in Latin.
CYRILLIC_RANGES = (
    (0x0301, 0x0301),
    (0x0400, 0x052F),
    (0x1C80, 0x1C88),
    (0x20B4, 0x20B4),
    (0x2116, 0x2116),
    (0x2DE0, 0x2DFF),
    (0xA640, 0xA69F),
    (0xFE2E, 0xFE2F),
)

# Geist Pixel Square only ever renders numbers, short dates and labels like
# "5h 23m", so Latin-1 plus common punctuation is plenty.
PIXEL_RANGES = (
    (0x20, 0xFF),
    (0x2000, 0x206F),
    (0x20AC, 0x20AC),
    (0x2122, 0x2122),
    (0x2190, 0x2199),
)


def in_ranges(codepoint: int, ranges) -> bool:
    return any(low <= codepoint <= high for low, high in ranges)


def save_woff2(font: TTFont, destination: Path) -> int:
    font.flavor = "woff2"
    font.save(destination)
    return destination.stat().st_size


def trim_recursive() -> None:
    for voice, axes in RECURSIVE_VOICES.items():
        for tag, filename in RECURSIVE_SUBSETS.items():
            source = RECURSIVE_SRC / filename
            if not source.exists():
                raise SystemExit(f"missing upstream font: {source}")

            font = TTFont(source)
            before = source.stat().st_size
            instancer.instantiateVariableFont(
                font, {**ALWAYS_PINNED, **axes}, inplace=True, updateFontNames=False
            )
            after = save_woff2(font, OUT / f"recursive-{voice}-{tag}.woff2")
            report(f"recursive {voice} {tag}", before, after)


def split_golos() -> None:
    for weight in GOLOS_WEIGHTS:
        source = GOLOS_SRC / f"golos-ui-latin-ext-{weight}-normal.woff2"
        if not source.exists():
            raise SystemExit(f"missing upstream font: {source}")

        before = source.stat().st_size
        codepoints = set(TTFont(source).getBestCmap().keys())
        cyrillic = {c for c in codepoints if in_ranges(c, CYRILLIC_RANGES)}
        latin = codepoints - cyrillic

        for tag, wanted in (("latin", latin), ("cyrillic", cyrillic)):
            if not wanted:
                continue
            font = TTFont(source)
            options = subset.Options()
            options.flavor = "woff2"
            subsetter = subset.Subsetter(options=options)
            subsetter.populate(unicodes=wanted)
            subsetter.subset(font)
            after = save_woff2(font, OUT / f"golos-ui-{weight}-{tag}.woff2")
            report(f"golos {weight} {tag}", before, after)


def trim_pixel() -> None:
    source = SOURCES / "GeistPixel-Square.woff2"
    if not source.exists():
        raise SystemExit(f"missing source font: {source}")

    before = source.stat().st_size
    codepoints = set(TTFont(source).getBestCmap().keys())
    wanted = {c for c in codepoints if in_ranges(c, PIXEL_RANGES)}

    font = TTFont(source)
    options = subset.Options()
    options.flavor = "woff2"
    subsetter = subset.Subsetter(options=options)
    subsetter.populate(unicodes=wanted)
    subsetter.subset(font)
    after = save_woff2(font, OUT / "geist-pixel-square-latin1.woff2")
    report("geist pixel", before, after)


def report(label: str, before: int, after: int) -> None:
    saved = (1 - after / before) * 100
    print(f"{label:22s} {before / 1024:7.1f} KB -> {after / 1024:7.1f} KB  (-{saved:.0f}%)")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    trim_recursive()
    split_golos()
    trim_pixel()


if __name__ == "__main__":
    main()
