/* Desk web app (Paso 8, v3: neon pixel dashboard + live network). Read-only, PAPER/LIVE agnostic. No secrets in this file:
   the app token (t) and the data path (d) arrive only in the URL fragment #t=…&d=… (never sent to any server),
   are kept in localStorage on this device, and the fragment is wiped from the address bar.
   Data: R2 public object d/{d}/desk.json, AES-256-GCM, key = SHA-256("trade-desk-app/v1:" + t).
   FOMO links come ready-made in the JSON (links.py); the app never builds them. */
"use strict";
const R2 = "https://pub-b96c46cfcd0c4e3d9159d3bfbdadbd84.r2.dev";
const LS = "desk.creds.v1";
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
const usd = x => x == null ? "—" : (x < 0 ? "-$" : "$") + Math.abs(x).toFixed(2);
const pct = x => x == null ? "—%" : (x > 0 ? "+" : "") + x.toFixed(1) + "%";
const cls = x => x == null ? "" : x >= 0 ? "pos" : "neg";
const hhmm = iso => { try { return new Date(iso).toLocaleTimeString("es-ES", {hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid"}); } catch (e) { return ""; } };
const fomo = u => (typeof u === "string" && u.startsWith("https://")) ? u : null;   // ready-made by links.py

let creds = null, data = null, tab = "pos", key = null, timer = null, lastErr = null;

function parseCreds(s) {
  const i = (s || "").indexOf("#");
  if (i < 0) return null;
  const p = new URLSearchParams(s.slice(i + 1));
  const t = p.get("t"), d = p.get("d");
  return (t && d && t.length >= 32 && d.length >= 32 && /^[A-Za-z0-9_-]+$/.test(t + d)) ? {t, d} : null;
}
function loadCreds() {
  const fromUrl = parseCreds(location.href);
  if (fromUrl) {
    localStorage.setItem(LS, JSON.stringify(fromUrl));
    history.replaceState(null, "", location.pathname + location.search);   // wipe token from the address bar
    return fromUrl;
  }
  try { return JSON.parse(localStorage.getItem(LS) || "null"); } catch (e) { return null; }
}
async function deriveKey(t) {
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("trade-desk-app/v1:" + t));
  return crypto.subtle.importKey("raw", h, "AES-GCM", false, ["decrypt"]);
}
const b64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

async function fetchData() {
  const r = await fetch(`${R2}/d/${encodeURIComponent(creds.d)}/desk.json?_=${Date.now()}`, {cache: "no-store", credentials: "omit", referrerPolicy: "no-referrer"});
  if (r.status === 404 || r.status === 403) throw new Error("enlace no válido o desk sin publicar (" + r.status + ")");
  if (!r.ok) throw new Error("HTTP " + r.status);
  const env = await r.json();
  if (env.alg !== "A256GCM") throw new Error("formato desconocido");
  key = key || await deriveKey(creds.t);
  let plain;
  try { plain = await crypto.subtle.decrypt({name: "AES-GCM", iv: b64(env.iv)}, key, b64(env.ct)); }
  catch (e) { throw new Error("token incorrecto: vuelve a abrir el enlace del bot"); }
  return JSON.parse(new TextDecoder().decode(plain));
}

async function refresh() {
  try { data = await fetchData(); lastErr = null; }
  catch (e) { lastErr = e.message || String(e); }
  render();
}

const AGENTS = [
  {k: "scanner", n: "SCANNER"}, {k: "auditor", n: "AUDITOR"}, {k: "analyst", n: "ANALYST"},
  {k: "executor", n: "EXECUTOR"}, {k: "risk", n: "RISK"}, {k: "telegram", n: "TELEGRAM"}];
const COL = {scanner: "#3df0ff", auditor: "#b78cff", analyst: "#ff5fc1", executor: "#2bff88", risk: "#ff9a3d", telegram: "#5ea8ff", size: "#ffd23f"};
/* 8x8 hand-drawn pixel avatars: "#" agent colour, "o" light, "e" eyes, "a" accent. Original, no real people. */
const AVATAR = {
  scanner:  ["..aaaa..", ".######.", "#oooooo#", "#eeoeeo#", "#oooooo#", ".#oaao#.", "..####..", ".##..##."],
  auditor:  ["...aa...", ".######.", "#oooooo#", "#aeooae#", "#oooooo#", ".#oooo#.", "..#aa#..", ".######."],
  analyst:  [".a....a.", ".######.", "#oooooo#", "#oeooeo#", "#oooooo#", ".#oaao#.", "..####..", "#.####.#"],
  executor: ["aaaaaaaa", ".######.", "#oooooo#", "#eeeeee#", "#oooooo#", ".#oooo#.", "..####..", ".#.##.#."],
  risk:     ["...##...", "..#aa#..", ".######.", "#oeooeo#", "#oooooo#", ".#aaaa#.", "..####..", ".##..##."],
  telegram: ["......a.", ".#####a.", "#oooooo#", "#oeooeo#", "#oooooo#", ".#oaao#.", "..####..", "..#..#.."],
  size:     ["..aaaa..", ".a####a.", "a#oooo#a", "a#o##o#a", "a#oooo#a", ".a####a.", "..aaaa..", "........"],
  logo:     ["##....##", "#.#..#.#", "#..##..#", "........", "########", "#.#..#.#", "#......#", "########"]
};
function avatar(name, color) {
  const pal = {"#": color, "o": "#f4ecff", "e": "#05050c", "a": name === "logo" ? color : "#ff2d95"};
  return `<svg viewBox="0 0 8 8" shape-rendering="crispEdges" aria-hidden="true">${AVATAR[name].map((row, y) =>
    [...row].map((ch, x) => pal[ch] ? `<rect x="${x}" y="${y}" width="1" height="1" fill="${pal[ch]}"/>` : "").join("")).join("")}</svg>`;
}
function spark(vals, color) {
  vals = (vals || []).map(Number).filter(v => isFinite(v));
  if (vals.length < 2) vals = [0, 0];
  const lo = Math.min(...vals), hi = Math.max(...vals), sp = hi - lo || 1, n = vals.length;
  const pts = vals.map((v, i) => `${(i * 100 / (n - 1)).toFixed(1)},${(20 - (v - lo) / sp * 17).toFixed(1)}`).join(" ");
  return `<svg class="spark" viewBox="0 0 100 22" preserveAspectRatio="none" aria-hidden="true"><polygon points="0,22 ${pts} 100,22" fill="${color}" fill-opacity=".14"/><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.5" vector-effect="non-scaling-stroke"/><rect x="98" y="${(20 - (vals[n - 1] - lo) / sp * 17 - 1.5).toFixed(1)}" width="2.5" height="3" fill="#fff"/></svg>`;
}
const noteNum = (note, re) => { const m = String(note || "").match(re); return m ? Number(m[1]) : null; };
const num = (v, d) => v == null ? "—" : Number(v).toFixed(d == null ? 0 : d);
const sumv = a => (a || []).reduce((x, y) => x + y, 0);

function clock() {
  $("#clock").textContent = new Date().toLocaleTimeString("es-ES", {hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Europe/Madrid"}) + " MADRID";
}

function freshness() {
  const el = $("#fresh");
  if (!data) { el.textContent = lastErr ? "error" : "cargando…"; el.className = "fresh dead"; return; }
  const age = Math.max(0, Math.round(Date.now() / 1000 - data.tsEpoch));
  el.textContent = (lastErr ? "⚠︎ " : "") + `datos de hace ${age} s`;
  el.className = "fresh " + (age < 45 ? "ok" : age < 120 ? "old" : "dead");
}

function header() {
  const m = $("#mode"); m.textContent = data ? data.mode : "—";
  m.className = "badge " + (data ? String(data.mode).toLowerCase() : "");
  if (!data) return;
  const s = data.state || {};
  $("#equity").textContent = usd(s.equity);
  const ch = (s.stack && s.equity != null) ? (s.equity / s.stack - 1) * 100 : null;
  const e = $("#balpct"); e.textContent = pct(ch); e.className = cls(ch);
  $("#baltitle").textContent = `BALANCE · ${data.mode || ""}`;
  $("#cash").textContent = `stack ${usd(s.stack)} · caja ${usd(s.cash)}`;
}

function cardData(k, hb) {
  const r = data.report || {}, c = r.coins || {}, an = r.analyst || {}, pu = r.pushes || {}, s = data.state || {}, open = s.open || [];
  const set = data.settings || {}, note = hb ? hb.note : "";
  switch (k) {
    case "scanner": return {kpi: num(c.seen), lab: "vistos", sub: `pasan ${num(c.scannerPassed)} · fuera ${num(noteNum(note, /killed=(\d+)/))}`};
    case "auditor": return {kpi: `${num(c.auditorPassed)}/${num(c.audited)}`, lab: "pasan/aud.", sub: `${num(noteNum(note, /(\d+) rejected/))} rechazados`};
    case "analyst": {
      const a = data.analysis || {}, sc = a.kind === "verdict" ? a.score : null;
      return {kpi: sc == null ? "—" : num(sc), lab: "últ. score", sub: `${num(an.scored)} punt. · min ${set.analyst ? set.analyst.min_score : "—"}`};
    }
    case "executor": return {kpi: String(open.length), lab: "abiertas", sub: `${num(pu.sent)} push · ${num(pu.bought)} compras`};
    case "risk": {
      const u = open.reduce((a, p) => a + (p.pnlUsd || 0), 0), rs = set.risk || {};
      return {kpi: usd(u), lab: "PnL abierto", sub: `stop ${rs.stop_pct} · trail ${rs.trail_pct}`, cls: cls(open.length ? u : null)};
    }
    case "telegram": return {kpi: num(pu.sent), lab: "pushes", sub: note || "—"};
  }
  return {};
}

function cards() {
  const ag = (data.health || {}).agents || {}, maxAge = ((data.settings || {}).health || {}).heartbeat_max_age_s || 45;
  const sp = (data.spark || {}).agents || {};
  const html = AGENTS.map(a => {
    const hb = ag[a.k], fresh = hb && hb.age_s != null && hb.age_s < maxAge;
    const st = !hb ? "bad" : hb.paused ? "paused" : fresh ? "ok" : "bad";
    const d = cardData(a.k, hb), s = sp[a.k] || [];
    return `<div class="card c-${a.k}"><div class="hd">${avatar(a.k, COL[a.k])}<span>${a.n}</span><span class="st ${st}" title="${hb ? "latido " + Math.round(hb.age_s) + " s" : "sin latido"}"></span></div>
      <div class="kpi"><b class="${d.cls || ""}">${esc(d.kpi)}</b><span>${esc(d.lab)}<br>${sumv(s)} ev/2h</span></div>
      ${spark(s, COL[a.k])}<div class="line">${esc(d.sub)}</div></div>`;
  });
  const s = data.state || {}, eq = (data.equitySeries || []).map(p => p[1]);
  const ch = (s.stack && s.equity != null) ? (s.equity / s.stack - 1) * 100 : null;
  html.push(`<div class="card c-size"><div class="hd">${avatar("size", COL.size)}<span>SIZE</span><span class="st ok"></span></div>
    <div class="kpi"><b>${usd(s.equity)}</b><span class="${cls(ch)}">${pct(ch)}<br>ticket ${esc(((data.settings || {}).executor || {}).stack_pct)}</span></div>
    ${spark(eq.slice(-40), COL.size)}<div class="line">stack ${usd(s.stack)} · caja ${usd(s.cash)}</div></div>`);
  $("#cards").innerHTML = html.join("");
  const n = Object.values(ag).filter(h => h && h.age_s != null && h.age_s < maxAge).length;
  $("#officeinfo").textContent = `${n}/${Object.keys(ag).length} con latido · paquetes = actividad real`;
}

/* Token bubbles: identicon from the mint (5x5 mirrored, 2 colours) + initials. No logos. */
function hash32(s) { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }
function identicon(mint) {
  const h = hash32(mint || "?"), h2 = hash32((mint || "?") + "#");
  const c1 = `hsl(${h % 360},85%,58%)`, c2 = `hsl(${(h >> 9) % 360},70%,22%)`;
  let out = `<rect width="5" height="5" fill="${c2}"/>`;
  for (let y = 0; y < 5; y++) for (let x = 0; x < 3; x++) if ((h2 >> (y * 3 + x)) & 1) {
    out += `<rect x="${x}" y="${y}" width="1" height="1" fill="${c1}"/>`; if (x < 2) out += `<rect x="${4 - x}" y="${y}" width="1" height="1" fill="${c1}"/>`;
  }
  return `<svg viewBox="0 0 5 5" shape-rendering="crispEdges" aria-hidden="true">${out}</svg>`;
}
const initials = n => (String(n || "?").replace(/[^A-Za-z0-9 ]/g, "").split(/\s+/).filter(Boolean).map(w => w[0]).join("").slice(0, 2) || String(n || "?").slice(0, 2)).toUpperCase();
let seenBubbles = new Set();
function bubbles() {
  const cs = (data.coins || []).slice().sort((a, b) => Date.parse(b.seen) - Date.parse(a.seen)).slice(0, window.innerWidth < 761 ? 14 : 9);
  $("#bubbles").innerHTML = cs.map(c => {
    const st = /pass|bought|ok/.test(c.status || "") ? "ok" : /kill|reject|fail|rug/.test(c.status || "") ? "bad" : "";
    const isNew = seenBubbles.size && !seenBubbles.has(c.mint) ? " new" : "";
    const inner = `${identicon(c.mint)}<b>${esc(initials(c.name))}</b>`;
    const title = esc(`${c.name || ""} · ${c.status || ""}`);
    return fomo(c.link) ? `<a class="bub ${st}${isNew}" href="${esc(fomo(c.link))}" target="_blank" rel="noopener noreferrer" title="${title}">${inner}</a>`
                        : `<span class="bub ${st}${isNew}" title="${title}">${inner}</span>`;
  }).join("") || `<span class="muted small">—</span>`;
  seenBubbles = new Set(cs.map(c => c.mint));
}

/* What the big chart shows: the analysed coin's price, else an open position's price, else coins seen tonight (cumulative). */
function bigSeries() {
  const a = data.analysis;
  if (a && (a.series || []).length >= 3) return {s: a.series, title: `JEV · ${a.name || ""}`.toUpperCase(), sub: "precio", fmt: null};
  for (const p of ((data.state || {}).open || [])) { const s = (data.series || {})[p.mint]; if (s && s.length >= 3) return {s, title: `VIGILANDO · ${p.name || ""}`.toUpperCase(), sub: "precio", fmt: null}; }
  const seen = (data.spark || {}).seen || [];
  if (seen.length >= 2) return {s: seen, title: "COINS VISTOS · NOCHE", sub: "acumulado / 5 min (sin serie de precio)", fmt: v => String(Math.round(v))};
  return {s: data.equitySeries || [], title: "EQUITY", sub: "sin serie de precio", fmt: v => "$" + v.toFixed(2)};
}

function candleData() {
  const a = data.analysis, ps = a && a.series && a.series.length >= 8 ? a.series : null;
  if (ps) {
    const n = Math.min(30, Math.floor(ps.length / 2)), t0 = ps[0][0], t1 = ps[ps.length - 1][0] + 1, step = (t1 - t0) / n, out = [];
    for (let i = 0; i < n; i++) { const b = ps.filter(p => p[0] >= t0 + i * step && p[0] < t0 + (i + 1) * step).map(p => p[1]); if (b.length) out.push({o: b[0], c: b[b.length - 1], h: Math.max(...b), l: Math.min(...b)}); }
    return {cs: out, title: `VELAS · ${(a.name || "").toUpperCase()}`, sub: "precio", fmt: null};
  }
  const sc = ((data.spark || {}).agents || {}).scanner || [];
  const cs = sc.map((v, i) => { const o = i ? sc[i - 1] : v; return {o, c: v, h: Math.max(o, v) + 0.4, l: Math.max(0, Math.min(o, v) - 0.4)}; });
  return {cs, title: "VELAS · FLUJO SCANNER", sub: "eventos / 5 min, 2 h (sin serie de precio)", fmt: v => v.toFixed(0)};
}

function analysis() {
  const a = data.analysis, box = $("#analysis");
  if (!a) { box.innerHTML = `<div class="muted">Jev aún no ha visto ningún coin.</div>`; return; }
  const link = fomo(a.link);
  const name = link ? `<a href="${esc(link)}" target="_blank" rel="noopener noreferrer">${esc(a.name || (a.mint || "").slice(0, 6))} ↗</a>` : esc(a.name || "");
  const rows = [[a.kind === "verdict" ? "Veredicto" : "Último escaneado", a.kind === "verdict" ? `${num(a.score)} / min ${a.minScore == null ? "—" : a.minScore}` : (a.passed ? "pasa" : "no pasa")]];
  if (a.reason) rows.push(["Motivo", a.reason]);
  if (a.liquidityUsd != null) rows.push(["Liquidez", usd(a.liquidityUsd)]);
  if (a.top10Pct != null) rows.push(["Top 10", num(a.top10Pct, 1) + "%"]);
  if (a.h1ChangePct != null) rows.push(["Cambio 1 h", pct(a.h1ChangePct)]);
  if (a.ts) rows.push(["Hora", hhmm(a.ts) + " Madrid"]);
  box.innerHTML = `<div class="ana"><div class="name">${name}</div>${a.kind === "verdict" ? `<div class="gauge"><i data-w="${(a.score || 0) / 100}"></i><b data-w="${(a.minScore || 0) / 100}"></b></div>` : ""}
    ${rows.map(([k, v]) => `<span class="k">${esc(k)}</span><span class="v">${esc(v)}</span>`).join("")}</div>`;
  const gi = box.querySelector(".gauge i"), gb = box.querySelector(".gauge b");
  if (gi) gi.style.width = Math.min(100, Number(gi.dataset.w) * 100) + "%";
  if (gb) gb.style.left = Math.min(100, Number(gb.dataset.w) * 100) + "%";
}

function thresholds() {
  const st = data.settings || {}, order = ["scanner", "auditor", "analyst", "executor", "risk", "health", "desk"];
  const secs = order.filter(k => st[k]).concat(Object.keys(st).filter(k => !order.includes(k)));
  const show = v => typeof v === "string" ? v : JSON.stringify(v);   // exactly as set, no rounding
  $("#thresholds").innerHTML = secs.map(s => `<h4>${esc(s.toUpperCase())}</h4>` +
    Object.entries(st[s] || {}).map(([k, v]) => `<div><span>${esc(k)}</span><span>${esc(show(v))}</span></div>`).join("")).join("");
}

/* Terminal + office events from the real activity feed. */
let lastEvTs = null;
const evTs = x => Date.parse(x.ts) || 0;
function terminal() {
  const acts = (data.activity || []).slice().sort((a, b) => evTs(a) - evTs(b));
  const fresh = lastEvTs == null ? acts.slice(-8) : acts.filter(x => evTs(x) > lastEvTs);
  const span = Math.min(14, (data.uploadEveryS || 15) - 1);
  fresh.forEach((x, i) => window.DeskOffice.fire(x, (i + 0.3) * span / Math.max(1, fresh.length)));
  if (acts.length) lastEvTs = Math.max(lastEvTs || 0, evTs(acts[acts.length - 1]));
  const sec = iso => { try { return new Date(iso).toLocaleTimeString("es-ES", {hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Europe/Madrid"}); } catch (e) { return ""; } };
  const term = $("#term");
  term.innerHTML = acts.slice(-40).map((x, i, arr) => {
    const k = String(x.kind || ""), c = /reject|kill|fail|stop|error|miss/.test(k) ? "bad" : /pass|buy|bought|ok/.test(k) ? "ok" : "";
    return `<div class="${c}${i === arr.length - 1 ? " typing" : ""}"><span class="t">[${sec(x.ts)}]</span> <span class="a">${esc(String(x.agent || "").toUpperCase().padEnd(8, " "))}</span> ${esc(k)} · ${esc(x.text)}</div>`;
  }).join("") || `<div class="muted">&gt; esperando actividad…</div>`;
  $("#logsub").textContent = `${acts.length} eventos · hora Madrid`;
}

let big = null, cand = null;
function animCharts() {
  if (!data || document.visibilityState !== "visible" || !creds) return;
  const now = performance.now() / 1000;
  if (big) window.DeskChart.live($("#bigchart"), big.s, now, big.fmt);
  if (cand) window.DeskChart.ohlc($("#candles"), cand.cs, ((now % 9) / 2), cand.fmt);
}

function dashboard() {
  cards(); bubbles(); analysis(); thresholds(); terminal();
  big = bigSeries(); $("#bigtitle").textContent = big.title; $("#bigsub").textContent = big.sub;
  cand = candleData(); $("#candletitle").textContent = cand.title; $("#candlesub").textContent = cand.sub;
  window.DeskChart.strip($("#balchart"), data.equitySeries || [], ((data.report || {}).totals || {}).stackStart ?? (data.state || {}).stack);
  window.DeskOffice.update(data);
  animCharts();
}

const V = {
  pos() {
    const open = (data.state || {}).open || [];
    if (!open.length) return `<div class="empty">Sin posiciones abiertas.<br><span class="small">El desk sigue escaneando.</span></div>`;
    return open.map((p, i) => `<div class="pcard"><h3><span>${esc(p.name || p.mint.slice(0, 6))}</span><span class="${cls(p.pct)}">${pct(p.pct)}</span></h3>
      <div class="kv"><span>PnL</span><span class="${cls(p.pnlUsd)}">${usd(p.pnlUsd)}</span><span>Entrada</span><span>${p.entryPrice.toPrecision(4)}</span>
      <span>Precio</span><span>${(p.price || 0).toPrecision(4)}</span><span>Abierta</span><span>${hhmm(p.opened)}</span><span>Estado</span><span>${esc(p.status)}</span></div>
      <canvas id="ch${i}"></canvas>${fomo(p.link) ? `<div class="small"><a href="${esc(fomo(p.link))}" target="_blank" rel="noopener noreferrer">Abrir en FOMO ↗</a></div>` : ""}</div>`).join("");
  },
  night() {
    const r = data.report; if (!r) return `<div class="empty">Sin informe.</div>`;
    const t = r.totals || {}, c = r.coins || {}, a = r.analyst || {}, pu = r.pushes || {};
    const trades = (r.trades || []).map(x => `<li>${esc(x.name || "")} <span class="${cls(x.pnlUsd)}">${usd(x.pnlUsd)}</span><div class="sub">${esc(x.exitReason || x.reason || "")}</div></li>`).join("");
    const kills = (r.kills || []).map(k => `<li>${esc(k.reason)} <span class="muted">× ${k.n}</span></li>`).join("");
    return `<div class="pcard"><h3><span>Noche ${esc(r.night || "")}</span><span class="${cls(t.pnlUsd)}">${usd(t.pnlUsd)}</span></h3>
      <div class="kv"><span>Trades</span><span>${t.trades ?? 0}</span><span>Win rate</span><span>${t.winRate == null ? "—" : Math.round(t.winRate * (t.winRate <= 1 ? 100 : 1)) + "%"}</span>
      <span>Fees</span><span>${usd(t.feesUsd)}</span><span>Stack</span><span>${usd(t.stackStart)} → ${usd(t.stackEnd)}</span></div></div>
      <div class="pcard"><h3>Embudo</h3><div class="kv"><span>Vistos</span><span>${c.seen ?? 0}</span><span>Pasan Scanner</span><span>${c.scannerPassed ?? 0}</span>
      <span>Auditados</span><span>${c.audited ?? 0}</span><span>Pasan Auditor</span><span>${c.auditorPassed ?? 0}</span><span>Puntuados</span><span>${a.scored ?? 0}</span>
      <span>Pushes</span><span>${pu.sent ?? 0}</span></div></div>
      ${trades ? `<div class="pcard"><h3>Trades</h3><ul class="list">${trades}</ul></div>` : ""}
      ${kills ? `<div class="pcard"><h3>Descartes</h3><ul class="list">${kills}</ul></div>` : ""}`;
  },
  coins() {
    const cs = data.coins || []; if (!cs.length) return `<div class="empty">Ningún coin esta noche.</div>`;
    return `<ul class="list">${cs.map(c => `<li>${fomo(c.link) ? `<a href="${esc(fomo(c.link))}" target="_blank" rel="noopener noreferrer">${esc(c.name || c.mint.slice(0, 6))}</a>` : esc(c.name)}
      <span class="muted small"> · ${esc(c.status || "")}</span><div class="sub">${hhmm(c.seen)} · ${esc(c.reason || "")}</div></li>`).join("")}</ul>`;
  },
  act() {
    const a = data.activity || []; if (!a.length) return `<div class="empty">Sin actividad.</div>`;
    return `<ul class="list">${a.map(x => `<li>${esc(x.text)}<div class="sub">${hhmm(x.ts)} · ${esc(x.agent)} · ${esc(x.kind)}</div></li>`).join("")}</ul>`;
  },
  health() {
    const h = data.health || {}, ag = h.agents || {};
    return `<div class="pcard"><h3><span>Salud</span><span class="${h.ok ? "pos" : "neg"}">${h.ok ? "OK" : "revisar"}</span></h3><ul class="list">${Object.entries(ag).map(([k, v]) =>
      `<li><span class="dot ${v.age_s != null && v.age_s < 60 ? "ok" : "bad"}"></span>${esc(k)}${v.paused ? " · pausado" : ""}<div class="sub">latido hace ${v.age_s == null ? "—" : Math.round(v.age_s) + " s"} · ${esc(v.note || "")}</div></li>`).join("")}</ul></div>
      <div class="muted small">Datos de ${hhmm(data.ts)} (Madrid) · se actualizan cada ${data.uploadEveryS || 15} s</div>`;
  }
};

function render() {
  const setup = !creds;
  $("#setup").hidden = !setup; $("#dash").hidden = setup; $("#tabs").hidden = setup; $("#top").hidden = setup;
  if (setup) return;
  freshness(); header(); clock();
  const names = {pos: "POSICIONES", night: "NOCHE", coins: "COINS", act: "ACTIVIDAD", health: "SALUD"};
  $("#tabname").textContent = names[tab] || "";
  const v = $("#view");
  if (!data) { v.innerHTML = lastErr ? `<div class="err">${esc(lastErr)}</div>` : `<div class="empty">Cargando…</div>`; return; }
  dashboard();
  v.innerHTML = (lastErr ? `<div class="err small">${esc(lastErr)}</div>` : "") + V[tab]();
  if (tab === "pos") ((data.state || {}).open || []).forEach((p, i) => {
    const c = document.getElementById("ch" + i); if (!c) return;
    window.DeskChart.draw(c, (data.series || {})[p.mint], [
      {v: p.entryPrice, c: "#8a8a8e", n: "entrada"}, {v: p.stopLine, c: "#ff4d4f", n: "stop"}, {v: p.trailLine, c: "#ffb020", n: "trail"}]);
  });
}

function start() {
  if (timer) clearInterval(timer);
  refresh();
  timer = setInterval(() => { if (document.visibilityState === "visible") refresh(); else freshness(); }, 15000);
  setInterval(() => { if (creds) { clock(); if (data) freshness(); } }, 1000);
}

document.querySelectorAll("#tabs button").forEach(b => b.addEventListener("click", () => {
  tab = b.dataset.tab; document.querySelectorAll("#tabs button").forEach(x => x.classList.toggle("on", x === b)); render();
}));
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && creds) refresh(); });
$("#save").addEventListener("click", () => {
  const c = parseCreds($("#paste").value.trim());
  if (!c) { $("#setupmsg").textContent = "Ese enlace no lleva #t=…&d=… completo."; return; }
  localStorage.setItem(LS, JSON.stringify(c)); $("#paste").value = ""; creds = c; key = null; start();
});
window.addEventListener("hashchange", () => { const c = loadCreds(); if (c) { creds = c; key = null; start(); } });

if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
$("#logo").innerHTML = avatar("logo", "#ff2d95");
window.DeskOffice.mount($("#office"));
if (window.matchMedia("(max-width:760px)").matches) $("#thrbox").open = false;   // long list: folded on the phone
setInterval(animCharts, 100);     // live charts ~10 fps, nothing while hidden
let rz = null;
window.addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(() => data && render(), 200); });
creds = loadCreds();
render();
if (creds) start();
