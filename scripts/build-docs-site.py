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

import fnmatch
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
MARKED = ["npx", "--yes", "marked@18.3.0", "--gfm"]

# Target locations mirrored into dist/pages/docs/.
# Adding a Markdown file to a watched folder publishes it on the next build;
# deleting a Markdown file prunes its HTML output and sitemap entry.
DOC_SOURCES = [
    # (group, base_dir, pattern, recursive)
    ("Project", ".", "README.md", False),
    ("Project", ".", "CONTRIBUTING.md", False),
    ("Project", ".", "SECURITY.md", False),
    ("Project", ".", "AGENTS.md", False),
    ("Guides", "docs", "*.md", True),
    ("Guides", "scripts", "README.md", True),
    ("Runtime", "runtime", "README.md", False),
    ("Brand", "images/brand", "README.md", False),
]

GROUP_ORDER = ["Project", "Guides", "Runtime", "Brand"]

SLUG_OVERRIDES = {
    "README.md": "readme",
    "CONTRIBUTING.md": "contributing",
    "SECURITY.md": "security",
    "AGENTS.md": "agent-manual",
    "docs/DEPENDENCIES.md": "dependencies",
    "docs/ReleaseWorkflow.md": "release-workflow",
    "docs/SteamCompatibility.md": "steam",
    "docs/LauncherTroubleshooting.md": "launcher-troubleshooting",
    "docs/StabilityTroubleshooting.md": "stability",
    "scripts/discord-bridge/README.md": "discord-bridge",
    "runtime/README.md": "runtime",
    "images/brand/README.md": "brand",
}

TITLE_OVERRIDES = {
    "README.md": "Overview",
    "CONTRIBUTING.md": "Contributing",
    "SECURITY.md": "Security policy",
    "AGENTS.md": "Agent operating manual",
    "runtime/README.md": "Runtime workbench",
}

SKIP_DIRS = {".git", ".build", "node_modules", "__pycache__"}

BRAND_SVG = """<span class="brand-viewport">
        <svg class="brand-logo" viewBox="0 0 294 92" width="102" height="32" fill="none" aria-hidden="true">
          <g class="brand-mark">
            <g transform="translate(-9 -7) scale(0.265)">
              <path class="g-play" d="M 189 183 L 217 200 L 189 217 Z" stroke-width="5" stroke-linejoin="round"/>
              <path class="g-arc" d="M 292.1 117.0 A 124 124 0 1 0 324 200 L 248 200" stroke-width="24" stroke-linecap="round" stroke-linejoin="round"/>
              <path class="g-arc" d="M 250.5 154.5 A 68 68 0 1 0 234.0 258.9" stroke-width="24" stroke-linecap="round" stroke-linejoin="round"/>
            </g>
          </g>
          <g class="brand-wordmark" stroke-width="8.5" stroke-linecap="round" stroke-linejoin="round">
            <g class="brand-letter brand-letter-m">
              <path d="M 94 36 L 94 76 M 94 53 A 17 17 0 0 1 128 53 L 128 76 M 128 53 A 17 17 0 0 1 162 53 L 162 76"/>
            </g>
            <g class="brand-letter brand-letter-a">
              <circle cx="200" cy="56" r="20"/>
              <path d="M 220 36 L 220 76"/>
            </g>
            <g class="brand-letter brand-letter-c">
              <path d="M 272.9 42.6 A 20 20 0 1 0 272.9 69.4"/>
            </g>
          </g>
        </svg>
      </span>"""


def build_nav(docs_current=False):
    current_attr = ' aria-current="page"' if docs_current else ""
    return f"""<nav aria-label="Main">
      <a class="nav-icon" href="./"{current_attr} aria-label="Documentation" title="Documentation">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="8" y1="13" x2="16" y2="13"/>
          <line x1="8" y1="17" x2="13" y2="17"/>
        </svg>
      </a>
      <a class="nav-icon" href="../index.html#start" aria-label="Install" title="Install">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
      </a>
      <a class="nav-icon" href="https://github.com/{REPO}" aria-label="GitHub" title="GitHub">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z"/>
        </svg>
      </a>
    </nav>"""


