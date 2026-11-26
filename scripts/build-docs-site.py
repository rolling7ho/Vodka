#!/usr/bin/env python3
#
#  build-docs-site.py
#  Gmac
#
#  This file is part of Gmac, a fork of Whisky.
#
#  Gmac is free software: you can redistribute it and/or modify it under the terms
#  of the GNU General Public License as published by the Free Software Foundation,
#  either version 3 of the License, or (at your option) any later version.
#
#  Gmac is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY;
#  without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
#  See the GNU General Public License for more details.
#
#  You should have received a copy of the GNU General Public License along with Gmac.
#  If not, see https://www.gnu.org/licenses/.
#
# Renders the repository documentation into static HTML for the GitHub Pages site.
#
# Usage: scripts/build-docs-site.py
#
# Requirements: node and npx on PATH. The Markdown converter is fetched with
# `npx --yes marked@18.3.0`, pinned so that output stays stable between runs.
# The generated HTML is committed; the tool is not required to serve the site or
# to run CI.

import html
import os
import re
import subprocess
import sys
import tempfile

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
PAGES = os.path.join(ROOT, "dist", "pages")
OUT = os.path.join(PAGES, "docs")
SITE_BASE = "https://rolling7ho.github.io/gmac"
REPO = "rolling7ho/gmac"
BRANCH = "main"
MARKED = ["npx", "--yes", "marked@18.3.0"]

DOCS = [
    # slug, title, source path, group, summary
    ("readme", "Overview", "README.md", "Project",
     "Installation, features and uninstall steps."),
    ("contributing", "Contributing", "CONTRIBUTING.md", "Project",
     "Build, test and release procedures."),
    ("security", "Security policy", "SECURITY.md", "Project",
     "Supported versions and private vulnerability reporting."),
    ("agent-manual", "Agent operating manual", "AGENTS.md", "Project",
     "Rules and procedures for automated contributors."),
    ("dependencies", "Runtime dependencies", "docs/DEPENDENCIES.md", "Guides",
     "Bundled component versions and archive digests."),
    ("release-workflow", "Release workflow", "docs/ReleaseWorkflow.md", "Guides",
     "Application releases, Sparkle feed and runtime assembly."),
    ("steam", "Steam compatibility", "docs/SteamCompatibility.md", "Guides",
     "Recommended configuration and known Steam failures."),
    ("launcher-troubleshooting", "Launcher troubleshooting", "docs/LauncherTroubleshooting.md", "Guides",
     "Epic, EA App, Battle.net, Rockstar and others."),
    ("stability", "Stability troubleshooting", "docs/StabilityTroubleshooting.md", "Guides",
     "Triage for crashes, freezes and kernel panics."),
    ("discord-bridge", "Discord bridge", "scripts/discord-bridge/README.md", "Guides",
     "Rich presence relay for games in a bottle."),
    ("runtime", "Runtime workbench", "runtime/README.md", "Runtime",
     "Local build driver and sibling engine repositories."),
]

BY_PATH = {path: slug for slug, _, path, _, _ in DOCS}

TEMPLATE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#141010" media="(prefers-color-scheme: dark)">
<title>{title} | Gmac</title>
<link rel="icon" href="../favicon-32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="../apple-touch-icon.png">
<link rel="stylesheet" href="../style.css">
<link rel="canonical" href="{site}/docs/{slug}.html">
</head>
<body>
<header class="site-header">
  <div class="wrap header-inner">
    <a class="brand" href="../index.html">
      <img src="../gmac-lockup-horizontal.svg" width="102" height="32" alt="Gmac">
    </a>
    <nav aria-label="Main">
      <a href="../index.html">Home</a>
      <a href="./">Documentation</a>
      <a href="https://github.com/{repo}">GitHub</a>
    </nav>
  </div>
</header>
<main class="wrap doc">
  <p class="doc-nav"><a href="./">Documentation</a> / {group}</p>
  <h1>{title}</h1>
{body}
</main>
<footer class="site-footer">
  <div class="wrap footer-inner">
    <p>Gmac is licensed under GPL-3.0.</p>
    <p class="muted">Source: <a href="https://github.com/{repo}/blob/{branch}/{source}">{source}</a></p>
  </div>
</footer>
</body>
</html>
"""

INDEX_TEMPLATE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#141010" media="(prefers-color-scheme: dark)">
<title>Documentation | Gmac</title>
<link rel="icon" href="../favicon-32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="../apple-touch-icon.png">
<link rel="stylesheet" href="../style.css">
<link rel="canonical" href="{site}/docs/">
</head>
<body>
<header class="site-header">
  <div class="wrap header-inner">
    <a class="brand" href="../index.html">
      <img src="../gmac-lockup-horizontal.svg" width="102" height="32" alt="Gmac">
    </a>
    <nav aria-label="Main">
      <a href="../index.html">Home</a>
      <a href="https://github.com/{repo}">GitHub</a>
    </nav>
  </div>
</header>
<main class="wrap doc">
  <h1>Documentation</h1>
  <p>Every guide in the repository, rendered from <code>main</code> at build time.</p>
{groups}
</main>
<footer class="site-footer">
  <div class="wrap footer-inner">
    <p>Gmac is licensed under GPL-3.0.</p>
    <p class="muted">Source: <a href="https://github.com/{repo}">github.com/{repo}</a></p>
  </div>
</footer>
</body>
</html>
"""


def raw_url(path):
    return f"https://raw.githubusercontent.com/{REPO}/{BRANCH}/{path}"


def blob_url(path):
    return f"https://github.com/{REPO}/blob/{BRANCH}/{path}"


