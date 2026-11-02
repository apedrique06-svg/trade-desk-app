/* v3 pixel office, top-down 3/4 view, hand-drawn on a 480x270 grid (rendered 2x). Original art only.
   Live network overlay: one white node per desk, pink links along the pipeline
   Scanner → Auditor → Analyst → Executor → Risk → Telegram, white packets fired by real activity events
   (DeskOffice.fire) plus dim ambient traffic; popups (mini chart, ✓, ✗, score, push) flash over the monitors.
   ≤30 fps, stops while the page is hidden. */
"use strict";
(function () {
  const S = 2, W = 480, H = 270;
  const AG = [
    {k: "scanner", n: "SCANNER", c: "#3df0ff", x: 90, y: 92, hair: "#2b1a12"},
    {k: "auditor", n: "AUDITOR", c: "#b78cff", x: 240, y: 92, hair: "#d9c27a"},
    {k: "analyst", n: "ANALYST", c: "#ff5fc1", x: 390, y: 92, hair: "#5a2e1a"},
    {k: "executor", n: "EXECUTOR", c: "#2bff88", x: 390, y: 200, hair: "#121212"},
    {k: "risk", n: "RISK", c: "#ff9a3d", x: 240, y: 200, hair: "#7a3b1f"},
    {k: "telegram", n: "TELEGRAM", c: "#5ea8ff", x: 90, y: 200, hair: "#3a2a4a"}
  ];
  const IDX = Object.fromEntries(AG.map((a, i) => [a.k, i]));
  const node = i => ({x: AG[i].x, y: AG[i].y - 30});
  const EDGE_IN = {x: -6, y: 62}, EDGE_OUT = {x: -6, y: 170};
  let g, bg, canvas, data = null, packets = [], pops = [], last = 0, nextAmb = 0, nextAmbPop = 0, running = false;
  const FONT = s => `${s * S}px VT323,ui-monospace,Menlo,monospace`;

  function R(c2, x, y, w, h, col) { c2.fillStyle = col; c2.fillRect(Math.round(x * S), Math.round(y * S), Math.round(w * S), Math.round(h * S)); }
  const r = (x, y, w, h, col) => R(g, x, y, w, h, col);
  function rnd(seed) { let s = seed | 0 || 1; return () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff); }

  function plant(c, x, y, big) {
    R(c, x, y + 8, 12, 9, "#3b2433"); R(c, x + 1, y + 8, 10, 2, "#55334a");
    const lv = "#1d9e5a", lv2 = "#2bc46f";
    R(c, x + 4, y - 4, 4, 13, lv); R(c, x - 1, y, 6, 4, lv2); R(c, x + 7, y - 1, 6, 4, lv2); R(c, x + 2, y - 7, 4, 4, lv2);
    if (big) { R(c, x - 3, y - 5, 5, 3, lv); R(c, x + 10, y - 6, 5, 3, lv); }
    [[x + 1, y - 2], [x + 9, y - 3], [x + 4, y - 8], [x - 2, y - 6], [x + 11, y - 7]].slice(0, big ? 5 : 3)
      .forEach(([fx, fy]) => { R(c, fx, fy, 3, 3, "#ff2d95"); R(c, fx + 1, fy + 1, 1, 1, "#ffd1ea"); });
  }

  function room() {
    bg = document.createElement("canvas"); bg.width = W * S; bg.height = H * S;
    const c = bg.getContext("2d");
    // floor
    for (let y = 0; y < H; y += 10) for (let x = 0; x < W; x += 10) R(c, x, y, 10, 10, ((x + y) / 10) % 2 ? "#0b0814" : "#0d0a18");
    // back wall + windows (city at night)
    R(c, 0, 0, W, 34, "#120c22"); R(c, 0, 34, W, 2, "#ff2d95"); R(c, 0, 36, W, 2, "#3a0f2a");
    const rr = rnd(7);
    [[150, 6], [282, 6]].forEach(([wx, wy]) => {
      R(c, wx, wy, 48, 22, "#2a1d44"); R(c, wx + 2, wy + 2, 44, 18, "#06061a");
      for (let i = 0; i < 9; i++) { const bh = 4 + Math.floor(rr() * 12); R(c, wx + 2 + i * 5, wy + 20 - bh, 4, bh, "#140f2e");
        if (rr() > .4) R(c, wx + 3 + i * 5, wy + 21 - bh + 2, 1, 1, rr() > .5 ? "#ffd23f" : "#3df0ff"); }
      R(c, wx + 23, wy + 2, 2, 18, "#2a1d44");
    });
    // wall sign (pixel letters drawn with rects: "JEV")
    const sign = [[1, 1, 1, 0, 1, 1, 1, 0, 1, 0, 1], [0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 1], [0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 1], [0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 1], [1, 1, 0, 0, 1, 1, 1, 0, 0, 1, 0]];
    R(c, 222, 8, 36, 18, "#1a0f2a");
    sign.forEach((row, y) => row.forEach((v, x) => v && R(c, 226 + x * 2.6, 11 + y * 2.4, 2.4, 2.2, "#ff2d95")));
    // rug
    R(c, 150, 128, 180, 34, "#1c0c22"); R(c, 152, 130, 176, 30, "#24102c");
    for (let x = 156; x < 324; x += 8) R(c, x, 144, 4, 2, "#3a1440");
    // server rack (hub) + coffee corner
    R(c, 452, 44, 22, 70, "#1a1330"); R(c, 453, 45, 20, 68, "#0a0816");
    for (let i = 0; i < 9; i++) R(c, 455, 48 + i * 7, 16, 5, "#141030");
    R(c, 10, 40, 30, 16, "#2a1d3a"); R(c, 14, 34, 10, 8, "#3a2a50"); R(c, 26, 36, 6, 6, "#f4ecff");
    plant(c, 452, 238, true); plant(c, 6, 238, true); plant(c, 118, 40, false); plant(c, 352, 40, false); plant(c, 456, 140, false); plant(c, 166, 238, false); plant(c, 304, 238, false);
    // desks
    AG.forEach(a => {
      const x = a.x - 46, y = a.y - 20;
      R(c, x + 2, y + 30, 92, 4, "rgba(0,0,0,.35)");           // shadow
      R(c, x, y, 92, 30, "#2c1f3f"); R(c, x, y, 92, 2, "#47345f"); R(c, x, y + 28, 92, 2, "#1b1228");
      // monitors (3): frames; screens are drawn live
      [-30, 0, 30].forEach(dx => { R(c, a.x + dx - 13, y - 14, 26, 17, "#1b1530"); R(c, a.x + dx - 2, y + 3, 4, 3, "#1b1530"); });
      R(c, a.x - 14, y + 14, 28, 6, "#151022"); for (let k = 0; k < 6; k++) R(c, a.x - 12 + k * 4.4, y + 15.5, 3, 1.5, "#2d2442");  // keyboard
      R(c, a.x + 20, y + 15, 5, 6, "#151022");               // mouse
      R(c, a.x - 40, y + 8, 6, 7, "#f4ecff"); R(c, a.x - 39, y + 9, 4, 2, "#5a3a2a");   // mug
      // chair
      R(c, a.x - 12, a.y + 14, 24, 18, "#1a1428"); R(c, a.x - 10, a.y + 16, 20, 14, "#241c36");
    });
  }

  function screenContent(a, i, dx, t, mode) {
    const x = a.x + dx - 11, y = a.y - 32, w = 22, h = 13;
    const cols = ["#ff2d95", "#2bff88", "#3df0ff"];
    r(x, y, w, h, mode === "dead" ? (Math.floor(t * 2) % 2 ? "#3a0712" : "#12030a") : "#060512");
    if (mode === "dead") return;
    const col = cols[(i + dx / 30 + 3) % 3 | 0];
    const sp = mode === "fresh" ? 1 : 0.15;
    for (let k = 0; k < w; k += 2) {
      const v = Math.sin((k + t * 8 * sp) * 0.45 + i * 2 + dx) * 0.35 + Math.sin((k + t * 5 * sp) * 0.17 + dx) * 0.4;
      r(x + k, y + h / 2 - v * (h / 2 - 2), 2, 1.2, col);
    }
    r(x, y + h - 1, w, 1, "rgba(255,255,255,.08)");
  }

  function person(a, i, t, mode) {
    const bob = mode === "fresh" ? Math.round(Math.sin(t * 3 + i) * 0.6 * 2) / 2 : 0;
    const x = a.x, y = a.y + 8 + bob;
    r(x - 9, y + 2, 18, 9, a.c);                      // shoulders (shirt in agent colour)
    r(x - 9, y + 2, 18, 2, "rgba(255,255,255,.25)");
    const arm = mode === "fresh" ? Math.floor(t * 6 + i) % 2 : 0;   // typing
    r(x - 11, y - 3 + arm, 4, 7, a.c); r(x + 7, y - 3 + (1 - arm), 4, 7, a.c);
    r(x - 5, y - 6, 10, 9, a.hair); r(x - 4, y - 7, 8, 2, a.hair);        // back of the head
    r(x - 6, y - 2, 1, 3, "#e0a27a"); r(x + 5, y - 2, 1, 3, "#e0a27a");  // ears
  }

  function glow(a, t, col, amp) {
    const cx = a.x * S, cy = (a.y - 24) * S;
    const gr = g.createRadialGradient(cx, cy, 4 * S, cx, cy, 58 * S);
    const al = Math.round((0.18 + 0.1 * Math.sin(t * 3)) * amp * 255).toString(16).padStart(2, "0");
    gr.addColorStop(0, col + al); gr.addColorStop(1, col + "00");
    g.fillStyle = gr; g.fillRect(cx - 60 * S, cy - 40 * S, 120 * S, 90 * S);
  }

  function popupDraw(p, t) {
    const age = t - p.t0, life = p.life;
    if (age < 0) return;
    const a = Math.min(1, age / 0.18, (life - age) / 0.35);
    const n = node(p.i), w = 34, h = 22, x = n.x - w / 2 + p.dx, y = n.y - 34 - Math.min(4, age * 12);
    g.globalAlpha = Math.max(0, a);
    r(x, y, w, h, "rgba(5,4,12,.92)"); 
    g.strokeStyle = p.col; g.lineWidth = S; g.strokeRect(x * S + 1, y * S + 1, w * S - 2, h * S - 2);
    r(x + w / 2 - 2, y + h, 4, 3, p.col);
    if (p.kind === "chart") {
      const rr = rnd(p.seed); let v = 0.5; g.strokeStyle = p.col; g.lineWidth = S; g.beginPath();
      for (let k = 0; k <= 10; k++) { v = Math.max(.1, Math.min(.9, v + (rr() - .45) * .35)); const px = (x + 3 + k * 2.8) * S, py = (y + h - 3 - v * (h - 7)) * S; k ? g.lineTo(px, py) : g.moveTo(px, py); }
      g.stroke();
    } else if (p.kind === "ok") {
      g.strokeStyle = "#2bff88"; g.lineWidth = 2.5 * S; g.beginPath(); g.moveTo((x + 10) * S, (y + 11) * S); g.lineTo((x + 15) * S, (y + 16) * S); g.lineTo((x + 24) * S, (y + 6) * S); g.stroke();
    } else if (p.kind === "x") {
      g.strokeStyle = "#ff3b5c"; g.lineWidth = 2.5 * S; g.beginPath(); g.moveTo((x + 11) * S, (y + 5) * S); g.lineTo((x + 23) * S, (y + 17) * S); g.moveTo((x + 23) * S, (y + 5) * S); g.lineTo((x + 11) * S, (y + 17) * S); g.stroke();
    } else {
      g.fillStyle = p.col; g.font = FONT(p.kind === "score" ? 15 : 11); g.textAlign = "center"; g.textBaseline = "middle";
      g.fillText(p.label || "", (x + w / 2) * S, (y + h / 2 + 1) * S); g.textAlign = "left"; g.textBaseline = "alphabetic";
    }
    g.globalAlpha = 1;
  }

  function packetPos(p, t) {
    const u = Math.min(1, (t - p.t0) / p.dur);
    return {x: p.a.x + (p.b.x - p.a.x) * u, y: p.a.y + (p.b.y - p.a.y) * u, u};
  }

  function frame(t) {
    g.clearRect(0, 0, W * S, H * S);
    g.drawImage(bg, 0, 0);
    const ag = (data && data.health && data.health.agents) || {};
    const maxAge = (data && data.settings && data.settings.health && data.settings.health.heartbeat_max_age_s) || 45;
    AG.forEach((a, i) => {
      const hb = ag[a.k], mode = !hb || hb.age_s == null || hb.age_s >= maxAge ? "dead" : hb.paused ? "paused" : "fresh";
      if (mode === "fresh") glow(a, t + i, a.c, 1); else if (mode === "dead") glow(a, t * 2, "#ff3b5c", 1.4);
      [-30, 0, 30].forEach(dx => screenContent(a, i, dx, t, mode));
      person(a, i, t, mode);
      g.fillStyle = a.c; g.font = FONT(10); g.textAlign = "center"; g.fillText(a.n + (mode === "dead" ? " · SIN LATIDO" : mode === "paused" ? " · PAUSA" : ""), a.x * S, (a.y + 40) * S); g.textAlign = "left";
    });
    // network: links, nodes
    g.lineWidth = S * 0.6; g.strokeStyle = "rgba(255,45,149,.75)"; g.setLineDash([3 * S, 2 * S]); g.lineDashOffset = -t * 14;
    g.beginPath(); g.moveTo(EDGE_IN.x * S, EDGE_IN.y * S);
    AG.forEach((a, i) => g.lineTo(node(i).x * S, node(i).y * S)); g.lineTo(EDGE_OUT.x * S, EDGE_OUT.y * S); g.stroke();
    g.setLineDash([]); g.strokeStyle = "rgba(255,45,149,.22)"; g.beginPath();
    [[0, 4], [1, 5], [2, 4], [1, 3]].forEach(([p, q]) => { g.moveTo(node(p).x * S, node(p).y * S); g.lineTo(node(q).x * S, node(q).y * S); }); g.stroke();
    AG.forEach((a, i) => {
      const n = node(i), pulse = 1 + 0.25 * Math.sin(t * 4 + i);
      g.fillStyle = "rgba(255,255,255,.18)"; g.beginPath(); g.arc(n.x * S, n.y * S, 6 * S * pulse, 0, 7); g.fill();
      g.fillStyle = "#ffffff"; g.beginPath(); g.arc(n.x * S, n.y * S, 3 * S, 0, 7); g.fill();
      g.fillStyle = a.c; g.beginPath(); g.arc(n.x * S, n.y * S, 1.4 * S, 0, 7); g.fill();
    });
    // packets
    packets = packets.filter(p => t - p.t0 < p.dur + 0.05);
    for (const p of packets) {
      if (t < p.t0) continue;
      const q = packetPos(p, t);
      for (let k = 1; k <= 4; k++) { const back = {t0: p.t0 + 0.04 * k, dur: p.dur, a: p.a, b: p.b}; const bq = packetPos(back, t);
        if (bq.u > 0) { g.globalAlpha = p.alpha * (0.5 - k * 0.1); r(bq.x - 1.5, bq.y - 1.5, 3, 3, p.col); } }
      g.globalAlpha = p.alpha; r(q.x - 2, q.y - 2, 4, 4, p.col); g.globalAlpha = 1;
    }
    // popups
    pops = pops.filter(p => t - p.t0 < p.life);
    for (const p of pops) popupDraw(p, t);
    // ambient traffic when nothing real is happening
    if (t > nextAmb) {
      const i = Math.floor(Math.random() * 5);
      send(node(i), node(i + 1), t, 0.45, "#ffffff", 1.6);
      nextAmb = t + 0.9 + Math.random() * 1.4;
    }
    if (t > nextAmbPop) {
      popup(Math.floor(Math.random() * 6), "chart", AG[Math.floor(Math.random() * 6)].c, null, t, 2.2);
      nextAmbPop = t + 2.5 + Math.random() * 2.5;
    }
    if (!data) { g.fillStyle = "#8a7c9a"; g.font = FONT(16); g.textAlign = "center"; g.fillText("CARGANDO…", W / 2 * S, 140 * S); g.textAlign = "left"; }
  }

  function send(a, b, t0, alpha, col, dur) { packets.push({a, b, t0, dur: dur || 1.1, alpha: alpha == null ? 1 : alpha, col: col || "#ffffff"}); }
  function popup(i, kind, col, label, t0, life) {
    if (pops.filter(p => p.i === i && Math.abs(p.t0 - t0) < 0.6).length) t0 += 0.7;   // don't stack on top of each other
    pops.push({i, kind, col: col || "#ff2d95", label, t0, life: life || 2.6, dx: 0, seed: Math.floor(Math.random() * 1e6)});
  }

  /* Map one real activity event to packets/popups. delay: seconds from now. */
  function fire(ev, delay) {
    const t = performance.now() / 1000 + (delay || 0);
    const k = String(ev.kind || "").toLowerCase(), a = String(ev.agent || "").toLowerCase(), txt = String(ev.text || "");
    const i = IDX[a];
    const hop = (p, q, col) => send(node(p), node(q), t, 1, col || "#ffffff", 1.0);
    const bad = /reject|kill|fail|rug|skip|miss|stop|error/.test(k);
    if (a === "scanner") {
      if (k === "graduation" || k === "seen" || k === "new") { send(EDGE_IN, node(0), t, 1, "#ffffff", 0.9); popup(0, "chart", "#3df0ff", null, t + 0.9); }
      else if (k === "passed") { popup(0, "ok", "#2bff88", null, t); hop(0, 1); }
      else if (k === "reconnect") popup(0, "txt", "#ffd23f", "WS ↻", t);
      else if (bad) popup(0, "x", "#ff3b5c", null, t);
      else popup(0, "chart", "#3df0ff", null, t);
    } else if (a === "auditor") {
      if (bad) popup(1, "x", "#ff3b5c", null, t); else { popup(1, "ok", "#2bff88", null, t); hop(1, 2); }
    } else if (a === "analyst") {
      const m = txt.match(/score\D{0,3}(\d{1,3})/i);
      popup(2, m ? "score" : "chart", "#ff5fc1", m ? m[1] : null, t);
      if (!bad && /pass|buy|push|ok/.test(k)) hop(2, 3);
    } else if (a === "executor") {
      if (bad) popup(3, "x", "#ff3b5c", null, t); else { popup(3, "txt", "#2bff88", "BUY", t); hop(3, 4); }
    } else if (a === "risk") {
      popup(4, bad ? "x" : "txt", bad ? "#ff3b5c" : "#ff9a3d", "EXIT", t); hop(4, 5);
    } else if (a === "telegram" || /push/.test(k)) {
      popup(5, "txt", "#5ea8ff", "PUSH ➤", t); send(node(5), EDGE_OUT, t + 0.3, 1, "#ffffff", 0.9);
    } else if (i != null) popup(i, "chart", AG[i].c, null, t);
  }

  function loop(ts) {
    if (!running) return;
    requestAnimationFrame(loop);
    if (ts - last < 33) return;         // ≤30 fps
    last = ts; frame(ts / 1000);
  }
  function setRun() {
    const want = document.visibilityState === "visible";
    if (want && !running) { running = true; requestAnimationFrame(loop); } else if (!want) running = false;
  }

  window.DeskOffice = {
    mount(c) { canvas = c; canvas.width = W * S; canvas.height = H * S; g = canvas.getContext("2d"); g.imageSmoothingEnabled = false; room();
      document.addEventListener("visibilitychange", setRun); setRun();
      if (document.fonts && document.fonts.load) document.fonts.load(FONT(10)).catch(() => {}); },
    update(d) { data = d; },
    fire, agents: AG
  };
})();
