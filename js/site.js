/* js/terrain.js */
/* ==========================================================================
   Animated topographic contour field.
   A slowly drifting noise "terrain" is traced with marching squares into
   contour lines; the cursor raises a small hill. Every 4th contour is an
   index contour drawn in copper, like on a survey sheet.
   ========================================================================== */
(function () {
  "use strict";

  // --- Small seeded value noise (3D: x, y, time) -------------------------
  function makeNoise(seed) {
    const p = new Uint8Array(512);
    let s = seed || 1;
    const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const perm = [...Array(256).keys()];
    for (let i = 255; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
    for (let i = 0; i < 512; i++) p[i] = perm[i & 255];
    const fade = t => t * t * (3 - 2 * t);
    const lerp = (a, b, t) => a + (b - a) * t;
    const h = (x, y, z) => p[p[p[x & 255] + (y & 255)] + (z & 255)] / 255;
    return function (x, y, z) {
      const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
      const xf = fade(x - xi), yf = fade(y - yi), zf = fade(z - zi);
      const a = lerp(lerp(h(xi, yi, zi), h(xi + 1, yi, zi), xf), lerp(h(xi, yi + 1, zi), h(xi + 1, yi + 1, zi), xf), yf);
      const b = lerp(lerp(h(xi, yi, zi + 1), h(xi + 1, yi, zi + 1), xf), lerp(h(xi, yi + 1, zi + 1), h(xi + 1, yi + 1, zi + 1), xf), yf);
      return lerp(a, b, zf);
    };
  }

  function Terrain(canvas, opts) {
    const o = Object.assign({ cell: 14, levels: 14, speed: 0.00006, scale: 0.0035, nodes: true, interactive: true, seed: 7 }, opts);
    const ctx = canvas.getContext("2d");
    const noise = makeNoise(o.seed);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w, h, cols, rows, field, dpr, raf, visible = true;
    const mouse = { x: -9999, y: -9999, tx: -9999, ty: -9999, s: 0 };
    let nodes = [];

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const cell = w < 700 ? o.cell * 1.3 : o.cell;
      cols = Math.ceil(w / cell) + 1; rows = Math.ceil(h / cell) + 1;
      field = new Float32Array(cols * rows);
      o._cell = cell;
      // Sensor nodes scattered over the right half of the field
      nodes = Array.from({ length: w < 700 ? 4 : 8 }, (_, i) => ({
        x: w * (0.45 + 0.5 * ((i * 0.618) % 1)), y: h * (0.15 + 0.7 * ((i * 0.382 + 0.2) % 1)), ph: i * 0.9
      }));
    }

    function sample(t) {
      const cell = o._cell;
      mouse.x += (mouse.tx - mouse.x) * 0.08; mouse.y += (mouse.ty - mouse.y) * 0.08;
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          const x = i * cell, y = j * cell;
          let v = noise(x * o.scale, y * o.scale, t) * 0.7 + noise(x * o.scale * 2.3, y * o.scale * 2.3, t * 1.4 + 10) * 0.3;
          if (o.interactive) {
            const dx = x - mouse.x, dy = y - mouse.y;
            v += 0.22 * mouse.s * Math.exp(-(dx * dx + dy * dy) / 16000);
          }
          field[j * cols + i] = v;
        }
      }
    }

    // Marching squares for one threshold; appends segments to the current path
    function contour(level) {
      const cell = o._cell;
      for (let j = 0; j < rows - 1; j++) {
        for (let i = 0; i < cols - 1; i++) {
          const a = field[j * cols + i], b = field[j * cols + i + 1];
          const c = field[(j + 1) * cols + i + 1], d = field[(j + 1) * cols + i];
          const idx = (a > level) << 3 | (b > level) << 2 | (c > level) << 1 | (d > level);
          if (idx === 0 || idx === 15) continue;
          const x = i * cell, y = j * cell;
          const top = [x + cell * (level - a) / (b - a), y];
          const right = [x + cell, y + cell * (level - b) / (c - b)];
          const bottom = [x + cell * (level - d) / (c - d), y + cell];
          const left = [x, y + cell * (level - a) / (d - a)];
          const seg = (p, q) => { ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); };
          switch (idx) {
            case 1: case 14: seg(left, bottom); break;
            case 2: case 13: seg(bottom, right); break;
            case 3: case 12: seg(left, right); break;
            case 4: case 11: seg(top, right); break;
            case 5: seg(left, top); seg(bottom, right); break;
            case 6: case 9: seg(top, bottom); break;
            case 7: case 8: seg(left, top); break;
            case 10: seg(left, bottom); seg(top, right); break;
          }
        }
      }
    }

    function draw(time) {
      const t = time * o.speed;
      mouse.s += ((mouse.inside ? 1 : 0) - mouse.s) * 0.04;
      sample(t);
      ctx.clearRect(0, 0, w, h);
      for (let k = 1; k < o.levels; k++) {
        const level = 0.2 + (k / o.levels) * 0.65;
        const index = k % 4 === 0;
        ctx.beginPath();
        contour(level);
        ctx.strokeStyle = index ? "rgba(192,133,82,0.55)" : "rgba(143,184,178," + (0.1 + k / o.levels * 0.18) + ")";
        ctx.lineWidth = index ? 1.3 : 0.8;
        ctx.stroke();
      }
      if (o.nodes) drawNodes(time);
    }

    function drawNodes(time) {
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(192,133,82,0.25)";
      ctx.setLineDash([3, 5]);
      ctx.beginPath();
      for (let i = 1; i < nodes.length; i++) {
        const a = nodes[i - 1], b = nodes[i];
        ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, a.y); ctx.lineTo(b.x, b.y); // circuit-style right angles
      }
      ctx.stroke();
      ctx.setLineDash([]);
      for (const n of nodes) {
        const p = ((time / 2200 + n.ph) % 1);
        ctx.beginPath(); ctx.arc(n.x, n.y, 4 + p * 22, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(192,133,82," + (0.6 * (1 - p)) + ")"; ctx.stroke();
        ctx.beginPath(); ctx.arc(n.x, n.y, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = "#c08552"; ctx.fill();
      }
    }

    // Capped at ~30 fps: the contours drift slowly, so 60 fps only costs CPU.
    let last = 0;
    function loop(time) {
      if (visible && time - last > 32) { draw(time); last = time; }
      raf = requestAnimationFrame(loop);
    }

    resize();
    window.addEventListener("resize", () => { resize(); if (reduce) draw(0); });
    if (o.interactive) {
      const host = canvas.parentElement;
      host.addEventListener("pointermove", e => { const r = canvas.getBoundingClientRect(); mouse.tx = e.clientX - r.left; mouse.ty = e.clientY - r.top; mouse.inside = true; if (mouse.x < -999) { mouse.x = mouse.tx; mouse.y = mouse.ty; } });
      host.addEventListener("pointerleave", () => { mouse.inside = false; });
      host.addEventListener("pointerenter", () => { mouse.inside = true; });
    }
    // Pause when offscreen to save battery
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(canvas);

    // Start after the page has loaded so the first paint isn't competing with
    // the field computation; the canvas then fades in (see .terrain-on).
    const begin = () => setTimeout(() => {
      canvas.classList.add("terrain-on");
      if (reduce) draw(0); else raf = requestAnimationFrame(loop);
    }, 200);
    if (document.readyState === "complete") begin(); else window.addEventListener("load", begin, { once: true });
  }

  window.TerraTerrain = Terrain;
  window.TerraNoise = makeNoise;
})();

