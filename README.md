# TerraINT Systems — website

Static marketing site for **TerraINT Systems Pvt. Ltd.** (geospatial intelligence, IoT sensing,
satellite products, GIS licensing, topographic survey, flood risk assessment).

Plain HTML/CSS/JS — no framework, no npm dependencies. A small Python script generates the
inner pages and production bundles.

## Structure

| Path | What it is |
|---|---|
| `index.html` | Home page (hand-written; header, footer and marked blocks are synced by the build) |
| `services/`, `insights/`, `about.html`, `contact.html`, `insights.html`, `404.html` | **Generated** — don't edit by hand |
| `css/styles.css`, `css/pages.css` | Source styles → bundled into `css/site.min.css` |
| `js/terrain.js`, `js/flood-demo.js`, `js/main.js` | Source scripts → bundled into `js/site.js` |
| `assets/` | Logo (master + optimized WebP), favicon, social share image |
| `tools/content.py` | Service page copy |
| `tools/insights.py` | Insights articles |
| `tools/build.py` | Page generator, bundler, sitemap/robots, company facts (emails, address, map pin, site URL) |
| `tools/make_assets.py` | Regenerates logos and `og-image.png` (needs Pillow) |
| `tools/check_links.py` | Pre-launch checks: broken links/anchors, one `h1` per page, duplicate ids, missing `alt` |
| `docs/ROADMAP.md` | Phases, decisions and open items |

## Workflow

```bash
python tools/build.py          # after any change to content, CSS, JS or index.html
python tools/check_links.py    # before deploying
python -m http.server 5510     # preview at http://localhost:5510
```

## Deploying

The project folder is the site root — deploy it as-is (no build command needed on the host,
because the generated files are committed). Works on Netlify, Cloudflare Pages, Vercel or
GitHub Pages; all of them serve `404.html` for missing pages and compress files automatically.
`_headers` adds long-term caching on Netlify / Cloudflare Pages.

If the domain changes, update `BASE_URL` in `tools/build.py` and rebuild (it drives canonical
URLs, the sitemap and social share cards).

## Before launch

See "Before launch" in `docs/ROADMAP.md`: form delivery endpoint, exact map pin, and a
content review by the company.
