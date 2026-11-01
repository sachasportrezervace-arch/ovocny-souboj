// Pocitový test: celé kolo ve 2 nezávislých prohlížečích (Chromium desktop 1440×900 + WebKit iPhone 13 na výšku) a měření tempa.
// node tests/feel.cjs [URL] [délka kola v s = 60]   (výchozí http://127.0.0.1:8803/)
// Měří: ovoce/s v 1. a 4. čtvrtině, kolik kusů je naráz vidět (průměr, max), podíl bomb, karamboly, naschvály (odesláno,
// doručeno, zpoždění, čas prvního), šmouhu (jak dlouho a zda zakrývala skóre), rozdíl skóre, přesné řezy. Screenshoty do tests/shots/.
const path = require("path");
const PW = process.env.PW || path.join(process.env.APPDATA || "", "npm/node_modules/playwright");
const { chromium, webkit, devices } = require(PW);
const BASE = (process.argv[2] || "http://127.0.0.1:8803/").replace(/\/?$/, "/");
const ROUND = +(process.argv[3] || 60);
const SH = path.join(__dirname, "shots");
require("fs").mkdirSync(SH, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0;
const check = (name, ok, extra = "") => { ok ? pass++ : fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  (" + extra + ")" : ""}`); };
const snap = (p, n) => p.screenshot({ path: path.join(SH, n + ".png") });
const st = p => p.evaluate(() => __ovs.state());
const FRUITS = ["meloun", "pomeranc", "svestka", "citron", "jablko", "kiwi"];

// bot jako nepřesný hráč: každých ~150 ms jeden tah přes viditelné ovoce, bomby obchází, míří s náhodnou odchylkou (část řezů mine střed)
async function botStep(p, vp) {
  const t = (await p.evaluate(() => __ovs.targets())).filter(o => o.y > 150 && o.y < vp.height - 60 && o.x > 10 && o.x < vp.width - 10);
  const bombs = t.filter(o => o.kind === "bomba");
  const pick = t.filter(o => o.kind !== "bomba" && bombs.every(b => Math.hypot(b.x - o.x, b.y - o.y) > b.r + 70) && (o.kind === "karambola" || Math.random() > 0.12)).sort((a, b) => a.x - b.x);
  if (!pick.length) return;
  // krátký tah: nejvýš 4 kusy v řadě (dlouhý přes celé pole desktopu nestihne dojet, než ovoce odletí); karambola má přednost
  const star = pick.find(o => o.kind === "karambola");
  if (star) pick.sort((a, b) => Math.abs(a.x - star.x) - Math.abs(b.x - star.x));
  pick.splice(4); pick.sort((a, b) => a.x - b.x);
  const pts = [];
  for (const f of pick) { const off = (Math.random() - 0.5) * f.r * 1.5; pts.push([f.x - f.r * 1.4, f.y + off - 4], [f.x + f.r * 1.4, f.y + off + 4]); if (f.ice) pts.push([f.x - f.r * 1.4, f.y + off + 8], [f.x + f.r * 1.4, f.y + off - 8]); }
  await p.mouse.move(pts[0][0], pts[0][1]); await p.mouse.down();
  for (const [x, y] of pts.slice(1)) await p.mouse.move(x, y, { steps: 3 });
  await p.mouse.up();
}

(async () => {
  const bA = await chromium.launch(), bB = await webkit.launch();
  const A = await (await bA.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  const B = await (await bB.newContext({ ...devices["iPhone 13"] })).newPage();
  const errs = [];
  // hlášky o naschvalech jsou pryč: sbíráme každý plovoucí text a hlídáme, že žádný nemluví o naschvále (naschvál se signalizuje jen ikonou a pulzem měřiče)
  for (const p of [A, B]) await p.addInitScript(() => {
    window.__txt = [];
    document.addEventListener("DOMContentLoaded", () => new MutationObserver(ms => { for (const m of ms) for (const n of m.addedNodes) if (n.nodeType === 1 && n.classList.contains("float")) window.__txt.push(n.textContent); }).observe(document.getElementById("floats"), { childList: true }));
  });
  for (const [n, p] of [["A", A], ["B", B]]) { p.on("pageerror", e => errs.push(n + ": " + e.message)); p.on("console", m => m.type() === "error" && errs.push(n + " console: " + m.text().slice(0, 160))); }
  await A.goto(BASE + "?kolo=" + ROUND);
  await A.fill("#fMe", "Mark"); await A.fill("#fOpp", "Radka"); await A.click("#bCreate");
  await A.waitForSelector("#msg", { timeout: 15000 });
  const link = (await A.innerText("#msg")).match(/https?:\/\/\S+#r\.[0-9a-z]+/)[0];
  await B.goto(link); await B.waitForSelector("#bAccept", { timeout: 15000 }); await B.click("#bAccept");
  await B.waitForSelector("#bReady", { timeout: 15000 });
  await A.locator("#bLobby").click({ timeout: 3000 }).catch(() => {});
  await A.waitForSelector("#bReady:not([disabled])", { timeout: 15000 });
  await Promise.all([A.click("#bReady"), B.click("#bReady")]);
  await Promise.all([A, B].map(p => p.waitForFunction(() => __ovs.state().phase === "play", null, { timeout: 30000 })));
  const t0 = Date.now(), vpA = A.viewportSize(), vpB = B.viewportSize();
  const shots = { zacatek: 6, pulka: ROUND / 2, konec: ROUND - 5 }, done = {};
  const sabShot = { A: false, B: false }, seen = { A: { icon: 0, pulse: 0, dur: 0, durPulse: 0 }, B: { icon: 0, pulse: 0, dur: 0, durPulse: 0 } };
  const smear = { A: { ms: 0, cover: false }, B: { ms: 0, cover: false } };
  let last = Date.now();
  const watch = async (p, k) => {
    const r = await p.evaluate(() => {
      const el = document.getElementById("smear"), on = el.classList.contains("on") && +getComputedStyle(el).opacity > 0.15;
      let cover = false;
      if (on) {
        const g = el.querySelector("svg g")?.getBoundingClientRect();
        if (g) for (const q of ["#signMe", "#signOpp", ".clock"]) { const s = document.querySelector(q).getBoundingClientRect(); if (g.left < s.right && g.right > s.left && g.top < s.bottom && g.bottom > s.top) cover = true; }
      }
      const dur = e => { const a = e.getAnimations()[0]; return a ? a.effect.getTiming().duration : 0; };
      const ic = document.getElementById("sabIcon"), ch = document.getElementById("chargeMe");
      const icon = ic.classList.contains("on") && ic.getAnimations().length > 0, pulse = ch.classList.contains("fire") && ch.getAnimations().length > 0;
      return { on, cover, icon, pulse, iconMs: icon ? dur(ic) : 0, pulseMs: pulse ? dur(ch) : 0 };
    });
    return r;
  };
  const bot = async (p, vp) => { while ((await st(p)).phase === "play") { await botStep(p, vp).catch(() => {}); await sleep(130); } };
  const bots = Promise.all([bot(A, vpA), bot(B, vpB)]);
  while ((await st(A)).phase === "play" || (await st(B)).phase === "play") {
    const el = (Date.now() - t0) / 1000, now = Date.now(), dt = now - last; last = now;
    for (const [k, v] of Object.entries(shots)) if (!done[k] && el >= v) { done[k] = 1; await Promise.all([snap(A, `feel-desktop-hra-${k}`), snap(B, `feel-iphone-hra-${k}`)]); }
    for (const [k, p] of [["A", A], ["B", B]]) {
      const r = await watch(p, k);
      if (r.on) { smear[k].ms += dt; if (r.cover) smear[k].cover = true; }
      if (r.icon) { seen[k].icon++; seen[k].dur = Math.max(seen[k].dur, r.iconMs); }
      if (r.pulse) { seen[k].pulse++; seen[k].durPulse = Math.max(seen[k].durPulse, r.pulseMs); }
      if (r.icon && !sabShot[k] && el > 3) {   // snímek v okamžiku bliknutí ikony (animaci na chvíli zastavíme na vrcholu a pak dokončíme)
        sabShot[k] = true;
        await p.evaluate(() => document.getElementById("sabIcon").getAnimations().forEach(a => { a.pause(); a.currentTime = 120; }));
        await snap(p, k === "A" ? "feel-desktop-hra-sabotaz" : "feel-iphone-hra-sabotaz");
        await p.evaluate(() => document.getElementById("sabIcon").getAnimations().forEach(a => a.finish()));
      }
    }
    await sleep(150);
  }
  await bots;
  await Promise.all([A, B].map(p => p.waitForFunction(() => __ovs.state().phase === "result", null, { timeout: 25000 })));
  await sleep(900);
  await Promise.all([snap(A, "feel-desktop-vysledek"), snap(B, "feel-iphone-vysledek")]);

  // ---- vyhodnocení ----
  const data = await Promise.all([A, B].map(p => p.evaluate(() => ({ txt: window.__txt, noBanner: !document.getElementById("banner"), feel: __ovs.feel, log: __ovs.log, st: __ovs.state(), end: __ovs.log.filter(e => e.ev === "end").pop() }))));
  const cd = data.map(d => d.log.filter(e => e.ev === "countdown").pop().at);   // čas startu kola (ms, Date.now) na každé straně
  const ms = ROUND * 1000;
  const Q = [0, 0, 0, 0], QF = [0, 0, 0, 0];
  let spawns = 0, bombsRegular = 0, bombsSab = 0, kara = 0;
  for (const d of data) for (const s of d.feel.spawns) {
    spawns++; const q = Math.min(3, Math.floor(s.t / ms * 4));
    if (s.kind === "bomba") { s.sab ? bombsSab++ : bombsRegular++; } else if (FRUITS.includes(s.kind)) { Q[q]++; QF[q]++; } else Q[q]++;
    if (s.kind === "karambola") kara++;
  }
  const qsec = ms / 4000 * 2;   // dvě strany
  const perSec = a => a.map(v => +(v / qsec).toFixed(2));
  const vis = data.flatMap(d => d.feel.vis), visAvg = vis.reduce((a, b) => a + b, 0) / vis.length, visMax = Math.max(...vis);
  const visQ = [0, 1, 2, 3].map(q => { const a = vis.filter((_, i) => Math.floor(i / vis.length * 4) === q); return +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(1); });
  const regular = spawns - bombsSab;
  const bombShare = bombsRegular / regular;
  const sends = [[0, 1], [1, 0]].map(([s, r]) => data[s].log.filter(e => e.ev === "send").map(e => ({ ...e, rel: e.at - cd[s] })));
  const lat = [], firstGot = [];
  for (const [s, r] of [[0, 1], [1, 0]]) {
    const gots = data[r].log.filter(e => e.ev === "got");
    for (const g of gots) { const x = sends[s].filter(e => e.type === g.type && e.at <= g.at).pop(); if (x) lat.push(g.at - x.at); }
    firstGot.push(gots.length ? (gots[0].at - cd[r]) / 1000 : null);
  }
  const sc = data.map(d => d.st.score), precise = data.map(d => d.st.precise), cuts = data.map(d => d.st.cuts);
  const fires = data.map(d => d.log.filter(e => e.ev === "fire").length), refl = data.map(d => d.log.filter(e => e.ev === "reflect").length);
  const karaCut = data.map(d => d.log.filter(e => e.ev === "kara").length);
  console.log(`\nKolo ${ROUND} s, dvě strany (A desktop, B iPhone)`);
  console.log(`ovoce+karambola/s po čtvrtinách: ${perSec(Q).join(" / ")}   (čisté ovoce: ${perSec(QF).join(" / ")})`);
  console.log(`naráz vidět: průměr ${visAvg.toFixed(1)}, max ${visMax}; po čtvrtinách průměr ${visQ.join(" / ")}`);
  console.log(`bomby: ${(bombShare * 100).toFixed(1)} % rozpisu (+ ${bombsSab} podstrčených), karambol rozpis ${kara / 2}/strana, rozsekáno ${karaCut.join("+")}`);
  console.log(`naschvály: odesláno ${sends[0].length}+${sends[1].length}, doručeno ${data[1].log.filter(e => e.ev === "got").length}+${data[0].log.filter(e => e.ev === "got").length}, zpoždění prům. ${lat.length ? Math.round(lat.reduce((a, b) => a + b, 0) / lat.length) : "-"} ms (max ${lat.length ? Math.max(...lat) : "-"}), první doručený po ${firstGot.map(v => v === null ? "-" : v.toFixed(1) + " s").join(" / ")}, z měřiče ${fires.join("+")}, odraženo ${refl.join("+")}`);
  console.log(`odesláno (s od startu, typ): A ${sends[0].map(e => (e.rel / 1000).toFixed(1) + e.type[0]).join(" ")} | B ${sends[1].map(e => (e.rel / 1000).toFixed(1) + e.type[0]).join(" ")}`);
  console.log(`šmouha: viditelná A ${(smear.A.ms / 1000).toFixed(1)} s, B ${(smear.B.ms / 1000).toFixed(1)} s, zakryla skóre/hodiny: A ${smear.A.cover}, B ${smear.B.cover}`);
  console.log(`skóre A ${sc[0]} : B ${sc[1]} (rozdíl ${Math.abs(sc[0] - sc[1])}), řezů ${cuts.join("/")}, přesných ${precise.join("/")}`);
  console.log(`fps A ${data[0].end?.stats?.avgFps} / B ${data[1].end?.stats?.avgFps}`);
  check("první naschvál souboje doručen do 10 s od startu (kdo ho pošle první, to rozhoduje karambola ve 4–6 s)", firstGot.some(v => v !== null && v <= 10), firstGot.map(v => v && v.toFixed(1)).join("/") + " s");
  check("naschvály: doručeno nejvýš tolik, kolik odešlo, a aspoň 2", data[0].log.filter(e => e.ev === "got").length + data[1].log.filter(e => e.ev === "got").length <= sends[0].length + sends[1].length + 2 && sends[0].length + sends[1].length >= 2);
  const gotN = data.map(d => d.log.filter(e => e.ev === "got").length), sendN = sends.map(a => a.length);
  console.log(`signalizace: ikona u soupeřova skóre zachycena A ${seen.A.icon}× / B ${seen.B.icon}× (doručeno ${gotN[0]} / ${gotN[1]}), pulz měřiče A ${seen.A.pulse}× / B ${seen.B.pulse}× (odesláno ${sendN[0]} / ${sendN[1]}), nejdelší animace ${Math.max(seen.A.dur, seen.B.dur)} / ${Math.max(seen.A.durPulse, seen.B.durPulse)} ms`);
  check("naschvál se doručil a ikona u soupeřova skóre bliknula (každá strana, která naschvál dostala)", gotN.every((n, i) => n === 0 || seen[i ? "B" : "A"].icon > 0) && gotN.some(n => n > 0), gotN.join("/"));
  check("bliknutí ikony ≤ 1 s (žeton od soupeře + ikona u jeho cedulky, ať jde přečíst, kdo co poslal) a pulz měřiče u odesílatele ≤ 400 ms", Math.max(seen.A.dur, seen.B.dur) > 0 && Math.max(seen.A.dur, seen.B.dur) <= 1000 && Math.max(seen.A.durPulse, seen.B.durPulse) > 0 && Math.max(seen.A.durPulse, seen.B.durPulse) <= 400);
  check("pulz měřiče u každého, kdo naschvál poslal", sendN.every((n, i) => n === 0 || seen[i ? "B" : "A"].pulse > 0), sendN.join("/"));
  const allTxt = data.flatMap(d => d.txt);
  check("žádný text o naschvále (banner pryč, plovoucí texty bez „letí/posílá/bomba od“)", data.every(d => d.noBanner) && !allTxt.some(t => /letí|posílá|podstrč|cákl|zmraz|mráz|šmouh|bomba od|nabíj|Náboj|Odraženo/i.test(t)), allTxt.length + " textů, např. " + [...new Set(allTxt)].slice(0, 6).join(" | "));
  check("přesné řezy: aspoň jeden na každé straně", precise.every(n => n >= 1), precise.join("/"));
  check("tempo: 4. čtvrtina aspoň 1,4× hustší než 1.", Q[3] >= Q[0] * 1.4, perSec(Q).join("/"));
  check("bomby jako koření: 3–16 % rozpisu (jedno semínko kolísá, průměr přes semínka ~9 %, viz tempo.mjs)", bombShare >= 0.03 && bombShare <= 0.16, (bombShare * 100).toFixed(1) + " %");
  check("naráz vidět v průměru nejvýš 8 kusů", visAvg <= 8, visAvg.toFixed(1));
  check("šmouha nezakrývá skóre ani hodiny", !smear.A.cover && !smear.B.cover);
  check("bez chyb v konzoli", errs.length === 0, errs.slice(0, 3).join(" | "));
  console.log(`\n${pass}/${pass + fail} PASS${fail ? `, ${fail} FAIL` : ""}`);
  await bA.close(); await bB.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