FOOTER_HTML = f"""<footer class="site-footer">
  <div class="wrap footer-grid">
    <a class="footer-logo" href="../index.html" aria-label="Gmac">
      <svg class="brand-logo" viewBox="0 0 294 92" width="115" height="36" fill="none" aria-hidden="true">
        <g transform="translate(-9 -7) scale(0.265)">
          <path class="g-play" d="M 189 183 L 217 200 L 189 217 Z" stroke-width="5" stroke-linejoin="round"/>
          <path class="g-arc" d="M 292.1 117.0 A 124 124 0 1 0 324 200 L 248 200" stroke-width="24" stroke-linecap="round" stroke-linejoin="round"/>
          <path class="g-arc" d="M 250.5 154.5 A 68 68 0 1 0 234.0 258.9" stroke-width="24" stroke-linecap="round" stroke-linejoin="round"/>
        </g>
        <g class="brand-wordmark" stroke-width="8.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M 94 36 L 94 76 M 94 53 A 17 17 0 0 1 128 53 L 128 76 M 128 53 A 17 17 0 0 1 162 53 L 162 76"/>
          <circle cx="200" cy="56" r="20"/>
          <path d="M 220 36 L 220 76"/>
          <path d="M 272.9 42.6 A 20 20 0 1 0 272.9 69.4"/>
        </g>
      </svg>
    </a>
    <nav class="footer-links" aria-label="Footer">
      <a href="./">Documentation</a>
      <span class="footer-sep" aria-hidden="true">&bull;</span>
      <a class="footer-social" href="https://github.com/{REPO}" aria-label="GitHub" title="GitHub">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z"/>
        </svg>
      </a>
      <span class="footer-sep" aria-hidden="true">&bull;</span>
      <a href="https://github.com/{REPO}/issues">Report a bug</a>
    </nav>
    <p class="footer-license">Gmac is licensed under <a class="footer-license-link" href="https://github.com/{REPO}/blob/main/LICENSE">GNU GPL v3</a>.</p>
  </div>
</footer>"""


COPY_PAGE_HTML = """<div class="copy-split-wrap">
      <div class="copy-split">
        <button class="copy-split-main" type="button" aria-label="Copy page as Markdown">
          <svg class="icon-copy" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
          <svg class="icon-check" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          <span class="copy-split-label">Copy page</span>
        </button>
        <button class="copy-split-toggle" type="button" aria-haspopup="menu" aria-expanded="false" aria-label="Copy options">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>
      </div>
      <div class="copy-menu" role="menu" aria-label="Copy page format">
        <button class="copy-menu-item" type="button" role="menuitem" data-copy-format="text">
          <span class="copy-menu-icon" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="8" y1="13" x2="16" y2="13"/>
              <line x1="8" y1="17" x2="13" y2="17"/>
            </svg>
          </span>
          <span class="copy-menu-text">
            <span class="copy-menu-title">Copy as plain text</span>
            <span class="copy-menu-desc">Clean readable text without markup</span>
          </span>
        </button>
        <button class="copy-menu-item" type="button" role="menuitem" data-copy-format="markdown">
          <span class="copy-menu-icon" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
              <rect x="2" y="5" width="20" height="14" rx="2"/>
              <path d="M6 15V9l3 3 3-3v6"/>
              <path d="M16 9v6"/>
              <path d="M14 13l2 2 2-2"/>
            </svg>
          </span>
          <span class="copy-menu-text">
            <span class="copy-menu-title">Copy as Markdown</span>
            <span class="copy-menu-desc">Raw Markdown source for LLMs</span>
          </span>
        </button>
        <button class="copy-menu-item" type="button" role="menuitem" data-copy-format="html">
          <span class="copy-menu-icon" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="16 18 22 12 16 6"/>
              <polyline points="8 6 2 12 8 18"/>
            </svg>
          </span>
          <span class="copy-menu-text">
            <span class="copy-menu-title">Copy as HTML</span>
            <span class="copy-menu-desc">Rendered HTML markup of this page</span>
          </span>
        </button>
      </div>
    </div>"""


