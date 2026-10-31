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

// ---------- 3D a plátno čepele ----------
const scene = createScene($("gl"), { reduced });
const blade = $("blade"), bctx = blade.getContext("2d");
const deskMQ = matchMedia("(min-width: 960px) and (min-height: 560px)");
function resize() {
  const w = innerWidth, h = innerHeight, pr = Math.min(devicePixelRatio || 1, 2);
  document.documentElement.style.setProperty("--app-h", h + "px");   // iOS: dvh bývá o lištu vedle
  scene.resize(w, h);
  blade.width = Math.round(w * pr); blade.height = Math.round(h * pr);
  bctx.setTransform(pr, 0, 0, pr, 0, 0);
}
addEventListener("resize", resize);
addEventListener("orientationchange", () => setTimeout(resize, 120));
if (window.visualViewport) visualViewport.addEventListener("resize", resize);
resize();

// žárovky na šňůře, markýza a bedny: kreslí se v pixelech, aby se na širokém displeji nedeformovaly
function paintStage() {
  const w = innerWidth, desk = deskMQ.matches, sag = Math.min(46, w * 0.09);
  const wire = x => 8 + sag * Math.sin(Math.PI * x / w * 2) * (x < w / 2 ? 1 : 0.35);
  let s = `<path d="M0 ${wire(0)} ${Array.from({ length: 41 }, (_, i) => `L${i / 40 * w} ${wire(i / 40 * w)}`).join(" ")}" fill="none" stroke="#151515" stroke-width="1.6"/>`;
  const n = Math.max(6, Math.round(w / (desk ? 46 : 34)));
  for (let i = 0; i < n; i++) {
    const x = (i + 0.5) / n * w, y = wire(x) + 5;
    s += `<circle class="bulb-glow" style="animation-delay:${(i * 0.37) % 2}s" cx="${x}" cy="${y}" r="8" fill="#FFD27A" opacity=".28"/><circle cx="${x}" cy="${y}" r="3.4" fill="#FFE7A8"/>`;
  }
  const bl = $("bulbs"); bl.setAttribute("viewBox", `0 0 ${w} 60`); bl.innerHTML = s;
  // markýza: pruhy pevné šířky (nejsou natažené), u okraje celý pruh nakonec
  const sw = desk ? 64 : 36, nS = Math.ceil(w / sw), offS = (w - nS * sw) / 2;
  let a = "";
  for (let i = 0; i < nS; i++) {
    const x = offS + i * sw;
    a += `<path d="M${x} 0H${x + sw}V58Q${x + sw / 2} 80 ${x} 58Z" fill="${i % 2 ? "#F1E6D0" : "#C8372D"}"/>`;
  }
  a += `<path d="M0 52H${w}" stroke="#000" stroke-opacity=".18" stroke-width="3"/>`;
  const aw = $("awning"); aw.setAttribute("viewBox", `0 0 ${w} 80`); aw.innerHTML = a;
  // bedny: viewBox je v jednotkách původních 112 px, takže se celé měřítko drží i na desktopu (150 px)
  const k = desk ? 150 / 112 : 1, vw = w / k;
  const labels = [["ŠVESTKY", "1. JAKOST · VALAŠSKO"], ["OVOCE", "Z TRHU NA NŮŽ"], ["MELOUNY", "KUS · NEVÁŽÍ SE"], ["HRUŠKY", "ZE ZAHRADY"], ["CITRONY", "KYSELÉ JAK ŘEMEN"], ["KIWI", "CHLUPATÉ"]];
  const cw = 130, cols = Math.ceil(vw / cw) + 1, off = (vw - cols * cw) / 2;
  let c = `<rect x="0" y="22" width="${vw}" height="90" fill="#5E3A20"/>`;
  for (let i = 0; i < cols; i++) {
    const x = off + i * cw + 4, y = i % 2 ? 26 : 30, [l1, l2] = labels[i % labels.length], f = i % 2 ? "#A86B3B" : "#9A6236";
    c += `<rect x="${x}" y="${y}" width="${cw - 8}" height="${112 - y}" fill="${f}"/><rect x="${x}" y="${y}" width="${cw - 8}" height="8" fill="#B87B48"/><rect x="${x}" y="64" width="${cw - 8}" height="3" fill="#7A4A26"/>
      <g font-family="Bungee, sans-serif" fill="#2E1B0D" opacity=".75" text-anchor="middle"><text x="${x + cw / 2 - 4}" y="${y + 28}" font-size="13">${l1}</text><text x="${x + cw / 2 - 4}" y="90" font-size="9">${l2}</text></g>`;
  }
  c += `<rect x="0" y="16" width="${vw}" height="9" fill="#B87B48"/><rect x="0" y="23" width="${vw}" height="3" fill="#3E2614"/>`;
  const cr = $("crates"); cr.setAttribute("viewBox", `0 0 ${vw} 112`); cr.setAttribute("preserveAspectRatio", "none"); cr.innerHTML = c;
}
addEventListener("resize", paintStage);
paintStage();

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
    beep(hi) { if (!ok()) return; tone(hi ? 880 : 587, hi ? 0.32 : 0.14, 0.14, "square"); },
    incoming() { if (!ok()) return; tone(392, 0.09, 0.12, "triangle"); tone(311, 0.16, 0.12, "triangle", 0.1); },
    send() { if (!ok()) return; tone(660, 0.12, 0.08, "sine", 0, 1320); },
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
function float(x, y, html, cls = "") {
  const el = document.createElement("div");
  el.className = "float " + cls; el.innerHTML = html;
  el.style.left = x + "px"; el.style.top = y + "px";
  $("floats").appendChild(el);
  setTimeout(() => el.remove(), 1200);
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
function showView(name, html) {
  const same = view === name;
  view = name;
  panel.hidden = !html;
  panel.innerHTML = html ? `<section class="tag${same ? " still" : ""}" data-view="${name}">${html}</section>` : "";
  panel.scrollTop = 0;
  const first = panel.querySelector("[autofocus]");
  if (first && matchMedia("(pointer: fine)").matches) first.focus();
}
const howTo = (ms, id = "") => `<p class="how"${id ? ` id="${id}"` : ""}>Táhni prstem nebo myší přes ovoce, <b>bomby nesekej</b>. Tři a víc kusů jedním tahem nebo <b>karambola</b> (hvězda) pošle soupeři naschvál: šmouhu, mráz nebo bombu navíc. Hraje se jedno kolo na ${lenAcc(ms)}, vyhrává vyšší skóre.</p>`;

function viewSetup() {
  phase = "menu"; $("hud").hidden = true;
  const last = Net.store.get("ovs-name") || "";
  showView("setup", `
    <h1>Ovocný souboj</h1>
    <p>Sekáte naráz, každý na svém displeji, stejné ovoce ve stejném pořadí. Kdo má na konci kola víc bodů, bere souboj.</p>
    <label for="fMe">Tvoje jméno</label><input id="fMe" type="text" maxlength="18" autocomplete="given-name" value="${esc(last)}" placeholder="třeba Mark" autofocus>
    <label for="fOpp">Koho vyzýváš</label><input id="fOpp" type="text" maxlength="18" placeholder="třeba Radka">
    <span class="lab" id="lenLab">Jak dlouhé kolo</span>
    <div class="chips" id="lenChips" role="group" aria-labelledby="lenLab">${Sim.ROUND_OPTIONS.map(ms => `<button type="button" data-ms="${ms}" aria-pressed="${ms === Sim.ROUND_MS}">${ms / 60000} ${ms === 60000 ? "minuta" : "minuty"}</button>`).join("")}</div>
    <span class="lab" id="stakeLab">O co hrajeme <span class="small">(nepovinné)</span></span>
    <div class="chips" id="chips" role="group" aria-labelledby="stakeLab">${STAKES.map(s => `<button type="button" aria-pressed="false">${s}</button>`).join("")}</div>
    <input id="fStake" type="text" maxlength="40" placeholder="nebo napiš vlastní sázku" style="margin-top:8px">
    <button class="btn" id="bCreate">Připravit výzvu</button>
    ${howTo(Sim.ROUND_MS, "setupHow")}`);
  const chips = $("chips"), stake = $("fStake"), lens = $("lenChips");
  const pickedMs = () => +lens.querySelector("[aria-pressed=true]").dataset.ms;
  lens.addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    lens.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
    $("setupHow").outerHTML = howTo(+b.dataset.ms, "setupHow");
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
    Net.store.set("ovs-name", a);
    $("bCreate").disabled = true; $("bCreate").textContent = "Chystám stánek…";
    try { await createRoom(a, b || "", stake.value.trim().slice(0, 40), pickedMs()); }
    catch { $("bCreate").disabled = false; $("bCreate").textContent = "Připravit výzvu"; toast("Spojení nevyšlo, zkus to znovu."); }
  });
}

