// Napojení na Hernu (react-apps/HERNA-PROTOKOL.md, verze 1): hra běží v iframe rodičovské stránky (jako v Herně), A = Chromium desktop 1440×900,
// B = WebKit iPhone 13 @1×. Ověřuje: meta řádek, zprávy hra → Herna (pripraveno, stav, vysledek, jina-hra), oba sednou bez výzvy a bez setupu
// (zakladatel zaklada=1, druhý čeká zaklada=0), jména podle sedadel (i když zakladatel má seat=1, diakritika), skryté sdílení / „Zkusit sám“ /
// celá obrazovka, mód první partie z předsíně, reload zakladatele, a že bez herna=1 hra běží jako dřív (výzva, žádné zprávy).
// node tests/herna.cjs [URL]   (výchozí http://127.0.0.1:8801/, kolo zkrácené na 10 s parametrem ?kolo=10)
const path = require("path");
const PW = process.env.PW || path.join(process.env.APPDATA || "", "npm/node_modules/playwright");
const { chromium, webkit, devices } = require(PW);
const BASE = (process.argv[2] || "http://127.0.0.1:8801/").replace(/\/?$/, "/");
const SH = path.join(__dirname, "shots");
require("fs").mkdirSync(SH, { recursive: true });
const OFF = 48;   // výška lišty Herny nad iframe
const sleep = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0;
const check = (name, ok, extra = "") => { ok ? pass++ : fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  (" + extra + ")" : ""}`); };
const rid = () => [...Array(12)].map(() => "0123456789abcdefghijklmnopqrstuvwxyz"[Math.floor(Math.random() * 36)]).join("");
const hash = (r, seat, zaklada, names = "Mark,Radka") => `#herna=1&m=test000000&r=${r}&seat=${seat}&names=${names}&zaklada=${zaklada}`;
const fr = p => p.frames().find(f => f !== p.mainFrame());
const st = p => fr(p).evaluate(() => __ovs.state());
const msgs = p => p.evaluate(() => window.__msgs.slice());
const waitPhase = (p, ph, timeout = 30000) => fr(p).waitForFunction(ph => [].concat(ph).includes(__ovs.state().phase), ph, { timeout });
const names = p => fr(p).evaluate(() => ({ me: document.getElementById("nameMe").textContent, opp: document.getElementById("nameOpp").textContent, seat: __ovs.state().seat }));
const snap = (p, n) => p.screenshot({ path: path.join(SH, n + ".png") });
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const fazes = ms => ms.filter(m => m.typ === "stav").map(m => m.faze).filter((f, i, a) => i === 0 || f !== a[i - 1]);

// rodič jako Herna: lišta 48 px a iframe přes zbytek obrazovky, zprávy z iframe se sbírají do window.__msgs
async function openIn(ctx, hashStr, errs, label, search = "?kolo=10") {
  const p = await ctx.newPage();
  p.on("pageerror", e => errs.push(label + ": " + e.message));
  p.on("console", m => m.type() === "error" && !/Failed to load resource|net::ERR/.test(m.text()) && errs.push(label + " console: " + m.text().slice(0, 200)));
  const parent = new URL("__herna-rodic", BASE).href;
  await p.route(parent, r => r.fulfill({
    contentType: "text/html",
    body: `<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><style>html,body{margin:0;height:100%;background:#111}iframe{position:fixed;left:0;right:0;bottom:0;top:${OFF}px;width:100%;height:calc(100% - ${OFF}px);border:0}</style><iframe id=g></iframe><script>window.__msgs=[];addEventListener("message",function(e){if(e.source===document.getElementById("g").contentWindow)__msgs.push(e.data)})</script>`,
  }));
  await p.goto(parent);
  await p.evaluate(u => { document.getElementById("g").src = u; }, BASE + search + hashStr);
  await p.waitForFunction(() => document.getElementById("g").contentWindow && document.getElementById("g").contentWindow.__ovs, null, { timeout: 20000 }).catch(() => {});
  return p;
}

// hráč: tahy přes viditelné ovoce, bomby obchází; souřadnice iframe + lišta
async function playBot(p, untilMs) {
  const F = fr(p), end = Date.now() + untilMs;
  const vp = await F.evaluate(() => ({ width: innerWidth, height: innerHeight }));
  while (Date.now() < end) {
    const s = await F.evaluate(() => __ovs.state());
    if (s.phase !== "play") { if (s.phase === "wait" || s.phase === "result") break; await sleep(100); continue; }
    const t = (await F.evaluate(() => __ovs.targets())).filter(o => o.y > 150 && o.y < vp.height - 60 && o.x > 10 && o.x < vp.width - 10);
    const bombs = t.filter(o => o.kind === "bomba");
    const pick = t.filter(o => o.kind !== "bomba" && bombs.every(b => Math.hypot(b.x - o.x, b.y - o.y) > b.r + 70)).sort((a, b) => a.x - b.x).slice(0, 6);
    if (pick.length) {
      const cx = x => Math.max(4, Math.min(vp.width - 4, x)), pts = [];
      for (const f of pick) { pts.push([cx(f.x - f.r * 1.4), f.y - 4 + OFF], [cx(f.x + f.r * 1.4), f.y + 4 + OFF]); if (f.ice) pts.push([cx(f.x - f.r * 1.4), f.y + 8 + OFF], [cx(f.x + f.r * 1.4), f.y - 8 + OFF]); }
      await p.mouse.move(pts[0][0], pts[0][1]); await p.mouse.down();
      for (const [x, y] of pts.slice(1)) await p.mouse.move(x, y, { steps: 3 });
      await p.mouse.up();
    }
    await sleep(140);
  }
}
// jedna partie: hraje jen `who` (null = nikdo, remíza 0 : 0)
async function round(A, B, who, label) {
  await Promise.all([fr(A).click("#bReady, #bNext"), fr(B).click("#bReady, #bNext")]);
  await Promise.all([waitPhase(A, "play", 25000), waitPhase(B, "play", 25000)]);
  if (who) await playBot(who, 12000);
  await Promise.all([waitPhase(A, "result", 30000), waitPhase(B, "result", 30000)]);
  const [ha, hb] = await Promise.all([fr(A).innerText(".tag h2"), fr(B).innerText(".tag h2")]);
  check(`${label}: oba vidí stejný nadpis`, ha === hb, `${ha} | ${hb}`);
  return ha;
}
const results = ms => ms.filter(m => m.typ === "vysledek");

(async () => {
  // 0) meta řádek v index.html
  const html = await (await fetch(BASE)).text();
  check("index.html: <meta name=\"herna-protokol\" content=\"1\">", /<meta name="herna-protokol" content="1">/.test(html));

  const bA = await chromium.launch(), bB = await webkit.launch();
  const ctxA = await bA.newContext({ viewport: { width: 1440, height: 900 } }), ctxB = await bB.newContext({ ...devices["iPhone 13"], deviceScaleFactor: 1 });
  const errs = [];

  // 1) zakladatel A (seat 0, Mark) a druhý B (seat 1, Radka), B otevře hru dřív, než dokument vznikne
  const r1 = rid();
  const B = await openIn(ctxB, hash(r1, 1, 0), errs, "B");
  await fr(B).waitForSelector("#panel h2", { timeout: 15000 });
  const bw = await fr(B).innerText("#panel");
  check("B (zaklada=0): „Čeká se, až hra naskočí“, bez setupu a výzvy", /Čeká se, až hra naskočí/.test(bw) && (await fr(B).locator("#bCreate, #bAccept, #bSolo").count()) === 0, bw.replace(/\n+/g, " ").slice(0, 60));
  await snap(B, "herna-b-ceka");
  const mb0 = await msgs(B);
  check("B: první zpráva rodiči je {herna:1, typ:\"pripraveno\"}", mb0[0] && mb0[0].herna === 1 && mb0[0].typ === "pripraveno", JSON.stringify(mb0[0]));

  const A = await openIn(ctxA, hash(r1, 0, 1), errs, "A");
  await Promise.all([fr(A).waitForSelector("#bReady:not([disabled])", { timeout: 20000 }), fr(B).waitForSelector("#bReady:not([disabled])", { timeout: 20000 })]);
  const [nA, nB] = await Promise.all([names(A), names(B)]);
  check("jména a sedadla: A = Mark proti Radce (x), B = Radka proti Markovi (o)", same(nA, { me: "Mark", opp: "Radka", seat: "x" }) && same(nB, { me: "Radka", opp: "Mark", seat: "o" }), JSON.stringify([nA, nB]));
  const uiA = await fr(A).evaluate(() => ({ create: document.querySelectorAll("#bCreate,#bSolo,#bBack,#bShare,#bCopy,#bAccept,#bMine,#msg").length, links: document.querySelectorAll("a[href]").length, fs: document.getElementById("fs").hidden, ios: document.getElementById("iosHint").hidden, how: !!document.querySelector("details.how"), hash: location.hash.slice(0, 11) }));
  check("A: v předsíni bez výzvy, sdílení, „Zkusit sám“, odkazů ven a tlačítka celé obrazovky; pravidla po ruce", uiA.create === 0 && uiA.links === 0 && uiA.fs && uiA.how, JSON.stringify(uiA));
  check("B: nápověda „Přidat na plochu“ je v Herně skrytá", await fr(B).evaluate(() => document.getElementById("iosHint").hidden));
  check("adresa v iframe zůstává #herna=1…", uiA.hash === "#herna=1&m=");
  await Promise.all([snap(A, "herna-a-predsin"), snap(B, "herna-b-predsin")]);

  // mód první partie se vybírá v předsíni a vidí ho oba
  await fr(B).click('#modeChips button[data-c="zivoty"]');
  await fr(A).waitForFunction(() => __ovs.state().gmd === "zivoty" && document.querySelector('#modeChips button[data-c="zivoty"]').getAttribute("aria-pressed") === "true", null, { timeout: 8000 })
    .then(() => check("mód z předsíně: B zvolí 3 životy, A to uvidí", true)).catch(() => check("mód z předsíně: B zvolí 3 životy, A to uvidí", false));
  await fr(A).click('#modeChips button[data-c="cas60"]');
  await fr(B).waitForFunction(() => __ovs.state().gmd === "cas", null, { timeout: 8000 })
    .then(() => check("mód z předsíně: A vrátí „Na čas“, B to uvidí", true)).catch(() => check("mód z předsíně: A vrátí „Na čas“, B to uvidí", false));

  // partie 1: hraje jen B (Herna sedadlo 1)
  const h1 = await round(A, B, B, "partie 1");
  check("partie 1: vyhrála Radka", h1 === "Souboj bere Radka", h1);
  await Promise.all([snap(A, "herna-a-vysledek"), snap(B, "herna-b-vysledek")]);
  const ui2 = await fr(A).evaluate(() => ({ share: !!document.getElementById("bShareRes"), other: (document.getElementById("bOther") || {}).textContent, next: document.getElementById("bNext").textContent }));
  check("výsledek: bez „Poslat výsledek do chatu“, s „Jiná hra“ a „Odveta“", !ui2.share && ui2.other === "Jiná hra" && ui2.next === "Odveta", JSON.stringify(ui2));
  await sleep(500);
  let [mA, mB] = [await msgs(A), await msgs(B)];
  check("vysledek partie 1: oba pošlou jednou r:1, vitez 1 (sedadlo Radky)", same(results(mA).map(m => [m.partie, m.vitez]), [[r1 + ":1", 1]]) && same(results(mB).map(m => [m.partie, m.vitez]), [[r1 + ":1", 1]]), JSON.stringify([results(mA), results(mB)]));
  check("všechny zprávy mají herna:1", [...mA, ...mB].every(m => m.herna === 1));

  // partie 2 (odveta): hraje jen A (sedadlo 0)
  const h2 = await round(A, B, A, "partie 2 (odveta)");
  check("partie 2: vyhrál Mark", h2 === "Souboj bere Mark", h2);
  await sleep(500);
  [mA, mB] = [await msgs(A), await msgs(B)];
  check("vysledek partie 2: r:2, vitez 0", same(results(mA).map(m => [m.partie, m.vitez]), [[r1 + ":1", 1], [r1 + ":2", 0]]) && same(results(mB).map(m => [m.partie, m.vitez]), [[r1 + ":1", 1], [r1 + ":2", 0]]), JSON.stringify([results(mA), results(mB)]));

  // partie 3: nikdo nesekne = remíza, vitez null
  const h3 = await round(A, B, null, "partie 3 (remíza)");
  check("partie 3: remíza", h3 === "Remíza", h3);
  await sleep(500);
  [mA, mB] = [await msgs(A), await msgs(B)];
  const l3A = results(mA).pop(), l3B = results(mB).pop();
  check("vysledek partie 3: r:3, vitez null", l3A.partie === r1 + ":3" && l3A.vitez === null && l3B.partie === r1 + ":3" && l3B.vitez === null, JSON.stringify([l3A, l3B]));
  check("stav: ceka → hraje → konec (A i B), při odvetě znovu hraje", same(fazes(mA).slice(0, 3), ["ceka", "hraje", "konec"]) && same(fazes(mB).slice(0, 3), ["ceka", "hraje", "konec"]) && fazes(mA).filter(f => f === "hraje").length === 3, JSON.stringify([fazes(mA), fazes(mB)]));

  // Jiná hra z B
  const nBefore = (await msgs(B)).length;
  await fr(B).click("#bOther");
  await sleep(300);
  const mB2 = (await msgs(B)).slice(nBefore);
  check("„Jiná hra“ pošle {herna:1, typ:\"jina-hra\"}", mB2.length === 1 && mB2[0].herna === 1 && mB2[0].typ === "jina-hra", JSON.stringify(mB2));

  // reload zakladatele: sedne si zpátky na x, stejná jména, partie se nezakládá znovu
  const goBefore = (await st(A)).go;
  await A.evaluate(() => { document.getElementById("g").contentWindow.location.reload(); });
  await A.waitForTimeout(500);
  await fr(A).waitForFunction(() => window.__ovs && __ovs.state().seat === "x" && __ovs.state().phase === "result", null, { timeout: 20000 }).catch(() => {});
  const sA = await st(A), nA2 = await names(A);
  check("reload zakladatele: zpět na sedadle x, jména i číslo partie beze změny", sA.seat === "x" && sA.go === goBefore && nA2.me === "Mark" && nA2.opp === "Radka", JSON.stringify({ seat: sA.seat, go: sA.go, nA2 }));
  const mA3 = await msgs(A);
  check("reload: nová hra pošle pripraveno a znovu vysledek r:3 (Herna dedupuje podle partie), bez bliknutí „hraje“", mA3.filter(m => m.typ === "pripraveno").length === 2 && results(mA3).filter(m => m.partie === r1 + ":3").length === 2 && same(mA3.slice(mA.length).filter(m => m.typ === "stav").map(m => m.faze), ["ceka", "konec"]), JSON.stringify(mA3.slice(mA.length)));
  await A.close(); await B.close();

  // 2) zakladatel má seat=1 (Radka je x), druhý seat=0; jména s diakritikou a mezerou
  const r2 = rid(), nm = encodeURIComponent("Žofie Kuňka") + "," + encodeURIComponent("Ondřej");
  const A2 = await openIn(ctxA, hash(r2, 1, 1, nm), errs, "A2"), B2 = await openIn(ctxB, hash(r2, 0, 0, nm), errs, "B2");
  await Promise.all([fr(A2).waitForSelector("#bReady:not([disabled])", { timeout: 20000 }), fr(B2).waitForSelector("#bReady:not([disabled])", { timeout: 20000 })]);
  const [n2A, n2B] = await Promise.all([names(A2), names(B2)]);
  check("zakladatel seat=1: A2 = Ondřej (Herna sedadlo 1, names[1]) proti Žofii, B2 = Žofie Kuňka proti Ondřejovi", same(n2A, { me: "Ondřej", opp: "Žofie Kuňka", seat: "x" }) && same(n2B, { me: "Žofie Kuňka", opp: "Ondřej", seat: "o" }), JSON.stringify([n2A, n2B]));
  const hh = await round(A2, B2, A2, "partie (seat=1 zakládá)");
  check("vyhrál zakladatel (Ondřej)", hh === "Souboj bere Ondřej", hh);
  await sleep(500);
  const [k2A, k2B] = [await msgs(A2), await msgs(B2)];
  check("vysledek: vitez 1 (sedadlo Ondřeje) na obou stranách, partie r:1", same(results(k2A).map(m => [m.partie, m.vitez]), [[r2 + ":1", 1]]) && same(results(k2B).map(m => [m.partie, m.vitez]), [[r2 + ":1", 1]]), JSON.stringify([results(k2A), results(k2B)]));
  await A2.close(); await B2.close();

  // 3) bez herna=1 se hra chová jako dřív: výzva a „Zkusit sám“ jsou na místě, žádné zprávy rodiči; neplatný hash taky
  for (const [lab, h] of [["bez hashe", ""], ["herna=1 s neplatným r", "#herna=1&m=x&r=abc&seat=0&names=A,B&zaklada=1"], ["herna=1 bez sedadla", "#herna=1&r=" + rid() + "&names=A,B&zaklada=1"]]) {
    const P = await openIn(ctxA, h, errs, "N");
    await fr(P).waitForSelector("#bCreate", { timeout: 15000 });
    await sleep(1000);
    const o = await fr(P).evaluate(() => ({ solo: !!document.getElementById("bSolo"), fs: !document.getElementById("fs").hidden }));
    const m = await msgs(P);
    check(`${lab}: setup s „Zkusit sám“ a bez zpráv rodiči`, o.solo && m.length === 0, JSON.stringify({ o, m }));
    await P.close();
  }

  check("bez chyb v konzoli", errs.length === 0, errs.slice(0, 3).join(" | "));
  await bA.close(); await bB.close();
  console.log(`\n${pass} PASS, ${fail} FAIL`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error("ERR", e); process.exit(1); });
