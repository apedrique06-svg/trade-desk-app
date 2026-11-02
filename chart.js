/* Hand-drawn charts on <canvas>. No libraries. draw = price + levels, area = balance, candles = OHLC from a price series. */
"use strict";
(function () {
  const FONT = "10px ui-monospace,Menlo,Consolas,monospace";
  function setup(canvas) {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth || 320, h = canvas.clientHeight || 160;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    const g = canvas.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
    return {g, w, h};
  }
  function msg(g, w, h, text) { g.fillStyle = "#7d84a8"; g.font = FONT; g.textAlign = "center"; g.fillText(text, w / 2, h / 2); g.textAlign = "left"; }
  function grid(g, w, h, lo, hi, padL, padR, padT, padB, fmt) {
    g.strokeStyle = "#1a1f3a"; g.lineWidth = 1; g.fillStyle = "#5c638a"; g.font = FONT;
    for (let i = 0; i <= 4; i++) {
      const y = Math.round(padT + (h - padT - padB) * i / 4) + .5;
      g.beginPath(); g.moveTo(padL, y); g.lineTo(w - padR, y); g.stroke();
      g.fillText(fmt(hi - (hi - lo) * i / 4), 2, y + 3);
    }
  }
  const sfmt = v => v >= 1000 ? "$" + (v / 1000).toFixed(1) + "K" : v >= 1 ? "$" + v.toFixed(0) : v.toPrecision(2);

  window.DeskChart = {
    draw(canvas, series, lines) {
      const {g, w, h} = setup(canvas);
      const pts = (series || []).filter(p => p && p[1] > 0);
      const levels = (lines || []).filter(l => l && l.v > 0);
      if (pts.length < 2) return msg(g, w, h, "sin serie de precios todavía");
      const vals = pts.map(p => p[1]).concat(levels.map(l => l.v));
      let lo = Math.min(...vals), hi = Math.max(...vals);
      if (hi === lo) { hi *= 1.01; lo *= 0.99; }
      const pad = 6, t0 = pts[0][0], t1 = pts[pts.length - 1][0] || t0 + 1;
      const X = t => pad + (w - 2 * pad) * ((t - t0) / Math.max(1, t1 - t0));
      const Y = v => pad + (h - 2 * pad) * (1 - (v - lo) / (hi - lo));
      for (const l of levels) {
        g.strokeStyle = l.c; g.lineWidth = 1; g.setLineDash([4, 4]);
        g.beginPath(); g.moveTo(pad, Y(l.v)); g.lineTo(w - pad, Y(l.v)); g.stroke();
        g.setLineDash([]); g.fillStyle = l.c; g.font = FONT; g.fillText(l.n, pad + 2, Y(l.v) - 3);
      }
      const up = pts[pts.length - 1][1] >= pts[0][1];
      g.strokeStyle = up ? "#22e58b" : "#ff4d6a"; g.lineWidth = 2; g.lineJoin = "round";
      g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(X(p[0]), Y(p[1])) : g.moveTo(X(p[0]), Y(p[1])))); g.stroke();
    },

    area(canvas, series) {
      const {g, w, h} = setup(canvas);
      let pts = (series || []).filter(p => p && p[1] != null);
      if (!pts.length) return msg(g, w, h, "sin balance todavía");
      if (pts.length === 1) pts = [[pts[0][0] - 60, pts[0][1]], pts[0]];
      const vals = pts.map(p => p[1]);
      let lo = Math.min(...vals), hi = Math.max(...vals);
      const span = Math.max(hi - lo, Math.abs(hi) * 0.02, 1); lo -= span * 0.25; hi += span * 0.25;
      const padL = 46, padR = 8, padT = 8, padB = 16;
      grid(g, w, h, lo, hi, padL, padR, padT, padB, v => "$" + v.toFixed(hi - lo < 10 ? 2 : 0));
      const t0 = pts[0][0], t1 = pts[pts.length - 1][0];
      const X = t => padL + (w - padL - padR) * ((t - t0) / Math.max(1, t1 - t0));
      const Y = v => padT + (h - padT - padB) * (1 - (v - lo) / (hi - lo));
      // stepped line: equity only changes when a trade closes
      const path = [];
      pts.forEach((p, i) => { if (i) path.push([X(p[0]), Y(pts[i - 1][1])]); path.push([X(p[0]), Y(p[1])]); });
      const grad = g.createLinearGradient(0, padT, 0, h - padB);
      grad.addColorStop(0, "rgba(34,229,139,.35)"); grad.addColorStop(1, "rgba(34,229,139,0)");
      g.beginPath(); g.moveTo(path[0][0], h - padB); path.forEach(p => g.lineTo(p[0], p[1])); g.lineTo(path[path.length - 1][0], h - padB);
      g.closePath(); g.fillStyle = grad; g.fill();
      g.beginPath(); path.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
      g.strokeStyle = "#22e58b"; g.lineWidth = 2; g.shadowColor = "#22e58b"; g.shadowBlur = 8; g.stroke(); g.shadowBlur = 0;
      const last = path[path.length - 1];
      g.fillStyle = "#22e58b"; g.fillRect(last[0] - 3, last[1] - 3, 6, 6);
      g.fillStyle = "#5c638a"; g.font = FONT;
      const tl = t => new Date(t * 1000).toLocaleTimeString("es-ES", {hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid"});
      g.fillText(tl(t0), padL, h - 3); g.textAlign = "right"; g.fillText(tl(t1) + " Madrid", w - padR, h - 3); g.textAlign = "left";
    },

    candles(canvas, series, n) {
      const {g, w, h} = setup(canvas);
      const pts = (series || []).filter(p => p && p[1] > 0);
      const padL = 46, padR = 6, padT = 8, padB = 8;
      if (pts.length < 2) {
        grid(g, w, h, 0, 1, padL, padR, padT, padB, () => "");
        return msg(g, w, h, pts.length ? "1 precio: aún no hay velas" : "sin serie de precios");
      }
      n = Math.min(n || 30, pts.length);
      const t0 = pts[0][0], t1 = pts[pts.length - 1][0] + 1, step = (t1 - t0) / n;
      const cs = [];
      for (let i = 0; i < n; i++) {
        const b = pts.filter(p => p[0] >= t0 + i * step && p[0] < t0 + (i + 1) * step);
        if (!b.length) continue;
        const v = b.map(p => p[1]);
        cs.push({o: v[0], c: v[v.length - 1], hi: Math.max(...v), lo: Math.min(...v), i});
      }
      let lo = Math.min(...cs.map(c => c.lo)), hi = Math.max(...cs.map(c => c.hi));
      if (hi === lo) { hi *= 1.02; lo *= 0.98; }
      grid(g, w, h, lo, hi, padL, padR, padT, padB, sfmt);
      const cw = (w - padL - padR) / n, Y = v => padT + (h - padT - padB) * (1 - (v - lo) / (hi - lo));
      for (const c of cs) {
        const x = padL + c.i * cw + cw / 2, col = c.c >= c.o ? "#22e58b" : "#ff4d6a";
        g.strokeStyle = col; g.fillStyle = col; g.lineWidth = 1;
        g.beginPath(); g.moveTo(Math.round(x) + .5, Y(c.hi)); g.lineTo(Math.round(x) + .5, Y(c.lo)); g.stroke();
        const top = Y(Math.max(c.o, c.c)), bh = Math.max(2, Math.abs(Y(c.o) - Y(c.c)));
        g.fillRect(Math.round(x - Math.max(1, cw * .35)), top, Math.max(2, Math.round(cw * .7)), bh);
      }
    }
  };
})();
