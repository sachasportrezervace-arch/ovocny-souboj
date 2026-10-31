// Playtest sólo režimu „Zkusit sám“: A = Chromium desktop 1440×900 (adresa #solo), B = WebKit iPhone 13 na výšku (tlačítko „Zkusit sám“).
// Ověřuje: celé kolo proti botovi (živé skóre soupeře na cedulce, výsledek, odveta „Znovu“, jiný mód, tři životy), naschvály oběma směry,
// ŽÁDNÝ síťový požadavek na mantledb (požadavky se zachytávají a zahazují), žádný zápis série/čepele/místnosti do localStorage,
// přechod „Vyzvat soupeře“ do normální výzvy a chyby v konzoli.
// node tests/solo.cjs [URL]   (výchozí http://127.0.0.1:8801/)
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
const oppCells = async p => +(await p.locator("#cellsOpp").innerText()).replace(/\s/g, "");

// bot hráče jako v tests/mody.cjs: krátké tahy přes viditelné ovoce, bomby obchází, nezačíná mimo displej
async function botStep(p, vp) {
  const t = (await p.evaluate(() => __ovs.targets())).filter(o => o.y > 150 && o.y < vp.height - 60 && o.x > 10 && o.x < vp.width - 10);
  const bombs = t.filter(o => o.kind === "bomba");
  const pick = t.filter(o => o.kind !== "bomba" && bombs.every(b => Math.hypot(b.x - o.x, b.y - o.y) > b.r + 70)).sort((a, b) => a.x - b.x);
  if (!pick.length) return;
  pick.splice(6);
  const pts = [], cx = x => Math.max(4, Math.min(vp.width - 4, x));
  for (const f of pick) { const off = (Math.random() - 0.5) * f.r * 1.2; pts.push([cx(f.x - f.r * 1.4), f.y + off - 4], [cx(f.x + f.r * 1.4), f.y + off + 4]); if (f.ice) pts.push([cx(f.x - f.r * 1.4), f.y + off + 8], [cx(f.x + f.r * 1.4), f.y + off - 8]); }
  await p.mouse.move(pts[0][0], pts[0][1]); await p.mouse.down();
  for (const [x, y] of pts.slice(1)) await p.mouse.move(x, y, { steps: 3 });
  await p.mouse.up();
}
// hraje, dokud kolo běží; vrací průběh živého skóre soupeře (cedulka) a největší počet dotazů na bota
async function play(p, { idle = false, shotAt = 0, shotName = "" } = {}) {
  const vp = p.viewportSize(), t0 = Date.now(), seen = []; let shot = false;
  for (;;) {
    const s = await st(p);
    if (s.phase !== "play") { if (s.phase === "wait" || s.phase === "result") break; await sleep(80); continue; }
    if (shotAt && !shot && Date.now() - t0 > shotAt) { shot = true; await snap(p, shotName); }
    seen.push(await oppCells(p));
    if (!idle) await botStep(p, vp);
    await sleep(idle ? 400 : 140);
  }
  return seen;
}
const resultOf = async p => {
  await waitPhase(p, "result", 20000);
  const head = await p.innerText(".tag h2"), vs = (await p.innerText(".vs")).replace(/\n/g, " "), e = await lastEnd(p);
  return { head, vs, e, s: await st(p) };
};
const clickChip = async (p, c) => { await p.click(`#modeChips button[data-c=${c}]`); await sleep(120); };

