/* Desk web app (Paso 8). Read-only, PAPER/LIVE agnostic. No secrets in this file:
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
  const e = $("#eqpct"); e.textContent = pct(ch); e.className = cls(ch);
  $("#cash").textContent = `Stack ${usd(s.stack)} · Caja ${usd(s.cash)} · ${(s.open || []).length} abiertas`;
}

const V = {
  pos() {
    const open = (data.state || {}).open || [];
    if (!open.length) return `<div class="empty">Sin posiciones abiertas.<br><span class="small">El desk sigue escaneando.</span></div>`;
    return open.map((p, i) => `<div class="card"><h3><span>${esc(p.name || p.mint.slice(0, 6))}</span><span class="${cls(p.pct)}">${pct(p.pct)}</span></h3>
      <div class="kv"><span>PnL</span><span class="${cls(p.pnlUsd)}">${usd(p.pnlUsd)}</span><span>Entrada</span><span>${p.entryPrice.toPrecision(4)}</span>
      <span>Precio</span><span>${(p.price || 0).toPrecision(4)}</span><span>Abierta</span><span>${hhmm(p.opened)}</span><span>Estado</span><span>${esc(p.status)}</span></div>
      <canvas id="ch${i}"></canvas>${fomo(p.link) ? `<div class="small"><a href="${esc(fomo(p.link))}" target="_blank" rel="noopener noreferrer">Abrir en FOMO ↗</a></div>` : ""}</div>`).join("");
  },
  night() {
    const r = data.report; if (!r) return `<div class="empty">Sin informe.</div>`;
    const t = r.totals || {}, c = r.coins || {}, a = r.analyst || {}, pu = r.pushes || {};
    const trades = (r.trades || []).map(x => `<li>${esc(x.name || "")} <span class="${cls(x.pnlUsd)}">${usd(x.pnlUsd)}</span><div class="sub">${esc(x.exitReason || x.reason || "")}</div></li>`).join("");
    const kills = (r.kills || []).map(k => `<li>${esc(k.reason)} <span class="muted">× ${k.n}</span></li>`).join("");
    return `<div class="card"><h3><span>Noche ${esc(r.night || "")}</span><span class="${cls(t.pnlUsd)}">${usd(t.pnlUsd)}</span></h3>
      <div class="kv"><span>Trades</span><span>${t.trades ?? 0}</span><span>Win rate</span><span>${t.winRate == null ? "—" : Math.round(t.winRate * (t.winRate <= 1 ? 100 : 1)) + "%"}</span>
      <span>Fees</span><span>${usd(t.feesUsd)}</span><span>Stack</span><span>${usd(t.stackStart)} → ${usd(t.stackEnd)}</span></div></div>
      <div class="card"><h3>Embudo</h3><div class="kv"><span>Vistos</span><span>${c.seen ?? 0}</span><span>Pasan Scanner</span><span>${c.scannerPassed ?? 0}</span>
      <span>Auditados</span><span>${c.audited ?? 0}</span><span>Pasan Auditor</span><span>${c.auditorPassed ?? 0}</span><span>Puntuados</span><span>${a.scored ?? 0}</span>
      <span>Pushes</span><span>${pu.sent ?? 0}</span></div></div>
      ${trades ? `<div class="card"><h3>Trades</h3><ul class="list">${trades}</ul></div>` : ""}
      ${kills ? `<div class="card"><h3>Descartes</h3><ul class="list">${kills}</ul></div>` : ""}`;
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
    return `<div class="card"><h3><span>Salud</span><span class="${h.ok ? "pos" : "neg"}">${h.ok ? "OK" : "revisar"}</span></h3><ul class="list">${Object.entries(ag).map(([k, v]) =>
      `<li><span class="dot ${v.age_s != null && v.age_s < 60 ? "ok" : "bad"}"></span>${esc(k)}${v.paused ? " · pausado" : ""}<div class="sub">latido hace ${v.age_s == null ? "—" : Math.round(v.age_s) + " s"} · ${esc(v.note || "")}</div></li>`).join("")}</ul></div>
      <div class="muted small">Datos de ${hhmm(data.ts)} (Madrid) · se actualizan cada ${data.uploadEveryS || 15} s</div>`;
  }
};

function render() {
  const setup = !creds;
  $("#setup").hidden = !setup; $("#view").hidden = setup; $("#tabs").hidden = setup; $("#top").hidden = setup;
  if (setup) return;
  freshness(); header();
  const v = $("#view");
  if (!data) { v.innerHTML = lastErr ? `<div class="err">${esc(lastErr)}</div>` : `<div class="empty">Cargando…</div>`; return; }
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
  setInterval(() => creds && data && freshness(), 1000);
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
creds = loadCreds();
render();
if (creds) start();
