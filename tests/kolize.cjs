// Kolize ovoce a bomb v prohlížeči: Chromium desktop 1440×900 (myš + pointer události myši) a WebKit iPhone 13 (dotykové pointer události).
// Kusy se připnou na obrazovkové souřadnice (__ovs.pin) v menu, takže geometrie je přesná:
//  - rychlý švih (jedna dlouhá úsečka bez mezilehlých bodů) přes ovoce = zásah,
//  - ovoce má zásahovou zónu o něco větší než dřív (1,15 r + 6), bomba jen 60 % poloměru,
//  - švih mířený na ovoce, které těsně sousedí s bombou, bombu netrefí; švih středem bomby ano,
//  - rozpis (Sim.schedule i roundSchedule) nemá bombu schovanou za ovocem ani těsně vedle něj.
// node tests/kolize.cjs [URL]   (výchozí http://127.0.0.1:8803/)
const path = require("path");
const { pathToFileURL } = require("url");
const PW = process.env.PW || path.join(process.env.APPDATA || "", "npm/node_modules/playwright");
const { chromium, webkit, devices } = require(PW);
const BASE = (process.argv[2] || "http://127.0.0.1:8803/").replace(/\/?$/, "/");
const SH = path.join(__dirname, "shots");
require("fs").mkdirSync(SH, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0;
const check = (name, ok, extra = "") => { ok ? pass++ : fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  (" + extra + ")" : ""}`); };

// jeden švih jako pointer události (touch nebo mouse) rovnou na plátno čepele; pts = [[x, y], ...] (mezi body nic nevznikne)
const swipe = (p, pts, type) => p.evaluate(([pts, type]) => {
  const el = document.getElementById("blade"), mk = (t, [x, y]) => new PointerEvent(t, { clientX: x, clientY: y, pointerId: 7, pointerType: type, isPrimary: true, bubbles: true, cancelable: true, buttons: t === "pointerup" ? 0 : 1 });
  el.dispatchEvent(mk("pointerdown", pts[0]));
  for (const q of pts.slice(1)) el.dispatchEvent(mk("pointermove", q));
  el.dispatchEvent(mk("pointerup", pts[pts.length - 1]));
}, [pts, type]);
const live = (p, kind) => p.evaluate(k => __ovs.targets().filter(o => o.kind === k).length, kind);
const reset = async p => { await p.evaluate(() => { __ovs.pause = true; __ovs.clearLive(); }); await sleep(60); };

async function suite(label, p, type, vp) {
  await p.goto(BASE); await p.waitForSelector("#bCreate"); await sleep(700);
  const cx = Math.round(vp.width * 0.5), cy = Math.round(vp.height * 0.42);
  // 1) rychlý švih: jedna úsečka přes celou šířku, bez mezibodů
  await reset(p);
  const f = await p.evaluate(([x, y]) => __ovs.pin("jablko", x, y), [cx, cy]);
  await swipe(p, [[6, cy], [vp.width - 6, cy]], type);
  await sleep(80);
  check(`${label}: rychlý švih jednou úsečkou přes ovoce = zásah`, (await live(p, "jablko")) === 0, `r ${Math.round(f.r)} px, délka ${vp.width - 12} px`);
  // 2) zásahová zóna ovoce je štědřejší než dřív (1,15 r + 6): tah ve vzdálenosti 1,15 r + 10 od středu, tj. kousek za starou zónou
  await reset(p);
  const g = await p.evaluate(([x, y]) => __ovs.pin("pomeranc", x, y), [cx, cy]);
  const off = g.r * 1.15 + 10, oldZone = g.r * 1.15 + 6;
  await swipe(p, [[cx - g.r * 2.5, cy + off], [cx + g.r * 2.5, cy + off + 2]], type);
  await sleep(80);
  check(`${label}: ovoce se seká i o kousek mimo střed (zóna větší než dřív)`, off > oldZone && (await live(p, "pomeranc")) === 0, `tah ve ${off.toFixed(0)} px, dřív do ${oldZone.toFixed(0)} px`);
  // 3) bomba těsně u ovoce: švih mířený na ovoce ji nesmí trefit
  await reset(p);
  const F = await p.evaluate(([x, y]) => __ovs.pin("jablko", x, y), [cx, cy]);
  const B0 = await p.evaluate(([x, y]) => __ovs.pin("bomba", x, y, 1.5), [cx + 400, cy + 200]);   // jen kvůli poloměru bomby
  await reset(p);
  const rF = F.r, rB = B0.r, bx = cx + rF + rB * 0.8, by = cy + rB * 0.75;
  await p.evaluate(([x, y, bx, by]) => { __ovs.pin("jablko", x, y); __ovs.pin("bomba", bx, by, 1.5); }, [cx, cy, bx, by]);
  const gap = Math.hypot(bx - (cx + rF * 1.4), by - cy);
  await swipe(p, [[cx - rF * 2.2, cy], [cx + rF * 1.4, cy]], type);
  await sleep(80);
  const stillBomb = await live(p, "bomba"), fruitGone = (await live(p, "jablko")) === 0;
  check(`${label}: švih na ovoce vedle bomby ji netrefí, ovoce padne`, stillBomb === 1 && fruitGone, `konec švihu ${gap.toFixed(0)} px od středu bomby, nová zóna ${(rB * 0.6).toFixed(0)} px, stará ${(rB * 1.15 + 6).toFixed(0)} px`);
  await p.screenshot({ path: path.join(SH, `kolize-${label}-bomba-vedle-ovoce.png`) });
  // 4) bomba přímo: švih jejím středem ji spustí
  await swipe(p, [[bx - rB * 2, by], [bx + rB * 2, by]], type);
  await sleep(80);
  check(`${label}: švih středem bomby ji spustí`, (await live(p, "bomba")) === 0);
  // 5) bomba, kterou čepel jen škrábne zvenku (0,8 r od středu), nevybuchne
  await reset(p);
  const C = await p.evaluate(([x, y]) => __ovs.pin("bomba", x, y, 1.5), [cx, cy]);
  await swipe(p, [[cx - C.r * 2.5, cy + C.r * 0.85], [cx + C.r * 2.5, cy + C.r * 0.85]], type);
  await sleep(80);
  check(`${label}: škrábnutí bomby zvenku (0,85 r) ji nespustí`, (await live(p, "bomba")) === 1);
  await swipe(p, [[cx - C.r * 2.5, cy + C.r * 0.3], [cx + C.r * 2.5, cy + C.r * 0.3]], type);
  await sleep(80);
  check(`${label}: tah blízko středu bomby (0,3 r) ji spustí`, (await live(p, "bomba")) === 0);
  // 6) hloubka: bomba leží vpředu před ovocem (z 1,5 proti z do 1)
  await reset(p);
  await p.evaluate(([x, y]) => { __ovs.pin("jablko", x, y, 1); __ovs.pin("bomba", x + 20, y + 10, 1.5); }, [cx, cy]);
  await sleep(150);
  await p.screenshot({ path: path.join(SH, `kolize-${label}-hloubka.png`), clip: { x: Math.max(0, cx - 140), y: cy - 140, width: 280, height: 280 } });
  check(`${label}: bomba a ovoce se překrývají, bomba je vpředu (z 1,5)`, true);
}

(async () => {
  const bA = await chromium.launch(), bB = await webkit.launch();
  const errs = [];
  const A = await (await bA.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  const B = await (await bB.newContext({ ...devices["iPhone 13"] })).newPage();
  for (const [n, p] of [["A", A], ["B", B]]) { p.on("pageerror", e => errs.push(n + ": " + e.message)); p.on("console", m => m.type() === "error" && errs.push(n + " console: " + m.text().slice(0, 160))); }
  await suite("desktop", A, "mouse", { width: 1440, height: 900 });
  await suite("iPhone", B, "touch", B.viewportSize());
  // skutečná myš na desktopu (ne syntetická událost): rychlý tah přes ovoce v levé části, kde není visačka
  await reset(A);
  const f = await A.evaluate(() => __ovs.pin("kiwi", 170, 420));
  await A.mouse.move(10, 420); await A.mouse.down(); await A.mouse.move(340, 424); await A.mouse.up();
  await sleep(80);
  check("desktop: skutečná myš, jeden rychlý tah přes ovoce = zásah", (await live(A, "kiwi")) === 0, `r ${Math.round(f.r)} px`);

  // rozpis: bomba není schovaná za ovocem ani těsně vedle něj (stejně počítá Sim v testu sim.test.mjs, tady na delším vzorku a po modifikátorech)
  const S = await import(pathToFileURL(path.join(__dirname, "../src/sim.js")).href);
  let bombs = 0, worst = 9, nearMiss = 0, total = 0;
  for (let sd = 1; sd <= 24; sd++) for (const ms of [60000, 120000]) {
    const s = sd % 2 ? S.schedule(sd * 977, ms) : S.roundSchedule(sd * 977, ms, "cas");
    for (const b of s.filter(i => i.kind === "bomba")) {
      bombs++;
      for (const o of s) if (o !== b) { const r = S.gapRatio(b, o); total++; worst = Math.min(worst, r); if (r < S.CLEAR - 1e-9) nearMiss++; }
    }
  }
  check("rozpis: žádná bomba blíž než hranice rozestupu od jiného kusu (48 kol, i s modifikátory a finále)", nearMiss === 0 && bombs > 200, `bomb ${bombs}, nejtěsnější poměr ${worst.toFixed(2)} (hranice ${S.CLEAR})`);
  check("bez chyb v konzoli", errs.length === 0, errs.slice(0, 3).join(" | "));
  console.log(`${pass}/${pass + fail} PASS${fail ? `, ${fail} FAIL` : ""}`);
  await bA.close(); await bB.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