async function run(label, browserType, ctxOpts, enter) {
  const b = await browserType.launch(), ctx = await b.newContext(ctxOpts), p = await ctx.newPage();
  const tag = label + ": ", net = [], errs = [];
  // nic nesmí jít do mantledb: požadavky se zachytí a zahodí (bez nich by se ostrá hra nerozjela)
  await ctx.route(/mantledb/, r => { net.push(r.request().url()); r.abort(); });
  p.on("pageerror", e => errs.push(label + ": " + e.message));
  p.on("console", m => m.type() === "error" && !/Failed to load resource|net::ERR/.test(m.text()) && errs.push(label + " console: " + m.text().slice(0, 160)));
  const out = {};
  const dev = label === "B" ? "iphone" : "desktop";

  // --- vstup ---
  await enter(p);
  await p.waitForSelector("#bReady", { timeout: 15000 }); await sleep(900);
  const h2 = await p.innerText(".tag h2");
  check(tag + "sólo lobby: nadpis Trénink, soupeř Kuchtík, ‘trénink’ v hodinách", /Trénink/.test(h2) && (await p.innerText("#nameOpp")) === "Kuchtík" && /trénink/i.test(await p.innerText("#ser")), `${h2} | ${await p.innerText("#nameOpp")} | ${await p.innerText("#ser")}`);
  check(tag + "adresa má #solo, žádná místnost", /#solo$/.test(p.url()) && (await st(p)).solo === true);
  check(tag + "lobby: čtyři čipy módu a tlačítko Vyzvat soupeře", (await p.locator("#modeChips button").count()) === 4 && (await p.locator("#bChallenge").count()) === 1);
  await snap(p, `solo-${dev}-lobby`);

  // --- 1) kolo na čas (45 s s finále), hraje hráč i bot ---
  await p.click("#bReady");
  await waitPhase(p, "count");
  await snap(p, `solo-${dev}-odpocet`);
  await waitPhase(p, "play", 15000);
  const t1 = Date.now();
  const seen1 = await play(p, { shotAt: 9000, shotName: `solo-${dev}-hra` });
  const r1 = await resultOf(p);
  const maxOpp = Math.max(...seen1), grew = seen1.filter((v, i) => i && v > seen1[i - 1]).length;
  check(tag + "kolo na čas proběhlo celé (~45 s)", Date.now() - t1 > 40000 && r1.e.why === "cas", `${Date.now() - t1} ms, ${r1.e.why}`);
  check(tag + "živé skóre soupeře na cedulce roste postupně", maxOpp > 15 && grew >= 6, `max ${maxOpp}, kroků ${grew}`);
  check(tag + "výsledek: vítěz nebo remíza, obě skóre číselně", /^(Vyhráváš!|Vyhrává Kuchtík|Remíza)$/.test(r1.head) && /\d+.*:.*\d+|\d+\s+\d+/.test(r1.vs), `${r1.head} | ${r1.vs}`);
  check(tag + "výsledek: v sólu žádné „chce odvetu“ ani „Souboj bere Ty“", !/chce odvetu|bere Ty/.test(r1.vs + r1.head), `${r1.head} | ${r1.vs}`);
  check(tag + "výsledek: skóre soupeře odpovídá cedulce a botu", r1.s.bot.score === (await oppCells(p)) && r1.s.opp === r1.s.bot.score, JSON.stringify(r1.s.bot));
  check(tag + "výsledek: Znovu, Vyzvat soupeře, žádné sdílení do chatu ani série", (await p.innerText("#bNext")) === "Znovu" && (await p.locator("#bChallenge").count()) === 1 && (await p.locator("#bShareRes").count()) === 0 && /trénink/i.test(await p.innerText("#ser")));
  check(tag + "výsledek: bez čepele za výhry (nic se nepočítá do kosmetiky)", (await p.locator(".vs .bl").count()) === 0);
  out.sent = r1.s.sent; out.got = r1.s.got; out.botSent = r1.s.bot.sent; out.botGot = r1.s.bot.got;
  const mods = [r1.s.mod], themes = [r1.s.theme];
  await sleep(700); await snap(p, `solo-${dev}-vysledek`);

  // --- 2) Znovu v módu Do 12 (závod): jiné kolo, rozhoduje cíl ---
  await clickChip(p, "zavod");
  check(tag + "výsledek: mód lze přepnout (Do cíle)", (await p.getAttribute("#modeChips button[data-c=zavod]", "aria-pressed")) === "true");
  await p.click("#bNext");
  await waitPhase(p, "play", 15000);
  const s2 = await st(p);
  check(tag + "Znovu: nové kolo v závodu, jiná zvláštnost nebo deska než minule", s2.md === "zavod" && (s2.mod !== mods[0] && s2.theme !== themes[0]), `${s2.mod}/${s2.theme} vs ${mods[0]}/${themes[0]}`);
  mods.push(s2.mod); themes.push(s2.theme);
  await play(p);
  const r2 = await resultOf(p);
  check(tag + "závod: skončil cílem (kdokoli) a vítěz sedí s časem v cíli", ["cil", "opp"].includes(r2.e.why) && /v cíli za \d:\d\d/.test(r2.vs), `${r2.e.why} | ${r2.vs}`);
  out.sent += r2.s.sent; out.got += r2.s.got; out.botSent += r2.s.bot.sent; out.botGot += r2.s.bot.got;
  await sleep(1100); await snap(p, `solo-${dev}-vysledek-zavod`);   // po doznění nápisu „Konec!“

  // --- 3) tři životy: hráč nesekne nic, bot to vydrží déle ---
  await clickChip(p, "zivoty");
  await p.click("#bNext");
  await waitPhase(p, "play", 15000);
  const s3 = await st(p);
  check(tag + "tři životy: kolo běží, hráč 3 životy", s3.md === "zivoty" && s3.lives === 3);
  await play(p, { idle: true });
  const r3 = await resultOf(p);
  check(tag + "tři životy: hráči došly životy, bot to vydržel déle, vítěz Kuchtík", r3.e.why === "mrtvy" && r3.head === "Vyhrává Kuchtík" && r3.s.bot.lives >= 1, `${r3.e.why} | ${r3.head} | bot životy ${r3.s.bot.lives}`);
  await sleep(1100); await snap(p, `solo-${dev}-vysledek-zivoty`);   // po doznění nápisu „Konec!“

  // --- síť, úložiště ---
  check(tag + "žádný síťový požadavek na mantledb za celé sólo", net.length === 0, `${net.length} požadavků ${net.slice(0, 2).join(" ")}`);
  const keys = await p.evaluate(() => Object.keys(localStorage));
  check(tag + "do úložiště nezapsáno nic o místnosti, sérii ani čepeli", !keys.some(k => /^ovs-(seat|wins|seen)-/.test(k)), keys.join(","));
  check(tag + "naschvály oběma směry (hráč poslal, dostal; bot poslal, dostal)", out.sent >= 1 && out.got >= 1 && out.botSent >= 1 && out.botGot >= 1, JSON.stringify(out));

  // --- 4) Vyzvat soupeře: návrat do normální výzvy, ta pak funguje ---
  await p.click("#bChallenge");
  await p.waitForSelector("#bCreate", { timeout: 5000 });
  check(tag + "Vyzvat soupeře: zpět na zakládací visačku, adresa bez #solo, HUD pryč", !/#solo/.test(p.url()) && (await p.locator("#hud").isHidden()) && (await p.locator("#bSolo").count()) === 1);
  await sleep(900); await snap(p, `solo-${dev}-setup-po-navratu`);   // po doznění zavěšení visačky
  // normální výzva po sólu (jediné, co smí na mantledb): s odpojenou sítí vznikne chyba spojení, ne pád; odpojení sítě je přesně to, co ověřujeme
  await p.fill("#fMe", "Mark"); await p.fill("#fOpp", "Radka"); await p.click("#bCreate");
  await sleep(1500);
  check(tag + "po sólu jde založit výzvu (zkouší síť, nespadne)", net.length >= 1 && (await p.locator("#bCreate").count()) === 1, `${net.length} požadavků`);
  check(tag + "bez chyb v konzoli", errs.length === 0, errs.slice(0, 3).join(" | "));
  await b.close();
}

(async () => {
  const enterA = async p => { await p.goto(BASE + "?kolo=45&cil=12#solo"); };
  const enterB = async p => {
    await p.goto(BASE + "?kolo=45&cil=12");
    await p.waitForSelector("#bSolo"); await sleep(900);
    check("B: zakládací visačka má tlačítko Zkusit sám vedle Připravit výzvu", (await p.innerText("#bSolo")) === "Zkusit sám" && (await p.locator("#bCreate").count()) === 1);
    await p.fill("#fMe", "Radka");
    await p.click("#bSolo");
  };
  // WebKit iPhone: deviceScaleFactor 1, headless bez GPU na @3× kreslí jen ~6 snímků/s (viz tests/mody.cjs)
  await Promise.all([
    run("A", chromium, { viewport: { width: 1440, height: 900 } }, enterA),
    run("B", webkit, { ...devices["iPhone 13"], deviceScaleFactor: 1 }, enterB),
  ]);
  console.log(`${pass}/${pass + fail} PASS${fail ? `, ${fail} FAIL` : ""}`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
