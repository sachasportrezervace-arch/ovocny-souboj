// Celý souboj ve 2 nezávislých prohlížečích: A = Chromium desktop 1440×900 (Mark, zakladatel), B = WebKit iPhone 13 na výšku (Radka).
// Výzva s volbou délky -> přijetí -> synchronní start -> sekání skutečnými tahy -> živé skóre -> naschvály -> konec kola -> vítěz -> sázka a série -> odveta.
// node tests/duel.cjs [URL]   (výchozí http://127.0.0.1:8803/, kolo zkrácené na 15 s parametrem ?kolo=15)
const path = require("path");
const PW = process.env.PW || path.join(process.env.APPDATA || "", "npm/node_modules/playwright");
const { chromium, webkit, devices } = require(PW);
const BASE = (process.argv[2] || "http://127.0.0.1:8803/").replace(/\/?$/, "/");
const SH = path.join(__dirname, "shots");
require("fs").mkdirSync(SH, { recursive: true });

let pass = 0, fail = 0;
const check = (name, ok, extra = "") => { ok ? pass++ : fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  (" + extra + ")" : ""}`); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
// před snímkem se počká na doběhnutí animace visačky (hang, 0,7 s); wait = 0 pro snímek za hry
const shot = async (p, name, wait = 900) => { if (wait) await sleep(wait); await p.screenshot({ path: path.join(SH, name + ".png") }); };
// vejde se obrazovka bez scrollu panelu a tlačítko je nad bednami?
const fitDesk = p => p.evaluate(() => { const r = q => document.querySelector(q).getBoundingClientRect(), pn = document.getElementById("panel"); return { sh: pn.scrollHeight, ch: pn.clientHeight, cb: (document.querySelector("#bCreate, #bNext, #bReady") || document.querySelector(".tag")).getBoundingClientRect().bottom, crates: innerHeight - 8, tagW: r(".tag").width, tagB: r(".tag").bottom }; });
const st = p => p.evaluate(() => __ovs.state());
const waitPhase = (p, ph, timeout = 30000) => p.waitForFunction(ph => [].concat(ph).includes(__ovs.state().phase), ph, { timeout });
const DESK = { viewport: { width: 1440, height: 900 } };

// bot: každých ~140 ms jeden tah přes viditelné ovoce (3+ kusy = combo), bomby obchází
async function bot(p, untilMs) {
  const end = Date.now() + untilMs;
  let strokes = 0;
  while (Date.now() < end) {
    const s = await st(p);
    if (s.phase !== "play") { if (s.phase === "wait" || s.phase === "result") break; await sleep(100); continue; }
    const vp = p.viewportSize();
    const t = (await p.evaluate(() => __ovs.targets())).filter(o => o.y > 180 && o.y < vp.height - 100 && o.x > 10 && o.x < vp.width - 10);
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
  const SHARE_STUB = () => { navigator.share = async () => {}; };   // ať je na share kartě vidět i tlačítko Poslat
  const ctxA = await bA.newContext(DESK), ctxB = await bB.newContext({ ...devices["iPhone 13"] });
  await ctxA.addInitScript(SHARE_STUB);
  const A = await ctxA.newPage(), B = await ctxB.newPage();
  const errs = [];
  const watch = (n, p) => {
    p.on("pageerror", e => errs.push(n + ": " + e.message));
    p.on("console", m => m.type() === "error" && errs.push(n + " console: " + m.text().slice(0, 200)));
  };
  watch("A", A); watch("B", B);

  // 0) setup obrazovka na obou zařízeních + rozvržení
  await A.goto(BASE + "?kolo=15");
  await A.waitForSelector("#bCreate");
  await sleep(900);
  const f1 = await fitDesk(A);
  check("desktop 1440×900: setup bez scrollu, CTA nad bednami, visačka široká", f1.sh <= f1.ch + 1 && f1.cb <= f1.crates && f1.tagW >= 700, JSON.stringify(f1));
  await shot(A, "desktop-1-setup", 0);
  const D = await (await bA.newContext({ viewport: { width: 1280, height: 720 } })).newPage(); watch("D", D);
  await D.goto(BASE); await D.waitForSelector("#bCreate"); await sleep(900);
  const f2 = await fitDesk(D);
  check("desktop 1280×720: setup bez scrollu, CTA nad bednami", f2.sh <= f2.ch + 1 && f2.cb <= f2.crates && f2.tagB <= f2.crates, JSON.stringify(f2));
  await shot(D, "desktop720-1-setup", 0); await D.context().close();
  const L = await (await bB.newContext({ ...devices["iPhone 13"], viewport: { width: 844, height: 390 }, screen: { width: 844, height: 390 } })).newPage(); watch("L", L);
  await L.goto(BASE); await L.waitForSelector("#bCreate"); await sleep(900);
  const fl = await L.evaluate(() => { const t = document.querySelector(".tag").getBoundingClientRect(); document.getElementById("bCreate").scrollIntoView({ block: "center" }); const c = document.getElementById("bCreate").getBoundingClientRect(); return { ox: document.documentElement.scrollWidth - innerWidth, tl: t.left, tr: t.right, w: innerWidth, cTop: c.top, cBot: c.bottom, h: innerHeight, scrolled: document.scrollingElement.scrollTop }; });
  check("iPhone na šířku 844×390: nic nepřetéká do stran, CTA dosažitelné scrollem panelu", fl.ox <= 0 && fl.tl >= 0 && fl.tr <= fl.w && fl.cTop >= 0 && fl.cBot <= fl.h && fl.scrolled === 0, JSON.stringify(fl));
  await L.evaluate(() => document.getElementById("panel").scrollTo(0, 0)); await sleep(200);
  await shot(L, "iphone-landscape-1-setup", 0); await L.context().close();
  const B0 = await ctxB.newPage(); watch("B0", B0);
  await B0.goto(BASE); await B0.waitForSelector("#bCreate"); await B0.waitForTimeout(600);
  await shot(B0, "iphone-1-setup", 0);
  const fit = await B0.evaluate(() => { const r = q => document.querySelector(q).getBoundingClientRect(), h = document.getElementById("iosHint"); return { h: innerHeight, cb: r("#bCreate").bottom, hintTop: h.hidden || getComputedStyle(h).display === "none" ? null : r("#iosHint").top, tagB: r(".tag").bottom, soundTop: r("#sound").top }; });
  check("iPhone setup: CTA vidět bez scrollu a nad nápovědou", fit.cb <= fit.h && fit.hintTop !== null && fit.cb <= fit.hintTop, JSON.stringify(fit));
  check("iPhone setup: visačka nezasahuje do zvuku ani nápovědy", fit.tagB <= Math.min(fit.hintTop, fit.soundTop) + 1, JSON.stringify(fit));
  const lay = await B0.evaluate(() => ({ h: innerHeight, gl: document.getElementById("gl").getBoundingClientRect().height, ta: getComputedStyle(document.getElementById("blade")).touchAction, ob: getComputedStyle(document.documentElement).overscrollBehaviorY,
    small: [...document.querySelectorAll(".chips button, .btn, #sound")].filter(e => e.offsetParent && (e.getBoundingClientRect().height < 44 || e.getBoundingClientRect().width < 44)).map(e => e.textContent.trim().slice(0, 14) || e.id) }));
  check("iPhone: hrací plocha přes celou výšku, touch-action none, overscroll none (kde ho WebKit zná)", Math.abs(lay.gl - lay.h) < 1 && lay.ta === "none" && (lay.ob === "none" || lay.ob === undefined), JSON.stringify({ h: lay.h, gl: lay.gl, ta: lay.ta }));
  check("iPhone: dotykové cíle ≥ 44 px", lay.small.length === 0, lay.small.join(","));
  const pf = await Promise.all([A, B0].map(p => p.evaluate(() => ({ fs: !document.getElementById("fs").hidden && getComputedStyle(document.getElementById("fs")).display !== "none", hint: !document.getElementById("iosHint").hidden && getComputedStyle(document.getElementById("iosHint")).display !== "none" }))));
  check("desktop: tlačítko celé obrazovky ano, nápověda ne", pf[0].fs && !pf[0].hint, JSON.stringify(pf[0]));
  check("iPhone: tlačítko celé obrazovky ne, nápověda Sdílet → Přidat na plochu ano", !pf[1].fs && pf[1].hint, JSON.stringify(pf[1]));
  const hintTxt = await B0.locator("#iosHint").innerText();
  check("iPhone: text nápovědy", /Sdílet → Přidat na plochu/.test(hintTxt));
  await B0.click("#iosHintX");
  check("iPhone: nápovědu jde zavřít a pamatuje se", await B0.evaluate(() => document.getElementById("iosHint").hidden && localStorage.getItem("ovs-ioshint") === "1"));
  await B0.evaluate(() => localStorage.removeItem("ovs-ioshint"));
  await B0.close();
  const mf = await A.evaluate(async () => { const m = await (await fetch("manifest.webmanifest")).json(); return { d: m.display, n: m.icons.length }; });
  check("manifest: standalone a ikony", mf.d === "standalone" && mf.n >= 2);
  const fsTry = await A.evaluate(async () => { try { await document.documentElement.requestFullscreen(); const ok = !!document.fullscreenElement; await document.exitFullscreen(); return ok; } catch { return false; } });
  check("desktop: Fullscreen API funguje", fsTry);

  // 1) Mark zakládá výzvu s volbou délky
  const chipsInfo = await A.evaluate(() => [...document.querySelectorAll("#modeChips button")].map(b => b.textContent.trim() + ":" + b.getAttribute("aria-pressed")));
  check("setup: módy 1 min / 2 min / Do 50 / 3 životy, výchozí 2 min", chipsInfo.join("|") === "1 min:false|2 min:true|Do 50:false|3 životy:false", chipsInfo.join("|"));
  await A.click("#modeChips button[data-c=cas60]");
  check("setup: chip délky přepnutý (aria-pressed)", (await A.getAttribute("#modeChips button[data-c=cas60]", "aria-pressed")) === "true" && (await A.getAttribute("#modeChips button[data-c=cas120]", "aria-pressed")) === "false");
  await A.fill("#fMe", "Mark"); await A.fill("#fOpp", "Radka");
  await A.click("#chips button:has-text('kafe')");
  await A.click("#bCreate");
  await A.waitForSelector("#msg", { timeout: 15000 });
  const msg = await A.innerText("#msg");
  const link = (msg.match(/https?:\/\/\S+#r\.[0-9a-z]+/) || [])[0];
  check("výzva: zpráva má odkaz, jméno, sázku a délku kola", !!link && msg.includes("Mark") && msg.includes("kafe") && /jedno kolo na/.test(msg) && !/tří kol/.test(msg), link);
  await shot(A, "desktop-2-vyzva");
  const shareGeo = p => p.evaluate(() => {
    const R = q => document.querySelector(q).getBoundingClientRect(), m = document.getElementById("msg"), pn = document.getElementById("panel"), h2 = document.querySelector(".tag h2");
    // visačka je pootočená o -1°, proto se měří v nepootočeném rozvržení (offset*), ne přes getBoundingClientRect
    const a = document.getElementById("bShare"), b = document.getElementById("bCopy"), tag = document.querySelector(".tag"), lh = parseFloat(getComputedStyle(h2).lineHeight) || parseFloat(getComputedStyle(h2).fontSize) * 1.05;
    return { shareH: a.offsetHeight, copyH: b.offsetHeight, dTop: Math.abs(a.offsetTop - b.offsetTop), dBot: Math.abs(a.offsetTop + a.offsetHeight - b.offsetTop - b.offsetHeight), gap: b.offsetLeft - a.offsetLeft - a.offsetWidth,
      msgFit: m.scrollHeight <= m.clientHeight + 1 && getComputedStyle(m).overflowY !== "scroll" && getComputedStyle(m).overflowY !== "auto", panelFit: pn.scrollHeight <= pn.clientHeight + 1,
      noTextarea: !document.querySelector("textarea"), h2Lines: Math.round(h2.getBoundingClientRect().height / lh), h2Balance: getComputedStyle(h2).textWrap, inside: b.offsetLeft + b.offsetWidth <= tag.offsetWidth && a.offsetLeft >= 0, vw: innerWidth };
  });
  const noEmoji = t => !/\p{Extended_Pictographic}/u.test(t);
  const gA = await shareGeo(A);
  check("share desktop: Poslat a Kopírovat stejně vysoká, zarovnaná, uvnitř visačky", gA.shareH === gA.copyH && gA.dTop < 0.5 && gA.dBot < 0.5 && gA.inside, JSON.stringify(gA));
  check("share desktop: zpráva celá vidět bez posouvání (text, ne textarea), nadpis ≤ 2 řádky s balance", gA.msgFit && gA.panelFit && gA.noTextarea && gA.h2Lines <= 2 && gA.h2Balance === "balance", JSON.stringify(gA));
  check("share: ve zprávě do chatu není emoji", noEmoji(msg), msg.slice(0, 60));
  check("výzva: věta bez skloňování jména", /ať Radka ví/.test(await A.locator(".tag h2").innerText()));
  const srcMain = require("fs").readFileSync(path.join(__dirname, "../src/main.js"), "utf8");
  check("texty: žádné jméno v nepřímém pádě (k/na/ji + jméno)", !/letí k \$\{/.test(srcMain) && !/Pošli ji\$\{g\.b \? " "/.test(srcMain) && !/Čekám na \$\{n\}/.test(srcMain));
  // desktop: visačka vlevo, mimo střed
  const tagBox = await A.locator(".tag").boundingBox();
  check("desktop: visačka vycentrovaná, nepřetéká přes bedny", Math.abs(tagBox.x + tagBox.width / 2 - 720) < 20 && tagBox.y + tagBox.height <= (await fitDesk(A)).crates, `střed ${Math.round(tagBox.x + tagBox.width / 2)} px`);
  // iPhone: výzva na vlastním zařízení pro screenshot
  const ctxB2 = await bB.newContext({ ...devices["iPhone 13"] }); await ctxB2.addInitScript(SHARE_STUB); const B2 = await ctxB2.newPage();
  await B2.goto(BASE); await B2.fill("#fMe", "Mark"); await B2.fill("#fOpp", "Radka"); await B2.click("#modeChips button[data-c=cas60]"); await B2.click("#bCreate");
  await B2.waitForSelector("#msg", { timeout: 15000 });
  check("výzva (běžný režim): zpráva uvádí skutečnou délku kola 1 minutu", /jedno kolo na 1 minutu\./.test(await B2.innerText("#msg")));
  await shot(B2, "iphone-2-vyzva");
  const gB = await shareGeo(B2);
  check("share iPhone na výšku: Poslat a Kopírovat stejně vysoká, zarovnaná, uvnitř visačky", gB.shareH === gB.copyH && gB.dTop < 0.5 && gB.dBot < 0.5 && gB.inside, JSON.stringify(gB));
  check("share iPhone: zpráva celá vidět bez posouvání, nadpis ≤ 2 řádky s balance", gB.msgFit && gB.panelFit && gB.noTextarea && gB.h2Lines <= 2 && gB.h2Balance === "balance", JSON.stringify(gB));
  check("share iPhone: ve zprávě není emoji", noEmoji(await B2.innerText("#msg")));
  await ctxB2.close();

  // 2) Radka otevře odkaz ve WebKitu a přijme
  await B.goto(link);
  await B.waitForSelector("#bAccept", { timeout: 15000 });
  const intro = await B.locator(".tag").innerText();
  check("přijetí: Radka vidí, kdo ji vyzývá, o co a délku kola", intro.includes("Mark tě vyzývá") && intro.includes("kafe") && /sekání/.test(intro) && !/tří kol/.test(intro));
  check("přijetí: jméno předvyplněné", (await B.inputValue("#fName")) === "Radka");
  await shot(B, "iphone-3-prijeti");
  const C = await (await bA.newContext(DESK)).newPage(); watch("C", C);
  await C.goto(link); await C.waitForSelector("#bAccept"); await C.waitForTimeout(700); await shot(C, "desktop-3-prijeti"); await C.context().close();
  await B.click("#bAccept");
  await B.waitForSelector("#bReady", { timeout: 15000 });
  await A.locator("#bLobby").click({ timeout: 3000 }).catch(() => {}); // host se po přijetí přesune do lobby i sám
  await A.waitForSelector("#bReady:not([disabled])", { timeout: 15000 });
  check("lobby: oba u stánku", true);
  check("lobby: v HUD čas m:ss, mód a číslo souboje", (await A.locator("#timer").innerText()) === "0:15" && (await A.locator("#roundLabel").innerText()).toUpperCase() === "NA ČAS" && /souboj č\. 1/i.test(await A.locator("#ser").innerText()), await A.locator("#timer").innerText());
  check("HUD: žádné puntíky kol", (await A.locator("#dots").count()) === 0);

  let skews = [], latencies = [], sentTotal = 0, gotTotal = 0;
  async function playRound(label, shots) {
    await Promise.all([A.click("#bReady, #bNext"), B.click("#bReady, #bNext")]);
    await Promise.all([waitPhase(A, ["count", "play"]), waitPhase(B, ["count", "play"])]);
    const [la, lb] = await Promise.all([A.evaluate(() => __ovs.log.filter(e => e.ev === "countdown").pop()), B.evaluate(() => __ovs.log.filter(e => e.ev === "countdown").pop())]);
    const skew = Math.abs(la.at - lb.at); skews.push(skew);
    check(`${label}: synchronní start (rozdíl odpočtů < 600 ms)`, la.k === lb.k && skew < 600, `${skew} ms, K ${la.k}`);
    await Promise.all([waitPhase(A, "play", 8000), waitPhase(B, "play", 8000)]);
    const bots = Promise.all([bot(A, 20000), bot(B, 20000)]);
    await sleep(7000);
    const [sa, sb] = await Promise.all([st(A), st(B)]);
    const oppOk = sa.opp !== null && sb.opp !== null && Math.abs(sa.opp - sb.score) <= 8 && Math.abs(sb.opp - sa.score) <= 8;
    check(`${label}: živé skóre soupeře`, oppOk, `A ${sa.score} vidí B ${sa.opp} / B ${sb.score} vidí A ${sb.opp}`);
    const [tA, tB] = await Promise.all([A.locator("#timer").innerText(), B.locator("#timer").innerText()]);
    check(`${label}: časovač ve formátu m:ss`, /^0:\d\d$/.test(tA) && /^0:\d\d$/.test(tB), `${tA}/${tB}`);
    if (shots) { await shot(A, "desktop-4-hra", 0); await shot(B, "iphone-4-hra", 0); }
    // na B: sekání tahem nesmí scrollovat stránku ani zoomovat
    const sc = await B.evaluate(() => ({ y: scrollY, x: scrollX, top: document.scrollingElement.scrollTop, scale: window.visualViewport ? visualViewport.scale : 1 }));
    check(`${label}: iPhone stránka při tahu nescrolluje (scrollY 0, bez zoomu)`, sc.y === 0 && sc.x === 0 && sc.top === 0 && sc.scale === 1, JSON.stringify(sc));
    await bots;
    await Promise.all([waitPhase(A, "result", 20000), waitPhase(B, "result", 20000)]);
    const [ea, eb] = await Promise.all([st(A), st(B)]);
    sentTotal += ea.sent + eb.sent; gotTotal += ea.got + eb.got;
    check(`${label}: přesné řezy se počítají (__ovs.precise)`, (ea.precise + eb.precise) >= 1, `A ${ea.precise} B ${eb.precise}`);
    const [ha, hb] = await Promise.all([A.locator(".tag h2").innerText(), B.locator(".tag h2").innerText()]);
    check(`${label}: konec kola, vítěz souboje stejný na obou stranách`, ha === hb && /^(Souboj bere \S+|Remíza)$/.test(ha), `${ha} | skóre A ${ea.score} B ${eb.score}`);
    const sB = await B.evaluate(() => ({ y: scrollY, top: document.scrollingElement.scrollTop }));
    check(`${label}: iPhone po kole stále bez posunu stránky`, sB.y === 0 && sB.top === 0);
    const [logA, logB] = await Promise.all([A.evaluate(() => __ovs.log), B.evaluate(() => __ovs.log)]);
    for (const [snd, rcv] of [[logA, logB], [logB, logA]]) {
      const sends = snd.filter(e => e.ev === "send"), gots = rcv.filter(e => e.ev === "got");
      for (const g of gots) { const s = sends.filter(x => x.type === g.type && x.at <= g.at).pop(); if (s) latencies.push(g.at - s.at); }
    }
    await A.evaluate(() => __ovs.log.length = 0); await B.evaluate(() => __ovs.log.length = 0);
    return { ha, ea, eb };
  }

  const r1 = await playRound("Souboj 1", true);
  await shot(A, "desktop-5-vysledek"); await shot(B, "iphone-5-vysledek", 0);
  const fr = await fitDesk(A);
  check("desktop: výsledek bez scrollu a nad bednami", fr.sh <= fr.ch + 1 && fr.tagB <= fr.crates, JSON.stringify(fr));
  const hintOnResult = await B.evaluate(() => getComputedStyle(document.getElementById("iosHint")).display);
  check("iPhone: nápověda k ploše se na výsledku nezobrazuje (nezakrývá visačku)", hintOnResult === "none");
  const finA = await A.locator(".tag").innerText(), finB = await B.locator(".tag").innerText();
  check("výsledek: sázka a série souboje na obou stranách", /platí: kafe|zůstává ve hře/.test(finA) && /Odveta/.test(finA) && /série \d : \d|jedno kolo/i.test(await B.locator("#ser").innerText()));
  check("sabotáž: aspoň jeden naschvál doručen", gotTotal >= 1, `odesláno ${sentTotal}, doručeno ${gotTotal}`);
  check("sabotáž: doručeno nejvýš tolik, kolik odešlo", gotTotal <= sentTotal);
  if (latencies.length) {
    const avg = Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length);
    check("sabotáž: zpoždění doručení (včetně fronty 2,6 s mezi naschvály)", true, `průměr ${avg} ms, max ${Math.max(...latencies)} ms, n=${latencies.length}`);
  }

  // 3) odveta: K = 21 na obou, druhý souboj dohrát a porovnat sérii
  await Promise.all([A.click("#bNext"), B.click("#bNext")]);
  await Promise.all([waitPhase(A, ["count", "play"]), waitPhase(B, ["count", "play"])]);
  const [ra, rb] = await Promise.all([st(A), st(B)]);
  check("odveta: obě strany startují s K = 21", ra.K === 21 && rb.K === 21, `K ${ra.K}/${rb.K}`);
  check("odveta: HUD ukazuje mód a sérii", (await A.locator("#roundLabel").innerText()).toUpperCase() === "NA ČAS" && /série \d : \d/.test(await B.locator("#ser").innerText()), await B.locator("#ser").innerText());
  await Promise.all([waitPhase(A, "play", 8000), waitPhase(B, "play", 8000)]);
  await Promise.all([bot(A, 20000), bot(B, 20000)]);
  await Promise.all([waitPhase(A, "result", 20000), waitPhase(B, "result", 20000)]);
  const nums = t => (t.match(/(\d+) : (\d+)/) || []).slice(1).map(Number);
  const [nA, nB] = await Promise.all([A.locator("#ser").innerText(), B.locator("#ser").innerText()]);
  const sa = nums(nA), sb = nums(nB);
  check("série: po dvou soubojích stejná na obou stranách (z pohledu každého) a nejvýš 2 výhry", sa.length === 2 && sb.length === 2 && sa[0] === sb[1] && sa[1] === sb[0] && sa[0] + sa[1] <= 2, `A ${nA} / B ${nB}`);
  const hudSer = await A.locator("#ser").innerText();
  check("HUD: série v hodinách", /série \d : \d/.test(hudSer), hudSer);
  check("bez chyb v konzoli", errs.length === 0, errs.slice(0, 3).join(" | "));
  console.log(`\nskew odpočtu: ${skews.join(", ")} ms`);
  console.log(`${pass}/${pass + fail} PASS${fail ? `, ${fail} FAIL` : ""}`);
  await bA.close(); await bB.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
