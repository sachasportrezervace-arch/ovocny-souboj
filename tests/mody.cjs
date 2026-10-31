// Playtest módů ve 2 nezávislých prohlížečích: A = Chromium desktop 1440×900 (zakladatel), B = WebKit iPhone 13 na výšku.
// Závod (cíl zkrácený ?cil=15): oba boti sekají, kdo dřív v cíli, tomu i soupeři kolo skončí; vítěz stejný na obou stranách.
// Přepnutí módu na výsledku (A přepne, B to vidí), pak Tři životy: A nesekne nic a přijde o 3 životy, B přežije a kolo mu skončí samo.
// node tests/mody.cjs [URL]   (výchozí http://127.0.0.1:8803/)
const path = require("path");
const PW = process.env.PW || path.join(process.env.APPDATA || "", "npm/node_modules/playwright");
const { chromium, webkit, devices } = require(PW);
const BASE = (process.argv[2] || "http://127.0.0.1:8803/").replace(/\/?$/, "/");
const SH = path.join(__dirname, "shots");
require("fs").mkdirSync(SH, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0;
const check = (name, ok, extra = "") => { ok ? pass++ : fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  (" + extra + ")" : ""}`); };
const snap = (p, n) => p.screenshot({ path: path.join(SH, n + ".png") });
const st = p => p.evaluate(() => __ovs.state());
const waitPhase = (p, ph, timeout = 30000) => p.waitForFunction(ph => [].concat(ph).includes(__ovs.state().phase), ph, { timeout });
const lastEnd = p => p.evaluate(() => __ovs.log.filter(e => e.ev === "end").pop());

// bot jako nepřesný hráč (stejný jako tests/feel.cjs): krátké tahy přes viditelné ovoce, bomby obchází
async function botStep(p, vp) {
  const t = (await p.evaluate(() => __ovs.targets())).filter(o => o.y > 150 && o.y < vp.height - 60 && o.x > 10 && o.x < vp.width - 10);
  const bombs = t.filter(o => o.kind === "bomba");
  const pick = t.filter(o => o.kind !== "bomba" && bombs.every(b => Math.hypot(b.x - o.x, b.y - o.y) > b.r + 70)).sort((a, b) => a.x - b.x);
  if (!pick.length) return;
  pick.splice(6);   // celá řada (zvláštnost kola „řady“ má 5–6 kusů)
  const pts = [], cx = x => Math.max(4, Math.min(vp.width - 4, x));   // prst nezačne ani nekončí mimo displej (kus u kraje se sekne od okraje dovnitř)
  for (const f of pick) { const off = (Math.random() - 0.5) * f.r * 1.2; pts.push([cx(f.x - f.r * 1.4), f.y + off - 4], [cx(f.x + f.r * 1.4), f.y + off + 4]); if (f.ice) pts.push([cx(f.x - f.r * 1.4), f.y + off + 8], [cx(f.x + f.r * 1.4), f.y + off - 8]); }
  await p.mouse.move(pts[0][0], pts[0][1]); await p.mouse.down();
  for (const [x, y] of pts.slice(1)) await p.mouse.move(x, y, { steps: 3 });
  await p.mouse.up();
}
async function play(p, untilMs, shotAt, shotName) {
  const end = Date.now() + untilMs, t0 = Date.now(), vp = p.viewportSize();
  let shot = false, clocks = [];
  while (Date.now() < end) {
    const s = await st(p);
    if (s.phase !== "play") { if (s.phase === "wait" || s.phase === "result") break; await sleep(80); continue; }
    if (!shot && shotAt && Date.now() - t0 > shotAt) { shot = true; await snap(p, shotName); clocks.push(await p.locator("#timer").innerText()); }
    await botStep(p, vp); await sleep(130);
  }
  return clocks;
}

(async () => {
  const bA = await chromium.launch(), bB = await webkit.launch();
  const A = await (await bA.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  // deviceScaleFactor 1: headless WebKit bez GPU kreslí hru na @3× jen ~6 snímků/s (změřeno, stejně i starší verze), bot by viděl zastaralé polohy a
  // hra by neodpovídala skutečnému telefonu (60 snímků/s); na @1× je to ~50. Rozlišení displeje na chování hry nemá vliv (viewport 390×664 zůstává).
  const B = await (await bB.newContext({ ...devices["iPhone 13"], deviceScaleFactor: 1 })).newPage();
  const errs = [];
  for (const [n, p] of [["A", A], ["B", B]]) { p.on("pageerror", e => errs.push(n + ": " + e.message)); p.on("console", m => m.type() === "error" && errs.push(n + " console: " + m.text().slice(0, 160))); }

  // --- výběr módu na zakládací visačce (iPhone i desktop) ---
  const B0 = await (await bB.newContext({ ...devices["iPhone 13"] })).newPage();
  await B0.goto(BASE); await B0.waitForSelector("#modeChips"); await sleep(900);
  const fit = await B0.evaluate(() => { const ch = [...document.querySelectorAll("#modeChips button")].map(b => b.getBoundingClientRect()); const pn = document.getElementById("panel"); const c = document.getElementById("bCreate").getBoundingClientRect(); return { rows: 1 + ch.filter((r, i) => i && r.top - ch[i - 1].top > r.height / 2).length, h: Math.round(ch[0].height), sh: pn.scrollHeight, chh: pn.clientHeight, cb: Math.round(c.bottom), ih: innerHeight }; });
  check("iPhone: 4 čipy módu v jedné řadě, dotykové ≥ 44 px", fit.rows === 1 && fit.h >= 44, JSON.stringify(fit));
  check("iPhone: setup se vejde i s tlačítkem bez scrollu", fit.sh <= fit.chh + 1 && fit.cb <= fit.ih, JSON.stringify(fit));
  await snap(B0, "mody-iphone-setup");
  await B0.click("#modeChips button[data-c=zivoty]"); await sleep(150);
  await snap(B0, "mody-iphone-setup-zivoty");
  await B0.context().close();

  await A.goto(BASE + "?cil=15&kolo=45");
  await A.waitForSelector("#modeChips"); await sleep(900);
  await A.click("#modeChips button[data-c=zavod]");
  const line = await A.innerText("#modeLine");
  check("setup: věta pod čipy popisuje vybraný mód", /první nasbírá 15 bodů/.test(line), line);
  await snap(A, "mody-desktop-setup-zavod");
  await A.fill("#fMe", "Mark"); await A.fill("#fOpp", "Radka"); await A.click("#bCreate");
  await A.waitForSelector("#msg", { timeout: 15000 });
  const msg = await A.innerText("#msg");
  check("výzva: zpráva uvádí závod", /závod do 15 bodů/.test(msg), msg.slice(0, 90));
  const link = msg.match(/https?:\/\/\S+#r\.[0-9a-z]+/)[0];
  await B.goto(link); await B.waitForSelector("#bAccept", { timeout: 15000 }); await sleep(900);
  check("přijetí: Radka vidí mód", /závod do 15 bodů/.test(await B.innerText(".tag")));
  await snap(B, "mody-iphone-prijeti-zavod");
  await B.click("#bAccept");
  await B.waitForSelector("#bReady", { timeout: 15000 });
  await A.locator("#bLobby").click({ timeout: 3000 }).catch(() => {});
  await A.waitForSelector("#bReady:not([disabled])", { timeout: 15000 });
  check("lobby: mód a pravidlo na visačce", /Do 15 bodů\./.test(await A.innerText(".tag")));
  await snap(A, "mody-desktop-lobby-zavod"); await snap(B, "mody-iphone-lobby-zavod");

  // --- 1) závod ---
  await Promise.all([A.click("#bReady"), B.click("#bReady")]);
  await Promise.all([waitPhase(A, "play"), waitPhase(B, "play")]);
  check("závod: oba hrají mód zavod", (await st(A)).md === "zavod" && (await st(B)).md === "zavod");
  const [cA] = await Promise.all([play(A, 50000, 4000, "mody-desktop-hra-zavod"), play(B, 50000, 4300, "mody-iphone-hra-zavod")]);
  check("závod: hodiny běží nahoru", /^0:0[2-9]|^0:[1-5]\d/.test(cA[0] || ""), cA.join());
  await Promise.all([waitPhase(A, "result", 20000), waitPhase(B, "result", 20000)]);
  const [eA, eB] = await Promise.all([lastEnd(A), lastEnd(B)]);
  const winA = eA.why === "cil", winB = eB.why === "cil";
  check("závod: aspoň jeden v cíli, druhému kolo skončilo samo", (winA || winB) && (eA.why === "opp" || eB.why === "opp" || (winA && winB)), `A ${eA.why} ${eA.score} / B ${eB.why} ${eB.score}`);
  check("závod: konec u obou do 2,5 s od sebe", Math.abs(eA.at - eB.at) <= 2500, `${Math.abs(eA.at - eB.at)} ms`);
  const [hA, hB] = await Promise.all([A.innerText(".tag h2"), B.innerText(".tag h2")]);
  check("závod: stejný vítěz na obou stranách", hA === hB && /Souboj bere (Mark|Radka)/.test(hA), `${hA} | ${hB}`);
  const winnerName = winA && !winB ? "Mark" : winB && !winA ? "Radka" : null;
  if (winnerName) check("závod: vyhrál ten, kdo dal cíl", hA === "Souboj bere " + winnerName, hA);
  check("závod: na výsledku čas v cíli", /v cíli za \d:\d\d/.test(await A.innerText(".vs")), (await A.innerText(".vs")).replace(/\n/g, " "));
  await sleep(800);
  await snap(A, "mody-desktop-vysledek-zavod"); await snap(B, "mody-iphone-vysledek-zavod");

  // --- 2) přepnutí módu na výsledku ---
  await A.click("#modeChips button[data-c=zivoty]");
  await B.waitForFunction(() => document.querySelector("#modeChips button[data-c=zivoty]")?.getAttribute("aria-pressed") === "true", null, { timeout: 6000 }).then(() => check("výsledek: mód přepnutý Markem vidí i Radka", true), () => check("výsledek: mód přepnutý Markem vidí i Radka", false));
  await sleep(700);
  await snap(B, "mody-iphone-vysledek-prepnuto");

  // --- 3) tři životy: A nesekne nic, B hraje ---
  await Promise.all([A.click("#bNext"), B.click("#bNext")]);
  await Promise.all([waitPhase(A, "play"), waitPhase(B, "play")]);
  check("tři životy: oba hrají mód zivoty, 3 životy", (await st(A)).md === "zivoty" && (await st(B)).md === "zivoty" && (await st(A)).lives === 3);
  const tLife = Date.now();
  // Radčin displej může změnu životů přeskočit mezi dvěma kroky bota, proto se ztracené životy soupeře hlídají pozorovatelem DOM
  await B.evaluate(() => { window.__offMax = 0; new MutationObserver(() => { window.__offMax = Math.max(window.__offMax, document.querySelectorAll("#livesOpp i.off").length); }).observe(document.getElementById("livesOpp"), { subtree: true, attributes: true, attributeFilter: ["class"] }); });
  A.waitForSelector(".float.miss", { timeout: 30000 }).then(() => snap(A, "mody-desktop-hra-zivoty-miss")).catch(() => {});   // snímek „×“ po propadlém kuse
  B.waitForSelector(".float.miss", { timeout: 30000 }).then(() => snap(B, "mody-iphone-hra-zivoty-miss")).catch(() => {});
  let shotB = false;
  while (Date.now() - tLife < 40000) {
    const [sA, sB] = await Promise.all([st(A), st(B)]);
    if (sB.phase === "play") {
      const off = await B.evaluate(() => document.querySelectorAll("#livesOpp i.off").length);
      if (off >= 1 && off < 3 && !shotB) { shotB = true; await snap(B, "mody-iphone-hra-zivoty"); await snap(A, "mody-desktop-hra-zivoty"); }
      await botStep(B, B.viewportSize());
    }
    if (sA.phase !== "play" && sB.phase !== "play") break;
    await sleep(120);
  }
  check("tři životy: Radka vidí Markovy ztracené životy na jeho cedulce", (await B.evaluate(() => window.__offMax)) >= 1);
  await Promise.all([waitPhase(A, "result", 20000), waitPhase(B, "result", 20000)]);
  const [lA, lB] = await Promise.all([lastEnd(A), lastEnd(B)]);
  check("tři životy: Markovi došly životy, Radce kolo skončilo samo do 2,5 s", lA.why === "mrtvy" && lB.why === "prezil" && Math.abs(lA.at - lB.at) <= 2500, `A ${lA.why} fin ${lA.fin} / B ${lB.why}, rozdíl ${Math.abs(lA.at - lB.at)} ms`);
  const [h2A, h2B] = await Promise.all([A.innerText(".tag h2"), B.innerText(".tag h2")]);
  check("tři životy: vítěz Radka na obou stranách", h2A === "Souboj bere Radka" && h2B === h2A, `${h2A} | ${h2B}`);
  const vs = (await A.innerText(".vs")).replace(/\n/g, " ");
  check("tři životy: výsledek ukazuje výdrž m:ss a body", /\d:\d\d.*\d+ bod/.test(vs), vs);
  await sleep(800);
  await snap(A, "mody-desktop-vysledek-zivoty"); await snap(B, "mody-iphone-vysledek-zivoty");
  const [sA2, sB2] = await Promise.all([A.innerText("#ser"), B.innerText("#ser")]);
  const nums = t => (t.match(/(\d+) : (\d+)/) || []).slice(1).map(Number);
  const a2 = nums(sA2), b2 = nums(sB2);
  check("série přes módy stejná z obou pohledů", a2.length === 2 && a2[0] === b2[1] && a2[1] === b2[0], `${sA2} | ${sB2}`);
  check("bez chyb v konzoli", errs.length === 0, errs.slice(0, 3).join(" | "));
  console.log(`${pass}/${pass + fail} PASS${fail ? `, ${fail} FAIL` : ""}`);
  await bA.close(); await bB.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
