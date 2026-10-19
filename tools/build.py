"""Static page builder for the TerraINT Systems site.

Generates the inner pages (services/*.html, about.html, contact.html) from
shared partials + tools/content.py, and syncs the shared header/footer into
index.html so navigation stays identical everywhere.

Usage (from the project folder):  python tools/build.py
"""
import datetime
import hashlib
import html
import json
import re
from pathlib import Path

from content import SERVICES
from insights import ARTICLES, CATEGORIES

ROOT = Path(__file__).resolve().parent.parent

# --- Company facts (edit here) ---------------------------------------------
SALES = "sales@terraintsystems.com"
INFO = "info@terraintsystems.com"
LINKEDIN = "https://www.linkedin.com/company/terraint-systems-pvt-ltd/"
ADDRESS = "Janakpuri Road, Patel Nagar, New Delhi 110064, India"
# Provisional map pin — replace with the exact office coordinates.
MAP_LAT, MAP_LON = 28.6406, 77.1086

# Where the contact form posts. "" = open the visitor's email app pre-filled (works anywhere).
# Vercel: paste a form-service URL, e.g. "https://formspree.io/f/abcdwxyz".  Netlify: use "/".
FORM_ENDPOINT = ""

# Production address of the site (used for canonical URLs, sitemap, social cards).
BASE_URL = "https://terraintsystems.com/"
OG_IMAGE = BASE_URL + "assets/og-image.png"
FONTS = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&family=Space+Grotesk:wght@400;500;600;700&display=swap"
VERSION = "dev"  # replaced by a content hash of the bundles in bundle()

ORG = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": BASE_URL + "#org",
    "name": "TerraINT Systems Pvt. Ltd.",
    "alternateName": "TerraINT",
    "url": BASE_URL,
    "logo": BASE_URL + "assets/logo.png",
    "slogan": "Transforming Data into Decisions",
    "foundingDate": "2025",
    "email": INFO,
    "address": {"@type": "PostalAddress", "streetAddress": "Janakpuri Road, Patel Nagar",
                "addressLocality": "New Delhi", "postalCode": "110064", "addressCountry": "IN"},
    "contactPoint": [{"@type": "ContactPoint", "contactType": "sales", "email": SALES}],
    "sameAs": [LINKEDIN],
}
ORG_REF = {"@id": BASE_URL + "#org"}


