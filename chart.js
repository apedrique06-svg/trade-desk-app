/* Hand-drawn charts on <canvas>. No libraries. draw = price + levels, area = balance, candles = OHLC from a price series. */
"use strict";
(function () {
  const FONT = "13px VT323,ui-monospace,Menlo,Consolas,monospace";
  function setup(canvas) {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth || 320, h = canvas.clientHeight || 160;
    const W = Math.round(w * dpr), H = Math.round(h * dpr);
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
    const g = canvas.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
    return {g, w, h};
  }
  function msg(g, w, h, text) { g.fillStyle = "#7d84a8"; g.font = FONT; g.textAlign = "center"; g.fillText(text, w / 2, h / 2); g.textAlign = "left"; }
  function grid(g, w, h, lo, hi, padL, padR, padT, padB, fmt) {
    g.strokeStyle = "#24101f"; g.lineWidth = 1; g.fillStyle = "#8a7c9a"; g.font = FONT;
    for (let i = 0; i <= 4; i++) {
      const y = Math.round(padT + (h - padT - padB) * i / 4) + .5;
      g.beginPath(); g.moveTo(padL, y); g.lineTo(w - padR, y); g.stroke();
      g.fillText(fmt(hi - (hi - lo) * i / 4), 2, y + 3);
    }
  }
  const sfmt = v => v >= 1000 ? "$" + (v / 1000).toFixed(1) + "K" : v >= 1 ? "$" + v.toFixed(0) : v.toPrecision(2);

  const tl = t => new Date(t * 1000).toLocaleTimeString("es-ES", {hour: "2-digit", minute: "2-digit", timeZone: "Atlantic/Canary"});
  function bounds(vals, padFrac) {
    let lo = Math.min(...vals), hi = Math.max(...vals);
    const span = Math.max(hi - lo, Math.abs(hi) * 0.02, 1e-12); lo -= span * padFrac; hi += span * padFrac; return [lo, hi];
  }

  window.DeskChart = {
    /* Big live chart: pink line + translucent pink area; pulsing head and a scan line, animated by `now` (s). */
    live(canvas, series, now, fmt) {
      const {g, w, h} = setup(canvas);
      let pts = (series || []).filter(p => p && p[1] != null);
      if (!pts.length) return msg(g, w, h, "sin serie todavía");
      if (pts.length === 1) pts = [[pts[0][0] - 300, pts[0][1]], pts[0]];
      const [lo, hi] = bounds(pts.map(p => p[1]), 0.15), padL = 44, padR = 6, padT = 6, padB = 14;
      fmt = fmt || sfmt;
      grid(g, w, h, lo, hi, padL, padR, padT, padB, fmt);
      const t0 = pts[0][0], t1 = pts[pts.length - 1][0];
      const X = t => padL + (w - padL - padR) * ((t - t0) / Math.max(1, t1 - t0)), Y = v => padT + (h - padT - padB) * (1 - (v - lo) / (hi - lo));
      const grad = g.createLinearGradient(0, padT, 0, h - padB);
      grad.addColorStop(0, "rgba(255,45,149,.45)"); grad.addColorStop(1, "rgba(255,45,149,.02)");
      g.beginPath(); g.moveTo(X(t0), h - padB); pts.forEach(p => g.lineTo(X(p[0]), Y(p[1]))); g.lineTo(X(t1), h - padB); g.closePath(); g.fillStyle = grad; g.fill();
      g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(X(p[0]), Y(p[1])) : g.moveTo(X(p[0]), Y(p[1]))));
      g.strokeStyle = "#ff2d95"; g.lineWidth = 2; g.shadowColor = "#ff2d95"; g.shadowBlur = 8; g.stroke(); g.shadowBlur = 0;
      const lx = X(t1), ly = Y(pts[pts.length - 1][1]), pr = 3 + 2 * Math.abs(Math.sin((now || 0) * 3));
      g.fillStyle = "rgba(255,255,255,.25)"; g.beginPath(); g.arc(lx - 2, ly, pr + 3, 0, 7); g.fill();
      g.fillStyle = "#fff"; g.beginPath(); g.arc(lx - 2, ly, 2.5, 0, 7); g.fill();
      const sx = padL + ((now || 0) * 40) % (w - padL - padR);
      g.fillStyle = "rgba(255,45,149,.18)"; g.fillRect(sx, padT, 2, h - padT - padB);
      g.fillStyle = "#ff2d95"; g.font = FONT; g.textAlign = "right"; g.fillText(fmt(pts[pts.length - 1][1]), w - padR, padT + 10);
      g.fillStyle = "#8a7c9a"; g.fillText(tl(t1) + " Canarias", w - padR, h - 2); g.textAlign = "left"; g.fillText(tl(t0), padL, h - 2);
    },

    /* Wide balance strip: green area down to the start-stack baseline + pink equity line. */
    strip(canvas, series, base) {
      const {g, w, h} = setup(canvas);
      let pts = (series || []).filter(p => p && p[1] != null);
      if (!pts.length) return msg(g, w, h, "sin balance todavía");
      if (pts.length === 1) pts = [[pts[0][0] - 60, pts[0][1]], pts[0]];
      if (base == null) base = pts[0][1];
      const [lo, hi] = bounds(pts.map(p => p[1]).concat([base]), 0.3), padL = 48, padR = 6, padT = 6, padB = 14;
      grid(g, w, h, lo, hi, padL, padR, padT, padB, v => "$" + v.toFixed(hi - lo < 10 ? 2 : 0));
      const t0 = pts[0][0], t1 = pts[pts.length - 1][0];
      const X = t => padL + (w - padL - padR) * ((t - t0) / Math.max(1, t1 - t0)), Y = v => padT + (h - padT - padB) * (1 - (v - lo) / (hi - lo));
      const path = []; pts.forEach((p, i) => { if (i) path.push([X(p[0]), Y(pts[i - 1][1])]); path.push([X(p[0]), Y(p[1])]); });
      const by = Y(base);
      const grad = g.createLinearGradient(0, padT, 0, h - padB);
      grad.addColorStop(0, "rgba(43,255,136,.55)"); grad.addColorStop(1, "rgba(43,255,136,.08)");
      g.beginPath(); g.moveTo(path[0][0], h - padB); path.forEach(p => g.lineTo(p[0], p[1])); g.lineTo(path[path.length - 1][0], h - padB); g.closePath(); g.fillStyle = grad; g.fill();
      g.strokeStyle = "rgba(43,255,136,.8)"; g.setLineDash([4, 3]); g.lineWidth = 1; g.beginPath(); g.moveTo(padL, by); g.lineTo(w - padR, by); g.stroke(); g.setLineDash([]);
      g.beginPath(); path.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
      g.strokeStyle = "#ff2d95"; g.lineWidth = 2; g.shadowColor = "#ff2d95"; g.shadowBlur = 6; g.stroke(); g.shadowBlur = 0;
      g.fillStyle = "#8a7c9a"; g.font = FONT; g.fillText(tl(t0), padL, h - 2); g.textAlign = "right"; g.fillText(tl(t1) + " Canarias", w - padR, h - 2); g.textAlign = "left";
    },

    /* Candles [{o,h,l,c}] pink (down) / green (up) + two regression trendlines that draw themselves (prog 0..1). */
    ohlc(canvas, cs, prog, fmt) {
      const {g, w, h} = setup(canvas);
      if (!cs || cs.length < 2) return msg(g, w, h, "sin datos suficientes para velas");
      const [lo, hi] = bounds(cs.flatMap(c => [c.h, c.l]), 0.1), padL = 44, padR = 6, padT = 6, padB = 6;
      grid(g, w, h, lo, hi, padL, padR, padT, padB, fmt || sfmt);
      const n = cs.length, cw = (w - padL - padR) / n, X = i => padL + i * cw + cw / 2, Y = v => padT + (h - padT - padB) * (1 - (v - lo) / (hi - lo));
      cs.forEach((c, i) => {
        const col = c.c >= c.o ? "#2bff88" : "#ff2d95"; g.strokeStyle = col; g.fillStyle = col; g.lineWidth = 1;
        g.beginPath(); g.moveTo(Math.round(X(i)) + .5, Y(c.h)); g.lineTo(Math.round(X(i)) + .5, Y(c.l)); g.stroke();
        const top = Y(Math.max(c.o, c.c)), bh = Math.max(2, Math.abs(Y(c.o) - Y(c.c)));
        g.fillRect(Math.round(X(i) - Math.max(1, cw * .32)), top, Math.max(2, Math.round(cw * .64)), bh);
      });
      const fit = vals => { const m = vals.length, sx = (m - 1) * m / 2, sxx = (m - 1) * m * (2 * m - 1) / 6, sy = vals.reduce((a, b) => a + b, 0), sxy = vals.reduce((a, v, i) => a + i * v, 0);
        const b = (m * sxy - sx * sy) / Math.max(1e-9, m * sxx - sx * sx); return [ (sy - b * sx) / m, b ]; };
      const p = Math.max(0, Math.min(1, prog == null ? 1 : prog));
      [[cs.map(c => c.h), "#ffffff"], [cs.map(c => c.l), "#3df0ff"]].forEach(([vals, col]) => {
        const [a, b] = fit(vals), x0 = X(0), x1 = X(0) + (X(n - 1) - X(0)) * p, y0 = Y(a), y1 = Y(a + b * (n - 1) * p);
        g.strokeStyle = col; g.globalAlpha = .8; g.lineWidth = 1.2; g.setLineDash([6, 3]); g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); g.setLineDash([]); g.globalAlpha = 1;
      });
    },

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
      const tl = t => new Date(t * 1000).toLocaleTimeString("es-ES", {hour: "2-digit", minute: "2-digit", timeZone: "Atlantic/Canary"});
      g.fillText(tl(t0), padL, h - 3); g.textAlign = "right"; g.fillText(tl(t1) + " Canarias", w - padR, h - 3); g.textAlign = "left";
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
