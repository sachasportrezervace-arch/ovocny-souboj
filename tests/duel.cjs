// Celý souboj ve 2 nezávislých prohlížečích: Chromium (Pixel 7) jako Mark, WebKit (iPhone 13) jako Radka.
// Výzva -> přijetí -> synchronní start -> sekání skutečnými tahy myši -> naschvály -> konec kola -> výhra -> odveta.
// node tests/duel.cjs [URL]   (výchozí http://127.0.0.1:8803/, kola zkrácená na 15 s parametrem ?kolo=15)
const path = require("path");
const PW = process.env.PW || path.join(process.env.APPDATA || "", "npm/node_modules/playwright");
const { chromium, webkit, devices } = require(PW);
const BASE = (process.argv[2] || "http://127.0.0.1:8803/").replace(/\/?$/, "/");
const SH = path.join(__dirname, "shots");
require("fs").mkdirSync(SH, { recursive: true });

let pass = 0, fail = 0;
const check = (name, ok, extra = "") => { ok ? pass++ : fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  (" + extra + ")" : ""}`); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const st = p => p.evaluate(() => __ovs.state());
const waitPhase = (p, ph, timeout = 30000) => p.waitForFunction(ph => [].concat(ph).includes(__ovs.state().phase), ph, { timeout });

// bot: každých ~140 ms jeden tah přes viditelné ovoce (3+ kusy = combo), bomby obchází
async function bot(p, untilMs) {
  const end = Date.now() + untilMs;
  let strokes = 0;
  while (Date.now() < end) {
    const s = await st(p);
    if (s.phase !== "play") { if (s.phase === "wait" || s.phase === "result") break; await sleep(100); continue; }
    const vp = p.viewportSize();
    const t = (await p.evaluate(() => __ovs.targets())).filter(o => o.y > 120 && o.y < vp.height - 60 && o.x > 10 && o.x < vp.width - 10);
    const fruit = t.filter(o => o.kind !== "bomba").sort((a, b) => a.x - b.x);
    const bombs = t.filter(o => o.kind === "bomba");
    const safe = f => bombs.every(b => Math.hypot(b.x - f.x, b.y - f.y) > b.r + 70);
    const pick = fruit.filter(safe);
    if (pick.length) {
      const pts = [];
      for (const f of pick) { pts.push([f.x - f.r * 1.4, f.y - 4], [f.x + f.r * 1.4, f.y + 4]); if (f.ice) pts.push([f.x - f.r * 1.4, f.y + 8], [f.x + f.r * 1.4, f.y - 8]); }
      await p.mouse.move(pts[0][0], pts[0][1]);
      await p.mouse.down();
      for (const [x, y] of pts.slice(1)) await p.mouse.move(x, y, { steps: 3 });
      await p.mouse.up();
      strokes++;
    }
    await sleep(140);
  }
  return strokes;
}

(async () => {
  const bA = await chromium.launch(), bB = await webkit.launch();
  const A = await (await bA.newContext({ ...devices["Pixel 7"] })).newPage();
  const B = await (await bB.newContext({ ...devices["iPhone 13"] })).newPage();
  const errs = [];
  for (const [n, p] of [["A", A], ["B", B]]) {
    p.on("pageerror", e => errs.push(n + ": " + e.message));
    p.on("console", m => m.type() === "error" && errs.push(n + " console: " + m.text().slice(0, 200)));
  }

  // 1) Mark zakládá výzvu
  await A.goto(BASE + "?kolo=15");
  await A.fill("#fMe", "Mark"); await A.fill("#fOpp", "Radka");
  await A.click("#chips button:has-text('kafe')");
  await A.click("#bCreate");
  await A.waitForSelector("#msg", { timeout: 15000 });
  const msg = await A.inputValue("#msg");
  const link = (msg.match(/https?:\/\/\S+#r\.[0-9a-z]+/) || [])[0];
  check("výzva: zpráva má odkaz, jméno a sázku", !!link && msg.includes("Mark") && msg.includes("kafe"), link);
  await A.screenshot({ path: path.join(SH, "1-vyzva-A.png") });

  // 2) Radka otevře odkaz ve WebKitu a přijme
  await B.goto(link);
  await B.waitForSelector("#bAccept", { timeout: 15000 });
  const intro = await B.locator(".tag").innerText();
  check("přijetí: Radka vidí, kdo ji vyzývá a o co", intro.includes("Mark tě vyzývá") && intro.includes("kafe"));
  check("přijetí: jméno předvyplněné", (await B.inputValue("#fName")) === "Radka");
  await B.screenshot({ path: path.join(SH, "2-prijeti-B.png") });
  await B.click("#bAccept");
  await B.waitForSelector("#bReady", { timeout: 15000 });
  await A.locator("#bLobby").click({ timeout: 3000 }).catch(() => {}); // host se po přijetí přesune do lobby i sám
  await A.waitForSelector("#bReady:not([disabled])", { timeout: 15000 });
  check("lobby: oba u stánku", true);

  let roundsPlayed = 0, skews = [], latencies = [], liveOpp = 0, sentTotal = 0, gotTotal = 0;
  async function playRound(label) {
    await Promise.all([A.click("#bReady, #bNext"), B.click("#bReady, #bNext")]);
    await Promise.all([waitPhase(A, ["count", "play"]), waitPhase(B, ["count", "play"])]);
    const [la, lb] = await Promise.all([A.evaluate(() => __ovs.log.filter(e => e.ev === "countdown").pop()), B.evaluate(() => __ovs.log.filter(e => e.ev === "countdown").pop())]);
    const skew = Math.abs(la.at - lb.at); skews.push(skew);
    check(`${label}: synchronní start (rozdíl odpočtů)`, la.k === lb.k && skew < 600, `${skew} ms, kolo ${la.k}`);
    await Promise.all([waitPhase(A, "play", 8000), waitPhase(B, "play", 8000)]);
    // v půlce kola zkontroluj živé skóre soupeře
    const bots = Promise.all([bot(A, 20000), bot(B, 20000)]);
    await sleep(8000);
    const [sa, sb] = await Promise.all([st(A), st(B)]);
    const oppOk = sa.opp !== null && sb.opp !== null && Math.abs(sa.opp - sb.score) <= 8 && Math.abs(sb.opp - sa.score) <= 8;
    if (oppOk) liveOpp++;
    check(`${label}: živé skóre soupeře v půlce kola`, oppOk, `A ${sa.score} vidí B ${sa.opp} / B ${sb.score} vidí A ${sb.opp}`);
    if (label === "1. kolo") { await A.screenshot({ path: path.join(SH, "3-hra-A.png") }); await B.screenshot({ path: path.join(SH, "3-hra-B.png") }); }
    await bots;
    await Promise.all([waitPhase(A, "result", 20000), waitPhase(B, "result", 20000)]);
    const [ea, eb] = await Promise.all([st(A), st(B)]);
    roundsPlayed++;
    sentTotal += ea.sent + eb.sent; gotTotal += ea.got + eb.got;
    const [ha, hb] = await Promise.all([A.locator(".tag h2").innerText(), B.locator(".tag h2").innerText()]);
    check(`${label}: konec kola, oba vidí stejný výsledek`, ha === hb, ha);
    // latence naschválů: odeslání u jednoho -> přijetí u druhého (stejné hodiny, stejný stroj)
    const [logA, logB] = await Promise.all([A.evaluate(() => __ovs.log), B.evaluate(() => __ovs.log)]);
    for (const [snd, rcv] of [[logA, logB], [logB, logA]]) {
      const sends = snd.filter(e => e.ev === "send"), gots = rcv.filter(e => e.ev === "got");
      for (const g of gots) { const s = sends.filter(x => x.type === g.type && x.at <= g.at).pop(); if (s) latencies.push(g.at - s.at); }
    }
    await A.evaluate(() => __ovs.log.length = 0); await B.evaluate(() => __ovs.log.length = 0);
    return ha;
  }

  let head = await playRound("1. kolo");
  await A.screenshot({ path: path.join(SH, "4-vysledek-A.png") });
  for (let i = 2; i <= 5 && !/Souboj/.test(head); i++) head = await playRound(`${i}. kolo`);
  check("výhra: zápas skončil po nejvýš 5 kolech", /Souboj/.test(head), head);
  const finA = await A.locator(".tag").innerText(), finB = await B.locator(".tag").innerText();
  check("výhra: sázka a série na konci", /platí: kafe|zůstává ve hře/.test(finA) && /Série soubojů/.test(finB));
  await A.screenshot({ path: path.join(SH, "5-konec-A.png") }); await B.screenshot({ path: path.join(SH, "5-konec-B.png") });
  check("sabotáž: aspoň jeden naschvál doručen", gotTotal >= 1, `odesláno ${sentTotal}, doručeno ${gotTotal}`);
  // naschvál odeslaný v posledních ~2,6 s kola už nemusí stihnout dorazit, proto doručeno <= odesláno
  check("sabotáž: doručeno nejvýš tolik, kolik odešlo", gotTotal <= sentTotal);
  if (latencies.length) {
    const avg = Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length), max = Math.max(...latencies);
    check("sabotáž: zpoždění doručení (včetně fronty 2,6 s mezi naschvály)", true, `průměr ${avg} ms, max ${max} ms, n=${latencies.length}`);
  }

  // odveta: oba klepnou, startuje 1. kolo 2. zápasu
  await Promise.all([A.click("#bNext"), B.click("#bNext")]);
  await Promise.all([waitPhase(A, ["count", "play"]), waitPhase(B, ["count", "play"])]);
  const [ra, rb] = await Promise.all([st(A), st(B)]);
  check("odveta: obě strany startují 2. zápas", ra.K === 21 && rb.K === 21, `K ${ra.K}/${rb.K}`);
  check("bez chyb v konzoli", errs.length === 0, errs.slice(0, 3).join(" | "));
  console.log(`\nkol: ${roundsPlayed}, skew odpočtu: ${skews.join(", ")} ms`);
  console.log(`${pass}/${pass + fail} PASS`);
  await bA.close(); await bB.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