TEMPLATE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#141010" media="(prefers-color-scheme: dark)">
<title>{title} | Gmac</title>
<link rel="icon" href="../gmac-mark.svg" type="image/svg+xml">
<link rel="icon" href="../favicon-32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="../apple-touch-icon.png">
<link rel="preload" href="../fonts/plus-jakarta-sans-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="../style.css">
<link rel="canonical" href="{site}/docs/{slug}.html">
<script src="../site.js" defer></script>
</head>
<body>
<header class="site-header">
  <div class="wrap header-inner">
    <a class="brand" href="../index.html" aria-label="Gmac">
      {brand_svg}
    </a>
    {nav}
  </div>
</header>
<main class="doc-shell doc">
  {toc}
  <article class="doc-article">
    <p class="doc-nav"><a href="./">Documentation</a> / {group}</p>
    <h1 class="doc-title">{title}</h1>
    <div class="doc-body">
{body}
    </div>
    <p class="doc-source"><a class="doc-source-link" href="https://github.com/{repo}/blob/{branch}/{source}">Mirrored from <code>{source}</code></a></p>
  </article>
  <div class="doc-actions">
    {copy_page}
  </div>
</main>
<script type="text/plain" id="doc-markdown-source">{raw_markdown}</script>
{footer}
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
<link rel="icon" href="../gmac-mark.svg" type="image/svg+xml">
<link rel="icon" href="../favicon-32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="../apple-touch-icon.png">
<link rel="preload" href="../fonts/plus-jakarta-sans-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="../style.css">
<link rel="canonical" href="{site}/docs/">
<script src="../site.js" defer></script>
</head>
<body>
<header class="site-header">
  <div class="wrap header-inner">
    <a class="brand" href="../index.html" aria-label="Gmac">
      {brand_svg}
    </a>
    {nav}
  </div>
</header>
<main class="wrap doc doc-index">
  <h1>Documentation</h1>
  <p class="doc-index-lead">Guides, runtime notes, and troubleshooting references for Gmac.</p>
{groups}
</main>
{footer}
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


def derive_slug(rel_path):
    if rel_path in SLUG_OVERRIDES:
        return SLUG_OVERRIDES[rel_path]
    stem = rel_path
    for prefix in ("docs/", "scripts/"):
        if stem.startswith(prefix):
            stem = stem[len(prefix):]
            break
    if stem.endswith("/README.md"):
        stem = stem[:-len("/README.md")]
    elif stem.endswith(".md"):
        stem = stem[:-3]
    stem = re.sub(r"([a-z0-9])([A-Z])", r"\1-\2", stem)
    stem = re.sub(r"([A-Z]+)([A-Z][a-z])", r"\1-\2", stem)
    slug = re.sub(r"[^a-z0-9]+", "-", stem.lower()).strip("-")
    return slug or "doc"


def strip_inline_markdown(text):
    text = re.sub(r"!\[([^\]]*)\]\([^)]+\)", r"\1", text)
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)
    text = re.sub(r"`([^`]+)`", r"\1", text)
    text = re.sub(r"\*\*([^*]+)\*\*", r"\1", text)
    text = re.sub(r"\*([^*]+)\*", r"\1", text)
    text = re.sub(r"<[^>]+>", "", text)
    return " ".join(text.split())


def extract_title(text, rel_path):
    if rel_path in TITLE_OVERRIDES:
        return TITLE_OVERRIDES[rel_path]
    for line in text.splitlines():
        stripped = line.strip()
        if stripped.startswith("# "):
            title = strip_inline_markdown(stripped[2:])
            if title:
                return title
    base = os.path.basename(rel_path)
    if base.lower() == "readme.md":
        base = os.path.basename(os.path.dirname(rel_path)) or "Overview"
    else:
        base = os.path.splitext(base)[0]
    base = re.sub(r"([a-z0-9])([A-Z])", r"\1 \2", base)
    return base.replace("-", " ").replace("_", " ").strip().capitalize()