const linkFor = () => BASE + "#r." + room.id;
function message() {
  const g = room.meta.g;
  return `${g.a} tě vyzývá na Ovocný souboj 🍉 Sekáme ovoce naráz, každý na svém mobilu, jedno kolo na ${lenAcc(g.rl)}.${g.st ? " Hrajeme o: " + g.st + "." : ""} Přijmi tady: ${linkFor()}`;
}
function viewShare() {
  phase = "menu"; $("hud").hidden = true;
  const g = room.meta.g;
  showView("share", `
    <h2>Výzva visí na stánku. Pošli ji${g.b ? " " + esc(g.b) : ""}.</h2>
    <p>Odkaz posíláš jen jednou, na něm pak hrajete všechna kola i odvety.</p>
    <textarea class="msg" id="msg" readonly>${esc(message())}</textarea>
    <div class="row">
      <button class="btn" id="bShare"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V3M7 8l5-5 5 5"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>Poslat</button>
      <button class="btn" id="bCopy"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></svg>Kopírovat</button>
    </div>
    <button class="btn alt" id="bLobby">Jít ke stánku a počkat</button>`);
  if (!navigator.share) $("bShare").remove();
  $("bShare")?.addEventListener("click", async () => { try { await navigator.share({ text: message() }); } catch {} });
  $("bCopy").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(message()); toast("Zkopírováno, vlož to do chatu."); }
    catch { $("msg").select(); toast("Označeno, zkopíruj to ručně."); }
  });
  $("bLobby").addEventListener("click", () => { decide(true); });
}
function viewIntro() {
  phase = "menu"; $("hud").hidden = true;
  const g = room.meta.g;
  showView("intro", `
    <h1>${esc(g.a)} tě vyzývá</h1>
    <p class="chalk">na Ovocný souboj: ${lenNom(g.rl)} sekání, stejné ovoce pro oba, vyhrává vyšší skóre.</p>
    ${g.st ? `<div class="stake">Hrajeme o: ${esc(g.st)}</div>` : ""}
    <label for="fName">Tvoje jméno</label><input id="fName" type="text" maxlength="18" value="${esc(g.b || Net.store.get("ovs-name") || "")}" placeholder="jak ti říkat" autofocus>
    <button class="btn" id="bAccept">Přijmout výzvu</button>
    ${howTo(g.rl)}`);
  $("bAccept").addEventListener("click", accept);
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
  // ?kolo=N (sekundy, 10–120) je testovací přepis a má přednost před volbou na setup obrazovce
  const rl = params.get("kolo") ? Math.max(10, Math.min(120, +params.get("kolo") || 120)) * 1000 : (Sim.ROUND_OPTIONS.includes(picked) ? picked : Sim.ROUND_MS);
  const meta = { app: "ovocny-souboj", v: 1, sx: Net.device, so: "", g: { a, b, st, rl, go: 0, sd: 0 } };
  await Net.save(Net.metaUrl(id), meta);
  await Net.save(Net.seatUrl(id, "x"), seatDoc());
  Net.store.set(seatKey(id), "x");
  history.replaceState(null, "", location.pathname + location.search + "#r." + id);
  await enterRoom(id, meta);
  viewShare();
}
const seatDoc = () => ({ k: 0, rdy: 0, sc: 0, ev: [], h: {}, t: Date.now() });

