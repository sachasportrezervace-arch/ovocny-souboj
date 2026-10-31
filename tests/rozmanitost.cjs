// Test rozmanitosti kol ve 2 nezávislých prohlížečích: A = Chromium desktop 1440×900 (zakladatel), B = WebKit iPhone 13 na výšku.
// 3 kola na čas za sebou ve stejné místnosti (délka 50 s přes ?kolo=50, takže každé kolo má finále, Sim.hasFinale = čas a ≥ 45 s).
// Ověřuje: oba vidí totéž (modifikátor, deska, otisk rozpisu), kola se liší, finále proběhne a bot v něm seká, znamení modifikátoru v HUD, čistá konzole.
// node tests/rozmanitost.cjs [URL]   (výchozí http://127.0.0.1:8801/)
const path = require("path");
const PW = process.env.PW || path.join(process.env.APPDATA || "", "npm/node_modules/playwright");
const { chromium, webkit, devices } = require(PW);
const BASE = (process.argv[2] || "http://127.0.0.1:8801/").replace(/\/?$/, "/");
const SH = path.join(__dirname, "shots");
require("fs").mkdirSync(SH, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0;
const check = (name, ok, extra = "") => { ok ? pass++ : fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  (" + extra + ")" : ""}`); };
const snap = (p, n) => p.screenshot({ path: path.join(SH, n + ".png") });
const st = p => p.evaluate(() => __ovs.state());
const waitPhase = (p, ph, timeout = 30000) => p.waitForFunction(ph => [].concat(ph).includes(__ovs.state().phase), ph, { timeout });
const lastEnd = p => p.evaluate(() => __ovs.log.filter(e => e.ev === "end").pop());
const sigOf = p => p.evaluate(() => __ovs.sig());

// bot jako nepřesný hráč (stejný jako v tests/mody.cjs): krátké tahy přes viditelné ovoce, bomby obchází
async function botStep(p, vp) {
  const t = (await p.evaluate(() => __ovs.targets())).filter(o => o.y > 150 && o.y < vp.height - 60 && o.x > 10 && o.x < vp.width - 10);
  const bombs = t.filter(o => o.kind === "bomba");
  const pick = t.filter(o => o.kind !== "bomba" && bombs.every(b => Math.hypot(b.x - o.x, b.y - o.y) > b.r + 70)).sort((a, b) => a.x - b.x);
  if (!pick.length) return;
  pick.splice(4);
  const pts = [];
  for (const f of pick) { const off = (Math.random() - 0.5) * f.r * 1.2; pts.push([f.x - f.r * 1.4, f.y + off - 4], [f.x + f.r * 1.4, f.y + off + 4]); if (f.ice) pts.push([f.x - f.r * 1.4, f.y + off + 8], [f.x + f.r * 1.4, f.y + off - 8]); }
  await p.mouse.move(pts[0][0], pts[0][1]); await p.mouse.down();
  for (const [x, y] of pts.slice(1)) await p.mouse.move(x, y, { steps: 3 });
  await p.mouse.up();
}
// hraje do konce kola; snímek v čase shotAt (ms od začátku hraní) a ve finále (jednou), viditelnost znamení modifikátoru se vzorkuje
async function play(p, tag, k, vp) {
  const t0 = Date.now(), info = { icon: null, finShot: false };
  let shot = false;
  while (Date.now() - t0 < 90000) {
    const s = await st(p);
    if (s.phase !== "play") { if (s.phase === "wait" || s.phase === "result") break; await sleep(80); continue; }
    if (!shot && Date.now() - t0 > 6000) {
      shot = true;
      info.icon = await p.evaluate(() => { const e = document.getElementById("modIcon"); const r = e.getBoundingClientRect(); return { hidden: e.hasAttribute("hidden"), vis: getComputedStyle(e).display !== "none" && r.width > 0 && r.height > 0, mod: e.dataset.mod }; });
      await snap(p, `rozmanitost-k${k}-${tag}`);
    }
    if (!info.finShot && k === 1 && s.fin0) { info.finShot = true; await snap(p, `rozmanitost-k1-finale-${tag}`); }
    await botStep(p, vp); await sleep(130);
  }
  return info;
}

(async () => {
  const bA = await chromium.launch(), bB = await webkit.launch();
  const A = await (await bA.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  const B = await (await bB.newContext({ ...devices["iPhone 13"] })).newPage();
  const errs = [];
  for (const [n, p] of [["A", A], ["B", B]]) { p.on("pageerror", e => errs.push(n + ": " + e.message)); p.on("console", m => m.type() === "error" && errs.push(n + " console: " + m.text().slice(0, 160))); }

  // --- založení výzvy (kolo na čas 50 s) a přijetí ---
  await A.goto(BASE + "?kolo=50");
  await A.waitForSelector("#modeChips"); await sleep(900);
  await A.fill("#fMe", "Mark"); await A.fill("#fOpp", "Radka"); await A.click("#bCreate");
  await A.waitForSelector("#msg", { timeout: 15000 });
  const link = (await A.innerText("#msg")).match(/https?:\/\/\S+#r\.[0-9a-z]+/)[0];
  await B.goto(link); await B.waitForSelector("#bAccept", { timeout: 15000 }); await sleep(900);
  await B.click("#bAccept");
  await B.waitForSelector("#bReady", { timeout: 15000 });
  await A.locator("#bLobby").click({ timeout: 3000 }).catch(() => {});
  await A.waitForSelector("#bReady:not([disabled])", { timeout: 15000 });

  const rows = [], ends = [];
  const vpA = A.viewportSize(), vpB = B.viewportSize();
  for (let k = 1; k <= 3; k++) {
    if (k === 1) await Promise.all([A.click("#bReady"), B.click("#bReady")]);
    else { await Promise.all([A.waitForSelector("#bNext", { timeout: 15000 }), B.waitForSelector("#bNext", { timeout: 15000 })]); await Promise.all([A.click("#bNext"), B.click("#bNext")]); }
    await Promise.all([waitPhase(A, "play", 40000), waitPhase(B, "play", 40000)]);
    await sleep(500);
    const [sA, sB, gA, gB] = await Promise.all([st(A), st(B), sigOf(A), sigOf(B)]);
    check(`k${k}: oba hrají kolo na čas`, sA.md === "cas" && sB.md === "cas");
    check(`k${k}: stejný modifikátor`, !!sA.mod && sA.mod === sB.mod, `${sA.mod} | ${sB.mod}`);
    check(`k${k}: stejná deska`, !!sA.theme && sA.theme === sB.theme, `${sA.theme} | ${sB.theme}`);
    check(`k${k}: stejný otisk rozpisu`, JSON.stringify(gA) === JSON.stringify(gB), `A ${gA.n}/${gA.hash} | B ${gB.n}/${gB.hash}`);
    rows.push({ k, mod: sA.mod, theme: sA.theme, ...gA });
    const [iA, iB] = await Promise.all([play(A, "desktop", k, vpA), play(B, "iphone", k, vpB)]);
    for (const [n, i, s] of [["A", iA, sA], ["B", iB, sB]]) {
      check(`k${k} ${n}: znamení modifikátoru v HUD viditelné a data-mod = mod`, !!i.icon && !i.icon.hidden && i.icon.vis && i.icon.mod === s.mod, JSON.stringify(i.icon));
    }
    if (k === 1) check("k1: snímek z finále pořízen u obou", iA.finShot && iB.finShot, `A ${iA.finShot} B ${iB.finShot}`);
    await Promise.all([waitPhase(A, "result", 30000), waitPhase(B, "result", 30000)]);
    const [eA, eB] = await Promise.all([lastEnd(A), lastEnd(B)]);
    ends.push({ k, eA, eB });
    await sleep(600);
  }

  // --- 2) kola se liší ---
  console.log("\nkolo | mod | theme | n | kinds | fin | big | hash");
  for (const r of rows) console.log(`${r.k} | ${r.mod} | ${r.theme} | ${r.n} | ${JSON.stringify(r.kinds)} | ${r.fin} | ${r.big} | ${r.hash}`);
  console.log("");
  for (let i = 1; i < rows.length; i++) {
    check(`k${i}→k${i + 1}: jiný modifikátor`, rows[i].mod !== rows[i - 1].mod, `${rows[i - 1].mod} → ${rows[i].mod}`);
    check(`k${i}→k${i + 1}: jiná deska`, rows[i].theme !== rows[i - 1].theme, `${rows[i - 1].theme} → ${rows[i].theme}`);
  }
  check("hash rozpisu je v každém kole jiný", new Set(rows.map(r => r.hash)).size === rows.length, rows.map(r => r.hash).join(","));

  // --- 3) finále ---
  const logs = await Promise.all([A, B].map(p => p.evaluate(() => __ovs.log.filter(e => e.ev === "finale").length)));
  check("finále: událost finale v logu obou (3 kola)", logs[0] === 3 && logs[1] === 3, `A ${logs[0]} B ${logs[1]}`);
  for (const { k, eA, eB } of ends) {
    check(`k${k}: end má fin0 u obou`, eA.fin0 === true && eB.fin0 === true);
    check(`k${k}: ve finále někdo nasekal (finCuts > 0)`, eA.finCuts > 0 || eB.finCuts > 0, `A ${eA.finCuts} B ${eB.finCuts}`);
    console.log(`  k${k} body ve finále: Mark ${eA.score - eA.scoreFin} (z ${eA.score}), Radka ${eB.score - eB.scoreFin} (z ${eB.score}); sekání A ${eA.finCuts}, B ${eB.finCuts}`);
  }
  check("bez chyb v konzoli", errs.length === 0, errs.slice(0, 3).join(" | "));
  console.log(`${pass}/${pass + fail} PASS${fail ? `, ${fail} FAIL` : ""}`);
  await bA.close(); await bB.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
