// Ovocný souboj – obrazovky, synchronizace kol, sekání, naschvály, zvuk.
import * as Sim from "./sim.js";
import * as Net from "./net.js";
import { createScene } from "./scene.js";

const $ = id => document.getElementById(id);
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const params = new URLSearchParams(location.search);
const BASE = location.origin + location.pathname;
const COLORS = { x: "#FF9A4D", o: "#5FE0C3" };
const STAKES = ["kafe", "zmrzlina", "drink", "vybírá vítěz"];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const other = s => s === "x" ? "o" : "x";
const clampName = s => (s || "").trim().replace(/\s+/g, " ").slice(0, 18);
const sameName = (a, b) => !!a && !!b && a.toLocaleLowerCase("cs") === b.toLocaleLowerCase("cs");

// ---------- 3D a plátno čepele ----------
const scene = createScene($("gl"), { reduced });
const blade = $("blade"), bctx = blade.getContext("2d");
function resize() {
  const w = innerWidth, h = innerHeight, pr = Math.min(devicePixelRatio || 1, 2);
  document.documentElement.style.setProperty("--app-h", h + "px");   // iOS: dvh bývá o lištu vedle
  scene.resize(w, h);
  blade.width = Math.round(w * pr); blade.height = Math.round(h * pr);
  const sc = $("stains"); sc.width = w; sc.height = h;
  bctx.setTransform(pr, 0, 0, pr, 0, 0);
}
addEventListener("resize", resize);
addEventListener("orientationchange", () => setTimeout(resize, 120));
if (window.visualViewport) visualViewport.addEventListener("resize", resize);
resize();

