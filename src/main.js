// Ovocný souboj – obrazovky, synchronizace kol, sekání, naschvály, zvuk.
import * as Sim from "./sim.js";
import * as Net from "./net.js";
import { createScene } from "./scene.js";
import { createBot, BOT_NAME, BOT_DAT } from "./bot.js";

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

// ---------- Herna: místnost, ve které se hry střídají (protokol react-apps/HERNA-PROTOKOL.md, verze 1) ----------
// #herna=1&m=…&r=<místnost hry>&seat=0|1&names=A,B&zaklada=0|1 přeskočí výzvu i setup: kdo hru vybral (zaklada=1) založí dokument rovnou
// se jmény, druhý si k němu sedne sám. Jména a sedadla ručí Herna (hráč se seat=s hraje za names[s]). Bez platného herna=1 je herna null
// a hra se chová jako dřív.
function parseHerna() {
  const h = {};
  for (const kv of location.hash.slice(1).split("&")) { const i = kv.indexOf("="); if (i > 0) h[kv.slice(0, i)] = kv.slice(i + 1); }
  if (h.herna !== "1" || !/^[0-9a-z]{6,16}$/.test(h.r || "") || (h.seat !== "0" && h.seat !== "1")) return null;
  const dec = s => { try { return decodeURIComponent(s); } catch { return s; } };
  const nm = (h.names || "").split(",").map(s => clampName(dec(s)).slice(0, 16));   // čárku ve jménu rozděluje až po dekódování, proto ruční rozbor
  return { r: h.r, hs: +h.seat, zaklada: h.zaklada === "1", names: [nm[0] || "Hráč 1", nm[1] || "Hráč 2"] };
}
let herna = parseHerna();
const doHerny = z => { if (herna && window.parent !== window) { try { window.parent.postMessage({ herna: 1, ...z }, "*"); } catch {} } };

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
let curTheme = "orech";
// walnut = původní ořechová deska (nic se na ní nezměnilo), ostatní desky jsou stejně klidné a tmavé, aby na nich vynikla barva ovoce
function walnut(g, w, h, r) {
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
}
// břidlice: velké desky s drobnými škrábanci a křídovými tečkami, chladná šedomodrá
function slate(g, w, h, r) {
  g.fillStyle = "hsl(212 11% 15%)"; g.fillRect(0, 0, w, h);
  const rowH = Math.max(120, Math.min(210, h / 4.2));
  for (let y = 0; y < h; y += rowH) {
    for (let x = -r() * 200; x < w;) {
      const sw = 220 + r() * 220, tone = (r() - 0.5) * 5;
      g.fillStyle = `hsl(212 ${10 + r() * 4}% ${15 + tone}%)`; g.fillRect(x, y, sw, rowH);
      for (let i = 0; i < 5; i++) {
        g.strokeStyle = r() < 0.5 ? "rgba(220,235,255,.05)" : "rgba(0,0,0,.2)"; g.lineWidth = 0.7 + r();
        const sx = x + r() * sw, sy = y + r() * rowH; g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx + (r() - 0.5) * 90, sy + (r() - 0.5) * 30); g.stroke();
      }
      g.fillStyle = "rgba(235,242,255,.06)";
      for (let i = 0; i < 9; i++) { g.beginPath(); g.arc(x + r() * sw, y + r() * rowH, 0.8 + r() * 1.4, 0, 6.283); g.fill(); }
      g.fillStyle = "rgba(0,0,0,.6)"; g.fillRect(x + sw - 2, y, 2, rowH); g.fillStyle = "rgba(190,210,235,.06)"; g.fillRect(x + sw, y, 1, rowH);
      x += sw;
    }
    g.fillStyle = "rgba(0,0,0,.6)"; g.fillRect(0, y + rowH - 2, w, 2); g.fillStyle = "rgba(190,210,235,.06)"; g.fillRect(0, y + rowH, w, 1);
  }
}
// ubrus: tmavé vínové piknikové kostky, jemná tkanina a dva měkké záhyby
function cloth(g, w, h, r) {
  const s = Math.max(46, Math.min(80, w / 9)), ox = -r() * s * 2, oy = -r() * s * 2;
  g.fillStyle = "#241214"; g.fillRect(0, 0, w, h);
  g.fillStyle = "rgba(170,56,52,.2)";
  for (let x = ox; x < w; x += s * 2) g.fillRect(x, 0, s, h);
  for (let y = oy; y < h; y += s * 2) g.fillRect(0, y, w, s);
  // jemný rastr tkaniny (čáry po 4 px) byl pod škálováním plátna moaré a na telefonu šuměl, proto pryč
  for (let i = 0; i < 2; i++) {
    const x0 = w * (0.2 + 0.5 * r()), gr = g.createLinearGradient(x0 - 90, 0, x0 + 90, h * 0.3);
    gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(0.5, "rgba(0,0,0,.22)"); gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  }
}
// modré kachle: dlouhé obkladačky s odsazením řad, skosená hrana a občas drobný čtyřlístek
function tiles(g, w, h, r) {
  const th = Math.max(54, Math.min(96, h / 9)), tw = th * 2;
  g.fillStyle = "#0D111E"; g.fillRect(0, 0, w, h);
  for (let y = 0, row = 0; y < h; y += th, row++) {
    for (let x = row % 2 ? -tw / 2 : 0; x < w; x += tw) {
      g.fillStyle = `hsl(224 ${22 + r() * 6}% ${16 + (r() - 0.5) * 3.5}%)`; g.fillRect(x + 2, y + 2, tw - 4, th - 4);
      g.fillStyle = "rgba(190,205,255,.08)"; g.fillRect(x + 2, y + 2, tw - 4, 2);
      g.fillStyle = "rgba(0,0,0,.28)"; g.fillRect(x + 2, y + th - 5, tw - 4, 3);
      if (r() < 0.16) {
        g.fillStyle = "rgba(190,210,255,.07)"; const cx = x + tw / 2, cy = y + th / 2, p = th * 0.13;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { g.beginPath(); g.arc(cx + dx * p, cy + dy * p, p * 0.8, 0, 6.283); g.fill(); }
      }
    }
  }
}
// podzim: ořechová deska s rozházenými plochými listy
function autumn(g, w, h, r) {
  walnut(g, w, h, r);
  const cols = ["hsl(18 62% 27%)", "hsl(32 72% 31%)", "hsl(8 56% 25%)", "hsl(44 62% 29%)"], n = Math.round(12 + w * h / 80000);
  for (let i = 0; i < n; i++) {
    const x = r() * w, y = r() * h, L = 38 + r() * 40, a = r() * 6.283;
    g.save(); g.translate(x, y); g.rotate(a); g.globalAlpha = 0.72; g.fillStyle = cols[Math.floor(r() * cols.length)];
    g.beginPath(); g.moveTo(0, -L / 2); g.quadraticCurveTo(L * 0.5, -L * 0.1, 0, L / 2); g.quadraticCurveTo(-L * 0.5, -L * 0.1, 0, -L / 2); g.fill();
    g.strokeStyle = "rgba(20,8,2,.4)"; g.lineWidth = 1.4; g.beginPath(); g.moveTo(0, -L / 2); g.lineTo(0, L / 2 + 6); g.stroke();
    g.restore();
  }
}
// zima: břidlice s jinovatkou v rozích a pár plochými vločkami (šestiramenné hvězdičky)
function winter(g, w, h, r) {
  slate(g, w, h, r);
  for (const [cx, cy] of [[0, 0], [w, 0], [0, h], [w, h]]) {
    const R = Math.max(w, h) * 0.42, gr = g.createRadialGradient(cx, cy, 0, cx, cy, R);
    gr.addColorStop(0, "rgba(225,240,255,.16)"); gr.addColorStop(1, "rgba(225,240,255,0)");
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  }
  const n = Math.round(10 + w * h / 90000);
  g.strokeStyle = "rgba(230,242,255,.2)"; g.lineCap = "round";
  for (let i = 0; i < n; i++) {
    const x = r() * w, y = r() * h, L = (7 + r() * 13) * (w < 600 ? 0.7 : 1), a0 = r();
    g.lineWidth = 1.2 + L / 10;
    for (let k = 0; k < 6; k++) {
      const a = a0 + k * Math.PI / 3, ex = x + Math.cos(a) * L, ey = y + Math.sin(a) * L;
      g.beginPath(); g.moveTo(x, y); g.lineTo(ex, ey); g.stroke();
      const mx = x + Math.cos(a) * L * 0.6, my = y + Math.sin(a) * L * 0.6, b = L * 0.28;
      g.beginPath(); g.moveTo(mx + Math.cos(a + 0.8) * b, my + Math.sin(a + 0.8) * b); g.lineTo(mx, my); g.lineTo(mx + Math.cos(a - 0.8) * b, my + Math.sin(a - 0.8) * b); g.stroke();
    }
  }
}
// jaro: ořechová deska s rozfoukanými květy třešně (pět plochých okvětních lístků, žlutý střed)
function spring(g, w, h, r) {
  walnut(g, w, h, r);
  const n = Math.round(9 + w * h / 110000);
  for (let i = 0; i < n; i++) {
    const x = r() * w, y = r() * h, s = (9 + r() * 9) * (w < 600 ? 0.72 : 1), a0 = r() * 6.283;   // na úzkém displeji menší, ať nesoupeří s ovocem
    g.save(); g.translate(x, y); g.rotate(a0); g.globalAlpha = w < 600 ? 0.5 : 0.62;
    g.fillStyle = r() < 0.5 ? "hsl(345 62% 78%)" : "hsl(340 48% 86%)";
    for (let k = 0; k < 5; k++) { g.rotate(Math.PI * 2 / 5); g.beginPath(); g.ellipse(0, -s * 0.62, s * 0.42, s * 0.62, 0, 0, 6.283); g.fill(); }
    g.globalAlpha = 0.8; g.fillStyle = "hsl(44 90% 62%)"; g.beginPath(); g.arc(0, 0, s * 0.2, 0, 6.283); g.fill();
    g.restore();
  }
  g.globalAlpha = 0.5; g.fillStyle = "hsl(345 55% 80%)";   // pár samotných lístků
  for (let i = 0; i < n * 2; i++) { g.beginPath(); g.ellipse(r() * w, r() * h, 3.5 + r() * 2.5, 2 + r() * 1.5, r() * 3.14, 0, 6.283); g.fill(); }
  g.globalAlpha = 1;
}
const BOARDS = { orech: walnut, bridlice: slate, ubrus: cloth, dlazdice: tiles, podzim: autumn, zima: winter, jaro: spring };
function paintBoard(theme = curTheme) {
  curTheme = BOARDS[theme] ? theme : "orech";
  const w = innerWidth, h = innerHeight, pr = Math.max(0.6, Math.min(devicePixelRatio || 1, 1.5, Math.sqrt(2.4e6 / (w * h))));
  boardCv.width = Math.round(w * pr); boardCv.height = Math.round(h * pr);
  const g = boardCv.getContext("2d"), r = Sim.rng(20261031 + Sim.THEMES.indexOf(curTheme) * 101);
  g.setTransform(pr, 0, 0, pr, 0, 0);
  BOARDS[curTheme](g, w, h, r);
  // viněta: střed o chlup světlejší, okraje do tmy
  const R = Math.hypot(w, h) * 0.62, v = g.createRadialGradient(w / 2, h * 0.46, R * 0.12, w / 2, h * 0.46, R);
  v.addColorStop(0, "rgba(255,190,120,.09)"); v.addColorStop(0.5, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(0,0,0,.62)");
  g.fillStyle = v; g.fillRect(0, 0, w, h);
  document.body.dataset.theme = curTheme;
}
// deska se mění s novým kolem: plynule zhasne, přemaluje a rozsvítí (odpočet má 3 s)
let themeT = 0;
function setTheme(id) {
  if (id === curTheme) return;
  clearTimeout(themeT);
  if (reduced) { paintBoard(id); return; }
  boardCv.style.opacity = "0";
  themeT = setTimeout(() => { paintBoard(id); boardCv.style.opacity = "1"; }, 360);
}
let boardRaf = 0;
addEventListener("resize", () => { cancelAnimationFrame(boardRaf); boardRaf = requestAnimationFrame(paintBoard); });
paintBoard();

// skvrny šťávy na desce: pár jemných kaluží, které za pár vteřin zmizí
const stainCv = $("stains"), sctx = stainCv.getContext("2d"), stains = [];
const JUICE = { meloun: "#F0505A", pomeranc: "#FFA02B", svestka: "#9B5BD4", citron: "#FFE45C", jablko: "#FFF1B8", kiwi: "#A6D654", karambola: "#FFD84A", zlate: "#FFD84A" };
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
  if (platform.canFs && !platform.standalone && !herna) {   // v Herně (iframe) celou obrazovku a plochu řeší Herna
    btn.hidden = false; paint();
    btn.addEventListener("click", async () => {
      try {
        if (isFs()) await (document.exitFullscreen || document.webkitExitFullscreen).call(document);
        else { const r = document.documentElement; await (r.requestFullscreen || r.webkitRequestFullscreen).call(r, { navigationUI: "hide" }); }
      } catch { toast("Prohlížeč celou obrazovku nepustil."); }
    });
    for (const ev of ["fullscreenchange", "webkitfullscreenchange"]) document.addEventListener(ev, () => { paint(); resize(); });
  }
  if (platform.ios && !platform.canFs && !platform.standalone && !herna && Net.store.get("ovs-ioshint") !== "1") {
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
    squish(pitch = 1) { if (!ok()) return; hiss(5200, 1.4, 0.07, 0.05, "highpass"); hiss(500 * pitch, 2, 0.22, 0.16, "lowpass"); tone(220 * pitch, 0.09, 0.12, "triangle", 0, 140 * pitch); },
    crunch() { if (!ok()) return; hiss(3200, 3, 0.18, 0.12, "highpass"); tone(1800, 0.05, 0.05, "square"); },
    boom() { if (!ok()) return; hiss(180, 0.8, 0.55, 0.6, "lowpass"); tone(90, 0.45, 0.35, "sine", 0, 40); },
    combo(n) { if (!ok()) return; [0, 4, 7, 12].slice(0, Math.min(4, n)).forEach((s, i) => tone(523 * 2 ** (s / 12), 0.14, 0.11, "triangle", i * 0.07)); },
    precise() { if (!ok()) return; tone(1568, 0.1, 0.1, "triangle"); tone(2093, 0.2, 0.09, "sine", 0.07); tone(3136, 0.12, 0.04, "sine", 0.13); },
    beep(hi) { if (!ok()) return; tone(hi ? 880 : 587, hi ? 0.32 : 0.14, 0.14, "square"); },
    incoming() { if (!ok()) return; tone(392, 0.09, 0.12, "triangle"); tone(311, 0.16, 0.12, "triangle", 0.1); },
    send() { if (!ok()) return; tone(660, 0.12, 0.08, "sine", 0, 1320); },
    miss() { if (!ok()) return; hiss(260, 1.2, 0.12, 0.14, "lowpass"); tone(196, 0.18, 0.13, "triangle", 0, 110); },
    finale() { if (!ok()) return; [0, 4, 7, 12, 16].forEach((s, i) => tone(392 * 2 ** (s / 12), 0.22, 0.1, "triangle", i * 0.06)); hiss(2400, 1, 0.08, 0.4, "highpass"); },
    tension() { if (!ok()) return; tone(82, 0.16, 0.3, "sine", 0, 60); tone(82, 0.2, 0.26, "sine", 0.24, 60); },
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
  mod: null, finAt: Infinity, fin0: false, scoreFin: 0, boost: false, sig: null, blade: 0,   // modifikátor kola, začátek finále (ms kola), dohánění, rozpis pro test, čepel
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
// naschvál bez textu: žeton s ikonou (šmouha, mráz, bomba) v barvě odesílatele letí od odesílatele k cíli,
// takže je vidět, kdo co poslal: můj žeton odlétá k soupeřově cedulce, soupeřův přilétá od jeho cedulky tam, kde naschvál zapůsobí
function token(type, color, x0, y0, x1, y1, ms = 480) {
  const el = document.createElement("div"), h = Math.min(48, Math.max(34, innerWidth * 0.032)) / 2;
  el.className = "tok"; el.style.setProperty("--tc", color); el.style.left = x0 - h + "px"; el.style.top = y0 - h + "px";
  el.style.transitionDuration = ms + "ms";
  el.innerHTML = `<svg viewBox="0 0 34 34" aria-hidden="true">${ICONS[type](color)}</svg>`;
  $("floats").appendChild(el);
  requestAnimationFrame(() => requestAnimationFrame(() => { el.style.transform = `translate(${x1 - x0}px, ${y1 - y0}px) rotate(${x1 > x0 ? 200 : -200}deg)`; }));
  setTimeout(() => el.classList.add("pop"), ms);
  setTimeout(() => el.remove(), ms + 260);
}
const signCenter = id => { const r = $(id).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
function shot(x, y, type) {
  const [tx, ty] = signCenter("signOpp");
  token(type, COLORS[room && room.seat ? room.seat : "x"], x, y, tx, ty);
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
  : `Kolo na ${lenAcc(ms)}, vyhrává vyšší skóre. Posledních pár vteřin je finále, kde se body sypou.`;
const howText = (md, ms, tg) => `Táhni přes ovoce, <b>bomby nesekej</b>. Řez blízko středu dá <b>Přesně!</b> a <span class="pts">+2 body</span>. Řezy nabíjejí měřič pod tvým jménem, plný pošle soupeři naschvál (šmouhu, mráz nebo bombu); combo 3+ a karambola ho pošlou hned, přesně rozseknutý led ho vrátí. Kdo je pozadu, nabíjí rychleji. Znamení v hodinách ukazuje zvláštnost kola (zlaté ovoce, řady, obří meloun, měsíční tíže). ${howEnd(md, ms, tg)}`;
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
    <div class="chips seg" id="modeChips" role="group" aria-labelledby="modeLab">${modeChips("cas120")}</div>
    <p class="modeline" id="modeLine">${modeLine("cas", Sim.ROUND_MS, TEST_TG || Sim.TARGET)}</p>
    <span class="lab" id="stakeLab">O co hrajeme <span class="small">(nepovinné)</span></span>
    <div class="chips" id="chips" role="group" aria-labelledby="stakeLab">${STAKES.map(s => `<button type="button" aria-pressed="false">${s}</button>`).join("")}</div>
    <input id="fStake" type="text" maxlength="40" placeholder="nebo napiš vlastní sázku" style="margin-top:8px">`,
    how: howTo("cas", Sim.ROUND_MS, TEST_TG || Sim.TARGET, "setupHow"),
    deco: DECO,
    cta: `<button class="btn" id="bCreate">Připravit výzvu</button>${herna ? "" : `<button class="btn alt solo" id="bSolo" type="button">Zkusit sám</button>`}`,
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
  $("bSolo")?.addEventListener("click", () => {
    const a = clampName($("fMe").value);
    if (a) Net.store.set("ovs-name", a);
    startSolo(picked(), a);
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
    ${herna ? (retry ? `<button class="btn" id="bRetry">Zkusit znovu</button>` : "") : retry ? `<button class="btn" id="bRetry">Zkusit znovu</button><button class="btn alt" id="bNew">Založit nový souboj</button>` : `<button class="btn" id="bNew">Založit nový souboj</button>`}`);
  $("bRetry")?.addEventListener("click", () => { clearTimeout(openFromHash.t); openFromHash(); });
  $("bNew")?.addEventListener("click", () => { clearTimeout(openFromHash.t); history.replaceState(null, "", location.pathname + location.search); room = null; viewSetup(); });
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
  if (herna) { openHerna(); return; }
  if (location.hash === "#solo") { startSolo(); return; }
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
// Herna: dokument hry má id z adresy. Zakladatel ho založí se jmény (sedadlo x), druhý čeká a posadí se na volné místo; s existujícím
// dokumentem (reload, smazané úložiště) si hráč sedne podle sedadla v Herně (meta.hx = sedadlo Herny, které drží x).
let hernaT = null;
async function openHerna() {
  clearTimeout(hernaT);
  const H = herna, again = ms => { hernaT = setTimeout(() => { if (herna === H) openHerna(); }, ms); };
  let meta;
  try { meta = await Net.load(Net.metaUrl(H.r)); }
  catch { if (!room) showView("loading", `<h2>Otevírám souboj…</h2><p>Spojení vázne, zkouším to znovu.</p>`); again(2000); return; }
  if (herna !== H) return;
  if (!meta) {
    if (!H.zaklada) {
      phase = "menu"; $("hud").hidden = true;
      if (view !== "hwait") showView("hwait", `<h2>Čeká se, až hra naskočí…</h2><p>Soupeř ji právě chystá, rozjede se sama.</p>`);
      again(800); return;
    }
    const c = CHOICES[1];
    meta = { app: "ovocny-souboj", v: 1, sx: Net.device, so: "", hx: H.hs, g: { a: H.names[H.hs], b: H.names[1 - H.hs], st: "", md: c.md, rl: rlFor(c), tg: TEST_TG || Sim.TARGET, go: 0, sd: 0, mh: {} } };
    try { await Net.save(Net.metaUrl(H.r), meta); await Net.save(Net.seatUrl(H.r, "x"), seatDoc()); }
    catch { again(1500); return; }
    Net.store.set(seatKey(H.r), "x");
  } else if (meta.app !== "ovocny-souboj") { viewError("Tahle místnost není pro Ovocný souboj."); return; }
  else {
    const hx = meta.hx === 0 || meta.hx === 1 ? meta.hx : 1 - H.hs;
    const seat = H.hs === hx ? "x" : "o", slot = "s" + seat;
    if (meta[slot] !== Net.device) {
      try { const r = await Net.commitMeta(H.r, d => d && d[slot] !== Net.device ? { ...d, [slot]: Net.device } : null); if (r.d) meta = r.d; }
      catch { again(1500); return; }
    }
    Net.store.set(seatKey(H.r), seat);
  }
  if (herna !== H) return;
  await enterRoom(H.r, meta);
  if (herna !== H) return;
  decide(true);
}
// sedadlo v Herně pro vnitřní sedadlo x/o
const hernaSeat = q => { const hx = room && room.meta.hx; const xs = hx === 0 || hx === 1 ? hx : room.seat === "x" ? herna.hs : 1 - herna.hs; return q === "x" ? xs : 1 - xs; };
const hernaSent = new Set();
function hernaResult(winner, go) {
  const partie = herna.r + ":" + Sim.mOf(go);
  if (hernaSent.has(partie)) return;
  hernaSent.add(partie);
  doHerny({ typ: "vysledek", partie, vitez: winner ? hernaSeat(winner) : null });
}
// fáze pro Hernu: ceka (na soupeře, v předsíni) / hraje (odpočet, kolo, čekání na dohrání soupeře) / konec (výsledek)
let hernaLast = "";
function hernaTick() {
  if (!herna) { hernaLast = ""; return; }
  // „wait“ po obnovení stránky (kolo jsem nehrál v tomto načtení, soupeřův dokument se teprve čte) nehlásí hraje, jen drží předchozí fázi
  const f = !room || !room.seat || !room.meta.so ? "ceka" : phase === "result" ? "konec" : phase === "wait" && K !== (room.meta.g.go || 0) ? (hernaLast || "ceka") : phase === "count" || phase === "play" || phase === "wait" ? "hraje" : "ceka";
  if (f !== hernaLast) { hernaLast = f; doHerny({ typ: "stav", faze: f }); }
}
setInterval(hernaTick, 200);
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

// ---------- sólo: trénink proti botovi, bez sítě ----------
// Stejné obrazovky i kolo jako ostrá hra, jen místnost je lokální objekt: zápisy zůstávají v paměti, soupeř je bot (src/bot.js) a nic se
// neposílá do mantledb, nepočítá se do série, čepelí ani titulů. Adresa #solo otevře režim přímo.
let soloBot = null, soloVer = "";
const localWriter = doc => { let d = { ...doc }; return { doc: () => d, set(p) { d = { ...d, ...p }; }, onNet: null, stop() {}, pending: () => false }; };
// čti-ověř-zapiš nad metadaty: v sólu se sloučí jen v paměti
async function commit(ok) {
  if (!room.solo) return Net.commitMeta(room.id, ok);
  const next = ok(room.meta);
  if (!next) return { d: room.meta, ok: false };
  room.meta = { ...next, v: (room.meta.v || 0) + 1 };
  return { d: room.meta, ok: true };
}
function startSolo(c, name) {
  stopPoll(); soloBot = null;
  c = c || CHOICES[1];
  const a = name || clampName(Net.store.get("ovs-name") || "") || "Ty";
  const meta = { app: "ovocny-souboj", v: 1, sx: Net.device, so: "bot", g: { a, b: BOT_NAME, st: "", md: c.md, rl: rlFor(c), tg: TEST_TG || Sim.TARGET, go: 0, sd: 0, mh: {} } };
  room = { id: "solo", solo: true, meta, seat: "x", w: localWriter(seatDoc()), opp: seatDoc(), seenEv: 0, seenK: 0 };
  document.body.dataset.solo = "1";
  paintSeatColors(); setNet("");
  history.replaceState(null, "", location.pathname + location.search + "#solo");
  viewSoloLobby();
}
function leaveSolo() {
  stopPoll(); soloBot = null; room = null; delete document.body.dataset.solo;
  document.body.classList.remove("finale", "napeti"); game.tension = false; setBoost(false); setModIcon(null);
  history.replaceState(null, "", location.pathname + location.search);
  viewSetup();
}
function viewSoloLobby() {
  phase = "lobby"; $("hud").hidden = false; hudNames(); setModIcon(null); setBoost(false);
  const g = room.meta.g, md = Sim.modeOf(g.md), next = 11;
  K = 0; $("timer").textContent = fmtClock(md === "cas" ? Math.round(g.rl / 1000) : 0); $("timer").classList.remove("low");
  cells($("cellsMe"), 0); cells($("cellsOpp"), 0); hudSeries({}, {}, 1, md); hudOppState();
  paintLives($("livesMe"), Sim.LIVES); paintLives($("livesOpp"), Sim.LIVES);
  showView("lobby", `
    <h2>Trénink proti ${esc(BOT_DAT)}</h2>
    <p class="modeline" id="modeLine"><b>${modeName(md, g.tg)}.</b> ${modeLine(md, g.rl, g.tg)}</p>
    <span class="lab" id="modeLab">Mód</span>
    <div class="chips seg" id="modeChips" role="group" aria-labelledby="modeLab">${modeChips(choiceId(md, g.rl))}</div>
    <button class="btn" id="bReady">Jdu do toho</button>
    <button class="btn alt" id="bChallenge">Vyzvat soupeře</button>
    ${howTo(md, g.rl, g.tg, "soloHow")}`);
  $("bReady").addEventListener("click", () => ready(next));
  $("bChallenge").addEventListener("click", leaveSolo);
  $("modeChips").addEventListener("click", e => {
    const b = e.target.closest("button"), c = b && CHOICES.find(x => x.id === b.dataset.c); if (!c) return;
    $("modeChips").querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
    const g2 = room.meta.g; g2.md = c.md; g2.rl = rlFor(c);
    $("modeLine").innerHTML = `<b>${modeName(c.md, g2.tg)}.</b> ${modeLine(c.md, g2.rl, g2.tg)}`;
    $("soloHow").querySelector("p").innerHTML = howText(c.md, g2.rl, g2.tg);
    $("timer").textContent = fmtClock(c.md === "cas" ? Math.round(g2.rl / 1000) : 0);
    hudSeries({}, {}, 1, c.md);
  });
}
// bot hraje v taktu hodin kola; do dokumentu soupeře se propíše, jen když se něco změnilo (jako při čtení ze sítě)
function soloTick(clock) {
  const b = soloBot.tick(clock, { score: game.score, lives: game.lives }), o = room.opp;
  const ver = b.score + "|" + b.lives + "|" + b.ev.length + "|" + b.fin;
  if (ver === soloVer) return;
  soloVer = ver;
  o.sc = b.score; o.ev = b.ev; o.lv = b.lives;
  if (b.fin != null) o.f = { ...o.f, [K]: b.fin };
  onOpp(o);
}
// hráč skončil kolo: bot dohraje do téhož okamžiku a jeho výsledek se zapíše jako výsledek soupeře
function soloConclude() {
  const clock = Math.min(clockNow(), game.rl), b = soloBot.finish(clock), o = room.opp;
  const f = { ...o.f };
  if (b.fin != null) f[K] = b.fin;
  else if (game.md === "zivoty" && game.endWhy === "mrtvy") f[K] = Math.max(Math.round(clock), (game.fin || 0) + 1);   // přežil hráče
  room.opp = { ...o, sc: b.score, ev: b.ev, lv: b.lives, f, h: { ...o.h, [K]: b.score } };
  cells($("cellsOpp"), b.score); paintLives($("livesOpp"), b.lives);
}

// ---------- polling: co a jak často číst podle fáze ----------
let pollT = null, pollSeq = 0, fails = 0;
function pollPlan() {
  if (!room || room.solo) return null;   // sólo nikdy nesahá do sítě
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
  // semínko dalšího kola: modifikátor i deska jiné než v předchozím kole (stejné pro oba, čtou ho z g.sd)
  const sd = Sim.pickSeed(room.meta.g.sd || 0, () => crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296);
  try {
    const r = await commit(m => {
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
  if (room.solo) room.opp.rdy = k;   // bot je vždy připravený
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
  if (room.solo) { $("stateOpp").textContent = ""; $("stateMe").textContent = ""; return; }
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
  $("ser").innerHTML = room.solo ? `<span class="trn">trénink</span>` : m > 1 || mine[0] + mine[1] > 0 ? `série <b class="${room.seat}">${mine[0]}</b> : <b class="${other(room.seat)}">${mine[1]}</b>` : `souboj č. ${m}`;
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
  if (room.solo) { viewSoloLobby(); return; }
  phase = "lobby"; $("hud").hidden = false; hudNames(); setModIcon(null);
  const g = room.meta.g, d = mine(), next = 11;
  const md = Sim.modeOf(g.md);
  K = 0; $("timer").textContent = fmtClock(md === "cas" ? Math.round(g.rl / 1000) : 0); $("timer").classList.remove("low");
  cells($("cellsMe"), 0); cells($("cellsOpp"), 0); { const [hx, ho] = hists(); hudSeries(hx, ho, Sim.mOf(next), md); } hudOppState();
  paintLives($("livesMe"), Sim.LIVES); paintLives($("livesOpp"), Sim.LIVES);
  const joined = !!room.meta.so, rdy = d.rdy >= next;
  const sig = `lobby|${joined}|${rdy}${herna ? "|" + g.md + "|" + g.rl : ""}`;
  if (view === "lobby" && panel.dataset.sig === sig) return;
  if (herna) {   // bez výzvy: jména už jsou známá, mód první partie se dá vybrat tady, pravidla jsou po ruce (úvodní obrazovka se přeskakuje)
    showView("lobby", `
    <h2>${joined ? "Můžete hrát" : `Čeká se na hráče ${esc(oppName())}`}</h2>
    <p class="modeline"><b>${modeName(md, g.tg)}.</b> ${modeLine(md, g.rl, g.tg)}</p>
    <span class="lab" id="modeLab">Mód</span>
    <div class="chips seg" id="modeChips" role="group" aria-labelledby="modeLab">${modeChips(choiceId(md, g.rl))}</div>
    <p style="margin-top:12px">${joined ? (rdy ? `Jakmile bude ${esc(oppName())} taky připraven(a), naskočí odpočet.` : "Až klepneš, počkáme na soupeře a pak odpočet 3, 2, 1.") : "Hra se rozjede sama, jakmile si soupeř sedne."}</p>
    ${joined ? `<button class="btn" id="bReady" ${rdy ? "disabled" : ""}>${rdy ? "Čekám na soupeře…" : "Jdu do toho"}</button>` : ""}
    ${howTo(md, g.rl, g.tg)}`);
    panel.dataset.sig = sig;
    $("bReady")?.addEventListener("click", () => ready(next));
    $("modeChips").addEventListener("click", e => { const b = e.target.closest("button"); if (b) setMode(b); });
    return;
  }
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
      ${herna ? "" : `<button class="btn alt" id="bLink">Poslat odkaz a vrátit se později</button>`}`);
    $("bHold").addEventListener("click", () => { game.waitHold = Date.now(); viewWaiting(); });
    $("bLink")?.addEventListener("click", async () => {
      const t = `${room.meta.g.a} a ${room.meta.g.b}, tady je náš Ovocný souboj, výsledek tam čeká: ${linkFor()}`;
      try { if (navigator.share) await navigator.share({ text: t }); else { await navigator.clipboard.writeText(t); toast("Odkaz zkopírován, vlož ho do chatu."); } } catch {}
    });
  }
  panel.dataset.sig = sig;
}
function viewResult(hx, ho) {
  phase = "result"; $("hud").hidden = false; hudNames();
  const go = room.meta.g.go, m = Sim.mOf(go), st = hudSeries(hx, ho, m), me = room.seat, d = mine();
  game.blade = myTier();
  const r = st.rounds[0] || { x: hx[go], o: ho[go], w: null }, md = st.md, g = room.meta.g, o = room.opp || seatDoc();
  cells($("cellsMe"), me === "x" ? r.x : r.o); cells($("cellsOpp"), me === "x" ? r.o : r.x);
  paintLives($("livesMe"), d.lv == null ? Sim.LIVES : d.lv); paintLives($("livesOpp"), o.lv == null ? Sim.LIVES : o.lv);
  // ve třech životech je rozhodující výdrž: velké číslo je čas (kdo přežil, má celou délku kola), body jsou pod ním
  const cap = g.gl || Sim.lengthFor(md, g.rl), sec = f => Math.floor(Math.min(f == null ? cap : f, cap) / 1000);
  // hodiny na výsledku: na čas 0:00, závod čas vítěze v cíli, tři životy moje výdrž
  const finT = md === "zavod" ? [r.fx, r.fo].filter(f => f != null).sort((a, b) => a - b)[0] : me === "x" ? r.fx : r.fo;
  $("timer").textContent = md === "cas" ? "0:00" : fmtClock(sec(finT)); $("timer").classList.remove("low");
  const nextK = st.nextK, rdy = d.rdy >= nextK;
  if (herna) hernaResult(st.winner, go);
  $("stateMe").textContent = rdy ? "připraveno" : "";
  $("stateOpp").textContent = room.opp && room.opp.rdy >= nextK ? "připraveno" : "";
  const sig = `${go}|${rdy}|${room.opp && room.opp.rdy}|${g.md}|${g.rl}`;
  if (view === "result" && panel.dataset.sig === sig) return;
  const wName = w => esc(nameOfSeat(w));
  // kdo přežil soupeře, má kolo ukončené jeho smrtí: stejná vteřina jako poražený, proto „+“ (vydržel/a aspoň tak dlouho)
  const lvOf = seat => { const v = seat === me ? d.lv : o.lv; return v == null ? Sim.LIVES : v; };
  const big = seat => md === "zivoty" ? fmtClock(sec(r["f" + seat])) + (lvOf(seat) > 0 && sec(r["f" + seat]) < cap / 1000 ? "+" : "") : r[seat];
  const [hiS, loS] = st.winner === "o" ? ["o", "x"] : ["x", "o"];
  const ser = Sim.series(hx, ho, histEx());
  const head = room.solo ? (st.winner ? st.winner === me ? "Vyhráváš!" : `Vyhrává ${esc(BOT_NAME)}` : "Remíza") : st.winner ? `Souboj bere ${wName(st.winner)}` : "Remíza";   // v sólu bez jména hráče („Souboj bere Ty“)
  const headScore = `${head} ${big(hiS)} : ${big(loS)}${md === "cas" ? "" : ` (${modeName(md, g.tg).toLowerCase()})`}`;   // do chatu i se skóre
  const sub = seat => md === "zivoty" ? `${r[seat]} ${bodu(r[seat])}`
    : md === "zavod" && r["f" + seat] != null ? `v cíli za ${fmtClock(sec(r["f" + seat]))}`
    : st.winner ? (st.winner === seat ? "bere souboj" : room.solo ? "" : "chce odvetu") : "remíza";   // bot odvetu nechce, v sólu poražený mlčí
  // čepel odemčená výhrami v sérii: pod skóre vzorek stopy, u mé nové se krátce vyskočí
  const seenKey = "ovs-seen-" + room.id, seen = room.solo ? 0 : +Net.store.get(seenKey) || 0, myT = Sim.bladeTier(winsOf(me));
  if (!room.solo && myT !== seen) Net.store.set(seenKey, String(myT));
  const bl = seat => { if (room.solo) return ""; const tr = Sim.bladeTier(winsOf(seat)); return tr ? `<div class="bl${seat === me && tr > seen ? " new" : ""}" data-tier="${tr}">${bladeSvg(tr, COLORS[seat])}</div>` : ""; };
  const side = (seat, name) => `<div class="p ${seat}${st.winner === seat ? " win" : ""}"><div class="n">${esc(name)}</div><div class="s">${big(seat)}</div><div class="st">${sub(seat)}</div>${bl(seat)}</div>`;
  const oppRdy = room.opp && room.opp.rdy >= nextK;
  const stake = g.st ? `<div class="stake">${st.winner ? `${wName(other(st.winner))} platí: ${esc(g.st)}` : `Sázka (${esc(g.st)}) zůstává ve hře`}</div>` : "";
  const hint = room.solo ? "" : herna ? (oppRdy ? `${esc(oppName())} už čeká na tebe.` : rdy ? "Odpočet naskočí, až klepne i soupeř." : "") : oppRdy ? `${esc(oppName())} už čeká na tebe.` : rdy ? "Odpočet naskočí, až klepne i soupeř. Nechce se mu? Pošli odkaz a vraťte se později." : "";
  showView("result", cols({
    head: `<h2>${head}</h2>`,
    form: `<div class="vs">${room.seat === "o" ? side("o", g.b) + '<div class="mid">:</div>' + side("x", g.a) : side("x", g.a) + '<div class="mid">:</div>' + side("o", g.b)}</div>`,   // já vlevo, stejně jako v HUD
    intro: stake,
    cta: `<span class="lab" id="nextLab">${room.solo ? "Další kolo v módu" : "Odveta v módu"}</span>
    <div class="chips seg" id="modeChips" role="group" aria-labelledby="nextLab">${modeChips(choiceId(Sim.modeOf(g.md), g.rl))}</div>
    <button class="btn" id="bNext" ${rdy && !room.solo ? "disabled" : ""}>${room.solo ? "Znovu" : rdy ? "Čekám na soupeře…" : "Odveta"}</button>
    ${hint ? `<p class="small" style="margin:8px 0 0;text-align:center">${hint}</p>` : ""}
    ${room.solo ? `<button class="btn alt" id="bChallenge">Vyzvat soupeře</button>` : herna ? `<button class="btn alt" id="bOther" type="button">Jiná hra</button>` : `<button class="btn alt" id="bShareRes">Poslat výsledek do chatu</button>`}`,
  }), true);
  panel.dataset.sig = sig;
  $("modeChips").addEventListener("click", e => { const b = e.target.closest("button"); if (b) setMode(b); });
  $("bNext").addEventListener("click", () => ready(nextK));
  $("bChallenge")?.addEventListener("click", leaveSolo);
  $("bOther")?.addEventListener("click", () => doHerny({ typ: "jina-hra" }));
  $("bShareRes")?.addEventListener("click", async () => {
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
    const r = await commit(m => m ? { ...m, g: { ...m.g, md: c.md, rl: rlFor(c), tg: m.g.tg || TEST_TG || Sim.TARGET } } : null);
    if (r.d) room.meta = r.d;
    window.__ovs.log.push({ ev: "mode", md: c.md, at: Date.now() });
  } catch { toast("Změna módu nevyšla, zkus to znovu."); }
  decide(false);
}

// ---------- zvláštnost kola, finále, čepel ----------
// znamení modifikátoru: kulatá cedulka (křída s dřevěným lemem) s plochým obrázkem; v hodinách HUD a na pár vteřin velká při odpočtu, bez textu
const COIN = '<circle cx="20" cy="20" r="18.5" fill="#23302B" stroke="#8A5A33" stroke-width="3"/>';
const MOD_ICONS = {
  zlate: COIN + '<ellipse cx="20" cy="24" rx="10" ry="9.4" fill="#FFD23F"/><path d="M20 15v-4" stroke="#8A5A2B" stroke-width="2.2" stroke-linecap="round"/><path d="M21 14c4-4 8-2 8-2s-1 5-6 5z" fill="#4E9B3A"/><path d="M11 9l1.5 3.3L16 14l-3.5 1.6L11 19l-1.5-3.4L6 14l3.5-1.7z" fill="#FFF3B0"/><path d="M15 21q2-3 5-3" stroke="#FFF3B0" stroke-width="1.6" fill="none" stroke-linecap="round"/>',
  rady: COIN + '<g stroke="#F1E6D0" stroke-opacity=".5" stroke-width="1.6" stroke-linecap="round"><path d="M5 31L35 9"/></g><circle cx="9" cy="27" r="3.8" fill="#FF9419"/><circle cx="15" cy="23" r="3.8" fill="#FFE45C"/><circle cx="21" cy="19" r="3.8" fill="#E8414B"/><circle cx="27" cy="15" r="3.8" fill="#9B5BD4"/><circle cx="33" cy="11" r="3.8" fill="#8FC63F"/>',
  obri: COIN + '<circle cx="20" cy="21" r="12.5" fill="#2F7D3A"/><path d="M12 14q-4 7 2 15M20 9q-4 12 0 24M28 14q4 7-2 15" stroke="#1D5428" stroke-width="2.4" fill="none" stroke-linecap="round"/><path d="M8 10L32 33" stroke="#F1E6D0" stroke-width="3.6" stroke-linecap="round"/><path d="M8 10L32 33" stroke="#E8414B" stroke-width="2" stroke-linecap="round"/>',
  mesic: COIN + '<path d="M24 7.5a12.5 12.5 0 1 0 8 19.5 10.5 10.5 0 0 1-8-19.5z" fill="#F6EBD3"/><circle cx="25.5" cy="25" r="3.8" fill="#FF9419"/><circle cx="31" cy="14" r="1.4" fill="#F6EBD3"/><circle cx="12" cy="31" r="1.2" fill="#F6EBD3"/>',
};
// finále: zlatá hvězdice s vějířem ovoce, bez textu (v hodinách nahradí znamení modifikátoru a krátce vyskočí velká)
const FIN_ICON = COIN.replace("#23302B", "#3A2A12").replace("#8A5A33", "#FFC93C") + '<path d="M20 6l3.6 8.4 9.1.8-6.9 6 2.1 8.9L20 25.4l-7.9 4.7 2.1-8.9-6.9-6 9.1-.8z" fill="#FFD23F"/><circle cx="20" cy="19" r="3.4" fill="#E8414B"/><circle cx="11" cy="31" r="2.6" fill="#FF9419"/><circle cx="29" cy="31" r="2.6" fill="#8FC63F"/><circle cx="20" cy="33" r="2.2" fill="#9B5BD4"/>';
MOD_ICONS.finale = FIN_ICON;
function setModIcon(mod) {
  const el = $("modIcon");
  el.toggleAttribute("hidden", !mod); el.dataset.mod = mod || "";
  el.innerHTML = mod ? MOD_ICONS[mod] : "";
  el.classList.remove("pop"); if (mod && !reduced) { void el.getBoundingClientRect(); el.classList.add("pop"); }   // při nástupu krátce pulzne, ať si ho hráč všimne
}
function showMod(mod) {
  setModIcon(mod);
  const big = $("modBig");
  big.innerHTML = `<svg viewBox="0 0 40 40">${MOD_ICONS[mod]}</svg>`; big.dataset.mod = mod;
  big.classList.remove("off"); void big.offsetWidth; big.classList.add("on");
}
const hideModBig = () => { const b = $("modBig"); if (b.classList.contains("on")) { b.classList.remove("on"); b.classList.add("off"); } };
// otisk rozpisu pro testy: počet a druhy kusů, počet finálových a obřích, hash (oba hráči musí mít totéž)
function schedSig(s) {
  const kinds = {}; let h = 5381;
  for (const it of s) {
    kinds[it.kind] = (kinds[it.kind] || 0) + 1;
    const str = it.t + it.kind + it.u.toFixed(4) + it.apex.toFixed(3) + (it.gm || 1) + (it.hp || 0) + (it.fin ? "F" : "");
    for (let i = 0; i < str.length; i++) h = (Math.imul(h, 33) ^ str.charCodeAt(i)) >>> 0;
  }
  return { n: s.length, kinds, hash: h, fin: s.filter(i => i.fin).length, big: s.filter(i => i.hp).length, moon: s.some(i => i.gm && i.gm !== 1 && !i.fin) };
}
// finále: kolo na čas, posledních 8,6 s (2 min) nebo 5,8 s (1 min); deska se rozsvítí teplem, hodiny zezlátnou, zazní fanfára a krátce vyskočí zlatý znak (bez textu); první vlna plave pomalu
function startFinale(clock) {
  game.fin0 = true; game.scoreFin = game.score; game.queue.length = 0;
  document.body.classList.add("finale");
  showMod("finale"); setTimeout(() => { if (phase === "play") hideModBig(); }, 1100);   // žádný text přes plochu: velký zlatý znak, zlaté hodiny a teplé světlo
  sound.finale(); buzz([30, 40, 30]);
  window.__ovs.log.push({ ev: "finale", clock: Math.round(clock), at: Date.now(), score: game.score });
}
// výhry v sérii (z historie skóre obou hráčů): z nich se odvodí čepel; nejvyšší dosažená se pamatuje v localStorage (po znovunačtení stránky ještě nemusí být soupeřův doc)
function winsOf(seat) {
  if (room.solo) return 0; const [hx, ho] = hists(), ser = Sim.series(hx, ho, histEx()); return seat === "x" ? ser[0] : ser[1]; }
function myTier() {
  if (room.solo) return 0;   // sólo se nepočítá do kosmetiky
  const w = winsOf(room.seat), key = "ovs-wins-" + room.id, c = +Net.store.get(key) || 0;
  if (w > c) Net.store.set(key, String(w));
  return Sim.bladeTier(Math.max(w, c));
}
// vzorek čepele na výsledku (stejný vzhled jako ve hře, plochý vektor)
function bladeSvg(tier, c) {
  if (!tier) return "";
  const P = "M5 17Q28 3 75 11";
  const halo = tier === 3 ? "#FFC93C" : tier === 4 ? "url(#bg)" : c, core = tier === 3 ? "#FFF4C2" : "#FFFCF2";
  let g = tier === 4 ? '<defs><linearGradient id="bg" x1="0" x2="1"><stop offset="0" stop-color="#FF6B6B"/><stop offset=".25" stop-color="#FFD84A"/><stop offset=".5" stop-color="#5FE0C3"/><stop offset=".75" stop-color="#5BA8FF"/><stop offset="1" stop-color="#C77DFF"/></linearGradient></defs>' : "";
  if (tier === 2) g += `<path d="M5 13Q28 0 75 7" stroke="${c}" stroke-width="3.2" fill="none" stroke-linecap="round"/><path d="M5 21Q28 8 75 15" stroke="${c}" stroke-width="3.2" fill="none" stroke-linecap="round"/><path d="M5 13Q28 0 75 7M5 21Q28 8 75 15" stroke="#FFFCF2" stroke-width="1.2" fill="none" stroke-linecap="round"/>`;
  else g += `<path d="${P}" stroke="${halo}" stroke-opacity=".55" stroke-width="9" fill="none" stroke-linecap="round"/><path d="${P}" stroke="${core}" stroke-width="3.4" fill="none" stroke-linecap="round"/>`;
  if (tier === 1) g += `<g fill="${c}"><circle cx="22" cy="6" r="2"/><circle cx="40" cy="17" r="2.3"/><circle cx="55" cy="4" r="1.7"/><circle cx="67" cy="17" r="2"/></g>`;
  if (tier === 4) g += '<path d="M75 3l2.2 5 5.3.4-4 3.6 1.3 5.2-4.8-2.8-4.8 2.8 1.3-5.2-4-3.6 5.3-.4z" fill="#FFF4C2"/>';
  return `<svg viewBox="0 0 88 22" aria-hidden="true">${g}</svg>`;
}

// ---------- kolo ----------
function beginCountdown(k, seed, rl, delay, md) {
  if (phase === "count" || phase === "play") return;
  K = k; phase = "count";
  game.rl = rl || Sim.ROUND_MS;
  const mdm = Sim.modeOf(md);
  game.sched = Sim.roundSchedule(seed, game.rl, mdm).map(it => ({ ...it }));   // základ ze semínka + modifikátor kola + finále, stejné pro oba
  game.mod = Sim.modOf(seed); game.sig = schedSig(game.sched); game.fin0 = false; game.scoreFin = 0; game.finCuts = 0;
  game.finAt = Sim.hasFinale(mdm, game.rl) ? Sim.finaleStart(game.rl) : Infinity;
  document.body.classList.remove("finale", "napeti"); game.tension = false; setBoost(false); game.blade = myTier(); setTheme(Sim.themeOf(seed)); showMod(game.mod);
  game.next = 0; game.score = 0; game.ev = []; game.queue = []; game.lastSend = -1e9; game.lastApplied = -1e9;
  game.stroke = null; game.cuts = 0; game.bombs = 0; game.sent = 0; game.got = 0; game.doneAt = 0; game.waitHold = 0;
  game.precise = 0; game.charge = 0; game.fireN = 0; paintCharge(); window.__ovs.feel = { spawns: [], vis: [] };
  game.md = Sim.modeOf(md); game.tg = room.meta.g.tg || Sim.TARGET; game.lives = Sim.LIVES; game.fin = null; game.oppF = null; game.endWhy = null;
  for (const o of game.live) scene.remove(o); game.live = [];
  scene.clear();
  if (room.solo) {   // soupeř je bot: nový dokument soupeře pro kolo, bot hraje stejný rozpis jako hráč
    soloBot = createBot({ sched: game.sched, md: game.md, rl: game.rl, tg: game.tg, seed });
    room.opp = { ...room.opp, k, sc: 0, ev: [], lv: Sim.LIVES, rdy: k, f: { ...(room.opp.f || {}) } }; soloVer = "";
  }
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
  if (room.solo) soloConclude();
  document.body.classList.remove("finale", "napeti"); game.tension = false; setBoost(false); hideModBig();
  const d = mine();
  room.w.set({ sc: game.score, h: { ...d.h, [K]: game.score }, ...(game.fin != null ? { f: { ...(d.f || {}), [K]: game.fin } } : {}) }, true);
  sound.end(); buzz([70, 50, 140]);
  game.doneAt = Date.now();
  for (const o of game.live) scene.remove(o); game.live = [];
  $("count").innerHTML = `<span class="go">${game.endWhy === "cil" ? "V cíli!" : "Konec!"}</span>`;
  setTimeout(() => { if (phase !== "count") $("count").innerHTML = ""; }, 900);
  window.__ovs.log.push({ ev: "end", k: K, md: game.md, why: game.endWhy || "cas", fin: game.fin, score: game.score, at: Date.now(), mod: game.mod, scoreFin: game.scoreFin, fin0: game.fin0, finCuts: game.finCuts || 0, stats: fpsStats() });
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
// dohánění: kdo je výrazně pozadu (podle soupeřova živého skóre, čteného se zpožděním ~0,5 s), nabíjí měřič dvakrát rychleji; vidět je to jen na měřiči
function addCharge(n) {
  const m = game.boost ? Sim.BOOST.mul : 1, cl = window.__ovs.chargeLog;
  game.charge = Math.min(Sim.CHARGE_MAX, game.charge + n * m); paintCharge();
  cl.push([n, n * m, game.boost]); if (cl.length > 800) cl.shift();
}
// napětí v módech bez finále (bez textu, stejný jazyk jako finále): závod, když má kdokoli 10 bodů od cíle; tři životy, když je kdokoli
// na posledním životě. Deska zčervená a pulzuje, rámeček hodin tepe, jednou zazní tep. Zůstane do konce kola (žádné blikání při −10 za bombu).
function updateTension() {
  if (game.tension || game.md === "cas" || game.fin != null) return;
  const o = room.opp && room.opp.k === K ? room.opp : null;
  const on = game.md === "zavod" ? Math.max(game.score, o ? o.sc || 0 : 0) >= game.tg - 10
    : Math.min(game.lives, o && o.lv != null ? o.lv : Sim.LIVES) <= 1;
  if (!on) return;
  game.tension = true;
  document.body.classList.add("napeti");
  sound.tension(); buzz([20, 80, 20]);
  window.__ovs.log.push({ ev: "napeti", md: game.md, score: game.score, lives: game.lives, at: Date.now() });
}
function setBoost(on) {
  if (game.boost === on) return;
  game.boost = on;
  $("chargeMe").classList.toggle("boost", on); $("signMe").classList.toggle("boost", on);
  window.__ovs.log.push({ ev: "boost", on, score: game.score, opp: room.opp ? room.opp.sc : null, at: Date.now() });
}
function updateBoost() {
  const o = room.opp;
  if (game.fin0 || !o || o.k !== K) { setBoost(false); return; }
  setBoost(Sim.boostNext(game.boost, game.md, game.score, o.sc || 0, game.lives, o.lv == null ? Sim.LIVES : o.lv));
}
function tryFire(now) {
  if (game.charge < Sim.CHARGE_MAX || now - game.lastSend < 2500) return;
  const type = Sim.FIRE_ORDER[game.fireN % 3], { x, y } = game.lastPos;
  if (!sendSabotage(type, x, y)) return;
  game.fireN++; game.charge = 0; paintCharge();
  window.__ovs.log.push({ ev: "fire", type, at: Date.now() });
}
function sendSabotage(type, x, y, force) {
  if (game.fin0) return false;   // finále je čistý sprint o body
  const now = performance.now();
  if (!force && now - game.lastSend < 2500) return false;
  game.lastSend = now; game.sent++;
  game.ev = [...game.ev, [game.ev.length, type, Math.round(now - game.start)]];
  window.__ovs.log.push({ ev: "send", type, at: Date.now() });
  room.w.set({ ev: game.ev }, true);
  if (room.solo && soloBot) soloBot.recv(type, now - game.start);
  sound.send();
  shot(x, y, type);
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
  const [sx, sy] = signCenter("signOpp"), H = scene.h;
  if (type === "bomba") {
    const b = Sim.sabotageBomb(game.sched, clock + 750);
    game.sched.push({ ...b, id: 1000 + game.got, spin: [0, 0, 1, 2], band: c, from: who });   // dráha nejdál od ostatních kusů
    token("bomba", c, sx, sy, (b.u * scene.fieldHalf / scene.halfW + 1) / 2 * scene.w, H - 30, 620);   // žeton zapadne tam, odkud bomba vyletí
    game.sched.sort((a, b) => a.t - b.t);
    game.next = Math.min(game.next, game.sched.findIndex(it => it.t > clock - 1));
    if (game.next < 0) game.next = game.sched.length - 1;
  } else if (type === "smouha") {
    const at = smearSpot();
    token("smouha", c, sx, sy, at[0] / 100 * scene.w, at[1] / 100 * H, 420);
    setTimeout(() => { if (phase === "play") smear(c, at); }, 400);
  } else {
    token("mraz", c, sx, sy, scene.w / 2, H * 0.72, 520);
    let n = 0;
    for (const it of game.sched) if (it.t > clock + 400 && it.kind !== "bomba" && it.kind !== "karambola" && it.kind !== "zlate" && !it.hp && !it.fin && !it.frozen && !it.spawned && n < 2) { it.frozen = true; n++; }
  }
  window.__ovs.log.push({ ev: "got", type, at: Date.now() });
}
const smearSpot = () => [Math.random() < 0.5 ? 30 : 70, 38 + Math.random() * 20];
function smear(c, [cx, cy] = smearSpot()) {
  const el = $("smear");
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
let trail = [], pointerDown = false, lastPt = null, touchAt = null;
// čas události ukazatele (ms jako performance.now()); když by prohlížeč dal jiný základ, vezme se přítomnost
const ptrTime = e => { const n = performance.now(), t = e.timeStamp; return t > 0 && Math.abs(t - n) < 250 ? t : n; };
const gclock = t => phase === "play" || phase === "count" ? t - game.start : t;
// střed kusu na obrazovce v čase t: kusy se mezi snímky hýbou, čepel taky, proto se pozice počítá v čase konců úsečky (ne jen z posledního snímku)
function posOf(o, t) {
  const z = o.g.position.z;
  if (o.pin || !o.it) return scene.toScreen(o.g.position.x, o.g.position.y, z);
  const p = Sim.posAt(o.it, Math.max(0, (gclock(t) - o.t0) / 1000));
  return scene.toScreen(p.x * scene.fieldHalf, p.y, z);
}
// úsečka čepele a--b proti pohybující se kouli (střed z polohy v čase a.t do polohy v čase b.t): rychlý švih ani uletělý kus se nepřeskočí.
// Ovoce má zásahovou zónu o něco větší než sám kus, bomba jen 60 % poloměru: švih mířený na sousední ovoce ji netrefí.
function cutTest(a, b) {
  const ax = a.x, ay = a.y, bx = b.x, by = b.y, now = b.t;
  const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
  if (len2 < 9) return;
  const speed = Math.sqrt(len2);
  for (const o of [...game.live]) {
    if (o.dead || (o.immune && now < o.immune)) continue;
    // bomba se nepočítá, dokud se prst od místa dotyku nehnul o víc než 12 px: položení prstu vedle bomby a jeho chvění nezabíjí
    if (o.kind === "bomba" && touchAt && Math.hypot(ax - touchAt.x, ay - touchAt.y) < 12 && Math.hypot(bx - touchAt.x, by - touchAt.y) < 12) continue;
    const p0 = posOf(o, a.t), p = posOf(o, b.t);
    const rReal = o.r / scene.HALF_H * scene.h / 2 * scene.persp(o.g.position.z);
    if (Sim.sweptDist(ax, ay, bx, by, p0.x, p0.y, p.x, p.y) > Sim.hitRadius(o.kind, rReal)) continue;
    // přesný řez: přímka tahu (z bodu stopy aspoň 22 px zpět, jinak z poslední úsečky) projde ve vnitřní čtvrtině poloměru
    let sx = ax, sy = ay;
    for (let i = trail.length - 1; i >= 0; i--) if (now - trail[i].t < 160 && Math.hypot(bx - trail[i].x, by - trail[i].y) >= 22) { sx = trail[i].x; sy = trail[i].y; break; }
    const lx = bx - sx, ly = by - sy, ll = Math.hypot(lx, ly) || 1;
    const dLine = Math.abs((p.x - sx) * ly - (p.y - sy) * lx) / ll;
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
    return;
  }
  if (o.it && o.it.hp && o.hp > 1) {
    // obří meloun: každý řez ho zmenší a vystříkne šťávu, teprve poslední ho rozpůlí
    o.hp--; o.immune = now + 170; scene.hurt(o); game.cuts++;
    addScore(Sim.POINTS.fruit); addCharge(Sim.CHARGE.obri); addStain(p.x, p.y, o.kind);
    sound.squish(0.6); buzz(15);
    window.__ovs.log.push({ ev: "giant", hp: o.hp, at: Date.now() });
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
  cutFlash(p, dx, -dy, o);
  const inStroke = game.stroke ? game.stroke.n : 0;
  sound.squish((o.kind === "meloun" ? 0.7 : 0.9 + Math.random() * 0.25) * (1 + 0.09 * Math.min(inStroke, 6)));
  game.cuts++;
  game.lastPos = { x: p.x, y: p.y };
  addStain(p.x, p.y, o.kind);
  const frozenHit = !!o.frozen2;
  const giant = !!(o.it && o.it.hp), gold = o.kind === "zlate", fin = !!(o.it && o.it.fin);
  const pts = o.kind === "karambola" ? Sim.POINTS.karambola : gold ? Sim.POINTS.zlate : giant ? Sim.POINTS.fruit + Sim.POINTS.zlate : frozenHit ? Sim.POINTS.frozen : fin ? Sim.POINTS.finale : Sim.POINTS.fruit;
  addScore(pts);
  addCharge(o.kind === "karambola" ? Sim.CHARGE.karambola : gold ? Sim.CHARGE.zlate : giant ? Sim.CHARGE.obri : Sim.CHARGE.cut);
  if (gold || giant) { scene.ring(o.g.position.x, o.g.position.y, gold ? "#FFE08A" : "#F0505A", 14); scene.burst(o.g.position.x, o.g.position.y, JUICE[o.kind] || "#FFF1B8", giant ? 22 : 12, 13, 0.5, 0.7); }
  if (fin) game.finCuts = (game.finCuts || 0) + 1;
  if (o.kind === "karambola") {
    const sent = sendSabotage("bomba", p.x, p.y);
    float(p.x, p.y, `+${pts}`);
    window.__ovs.log.push({ ev: "kara", sent, at: Date.now() });
  } else if (pts > 1) float(p.x, p.y, `+${pts}`);
  if (precise) {
    game.precise++;
    scene.ring(o.g.position.x, o.g.position.y, "#FFE08A", 10, 6.5);   // malý zlatý prstenec kolem kusu, ať nepřebije šťávu
    if (!reduced) scene.burst(o.g.position.x, o.g.position.y, JUICE[o.kind] || "#FFF1B8", 8, 13, 0.4, 0.6);
    sound.precise(); buzz(18);
    if (frozenHit) {
      // protiútok za dovednost: přesně rozseknutý led se vrací odesílateli jako mráz
      const sent = sendSabotage("mraz", p.x, p.y, true);
      window.__ovs.log.push({ ev: "reflect", sent, at: Date.now() });
    } else {
      addScore(Sim.POINTS.precise); addCharge(Sim.CHARGE.precise - Sim.CHARGE.cut);
      float(p.x, p.y - 64, `+${Sim.POINTS.precise}`, "precise");   // bez slov: zlaté číslo, prstenec a cinknutí
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
    float(s.x, s.y - 78, `+${bonus}`, "combo");   // bez slov: větší číslo, stoupající akord a odlet žetonu naschválu
    sound.combo(s.n); buzz(25);
    window.__ovs.log.push({ ev: "combo", n: s.n, sent: sent ? type : null, at: Date.now() });
  }
}
function ptr(e) { return { x: e.clientX, y: e.clientY, t: ptrTime(e) }; }
blade.addEventListener("pointerdown", e => {
  pointerDown = true; lastPt = ptr(e); trail = [lastPt]; touchAt = lastPt;
  try { blade.setPointerCapture(e.pointerId); } catch {}
});
blade.addEventListener("pointermove", e => {
  if (!pointerDown) return;
  const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
  for (const ce of (evs.length ? evs : [e])) {
    const p = ptr(ce);
    if (lastPt) {
      cutTest(lastPt, p);
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

// záblesk řezu: tenká světlá čára přes rozseknutý kus ve směru švihu, ~110 ms
const flashes = [];
function cutFlash(p, dx, dy, o) {
  const d = Math.hypot(dx, dy) || 1, r = o.r / scene.HALF_H * scene.h / 2 * scene.persp(o.g.position.z) * 1.5;
  flashes.push({ x: p.x, y: p.y, ux: dx / d * r, uy: dy / d * r, t: performance.now() });
  if (flashes.length > 8) flashes.shift();
}
function drawFlashes(now) {
  for (let i = flashes.length - 1; i >= 0; i--) {
    const f = flashes[i], k = (now - f.t) / 110;
    if (k >= 1) { flashes.splice(i, 1); continue; }
    bctx.globalAlpha = 0.9 * (1 - k); bctx.strokeStyle = "#FFFDF4"; bctx.lineWidth = 4 * (1 - k) + 1; bctx.lineCap = "round";
    bctx.beginPath(); bctx.moveTo(f.x - f.ux, f.y - f.uy); bctx.lineTo(f.x + f.ux, f.y + f.uy); bctx.stroke();
  }
  bctx.globalAlpha = 1;
}

// čepel podle výher v sérii (Sim.BLADES): 0 klasická, 1 jiskry, 2 dvojitá, 3 zlatá a delší, 4+ duha s hvězdou na špičce. Jen vzhled, zásahy se nemění.
const BLADE_LIFE = [120, 120, 120, 160, 170];
function drawBlade(now) {
  const tier = game.blade | 0;
  trail = trail.filter(p => now - p.t < BLADE_LIFE[tier]);
  bctx.clearRect(0, 0, scene.w, scene.h);
  if (flashes.length) drawFlashes(now);
  if (trail.length < 2) return;
  const me = room && room.seat ? COLORS[room.seat] : COLORS.x;
  const halo = tier === 3 ? "#FFC93C" : me, core = tier === 3 ? "#FFF4C2" : "#FFFCF2", n = trail.length;
  bctx.lineCap = "round"; bctx.lineJoin = "round";
  let ox = 0, oy = 0;
  if (tier === 2) { const a = trail[0], b = trail[n - 1], d = Math.hypot(b.x - a.x, b.y - a.y) || 1; ox = -(b.y - a.y) / d; oy = (b.x - a.x) / d; }
  for (const [color, wMul] of [[halo, 1.9], [core, 1]]) {
    bctx.strokeStyle = color;
    for (let i = 1; i < n; i++) {
      const a = trail[i - 1], b = trail[i], k = i / n;
      if (tier === 4 && color === halo) bctx.strokeStyle = `hsl(${(i * 22 + now * 0.25) % 360} 95% 62%)`;
      bctx.globalAlpha = color === halo ? 0.45 * k : 0.95 * k;
      bctx.lineWidth = (1.5 + 7 * k) * wMul * (tier === 2 ? 0.55 : 1);
      for (const side of tier === 2 ? [-1, 1] : [0]) {
        const sx = ox * side * (3 + 5 * k), sy = oy * side * (3 + 5 * k);
        bctx.beginPath(); bctx.moveTo(a.x + sx, a.y + sy); bctx.lineTo(b.x + sx, b.y + sy); bctx.stroke();
      }
    }
  }
  if (tier === 1 || tier === 4) {
    bctx.fillStyle = tier === 4 ? "#FFF4C2" : me;
    for (let i = 0; i < n; i += 2) {
      const p = trail[i], k = i / n, h = Math.sin(i * 12.9898 + p.t * 0.05);
      bctx.globalAlpha = 0.85 * k; bctx.beginPath(); bctx.arc(p.x + h * 9, p.y + Math.cos(i * 7.3) * 9, 1.3 + 2.6 * k, 0, 6.283); bctx.fill();
    }
  }
  if (tier === 4) {   // hvězda na špičce
    const p = trail[n - 1]; bctx.globalAlpha = 0.95; bctx.fillStyle = "#FFF4C2"; bctx.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 4 : 10; bctx.lineTo(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r); }
    bctx.closePath(); bctx.fill();
  }
  bctx.globalAlpha = 1;
}

// ---------- hlavní smyčka ----------
let lastT = performance.now(), idleNext = 0, qualityT = 0, feelT = 0;
const idleRng = Sim.rng(Date.now() & 0xffff);
function spawnItem(it, t0) {
  const o = scene.spawn(it.kind, { frozen: !!it.frozen, band: it.band || "#E23B3B", big: it.big || 1, z: it.kind === "bomba" ? 1.5 : ((((it.id || 0) * 7) % 5) - 2) * 0.5 });   // bomba vždy vpředu, ovoce ve čtyřech hloubkách
  o.it = it; o.t0 = t0; o.hp = it.hp || 0;
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
    if (o.pin) { scene.place(o, o.pin.x, o.pin.y, 0); continue; }   // jen pro testy (tests/kolize.cjs)
    o.vx = o.it.vu * hw; o.vy = Sim.vy0(o.it.apex, o.it.gm) - Sim.G * (o.it.gm || 1) * dt;
    if (p.y < Sim.Y0 - 2 && o.vy < 0) {
      // propadlý kus ovoce (ne bomba, ne karambola, ne obří meloun, ten je bonus) ve třech životech: × u spodního okraje tam, kde zmizel
      if (game.md === "zivoty" && phase === "play" && Sim.FRUITS.includes(o.kind) && !o.it.hp) loseLife(Math.max(30, Math.min(innerWidth - 30, scene.toScreen(o.g.position.x, 0).x)), innerHeight - 96);
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
    if (now >= game.start) { phase = "play"; setNet(""); hideModBig(); }
  }
  if (phase === "play") {
    const clock = now - game.start;
    while (game.next < game.sched.length && game.sched[game.next].t <= clock) {
      const it = game.sched[game.next++];
      if (!it.spawned) { it.spawned = true; spawnItem(it, it.t); }
    }
    moveAll(clock);
    if (game.stroke && now - game.stroke.last > 380) endStroke();
    if (game.queue.length && now - game.lastApplied > 2600 && !game.fin0 && clock + 800 < game.finAt) applySabotage(game.queue.shift());
    tryFire(now);
    if (!game.fin0 && clock >= game.finAt) startFinale(clock);
    updateTension();
    if (room.solo && soloBot) soloTick(clock);
    updateBoost();
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
    if (now > idleNext && game.live.length < 3 && !document.hidden && !window.__ovs.pause) {
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
  chargeLog: [],
  sig: () => game.sig,
  pause: false,
  // jen pro tests/kolize.cjs: připne kus na obrazovkové souřadnice (z = hloubka) a vrátí jeho poloměr v px
  pin(kind, sx, sy, z = 0) {
    const f = scene.persp(z), o = scene.spawn(kind, { z });
    o.it = { kind, u: 0, vu: 0, apex: 0, gm: 1, spin: [0, 0, 1, 0] }; o.t0 = 0; o.spinAxis.set(0, 0, 1);
    const wx = (sx / scene.w * 2 - 1) * scene.halfW / f, wy = (1 - sy / scene.h * 2) * scene.HALF_H / f;
    o.pin = { x: wx / scene.fieldHalf, y: wy };
    game.live.push(o); scene.place(o, o.pin.x, o.pin.y, 0);
    return { r: o.r / scene.HALF_H * scene.h / 2 * f };
  },
  clearLive() { for (const o of game.live) scene.remove(o); game.live = []; },
  board: id => paintBoard(id),   // jen pro screenshoty desek
  state: () => ({ phase, view, K, mod: game.mod, theme: curTheme, blade: game.blade, boost: game.boost, fin0: game.fin0, finAt: game.finAt, scoreFin: game.scoreFin, finCuts: game.finCuts || 0, clock: phase === "play" ? Math.round(performance.now() - game.start) : null, score: game.score, md: game.md, lives: game.lives, fin: game.fin, oppF: game.oppF, why: game.endWhy, gmd: room && room.meta.g.md, opp: room && room.opp ? room.opp.sc : null, solo: !!(room && room.solo), bot: soloBot ? { score: soloBot.st.score, lives: soloBot.st.lives, sent: soloBot.st.sent, got: soloBot.st.got, fin: soloBot.st.fin } : null, seat: room && room.seat, go: room && room.meta.g.go, rl: room && room.meta.g.rl, sent: game.sent, got: game.got, precise: game.precise, charge: game.charge, bombs: game.bombs, cuts: game.cuts, queue: game.queue.length, live: game.live.length }),
  targets: () => game.live.filter(o => !o.dead).map(o => ({ kind: o.kind, ice: !!o.ice, hp: o.hp || 0, ...scene.toScreen(o.g.position.x, o.g.position.y, o.g.position.z), r: o.r / scene.HALF_H * scene.h / 2 * scene.persp(o.g.position.z) })),
  fps: fpsStats,
  float,
  drawCalls: () => scene.renderer.info.render.calls,
};

addEventListener("hashchange", () => { stopPoll(); room = null; herna = parseHerna(); openFromHash(); });
openFromHash();
if (herna) { doHerny({ typ: "pripraveno" }); hernaTick(); }
