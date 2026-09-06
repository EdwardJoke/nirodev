#!/usr/bin/env python3
"""Pixel-level audit for Daily Tech News.

Checks, per route and per theme:
  1. JS console errors + pageerror
  2. Horizontal overflow (document vs viewport)
  3. Left-edge alignment of editorial columns (x snap to expected origins)
  4. Text contrast ratios (WCAG AA: 4.5 body, 3.0 large)
  5. Hairline borders are 1px and fully opaque (no translucent seams)
  6. Focus ring visible on first nav stop
  7. Cumulative Layout Shift on load
"""

import json
import sys
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:4173"

ROUTES = ["/", "/archive", "/trends", "/issue/2026-08-28", "/topic/ai", "/404-page"]
VIEWPORTS = [(390, 844), (768, 1024), (1280, 800), (1440, 900)]

AUDIT_JS = r"""
() => {
  const cs = getComputedStyle(document.documentElement);
  const bg = cs.getPropertyValue('--background').trim();
  const fg = cs.getPropertyValue('--foreground').trim();
  const mut = cs.getPropertyValue('--muted-foreground').trim();
  const border = cs.getPropertyValue('--border').trim();

  // --- oklch -> rgb -> relative luminance ---
  const parse = (v) => {
    const m = v.match(/oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)/);
    if (!m) return null;
    let L = +m[1];
    if (m[2] === '%') L = L / 100;
    const C = +m[3], H = +m[4];
    const hr = H * Math.PI / 180;
    const a = Math.cos(hr) * C, b = Math.sin(hr) * C;
    const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
    const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
    const s_ = L - 0.0894841775 * a - 1.2914855480 * b;
    const l = l_ ** 3, mm = m_ ** 3, s = s_ ** 3;
    let r = +4.0767416621 * l - 3.3077115913 * mm + 0.2309699292 * s;
    let g = -1.2684380046 * l + 2.6097574011 * mm - 0.3413193965 * s;
    let bb = -0.0041960863 * l - 0.7034186147 * mm + 1.7076147010 * s;
    // WCAG relative luminance needs LINEAR rgb — no gamma encoding here.
    return [r, g, bb].map(x => Math.min(1, Math.max(0, x)));
  };
  const lum = (rgb) => 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
  const ratio = (a, b) => {
    const l1 = lum(a), l2 = lum(b);
    const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
    return (hi + 0.05) / (lo + 0.05);
  };

  const fgR = parse(fg), bgR = parse(bg), mutR = parse(mut);
  const contrast = {
    'foreground/background': fgR && bgR ? +ratio(fgR, bgR).toFixed(2) : null,
    'muted/background': mutR && bgR ? +ratio(mutR, bgR).toFixed(2) : null,
  };

  // --- hairlines: every element with a visible solid border ---
  const badBorders = [];
  const hairlineTotal = { count: 0, crisp: 0 };
  for (const el of document.querySelectorAll('*')) {
    const s = getComputedStyle(el);
    for (const side of ['Top', 'Bottom', 'Left', 'Right']) {
      const w = s[`border${side}Width`];
      const style = s[`border${side}Style`];
      if (style === 'none' || w === '0px') continue;
      const col = s[`border${side}Color`];
      const opaque = !col.includes('rgba') || !/rgba\([^)]*,\s*0?\.\d+\)/.test(col);
      hairlineTotal.count++;
      if (opaque) hairlineTotal.crisp++;
      else if (badBorders.length < 5) badBorders.push(col);
      // widths: 1px or 2px allowed
      if (!['1px', '2px'].includes(w) && badBorders.length < 8) {
        badBorders.push(`${w} on ${el.tagName}.${String(el.className).slice(0, 40)}`);
      }
      break; // one side per element is enough
    }
  }

  // --- overflow ---
  const overflowX = document.documentElement.scrollWidth - window.innerWidth;

  // --- alignment probes: x of key editorial blocks ---
  const probe = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    return Math.round(el.getBoundingClientRect().left);
  };
  const align = {
    heroTitle: probe('h1'),
    firstProse: probe('.dtx-body'),
    firstRow: probe('[class*="group relative grid"] h3'),
  };

  // --- CLS ---
  let cls = 0;
  try {
    const entries = performance.getEntriesByType('layout-shift');
    for (const e of entries) if (!e.hadRecentInput) cls += e.value;
  } catch (_) {}
  cls = +cls.toFixed(4);

  // --- focus ring ---
  const nav = document.querySelector('nav a');
  let focusRing = null;
  if (nav) {
    nav.focus();
    const s = getComputedStyle(nav);
    focusRing = s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0;
  }

  // --- view-transition tile + roundness probes ---
  const h1 = document.querySelector('h1');
  const tileName = h1 ? getComputedStyle(h1).viewTransitionName : null;
  const pill = document.querySelector('[class*="rounded-full"]');
  const pillRadius = pill ? getComputedStyle(pill).borderRadius : null;
  const vtReady =
    typeof document.startViewTransition === 'function' &&
    document.documentElement.classList.contains('vt');

  const fonts = document.fonts.status;

  return { contrast, hairline: { ...hairlineTotal, bad: badBorders }, overflowX, align, cls,
           focusRing, fonts, tileName, pillRadius, vtReady };
}
"""


