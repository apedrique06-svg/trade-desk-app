/* Hand-drawn price chart on <canvas>: price line + entry / stop / trail lines. No libraries. */
"use strict";
window.DeskChart = {
  draw(canvas, series, lines) {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth || 320, h = canvas.clientHeight || 160;
    canvas.width = w * dpr; canvas.height = h * dpr;
    const g = canvas.getContext("2d");
    g.scale(dpr, dpr); g.clearRect(0, 0, w, h);
    const pts = (series || []).filter(p => p && p[1] > 0);
    const levels = (lines || []).filter(l => l && l.v > 0);
    if (pts.length < 2) {
      g.fillStyle = "#8a8a8e"; g.font = "12px -apple-system,system-ui"; g.fillText("sin serie de precios todavía", 8, h / 2);
      return;
    }
    const vals = pts.map(p => p[1]).concat(levels.map(l => l.v));
    let lo = Math.min(...vals), hi = Math.max(...vals);
    if (hi === lo) { hi *= 1.01; lo *= 0.99; }
    const pad = 6, t0 = pts[0][0], t1 = pts[pts.length - 1][0] || t0 + 1;
    const X = t => pad + (w - 2 * pad) * ((t - t0) / Math.max(1, t1 - t0));
    const Y = v => pad + (h - 2 * pad) * (1 - (v - lo) / (hi - lo));
    for (const l of levels) {
      g.strokeStyle = l.c; g.lineWidth = 1; g.setLineDash([4, 4]);
      g.beginPath(); g.moveTo(pad, Y(l.v)); g.lineTo(w - pad, Y(l.v)); g.stroke();
      g.setLineDash([]); g.fillStyle = l.c; g.font = "10px -apple-system,system-ui"; g.fillText(l.n, pad + 2, Y(l.v) - 3);
    }
    const up = pts[pts.length - 1][1] >= pts[0][1];
    g.strokeStyle = up ? "#00d27a" : "#ff4d4f"; g.lineWidth = 2; g.lineJoin = "round";
    g.beginPath();
    pts.forEach((p, i) => (i ? g.lineTo(X(p[0]), Y(p[1])) : g.moveTo(X(p[0]), Y(p[1]))));
    g.stroke();
  }
};