def tree_url(path):
    return f"https://github.com/{REPO}/tree/{BRANCH}/{path}"


def strip_leading_hero(text):
    """Remove the centred icon and title block used at the top of some README files."""
    if not text.lstrip().startswith("<div align=\"center\">"):
        return text
    lines = text.splitlines()
    start = next(i for i, l in enumerate(lines) if l.strip() == "<div align=\"center\">")
    end = next(i for i in range(start, len(lines)) if lines[i].strip() == "</div>")
    rest = lines[end + 1:]
    while rest and rest[0].strip() in ("", "---"):
        rest.pop(0)
    return "\n".join(rest)


def drop_badges(text):
    return "\n".join(l for l in text.splitlines() if not l.lstrip().startswith("[!["))


def drop_h1(text):
    lines = text.splitlines()
    for i, line in enumerate(lines):
        if line.startswith("# "):
            del lines[i]
            while i < len(lines) and lines[i].strip() == "":
                del lines[i]
            break
    return "\n".join(lines)


def resolve_href(href, doc_path):
    """Map a relative Markdown link to a site page, or to GitHub when no page exists."""
    if href.startswith(("http://", "https://", "mailto:", "#")):
        return href
    target, _, anchor = href.partition("#")
    suffix = f"#{anchor}" if anchor else ""
    if not target:
        return href
    normalized = os.path.normpath(os.path.join(os.path.dirname(doc_path), target))
    if normalized in BY_PATH:
        return BY_PATH[normalized] + ".html" + suffix
    absolute = os.path.join(ROOT, normalized)
    if os.path.isdir(absolute):
        return tree_url(normalized) + suffix
    if os.path.exists(absolute) and normalized.endswith(".md"):
        return blob_url(normalized) + suffix
    if os.path.exists(absolute):
        return raw_url(normalized) + suffix
    return href


def rewrite_urls(body, doc_path):
    def href_repl(match):
        return f'href="{resolve_href(html.unescape(match.group(1)), doc_path)}"'

    def src_repl(match):
        src = html.unescape(match.group(1))
        if src.startswith(("http://", "https://", "data:")):
            return match.group(0)
        normalized = os.path.normpath(os.path.join(os.path.dirname(doc_path), src))
        return f'src="{raw_url(normalized)}"'

    body = re.sub(r'href="([^"]+)"', href_repl, body)
    return re.sub(r'src="([^"]+)"', src_repl, body)


def render(markdown_text, doc_path):
    with tempfile.TemporaryDirectory() as tmp:
        source = os.path.join(tmp, "in.md")
        target = os.path.join(tmp, "out.html")
        with open(source, "w", encoding="utf-8") as handle:
            handle.write(markdown_text)
        subprocess.run(MARKED + ["-i", source, "-o", target], check=True,
                       stdout=subprocess.DEVNULL)
        with open(target, encoding="utf-8") as handle:
            return handle.read()


def build_page(slug, title, path, group):
    with open(os.path.join(ROOT, path), encoding="utf-8") as handle:
        text = handle.read()
    text = strip_leading_hero(text)
    text = drop_badges(text)
    text = drop_h1(text)
    body = rewrite_urls(render(text, path), path)
    return TEMPLATE.format(title=html.escape(title), slug=slug, group=html.escape(group),
                           body=body, site=SITE_BASE, raw=raw_url("").rstrip("/"),
                           repo=REPO, branch=BRANCH, source=path)


def build_index():
    order = ["Project", "Guides", "Runtime"]
    groups = []
    for group in order:
        items = [(slug, title, summary) for slug, title, _, g, summary in DOCS if g == group]
        if not items:
            continue
        entries = "\n".join(
            f'      <li><a href="{slug}.html">{html.escape(title)}</a>: {html.escape(summary)}</li>'
            for slug, title, summary in items
        )
        groups.append(f'  <h2>{html.escape(group)}</h2>\n    <ul class="docs">\n{entries}\n    </ul>')
    return INDEX_TEMPLATE.format(groups="\n".join(groups), site=SITE_BASE,
                                 raw=raw_url("").rstrip("/"), repo=REPO)


def build_sitemap():
    urls = [f"{SITE_BASE}/", f"{SITE_BASE}/docs/"]
    urls += [f"{SITE_BASE}/docs/{slug}.html" for slug, *_ in DOCS]
    entries = "\n".join(
        f"  <url>\n    <loc>{url}</loc>\n  </url>" for url in urls
    )
    return ('<?xml version="1.0" encoding="UTF-8"?>\n'
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
            f"{entries}\n</urlset>\n")


def main():
    os.makedirs(OUT, exist_ok=True)
    for slug, title, path, group, _ in DOCS:
        page = build_page(slug, title, path, group)
        with open(os.path.join(OUT, f"{slug}.html"), "w", encoding="utf-8") as handle:
            handle.write(page)
        print(f"wrote docs/{slug}.html")
    with open(os.path.join(OUT, "index.html"), "w", encoding="utf-8") as handle:
        handle.write(build_index())
    with open(os.path.join(PAGES, "sitemap.xml"), "w", encoding="utf-8") as handle:
        handle.write(build_sitemap())
    print("wrote docs/index.html and sitemap.xml")


if __name__ == "__main__":
    try:
        subprocess.run(MARKED + ["--help"], check=True, stdout=subprocess.DEVNULL,
                       stderr=subprocess.DEVNULL)
    except (OSError, subprocess.CalledProcessError):
        sys.exit("marked is unavailable. Install node and ensure npx can fetch marked@18.3.0.")
    main()
