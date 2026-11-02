/* Pixel-art office, drawn by hand on a 320x180 grid (rendered 2x). Original art: no logos, images or avatars.
   Each agent is a little bot at its desk. Idle bob; glow when the heartbeat is fresh; red "!" when stale; "z" when paused. */
"use strict";
(function () {
  const S = 2, W = 320, H = 180;
  const AG = [
    {k: "scanner", n: "SCANNER", c: "#38bdf8", x: 34, y: 96},
    {k: "auditor", n: "AUDITOR", c: "#a78bfa", x: 130, y: 96},
    {k: "analyst", n: "ANALYST", c: "#f472b6", x: 226, y: 96},
    {k: "executor", n: "EXECUTOR", c: "#34d399", x: 34, y: 142},
    {k: "risk", n: "RISK", c: "#fb923c", x: 130, y: 142},
    {k: "telegram", n: "TELEGRAM", c: "#60a5fa", x: 226, y: 142}
  ];
  let g = null, canvas = null, state = {data: null}, timer = null, stars = [];
  for (let i = 0; i < 18; i++) stars.push([14 + (i * 37) % 44, 14 + (i * 23) % 30, i % 3]);

  const r = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x * S, y * S, w * S, h * S); };
  const px = (x, y, c) => r(x, y, 1, 1, c);
  const text = (s, x, y, c, size, align) => { g.fillStyle = c; g.font = `bold ${(size || 6) * S}px ui-monospace,Menlo,Consolas,monospace`; g.textAlign = align || "left"; g.fillText(s, x * S, y * S); g.textAlign = "left"; };
  const shade = (hex, f) => { const n = parseInt(hex.slice(1), 16); const ch = s => Math.max(0, Math.min(255, Math.round(((n >> s) & 255) * f))); return `rgb(${ch(16)},${ch(8)},${ch(0)})`; };

  function room(t) {
    r(0, 0, W, 72, "#0c0f2b");
    for (let x = 0; x < W; x += 16) r(x, 0, 1, 72, "#10143a");
    r(0, 70, W, 2, "#ff3ea5"); r(0, 72, W, 1, "#5a1640");
    for (let y = 73; y < H; y += 8) for (let x = 0; x < W; x += 8) r(x, y, 8, 8, ((x + y) / 8) % 2 ? "#0a0c22" : "#0c0f27");
    // window with stars
    r(10, 10, 48, 38, "#262b52"); r(12, 12, 44, 34, "#060818");
    stars.forEach(([sx, sy, k]) => px(sx, sy, (Math.floor(t * 2) + k) % 3 ? "#cfd6ff" : "#4a5287"));
    r(33, 12, 1, 34, "#262b52"); r(12, 28, 44, 1, "#262b52");
    // banners
    [[66, "#ff3ea5"], [238, "#38bdf8"]].forEach(([bx, bc]) => { r(bx, 8, 14, 22, "#141838"); r(bx, 8, 14, 2, bc); r(bx + 3, 14, 8, 2, bc); r(bx + 3, 18, 6, 2, shade(bc, .6)); r(bx + 3, 22, 8, 2, shade(bc, .6));
      px(bx, 30, "#141838"); px(bx + 13, 30, "#141838"); r(bx + 6, 30, 2, 2, "#141838"); });
    // poster with bars (right)
    r(258, 12, 44, 30, "#262b52"); r(260, 14, 40, 26, "#070a1c");
    [6, 10, 8, 14, 12, 18, 16, 20].forEach((hh, i) => r(263 + i * 4.5, 38 - hh, 3, hh, i % 3 === 1 ? "#ff4d6a" : "#22e58b"));
    // server rack
    r(296, 76, 18, 50, "#1a1e3d"); r(297, 77, 16, 48, "#0b0d20");
    for (let i = 0; i < 7; i++) { r(299, 80 + i * 6, 12, 4, "#151936"); px(301, 81 + i * 6, (Math.floor(t * 3 + i) % 4) ? "#22e58b" : "#0b3d27"); px(303, 81 + i * 6, (Math.floor(t * 5 + i * 2) % 3) ? "#38bdf8" : "#123049"); }
    // plants
    [[4, 112], [300, 150], [4, 160]].forEach(([x, y]) => { r(x + 2, y + 8, 10, 8, "#5b3a29"); r(x + 3, y + 8, 8, 1, "#7a5038");
      r(x + 5, y - 2, 4, 10, "#1f8a4c"); r(x + 1, y + 1, 4, 6, "#25a35a"); r(x + 9, y, 4, 7, "#25a35a"); r(x + 6, y - 5, 2, 4, "#2fc26b"); });
  }

  function screen(t, d) {
    const x0 = 96, y0 = 6, w = 128, h = 56;
    r(x0 - 3, y0 - 3, w + 6, h + 6, "#2a2f55"); r(x0, y0, w, h, "#04060f");
    r(x0 + w / 2 - 4, y0 + h + 3, 8, 6, "#2a2f55");
    const eq = d && d.state ? d.state.equity : null;
    text("BALANCE", x0 + 4, y0 + 9, "#7d84a8", 6);
    text(eq == null ? "—" : "$" + eq.toFixed(2), x0 + w - 4, y0 + 9, "#22e58b", 7, "right");
    const pts = (d && d.equitySeries) || [];
    let vals = pts.map(p => p[1]);
    if (vals.length < 2) vals = [vals[0] || 0, vals[0] || 0];
    let lo = Math.min(...vals), hi = Math.max(...vals); const sp = Math.max(hi - lo, Math.abs(hi) * .02, 1); lo -= sp * .3; hi += sp * .3;
    const N = 60, gx = x0 + 4, gy = y0 + 14, gw = w - 8, gh = h - 20;
    for (let yy = 0; yy < 4; yy++) r(gx, gy + Math.round(gh * yy / 3), gw, 1, "#101634");
    for (let i = 0; i < N; i++) {
      const v = vals[Math.min(vals.length - 1, Math.floor(i * vals.length / N))];
      const yy = gy + Math.round(gh * (1 - (v - lo) / (hi - lo)));
      r(gx + Math.round(i * gw / N), yy, 2, 2, "#22e58b");
    }
    // scanning cursor
    r(gx + Math.round(((t * 12) % gw)), gy, 1, gh, "rgba(255,62,165,.35)");
    // Jev orb
    const oy = Math.round(Math.sin(t * 1.6) * 2);
    const ox = 238, oyy = 50 + oy;
    g.fillStyle = "rgba(244,114,182,.18)"; g.beginPath(); g.arc((ox + 6) * S, (oyy + 6) * S, 11 * S, 0, 7); g.fill();
    r(ox + 2, oyy, 8, 12, "#c084fc"); r(ox, oyy + 2, 12, 8, "#c084fc"); r(ox + 2, oyy + 2, 8, 8, "#f0abfc");
    r(ox + 3, oyy + 4, 2, 2, "#1b0b2e"); r(ox + 7, oyy + 4, 2, 2, "#1b0b2e");
    text("JEV", ox + 6, oyy + 20, "#f0abfc", 5, "center");
  }

  function bot(a, t, i, hb, maxAge) {
    const fresh = hb && hb.age_s != null && hb.age_s < maxAge, paused = hb && hb.paused;
    const bob = Math.round(Math.sin(t * 2.2 + i * 1.3) * 1.2);
    const cx = a.x + 30, by = a.y - 18 + bob;
    if (fresh) {   // glow
      const al = .16 + .1 * Math.sin(t * 3 + i);
      const gr = g.createRadialGradient(cx * S, (by + 8) * S, 2 * S, cx * S, (by + 8) * S, 22 * S);
      gr.addColorStop(0, a.c + "aa"); gr.addColorStop(1, a.c + "00");
      g.globalAlpha = Math.max(.05, al * 2); g.fillStyle = gr; g.fillRect((cx - 24) * S, (by - 14) * S, 48 * S, 44 * S); g.globalAlpha = 1;
    }
    // chair back
    r(cx - 8, by + 6, 16, 14, "#22264a");
    // body + head
    r(cx - 6, by + 9, 12, 9, shade(a.c, .75));
    r(cx - 5, by, 10, 9, a.c); r(cx - 4, by + 1, 8, 1, shade(a.c, 1.25));
    px(cx, by - 2, a.c); r(cx - 1, by - 3, 2, 1, fresh ? "#ffffff" : shade(a.c, .5));       // antenna
    const blink = (Math.floor(t * 10 + i * 7) % 37) === 0;
    if (!blink) { r(cx - 3, by + 4, 2, 2, "#0b0d20"); r(cx + 1, by + 4, 2, 2, "#0b0d20"); } else { r(cx - 3, by + 5, 2, 1, "#0b0d20"); r(cx + 1, by + 5, 2, 1, "#0b0d20"); }
    // desk
    r(a.x + 4, a.y, 52, 5, "#3b3357"); r(a.x + 4, a.y, 52, 1, "#544a7a"); r(a.x + 6, a.y + 5, 3, 12, "#2a2440"); r(a.x + 51, a.y + 5, 3, 12, "#2a2440");
    // monitors
    [[a.x + 8, 0], [a.x + 38, 1]].forEach(([mx, k]) => {
      r(mx, a.y - 13, 15, 11, "#20243f");
      const scr = !hb || !fresh ? (Math.floor(t * 2) % 2 ? "#3a0a14" : "#14060c") : shade(a.c, .35);
      r(mx + 1, a.y - 12, 13, 8, scr);
      if (fresh) for (let l = 0; l < 3; l++) r(mx + 2, a.y - 11 + l * 2.5, 3 + ((Math.floor(t * 4) + l + k + i) % 9), 1, shade(a.c, 1.1));
      r(mx + 6, a.y - 2, 3, 2, "#20243f");
    });
    // label
    text(a.n, a.x + 30, a.y + 23, a.c, 5.5, "center");
    // status bubble
    if (!fresh || paused) {
      const on = Math.floor(t * 2) % 2 === 0;
      const bx = cx + 8, byy = by - 10;
      r(bx, byy, 9, 9, paused ? "#ffc53d" : on ? "#ff4d6a" : "#7a1a2b");
      text(paused ? "z" : "!", bx + 4.5, byy + 7, "#0b0d20", 7, "center");
    }
  }

  function frame() {
    if (!g) return;
    const t = performance.now() / 1000, d = state.data;
    g.clearRect(0, 0, W * S, H * S);
    room(t); screen(t, d);
    const ag = (d && d.health && d.health.agents) || {};
    const maxAge = (d && d.settings && d.settings.health && d.settings.health.heartbeat_max_age_s) || 45;
    AG.forEach((a, i) => bot(a, t, i, ag[a.k], maxAge));
    if (!d) text("CARGANDO…", W / 2, 88, "#7d84a8", 7, "center");
  }

  function loop() {
    clearTimeout(timer);
    if (document.visibilityState === "visible") frame();
    timer = setTimeout(loop, 100);     // ~10 fps is enough for pixel art and easy on the battery
  }

  window.DeskOffice = {
    mount(c) { canvas = c; canvas.width = W * S; canvas.height = H * S; g = canvas.getContext("2d"); g.imageSmoothingEnabled = false; loop(); },
    update(d) { state.data = d; },
    agents: AG
  };
})();
