/* TerraINT Systems — page interactions (shared by every page; each block
   only runs when its elements exist on the current page). */
(function () {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // --- Terrain canvases ----------------------------------------------------
  if (window.TerraTerrain) {
    const hero = $("#terrain");
    if (hero) TerraTerrain(hero, hero.closest(".page-hero") ? { seed: 11, levels: 12 } : { seed: 7 });
    const cta = $("#ctaTerrain");
    if (cta) TerraTerrain(cta, { seed: 21, nodes: false, levels: 10, cell: 18, speed: 0.00004 });
  }

  // --- Nav: solid on scroll + mobile menu + services dropdown -------------
  const nav = $("#nav"), menuBtn = $("#menuBtn"), links = $("#navLinks");
  const onScroll = () => nav.classList.toggle("scrolled", window.scrollY > 40);
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
  const drop = $(".nav-drop"), dropBtn = $(".drop-btn");
  const setDrop = open => { drop.classList.toggle("open", open); dropBtn.setAttribute("aria-expanded", open); };
  const setMenu = open => {
    links.classList.toggle("open", open);
    menuBtn.setAttribute("aria-expanded", open);
    menuBtn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    document.body.style.overflow = open ? "hidden" : "";
    if (!open) setDrop(false);
  };
  menuBtn.addEventListener("click", () => setMenu(!links.classList.contains("open")));
  $$("a", links).forEach(a => a.addEventListener("click", () => setMenu(false)));
  dropBtn.addEventListener("click", e => { e.stopPropagation(); setDrop(!drop.classList.contains("open")); });
  document.addEventListener("click", e => { if (!drop.contains(e.target)) setDrop(false); });
  document.addEventListener("keydown", e => { if (e.key === "Escape") { setMenu(false); setDrop(false); } });

  // --- Reveal on scroll ----------------------------------------------------
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
  }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
  $$(".reveal").forEach(el => io.observe(el));

  // --- Pipeline (home): auto-advance, pause on hover/focus -----------------
  const pipeline = $("#pipeline");
  if (pipeline) {
    const steps = $$(".step", pipeline), progress = $("#pipeProgress");
    let active = 0, timer;
    const setStep = i => {
      active = i;
      steps.forEach((s, k) => s.classList.toggle("active", k <= i));
      progress.style.width = (80 * i / (steps.length - 1)) + "%";
    };
    const play = () => { clearInterval(timer); if (!reduce) timer = setInterval(() => setStep((active + 1) % steps.length), 2200); };
    const pause = () => clearInterval(timer);
    steps.forEach((s, i) => {
      s.addEventListener("mouseenter", () => { pause(); setStep(i); });
      s.addEventListener("focus", () => { pause(); setStep(i); });
      s.addEventListener("click", () => setStep(i));
    });
    pipeline.addEventListener("mouseleave", play);
    setStep(0); play();
  }

  // --- Services explorer (home): accessible tabs ---------------------------
  const tabs = $$(".svc-tab"), panels = $$(".svc-panel");
  if (tabs.length) {
    panels.forEach(p => p.removeAttribute("hidden")); // CSS handles visibility once JS runs
    const select = i => {
      tabs.forEach((t, k) => { t.setAttribute("aria-selected", k === i); t.tabIndex = k === i ? 0 : -1; });
      panels.forEach((p, k) => { p.classList.toggle("active", k === i); p.setAttribute("aria-hidden", k !== i); });
    };
    tabs.forEach((t, i) => {
      t.addEventListener("click", () => select(i));
      t.addEventListener("keydown", e => {
        const d = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
        if (!d) return;
        e.preventDefault();
        const n = (i + d + tabs.length) % tabs.length;
        select(n); tabs[n].focus();
      });
    });
    select(0);
  }

  // --- Illustrative telemetry (home) --------------------------------------
  const line = $("#sparkLine"), area = $("#sparkArea");
  if (line) {
    const pts = Array.from({ length: 40 }, (_, i) => 2.2 + Math.sin(i / 5) * 0.18 + Math.random() * 0.06);
    const render = () => {
      const min = 1.9, max = 2.8;
      const d = pts.map((v, i) => `${i ? "L" : "M"}${(i / (pts.length - 1) * 300).toFixed(1)} ${(70 - (v - min) / (max - min) * 64).toFixed(1)}`).join(" ");
      line.setAttribute("d", d);
      area.setAttribute("d", d + " L300 70 L0 70 Z");
      $("#teleLevel").textContent = pts[pts.length - 1].toFixed(2);
    };
    render();
    if (!reduce) setInterval(() => {
      const last = pts[pts.length - 1];
      pts.push(Math.min(2.75, Math.max(2.0, last + (Math.random() - 0.48) * 0.08)));
      pts.shift();
      render();
      $("#teleRain").textContent = (8 + Math.random() * 8).toFixed(1);
      $("#teleSoil").textContent = Math.round(35 + Math.random() * 6) + "%";
    }, 1400);
  }

  // --- FAQ: keep one answer open at a time ---------------------------------
  $$(".faq").forEach(group => {
    const items = $$("details", group);
    items.forEach(d => d.addEventListener("toggle", () => {
      if (d.open) items.forEach(o => { if (o !== d) o.open = false; });
    }));
  });

  // --- Contact form --------------------------------------------------------
  const form = $("#contactForm");
  if (form) {
    const status = $("#formStatus");
    // Pre-select a service when arriving from a service page (?service=slug)
    const pre = new URLSearchParams(location.search).get("service");
    if (pre) $$('input[name="services"]', form).forEach(c => { if (c.dataset.slug === pre) c.checked = true; });

    const emailOk = v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
    const validate = () => {
      let ok = true;
      $$("[required]", form).forEach(el => {
        const bad = !el.value.trim() || (el.type === "email" && !emailOk(el.value.trim()));
        el.closest(".field").classList.toggle("invalid", bad);
        el.setAttribute("aria-invalid", bad);
        if (bad && ok) { el.focus(); ok = false; }
      });
      return ok;
    };
    $$("[required]", form).forEach(el => el.addEventListener("input", () => {
      if (el.closest(".field").classList.contains("invalid")) validate();
    }));
    const show = (cls, msg) => { status.className = "form-status " + cls; status.textContent = msg; };

    form.addEventListener("submit", async e => {
      e.preventDefault();
      if (form._gotcha.value) return; // bot trap
      if (!validate()) return;
      const data = new FormData(form);
      const services = data.getAll("services").join(", ");
      const endpoint = form.dataset.endpoint;
      const btn = $('button[type="submit"]', form);

      if (!endpoint) {
        // No form backend configured yet: hand off to the visitor's email app.
        const body = [
          `Name: ${data.get("name")}`,
          `Organization: ${data.get("organization") || "-"}`,
          `Email: ${data.get("email")}`,
          `Phone: ${data.get("phone") || "-"}`,
          `Interested in: ${services || "-"}`,
          "", data.get("message")
        ].join("\n");
        location.href = `mailto:${form.dataset.mailto}?subject=${encodeURIComponent("Website enquiry — " + data.get("name"))}&body=${encodeURIComponent(body)}`;
        show("ok", "Your email app should open with the enquiry filled in — just press send. If nothing opened, write to " + form.dataset.mailto + ".");
        return;
      }

      btn.disabled = true;
      try {
        // URL-encoded body: what Netlify Forms expects for AJAX posts (form services accept it too)
        const res = await fetch(endpoint, {
          method: "POST",
          body: new URLSearchParams(data).toString(),
          headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
        });
        if (!res.ok) throw new Error(res.status);
        form.reset();
        show("ok", "Thank you — your enquiry has been sent. We'll be in touch soon.");
      } catch {
        show("bad", "Sorry, something went wrong sending the form. Please email " + form.dataset.mailto + " directly.");
      } finally {
        btn.disabled = false;
      }
    });
  }

  // --- Contact map: load the third-party embed only when it scrolls into view
  $$("iframe[data-src]").forEach(frame => {
    new IntersectionObserver((entries, obs) => {
      if (entries.some(e => e.isIntersecting)) { frame.src = frame.dataset.src; obs.disconnect(); }
    }, { rootMargin: "100px 0px" }).observe(frame);
  });

  // --- Insights: topic filter ----------------------------------------------
  const grid = $("#postGrid");
  if (grid) {
    const chips = $$(".filters .chip"), posts = $$(".post", grid), empty = $("#postEmpty");
    chips.forEach(c => c.addEventListener("click", () => {
      const f = c.dataset.filter;
      chips.forEach(o => { o.classList.toggle("on", o === c); o.setAttribute("aria-pressed", o === c); });
      let shown = 0;
      posts.forEach(p => {
        const show = f === "all" || p.dataset.cat === f;
        p.hidden = !show;
        // The big "featured" layout only makes sense in the unfiltered view
        p.classList.toggle("featured", f === "all" && p === posts[0]);
        if (show) { shown++; p.classList.add("in"); }
      });
      empty.hidden = shown > 0;
    }));
  }

  const year = $("#year");
  if (year) year.textContent = new Date().getFullYear();
})();
