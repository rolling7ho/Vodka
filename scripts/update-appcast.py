#!/usr/bin/env python3
"""Helpers for scripts/publish-update.sh.

changelog <CHANGELOG.md> <version> <notes-out>
    Renames the [Unreleased] section to [<version>] with today's date, opens a
    new empty [Unreleased] above it, and writes the section's text to notes-out.

appcast <appcast.xml> <version> <build> <url> <ed-signature> <length> <notes.md>
    Adds the update as the first item of the appcast.
"""

import datetime
import html
import re
import sys


def changelog(path, version, notes_out):
    with open(path, encoding="utf-8") as handle:
        text = handle.read()
    match = re.search(r"^## \[Unreleased\]\n(.*?)(?=^## \[)", text, re.S | re.M)
    if not match or not match.group(1).strip():
        sys.exit("CHANGELOG.md has nothing under [Unreleased] to release.")
    notes = match.group(1).strip() + "\n"
    today = datetime.date.today().isoformat()
    released = f"## [Unreleased]\n\n## [{version}] - {today}\n\n{notes}\n"
    with open(path, "w", encoding="utf-8") as handle:
        handle.write(text[: match.start()] + released + text[match.end():])
    with open(notes_out, "w", encoding="utf-8") as handle:
        handle.write(notes)


def markdown_to_html(notes):
    """Enough Markdown for changelog notes: ### headings, - lists, **bold**."""
    out, in_list = [], False
    for line in notes.splitlines():
        if line.startswith("- "):
            if in_list:
                out[-1] += "</li>"
            else:
                out.append("<ul>")
                in_list = True
            out.append(f"<li>{inline(line[2:])}")
            continue
        if line.startswith("  ") and in_list:
            out[-1] += " " + inline(line.strip())
            continue
        if in_list:
            out[-1] += "</li>"
            out.append("</ul>")
            in_list = False
        if line.startswith("### "):
            out.append(f"<h3>{inline(line[4:])}</h3>")
        elif line.strip():
            out.append(f"<p>{inline(line)}</p>")
    if in_list:
        out[-1] += "</li>"
        out.append("</ul>")
    return "\n".join(out)


def inline(text):
    text = html.escape(text, quote=False)
    text = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", text)
    return re.sub(r"`(.+?)`", r"<code>\1</code>", text)


def appcast(path, version, build, url, signature, length, notes_path):
    with open(path, encoding="utf-8") as handle:
        text = handle.read()
    with open(notes_path, encoding="utf-8") as handle:
        notes_text = handle.read()
    date = datetime.datetime.now(datetime.timezone.utc).strftime("%a, %d %b %Y %H:%M:%S +0000")
    body = markdown_to_html(notes_text).replace("]]>", "]]]]><![CDATA[>")
    esc_version = html.escape(version, quote=True)
    esc_build = html.escape(build, quote=True)
    esc_url = html.escape(url, quote=True)
    esc_signature = html.escape(signature, quote=True)
    esc_length = html.escape(length, quote=True)
    item = f"""        <item>
            <title>Gmac {esc_version}</title>
            <pubDate>{date}</pubDate>
            <sparkle:version>{esc_build}</sparkle:version>
            <sparkle:shortVersionString>{esc_version}</sparkle:shortVersionString>
            <sparkle:minimumSystemVersion>15.0</sparkle:minimumSystemVersion>
            <description><![CDATA[
{body}
            ]]></description>
            <enclosure url="{esc_url}" sparkle:edSignature="{esc_signature}" length="{esc_length}" type="application/octet-stream" />
        </item>
"""
    marker = "<!-- items -->\n"
    if marker not in text:
        sys.exit(f"{path} has no {marker.strip()} marker.")
    with open(path, "w", encoding="utf-8") as handle:
        handle.write(text.replace(marker, marker + item, 1))


if __name__ == "__main__":
    command, args = sys.argv[1], sys.argv[2:]
    {"changelog": changelog, "appcast": appcast}[command](*args)