async function openFromHash() {
  const m = /^#r\.([0-9a-z]{6,16})$/.exec(location.hash || "");
  if (!m) { viewSetup(); return; }
  if (view !== "error") showView("loading", `<h2>Otevírám stánek…</h2>`);
  let meta;
  try { meta = await Net.load(Net.metaUrl(m[1])); }
  catch { viewError("Spojení nevyšlo.", "Nedaří se dovolat ke stánku. Zkontroluj signál, zkouším to sám znovu.", true); clearTimeout(openFromHash.t); openFromHash.t = setTimeout(openFromHash, 4000); return; }
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
  if (go && d.k === go && !(go in d.h)) room.w.set({ h: { ...d.h, [go]: d.sc } }, true);
}
async function accept() {
  const name = clampName($("fName").value);
  if (!name) { $("fName").focus(); toast("Napiš svoje jméno, ať víš, komu fandit."); return; }
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
  if (go && d.k !== go && !(go in d.h)) { beginCountdown(go, g.sd, g.rl, room.seat === "x" ? 120 : 0); return; }
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
    const r = await Net.commitMeta(room.id, m => m && (m.g.go || 0) < k ? { ...m, g: { ...m.g, go: k, sd } } : null);
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
  if (!room.meta.so) s = "ještě nepřijal(a)";
  else if (o && o.rdy > go) s = "připraveno";
  else if (phase === "wait" && o && o.k === K && !(K in (o.h || {}))) s = "ještě seká";
  $("stateOpp").textContent = s;
  $("stateMe").textContent = d && d.rdy > go ? "připraveno" : "";
}
// hodiny v HUD: číslo souboje a série přes odvety (já : soupeř); před první odvetou jen „jedno kolo“
function hudSeries(hx, ho, m) {
  const st = Sim.matchState(hx, ho, m), ser = Sim.series(hx, ho);
  const mine = room.seat === "x" ? ser : [ser[1], ser[0]];
  $("roundLabel").textContent = `Souboj č. ${m}`;
  $("ser").innerHTML = m > 1 || mine[0] + mine[1] > 0 ? `série <b class="m">${mine[0]}</b> : <b class="o">${mine[1]}</b>` : `jedno kolo`;
  return st;
}
function hists() {
  const d = mine(), o = room.opp || seatDoc();
  return room.seat === "x" ? [d.h || {}, o.h || {}] : [o.h || {}, d.h || {}];
}