def extract_summary(text):
    cleaned = drop_h1(drop_badges(strip_leading_hero(text)))
    paragraph_lines = []
    in_code = False
    for line in cleaned.splitlines():
        stripped = line.strip()
        if stripped.startswith("```"):
            in_code = not in_code
            continue
        if in_code:
            continue
        if not stripped:
            if paragraph_lines:
                candidate = " ".join(paragraph_lines)
                if not candidate.endswith(":"):
                    break
                paragraph_lines = []
            continue
        if stripped.startswith(("#", ">", "<", "|", "---", "***")):
            if paragraph_lines:
                break
            continue
        if re.match(r"^\*\*[^*]+:\*\*", stripped):
            continue
        if re.match(r"^[-*]\s+", stripped) or re.match(r"^\d+\.\s+", stripped):
            if paragraph_lines:
                break
            continue
        paragraph_lines.append(stripped)

    plain = strip_inline_markdown(" ".join(paragraph_lines))
    if not plain:
        return "Repository documentation guide."
    match = re.match(r"^(.+?[.!?])(?:\s|$)", plain)
    sentence = match.group(1) if match else plain
    if len(sentence) <= 160:
        return sentence
    return sentence[:157].rsplit(" ", 1)[0].rstrip(",;:") + "..."


def discover_docs():
    discovered = []
    seen_paths = set()
    seen_slugs = {}

    for group, base_dir, pattern, recursive in DOC_SOURCES:
        root_dir = ROOT if base_dir == "." else os.path.join(ROOT, base_dir)
        if not os.path.isdir(root_dir):
            continue

        matches = []
        if recursive:
            for dirpath, dirnames, filenames in os.walk(root_dir):
                dirnames[:] = sorted(
                    d for d in dirnames
                    if not d.startswith(".") and d not in SKIP_DIRS
                )
                for filename in sorted(filenames):
                    if fnmatch.fnmatch(filename, pattern):
                        matches.append(os.path.join(dirpath, filename))
        else:
            for filename in sorted(os.listdir(root_dir)):
                full_path = os.path.join(root_dir, filename)
                if os.path.isfile(full_path) and fnmatch.fnmatch(filename, pattern):
                    matches.append(full_path)

        for full_path in sorted(matches):
            rel_path = os.path.relpath(full_path, ROOT).replace(os.sep, "/")
            if rel_path in seen_paths:
                continue
            seen_paths.add(rel_path)

            slug = derive_slug(rel_path)
            if slug in seen_slugs:
                raise ValueError(f"Slug collision '{slug}' for {seen_slugs[slug]} and {rel_path}")
            seen_slugs[slug] = rel_path

            with open(full_path, encoding="utf-8") as handle:
                text = handle.read()
            title = extract_title(text, rel_path)
            summary = extract_summary(text)
            discovered.append((slug, title, rel_path, group, summary))

    by_path = {path: slug for slug, _, path, _, _ in discovered}
    return discovered, by_path


def resolve_href(href, doc_path, by_path):
    """Map a relative Markdown link to a site page, or to GitHub when no page exists."""
    if href.startswith(("http://", "https://", "mailto:", "#")):
        return href
    target, _, anchor = href.partition("#")
    suffix = f"#{anchor}" if anchor else ""
    if not target:
        return href
    normalized = os.path.normpath(os.path.join(os.path.dirname(doc_path), target)).replace(os.sep, "/")
    if normalized in by_path:
        return by_path[normalized] + ".html" + suffix
    absolute = os.path.join(ROOT, normalized)
    if os.path.isdir(absolute):
        return tree_url(normalized) + suffix
    if os.path.exists(absolute) and normalized.endswith(".md"):
        return blob_url(normalized) + suffix
    if os.path.exists(absolute):
        return raw_url(normalized) + suffix
    return href