/* js/flood-demo.js */
/* ==========================================================================
   Interactive flood demo — illustrative only.
   Builds a synthetic river valley, then floods it from the river outward:
   a cell is wet only if it is below the water surface AND connected to the
   river (flood fill), so ridges hold water back the way real terrain does.
   ========================================================================== */
(function () {
  "use strict";
  const canvas = document.getElementById("floodCanvas");
  if (!canvas || !window.TerraNoise) return;

  // Terrain generation is heavy: only build it when the demo nears the viewport.
  new IntersectionObserver((entries, io) => {
    if (entries.some(e => e.isIntersecting)) { io.disconnect(); start(); }
  }, { rootMargin: "200px 0px" }).observe(canvas);

  function start() {

    const W = 300, H = 180;                 // simulation grid
    const MAX_ELEV = 22;                    // metres, top of the synthetic terrain
    const noise = window.TerraNoise(42);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const $ = id => document.getElementById(id);
    const slider = $("floodLevel"), out = $("floodLevelOut"), list = $("floodList");
    const areaOut = $("floodArea"), hitOut = $("floodHit"), layer = $("floodAssets"), playBtn = $("floodPlay");

    // --- Terrain -------------------------------------------------------------
    const elev = new Float32Array(W * H);
    const river = new Uint8Array(W * H);
    const riverY = x => H * 0.52 + Math.sin(x * 0.028) * 22 + Math.sin(x * 0.071 + 1) * 8;
    let minRiver = Infinity;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const d = Math.abs(y - riverY(x));
        const valley = Math.pow(Math.min(1, d / 70), 0.9);              // valley walls rise away from river
        const rough = noise(x * 0.025, y * 0.025, 0.5) * 0.65 + noise(x * 0.07, y * 0.07, 3) * 0.35;
        const terrace = noise(x * 0.012, y * 0.012, 9);                  // broad floodplain variation
        const plain = Math.min(1, d / 34);                               // flat floodplain next to the channel
        let h = valley * 0.62 + (rough * 0.3 + terrace * 0.18 - 0.14) * plain;
        h = Math.max(0, h) * MAX_ELEV;
        const i = y * W + x;
        if (d < 2.6) { river[i] = 1; h = Math.min(h, 0.4); }
        elev[i] = h;
        if (river[i]) minRiver = Math.min(minRiver, h);
      }
    }
    const BASE = 0.6; // normal river surface (m)

    // --- Assets: placed at chosen heights above the river -------------------
    const ASSETS = [
      { name: "Pump station", fx: 0.18, above: 0.7, side: -1 },
      { name: "Warehouse", fx: 0.42, above: 1.9, side: 1 },
      { name: "Power substation", fx: 0.62, above: 3.2, side: -1 },
      { name: "Factory", fx: 0.8, above: 4.6, side: 1 },
      { name: "Village", fx: 0.3, above: 7.5, side: 1 },
    ];
    ASSETS.forEach(a => {
      const x = Math.round(a.fx * W);
      let y = Math.round(riverY(x)), best = y;
      for (let k = 3; k < H; k++) {
        const yy = Math.round(riverY(x)) + a.side * k;
        if (yy < 6 || yy > H - 6) break;
        best = yy;
        if (elev[yy * W + x] >= BASE + a.above) break;
      }
      a.x = x; a.y = best; a.ground = elev[best * W + x];
      const el = document.createElement("div");
      el.className = "asset";
      el.style.left = (x / W * 100) + "%";
      el.style.top = (best / H * 100) + "%";
      el.innerHTML = `<i></i><span>${a.name}</span>`;
      layer.appendChild(el);
      a.el = el;
      const li = document.createElement("li");
      li.innerHTML = `<span>${a.name}<small>Ground ${a.ground.toFixed(1)} m</small></span><em>Safe</em>`;
      list.appendChild(li);
      a.li = li;
    });

    // --- Base terrain image (elevation ramp + hillshade + contour lines) ----
    const terrainImg = new ImageData(W, H);
    const ramp = [[0, [38, 92, 82]], [0.25, [74, 120, 88]], [0.5, [140, 150, 104]], [0.75, [190, 176, 140]], [1, [232, 226, 212]]];
    const colorAt = t => {
      for (let k = 1; k < ramp.length; k++) {
        if (t <= ramp[k][0]) {
          const [t0, c0] = ramp[k - 1], [t1, c1] = ramp[k], f = (t - t0) / (t1 - t0);
          return c0.map((c, j) => c + (c1[j] - c) * f);
        }
      }
      return ramp[ramp.length - 1][1];
    };
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x, h = elev[i];
        const hx = elev[y * W + Math.min(W - 1, x + 1)] - elev[y * W + Math.max(0, x - 1)];
        const hy = elev[Math.min(H - 1, y + 1) * W + x] - elev[Math.max(0, y - 1) * W + x];
        const shade = Math.max(0.55, Math.min(1.25, 1 - (hx * 0.6 + hy * 0.9) * 0.09));
        let c = colorAt(h / MAX_ELEV).map(v => v * shade);
        if (river[i]) c = [52, 112, 150];
        const o = i * 4;
        terrainImg.data[o] = c[0]; terrainImg.data[o + 1] = c[1]; terrainImg.data[o + 2] = c[2]; terrainImg.data[o + 3] = 255;
      }
    }
    const raw = document.createElement("canvas"); raw.width = W; raw.height = H;
    raw.getContext("2d").putImageData(terrainImg, 0, 0);

    // Upscaled base with smooth vector contour lines (marching squares, every 2 m)
    const S = 4, base = document.createElement("canvas"); base.width = W * S; base.height = H * S;
    const bctx = base.getContext("2d");
    bctx.imageSmoothingEnabled = true;
    bctx.drawImage(raw, 0, 0, W * S, H * S);
    for (let lv = 2; lv < MAX_ELEV; lv += 2) {
      bctx.beginPath();
      for (let y = 0; y < H - 1; y++) {
        for (let x = 0; x < W - 1; x++) {
          const a = elev[y * W + x], b = elev[y * W + x + 1], c = elev[(y + 1) * W + x + 1], d = elev[(y + 1) * W + x];
          const idx = (a > lv) << 3 | (b > lv) << 2 | (c > lv) << 1 | (d > lv);
          if (idx === 0 || idx === 15) continue;
          const T = [x + (lv - a) / (b - a), y], R = [x + 1, y + (lv - b) / (c - b)];
          const B = [x + (lv - d) / (c - d), y + 1], L = [x, y + (lv - a) / (d - a)];
          const seg = (p, q) => { bctx.moveTo(p[0] * S, p[1] * S); bctx.lineTo(q[0] * S, q[1] * S); };
          switch (idx) {
            case 1: case 14: seg(L, B); break;
            case 2: case 13: seg(B, R); break;
            case 3: case 12: seg(L, R); break;
            case 4: case 11: seg(T, R); break;
            case 5: seg(L, T); seg(B, R); break;
            case 6: case 9: seg(T, B); break;
            case 7: case 8: seg(L, T); break;
            case 10: seg(L, B); seg(T, R); break;
          }
        }
      }
      const index = lv % 10 === 0;
      bctx.strokeStyle = index ? "rgba(70,50,30,.45)" : "rgba(40,50,40,.2)";
      bctx.lineWidth = index ? 2.4 : 1.4;
      bctx.stroke();
    }
    const waterCv = document.createElement("canvas"); waterCv.width = W; waterCv.height = H;
    const wctx = waterCv.getContext("2d"), waterImg = wctx.createImageData(W, H);

    // --- Flood fill from the river ------------------------------------------
    const wet = new Uint8Array(W * H), queue = new Int32Array(W * H);
    let landCells = 0;
    for (let i = 0; i < W * H; i++) if (!river[i]) landCells++;

    function flood(level) {
      const surface = BASE + level;
      wet.fill(0);
      let head = 0, tail = 0, count = 0;
      for (let i = 0; i < W * H; i++) if (river[i]) { wet[i] = 1; queue[tail++] = i; }
      while (head < tail) {
        const i = queue[head++], x = i % W, y = (i / W) | 0;
        const nb = [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1];
        for (const n of nb) {
          if (n < 0 || wet[n] || elev[n] >= surface) continue;
          wet[n] = 1; queue[tail++] = n; count++;
        }
      }
      const d = waterImg.data;
      for (let i = 0; i < W * H; i++) {
        const o = i * 4;
        if (wet[i] && !river[i]) {
          const depth = Math.min(1, (surface - elev[i]) / 3);
          d[o] = 56 - depth * 20; d[o + 1] = 132 - depth * 30; d[o + 2] = 190 - depth * 20; d[o + 3] = 120 + depth * 110;
        } else d[o + 3] = 0;
      }
      wctx.putImageData(waterImg, 0, 0);
      return { surface, pct: count / landCells };
    }

    // --- Render -------------------------------------------------------------
    const ctx = canvas.getContext("2d");
    let level = 0;
    function draw() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (canvas.width !== w * dpr) { canvas.width = w * dpr; canvas.height = h * dpr; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(base, 0, 0, w, h);
      ctx.drawImage(waterCv, 0, 0, w, h);
    }

    function update(v) {
      level = Math.round(v * 10) / 10;
      slider.value = level;
      out.textContent = level.toFixed(1);
      const { surface, pct } = flood(level);
      let hit = 0;
      ASSETS.forEach(a => {
        const isWet = wet[a.y * W + a.x];
        const margin = a.ground - surface;
        const status = isWet ? "flooded" : margin < 1 ? "risk" : "safe";
        if (isWet) hit++;
        a.el.className = "asset " + status;
        const em = a.li.querySelector("em");
        a.li.className = status;
        em.textContent = isWet ? `Flooded · ${(surface - a.ground).toFixed(1)} m deep` : status === "risk" ? `At risk · ${margin.toFixed(1)} m clear` : "Safe";
      });
      areaOut.textContent = Math.round(pct * 100) + "%";
      hitOut.textContent = `${hit} / ${ASSETS.length}`;
      draw();
    }

    slider.addEventListener("input", () => { stop(); update(+slider.value); });
    document.querySelectorAll(".demo-presets button").forEach(b => b.addEventListener("click", () => { stop(); animateTo(+b.dataset.level); }));

    // --- Animation ------------------------------------------------------------
    let raf = null;
    function stop() { if (raf) cancelAnimationFrame(raf); raf = null; playBtn.textContent = "▶ Simulate rising water"; }
    function animateTo(target, speed = 2.2) {
      if (reduce) return update(target);
      let last = performance.now();
      const step = now => {
        const dt = (now - last) / 1000; last = now;
        const dir = Math.sign(target - level);
        const next = level + dir * speed * dt;
        if (dir === 0 || (dir > 0 ? next >= target : next <= target)) { update(target); raf = null; playBtn.textContent = "▶ Simulate rising water"; return; }
        update(next);
        raf = requestAnimationFrame(step);
      };
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(step);
    }
    playBtn.addEventListener("click", () => {
      if (raf) return stop();
      playBtn.textContent = "❚❚ Pause";
      if (level >= 5.9) update(0);
      animateTo(6, 0.9);
    });

    window.addEventListener("resize", draw);
    update(0);
  }
})();

/* js/main.js */
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