function viewLobby() {
  phase = "lobby"; $("hud").hidden = false; hudNames();
  const g = room.meta.g, d = mine(), next = 11;
  K = 0; $("timer").textContent = fmtClock(Math.round(g.rl / 1000)); $("timer").classList.remove("low");
  cells($("cellsMe"), 0); cells($("cellsOpp"), 0); { const [hx, ho] = hists(); hudSeries(hx, ho, Sim.mOf(next)); } hudOppState();
  const joined = !!room.meta.so, rdy = d.rdy >= next;
  const sig = `lobby|${joined}|${rdy}`;
  if (view === "lobby" && panel.dataset.sig === sig) return;
  showView("lobby", `
    <h2>${joined ? "Stánek je otevřený" : `Čekám, až ${esc(oppName())} přijme výzvu`}</h2>
    ${g.st ? `<div class="stake">Hrajeme o: ${esc(g.st)}</div>` : ""}
    <p style="margin-top:12px">${joined ? (rdy ? `Jakmile bude ${esc(oppName())} taky připraven(a), naskočí odpočet.` : "Až klepneš, počkáme na soupeře a pak odpočet 3, 2, 1.") : "Odkaz už máš poslaný? Hra se rozjede sama, jakmile výzvu přijme."}</p>
    ${joined ? `<button class="btn" id="bReady" ${rdy ? "disabled" : ""}>${rdy ? "Čekám na soupeře…" : "Jdu do toho"}</button>` : `<button class="btn alt" id="bBack">Znovu poslat odkaz</button>`}
    ${howTo(g.rl)}`);
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
  if (!stalled) showView("waiting", `<h2>Hotovo! Čekám na ${n}…</h2><p>Soupeř ještě dosekává. Výsledek naskočí sám.</p>`);
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
  const r = st.rounds[0] || { x: hx[go], o: ho[go], w: null };
  cells($("cellsMe"), me === "x" ? r.x : r.o); cells($("cellsOpp"), me === "x" ? r.o : r.x);
  $("timer").textContent = "0:00"; $("timer").classList.remove("low");
  const nextK = st.nextK, rdy = d.rdy >= nextK, g = room.meta.g;
  $("stateMe").textContent = rdy ? "připraveno" : "";
  $("stateOpp").textContent = room.opp && room.opp.rdy >= nextK ? "připraveno" : "";
  const sig = `${go}|${rdy}|${room.opp && room.opp.rdy}`;
  if (view === "result" && panel.dataset.sig === sig) return;
  const wName = w => esc(nameOfSeat(w));
  const hi = Math.max(r.x, r.o), lo = Math.min(r.x, r.o);
  const ser = Sim.series(hx, ho);
  const head = st.winner ? `Souboj bere ${wName(st.winner)} ${hi} : ${lo}` : `Souboj končí remízou ${hi} : ${lo}`;
  const side = (seat, name, score) => `<div class="p ${seat}${st.winner === seat ? " win" : ""}"><div class="n">${esc(name)}</div><div class="s">${score}</div><div class="st">${st.winner ? (st.winner === seat ? "bere souboj" : "chce odvetu") : "remíza"}</div></div>`;
  let extra = "";
  if (g.st) extra = `<div class="stake">${st.winner ? `${wName(other(st.winner))} platí: ${esc(g.st)}` : `Sázka (${esc(g.st)}) zůstává ve hře`}</div>`;
  extra += `<p class="small" style="margin-top:10px">Série soubojů: ${esc(g.a)} ${ser[0]} : ${ser[1]} ${esc(g.b)}</p>`;
  const oppRdy = room.opp && room.opp.rdy >= nextK;
  showView("result", `
    <h2>${head}</h2>
    <div class="vs">${side("x", g.a, r.x)}<div class="mid">:</div>${side("o", g.b, r.o)}</div>
    ${extra}
    <button class="btn" id="bNext" ${rdy ? "disabled" : ""}>${rdy ? "Čekám na soupeře…" : "Odveta"}</button>
    <p class="small" style="margin:8px 0 0;text-align:center">${oppRdy ? `${esc(oppName())} už čeká na tebe.` : rdy ? "Odpočet naskočí, až klepne i soupeř. Nechce se mu? Pošli odkaz a vraťte se později." : ""}</p>
    <button class="btn alt" id="bShareRes">Poslat výsledek do chatu</button>`);
  panel.dataset.sig = sig;
  $("bNext").addEventListener("click", () => ready(nextK));
  $("bShareRes").addEventListener("click", async () => {
    const t = `${head}${g.st && st.winner ? ` (${nameOfSeat(other(st.winner))} platí: ${g.st})` : ""}. Série ${g.a} ${ser[0]} : ${ser[1]} ${g.b}. Odveta? ${linkFor()}`;
    try { if (navigator.share) await navigator.share({ text: t }); else { await navigator.clipboard.writeText(t); toast("Zkopírováno."); } } catch {}
  });
}