def rewrite_urls(body, doc_path, by_path):
    def href_repl(match):
        return f'href="{resolve_href(html.unescape(match.group(1)), doc_path, by_path)}"'

    def src_repl(match):
        src = html.unescape(match.group(1))
        if src.startswith(("http://", "https://", "data:")):
            return match.group(0)
        normalized = os.path.normpath(os.path.join(os.path.dirname(doc_path), src)).replace(os.sep, "/")
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


ALERT_LABELS = {
    "NOTE": "Note",
    "TIP": "Tip",
    "IMPORTANT": "Important",
    "WARNING": "Warning",
    "CAUTION": "Caution",
}


def add_heading_ids(body):
    seen = {}
    headings = []

    def repl(match):
        level = int(match.group(1))
        inner = match.group(2)
        plain = html.unescape(re.sub(r"<[^>]+>", "", inner)).strip()
        slug = re.sub(r"[^a-z0-9\s-]", "", plain.lower())
        slug = re.sub(r"\s", "-", slug.strip()) or "section"
        count = seen.get(slug, 0)
        seen[slug] = count + 1
        final_slug = slug if count == 0 else f"{slug}-{count}"
        headings.append((level, final_slug, plain))
        return f'<h{level} id="{html.escape(final_slug, quote=True)}">{inner}</h{level}>'

    updated = re.sub(r"<h([2-6])>(.*?)</h\1>", repl, body, flags=re.DOTALL)
    return updated, headings


def build_toc(headings):
    if not headings:
        return '<div class="doc-toc-spacer" aria-hidden="true"></div>'
    items = "\n".join(
        f'      <li class="toc-item toc-l{level}"><a href="#{html.escape(slug, quote=True)}">{html.escape(text)}</a></li>'
        for level, slug, text in headings
    )
    return (
        '<aside class="doc-toc" aria-label="On this page">\n'
        '    <p class="toc-title">On this page</p>\n'
        '    <ul class="toc-list">\n'
        f"{items}\n"
        "    </ul>\n"
        "  </aside>"
    )


def convert_alerts(body):
    def repl(match):
        inner = match.group(1)
        alert_match = re.match(
            r"^\s*<p>\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\](?:\s*</p>\s*|(?:\s*<br\s*/?>|\s+))",
            inner,
        )
        if not alert_match:
            return match.group(0)
        kind = alert_match.group(1)
        label = ALERT_LABELS[kind]
        if alert_match.group(0).rstrip().endswith("</p>"):
            rest = inner[alert_match.end():]
        else:
            rest = "<p>" + inner[alert_match.end():]
        return (
            f'<div class="md-alert md-alert-{kind.lower()}">'
            f'<p class="md-alert-title">{label}</p>\n'
            f"{rest}</div>"
        )

    return re.sub(r"<blockquote>\s*(.*?)\s*</blockquote>", repl, body, flags=re.DOTALL)


def wrap_tables(body):
    return re.sub(r"(<table>.*?</table>)", r'<div class="table-wrap">\1</div>', body, flags=re.DOTALL)


def wrap_code_blocks(body):
    counter = 0

    def repl(match):
        nonlocal counter
        counter += 1
        code_id = f"doc-code-{counter}"
        attrs = match.group(1)
        code = match.group(2)
        return (
            f'<div class="doc-code">'
            f'<button class="copy-button" type="button" data-copy-target="{code_id}" aria-label="Copy code" title="Copy">'
            f'<svg class="icon-copy" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
            f'<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>'
            f'<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>'
            f"</svg>"
            f'<svg class="icon-check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
            f'<polyline points="20 6 9 17 4 12"/>'
            f"</svg>"
            f"</button>"
            f'<pre><code id="{code_id}"{attrs}>{code}</code></pre>'
            f"</div>"
        )

    return re.sub(r"<pre><code([^>]*)>(.*?)</code></pre>", repl, body, flags=re.DOTALL)


