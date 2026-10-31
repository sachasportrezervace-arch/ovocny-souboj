// Regrese „vyzývá sama sebe“: novou hru zakládá hráč B (Radka, WebKit iPhone), který výzvu předtím přijal; A (Mark, Chromium desktop) ji otevře z odkazu.
// Ověřuje jména (HUD, nadpisy, zpráva), sedadla, sérii po odehraných kolech a pojistky proti tomu, aby výzvu přijal její vlastní zakladatel.
// node tests/vyzva-b.cjs [URL]   (výchozí http://127.0.0.1:8813/, kolo zkrácené na 10 s parametrem ?kolo=10)
const path = require("path");
const PW = process.env.PW || path.join(process.env.APPDATA || "", "npm/node_modules/playwright");
const { chromium, webkit, devices } = require(PW);
const BASE = (process.argv[2] || "http://127.0.0.1:8813/").replace(/\/?$/, "/");

let pass = 0, fail = 0;
const check = (name, ok, extra = "") => { ok ? pass++ : fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  (" + extra + ")" : ""}`); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const st = p => p.evaluate(() => __ovs.state());
const waitPhase = (p, ph, timeout = 30000) => p.waitForFunction(ph => [].concat(ph).includes(__ovs.state().phase), ph, { timeout });
const linkOf = async p => ((await p.innerText("#msg")).match(/https?:\/\/\S+#r\.[0-9a-z]+/) || [])[0];
const names = p => p.evaluate(() => ({ me: document.getElementById("nameMe").textContent, opp: document.getElementById("nameOpp").textContent, seat: __ovs.state().seat }));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// bot: tahy přes viditelné ovoce, bomby obchází; končí, jakmile kolo skončí
async function bot(p, untilMs) {
  const end = Date.now() + untilMs;
  while (Date.now() < end) {
    const s = await st(p);
    if (s.phase !== "play") { if (s.phase === "wait" || s.phase === "result") break; await sleep(100); continue; }
    const vp = p.viewportSize();
    const t = (await p.evaluate(() => __ovs.targets())).filter(o => o.y > 180 && o.y < vp.height - 100 && o.x > 10 && o.x < vp.width - 10);
    const bombs = t.filter(o => o.kind === "bomba");
    const pick = t.filter(o => o.kind !== "bomba" && bombs.every(b => Math.hypot(b.x - o.x, b.y - o.y) > b.r + 70)).sort((a, b) => a.x - b.x);
    if (pick.length) {
      const pts = [];
      for (const f of pick) { pts.push([f.x - f.r * 1.4, f.y - 4], [f.x + f.r * 1.4, f.y + 4]); if (f.ice) pts.push([f.x - f.r * 1.4, f.y + 8], [f.x + f.r * 1.4, f.y - 8]); }
      await p.mouse.move(pts[0][0], pts[0][1]); await p.mouse.down();
      for (const [x, y] of pts.slice(1)) await p.mouse.move(x, y, { steps: 3 });
      await p.mouse.up();
    }
    await sleep(140);
  }
}
// jedno kolo: hraje jen `who` (druhý nesekne vůbec), takže vítěz je jednoznačný
async function playRound(A, B, who, label) {
  await Promise.all([A.click("#bReady, #bNext"), B.click("#bReady, #bNext")]);
  await Promise.all([waitPhase(A, "play", 20000), waitPhase(B, "play", 20000)]);
  await bot(who, 12000);
  await Promise.all([waitPhase(A, "result", 25000), waitPhase(B, "result", 25000)]);
  const [ha, hb] = await Promise.all([A.innerText(".tag h2"), B.innerText(".tag h2")]);
  check(`${label}: oba vidí stejného vítěze`, ha === hb && /^Souboj bere \S+$/.test(ha), `${ha} | ${hb}`);
  return ha.replace("Souboj bere ", "");
}
const serText = async p => (await p.innerText("#ser")).replace(/\s+/g, " ");

(async () => {
  const bA = await chromium.launch(), bB = await webkit.launch();
  const ctxA = await bA.newContext({ viewport: { width: 1440, height: 900 } }), ctxB = await bB.newContext({ ...devices["iPhone 13"] });
  const A = await ctxA.newPage(), B = await ctxB.newPage();
  const errs = [];
  for (const [n, p] of [["A", A], ["B", B]]) { p.on("pageerror", e => errs.push(n + ": " + e.message)); p.on("console", m => m.type() === "error" && errs.push(n + " console: " + m.text().slice(0, 200))); }

  // 1) Mark založí, Radka přijme a dohrají krátké kolo (zakladatel A, B je „o“)
  await A.goto(BASE + "?kolo=10");
  await A.fill("#fMe", "Mark"); await A.fill("#fOpp", "Radka"); await A.click("#bCreate");
  await A.waitForSelector("#msg", { timeout: 15000 });
  const link1 = await linkOf(A);
  await B.goto(link1); await B.waitForSelector("#bAccept", { timeout: 15000 });
  check("výchozí hra: Radka vidí Marka jako vyzyvatele a má předvyplněné své jméno", (await B.innerText(".tag h1")) === "Mark tě vyzývá" && (await B.inputValue("#fName")) === "Radka");
  await B.click("#bAccept"); await B.waitForSelector("#bReady", { timeout: 15000 });
  await A.waitForSelector("#bReady:not([disabled])", { timeout: 15000 });
  await playRound(A, B, B, "hra 1");

  // 2) Radka (B) založí novou hru ze svého prohlížeče: nová návštěva základní URL, soupeře vyplní
  await B.goto(BASE + "?kolo=10"); await B.waitForSelector("#bCreate");
  check("setup po hře: Tvoje jméno = Radka, Koho vyzýváš je prázdné", (await B.inputValue("#fMe")) === "Radka" && (await B.inputValue("#fOpp")) === "");
  await B.fill("#fOpp", "radka");
  await B.click("#bCreate");
  await sleep(500);
  check("setup: stejné jméno u vyzyvatele i soupeře se nepustí dál", (await B.locator("#bCreate").count()) === 1 && (await B.locator("#toast").innerText()).includes("stejné jméno"));
  await B.fill("#fOpp", "Mark"); await B.click("#bCreate");
  await B.waitForSelector("#msg", { timeout: 15000 });
  const msg2 = await B.innerText("#msg"), link2 = await linkOf(B);
  check("výzva B: zpráva má vyzyvatele Radku a odkaz na novou místnost", msg2.startsWith("Radka tě vyzývá na Ovocný souboj") && !!link2 && !link2.endsWith(link1.split("#")[1]), msg2.slice(0, 40));
  check("výzva B: nadpis oslovuje soupeře Marka, B je na sedadle x", (await B.innerText(".tag h2")) === "Pošli výzvu, ať Mark ví" && (await st(B)).seat === "x");
  await A.goto(link2); await A.waitForSelector("#bAccept", { timeout: 15000 });
  check("přijetí: Mark vidí „Radka tě vyzývá“ a předvyplněné jméno Mark", (await A.innerText(".tag h1")) === "Radka tě vyzývá" && (await A.inputValue("#fName")) === "Mark");
  await A.click("#bAccept"); await A.waitForSelector("#bReady", { timeout: 15000 });
  await B.waitForSelector("#bReady:not([disabled])", { timeout: 15000 });
  const [nA, nB] = await Promise.all([names(A), names(B)]);
  check("lobby: A = Mark proti Radce na sedadle o", same(nA, { me: "Mark", opp: "Radka", seat: "o" }), JSON.stringify(nA));
  check("lobby: B = Radka proti Markovi na sedadle x", same(nB, { me: "Radka", opp: "Mark", seat: "x" }), JSON.stringify(nB));
  check("lobby: série na začátku „jedno kolo“", (await serText(A)) === "jedno kolo" && (await serText(B)) === "jedno kolo");

  const w1 = await playRound(A, B, A, "hra 2 kolo 1");
  check("kolo 1: vyhrál Mark (jen on sekal)", w1 === "Mark", w1);
  const [rA, rB] = await Promise.all([names(A), names(B)]);
  check("výsledek: jména a sedadla beze změny na obou stranách", same(rA, nA) && same(rB, nB), JSON.stringify([rA, rB]));
  check("kolo 1: série A 1 : 0, B 0 : 1", (await serText(A)) === "série 1 : 0" && (await serText(B)) === "série 0 : 1", `${await serText(A)} | ${await serText(B)}`);
  const chatA = await A.evaluate(() => { let t = ""; navigator.share = async o => { t = o.text; }; document.getElementById("bShareRes").click(); return new Promise(r => setTimeout(() => r(t), 200)); });
  const chatB = await B.evaluate(() => { let t = ""; navigator.share = async o => { t = o.text; }; document.getElementById("bShareRes").click(); return new Promise(r => setTimeout(() => r(t), 200)); });
  check("výsledek do chatu: série v pořadí vyzyvatel Radka, soupeř Mark (stejně na obou stranách)", chatA.includes("Série Radka 0 : 1 Mark") && chatB.includes("Série Radka 0 : 1 Mark"), chatB.slice(0, 90));

  const w2 = await playRound(A, B, B, "hra 2 odveta");
  check("odveta: vyhrála Radka", w2 === "Radka", w2);
  check("odveta: série 1 : 1 na obou stranách", (await serText(A)) === "série 1 : 1" && (await serText(B)) === "série 1 : 1", `${await serText(A)} | ${await serText(B)}`);
  check("odveta: číslo souboje 2 na obou stranách", (await A.innerText("#roundLabel")).toUpperCase() === "SOUBOJ Č. 2" && (await B.innerText("#roundLabel")).toUpperCase() === "SOUBOJ Č. 2");

  // 3) B založí hru bez jména soupeře: Mark se při přijetí neoznačí jménem Radky
  await B.goto(BASE + "?kolo=10"); await B.waitForSelector("#bCreate"); await B.click("#bCreate");
  await B.waitForSelector("#msg", { timeout: 15000 });
  const msg3 = await B.innerText("#msg"), link3 = await linkOf(B);
  check("výzva B bez soupeře: vyzyvatel Radka, nadpis bez oslovení", msg3.startsWith("Radka tě vyzývá") && (await B.innerText(".tag h2")) === "Pošli výzvu");
  // Radka otevře vlastní výzvu v jiném úložišti (Safari, plocha, prohlížeč v chatu) dřív, než ji někdo přijme
  const ctxS = await bB.newContext({ ...devices["iPhone 13"] }), S = await ctxS.newPage();
  await S.goto(link3); await S.waitForSelector("#bAccept", { timeout: 15000 });
  check("vlastní výzva v jiném úložišti: nabídka „Jsem Radka“", (await S.locator("#bMine").innerText()).startsWith("Jsem Radka"));
  await S.fill("#fName", "Radka"); await S.click("#bAccept"); await sleep(600);
  check("vlastní výzva: přijmout pod jménem vyzyvatele nejde", (await S.locator("#bAccept").count()) === 1 && (await S.locator("#toast").innerText()).includes("Jsi to ty?") && (await st(S)).seat === null);
  await S.click("#bMine"); await S.waitForSelector("#bBack, #bReady", { timeout: 15000 });
  const nS = await st(S);
  check("vlastní výzva: „Jsem Radka“ vrátí sedadlo x, výzva zůstává nepřijatá", nS.seat === "x" && (await S.locator("#bBack").count()) === 1, JSON.stringify({ seat: nS.seat }));
  await ctxS.close();
  await A.goto(link3); await A.waitForSelector("#bAccept", { timeout: 15000 });
  check("přijetí bez soupeře: Mark má předvyplněné své jméno, ne Radčino", (await A.inputValue("#fName")) === "Mark");
  await A.click("#bAccept"); await A.waitForSelector("#bReady", { timeout: 15000 });
  await B.waitForSelector("#bReady:not([disabled])", { timeout: 15000 });
  const [mA, mB] = await Promise.all([names(A), names(B)]);
  check("bez soupeře: A = Mark proti Radce (o), B = Radka proti Markovi (x)", same(mA, { me: "Mark", opp: "Radka", seat: "o" }) && same(mB, { me: "Radka", opp: "Mark", seat: "x" }), JSON.stringify([mA, mB]));

  check("bez chyb v konzoli", errs.length === 0, errs.slice(0, 3).join(" | "));
  await bA.close(); await bB.close();
  console.log(`\n${pass} PASS, ${fail} FAIL`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error("ERR", e); process.exit(1); });