def breadcrumbs_ld(*trail):
    items = [("Home", BASE_URL)] + [(n, BASE_URL + p) for n, p in trail]
    return {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": i + 1, "name": n, "item": u} for i, (n, u) in enumerate(items)]}

ARROW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>'
CHEVRON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M6 9l6 6 6-6"/></svg>'
GO = '<span class="go" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg></span>'


PAGES = []  # every generated URL path, for sitemap.xml


def jsonld(*objs):
    return "".join(
        f'\n  <script type="application/ld+json">{json.dumps(o, ensure_ascii=False, separators=(",", ":"))}</script>'
        for o in objs
    )


def head(title, desc, r, path, schema=(), og_type="website", index=True):
    """`path` is the page's URL path relative to the site root ("" for home)."""
    url = BASE_URL + path
    if index:
        PAGES.append(path)
    robots = "" if index else '\n  <meta name="robots" content="noindex">'
    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{title}</title>
  <meta name="description" content="{html.escape(desc)}">
  <meta name="theme-color" content="#14393a">{robots}
  <link rel="canonical" href="{url}">
  <meta property="og:type" content="{og_type}">
  <meta property="og:site_name" content="TerraINT Systems">
  <meta property="og:title" content="{title}">
  <meta property="og:description" content="{html.escape(desc)}">
  <meta property="og:url" content="{url}">
  <meta property="og:image" content="{OG_IMAGE}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="icon" type="image/png" href="{r}assets/favicon.png">
  <link rel="apple-touch-icon" href="{r}assets/apple-touch-icon.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="preload" as="style" href="{FONTS}" onload="this.onload=null;this.rel='stylesheet'">
  <noscript><link rel="stylesheet" href="{FONTS}"></noscript>
  <link rel="stylesheet" href="{r}css/site.min.css?v={VERSION}">{jsonld(*schema)}
</head>
<body>
"""


def nav(r, current=""):
    def cur(key):
        return ' aria-current="page"' if key == current else ""

    items = "\n".join(
        f'        <a href="{r}services/{s["slug"]}.html"{cur(s["slug"])}><span class="n">{s["num"]}</span>'
        f'<span><b>{s["title"]}</b><small>{s["short"]}</small></span></a>'
        for s in SERVICES
    )
    svc_current = " current" if current in {s["slug"] for s in SERVICES} else ""
    return f"""<header class="nav" id="nav">
  <div class="wrap">
    <a href="{r}index.html" class="brand" aria-label="TerraINT Systems home">
      <img src="{r}assets/logo-84.webp" alt="" width="42" height="42">
      <span class="brand-text"><b>Terra<span>INT</span></b><small>SYSTEMS PVT. LTD.</small></span>
    </a>
    <nav class="nav-links" id="navLinks" aria-label="Primary">
      <a href="{r}about.html"{cur("about")}>About</a>
      <div class="nav-drop{svc_current}">
        <button class="drop-btn" type="button" aria-expanded="false" aria-controls="dropMenu">Services {CHEVRON}</button>
        <div class="drop-menu" id="dropMenu">
{items}
        </div>
      </div>
      <a href="{r}index.html#industries">Industries</a>
      <a href="{r}insights.html"{cur("insights")}>Insights</a>
      <a href="{r}contact.html" class="btn btn-primary"{cur("contact")}>Let's talk</a>
    </nav>
    <button class="menu-btn" id="menuBtn" aria-label="Open menu" aria-expanded="false" aria-controls="navLinks"><span></span></button>
  </div>
</header>"""


def footer(r):
    links = "\n".join(f'          <li><a href="{r}services/{s["slug"]}.html">{s["title"]}</a></li>' for s in SERVICES)
    return f"""<footer class="footer">
  <div class="wrap">
    <div class="foot-grid">
      <div>
        <a href="{r}index.html" class="brand"><img src="{r}assets/logo-84.webp" alt="" width="42" height="42"><span class="brand-text"><b>Terra<span>INT</span></b><small>SYSTEMS PVT. LTD.</small></span></a>
        <p>Terrain intelligence and geospatial consultancy — turning data into decisions.</p>
        <ul style="margin-top:16px">
          <li><a href="{r}about.html">About us</a></li>
          <li><a href="{r}insights.html">Insights</a></li>
          <li><a href="{r}contact.html">Contact</a></li>
        </ul>
      </div>
      <div>
        <h2 class="foot-h">SERVICES</h2>
        <ul>
{links}
        </ul>
      </div>
      <div>
        <h2 class="foot-h">CONNECT</h2>
        <ul>
          <li><a href="mailto:{SALES}">{SALES}</a></li>
          <li><a href="mailto:{INFO}">{INFO}</a></li>
          <li><a href="{LINKEDIN}" target="_blank" rel="noopener">LinkedIn ↗</a></li>
          <li>Patel Nagar, New Delhi, India</li>
        </ul>
      </div>
    </div>
    <div class="foot-base">
      <span>© <span id="year">2026</span> TerraINT Systems Pvt. Ltd. All rights reserved.</span>
      <span>From data to intelligence. From intelligence to action.</span>
    </div>
  </div>
</footer>"""


def scripts(r, demo=False):
    # One bundle for every page; flood-demo.js exits early where there is no demo.
    return f"""
<script src="{r}js/site.js?v={VERSION}"></script>
</body>
</html>
"""


def cta_band(r, text="Have a site, catchment or project in mind?", service=""):
    q = f"?service={service}" if service else ""
    return f"""<section class="section cta-band">
  <div class="wrap">
    <h2>{text}</h2>
    <a class="btn btn-dark" href="{r}contact.html{q}">Start a conversation {ARROW}</a>
  </div>
</section>"""


def crumbs(r, *trail):
    parts = [f'<a href="{r}index.html">Home</a>']
    for label, href in trail:
        parts.append('<span aria-hidden="true">/</span>')
        parts.append(f'<a href="{href}">{label}</a>' if href else f'<span aria-current="page">{label}</span>')
    return f'<nav class="crumbs" aria-label="Breadcrumb">{"".join(parts)}</nav>'


def service_svgs():
    """Reuse the animated service illustrations from the home page explorer."""
    src = (ROOT / "index.html").read_text(encoding="utf-8")
    out = {}
    for i in range(1, 6):
        m = re.search(rf'id="svc-{i}".*?(<svg viewBox.*?</svg>)', src, re.S)
        out[i] = m.group(1) if m else ""
    return out


# ---------------------------------------------------------------------------
def build_service(s, svgs):
    r = "../"
    i = int(s["num"])
    cap = "\n".join(
        f'      <article class="cap reveal" style="--d:{(k % 3) * .06:.2f}s"><span class="no">{k + 1:02d}</span><h3>{t}</h3><p>{d}</p></article>'
        for k, (t, d) in enumerate(s["capabilities"])
    )
    proc = "\n".join(f"      <li><h3>{t}</h3><p>{d}</p></li>" for t, d in s["process"])
    apps = "\n".join(f'      <div class="app"><h3>{t}</h3><p>{d}</p></div>' for t, d in s["applications"])
    hl = "\n".join(f"          <li>{h}</li>" for h in s["highlights"])
    deliv = "\n".join(f"          <li>{d}</li>" for d in s["deliverables"])
    flow = "".join(f"<span>{f}</span>" for f in s["callout"]["flow"])
    faqs = "\n".join(
        f'        <details{" open" if k == 0 else ""}><summary>{q}</summary><p>{a}</p></details>'
        for k, (q, a) in enumerate(s["faqs"])
    )
    related = "\n".join(
        f'      <a class="rel" href="{o["slug"]}.html"><div><span class="n">{o["num"]}</span><br><b>{o["title"]}</b><small>{o["short"]}</small></div>{GO}</a>'
        for o in SERVICES if o is not s
    )
    overview = "\n".join(f'      <p class="lede">{p}</p>' for p in s["overview"])
    demo = flood_demo() if s["slug"] == "flood-risk-assessment" else ""

    page = head(f'{s["title"]} — TerraINT Systems', s["meta"], r, f'services/{s["slug"]}.html', schema=(
        {"@context": "https://schema.org", "@type": "Service", "name": s["title"], "description": s["meta"],
         "serviceType": s["title"], "provider": ORG_REF, "url": f'{BASE_URL}services/{s["slug"]}.html'},
        breadcrumbs_ld(("Services", "index.html#services"), (s["title"], f'services/{s["slug"]}.html')))) + nav(r, s["slug"]) + f"""

<main id="top">
<section class="page-hero">
  <canvas id="terrain" aria-hidden="true"></canvas>
  <div class="wrap">
    <div>
      {crumbs(r, ("Services", r + "index.html#services"), (s["title"], ""))}
      <span class="eyebrow">Core service {s["num"]}</span>
      <h1>{s["h1"]}</h1>
      <p class="hero-sub">{s["lead"]}</p>
      <div class="hero-cta">
        <a href="{r}contact.html?service={s["slug"]}" class="btn btn-primary">Discuss your project {ARROW}</a>
        <a href="#capabilities" class="btn btn-ghost">What's included</a>
      </div>
    </div>
    <div class="hero-visual"><span class="tag">SERVICE / {s["num"]}</span>
      {svgs[i]}
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap overview">
    <div class="reveal">
      <span class="eyebrow">Overview</span>
      <h2 class="h2">{s["overview_title"]}</h2>
{overview}
    </div>
    <aside class="highlights reveal" style="--d:.1s">
      <h3>// AT A GLANCE</h3>
      <ul class="ticks">
{hl}
      </ul>
    </aside>
  </div>
</section>

<section class="section" id="capabilities" style="padding-top:0">
  <div class="wrap">
    <div class="sec-head reveal">
      <div><span class="eyebrow">Capabilities</span><h2 class="h2">{s["cap_title"]}</h2></div>
      <p class="lede">{s["cap_lede"]}</p>
    </div>
    <div class="cap-grid">
{cap}
    </div>
  </div>
</section>

<section class="section dark">
  <div class="wrap">
    <div class="sec-head reveal">
      <div><span class="eyebrow">How it works</span><h2 class="h2">Our <em>process.</em></h2></div>
    </div>
    <ol class="proc reveal" style="--steps:{len(s["process"])}">
{proc}
    </ol>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <div class="sec-head reveal">
      <div><span class="eyebrow">Applications</span><h2 class="h2">Where it <em>helps.</em></h2></div>
    </div>
    <div class="app-grid reveal">
{apps}
    </div>
  </div>
</section>

<section class="section" style="padding-top:0">
  <div class="wrap deliv-grid">
    <div class="deliv reveal">
      <span class="eyebrow">Deliverables</span>
      <h3>What you receive</h3>
      <ul class="ticks">
{deliv}
      </ul>
    </div>
    <div class="callout reveal" style="--d:.1s">
      <span class="eyebrow">{s["callout"]["eyebrow"]}</span>
      <h3>{s["callout"]["title"]}</h3>
      <p>{s["callout"]["text"]}</p>
      <div class="flow">{flow}</div>
    </div>
  </div>
</section>

{demo}
<section class="section"{"" if demo else ' style="padding-top:0"'}>
  <div class="wrap faq-wrap">
    <div class="reveal">
      <span class="eyebrow">FAQ</span>
      <h2 class="h2">Common <em>questions.</em></h2>
      <p class="lede" style="margin-top:16px">Something else on your mind? <a href="{r}contact.html?service={s["slug"]}" style="color:var(--copper);font-weight:600">Ask us directly →</a></p>
    </div>
    <div class="faq reveal">
{faqs}
    </div>
  </div>
</section>

<section class="section" style="padding-top:0">
  <div class="wrap">
    <div class="sec-head reveal"><div><span class="eyebrow">Related services</span><h2 class="h2">One partner, <em>the full picture.</em></h2></div></div>
    <div class="related reveal">
{related}
    </div>
  </div>
</section>

{cta_band(r, "Let's scope your " + s["title"].lower() + " project.", s["slug"])}
</main>

""" + footer(r) + scripts(r, demo=bool(demo))
    out = ROOT / "services" / f'{s["slug"]}.html'
    out.parent.mkdir(exist_ok=True)
    out.write_text(page, encoding="utf-8")
    return out


# ---------------------------------------------------------------------------
def build_about():
    r = ""
    rows = "\n".join(
        f'      <a class="svc-row" href="services/{s["slug"]}.html"><span class="n">{s["num"]}</span><b>{s["title"]}</b><span class="d">{s["lead"].split(" — ")[0]}</span>{GO}</a>'
        for s in SERVICES
    )
    page = head("About — TerraINT Systems", "TerraINT Systems Pvt. Ltd. is a New Delhi terrain-intelligence and geospatial consultancy, founded in 2025, turning geospatial and environmental data into decisions.", r, "about.html",
                schema=(ORG, breadcrumbs_ld(("About", "about.html")))) + nav(r, "about") + f"""

<main id="top">
<section class="page-hero">
  <canvas id="terrain" aria-hidden="true"></canvas>
  <div class="wrap">
    <div>
      {crumbs(r, ("About", ""))}
      <span class="eyebrow">About TerraINT</span>
      <h1>Terrain intelligence, <em>built for decisions.</em></h1>
      <p class="hero-sub">We are a geospatial and environmental consultancy from New Delhi, bringing sensors, satellites, software and surveyors together so organizations can see what is happening on the ground — and act on it.</p>
      <div class="hero-cta">
        <a href="#services" class="btn btn-primary">What we do {ARROW}</a>
        <a href="contact.html" class="btn btn-ghost">Get in touch</a>
      </div>
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap overview">
    <div class="reveal">
      <span class="eyebrow">Our name</span>
      <div class="name-split" aria-label="Terra plus INT">
        <span class="t">Terra<small>THE GROUND</small></span><span class="i">INT<small>INTELLIGENCE</small></span>
      </div>
      <p class="lede">TerraINT stands for <strong>Terrain Intelligence</strong>. The ground beneath every project — its levels, water, soil, assets and the way it changes — holds the answers to many decisions. Our job is to read it accurately and turn it into intelligence people can use.</p>
      <p class="lede" style="margin-top:16px">Founded in 2025, TerraINT Systems Pvt. Ltd. delivers terrain intelligence and consultancy services with a global outlook.</p>
    </div>
    <aside class="highlights reveal" style="--d:.1s">
      <h3>// HOW WE WORK</h3>
      <ul class="ticks">
        <li><span><strong>Multi-domain coverage</strong> — IoT, satellite, GIS, survey and risk assessment under one roof.</span></li>
        <li><span><strong>Field-tested methods</strong> — built on established geospatial and hydrological practice.</span></li>
        <li><span><strong>Decision-oriented output</strong> — every dataset is structured to lead to a usable decision.</span></li>
        <li><span><strong>Customized solutions</strong> — domain knowledge applied to your specific site and question.</span></li>
      </ul>
    </aside>
  </div>
</section>

<section class="section" style="padding-top:0">
  <div class="wrap">
    <div class="facts reveal">
      <div class="fact"><b>2025</b><span>Founded</span></div>
      <div class="fact"><b>New Delhi</b><span>Headquarters, India</span></div>
      <div class="fact"><b>5</b><span>Core service lines</span></div>
      <div class="fact"><b>1 roof</b><span>Sensing, imagery, GIS &amp; survey</span></div>
    </div>
  </div>
</section>

<section class="section dark">
  <div class="wrap emblem">
    <div class="emblem-img reveal"><img src="assets/logo-480.webp" alt="TerraINT emblem: half globe, half circuit board" width="240" height="240"></div>
    <div class="reveal" style="--d:.1s">
      <span class="eyebrow">Our emblem</span>
      <h2 class="h2" style="margin-bottom:28px">Where the Earth <em>meets the circuit.</em></h2>
      <div class="emblem-keys">
        <div><i style="background:#2e6663"></i><div><h3>The terrain half</h3><p>Continents drawn as contour layers — the physical world we survey, sense and model.</p></div></div>
        <div><i style="background:#c08552"></i><div><h3>The circuit half</h3><p>Copper traces and nodes — the sensors, networks and analytics that turn it into data.</p></div></div>
        <div><i style="background:#d8e6e2"></i><div><h3>One line between them</h3><p>The point where field observation becomes digital intelligence. That line is where we work.</p></div></div>
      </div>
    </div>
  </div>
</section>

<section class="section mv">
  <div class="wrap">
    <div class="reveal"><span class="eyebrow">Mission &amp; vision</span><h2 class="h2">What we work <em>toward.</em></h2></div>
    <div class="mv-grid">
      <article class="mv-card reveal"><h3>// MISSION</h3><p>To empower organizations with cutting-edge geospatial and environmental solutions that bridge the gap between raw data and real-world impact.</p><span class="big" aria-hidden="true">M</span></article>
      <article class="mv-card reveal" style="--d:.15s"><h3>// VISION</h3><p>A future where communities, businesses and governments make decisions backed by accurate, timely and location-aware intelligence.</p><span class="big" aria-hidden="true">V</span></article>
    </div>
  </div>
</section>

<section class="section" id="services">
  <div class="wrap">
    <div class="sec-head reveal"><div><span class="eyebrow">What we do</span><h2 class="h2">Five service lines. <em>One spatial picture.</em></h2></div></div>
    <div class="svc-list reveal">
{rows}
    </div>
  </div>
</section>

<section class="section" style="padding-top:0">
  <div class="wrap">
    <div class="sec-head reveal"><div><span class="eyebrow">Who we serve</span><h2 class="h2">Built for those who <em>decide on the ground.</em></h2></div></div>
    <div class="audience">
      <article class="aud reveal"><svg viewBox="0 0 24 24"><path d="M3 21h18M4 21V10l8-6 8 6v11M9 21v-6h6v6"/></svg><h3>Governments</h3><p>Planning, disaster management, drainage and resilience programmes that need accurate, location-aware evidence.</p></article>
      <article class="aud reveal" style="--d:.08s"><svg viewBox="0 0 24 24"><path d="M3 21V10l6 4V10l6 4V4h6v17z"/></svg><h3>Businesses</h3><p>Power, manufacturing, infrastructure, mining and logistics operators protecting assets and planning projects.</p></article>
      <article class="aud reveal" style="--d:.16s"><svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6M14.5 14.5c3.5-.5 6.5 1.5 6.5 5"/></svg><h3>Communities</h3><p>Better preparedness and smarter resource management for a more resilient, sustainable tomorrow.</p></article>
    </div>
  </div>
</section>

{cta_band(r, "Let's turn your data into decisions.")}
</main>

""" + footer(r) + scripts(r)
    (ROOT / "about.html").write_text(page, encoding="utf-8")


# ---------------------------------------------------------------------------
def build_contact():
    r = ""
    chips = "\n".join(
        f'            <label><input type="checkbox" name="services" value="{s["title"]}" data-slug="{s["slug"]}"><span>{s["title"]}</span></label>'
        for s in SERVICES
    )
    d = 0.012
    bbox = f"{MAP_LON - d * 1.6},{MAP_LAT - d},{MAP_LON + d * 1.6},{MAP_LAT + d}"
    page = head("Contact — TerraINT Systems", "Contact TerraINT Systems for IoT sensing, satellite products, GIS licensing, topographic survey and flood risk assessment.", r, "contact.html",
                schema=(ORG, breadcrumbs_ld(("Contact", "contact.html")))) + nav(r, "contact") + f"""

<main id="top">
<section class="page-hero">
  <canvas id="terrain" aria-hidden="true"></canvas>
  <div class="wrap">
    <div>
      {crumbs(r, ("Contact", ""))}
      <span class="eyebrow">Get in touch</span>
      <h1>Let's map what <em>matters to you.</em></h1>
      <p class="hero-sub">Tell us about your site, catchment or project. We'll come back with how sensing, imagery and analysis can answer your question.</p>
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap contact-grid">
    <div class="form-card reveal">
      <h2>Send an enquiry</h2>
      <p>Fields marked optional can be skipped. Everything else helps us reply with something useful.</p>
      <!-- data-endpoint comes from FORM_ENDPOINT in tools/build.py; the Netlify attributes are
           ignored by other hosts. -->
      <form id="contactForm" name="contact" method="POST" data-netlify="true" netlify-honeypot="_gotcha"
            data-endpoint="{FORM_ENDPOINT}" data-mailto="{SALES}" novalidate>
        <input type="hidden" name="form-name" value="contact">
        <div class="fields">
          <div class="field"><label for="f-name">Full name</label><input id="f-name" name="name" autocomplete="name" required><span class="err">Please enter your name.</span></div>
          <div class="field"><label for="f-org">Organization <span class="opt">(optional)</span></label><input id="f-org" name="organization" autocomplete="organization"></div>
          <div class="field"><label for="f-email">Work email</label><input id="f-email" name="email" type="email" autocomplete="email" required><span class="err">Please enter a valid email address.</span></div>
          <div class="field"><label for="f-phone">Phone <span class="opt">(optional)</span></label><input id="f-phone" name="phone" type="tel" autocomplete="tel"></div>
          <fieldset class="field full" style="border:0;padding:0;margin:0">
            <legend style="font-size:.82rem;font-weight:600;margin-bottom:7px">What are you interested in? <span class="opt" style="font-weight:400;color:var(--muted)">(optional)</span></legend>
            <div class="chips">
{chips}
            </div>
          </fieldset>
          <div class="field full"><label for="f-msg">Tell us about your project</label><textarea id="f-msg" name="message" required placeholder="Location, the question you need answered, timelines…"></textarea><span class="err">Please add a short description.</span></div>
          <input class="hp" type="text" name="_gotcha" tabindex="-1" autocomplete="off" aria-hidden="true">
        </div>
        <div class="form-foot">
          <small>We use your details only to respond to this enquiry.</small>
          <button class="btn btn-primary" type="submit">Send enquiry {ARROW}</button>
        </div>
        <div class="form-status" id="formStatus" role="status" aria-live="polite"></div>
      </form>
    </div>

    <aside class="info-stack">
      <a class="info reveal" href="mailto:{SALES}"><span class="ico"><svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg></span><span><small>Sales &amp; projects</small><b>{SALES}</b><p>New projects, quotes and licensing.</p></span></a>
      <a class="info reveal" style="--d:.06s" href="mailto:{INFO}"><span class="ico"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v5h1"/></svg></span><span><small>General</small><b>{INFO}</b><p>Partnerships, careers and everything else.</p></span></a>
      <a class="info reveal" style="--d:.12s" href="{LINKEDIN}" target="_blank" rel="noopener"><span class="ico"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 10v7M8 7v.01M12 17v-4a2 2 0 014 0v4M12 10v7"/></svg></span><span><small>Follow</small><b>LinkedIn ↗</b><p>Insights on GIS, IoT, flood risk and more.</p></span></a>
      <div class="info reveal" style="--d:.18s"><span class="ico"><svg viewBox="0 0 24 24"><path d="M12 21s-7-6.2-7-11a7 7 0 0114 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></svg></span><span><small>Office</small><b>New Delhi, India</b><p>{ADDRESS}</p></span></div>
      <div class="map-card reveal" style="--d:.24s">
        <iframe title="Map showing TerraINT Systems office area in New Delhi" loading="lazy"
          data-src="https://www.openstreetmap.org/export/embed.html?bbox={bbox}&amp;layer=mapnik&amp;marker={MAP_LAT},{MAP_LON}"></iframe>
        <a href="https://www.openstreetmap.org/?mlat={MAP_LAT}&amp;mlon={MAP_LON}#map=15/{MAP_LAT}/{MAP_LON}" target="_blank" rel="noopener">Open larger map ↗</a>
      </div>
    </aside>
  </div>
</section>
</main>

""" + footer(r) + scripts(r)
    (ROOT / "contact.html").write_text(page, encoding="utf-8")


# ---------------------------------------------------------------------------
# Insights
# ---------------------------------------------------------------------------
SERVICE_BY_SLUG = {s["slug"]: s for s in SERVICES}


def read_time(a):
    words = 0
    for kind, val in a["body"]:
        words += sum(len(v.split()) for v in val) if isinstance(val, list) else len(val.split())
    return max(2, round(words / 200))


def cover(a, idx):
    """Generative SVG cover: contour rings + a motif for the article's category."""
    import random
    rnd = random.Random(a["slug"])
    cx, cy = rnd.randint(90, 310), rnd.randint(50, 190)
    rings = "".join(
        f'<ellipse cx="{cx}" cy="{cy}" rx="{28 + k * 26 + rnd.randint(0, 8)}" ry="{18 + k * 17 + rnd.randint(0, 6)}" '
        f'transform="rotate({rnd.randint(-25, 25)} {cx} {cy})" fill="none" stroke="{"#c08552" if k % 3 == 2 else "#8fb8b2"}" '
        f'stroke-opacity="{.55 if k % 3 == 2 else .22}" stroke-width="{1.4 if k % 3 == 2 else 1}"/>'
        for k in range(8)
    )
    motif = {
        "flood": '<path d="M0 190q25-10 50 0t50 0 50 0 50 0 50 0 50 0 50 0 50 0 50 0v60H0z" fill="#c08552" fill-opacity=".3" stroke="#c08552" stroke-width="2"/>'
                 '<path d="M0 210q25-10 50 0t50 0 50 0 50 0 50 0 50 0 50 0 50 0 50 0" fill="none" stroke="#e0b68f" stroke-opacity=".5" stroke-width="1.5"/>',
        "iot": '<path d="M300 60h40v50h30M300 60v-20M340 110v40" fill="none" stroke="#c08552" stroke-width="1.6"/>'
               '<circle cx="300" cy="40" r="5" fill="#c08552"/><circle cx="370" cy="110" r="5" fill="#c08552"/><circle cx="340" cy="150" r="5" fill="#c08552"/>'
               '<path d="M318 30a26 26 0 010 36M330 20a42 42 0 010 56" fill="none" stroke="#e0b68f" stroke-width="1.6"/>',
        "satellite": '<ellipse cx="200" cy="120" rx="190" ry="60" fill="none" stroke="#8fb8b2" stroke-dasharray="4 6" stroke-opacity=".6"/>'
                     '<g transform="translate(330 78) rotate(-12)"><rect x="-7" y="-7" width="14" height="14" fill="#c08552"/><rect x="-30" y="-4" width="20" height="8" fill="#2e6663" stroke="#8fb8b2"/><rect x="10" y="-4" width="20" height="8" fill="#2e6663" stroke="#8fb8b2"/></g>'
                     '<path d="M330 86l-40 110h80z" fill="#c08552" fill-opacity=".12"/>',
        "gis": '<g fill-opacity=".85" stroke="#8fb8b2"><path d="M310 150l70 20-70 20-70-20z" fill="#14393a"/><path d="M310 120l70 20-70 20-70-20z" fill="#1f4b4c"/><path d="M310 90l70 20-70 20-70-20z" fill="#2e6663"/></g>'
               '<circle cx="296" cy="104" r="4" fill="#c08552"/><circle cx="326" cy="112" r="4" fill="#c08552"/>',
        "survey": '<path d="M70 120l-24 80M70 120v80M70 120l24 80" stroke="#8fb8b2" stroke-width="1.6" fill="none"/><rect x="56" y="100" width="28" height="20" rx="3" fill="#2e6663" stroke="#8fb8b2"/>'
                  '<path d="M84 108L330 70" stroke="#c08552" stroke-width="1.6" stroke-dasharray="5 6"/><circle cx="330" cy="70" r="5" fill="#c08552"/>',
    }[a["cat"]]
    return (f'<svg class="cover" viewBox="0 0 400 240" preserveAspectRatio="xMidYMid slice" aria-hidden="true">'
            f'<rect width="400" height="240" fill="url(#cg{idx})"/>'
            f'<defs><linearGradient id="cg{idx}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1f4b4c"/><stop offset="1" stop-color="#0d2b2c"/></linearGradient></defs>'
            f'{rings}{motif}</svg>')


def post_card(a, r, idx, featured=False, level=3):
    """`level` keeps heading order valid: h2 on the hub (directly under the h1), h3 elsewhere."""
    cls = "post featured" if featured else "post"
    return f"""      <a class="{cls} reveal" href="{r}insights/{a["slug"]}.html" data-cat="{a["cat"]}">
        <div class="post-cover">{cover(a, idx)}<span class="post-cat">{CATEGORIES[a["cat"]]}</span></div>
        <div class="post-body">
          <span class="post-meta">{a["date"]} · {read_time(a)} min read</span>
          <h{level} class="post-title">{a["title"]}</h{level}>
          <p>{a["excerpt"]}</p>
          <span class="svc-more">Read article <span>→</span></span>
        </div>
      </a>"""


def build_insights():
    r = ""
    chips = '<button class="chip on" data-filter="all" aria-pressed="true">All</button>' + "".join(
        f'<button class="chip" data-filter="{k}" aria-pressed="false">{v}</button>' for k, v in CATEGORIES.items()
    )
    cards = "\n".join(post_card(a, r, i, featured=(i == 0), level=2) for i, a in enumerate(ARTICLES))
    page = head("Insights — TerraINT Systems", "Articles on flood risk, IoT sensing, satellite earth observation, GIS and surveying from TerraINT Systems.", r, "insights.html",
                schema=(breadcrumbs_ld(("Insights", "insights.html")),)) + nav(r, "insights") + f"""

<main id="top">
<section class="page-hero">
  <canvas id="terrain" aria-hidden="true"></canvas>
  <div class="wrap">
    <div>
      {crumbs(r, ("Insights", ""))}
      <span class="eyebrow">Insights</span>
      <h1>Notes from the field, <em>the orbit and the map.</em></h1>
      <p class="hero-sub">Short reads on flood risk, sensing, earth observation, GIS and survey — what the technology does and where it makes a difference.</p>
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <div class="filters" role="group" aria-label="Filter articles by topic">{chips}</div>
    <div class="post-grid" id="postGrid">
{cards}
    </div>
    <p class="empty" id="postEmpty" hidden>No articles in this topic yet.</p>
  </div>
</section>

{cta_band(r, "Have a question one of these articles didn't answer?")}
</main>

""" + footer(r) + scripts(r)
    (ROOT / "insights.html").write_text(page, encoding="utf-8")


def render_body(blocks):
    out = []
    for kind, val in blocks:
        if kind == "p":
            out.append(f"<p>{val}</p>")
        elif kind == "h2":
            out.append(f"<h2>{val}</h2>")
        elif kind == "ul":
            out.append("<ul>" + "".join(f"<li>{v}</li>" for v in val) + "</ul>")
        elif kind == "quote":
            out.append(f"<blockquote>{val}</blockquote>")
        elif kind == "flow":
            out.append('<div class="flow">' + "".join(f"<span>{v}</span>" for v in val) + "</div>")
    return "\n        ".join(out)


def build_article(a, i):
    r = "../"
    svc = SERVICE_BY_SLUG[a["service"]]
    more = [x for x in ARTICLES if x is not a]
    more = sorted(more, key=lambda x: x["cat"] != a["cat"])[:3]
    more_cards = "\n".join(post_card(m, r, 100 + k) for k, m in enumerate(more))
    share = f"https://www.linkedin.com/sharing/share-offsite/?url=https%3A%2F%2Fterraintsystems.com%2Finsights%2F{a['slug']}.html"
    page = head(f'{a["title"]} — TerraINT Insights', a["excerpt"], r, f'insights/{a["slug"]}.html', og_type="article", schema=(
        {"@context": "https://schema.org", "@type": "Article", "headline": a["title"], "description": a["excerpt"],
         "datePublished": a["iso"], "author": ORG_REF, "publisher": ORG_REF, "image": OG_IMAGE,
         "mainEntityOfPage": f'{BASE_URL}insights/{a["slug"]}.html', "articleSection": CATEGORIES[a["cat"]]},
        breadcrumbs_ld(("Insights", "insights.html"), (a["title"], f'insights/{a["slug"]}.html')))) + nav(r, "insights") + f"""

<main id="top">
<section class="page-hero article-hero">
  <canvas id="terrain" aria-hidden="true"></canvas>
  <div class="wrap">
    <div>
      {crumbs(r, ("Insights", r + "insights.html"), (CATEGORIES[a["cat"]], ""))}
      <span class="eyebrow">{CATEGORIES[a["cat"]]}</span>
      <h1>{a["title"]}</h1>
      <p class="hero-sub">{a["excerpt"]}</p>
      <div class="article-meta"><span>TerraINT Systems</span><span>{a["date"]}</span><span>{read_time(a)} min read</span></div>
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap article-grid">
    <article class="prose">
        {render_body(a["body"])}
    </article>
    <aside class="article-aside">
      <a class="aside-card" href="{r}services/{svc["slug"]}.html">
        <small>RELATED SERVICE {svc["num"]}</small>
        <b>{svc["title"]}</b>
        <span>{svc["short"]}</span>
        <span class="svc-more">Explore the service <span>→</span></span>
      </a>
      <a class="aside-card light" href="{r}contact.html?service={svc["slug"]}">
        <small>TALK TO US</small>
        <b>Facing this on a project?</b>
        <span class="svc-more">Start a conversation <span>→</span></span>
      </a>
      <a class="share" href="{share}" target="_blank" rel="noopener">Share on LinkedIn ↗</a>
    </aside>
  </div>
</section>

<section class="section" style="padding-top:0">
  <div class="wrap">
    <div class="sec-head reveal"><div><span class="eyebrow">Keep reading</span><h2 class="h2">More <em>insights.</em></h2></div>
      <a class="svc-more" style="color:var(--teal-600)" href="{r}insights.html">All articles <span>→</span></a></div>
    <div class="post-grid three">
{more_cards}
    </div>
  </div>
</section>
</main>

""" + footer(r) + scripts(r)
    out = ROOT / "insights" / f'{a["slug"]}.html'
    out.parent.mkdir(exist_ok=True)
    out.write_text(page, encoding="utf-8")
    return out


def latest_insights(r=""):
    cards = "\n".join(post_card(a, r, 200 + k) for k, a in enumerate(ARTICLES[:3]))
    return f"""<section class="section" id="insights">
  <div class="wrap">
    <div class="sec-head reveal"><div><span class="eyebrow">Insights</span><h2 class="h2">Latest from <em>TerraINT.</em></h2></div>
      <a class="svc-more" style="color:var(--teal-600)" href="{r}insights.html">All articles <span>→</span></a></div>
    <div class="post-grid three">
{cards}
    </div>
  </div>
</section>"""


# ---------------------------------------------------------------------------
# Interactive flood demo (markup; behaviour lives in js/flood-demo.js)
# ---------------------------------------------------------------------------
def flood_demo():
    return """<section class="section dark demo" id="flood-demo">
  <div class="wrap">
    <div class="sec-head reveal">
      <div><span class="eyebrow">Interactive demo</span><h2 class="h2">Raise the water. <em>See the risk.</em></h2></div>
      <p class="lede">Drag the slider to raise the river. Water spreads only where the terrain lets it, and each asset updates as the flood reaches it.</p>
    </div>
    <div class="demo-grid reveal">
      <div class="demo-map" id="floodMap">
        <canvas id="floodCanvas" aria-label="Simulated terrain map with a river and five assets" role="img"></canvas>
        <div class="demo-assets" id="floodAssets"></div>
        <span class="demo-legend"><i class="w"></i>Flooded <i class="r"></i>At risk <i class="s"></i>Safe</span>
      </div>
      <div class="demo-panel">
        <div class="demo-level">
          <small>WATER LEVEL ABOVE NORMAL</small>
          <b><span id="floodLevelOut">0.0</span> m</b>
        </div>
        <input type="range" id="floodLevel" min="0" max="6" step="0.1" value="0" aria-label="Water level above normal, in metres">
        <div class="demo-presets" role="group" aria-label="Scenario presets">
          <button data-level="0">Normal</button><button data-level="1.5">Minor</button><button data-level="3">Moderate</button><button data-level="5">Severe</button>
        </div>
        <button class="btn btn-primary demo-play" id="floodPlay" type="button">▶ Simulate rising water</button>
        <div class="demo-stats">
          <div><b id="floodArea">0%</b><span>Land inundated</span></div>
          <div><b id="floodHit">0 / 5</b><span>Assets flooded</span></div>
        </div>
        <ul class="demo-list" id="floodList"></ul>
        <p class="demo-note">// Illustrative simulation on synthetic terrain — not a hydraulic model of a real site.</p>
      </div>
    </div>
  </div>
</section>"""


# ---------------------------------------------------------------------------
def sync_index():
    """Sync shared partials and generated blocks into the hand-written index.html."""
    p = ROOT / "index.html"
    src = p.read_text(encoding="utf-8")
    home_head = head(
        "TerraINT Systems — Geospatial Intelligence, IoT &amp; Environmental Analytics",
        "TerraINT Systems Pvt. Ltd. turns raw geospatial and environmental data into decisions — IoT sensing, satellite products, GIS licensing, topographic survey and flood risk assessment.",
        "", "", schema=(ORG, {"@context": "https://schema.org", "@type": "WebSite", "name": "TerraINT Systems",
                             "url": BASE_URL, "publisher": ORG_REF}))
    src = re.sub(r"\A.*?<body>\n", lambda m: home_head, src, count=1, flags=re.S)
    src = re.sub(r"\n<script src=.*?</html>\n?", lambda m: scripts(""), src, count=1, flags=re.S)
    src = re.sub(r'<header class="nav" id="nav">.*?</header>', lambda m: nav(""), src, count=1, flags=re.S)
    src = re.sub(r'<footer class="footer">.*?</footer>', lambda m: footer(""), src, count=1, flags=re.S)
    for name, block in (("demo", flood_demo()), ("insights", latest_insights())):
        src = re.sub(rf"<!-- @{name} -->.*?<!-- /@{name} -->", lambda m: f"<!-- @{name} -->\n{block}\n<!-- /@{name} -->", src, count=1, flags=re.S)
    p.write_text(src, encoding="utf-8")


# ---------------------------------------------------------------------------
# Production assets: bundles, 404, sitemap, robots
# ---------------------------------------------------------------------------
CSS_SOURCES = ["css/styles.css", "css/pages.css"]
JS_SOURCES = ["js/terrain.js", "js/flood-demo.js", "js/main.js"]


def minify_css(css):
    css = re.sub(r"/\*.*?\*/", "", css, flags=re.S)       # comments
    css = re.sub(r"\s+", " ", css)                         # collapse whitespace
    css = re.sub(r"\s*([{};,>])\s*", r"\1", css)           # around punctuation (not + or -, calc needs them)
    css = re.sub(r":\s+", ":", css)
    css = css.replace(";}", "}")
    return css.strip() + "\n"


def bundle():
    """Write css/site.min.css and js/site.js; version = short hash of their content."""
    global VERSION
    css = minify_css("\n".join((ROOT / f).read_text(encoding="utf-8") for f in CSS_SOURCES))
    js = "\n".join(f"/* {f} */\n" + (ROOT / f).read_text(encoding="utf-8") for f in JS_SOURCES)
    (ROOT / "css/site.min.css").write_text(css, encoding="utf-8")
    (ROOT / "js/site.js").write_text(js, encoding="utf-8")
    VERSION = hashlib.sha1((css + js).encode()).hexdigest()[:8]
    return len(css), len(js)


def build_404():
    # Root-absolute paths: the host serves this file for any missing URL, at any depth.
    r = "/"
    page = head("Page not found — TerraINT Systems", "The page you were looking for could not be found.", r, "404.html", index=False) + nav(r) + f"""

<main id="top">
<section class="page-hero" style="min-height:80svh;display:grid;align-items:center">
  <canvas id="terrain" aria-hidden="true"></canvas>
  <div class="wrap">
    <div>
      <span class="eyebrow">Error 404</span>
      <h1>You've gone <em>off the map.</em></h1>
      <p class="hero-sub">The page you were looking for doesn't exist or has moved. Let's get you back to known terrain.</p>
      <div class="hero-cta">
        <a href="/" class="btn btn-primary">Back to home {ARROW}</a>
        <a href="/insights.html" class="btn btn-ghost">Read insights</a>
        <a href="/contact.html" class="btn btn-ghost">Contact us</a>
      </div>
    </div>
  </div>
</section>
</main>

""" + footer(r) + scripts(r)
    (ROOT / "404.html").write_text(page, encoding="utf-8")


def build_seo_files():
    today = datetime.date.today().isoformat()
    urls = "\n".join(
        f"  <url><loc>{BASE_URL}{p}</loc><lastmod>{today}</lastmod>"
        f"<priority>{'1.0' if p == '' else '0.8' if p.startswith('services') else '0.6'}</priority></url>"
        for p in sorted(set(PAGES), key=lambda p: (p != "", p))
    )
    (ROOT / "sitemap.xml").write_text(
        f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n{urls}\n</urlset>\n',
        encoding="utf-8")
    (ROOT / "robots.txt").write_text(f"User-agent: *\nAllow: /\n\nSitemap: {BASE_URL}sitemap.xml\n", encoding="utf-8")


if __name__ == "__main__":
    css_len, js_len = bundle()
    print(f"bundled css/site.min.css ({css_len // 1024} KB) and js/site.js ({js_len // 1024} KB), v={VERSION}")
    svgs = service_svgs()
    for s in SERVICES:
        print("built", build_service(s, svgs).relative_to(ROOT))
    build_about(); print("built about.html")
    build_contact(); print("built contact.html")
    build_insights(); print("built insights.html")
    for i, a in enumerate(ARTICLES):
        print("built", build_article(a, i).relative_to(ROOT))
    sync_index(); print("synced index.html head/header/footer")
    build_404(); print("built 404.html")
    build_seo_files(); print(f"wrote sitemap.xml ({len(set(PAGES))} URLs) and robots.txt")