def enhance_markdown_html(body):
    body, headings = add_heading_ids(body)
    body = convert_alerts(body)
    body = wrap_tables(body)
    return wrap_code_blocks(body), headings


def build_page(slug, title, path, group, by_path):
    with open(os.path.join(ROOT, path), encoding="utf-8") as handle:
        raw_text = handle.read()
    text = strip_leading_hero(raw_text)
    text = drop_badges(text)
    text = drop_h1(text)
    body, headings = enhance_markdown_html(rewrite_urls(render(text, path), path, by_path))
    safe_markdown = re.sub(r"</(script)", r"<\/\1", raw_text, flags=re.IGNORECASE)
    return TEMPLATE.format(title=html.escape(title), slug=slug, group=html.escape(group),
                           body=body, toc=build_toc(headings), copy_page=COPY_PAGE_HTML,
                           raw_markdown=safe_markdown, site=SITE_BASE,
                           raw=raw_url("").rstrip("/"), repo=REPO, branch=BRANCH,
                           source=path, brand_svg=BRAND_SVG,
                           nav=build_nav(docs_current=False), footer=FOOTER_HTML)


def build_index(docs):
    groups = []
    for group in GROUP_ORDER:
        items = [(slug, title, summary) for slug, title, _, g, summary in docs if g == group]
        if not items:
            continue
        entries = "\n".join(
            f"""      <li>
        <a class="doc-card" href="{slug}.html">
          <span class="doc-card-body">
            <span class="doc-card-title">{html.escape(title)}</span>
            <span class="doc-card-summary">{html.escape(summary)}</span>
          </span>
          <svg class="doc-card-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </a>
      </li>"""
            for slug, title, summary in items
        )
        groups.append(
            f'  <section class="doc-group">\n'
            f'    <h2 class="doc-group-title">{html.escape(group)}</h2>\n'
            f'    <ul class="docs">\n{entries}\n    </ul>\n'
            f'  </section>'
        )
    return INDEX_TEMPLATE.format(groups="\n".join(groups), site=SITE_BASE,
                                 raw=raw_url("").rstrip("/"), repo=REPO,
                                 brand_svg=BRAND_SVG, nav=build_nav(docs_current=True),
                                 footer=FOOTER_HTML)


def build_sitemap(docs):
    urls = [f"{SITE_BASE}/", f"{SITE_BASE}/docs/"]
    urls += [f"{SITE_BASE}/docs/{slug}.html" for slug, *_ in docs]
    entries = "\n".join(
        f"  <url>\n    <loc>{url}</loc>\n  </url>" for url in urls
    )
    return ('<?xml version="1.0" encoding="UTF-8"?>\n'
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
            f"{entries}\n</urlset>\n")


def main():
    os.makedirs(OUT, exist_ok=True)
    docs, by_path = discover_docs()
    written = {"index.html"}

    for slug, title, path, group, _ in docs:
        page = build_page(slug, title, path, group, by_path)
        filename = f"{slug}.html"
        with open(os.path.join(OUT, filename), "w", encoding="utf-8") as handle:
            handle.write(page)
        written.add(filename)
        print(f"wrote docs/{filename}")

    for existing in sorted(os.listdir(OUT)):
        if existing.endswith(".html") and existing not in written:
            os.remove(os.path.join(OUT, existing))
            print(f"removed docs/{existing}")

    with open(os.path.join(OUT, "index.html"), "w", encoding="utf-8") as handle:
        handle.write(build_index(docs))
    with open(os.path.join(PAGES, "sitemap.xml"), "w", encoding="utf-8") as handle:
        handle.write(build_sitemap(docs))
    print("wrote docs/index.html and sitemap.xml")


if __name__ == "__main__":
    try:
        subprocess.run(MARKED + ["--help"], check=True, stdout=subprocess.DEVNULL,
                       stderr=subprocess.DEVNULL)
    except (OSError, subprocess.CalledProcessError):
        sys.exit("marked is unavailable. Install node and ensure npx can fetch marked@18.3.0.")
    main()
