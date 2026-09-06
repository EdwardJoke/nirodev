#!/usr/bin/env python3
"""Capture the v12 screenshot set for Daily Tech News.

Runs in headed Chromium on the Xvfb display with SwiftShader Vulkan flags so
the landing shots carry the real WebGPU shader (headless composites WebGPU
canvases as black boxes — an upstream limitation, not a site bug).
"""

import os

os.environ["DISPLAY"] = ":99"
os.environ.setdefault("XDG_RUNTIME_DIR", "/tmp/xdg")

from playwright.sync_api import sync_playwright

BASE = "http://localhost:4173"
OUT = "/workspace/screenshots"

SHOTS = [
    ("v12-01-landing-light.png", "/", False, None, None),
    ("v12-02-landing-dark.png", "/", True, None, None),
    ("v12-03-today-light.png", "/today", False, None, None),
    ("v12-04-archive-light.png", "/archive", False, None, None),
    ("v12-05-archive-search-light.png", "/archive", False, "recurs", None),
    ("v12-06-issue-light.png", "/issue/2026-08-28", False, None, None),
    ("v12-07-issue-briefing-light.png", "/issue/2026-08-28", False, None, "brief"),
    ("v12-08-issue-dark.png", "/issue/2026-08-28", True, None, None),
    ("v12-09-topic-light.png", "/topic/ai", False, None, None),
    ("v12-10-trends-light.png", "/trends", False, None, None),
    ("v12-11-trends-dark.png", "/trends", True, None, None),
    ("v12-12-404-light.png", "/404-page", False, None, None),
    ("v12-13-mobile-landing.png", "/", False, (390, 844), None),
]

SCROLL_THROUGH = r"""
async () => {
  // Step through the page so IntersectionObserver reveals and deferred
  // markdown chunks fire before a full-page capture. `behavior: 'instant'`
  // bypasses the site's smooth-scroll so positions are actually reached.
  const step = window.innerHeight * 0.8;
  for (let y = 0; y < document.body.scrollHeight; y += step) {
    window.scrollTo({ top: y, behavior: 'instant' });
    await new Promise((r) => setTimeout(r, 120));
  }
  window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' });
  await new Promise((r) => setTimeout(r, 500));
  window.scrollTo({ top: 0, behavior: 'instant' });
  await new Promise((r) => setTimeout(r, 400));
}
"""


def main():
    os.makedirs(OUT, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=False,
            args=[
                "--no-sandbox",
                "--enable-unsafe-webgpu",
                "--enable-features=Vulkan",
                "--use-angle=vulkan",
                "--use-vulkan=swiftshader",
                "--use-webgpu-adapter=swiftshader",
                "--disable-vulkan-surface",
            ],
        )
        probe = browser.new_context()
        page = probe.new_page()
        page.goto(BASE + "/", wait_until="domcontentloaded")
        webgpu = page.evaluate(
            "navigator.gpu ? (async () => !!(await navigator.gpu.requestAdapter()))() : false"
        )
        print("webgpu adapter available:", bool(webgpu))
        probe.close()

        for name, route, dark, query, action in SHOTS:
            vp = {"width": 1440, "height": 900}
            if isinstance(query, tuple):
                vp = {"width": query[0], "height": query[1]}
            ctx = browser.new_context(viewport=vp, device_scale_factor=2)
            page = ctx.new_page()
            page.goto(BASE + route, wait_until="domcontentloaded")
            if route == "/":
                # Real shader path: wait for the canvas, then give SwiftShader
                # a few seconds of frames so the geometry is fully drawn.
                page.wait_for_selector("canvas", timeout=15000)
                page.wait_for_timeout(6500)
            try:
                page.wait_for_load_state("networkidle", timeout=10000)
            except Exception:
                pass
            page.evaluate(SCROLL_THROUGH)
            if route == "/":
                # Back at the hero: resume the loop and settle before capture.
                page.wait_for_timeout(2500)
            page.wait_for_timeout(500)
            if dark:
                page.emulate_media(color_scheme="dark")
                page.evaluate("document.documentElement.classList.add('dark')")
                page.wait_for_timeout(1500)
            if query and isinstance(query, str):
                page.fill("input[type=search]", query)
                page.wait_for_timeout(600)
            if action == "brief":
                btn = page.query_selector(".dtx-brief-toggle")
                if btn:
                    btn.click()
                    page.wait_for_timeout(500)
            page.screenshot(path=os.path.join(OUT, name), full_page=True)
            print("captured", name)
            ctx.close()
        browser.close()


if __name__ == "__main__":
    main()