// ---------- kolo ----------
function beginCountdown(k, seed, rl, delay) {
  if (phase === "count" || phase === "play") return;
  K = k; phase = "count";
  game.rl = rl || Sim.ROUND_MS;
  game.sched = Sim.schedule(seed, game.rl).map(it => ({ ...it }));
  game.next = 0; game.score = 0; game.ev = []; game.queue = []; game.lastSend = -1e9; game.lastApplied = -1e9;
  game.stroke = null; game.cuts = 0; game.bombs = 0; game.sent = 0; game.got = 0; game.doneAt = 0; game.waitHold = 0;
  for (const o of game.live) scene.remove(o); game.live = [];
  scene.clear();
  room.seenK = k; room.seenEv = (room.opp && room.opp.k === k) ? (room.opp.ev || []).length : 0;
  room.w.set({ k, sc: 0, ev: [] }, true);
  showView(null);
  $("hud").hidden = false; hudNames();
  $("stateMe").textContent = ""; $("stateOpp").textContent = "";
  cells($("cellsMe"), 0); cells($("cellsOpp"), 0);
  const [hx, ho] = hists(); hudSeries(hx, ho, Sim.mOf(k));
  $("timer").textContent = fmtClock(Math.round(game.rl / 1000)); $("timer").classList.remove("low");
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
  room.w.set({ sc: game.score, h: { ...d.h, [K]: game.score } }, true);
  sound.end(); buzz([70, 50, 140]);
  game.doneAt = Date.now();
  for (const o of game.live) scene.remove(o); game.live = [];
  $("count").innerHTML = `<span class="go">Konec!</span>`;
  setTimeout(() => { if (phase !== "count") $("count").innerHTML = ""; }, 900);
  window.__ovs.log.push({ ev: "end", k: K, score: game.score, stats: fpsStats() });
  decide(false);
  startPoll();
}
function addScore(n) {
  game.score = Math.max(0, game.score + n);
  cells($("cellsMe"), game.score);
  room.w.set({ sc: game.score });
}
function sendSabotage(type, x, y) {
  const now = performance.now();
  if (now - game.lastSend < 2500) return false;
  game.lastSend = now; game.sent++;
  game.ev = [...game.ev, [game.ev.length, type, Math.round(now - game.start)]];
  window.__ovs.log.push({ ev: "send", type, at: Date.now() });
  room.w.set({ ev: game.ev }, true);
  sound.send();
  shot(x, y);
  return true;
}
function applySabotage(type) {
  const now = performance.now(), clock = now - game.start;
  game.lastApplied = now; game.got++;
  const who = oppName(), c = COLORS[other(room.seat)];
  const texts = { bomba: "posílá <b>bombu navíc</b>", smouha: "posílá <b>šťávu do očí</b>", mraz: "posílá <b>mráz</b> na dva kusy" };
  $("bannerIcon").innerHTML = ICONS[type](c);
  $("bannerTxt").innerHTML = `${esc(who)} ${texts[type]}`;
  $("banner").classList.add("on");
  clearTimeout(applySabotage.t); applySabotage.t = setTimeout(() => $("banner").classList.remove("on"), 2300);
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
    hit(o, p, dx, -dy, now, speed);
  }
}
function hit(o, p, dx, dy, now, speed) {
  if (phase !== "play") {                       // v menu jen pro radost, bez bodů
    if (o.kind === "bomba") { o.dead = true; scene.explode(o); }
    else { o.dead = true; scene.slice(o, dx, dy); sound.squish(0.9 + Math.random() * 0.3); }
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
    addScore(Sim.POINTS.bomba);
    float(p.x, p.y, `${Sim.POINTS.bomba}${o.it.from ? `<small>bomba od ${esc(o.it.from)}</small>` : ""}`, "bad");
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
  const pts = o.kind === "karambola" ? Sim.POINTS.karambola : o.frozen2 ? Sim.POINTS.frozen : Sim.POINTS.fruit;
  addScore(pts);
  if (o.kind === "karambola") {
    const sent = sendSabotage("bomba", p.x, p.y);
    float(p.x, p.y, `+${pts}<small>${sent ? `bomba letí k ${esc(oppName())}` : "karambola"}</small>`);
  } else if (pts > 1) float(p.x, p.y, `+${pts}`);
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
    float(s.x, s.y - 40, `Combo ${s.n}! +${bonus}<small>${sent ? (type === "mraz" ? "mráz" : "šmouha") + ` letí k ${esc(oppName())}` : "naschvál se ještě nabíjí"}</small>`);
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
let lastT = performance.now(), idleNext = 0, qualityT = 0;
const idleRng = Sim.rng(Date.now() & 0xffff);
function spawnItem(it, t0) {
  const o = scene.spawn(it.kind, { frozen: !!it.frozen, band: it.band || "#E23B3B" });
  o.it = it; o.t0 = t0;
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
    if (p.y < Sim.Y0 - 2 && o.vy < 0) { scene.remove(o); game.live = game.live.filter(x => x !== o); continue; }
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
    const left = Math.max(0, Math.ceil((game.rl - clock) / 1000));
    const lt = fmtClock(left);
    if ($("timer").textContent !== lt) { $("timer").textContent = lt; $("timer").classList.toggle("low", left <= 10); }
    stats.frames++; stats.time += dt; stats.samples.push(dt);
    if (stats.samples.length > 600) stats.samples.shift();
    qualityT += dt;
    if (qualityT > 2) {
      qualityT = 0;
      const avg = stats.samples.slice(-90).reduce((a, b) => a + b, 0) / Math.min(90, stats.samples.length);
      if (avg > 0.022 && scene.pixelRatio > 1) scene.setPixelRatio(Math.max(1, scene.pixelRatio - 0.5));
    }
    if (clock >= game.rl) finishRound();
  } else if (phase !== "count") {
    // v menu a mezi koly létá pár kusů na zkoušku
    const clock = now;
    if (now > idleNext && game.live.length < 3 && !document.hidden) {
      idleNext = now + 1400 + idleRng() * 900;
      const kinds = [...Sim.FRUITS, "karambola"];
      // na desktopu visí nabídka vlevo, ovoce létá hlavně vpravo od ní
      const u = deskMQ.matches ? -0.1 + idleRng() * 0.85 : (idleRng() * 2 - 1) * 0.7;
      spawnItem({ kind: kinds[Math.floor(idleRng() * kinds.length)], u, vu: -u * 0.5, apex: 1 + idleRng() * 5, spin: [idleRng(), idleRng(), idleRng(), 2] }, clock);
    }
    moveAll(clock);
  }
  scene.step(dt);
  scene.render();
  drawBlade(now);
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
  state: () => ({ phase, view, K, score: game.score, opp: room && room.opp ? room.opp.sc : null, seat: room && room.seat, go: room && room.meta.g.go, rl: room && room.meta.g.rl, sent: game.sent, got: game.got, bombs: game.bombs, cuts: game.cuts, queue: game.queue.length, live: game.live.length }),
  targets: () => game.live.filter(o => !o.dead).map(o => ({ kind: o.kind, ice: !!o.ice, ...scene.toScreen(o.g.position.x, o.g.position.y), r: o.r / scene.HALF_H * scene.h / 2 })),
  fps: fpsStats,
  drawCalls: () => scene.renderer.info.render.calls,
};

addEventListener("hashchange", () => { stopPoll(); room = null; openFromHash(); });
openFromHash();
