"""Pre-launch checks for every HTML page in the site.

- local href/src targets exist (and #anchors exist in the target page)
- each page has exactly one <h1>, no duplicate ids, and alt on every <img>

Usage: python tools/check_links.py   (exit code 1 if anything fails)
"""
import re
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit, unquote

ROOT = Path(__file__).resolve().parent.parent
SKIP_DIRS = {"tools", "docs", ".git", "node_modules"}


class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links, self.ids, self.dupes, self.h1, self.noalt = [], set(), set(), 0, 0

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if "id" in a:
            (self.dupes if a["id"] in self.ids else self.ids).add(a["id"])
        if tag == "h1":
            self.h1 += 1
        if tag == "img" and "alt" not in a:
            self.noalt += 1
        for key in ("href", "src"):
            if a.get(key) and not (tag == "link" and a.get("rel") in ("canonical", "preconnect")):
                self.links.append(a[key])


def parse(path):
    p = Page()
    p.feed(path.read_text(encoding="utf-8"))
    return p


pages = {f: parse(f) for f in ROOT.rglob("*.html") if not SKIP_DIRS & set(f.relative_to(ROOT).parts)}
errors = []
for f, p in pages.items():
    rel = f.relative_to(ROOT)
    if p.h1 != 1 and f.name != "404.html" or p.h1 == 0:
        errors.append(f"{rel}: {p.h1} <h1> elements")
    if p.dupes:
        errors.append(f"{rel}: duplicate ids {sorted(p.dupes)}")
    if p.noalt:
        errors.append(f"{rel}: {p.noalt} <img> without alt")
    for link in p.links:
        u = urlsplit(link)
        if u.scheme or link.startswith(("mailto:", "tel:", "//")):
            continue
        path = unquote(u.path)
        if not path:  # same-page anchor
            target = f
        elif path.startswith("/"):
            target = ROOT / path.lstrip("/")
        else:
            target = (f.parent / path).resolve()
        if target.is_dir():
            target = target / "index.html"
        if not target.exists():
            errors.append(f"{rel}: broken link {link}")
            continue
        if u.fragment and target.suffix == ".html" and target in pages and u.fragment not in pages[target].ids:
            errors.append(f"{rel}: missing anchor #{u.fragment} in {target.relative_to(ROOT)}")

print(f"checked {len(pages)} pages, {sum(len(p.links) for p in pages.values())} links")
for e in errors:
    print("  ✗", e)
print("all good" if not errors else f"{len(errors)} problem(s)")
sys.exit(1 if errors else 0)
