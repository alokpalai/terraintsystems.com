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