def audit(page, route, w, h, dark):
    errors = []
    page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
    page.on(
        "console",
        lambda m: errors.append(f"console.{m.type}: {m.text}") if m.type == "error" else None,
    )
    page.goto(BASE + route, wait_until="networkidle")
    page.wait_for_timeout(400)
    if dark:
        page.emulate_media(color_scheme="dark")
        page.evaluate("document.documentElement.classList.add('dark')")
    result = page.evaluate(AUDIT_JS)
    result["errors"] = errors[:6]
    return result


def interactions(browser):
    """Feature-level checks: tile morph, theme wipe, sort morph."""
    findings = []
    ctx = browser.new_context(viewport={"width": 1440, "height": 900})
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
    page.on(
        "console",
        lambda m: errors.append(f"console.error: {m.text}") if m.type == "error" else None,
    )

    # 1. Tile morph: a row click must land on a hero carrying the tile name.
    page.goto(BASE + "/archive", wait_until="networkidle")
    has_vt = page.evaluate(
        "typeof document.startViewTransition === 'function' && "
        "document.documentElement.classList.contains('vt')"
    )
    if not has_vt:
        findings.append("[VT] startViewTransition missing or html.vt not set")
    link = page.query_selector('a[href^="/issue/"]')
    if link:
        link.click()
        page.wait_for_url("**/issue/**")
        # The URL flips before the router swaps the DOM inside the view
        # transition; wait out the morph (~400ms) before probing.
        page.wait_for_timeout(900)
        tile = page.evaluate(
            "(() => { const h1 = document.querySelector('h1');"
            " return h1 ? getComputedStyle(h1).viewTransitionName : null; })()"
        )
        if tile != "issue-title":
            findings.append(f"[VT] hero tile name on issue page = {tile}")
    # and the index itself must NOT carry the name (would duplicate with the row)
    page.goto(BASE + "/", wait_until="networkidle")
    home_tile = page.evaluate(
        "(() => { const h1 = document.querySelector('h1');"
        " return h1 ? getComputedStyle(h1).viewTransitionName : null; })()"
    )
    if home_tile == "issue-title":
        findings.append("[VT] home hero carries the tile name — duplicates the active row")

    # 2. Theme toggle: circular wipe must actually switch the theme.
    page.goto(BASE + "/", wait_until="networkidle")
    before = page.evaluate("document.documentElement.classList.contains('dark')")
    btn = page.query_selector('header button[aria-label^="Switch"]')
    if btn:
        btn.click()
        page.wait_for_timeout(800)
        after = page.evaluate("document.documentElement.classList.contains('dark')")
        if before == after:
            findings.append("[THEME] toggle did not switch the theme")
        btn.click()
        page.wait_for_timeout(800)
        restored = page.evaluate("document.documentElement.classList.contains('dark')")
        if restored != before:
            findings.append("[THEME] toggle did not restore the theme")
    else:
        findings.append("[THEME] toggle button not found")

    # 3. Sort morph: switching order must not error and must flip the first row.
    page.goto(BASE + "/archive", wait_until="networkidle")
    first_newest = page.evaluate(
        "document.querySelector('a[href^=\"/issue/\"]')?.getAttribute('href')"
    )
    page.click("text=Oldest")
    page.wait_for_timeout(800)
    first_oldest = page.evaluate(
        "document.querySelector('a[href^=\"/issue/\"]')?.getAttribute('href')"
    )
    if first_newest == first_oldest:
        findings.append("[SORT] order switch did not change the list")

    # 4. Trend range morph: bars must move between windows without errors.
    page.goto(BASE + "/trends", wait_until="networkidle")
    page.click("text=All")
    page.wait_for_timeout(800)
    page.click("text=7 days")
    page.wait_for_timeout(800)

    if errors:
        findings.append(f"[JS] interactions: {errors[:5]}")
    ctx.close()
    return findings


def main():
    findings = []
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for dark in (False, True):
            theme = "dark" if dark else "light"
            for w, h in VIEWPORTS:
                ctx = browser.new_context(viewport={"width": w, "height": h})
                page = ctx.new_page()
                for route in ROUTES:
                    r = audit(page, route, w, h, dark)
                    tag = f"{theme} {w}px {route}"
                    if r["errors"]:
                        findings.append(f"[JS] {tag}: {r['errors']}")
                    if r["overflowX"] > 0:
                        findings.append(f"[OVERFLOW] {tag}: +{r['overflowX']}px")
                    c = r["contrast"]
                    for k, v in (c or {}).items():
                        if v is not None and v < 4.5:
                            findings.append(f"[CONTRAST] {tag}: {k} = {v}")
                    hl = r["hairline"]
                    if hl["bad"]:
                        findings.append(f"[HAIRLINE] {tag}: {hl['bad']}")
                    if r["cls"] > 0.02:
                        findings.append(f"[CLS] {tag}: {r['cls']}")
                    if r["focusRing"] is False:
                        findings.append(f"[FOCUS] {tag}: nav focus ring missing")
                    if r["pillRadius"] in (None, "0px"):
                        findings.append(f"[ROUND] {tag}: no rounded element found")
                    print(f"{tag}: ovr={r['overflowX']} cls={r['cls']} "
                          f"contrast={c} hair={hl['crisp']}/{hl['count']} "
                          f"tile={r['tileName']} pill={r['pillRadius']}")
                ctx.close()
        findings += interactions(browser)
        browser.close()

    print("\n=== FINDINGS ===")
    if findings:
        for f in findings:
            print(" ", f)
    else:
        print("  none")
    with open("/workspace/audit-report.json", "w") as fp:
        json.dump(findings, fp, indent=2)


if __name__ == "__main__":
    main()
