# TerraINT Systems — Website Roadmap

Source material: company profile deck (`TerraINT_Systems_Overview-3.pptx`) and the
LinkedIn page (founded 2025, Patel Nagar, New Delhi; tagline "Complex Problems, Smart Solutions").

Brand palette (from the deck): teal `#1F4B4C`, deep teal `#14393A`, copper `#C08552`,
cream `#F4F2EE`, sand `#DCD6C9`, ink `#2B2B28`. Logo: globe + circuit roundel.

## Phase 1 — Foundation + Home page ✅
- Plain HTML/CSS/JS, no build step — open `index.html` or serve the folder.
- Animated, interactive topographic-contour hero (canvas, cursor raises terrain).
- Illustrative live-telemetry card, capability ticker.
- Sections: About, "Signal to Decision" pipeline, Services explorer (5 lines, animated SVGs),
  Mission & Vision, Industries, Why TerraINT, Contact CTA, Footer.
- Responsive (mobile menu), keyboard-accessible tabs, reduced-motion support.

## Phase 2 — Inner pages ✅
- `services/*.html` — one detail page per service: hero with animated visual, overview,
  capabilities, process, applications, deliverables + callout, FAQ, related services, CTA.
- `about.html` — name story (Terra + INT), facts strip, emblem meaning, mission & vision,
  service index, who we serve.
- `contact.html` — enquiry form (validation, service chips pre-selected via `?service=slug`,
  spam honeypot), contact cards, OpenStreetMap embed.
- Shared nav with a Services dropdown on every page; "Explore this service" links on home.
- Pages are generated: edit `tools/content.py` (service copy) or `tools/build.py`
  (nav, footer, about, contact), then run `python tools/build.py`. It also syncs the
  header/footer into `index.html`.

### Before launch (needs client input)
- **Form delivery:** set `data-endpoint` on the form in `tools/build.py` (e.g. a Formspree URL).
  Until then, submitting opens the visitor's email app pre-filled to sales@.
- **Map pin:** `MAP_LAT` / `MAP_LON` in `tools/build.py` are provisional — need exact office location.
- **Service copy:** written from the deck + LinkedIn posts; deliverables/FAQ wording should be
  reviewed by the company.

## Phase 3 — Content & interactivity ✅
- **Insights:** `insights.html` hub (featured post, topic filter) + 9 articles in `insights/`,
  written from the topics of the company's LinkedIn posts. Generated cover art per topic.
  Each article links to its related service and to contact. Edit in `tools/insights.py`.
- **Flood risk simulator** (`js/flood-demo.js`): synthetic river valley with contours; a slider,
  presets and "play" raise the water, which spreads only where terrain connects it to the river.
  Five assets switch between safe / at risk / flooded, with live area and asset stats.
  Shown on the home page and the Flood Risk Assessment page. Clearly labelled illustrative.
- Home page gets "Latest from TerraINT" (3 newest articles); nav gets an Insights link.
- `index.html` blocks between `<!-- @demo -->` and `<!-- @insights -->` markers are filled by the build.

### Deferred — needs real material from the company
- Team section (names, roles, photos, bios).
- Case studies / projects, partner & client logos, certifications.
- Exact publish dates for articles (currently "Oct 2026").

## Phase 4 — Launch readiness ✅ (current)
- **SEO:** canonical URLs, Open Graph + Twitter cards, 1200×630 share image (`assets/og-image.png`),
  schema.org JSON-LD (Organization, WebSite, Service, Article, BreadcrumbList), `sitemap.xml`
  (18 URLs), `robots.txt`. Site URL is `BASE_URL` in `tools/build.py`.
- **Performance:** one minified CSS bundle + one JS bundle with content-hash cache busting;
  nav logo 188 KB PNG → 4 KB WebP; Google Fonts loaded without blocking render; hero terrain
  starts after load and runs at 30 fps; flood demo builds only when scrolled near; contact map
  loads only when visible. `_headers` sets long-term caching (Netlify / Cloudflare Pages).
- **Quality:** branded `404.html`; `tools/check_links.py` (744 links, headings, ids, alt text) passes;
  colour-contrast and ARIA fixes.
- **Lighthouse (mobile, local, with compression; median of 3):** Accessibility 100, Best
  Practices 100, SEO 100 on all pages checked; Performance 82–99 (flood page lowest, as it carries the demo).
- **Git:** repository initialised on `main` (not yet committed). `README.md` documents the workflow.

### Still to do to go live
- Choose a host (Netlify recommended — it can also receive the contact form) and deploy the folder.
- Point `terraintsystems.com` DNS at the host (needs the company's domain registrar login).
- Optional: privacy-friendly analytics (Plausible / Cloudflare Web Analytics).

## Open questions for the client
- Real stats (projects done, area mapped, sensors deployed) for a numbers strip?
- Phone number, full address, office photos, team bios?
- Which GIS platforms they are licensed partners for (logo usage rights)?
- Any real project/case-study images we may use?