// pracovní deska: tmavé dřevo s jemnou kresbou let, zámky prken a vinětou. Kreslí se jednou při resize (canvas 2D,
// deterministicky ze semínka), žádné obrázky. Klidná plocha, na které vynikne barevné ovoce a šťáva.
const boardCv = $("board");
function paintBoard() {
  const w = innerWidth, h = innerHeight, pr = Math.max(0.6, Math.min(devicePixelRatio || 1, 1.5, Math.sqrt(2.4e6 / (w * h))));
  boardCv.width = Math.round(w * pr); boardCv.height = Math.round(h * pr);
  const g = boardCv.getContext("2d"), r = Sim.rng(20261031);
  g.setTransform(pr, 0, 0, pr, 0, 0);
  const bandH = Math.max(110, Math.min(190, h / 5)), nB = Math.ceil(h / bandH);
  for (let b = 0; b < nB; b++) {
    const y0 = b * bandH, tone = (r() - 0.5) * 0.045;
    const gr = g.createLinearGradient(0, y0, 0, y0 + bandH);
    const L = v => `hsl(22 ${36 + tone * 40}% ${Math.max(8, v + tone * 100)}%)`;
    gr.addColorStop(0, L(17)); gr.addColorStop(1, L(14));
    g.fillStyle = gr; g.fillRect(0, y0, w, bandH + 1);
    // kresba let: dlouhé vlnité tahy, tmavé a světlé
    const n = Math.round(bandH * w / 2600);
    for (let i = 0; i < n; i++) {
      const x = r() * (w + 400) - 200, y = y0 + 4 + r() * (bandH - 8), len = 160 + r() * 520, amp = 1 + r() * 3.5;
      g.strokeStyle = r() < 0.58 ? `rgba(12,6,2,${0.08 + r() * 0.12})` : `rgba(150,100,58,${0.05 + r() * 0.08})`;
      g.lineWidth = 0.6 + r() * 1.3;
      g.beginPath(); g.moveTo(x, y);
      g.bezierCurveTo(x + len * 0.3, y - amp, x + len * 0.65, y + amp, x + len, y + (r() - 0.5) * 2);
      g.stroke();
    }
    // suk
    if (r() < 0.6) {
      const kx = r() * w, ky = y0 + bandH * (0.3 + r() * 0.4), kr = 9 + r() * 14;
      for (let k = 4; k >= 1; k--) { g.strokeStyle = `rgba(12,6,2,${0.05 + (4 - k) * 0.035})`; g.lineWidth = 1.2; g.beginPath(); g.ellipse(kx, ky, kr * k / 2.2 + 8, kr * k / 5 + 2.5, 0, 0, Math.PI * 2); g.stroke(); }
      g.fillStyle = "rgba(10,5,2,.28)"; g.beginPath(); g.ellipse(kx, ky, kr * 0.5, kr * 0.28, 0, 0, Math.PI * 2); g.fill();
    }
    // zámek prken
    if (w > 600) { const jx = (0.15 + r() * 0.7) * w; g.fillStyle = "rgba(8,4,1,.55)"; g.fillRect(jx, y0, 2, bandH); g.fillStyle = "rgba(190,130,80,.07)"; g.fillRect(jx + 2, y0, 1, bandH); }
    // spára mezi prkny
    g.fillStyle = "rgba(8,4,1,.7)"; g.fillRect(0, y0 + bandH - 2, w, 2);
    g.fillStyle = "rgba(190,130,80,.07)"; g.fillRect(0, y0 + bandH, w, 1);
  }
  // viněta: střed o chlup světlejší, okraje do tmy
  const R = Math.hypot(w, h) * 0.62, v = g.createRadialGradient(w / 2, h * 0.46, R * 0.12, w / 2, h * 0.46, R);
  v.addColorStop(0, "rgba(255,190,120,.09)"); v.addColorStop(0.5, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(0,0,0,.62)");
  g.fillStyle = v; g.fillRect(0, 0, w, h);
}
let boardRaf = 0;
addEventListener("resize", () => { cancelAnimationFrame(boardRaf); boardRaf = requestAnimationFrame(paintBoard); });
paintBoard();

// skvrny šťávy na desce: pár jemných kaluží, které za pár vteřin zmizí
const stainCv = $("stains"), sctx = stainCv.getContext("2d"), stains = [];
const JUICE = { meloun: "#F0505A", pomeranc: "#FFA02B", svestka: "#9B5BD4", citron: "#FFE45C", jablko: "#FFF1B8", kiwi: "#A6D654", karambola: "#FFD84A" };
function addStain(x, y, kind) {
  if (stains.length >= 12) stains.shift();
  const r = 20 + Math.random() * 16;
  stains.push({ x, y, c: JUICE[kind] || "#FFF1B8", t: performance.now(), r, dots: Array.from({ length: 6 }, () => { const a = Math.random() * 6.283; return [Math.cos(a) * r * (0.8 + Math.random() * 0.8), Math.sin(a) * r * (0.8 + Math.random() * 0.8), 2 + Math.random() * 4]; }) });
}
let stainDirty = false;
function drawStains(now) {
  if (!stains.length) { if (stainDirty) { sctx.clearRect(0, 0, stainCv.width, stainCv.height); stainDirty = false; } return; }
  stainDirty = true;
  sctx.clearRect(0, 0, stainCv.width, stainCv.height);
  for (let i = stains.length - 1; i >= 0; i--) {
    const s = stains[i], age = (now - s.t) / 4500;
    if (age >= 1) { stains.splice(i, 1); continue; }
    sctx.globalAlpha = 0.34 * (1 - age) ** 1.6; sctx.fillStyle = s.c;
    sctx.beginPath(); sctx.ellipse(s.x, s.y, s.r * (1 + age * 0.15), s.r * 0.72, 0.3, 0, 6.283); sctx.fill();
    for (const [dx, dy, dr] of s.dots) { sctx.beginPath(); sctx.arc(s.x + dx, s.y + dy * 0.8, dr, 0, 6.283); sctx.fill(); }
  }
  sctx.globalAlpha = 1;
}

// dotyk: žádný zoom, dvojklik ani gesta stránky při sekání (iOS Safari ignoruje user-scalable)
for (const ev of ["gesturestart", "gesturechange", "gestureend"]) document.addEventListener(ev, e => e.preventDefault());
document.addEventListener("dblclick", e => e.preventDefault());
document.addEventListener("touchmove", e => { if (!e.target.closest("#panel")) e.preventDefault(); }, { passive: false });
const buzz = p => { try { navigator.vibrate && navigator.vibrate(p); } catch {} };
const fmtClock = sec => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
// délka kola ve větě: 60000 -> "minuta" / "1 minutu", 120000 -> "dvě minuty" / "2 minuty"
const lenNom = ms => ms === 60000 ? "minuta" : ms === 120000 ? "dvě minuty" : ms % 60000 === 0 ? ms / 60000 + " minut" : Math.round(ms / 1000) + " sekund";
const lenAcc = ms => ms === 60000 ? "1 minutu" : ms === 120000 ? "2 minuty" : ms % 60000 === 0 ? ms / 60000 + " minut" : Math.round(ms / 1000) + " s";
const roundMs = () => (room && room.meta.g.rl) || Sim.ROUND_MS;
const bodu = n => n === 1 ? "bod" : n >= 2 && n <= 4 ? "body" : "bodů";

// ---------- módy: jedna řada čipů (na čas 1/2 min, závod, tři životy), pod ní jedna věta s pravidlem ----------
// ?kolo=N (s) zkrátí kolo každého módu, ?cil=N změní cíl závodu (obojí jen pro testy)
const TEST_RL = params.get("kolo") ? Math.max(10, Math.min(120, +params.get("kolo") || 120)) * 1000 : 0;
const TEST_TG = params.get("cil") ? Math.max(5, Math.min(200, +params.get("cil") || Sim.TARGET)) : 0;
const CHOICES = [
  { id: "cas60", md: "cas", rl: 60000, label: "1 min" },
  { id: "cas120", md: "cas", rl: 120000, label: "2 min" },
  { id: "zavod", md: "zavod", label: `Do ${Sim.TARGET}` },
  { id: "zivoty", md: "zivoty", label: "3 životy" },
];
const choiceId = (md, rl) => md === "cas" ? (rl === 60000 ? "cas60" : "cas120") : Sim.modeOf(md);
const rlFor = c => TEST_RL || Sim.lengthFor(c.md, c.rl);
const modeName = (md, tg) => md === "zavod" ? `Do ${tg} bodů` : md === "zivoty" ? "Tři životy" : "Na čas";
const modeLine = (md, rl, tg) => md === "zavod" ? `Kdo první nasbírá ${tg} bodů, vyhrává.`
  : md === "zivoty" ? "Tři chyby a konec. Vyhrává, kdo vydrží déle."
  : `Kolo na ${lenAcc(rl)}, vyhrává vyšší skóre.`;
const modeChips = sel => CHOICES.map(c => `<button type="button" data-c="${c.id}" aria-pressed="${c.id === sel}">${c.label}</button>`).join("");

// ---------- celá obrazovka: Fullscreen API, na iPhonu nápověda k ploše ----------
const platform = (() => {
  const ua = navigator.userAgent, iphone = /iPhone|iPod/.test(ua), ipad = /iPad/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const root = document.documentElement, api = !!(root.requestFullscreen || root.webkitRequestFullscreen) && (document.fullscreenEnabled !== false);
  return { ios: iphone || ipad, canFs: api && !iphone, standalone: !!navigator.standalone || matchMedia("(display-mode: standalone)").matches };
})();
(() => {
  const btn = $("fs"), hint = $("iosHint");
  const isFs = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
  const svg = on => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${on ? '<path d="M9 4v4a1 1 0 0 1-1 1H4M15 4v4a1 1 0 0 0 1 1h4M9 20v-4a1 1 0 0 0-1-1H4M15 20v-4a1 1 0 0 1 1-1h4"/>' : '<path d="M4 9V5a1 1 0 0 1 1-1h4M20 9V5a1 1 0 0 0-1-1h-4M4 15v4a1 1 0 0 0 1 1h4M20 15v4a1 1 0 0 1-1 1h-4"/>'}</svg>`;
  const paint = () => { btn.innerHTML = svg(isFs()); btn.setAttribute("aria-label", isFs() ? "Ukončit celou obrazovku" : "Celá obrazovka"); };
  if (platform.canFs && !platform.standalone) {
    btn.hidden = false; paint();
    btn.addEventListener("click", async () => {
      try {
        if (isFs()) await (document.exitFullscreen || document.webkitExitFullscreen).call(document);
        else { const r = document.documentElement; await (r.requestFullscreen || r.webkitRequestFullscreen).call(r, { navigationUI: "hide" }); }
      } catch { toast("Prohlížeč celou obrazovku nepustil."); }
    });
    for (const ev of ["fullscreenchange", "webkitfullscreenchange"]) document.addEventListener(ev, () => { paint(); resize(); });
  }
  if (platform.ios && !platform.canFs && !platform.standalone && Net.store.get("ovs-ioshint") !== "1") {
    hint.hidden = false;
    $("iosHintX").addEventListener("click", () => { hint.hidden = true; Net.store.set("ovs-ioshint", "1"); });
  }
})();

// ---------- zvuk: syntetizovaný, zapne se po prvním dotyku ----------
const sound = (() => {
  let ac = null, on = Net.store.get("ovs-sound") !== "0", noise = null;
  const btn = $("sound");
  const icon = () => {
    btn.innerHTML = on
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l5 6M22 9l-5 6"/></svg>';
    btn.setAttribute("aria-label", on ? "Vypnout zvuk" : "Zapnout zvuk");
  };
  icon();
  btn.addEventListener("click", () => { on = !on; Net.store.set("ovs-sound", on ? "1" : "0"); icon(); unlock(); });
  function unlock() {
    if (ac || !on) { if (ac && ac.state === "suspended") ac.resume(); return; }
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      noise = ac.createBuffer(1, ac.sampleRate * 0.5, ac.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch { ac = null; }
  }
  addEventListener("pointerdown", unlock, { capture: true });
  addEventListener("keydown", unlock, { capture: true });
  const env = (g, t, a, peak, d) => { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); };
  function hiss(freq, q, peak, dur, type = "bandpass") {
    const t = ac.currentTime, src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    src.buffer = noise; f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    src.connect(f).connect(g).connect(ac.destination); env(g, t, 0.01, peak, dur); src.start(t); src.stop(t + dur + 0.05);
    return f;
  }
  function tone(freq, dur, peak = 0.15, type = "sine", at = 0, slide = 0) {
    const t = ac.currentTime + at, o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    o.connect(g).connect(ac.destination); env(g, t, 0.008, peak, dur); o.start(t); o.stop(t + dur + 0.05);
  }
  const ok = () => on && ac && ac.state === "running";
  return {
    swish(speed) { if (!ok()) return; const f = hiss(1200 + Math.min(speed, 4000) * 0.6, 1.2, 0.05, 0.12); f.frequency.exponentialRampToValueAtTime(600, ac.currentTime + 0.12); },
    squish(pitch = 1) { if (!ok()) return; hiss(500 * pitch, 2, 0.22, 0.16, "lowpass"); tone(220 * pitch, 0.09, 0.12, "triangle", 0, 140 * pitch); },
    crunch() { if (!ok()) return; hiss(3200, 3, 0.18, 0.12, "highpass"); tone(1800, 0.05, 0.05, "square"); },
    boom() { if (!ok()) return; hiss(180, 0.8, 0.55, 0.6, "lowpass"); tone(90, 0.45, 0.35, "sine", 0, 40); },
    combo(n) { if (!ok()) return; [0, 4, 7, 12].slice(0, Math.min(4, n)).forEach((s, i) => tone(523 * 2 ** (s / 12), 0.14, 0.11, "triangle", i * 0.07)); },
    precise() { if (!ok()) return; tone(1568, 0.1, 0.1, "triangle"); tone(2093, 0.2, 0.09, "sine", 0.07); tone(3136, 0.12, 0.04, "sine", 0.13); },
    beep(hi) { if (!ok()) return; tone(hi ? 880 : 587, hi ? 0.32 : 0.14, 0.14, "square"); },
    incoming() { if (!ok()) return; tone(392, 0.09, 0.12, "triangle"); tone(311, 0.16, 0.12, "triangle", 0.1); },
    send() { if (!ok()) return; tone(660, 0.12, 0.08, "sine", 0, 1320); },
    miss() { if (!ok()) return; hiss(260, 1.2, 0.12, 0.14, "lowpass"); tone(196, 0.18, 0.13, "triangle", 0, 110); },
    end() { if (!ok()) return; [0, 3, 7].forEach((s, i) => tone(392 * 2 ** (s / 12), 0.5, 0.09, "triangle", i * 0.12)); },
  };
})();

// ---------- stav ----------
let room = null;   // { id, meta, seat, w (writer), opp (doc soupeře), seenEv }
let phase = "menu";
let view = null;
let K = 0;         // klíč právě hraného nebo posledního kola
const game = {
  sched: [], next: 0, live: [], score: 0, start: 0, end: 0, rl: Sim.ROUND_MS, doneAt: 0, waitHold: 0, ev: [], lastSend: -1e9,
  queue: [], lastApplied: -1e9, stroke: null, frozenLeft: 0, cuts: 0, bombs: 0, sent: 0, got: 0,
  precise: 0, charge: 0, fireN: 0, lastPos: { x: 0, y: 0 },
  md: "cas", tg: Sim.TARGET, lives: Sim.LIVES, fin: null, oppF: null, endWhy: null,   // mód kola, cíl, životy, můj a soupeřův čas cíle/smrti
};
const stats = { frames: 0, time: 0, worst: [], samples: [] };

const seatKey = id => "ovs-seat-" + id;
const myName = () => room ? (room.seat === "o" ? room.meta.g.b : room.meta.g.a) : "";
const oppName = () => room ? (room.seat === "o" ? room.meta.g.a : room.meta.g.b) || "soupeř" : "soupeř";
const nameOfSeat = s => s === "x" ? room.meta.g.a : room.meta.g.b;
const mine = () => room && room.w ? room.w.doc() : null;
function paintSeatColors() {
  const me = room && room.seat ? room.seat : "x";
  document.documentElement.style.setProperty("--me", COLORS[me]);
  document.documentElement.style.setProperty("--opp", COLORS[other(me)]);
}

// ---------- drobnosti UI ----------
function toast(t) {
  const el = $("toast");
  el.textContent = t; el.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => el.hidden = true, 2800);
}
function setNet(t) { $("net").textContent = t; $("net").hidden = !t; }
function cells(el, n) {
  const s = String(Math.max(0, n)).padStart(3, "0");
  if (el.children.length !== 3) el.innerHTML = "<b></b><b></b><b></b>";
  [...s].forEach((ch, i) => {
    const b = el.children[i];
    if (b.textContent !== ch) {
      b.textContent = ch;
      if (!reduced) { b.classList.remove("flip"); void b.offsetWidth; b.classList.add("flip"); }
    }
  });
}
// plovoucí text u řezu; nový se posune nad ještě viditelné texty, aby se nikdy nepřekrývaly (např. „+5“ a „Přesně!“ u karamboly)
const floatBoxes = [];
function float(x, y, html, cls = "") {
  const el = document.createElement("div");
  el.className = "float " + cls; el.innerHTML = html;
  el.style.left = x + "px"; el.style.top = y + "px";
  $("floats").appendChild(el);
  const w = el.offsetWidth, h = el.offsetHeight, t = performance.now();
  while (floatBoxes.length && t - floatBoxes[0].t > 1100) floatBoxes.shift();
  const obstacles = floatBoxes;
  const top = ($("hud").hidden ? 0 : $("hud").getBoundingClientRect().bottom) + 8;   // pod cedulkami, nikdy ne přes ně
  x = Math.max(w / 2 + 6, Math.min(innerWidth - w / 2 - 6, x));
  y = Math.max(top + h / 2, y);
  const clash = yy => obstacles.find(b => Math.abs(b.x - x) < (b.w + w) / 2 + 4 && Math.abs(b.y - yy) < (b.h + h) / 2 + 2);
  const slide = dir => {                                  // posouvá nad (-1) nebo pod (+1) překážky, dokud se vejde na obrazovku
    let yy = y;
    for (let g = 0; g < 8; g++) {
      const b = clash(yy);
      if (!b) return yy;
      yy = b.y + dir * ((b.h + h) / 2 + 4);
      if (yy < top + h / 2 || yy > innerHeight - h / 2 - 70) return null;
    }
    return null;
  };
  if (clash(y)) { const u = slide(-1), d = u === null ? slide(1) : null; y = u !== null ? u : d !== null ? d : y; }
  el.style.left = x + "px"; el.style.top = y + "px";
  floatBoxes.push({ x, y, w, h, t });
  setTimeout(() => el.remove(), 1400);
}
function shot(x, y) {
  const el = document.createElement("div"), r = $("signOpp").getBoundingClientRect();
  el.className = "shot"; el.style.left = x - 8 + "px"; el.style.top = y - 8 + "px";
  $("floats").appendChild(el);
  requestAnimationFrame(() => requestAnimationFrame(() => {
    el.style.transform = `translate(${r.left + r.width / 2 - x}px, ${r.top + r.height / 2 - y}px) scale(.6)`;
    el.style.opacity = "0.2";
  }));
  setTimeout(() => el.remove(), 650);
}
const ICONS = {
  bomba: c => `<circle cx="16" cy="20" r="11" fill="#232B3D"/><rect x="5" y="18" width="22" height="4" fill="${c}"/><path d="M21 9 q4 -6 8 -3" stroke="#C8A26B" stroke-width="2" fill="none"/><circle cx="29" cy="6" r="3" fill="#FFD27A"/>`,
  smouha: c => `<path d="M6 14c0-6 9-9 13-6 5-3 11 2 9 8 4 4-1 11-6 9-3 5-11 4-12-1-5 0-8-6-4-10z" fill="${c}"/><circle cx="12" cy="30" r="2.4" fill="${c}"/><circle cx="25" cy="31" r="1.8" fill="${c}"/>`,
  mraz: c => `<g stroke="#2C6A8F" stroke-width="2.4" stroke-linecap="round"><path d="M17 3v28M5 10l24 14M29 10L5 24"/></g><circle cx="17" cy="17" r="5" fill="${c}"/>`,
};

// ---------- obrazovky v panelu ----------
const panel = $("panel");
function showView(name, html, wide) {
  const same = view === name;
  view = name;
  document.body.dataset.view = name || "";
  panel.hidden = !html;
  panel.innerHTML = html ? `<section class="tag${wide ? " wide" : ""}${same ? " still" : ""}" data-view="${name}">${html}</section>` : "";
  panel.scrollTop = 0;
  panel.querySelectorAll("details.how").forEach(d => { d.open = innerHeight >= 800; });   // na nízkém displeji sbalené
  const first = panel.querySelector("[autofocus]");
  if (first && matchMedia("(pointer: fine)").matches) first.focus();
}
// obrazovka ve dvou sloupcích (desktop, telefon na šířku) nebo pod sebou (mobil na výšku): části podle oblastí mřížky
const cols = o => `<div class="cols">${["head", "intro", "form", "how", "deco", "cta"].map(k => o[k] ? `<div class="a-${k}">${o[k]}</div>` : "").join("")}</div>`;
const DECO = `<svg class="deco" viewBox="0 0 220 96" aria-hidden="true"><g transform="rotate(-14 110 58)"><path d="M50 56a60 60 0 0 0 120 0z" fill="#1D5428"/><path d="M56 56a54 54 0 0 0 108 0z" fill="#2F7D3A"/><path d="M62 56a48 48 0 0 0 96 0z" fill="#F1E6D0"/><path d="M66 56a44 44 0 0 0 88 0z" fill="#E8414B"/><g fill="#1B1A17"><ellipse cx="92" cy="78" rx="3.2" ry="5.5"/><ellipse cx="110" cy="88" rx="3.2" ry="5.5"/><ellipse cx="128" cy="78" rx="3.2" ry="5.5"/></g></g><path d="M18 20L206 62" stroke="#1B1A17" stroke-opacity=".25" stroke-width="9" stroke-linecap="round"/><path d="M18 20L206 62" stroke="#C8372D" stroke-width="3.5" stroke-linecap="round"/><circle cx="168" cy="22" r="4" fill="#C8372D"/><circle cx="186" cy="12" r="2.6" fill="#C8372D"/></svg>`;
const howEnd = (md, ms, tg) => md === "zavod" ? `Závod: kdo první nasbírá ${tg} bodů, bere souboj a oběma kolo skončí. Když to do ${fmtClock(Math.round(ms / 1000))} nikdo nedá, rozhodne skóre.`
  : md === "zivoty" ? `Tři životy: propadlé ovoce nebo seknutá bomba bere život a tempo pořád zrychluje. Vyhrává, kdo vydrží déle; když vydržíte oba ${lenAcc(ms)}, rozhodne skóre.`
  : `Kolo na ${lenAcc(ms)}, vyhrává vyšší skóre.`;
const howText = (md, ms, tg) => `Táhni přes ovoce, <b>bomby nesekej</b>. Řez blízko středu dá <b>Přesně!</b> a <span class="pts">+2 body</span>. Řezy nabíjejí měřič pod tvým jménem, plný pošle soupeři naschvál (šmouhu, mráz nebo bombu); combo 3+ a karambola ho pošlou hned, přesně rozseknutý led ho vrátí. ${howEnd(md, ms, tg)}`;
const howTo = (md, ms, tg, id = "") => `<details class="how"${id ? ` id="${id}"` : ""}><summary>Jak se hraje</summary><p>${howText(md, ms, tg)}</p></details>`;

function viewSetup() {
  phase = "menu"; $("hud").hidden = true;
  const last = Net.store.get("ovs-name") || "";
  showView("setup", cols({
    head: `<h1>Ovocný souboj</h1>`,
    intro: `<p class="opt">Sekáte naráz, každý na svém displeji, stejné ovoce ve stejném pořadí. Kdo má na konci kola víc bodů, bere souboj.</p>`,
    form: `
    <div class="pair">
      <div><label for="fMe">Tvoje jméno</label><input id="fMe" type="text" maxlength="18" autocomplete="given-name" value="${esc(last)}" placeholder="třeba Mark" autofocus></div>
      <div><label for="fOpp">Koho vyzýváš</label><input id="fOpp" type="text" maxlength="18" placeholder="třeba Radka"></div>
    </div>
    <span class="lab" id="modeLab">Mód</span>
    <div class="chips" id="modeChips" role="group" aria-labelledby="modeLab">${modeChips("cas120")}</div>
    <p class="modeline" id="modeLine">${modeLine("cas", Sim.ROUND_MS, TEST_TG || Sim.TARGET)}</p>
    <span class="lab" id="stakeLab">O co hrajeme <span class="small">(nepovinné)</span></span>
    <div class="chips" id="chips" role="group" aria-labelledby="stakeLab">${STAKES.map(s => `<button type="button" aria-pressed="false">${s}</button>`).join("")}</div>
    <input id="fStake" type="text" maxlength="40" placeholder="nebo napiš vlastní sázku" style="margin-top:8px">`,
    how: howTo("cas", Sim.ROUND_MS, TEST_TG || Sim.TARGET, "setupHow"),
    deco: DECO,
    cta: `<button class="btn" id="bCreate">Připravit výzvu</button>`,
  }), true);
  const chips = $("chips"), stake = $("fStake"), modes = $("modeChips");
  const picked = () => CHOICES.find(c => c.id === modes.querySelector("[aria-pressed=true]").dataset.c);
  modes.addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    modes.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
    const c = picked(), rl = rlFor(c), tg = TEST_TG || Sim.TARGET;
    $("modeLine").textContent = modeLine(c.md, rl, tg);
    $("setupHow").querySelector("p").innerHTML = howText(c.md, rl, tg);
  });
  chips.addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    const was = b.getAttribute("aria-pressed") === "true";
    chips.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", "false"));
    b.setAttribute("aria-pressed", String(!was));
    stake.value = was ? "" : b.textContent;
  });
  $("bCreate").addEventListener("click", async () => {
    const a = clampName($("fMe").value), b = clampName($("fOpp").value);
    if (!a) { $("fMe").focus(); toast("Napiš svoje jméno, ať soupeř ví, kdo ho vyzývá."); return; }
    if (sameName(a, b)) { $("fOpp").focus(); toast("Soupeř nemůže mít stejné jméno jako ty. Napiš jeho jméno, nebo pole nech prázdné."); return; }
    Net.store.set("ovs-name", a);
    $("bCreate").disabled = true; $("bCreate").textContent = "Chystám výzvu…";
    try { await createRoom(a, b || "", stake.value.trim().slice(0, 40), picked()); }
    catch { $("bCreate").disabled = false; $("bCreate").textContent = "Připravit výzvu"; toast("Spojení nevyšlo, zkus to znovu."); }
  });
}

const linkFor = () => BASE + "#r." + room.id;
function message() {
  const g = room.meta.g;
  const md = Sim.modeOf(g.md), what = md === "zavod" ? `závod do ${g.tg} bodů` : md === "zivoty" ? "tři životy, kdo vydrží déle" : `jedno kolo na ${lenAcc(g.rl)}`;
  return `${g.a} tě vyzývá na Ovocný souboj. Sekáme ovoce naráz, každý na svém mobilu, ${what}.${g.st ? " Hrajeme o: " + g.st + "." : ""} Přijmi tady: ${linkFor()}`;
}
function viewShare() {
  phase = "menu"; $("hud").hidden = true;
  const g = room.meta.g;
  showView("share", cols({
    head: `<h2>Pošli výzvu${g.b ? `, ať ${esc(g.b)} ví` : ""}</h2>`,
    intro: `<p>Odkaz posíláš jen jednou, na něm pak hrajete všechna kola i odvety.</p>`,
    form: `<p class="msg" id="msg">${esc(message())}</p>`,
    cta: `<div class="row">
      <button class="btn" id="bShare"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V3M7 8l5-5 5 5"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>Poslat</button>
      <button class="btn" id="bCopy"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></svg>Kopírovat</button>
    </div>
    <button class="btn alt" id="bLobby">Počkat na soupeře</button>`,
  }), true);
  if (!navigator.share) $("bShare").remove();
  $("bShare")?.addEventListener("click", async () => { try { await navigator.share({ text: message() }); } catch {} });
  $("bCopy").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(message()); toast("Zkopírováno, vlož to do chatu."); }
    catch { getSelection().selectAllChildren($("msg")); toast("Označeno, zkopíruj to ručně."); }
  });
  $("bLobby").addEventListener("click", () => { decide(true); });
}
const introWhat = g => {
  const md = Sim.modeOf(g.md);
  return md === "zavod" ? `závod do ${g.tg} bodů, stejné ovoce pro oba, kdo dřív, ten bere.`
    : md === "zivoty" ? "tři životy, stejné ovoce pro oba, vyhrává, kdo vydrží déle."
    : `${lenNom(g.rl)} sekání, stejné ovoce pro oba, vyhrává vyšší skóre.`;
};
function viewIntro() {
  phase = "menu"; $("hud").hidden = true;
  const g = room.meta.g;
  showView("intro", cols({
    head: `<h1>${esc(g.a)} tě vyzývá</h1>`,
    intro: `<p class="chalk">na Ovocný souboj: ${introWhat(g)}</p>${g.st ? `<div class="stake">Hrajeme o: ${esc(g.st)}</div>` : ""}`,
    form: `<label for="fName">Tvoje jméno</label><input id="fName" type="text" maxlength="18" value="${esc(g.b || Net.store.get("ovs-name") || "")}" placeholder="jak ti říkat" autofocus>`,
    how: howTo(Sim.modeOf(g.md), g.rl, g.tg),
    cta: `<button class="btn" id="bAccept">Přijmout výzvu</button><button class="btn alt" id="bMine">Jsem ${esc(g.a)}, výzvu jsem založil(a) já</button>`,
  }), true);
  $("bAccept").addEventListener("click", accept);
  $("bMine").addEventListener("click", () => takeSeat("x"));   // vlastní výzva otevřená v jiném úložišti (Safari, plocha, prohlížeč v chatu)
}
function viewWatch() {
  phase = "menu"; $("hud").hidden = true;
  const g = room.meta.g;
  showView("watch", `
    <h2>Tenhle souboj už hrají ${esc(g.a)} a ${esc(g.b)}</h2>
    <p>Jsi jeden z nich na jiném zařízení? Vyber se a hra se přesune sem.</p>
    <button class="btn" id="bAsX">Jsem ${esc(g.a)}</button>
    <button class="btn alt" id="bAsO">Jsem ${esc(g.b)}</button>
    <button class="btn alt" id="bNew">Založit vlastní souboj</button>`);
  $("bAsX").addEventListener("click", () => takeSeat("x"));
  $("bAsO").addEventListener("click", () => takeSeat("o"));
  $("bNew").addEventListener("click", () => { history.replaceState(null, "", location.pathname + location.search); room = null; viewSetup(); });
}
function viewError(t, text, retry) {
  phase = "menu"; $("hud").hidden = true;
  showView("error", `<h2>${esc(t)}</h2><p>${esc(text || "Odkaz může být neúplný nebo smazaný. Zkus ho otevřít znovu, nebo založ nový souboj.")}</p>
    ${retry ? `<button class="btn" id="bRetry">Zkusit znovu</button><button class="btn alt" id="bNew">Založit nový souboj</button>` : `<button class="btn" id="bNew">Založit nový souboj</button>`}`);
  $("bRetry")?.addEventListener("click", () => { clearTimeout(openFromHash.t); openFromHash(); });
  $("bNew").addEventListener("click", () => { clearTimeout(openFromHash.t); history.replaceState(null, "", location.pathname + location.search); room = null; viewSetup(); });
}

// ---------- místnost ----------
async function createRoom(a, b, st, picked) {
  const id = Net.randId(10);
  // g.md, g.rl, g.tg = mód, délka a cíl příští odvety (mění se i na výsledku); g.gm, g.gl = mód a délka právě spuštěného kola,
  // g.mh = módy odehraných souborů pro výpočet vítěze a série
  const c = picked || CHOICES[1];
  const meta = { app: "ovocny-souboj", v: 1, sx: Net.device, so: "", g: { a, b, st, md: c.md, rl: rlFor(c), tg: TEST_TG || Sim.TARGET, go: 0, sd: 0, mh: {} } };
  await Net.save(Net.metaUrl(id), meta);
  await Net.save(Net.seatUrl(id, "x"), seatDoc());
  Net.store.set(seatKey(id), "x");
  history.replaceState(null, "", location.pathname + location.search + "#r." + id);
  await enterRoom(id, meta);
  viewShare();
}
// f = {klíč: ms od startu}, kdy hráč dal cíl závodu / přišel o poslední život; lv = živé životy
const seatDoc = () => ({ k: 0, rdy: 0, sc: 0, ev: [], h: {}, f: {}, lv: Sim.LIVES, t: Date.now() });

async function openFromHash() {
  const m = /^#r\.([0-9a-z]{6,16})$/.exec(location.hash || "");
  if (!m) { viewSetup(); return; }
  if (view !== "error") showView("loading", `<h2>Otevírám souboj…</h2>`);
  let meta;
  try { meta = await Net.load(Net.metaUrl(m[1])); }
  catch { viewError("Spojení nevyšlo.", "Nedaří se dovolat ke hře. Zkontroluj signál, zkouším to sám znovu.", true); clearTimeout(openFromHash.t); openFromHash.t = setTimeout(openFromHash, 4000); return; }
  if (!meta || meta.app !== "ovocny-souboj") { viewError("Tenhle souboj neexistuje."); return; }
  await enterRoom(m[1], meta);
  if (!room.seat) { if (!meta.so) viewIntro(); else viewWatch(); return; }
  decide(true);
}
async function enterRoom(id, meta) {
  stopPoll();
  let seat = Net.store.get(seatKey(id));
  if (meta.sx === Net.device) seat = "x"; else if (meta.so === Net.device) seat = "o";
  else if (seat && meta["s" + seat] !== Net.device) seat = null;
  room = { id, meta, seat, w: null, opp: null, seenEv: 0, seenK: 0 };
  paintSeatColors();
  if (seat) await attachSeat();
  startPoll();
}
async function attachSeat(fresh) {
  let doc = null;
  if (!fresh) try { doc = await Net.load(Net.seatUrl(room.id, room.seat)); } catch {}
  room.w = Net.seatWriter(room.id, room.seat, doc || seatDoc());
  room.w.onNet = setNet;
  if (!doc) room.w.set({}, true);
  Net.store.set(seatKey(room.id), room.seat);
  paintSeatColors();
  // kolo rozehrané před znovunačtením stránky se počítá se skóre, které stihlo odejít
  const d = room.w.doc(), go = room.meta.g.go;
  // ve třech životech se opuštěné kolo počítá jako konec hned na začátku (jinak by obnovení stránky znamenalo „přežil“)
  if (go && d.k === go && !(go in d.h)) room.w.set({ h: { ...d.h, [go]: d.sc }, ...(room.meta.g.gm === "zivoty" && !(go in (d.f || {})) ? { f: { ...(d.f || {}), [go]: 0 } } : {}) }, true);
}
async function accept() {
  const name = clampName($("fName").value);
  if (!name) { $("fName").focus(); toast("Napiš svoje jméno, ať víš, komu fandit."); return; }
  if (sameName(name, room.meta.g.a)) { $("fName").focus(); toast(`Výzvu založil(a) ${room.meta.g.a}. Jsi to ty? Klepni na „Jsem ${room.meta.g.a}“, jinak napiš své jméno.`); return; }
  Net.store.set("ovs-name", name);
  $("bAccept").disabled = true; $("bAccept").textContent = "Přijímám…";
  try {
    const r = await Net.commitMeta(room.id, d => d && !d.so ? { ...d, so: Net.device, g: { ...d.g, b: name } } : null);
    if (!r.ok) { toast("Výzvu už mezitím přijal někdo jiný."); room.meta = r.d || room.meta; viewWatch(); return; }
    room.meta = r.d; room.seat = "o";
    await attachSeat(true);
    decide(true);
  } catch { $("bAccept").disabled = false; $("bAccept").textContent = "Přijmout výzvu"; toast("Spojení nevyšlo, zkus to znovu."); }
}
async function takeSeat(seat) {
  try {
    const r = await Net.commitMeta(room.id, d => d ? { ...d, ["s" + seat]: Net.device } : null);
    room.meta = r.d; room.seat = seat;
    await attachSeat(); decide(true);
  } catch { toast("Spojení nevyšlo, zkus to znovu."); }
}

// ---------- polling: co a jak často číst podle fáze ----------
let pollT = null, pollSeq = 0, fails = 0;
function pollPlan() {
  if (!room) return null;
  if (phase === "play" || phase === "count") return { meta: false, opp: true, ms: 400 };
  const d = mine();
  const waiting = d && (d.rdy > (room.meta.g.go || 0) || (phase === "wait"));
  if (phase === "lobby" || phase === "result" || phase === "wait") return { meta: true, opp: !!room.seat && !!room.meta.so, ms: waiting ? 300 : 900 };
  return { meta: true, opp: false, ms: 2000 };
}
function stopPoll() { clearTimeout(pollT); pollSeq++; }
function startPoll() { stopPoll(); poll(); }
async function poll() {
  clearTimeout(pollT);
  const plan = pollPlan();
  if (!plan || document.hidden) return;
  const seq = ++pollSeq, id = room.id;
  try {
    const [meta, opp] = await Promise.all([
      plan.meta ? Net.load(Net.metaUrl(id)) : null,
      plan.opp && room.seat ? Net.load(Net.seatUrl(id, other(room.seat))) : null,
    ]);
    if (!room || room.id !== id || seq !== pollSeq) return;
    fails = 0; if (phase !== "play") setNet("");
    if (meta) room.meta = meta;
    if (opp) onOpp(opp);
    if (meta || opp) decide(false);
  } catch {
    fails++;
    if (fails >= 3) setNet("Spojení vázne, zkouším to znovu…");
  }
  if (seq === pollSeq) pollT = setTimeout(poll, fails ? Math.min(5000, plan.ms * 2 ** Math.min(fails, 3)) : plan.ms);
}
document.addEventListener("visibilitychange", () => { if (!document.hidden && room) startPoll(); });
addEventListener("online", () => room && startPoll());

function onOpp(d) {
  room.opp = d;
  if (phase === "play" || phase === "count" || phase === "wait") {
    if (d.k === K) {
      cells($("cellsOpp"), d.sc || 0);
      // nové naschvály soupeře
      const ev = d.ev || [];
      if (room.seenK !== K) { room.seenK = K; room.seenEv = 0; }
      for (const e of ev.slice(room.seenEv)) if (phase === "play" || phase === "count") game.queue.push(e[1]);
      room.seenEv = ev.length;
      paintLives($("livesOpp"), d.lv == null ? Sim.LIVES : d.lv);
      // soupeř dal cíl / přišel o poslední život: závod mi končí hned, ve třech životech až moje hodiny přejdou jeho čas
      const f = (d.f || {})[K];
      if (f != null && game.oppF == null && game.md !== "cas") {
        game.oppF = f;
        if (game.md === "zavod" && game.fin == null && phase === "play") game.endWhy = "opp";
        window.__ovs.log.push({ ev: "oppF", f, at: Date.now() });
      }
    }
  }
  hudOppState();
}

// ---------- rozhodnutí: kde ve hře právě jsme ----------
function decide(force) {
  if (!room || !room.seat || !room.w) return;
  if (phase === "play" || phase === "count") return;
  const g = room.meta.g, d = mine(), o = room.opp || seatDoc();
  if (!room.meta.so) {                       // soupeř ještě nepřijal
    if (force || view === "lobby") viewLobby();
    return;
  }
  const go = g.go || 0;
  // host: oba připraveni na další kolo -> zapiš start
  if (room.seat === "x" && d.rdy > go && o.rdy === d.rdy && !starting) startNext(d.rdy);
  // nový start, který jsem ještě nehrál
  if (go && d.k !== go && !(go in d.h)) { beginCountdown(go, g.sd, g.gl || g.rl, room.seat === "x" ? 120 : 0, g.gm || (g.mh || {})[go]); return; }
  if (!go) { viewLobby(); return; }
  const hx = room.seat === "x" ? d.h : o.h, ho = room.seat === "x" ? o.h : d.h;
  if (!(go in (o.h || {}))) { phase = "wait"; viewWaiting(); return; }
  viewResult(hx || {}, ho || {});
}
let starting = false;
async function startNext(k) {
  starting = true;
  const sd = (crypto.getRandomValues(new Uint32Array(1))[0] >>> 0) || 1;
  try {
    const r = await Net.commitMeta(room.id, m => {
      if (!m || (m.g.go || 0) >= k) return null;
      const md = Sim.modeOf(m.g.md);
      return { ...m, g: { ...m.g, go: k, sd, gm: md, gl: m.g.rl || Sim.lengthFor(md), mh: { ...(m.g.mh || {}), [k]: md } } };
    });
    if (r.d) room.meta = r.d;
  } catch { toast("Start kola se nepodařil, zkouším znovu."); }
  starting = false;
  decide(false);
}
function ready(k) {
  room.w.set({ rdy: k }, true);
  decide(false);
  startPoll();
}

function hudNames() {
  $("nameMe").textContent = myName() || "Já";
  $("nameOpp").textContent = oppName();
}
function hudOppState() {
  if (!room || !room.seat || phase === "play") return;
  const o = room.opp, go = room.meta.g.go || 0, d = mine();
  let s = "";
  if (!room.meta.so) s = "zatím bez odpovědi";
  else if (o && o.rdy > go) s = "připraveno";
  else if (phase === "wait" && o && o.k === K && !(K in (o.h || {}))) s = "ještě seká";
  $("stateOpp").textContent = s;
  $("stateMe").textContent = d && d.rdy > go ? "připraveno" : "";
}
// hodiny v HUD: mód souboje a série přes odvety (já : soupeř); před první odvetou číslo souboje
function hudSeries(hx, ho, m, md) {
  const e = histEx(), st = Sim.matchState(hx, ho, m, e), ser = Sim.series(hx, ho, e);
  const mine = room.seat === "x" ? ser : [ser[1], ser[0]];
  md = md || st.md;
  $("roundLabel").textContent = modeName(md, room.meta.g.tg || Sim.TARGET);
  $("ser").innerHTML = m > 1 || mine[0] + mine[1] > 0 ? `série <b class="${room.seat}">${mine[0]}</b> : <b class="${other(room.seat)}">${mine[1]}</b>` : `souboj č. ${m}`;
  document.body.dataset.mode = md;
  return st;
}
function hists() {
  const d = mine(), o = room.opp || seatDoc();
  return room.seat === "x" ? [d.h || {}, o.h || {}] : [o.h || {}, d.h || {}];
}
// módy odehraných souborů a časy cíle/smrti obou hráčů (pro vítěze a sérii)
function histEx() {
  const d = mine() || seatDoc(), o = room.opp || seatDoc();
  const [fx, fo] = room.seat === "x" ? [d.f, o.f] : [o.f, d.f];
  return { mh: room.meta.g.mh || {}, fx: fx || {}, fo: fo || {} };
}
// životy jako tři tečky na cedulce (jen v módu tři životy); pop = právě ubraný život krátce blikne
function paintLives(el, n, pop) {
  [...el.children].forEach((p, i) => {
    const off = i >= n;
    if (pop && off && !p.classList.contains("off") && !reduced) { p.classList.remove("lost"); void p.offsetWidth; p.classList.add("lost"); }
    p.classList.toggle("off", off);
  });
}

function viewLobby() {
  phase = "lobby"; $("hud").hidden = false; hudNames();
  const g = room.meta.g, d = mine(), next = 11;
  const md = Sim.modeOf(g.md);
  K = 0; $("timer").textContent = fmtClock(md === "cas" ? Math.round(g.rl / 1000) : 0); $("timer").classList.remove("low");
  cells($("cellsMe"), 0); cells($("cellsOpp"), 0); { const [hx, ho] = hists(); hudSeries(hx, ho, Sim.mOf(next), md); } hudOppState();
  paintLives($("livesMe"), Sim.LIVES); paintLives($("livesOpp"), Sim.LIVES);
  const joined = !!room.meta.so, rdy = d.rdy >= next;
  const sig = `lobby|${joined}|${rdy}`;
  if (view === "lobby" && panel.dataset.sig === sig) return;
  showView("lobby", `
    <h2>${joined ? "Můžete hrát" : `Čekám, až ${esc(oppName())} přijme výzvu`}</h2>
    <p class="modeline"><b>${modeName(md, g.tg)}.</b> ${modeLine(md, g.rl, g.tg)}</p>
    ${g.st ? `<div class="stake">Hrajeme o: ${esc(g.st)}</div>` : ""}
    <p style="margin-top:12px">${joined ? (rdy ? `Jakmile bude ${esc(oppName())} taky připraven(a), naskočí odpočet.` : "Až klepneš, počkáme na soupeře a pak odpočet 3, 2, 1.") : "Odkaz už máš poslaný? Hra se rozjede sama, jakmile výzvu přijme."}</p>
    ${joined ? `<button class="btn" id="bReady" ${rdy ? "disabled" : ""}>${rdy ? "Čekám na soupeře…" : "Jdu do toho"}</button>` : `<button class="btn alt" id="bBack">Znovu poslat odkaz</button>`}`);
  panel.dataset.sig = sig;
  $("bReady")?.addEventListener("click", () => ready(next));
  $("bBack")?.addEventListener("click", viewShare);
}
// soupeř 20 s po konci mého kola pořád nedohrál: srozumitelný stav s volbou počkat / poslat odkaz a vrátit se později
const STALL_MS = 20000;
function viewWaiting() {
  $("hud").hidden = false; hudNames(); hudOppState();
  if (!game.doneAt) game.doneAt = Date.now();
  const stalled = Date.now() - Math.max(game.doneAt, game.waitHold) > STALL_MS;
  const sig = "waiting|" + stalled;
  if (view === "waiting" && panel.dataset.sig === sig) return;
  const n = esc(oppName());
  if (!stalled) showView("waiting", game.md === "zivoty" && game.endWhy === "mrtvy"
    ? `<h2>Došly ti životy. ${n} ještě seká…</h2><p>Výsledek naskočí sám, jakmile skončí i soupeř.</p>`
    : `<h2>Hotovo! ${n} ještě dosekává…</h2><p>Výsledek naskočí sám, jakmile dohraje i soupeř.</p>`);
  else {
    showView("waiting", `<h2>${n} se pořád neozývá</h2>
      <p>Možná ztratil(a) signál, zamkl(a) telefon nebo zavřel(a) stránku. Tvoje skóre je uložené, výsledek naskočí, jakmile ${n} dohraje.</p>
      <button class="btn" id="bHold">Počkat dál</button>
      <button class="btn alt" id="bLink">Poslat odkaz a vrátit se později</button>`);
    $("bHold").addEventListener("click", () => { game.waitHold = Date.now(); viewWaiting(); });
    $("bLink").addEventListener("click", async () => {
      const t = `${room.meta.g.a} a ${room.meta.g.b}, tady je náš Ovocný souboj, výsledek tam čeká: ${linkFor()}`;
      try { if (navigator.share) await navigator.share({ text: t }); else { await navigator.clipboard.writeText(t); toast("Odkaz zkopírován, vlož ho do chatu."); } } catch {}
    });
  }
  panel.dataset.sig = sig;
}
function viewResult(hx, ho) {
  phase = "result"; $("hud").hidden = false; hudNames();
  const go = room.meta.g.go, m = Sim.mOf(go), st = hudSeries(hx, ho, m), me = room.seat, d = mine();
  const r = st.rounds[0] || { x: hx[go], o: ho[go], w: null }, md = st.md, g = room.meta.g, o = room.opp || seatDoc();
  cells($("cellsMe"), me === "x" ? r.x : r.o); cells($("cellsOpp"), me === "x" ? r.o : r.x);
  paintLives($("livesMe"), d.lv == null ? Sim.LIVES : d.lv); paintLives($("livesOpp"), o.lv == null ? Sim.LIVES : o.lv);
  // ve třech životech je rozhodující výdrž: velké číslo je čas (kdo přežil, má celou délku kola), body jsou pod ním
  const cap = g.gl || Sim.lengthFor(md, g.rl), sec = f => Math.floor(Math.min(f == null ? cap : f, cap) / 1000);
  // hodiny na výsledku: na čas 0:00, závod čas vítěze v cíli, tři životy moje výdrž
  const finT = md === "zavod" ? [r.fx, r.fo].filter(f => f != null).sort((a, b) => a - b)[0] : me === "x" ? r.fx : r.fo;
  $("timer").textContent = md === "cas" ? "0:00" : fmtClock(sec(finT)); $("timer").classList.remove("low");
  const nextK = st.nextK, rdy = d.rdy >= nextK;
  $("stateMe").textContent = rdy ? "připraveno" : "";
  $("stateOpp").textContent = room.opp && room.opp.rdy >= nextK ? "připraveno" : "";
  const sig = `${go}|${rdy}|${room.opp && room.opp.rdy}|${g.md}|${g.rl}`;
  if (view === "result" && panel.dataset.sig === sig) return;
  const wName = w => esc(nameOfSeat(w));
  const big = seat => md === "zivoty" ? fmtClock(sec(r["f" + seat])) : r[seat];
  const [hiS, loS] = st.winner === "o" ? ["o", "x"] : ["x", "o"];
  const ser = Sim.series(hx, ho, histEx());
  const head = st.winner ? `Souboj bere ${wName(st.winner)}` : "Remíza";
  const headScore = `${head} ${big(hiS)} : ${big(loS)}${md === "cas" ? "" : ` (${modeName(md, g.tg).toLowerCase()})`}`;   // do chatu i se skóre
  const sub = seat => md === "zivoty" ? `${r[seat]} ${bodu(r[seat])}`
    : md === "zavod" && r["f" + seat] != null ? `v cíli za ${fmtClock(sec(r["f" + seat]))}`
    : st.winner ? (st.winner === seat ? "bere souboj" : "chce odvetu") : "remíza";
  const side = (seat, name) => `<div class="p ${seat}${st.winner === seat ? " win" : ""}"><div class="n">${esc(name)}</div><div class="s">${big(seat)}</div><div class="st">${sub(seat)}</div></div>`;
  const oppRdy = room.opp && room.opp.rdy >= nextK;
  const stake = g.st ? `<div class="stake">${st.winner ? `${wName(other(st.winner))} platí: ${esc(g.st)}` : `Sázka (${esc(g.st)}) zůstává ve hře`}</div>` : "";
  const hint = oppRdy ? `${esc(oppName())} už čeká na tebe.` : rdy ? "Odpočet naskočí, až klepne i soupeř. Nechce se mu? Pošli odkaz a vraťte se později." : "";
  showView("result", cols({
    head: `<h2>${head}</h2>`,
    form: `<div class="vs">${room.seat === "o" ? side("o", g.b) + '<div class="mid">:</div>' + side("x", g.a) : side("x", g.a) + '<div class="mid">:</div>' + side("o", g.b)}</div>`,   // já vlevo, stejně jako v HUD
    intro: stake,
    cta: `<span class="lab" id="nextLab">Odveta v módu</span>
    <div class="chips" id="modeChips" role="group" aria-labelledby="nextLab">${modeChips(choiceId(Sim.modeOf(g.md), g.rl))}</div>
    <button class="btn" id="bNext" ${rdy ? "disabled" : ""}>${rdy ? "Čekám na soupeře…" : "Odveta"}</button>
    ${hint ? `<p class="small" style="margin:8px 0 0;text-align:center">${hint}</p>` : ""}
    <button class="btn alt" id="bShareRes">Poslat výsledek do chatu</button>`,
  }), true);
  panel.dataset.sig = sig;
  $("modeChips").addEventListener("click", e => { const b = e.target.closest("button"); if (b) setMode(b); });
  $("bNext").addEventListener("click", () => ready(nextK));
  $("bShareRes").addEventListener("click", async () => {
    const t = `${headScore}${g.st && st.winner ? ` (${nameOfSeat(other(st.winner))} platí: ${g.st})` : ""}. Série ${g.a} ${ser[0]} : ${ser[1]} ${g.b}. Odveta? ${linkFor()}`;
    try { if (navigator.share) await navigator.share({ text: t }); else { await navigator.clipboard.writeText(t); toast("Zkopírováno."); } } catch {}
  });
}

// mód odvety může přepnout kdokoli z dvojice: čip se stiskne hned, druhý ho uvidí po dalším čtení metadat
async function setMode(b) {
  const c = CHOICES.find(x => x.id === b.dataset.c);
  if (!c || b.getAttribute("aria-pressed") === "true") return;
  b.parentElement.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
  try {
    const r = await Net.commitMeta(room.id, m => m ? { ...m, g: { ...m.g, md: c.md, rl: rlFor(c), tg: m.g.tg || TEST_TG || Sim.TARGET } } : null);
    if (r.d) room.meta = r.d;
    window.__ovs.log.push({ ev: "mode", md: c.md, at: Date.now() });
  } catch { toast("Změna módu nevyšla, zkus to znovu."); }
  decide(false);
}

// ---------- kolo ----------
function beginCountdown(k, seed, rl, delay, md) {
  if (phase === "count" || phase === "play") return;
  K = k; phase = "count";
  game.rl = rl || Sim.ROUND_MS;
  game.sched = Sim.schedule(seed, game.rl).map(it => ({ ...it }));
  game.next = 0; game.score = 0; game.ev = []; game.queue = []; game.lastSend = -1e9; game.lastApplied = -1e9;
  game.stroke = null; game.cuts = 0; game.bombs = 0; game.sent = 0; game.got = 0; game.doneAt = 0; game.waitHold = 0;
  game.precise = 0; game.charge = 0; game.fireN = 0; paintCharge(); window.__ovs.feel = { spawns: [], vis: [] };
  game.md = Sim.modeOf(md); game.tg = room.meta.g.tg || Sim.TARGET; game.lives = Sim.LIVES; game.fin = null; game.oppF = null; game.endWhy = null;
  for (const o of game.live) scene.remove(o); game.live = [];
  scene.clear();
  room.seenK = k; room.seenEv = (room.opp && room.opp.k === k) ? (room.opp.ev || []).length : 0;
  room.w.set({ k, sc: 0, ev: [], lv: Sim.LIVES }, true);
  showView(null);
  $("hud").hidden = false; hudNames();
  $("stateMe").textContent = ""; $("stateOpp").textContent = "";
  cells($("cellsMe"), 0); cells($("cellsOpp"), 0);
  paintLives($("livesMe"), Sim.LIVES); paintLives($("livesOpp"), Sim.LIVES);
  const [hx, ho] = hists(); hudSeries(hx, ho, Sim.mOf(k), game.md);
  $("timer").textContent = fmtClock(game.md === "cas" ? Math.round(game.rl / 1000) : 0); $("timer").classList.remove("low");
  const now = performance.now();
  game.start = now + delay + 3000;
  game.countShown = -1;
  stats.frames = 0; stats.time = 0; stats.samples = [];
  startPoll();
  window.__ovs.log.push({ ev: "countdown", k, at: Date.now() + delay + 3000 });
}
function finishRound() {
  phase = "wait";
  const d = mine();
  room.w.set({ sc: game.score, h: { ...d.h, [K]: game.score }, ...(game.fin != null ? { f: { ...(d.f || {}), [K]: game.fin } } : {}) }, true);
  sound.end(); buzz([70, 50, 140]);
  game.doneAt = Date.now();
  for (const o of game.live) scene.remove(o); game.live = [];
  $("count").innerHTML = `<span class="go">${game.endWhy === "cil" ? "V cíli!" : "Konec!"}</span>`;
  setTimeout(() => { if (phase !== "count") $("count").innerHTML = ""; }, 900);
  window.__ovs.log.push({ ev: "end", k: K, md: game.md, why: game.endWhy || "cas", fin: game.fin, score: game.score, at: Date.now(), stats: fpsStats() });
  decide(false);
  startPoll();
}
const clockNow = () => Math.round(performance.now() - game.start);
function addScore(n) {
  game.score = Math.max(0, game.score + n);
  cells($("cellsMe"), game.score);
  room.w.set({ sc: game.score });
  // závod: cíl se zapíše časem na mých hodinách kola, kolo skončí v příštím snímku (dokončí se řez, který tam dovedl)
  if (game.md === "zavod" && game.fin == null && phase === "play" && game.score >= game.tg) { game.fin = clockNow(); game.endWhy = "cil"; }
}
// tři životy: propadlé ovoce nebo seknutá bomba; poslední život ukončí kolo a zapíše čas
function loseLife(x, y) {
  if (game.md !== "zivoty" || game.lives <= 0 || phase !== "play") return;
  game.lives--;
  paintLives($("livesMe"), game.lives, true);
  room.w.set({ lv: game.lives }, true);
  float(x, y, "×", "miss");
  sound.miss(); buzz(60);
  window.__ovs.log.push({ ev: "life", left: game.lives, at: Date.now() });
  if (!game.lives && game.fin == null) { game.fin = clockNow(); game.endWhy = "mrtvy"; }
}
// měřič naschválu pod jménem: plný pošle soupeři další naschvál (cyklus šmouha, mráz, bomba), jakmile doběhne pauza mezi odesláními
function paintCharge() {
  const el = $("chargeMe"), full = game.charge >= Sim.CHARGE_MAX;
  el.firstElementChild.style.width = Math.min(100, game.charge / Sim.CHARGE_MAX * 100) + "%";
  el.classList.toggle("full", full);
}
function addCharge(n) { game.charge = Math.min(Sim.CHARGE_MAX, game.charge + n); paintCharge(); }
function tryFire(now) {
  if (game.charge < Sim.CHARGE_MAX || now - game.lastSend < 2500) return;
  const type = Sim.FIRE_ORDER[game.fireN % 3], { x, y } = game.lastPos;
  if (!sendSabotage(type, x, y)) return;
  game.fireN++; game.charge = 0; paintCharge();
  window.__ovs.log.push({ ev: "fire", type, at: Date.now() });
}
function sendSabotage(type, x, y, force) {
  const now = performance.now();
  if (!force && now - game.lastSend < 2500) return false;
  game.lastSend = now; game.sent++;
  game.ev = [...game.ev, [game.ev.length, type, Math.round(now - game.start)]];
  window.__ovs.log.push({ ev: "send", type, at: Date.now() });
  room.w.set({ ev: game.ev }, true);
  sound.send();
  shot(x, y);
  const ch = $("chargeMe"); ch.classList.remove("fire"); void ch.offsetWidth; ch.classList.add("fire");   // pulz měřiče, bez textu
  return true;
}
function applySabotage(type) {
  const now = performance.now(), clock = now - game.start;
  game.lastApplied = now; game.got++;
  const who = oppName(), c = COLORS[other(room.seat)];
  const ic = $("sabIcon"); ic.innerHTML = ICONS[type](c);                       // krátké bliknutí ikony u soupeřova skóre, bez textu
  ic.classList.remove("on"); void ic.getBoundingClientRect(); ic.classList.add("on");
  const sign = $("signOpp"); sign.classList.remove("hit"); void sign.offsetWidth; sign.classList.add("hit");
  sound.incoming(); buzz([40, 40, 40]);
  if (type === "bomba") {
    const u = (Math.random() * 2 - 1) * 0.6;
    game.sched.push({ id: 1000 + game.got, t: clock + 750, kind: "bomba", u, vu: -u * 0.4, apex: 3 + Math.random() * 4, spin: [0, 0, 1, 2], band: c, from: who });
    game.sched.sort((a, b) => a.t - b.t);
    game.next = Math.min(game.next, game.sched.findIndex(it => it.t > clock - 1));
    if (game.next < 0) game.next = game.sched.length - 1;
  } else if (type === "smouha") {
    smear(c);
  } else {
    let n = 0;
    for (const it of game.sched) if (it.t > clock + 400 && it.kind !== "bomba" && it.kind !== "karambola" && !it.frozen && !it.spawned && n < 2) { it.frozen = true; n++; }
  }
  window.__ovs.log.push({ ev: "got", type, at: Date.now() });
}
function smear(c) {
  const el = $("smear"), left = Math.random() < 0.5;
  const cx = left ? 30 : 70, cy = 38 + Math.random() * 20;
  let blobs = "";
  for (let i = 0; i < 9; i++) {
    const a = i / 9 * Math.PI * 2, r = 9 + (i % 3) * 4;
    blobs += `<circle cx="${cx + Math.cos(a) * r}" cy="${cy + Math.sin(a) * r * 0.8}" r="${7 + (i * 7) % 6}"/>`;
  }
  let drips = "";
  for (let i = 0; i < 5; i++) drips += `<rect class="drip" x="${cx - 14 + i * 7}" y="${cy + 6}" width="${2.5 + (i % 2) * 1.5}" height="${12 + (i * 5) % 14}" rx="1.5"/>`;
  el.innerHTML = `<svg viewBox="0 0 100 100" preserveAspectRatio="none"><g fill="${c}" opacity=".88"><ellipse cx="${cx}" cy="${cy}" rx="22" ry="17"/>${blobs}${drips}</g><g fill="#fff" opacity=".35"><ellipse cx="${cx - 6}" cy="${cy - 6}" rx="6" ry="3"/></g></svg>`;
  el.classList.remove("on"); void el.offsetWidth; el.classList.add("on");
}

// ---------- sekání ----------
let trail = [], pointerDown = false, lastPt = null;
function cutTest(ax, ay, bx, by, now) {
  const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
  if (len2 < 9) return;
  const speed = Math.sqrt(len2);
  for (const o of [...game.live]) {
    if (o.dead || (o.immune && now < o.immune)) continue;
    const p = scene.toScreen(o.g.position.x, o.g.position.y);
    const r = o.r / scene.HALF_H * scene.h / 2 * 1.15 + 6;
    let t = ((p.x - ax) * dx + (p.y - ay) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    const qx = ax + dx * t - p.x, qy = ay + dy * t - p.y;
    if (qx * qx + qy * qy > r * r) continue;
    // přesný řez: přímka tahu (z bodu stopy aspoň 22 px zpět, jinak z poslední úsečky) projde ve vnitřní čtvrtině poloměru
    let sx = ax, sy = ay;
    for (let i = trail.length - 1; i >= 0; i--) if (now - trail[i].t < 160 && Math.hypot(bx - trail[i].x, by - trail[i].y) >= 22) { sx = trail[i].x; sy = trail[i].y; break; }
    const lx = bx - sx, ly = by - sy, ll = Math.hypot(lx, ly) || 1;
    const dLine = Math.abs((p.x - sx) * ly - (p.y - sy) * lx) / ll, rReal = o.r / scene.HALF_H * scene.h / 2;
    hit(o, p, dx, -dy, now, speed, dLine <= Sim.PRECISE_R * rReal);
  }
}
function hit(o, p, dx, dy, now, speed, precise) {
  if (phase !== "play") {                       // v menu jen pro radost, bez bodů
    if (o.kind === "bomba") { o.dead = true; scene.explode(o); }
    else { o.dead = true; scene.slice(o, dx, dy); sound.squish(0.9 + Math.random() * 0.3); addStain(p.x, p.y, o.kind); }
    game.live = game.live.filter(x => x !== o);
    return;
  }
  if (o.ice) {
    scene.crack(o); o.immune = now + 160; o.frozen2 = true; sound.crunch();
    float(p.x, p.y - 30, "křup", "");
    return;
  }
  o.dead = true;
  game.live = game.live.filter(x => x !== o);
  if (o.kind === "bomba") {
    scene.explode(o); game.bombs++;
    if (game.md === "zivoty") loseLife(p.x, p.y);           // ve třech životech bomba bere život, ne body
    else { addScore(Sim.POINTS.bomba); float(p.x, p.y, `${Sim.POINTS.bomba}`, "bad"); }
    sound.boom();
    $("flash").classList.remove("on"); void $("flash").offsetWidth; $("flash").classList.add("on");
    if (!reduced) { document.body.classList.remove("shake"); void document.body.offsetWidth; document.body.classList.add("shake"); }
    buzz(70);
    endStroke();
    return;
  }
  scene.slice(o, dx, dy);
  sound.squish(o.kind === "meloun" ? 0.7 : 0.9 + Math.random() * 0.4);
  game.cuts++;
  game.lastPos = { x: p.x, y: p.y };
  addStain(p.x, p.y, o.kind);
  const frozenHit = !!o.frozen2;
  const pts = o.kind === "karambola" ? Sim.POINTS.karambola : frozenHit ? Sim.POINTS.frozen : Sim.POINTS.fruit;
  addScore(pts);
  addCharge(o.kind === "karambola" ? Sim.CHARGE.karambola : Sim.CHARGE.cut);
  if (o.kind === "karambola") {
    const sent = sendSabotage("bomba", p.x, p.y);
    float(p.x, p.y, `+${pts}`);
    window.__ovs.log.push({ ev: "kara", sent, at: Date.now() });
  } else if (pts > 1) float(p.x, p.y, `+${pts}`);
  if (precise) {
    game.precise++;
    scene.ring(o.g.position.x, o.g.position.y, "#FFE08A");
    if (!reduced) scene.burst(o.g.position.x, o.g.position.y, JUICE[o.kind] || "#FFF1B8", 8, 13, 0.4, 0.6);
    sound.precise(); buzz(18);
    if (frozenHit) {
      // protiútok za dovednost: přesně rozseknutý led se vrací odesílateli jako mráz
      const sent = sendSabotage("mraz", p.x, p.y, true);
      float(p.x, p.y - 34, "Přesně!", "precise");
      window.__ovs.log.push({ ev: "reflect", sent, at: Date.now() });
    } else {
      addScore(Sim.POINTS.precise); addCharge(Sim.CHARGE.precise - Sim.CHARGE.cut);
      float(p.x, p.y - 34, `Přesně!<small>+${Sim.POINTS.precise}</small>`, "precise");
    }
    window.__ovs.log.push({ ev: "precise", kind: o.kind, frozen: frozenHit, at: Date.now() });
  }
  const s = game.stroke || (game.stroke = { n: 0, last: now, x: p.x, y: p.y });
  s.n++; s.last = now; s.x = p.x; s.y = p.y;
}
function endStroke() {
  const s = game.stroke; game.stroke = null;
  if (!s || phase !== "play") return;
  if (s.n >= 3) {
    const bonus = Sim.comboBonus(s.n);
    addScore(bonus);
    const type = Sim.sabotageFor(s.n, null);
    const sent = sendSabotage(type, s.x, s.y);
    float(s.x, s.y - 40, `Combo ${s.n}! +${bonus}`);
    sound.combo(s.n); buzz(25);
    window.__ovs.log.push({ ev: "combo", n: s.n, sent: sent ? type : null, at: Date.now() });
  }
}
function ptr(e) { return { x: e.clientX, y: e.clientY, t: performance.now() }; }
blade.addEventListener("pointerdown", e => {
  pointerDown = true; lastPt = ptr(e); trail = [lastPt];
  try { blade.setPointerCapture(e.pointerId); } catch {}
});
blade.addEventListener("pointermove", e => {
  if (!pointerDown) return;
  const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
  for (const ce of (evs.length ? evs : [e])) {
    const p = ptr(ce);
    if (lastPt) {
      cutTest(lastPt.x, lastPt.y, p.x, p.y, p.t);
      const sp = Math.hypot(p.x - lastPt.x, p.y - lastPt.y) / Math.max(1, p.t - lastPt.t) * 1000;
      if (sp > 1400 && (!ptr.sw || p.t - ptr.sw > 160)) { ptr.sw = p.t; sound.swish(sp); }
    }
    lastPt = p; trail.push(p);
  }
});
const up = () => { pointerDown = false; lastPt = null; endStroke(); };
blade.addEventListener("pointerup", up);
blade.addEventListener("pointercancel", up);
blade.addEventListener("contextmenu", e => e.preventDefault());

function drawBlade(now) {
  trail = trail.filter(p => now - p.t < 120);
  bctx.clearRect(0, 0, scene.w, scene.h);
  if (trail.length < 2) return;
  const me = room && room.seat ? COLORS[room.seat] : COLORS.x;
  bctx.lineCap = "round"; bctx.lineJoin = "round";
  for (const [color, wMul] of [[me, 1.9], ["#FFFCF2", 1]]) {
    bctx.strokeStyle = color;
    for (let i = 1; i < trail.length; i++) {
      const a = trail[i - 1], b = trail[i], k = i / trail.length;
      bctx.globalAlpha = color === me ? 0.45 * k : 0.95 * k;
      bctx.lineWidth = (1.5 + 7 * k) * wMul;
      bctx.beginPath(); bctx.moveTo(a.x, a.y); bctx.lineTo(b.x, b.y); bctx.stroke();
    }
  }
  bctx.globalAlpha = 1;
}

// ---------- hlavní smyčka ----------
let lastT = performance.now(), idleNext = 0, qualityT = 0, feelT = 0;
const idleRng = Sim.rng(Date.now() & 0xffff);
function spawnItem(it, t0) {
  const o = scene.spawn(it.kind, { frozen: !!it.frozen, band: it.band || "#E23B3B" });
  o.it = it; o.t0 = t0;
  if (phase === "play") window.__ovs.feel.spawns.push({ t: Math.round(t0), kind: it.kind, sab: !!it.from });
  o.spinAxis.set(it.spin[0], it.spin[1], it.spin[2]).normalize(); o.spin = it.spin[3];
  game.live.push(o);
  return o;
}
function moveAll(clockMs) {
  const hw = scene.fieldHalf;
  for (const o of [...game.live]) {
    const dt = (clockMs - o.t0) / 1000;
    const p = Sim.posAt(o.it, dt);
    o.vx = o.it.vu * hw; o.vy = Sim.vy0(o.it.apex) - Sim.G * dt;
    if (p.y < Sim.Y0 - 2 && o.vy < 0) {
      // propadlý kus ovoce (ne bomba, ne karambola) ve třech životech: × u spodního okraje tam, kde zmizel
      if (game.md === "zivoty" && phase === "play" && Sim.FRUITS.includes(o.kind)) loseLife(Math.max(30, Math.min(innerWidth - 30, scene.toScreen(o.g.position.x, 0).x)), innerHeight - 96);
      scene.remove(o); game.live = game.live.filter(x => x !== o); continue;
    }
    scene.place(o, p.x, p.y, dt);
  }
}
let wasPlaying = false;
function frame(now) {
  requestAnimationFrame(frame);
  const pl = phase === "play" || phase === "count";
  if (pl !== wasPlaying) { wasPlaying = pl; document.body.classList.toggle("playing", pl); }
  const dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;
  if (phase === "count") {
    const left = Math.ceil((game.start - now) / 1000);
    if (left !== game.countShown) {
      game.countShown = left;
      if (left > 0 && left <= 3) { $("count").innerHTML = `<span>${left}</span>`; sound.beep(false); }
      else if (left <= 0) { $("count").innerHTML = `<span class="go">Sekej!</span>`; sound.beep(true); setTimeout(() => { if (phase === "play") $("count").innerHTML = ""; }, 700); }
    }
    if (now >= game.start) { phase = "play"; setNet(""); }
  }
  if (phase === "play") {
    const clock = now - game.start;
    while (game.next < game.sched.length && game.sched[game.next].t <= clock) {
      const it = game.sched[game.next++];
      if (!it.spawned) { it.spawned = true; spawnItem(it, it.t); }
    }
    moveAll(clock);
    if (game.stroke && now - game.stroke.last > 380) endStroke();
    if (game.queue.length && now - game.lastApplied > 2600) applySabotage(game.queue.shift());
    tryFire(now);
    if (now - feelT > 100) {   // kolik kusů je právě vidět (pro tests/feel.cjs)
      feelT = now; let n = 0;
      for (const o of game.live) if (!o.dead) { const q = scene.toScreen(o.g.position.x, o.g.position.y); if (q.y > 0 && q.y < scene.h && q.x > 0 && q.x < scene.w) n++; }
      window.__ovs.feel.vis.push(n);
    }
    // na čas odpočítává, závod a tři životy počítají nahoru (čas do cíle / výdrž)
    const left = Math.max(0, Math.ceil((game.rl - clock) / 1000));
    const lt = fmtClock(game.md === "cas" ? left : Math.min(Math.floor(clock / 1000), Math.round(game.rl / 1000)));
    if ($("timer").textContent !== lt) { $("timer").textContent = lt; $("timer").classList.toggle("low", game.md === "cas" && left <= 10); }
    stats.frames++; stats.time += dt; stats.samples.push(dt);
    if (stats.samples.length > 600) stats.samples.shift();
    qualityT += dt;
    if (qualityT > 2) {
      qualityT = 0;
      const avg = stats.samples.slice(-90).reduce((a, b) => a + b, 0) / Math.min(90, stats.samples.length);
      if (avg > 0.022 && scene.pixelRatio > 1) scene.setPixelRatio(Math.max(1, scene.pixelRatio - 0.5));
    }
    if (clock >= game.rl || game.endWhy) finishRound();
    // přežil jsem soupeře: zapíšu svůj čas (vždy aspoň o 1 ms delší než jeho), na výsledku je tak skutečná výdrž, ne celé kolo
    else if (game.md === "zivoty" && game.oppF != null && clock >= game.oppF) { game.endWhy = "prezil"; game.fin = Math.max(Math.round(clock), game.oppF + 1); finishRound(); }
  } else if (phase !== "count") {
    // v menu a mezi koly létá pár kusů na zkoušku
    const clock = now;
    if (now > idleNext && game.live.length < 3 && !document.hidden) {
      idleNext = now + 1400 + idleRng() * 900;
      const kinds = [...Sim.FRUITS];   // karambola jen ve hře, v menu by visela pod visačkou bez významu
      const u = (idleRng() * 2 - 1) * 0.7;
      spawnItem({ kind: kinds[Math.floor(idleRng() * kinds.length)], u, vu: -u * 0.5, apex: 1 + idleRng() * 5, spin: [idleRng(), idleRng(), idleRng(), 2] }, clock);
    }
    moveAll(clock);
  }
  scene.step(dt);
  scene.render();
  drawBlade(now);
  drawStains(now);
}
requestAnimationFrame(frame);

function fpsStats() {
  const s = stats.samples;
  if (!s.length) return null;
  const sorted = [...s].sort((a, b) => b - a);
  const avg = s.reduce((a, b) => a + b, 0) / s.length;
  return { avgFps: +(1 / avg).toFixed(1), low1Fps: +(1 / sorted[Math.floor(s.length * 0.01)]).toFixed(1), frames: stats.frames, pixelRatio: scene.pixelRatio, drawCalls: scene.renderer.info.render.calls };
}

// ---------- háčky pro testy (Playwright čte stav a polohy ovoce) ----------
window.__ovs = {
  log: [],
  feel: { spawns: [], vis: [] },
  state: () => ({ phase, view, K, score: game.score, md: game.md, lives: game.lives, fin: game.fin, oppF: game.oppF, why: game.endWhy, gmd: room && room.meta.g.md, opp: room && room.opp ? room.opp.sc : null, seat: room && room.seat, go: room && room.meta.g.go, rl: room && room.meta.g.rl, sent: game.sent, got: game.got, precise: game.precise, charge: game.charge, bombs: game.bombs, cuts: game.cuts, queue: game.queue.length, live: game.live.length }),
  targets: () => game.live.filter(o => !o.dead).map(o => ({ kind: o.kind, ice: !!o.ice, ...scene.toScreen(o.g.position.x, o.g.position.y), r: o.r / scene.HALF_H * scene.h / 2 })),
  fps: fpsStats,
  float,
  drawCalls: () => scene.renderer.info.render.calls,
};

addEventListener("hashchange", () => { stopPoll(); room = null; openFromHash(); });
openFromHash();
