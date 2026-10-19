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
