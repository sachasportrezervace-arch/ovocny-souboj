// node tests/sim.test.mjs – deterministický rozpis, sabotáže, počítání kol a série
import assert from "node:assert/strict";
import * as S from "../src/sim.js";
let n = 0; const t = (name, fn) => { fn(); n++; console.log("ok", name); };
t("stejné semínko = stejný rozpis", () => assert.deepEqual(S.schedule(42), S.schedule(42)));
t("jiné semínko = jiný rozpis", () => assert.notDeepEqual(S.schedule(1), S.schedule(2)));
t("rozpis má rozumnou hustotu, bomby jako koření a karamboly pro 60 i 120 s", () => {
  for (const ms of [60000, 120000]) for (const sd of [1, 7, 99, 12345]) {
    const s = S.schedule(sd, ms), k0 = ms / 60000;
    const f = s.filter(i => S.FRUITS.includes(i.kind)).length, b = s.filter(i => i.kind === "bomba").length, k = s.filter(i => i.kind === "karambola");
    assert.ok(f >= 60 * k0 && f <= 130 * k0, `ovoce ${f} (${ms})`); assert.ok(b >= 3 * k0 && b <= 14 * k0, `bomby ${b} (${ms})`);
    const share = b / s.length; assert.ok(share >= 0.05 && share <= 0.17, `podíl bomb ${(share * 100).toFixed(1)} % (${ms})`);
    assert.equal(k.length, Math.round(ms / 12000));
    assert.ok(k[0].t >= 4000 && k[0].t <= 5800, "první karambola v 4–6 s: " + k[0].t);
    assert.ok(k.every((x, i) => i === 0 || x.t - k[i - 1].t > 6000), "karamboly nejsou nalepené");
    assert.ok(s.every(i => i.t >= 0 && i.t < ms - 1500));
    assert.ok(s.filter(i => i.t < 6500).every(i => i.kind !== "bomba"), "první sekundy bez bomb");
  }
  const s = S.schedule(3, 15000); assert.equal(s.filter(i => i.kind === "karambola").length, 1);
});
t("náběh: poslední čtvrtina je výrazně hustší než první, občas vlna 4–6 kusů, naráz nejvýš ~13 kusů", () => {
  for (const ms of [60000, 120000]) for (const sd of [1, 7, 99, 12345]) {
    const s = S.schedule(sd, ms), q = [0, 0, 0, 0];
    s.forEach(i => q[Math.min(3, Math.floor(i.t / ms * 4))]++);
    assert.ok(q[3] >= q[0] * 1.5, `čtvrtiny ${q} (${ms}, ${sd})`);
    let waves = 0;
    for (let i = 0; i < s.length; i++) { let j = i; while (j + 1 < s.length && s[j + 1].t - s[i].t < 450) j++; if (j - i >= 3) { waves++; i = j; } }
    assert.ok(waves >= ms / 60000, `vlny 4+: ${waves} (${ms}, ${sd})`);
    let max = 0;
    for (let t = 0; t < ms; t += 100) { let n = 0; for (const it of s) if (it.t <= t && t < it.t + S.flightTime(it) * 1000 && S.posAt(it, (t - it.t) / 1000).y > -10) n++; max = Math.max(max, n); }
    assert.ok(max <= 13, `naráz ${max} (${ms}, ${sd})`);
  }
});
t("přesný řez a měřič naschválu", () => {
  assert.equal(S.POINTS.precise, 2); assert.equal(S.PRECISE_R, 0.25);
  assert.ok(S.CHARGE.precise > S.CHARGE.cut && S.CHARGE.karambola > S.CHARGE.precise && S.CHARGE.karambola < S.CHARGE_MAX);
  assert.deepEqual([...S.FIRE_ORDER].sort(), ["bomba", "mraz", "smouha"]);
});
t("ovoce vyletí do zorného pole a spadne", () => {
  for (const it of S.schedule(5)) {
    const top = S.posAt(it, S.vy0(it.apex) / S.G);
    assert.ok(Math.abs(top.y - it.apex) < 1e-6);
    assert.ok(Math.abs(top.x) < 1.3);
    assert.ok(S.flightTime(it) > 2 && S.flightTime(it) < 4.5);
  }
});
t("sabotáže", () => {
  assert.equal(S.sabotageFor(2, "jablko"), null); assert.equal(S.sabotageFor(3), "smouha");
  assert.equal(S.sabotageFor(5), "mraz"); assert.equal(S.sabotageFor(1, "karambola"), "bomba");
});
t("jedno kolo: vyšší skóre vyhrává, stejné = remíza", () => {
  let m = S.matchState({ 11: 52 }, { 11: 47 }, 1);
  assert.equal(m.over, true); assert.equal(m.winner, "x"); assert.equal(m.nextK, 21); assert.equal(m.rounds.length, 1);
  m = S.matchState({ 21: 5 }, { 21: 9 }, 2); assert.equal(m.winner, "o"); assert.equal(m.nextK, 31);
  m = S.matchState({ 11: 8 }, { 11: 8 }, 1); assert.equal(m.over, true); assert.equal(m.winner, null); assert.equal(m.nextK, 21);
  m = S.matchState({ 11: 1 }, {}, 1); assert.equal(m.over, false); assert.equal(m.rounds.length, 0); assert.equal(m.nextK, 11);
});
t("série přes odvety", () => {
  const hx = { 11: 9, 21: 1, 31: 5 }, ho = { 11: 1, 21: 9, 31: 5, 41: 3 };
  assert.deepEqual(S.series(hx, ho), [1, 1]);
});
t("módy: závod = kdo dřív v cíli, tři životy = kdo vydrží déle, jinak skóre", () => {
  assert.equal(S.winnerOf("cas", 10, 12), "o");
  assert.equal(S.winnerOf("zavod", 30, 50, undefined, 41000), "o");          // jen o v cíli
  assert.equal(S.winnerOf("zavod", 52, 50, 40100, 40300), "x");              // oba v cíli v okně zpoždění: rychlejší čas
  assert.equal(S.winnerOf("zavod", 20, 31), "o");                            // cíl nikdo nedal: skóre
  assert.equal(S.winnerOf("zivoty", 80, 20, 30000, 45000), "o");             // o vydržel déle, i když má méně bodů
  assert.equal(S.winnerOf("zivoty", 10, 40, undefined, 61000), "x");         // x přežil (undefined = celé kolo)
  assert.equal(S.winnerOf("zivoty", 33, 33), null);                          // oba přežili, stejné skóre = remíza
  assert.equal(S.modeOf("nesmysl"), "cas"); assert.equal(S.lengthFor("zavod"), S.RACE_MS); assert.equal(S.lengthFor("cas", 60000), 60000);
});
t("série a souboj podle módu odehraného kola (mh), staré souboje bez mh = na čas", () => {
  const hx = { 11: 40, 21: 30, 31: 9 }, ho = { 11: 35, 21: 50, 31: 60 };
  const ex = { mh: { 21: "zavod", 31: "zivoty" }, fx: { 31: 70000 }, fo: { 21: 38000, 31: 12000 } };
  assert.equal(S.matchState(hx, ho, 1, ex).winner, "x");
  const m2 = S.matchState(hx, ho, 2, ex); assert.equal(m2.md, "zavod"); assert.equal(m2.winner, "o");
  const m3 = S.matchState(hx, ho, 3, ex); assert.equal(m3.md, "zivoty"); assert.equal(m3.winner, "x");
  assert.deepEqual(S.series(hx, ho, ex), [2, 1]);
  assert.deepEqual(S.series(hx, ho), [1, 2]);
});
t("rozpis závodu (90 s) a tří životů (120 s): cíl je na dosah zhruba v půlce, tempo roste", () => {
  for (const sd of [1, 7, 99]) {
    const z = S.schedule(sd, S.RACE_MS), first45 = z.filter(i => i.t < 45000 && i.kind !== "bomba");
    assert.ok(first45.length >= S.TARGET * 0.8 && first45.length <= S.TARGET * 1.6, `závod: kusů do 45 s ${first45.length}`);
    const l = S.schedule(sd, S.LIFE_MS), a = l.filter(i => i.t < 30000).length, b = l.filter(i => i.t >= 90000).length;
    assert.ok(b >= a * 1.7, `tři životy (rozestup bomb občas vyřadí ovoce): zrychlení ${a} -> ${b}`);
  }
});
// ---------- rozmanitost, finále, kolize (docs/mody.md) ----------
const SEEDS = [1, 7, 99, 12345, 777, 31337];
t("modifikátor a deska ze semínka: stejné semínko = totéž, všechny druhy se objeví, další kolo je jiné", () => {
  for (const sd of SEEDS) { assert.equal(S.modOf(sd), S.modOf(sd)); assert.equal(S.themeOf(sd), S.themeOf(sd)); }
  const mods = new Set(), themes = new Set();
  for (let sd = 1; sd < 400; sd++) { mods.add(S.modOf(sd)); themes.add(S.themeOf(sd)); }
  assert.equal(mods.size, S.MODS.length); assert.equal(themes.size, S.THEMES.length);
  let prev = 0, seq = [];
  const rnd = S.rng(5);
  for (let i = 0; i < 200; i++) { const sd = S.pickSeed(prev, rnd); if (prev) { assert.notEqual(S.modOf(sd), S.modOf(prev)); assert.notEqual(S.themeOf(sd), S.themeOf(prev)); } prev = sd; seq.push(sd); }
});
t("rozpis kola je pro oba hráče stejný a nese svůj modifikátor", () => {
  for (const md of ["cas", "zavod", "zivoty"]) for (const sd of SEEDS) {
    const ms = S.lengthFor(md, 120000);
    assert.deepEqual(S.roundSchedule(sd, ms, md), S.roundSchedule(sd, ms, md));
  }
  const find = mod => { for (let sd = 1; sd < 200; sd++) if (S.modOf(sd) === mod) return sd; };
  for (const ms of [60000, 120000]) {
    const base = sd => S.schedule(sd, ms), hasFin = S.hasFinale("cas", ms);
    const sdZ = find("zlate"), sdO = find("obri"), sdR = find("rady"), sdM = find("mesic");
    const z = S.roundSchedule(sdZ, ms, "cas"), o = S.roundSchedule(sdO, ms, "cas"), r = S.roundSchedule(sdR, ms, "cas"), m = S.roundSchedule(sdM, ms, "cas");
    const gold = z.filter(i => i.kind === "zlate" && !i.fin).length;
    assert.ok(gold >= 3 && gold <= 10, `zlatých ${gold} (${ms})`);
    const giants = o.filter(i => i.hp);
    assert.ok(giants.length >= 2 && giants.every(g => g.kind === "meloun" && g.hp === 4 && g.big > 1.5 && Math.abs(g.u) <= 0.36), `obří ${giants.length}`);
    assert.ok(S.flightTime(giants[0]) > 2.5);
    assert.ok(m.every(i => i.fin || i.gm === 0.62) && m.filter(i => i.gm === 0.62).length > 40, "měsíční tíže");
    assert.ok(S.flightTime({ apex: 5, gm: 0.62 }) > S.flightTime({ apex: 5 }) * 1.2);
    // opony: řady 5–6 kusů za sebou (do 450 ms)
    let curtains = 0; const fr = r.filter(i => S.FRUITS.includes(i.kind) && !i.fin);
    for (let i = 0; i < fr.length; i++) { let j = i; while (j + 1 < fr.length && fr[j + 1].t - fr[i].t < 450) j++; if (j - i >= 4) { curtains++; i = j; } }
    assert.ok(curtains >= Math.round(ms / 9000) - 2, `opon ${curtains} (${ms})`);
    for (const x of [z, o, r, m]) assert.ok(x.every(i => i.t >= 0 && i.t < ms - 1000) && x.every((i, k) => i.id === k && (k === 0 || x[k - 1].t <= i.t)));
    assert.ok(hasFin || !z.some(i => i.fin));
  }
});
t("finále: jen kolo na čas ≥ 45 s, posledních ~8,6 s, bez bomb, vlny 4 + 7×5, stejné pro oba, body navíc", () => {
  assert.equal(S.hasFinale("cas", 120000), true); assert.equal(S.hasFinale("cas", 60000), true); assert.equal(S.hasFinale("cas", 15000), false);
  assert.equal(S.hasFinale("zavod", 90000), false); assert.equal(S.hasFinale("zivoty", 120000), false);
  for (const sd of SEEDS) for (const ms of [60000, 120000]) {
    const s = S.roundSchedule(sd, ms, "cas"), F0 = S.finaleStart(ms), fin = s.filter(i => i.fin);
    assert.equal(fin.length, 39, "8 vln: 4 + 7 × 5 kusů");
    assert.ok(fin.every(i => i.t >= F0 && i.t < ms - 1500 && ["pomeranc", "svestka", "citron", "jablko", "kiwi", "zlate"].includes(i.kind)));
    assert.ok(fin[0].gm === 0.65 && fin.slice(4).every(i => i.gm === 1), "první vlna pomalu, další běžně");
    assert.ok(s.filter(i => i.kind === "bomba").every(i => i.t + S.flightTime(i) * 1000 < F0 + 50), "žádná bomba nedoletí do finále");
    assert.ok(s.filter(i => i.t >= F0 && i.kind !== "karambola").every(i => i.fin), "ve finále jen finálové kusy (a karambola)");
    assert.ok(S.POINTS.finale >= 2 && S.POINTS.zlate > S.POINTS.finale);
    let max = 0;
    for (let tt = F0; tt < ms; tt += 100) { let n = 0; for (const it of s) if (it.t <= tt && tt < it.t + S.flightTime(it) * 1000 && S.posAt(it, (tt - it.t) / 1000).y > -10) n++; max = Math.max(max, n); }
    assert.ok(max <= 20, `naráz ve finále ${max}`);
  }
});
t("bomba není schovaná za ovocem ani těsně vedle něj (rozestup, bomby jako koření zůstávají)", () => {
  for (const ms of [60000, 120000]) for (const sd of SEEDS) {
    let s = S.schedule(sd, ms);
    const bombs = s.filter(i => i.kind === "bomba");
    assert.ok(bombs.length >= 3 * ms / 60000, `bomby ${bombs.length}`);
    for (const b of bombs) for (const o of s) if (o !== b) assert.ok(S.gapRatio(b, o) >= S.CLEAR - 1e-9 || (o.kind === "bomba" || o.kind === "karambola"), `bomba ${b.t} u ${b.u.toFixed(2)} × ${o.kind} ${o.t}: ${S.gapRatio(b, o).toFixed(2)}`);
    for (const b of bombs) for (const o of s) if (o !== b && (o.kind === "bomba" || o.kind === "karambola")) assert.ok(S.gapRatio(b, o) >= S.CLEAR - 1e-9, "i bomba × bomba/karambola");
  }
  // opony a finále: i po použití modifikátoru
  for (const sd of SEEDS) { const s = S.roundSchedule(sd, 60000, "cas"); for (const b of s.filter(i => i.kind === "bomba")) for (const o of s) if (o !== b) assert.ok(S.gapRatio(b, o) >= S.CLEAR - 1e-9, `kolo ${sd}: bomba × ${o.kind}`); }
  // bomba z naschválu si vybere dráhu s největším rozestupem
  const sch = S.schedule(99, 60000), sb = S.sabotageBomb(sch, 20000, S.rng(3));
  assert.ok(sb.kind === "bomba" && Math.abs(sb.u) <= 0.6);
});
t("pohyblivá koule: rychlý švih ani uletělé ovoce se nepřeskočí", () => {
  // čepel 400 px za jeden snímek přes ovoce o poloměru 40 px, které mezi tím uletí o 60 px
  assert.ok(S.sweptDist(100, 300, 500, 300, 300, 330, 300, 330) < 40, "stojící koule, jedna dlouhá úsečka");
  // ovoce přelétne čepel mezi snímky: na začátku nad ní, na konci pod ní (statický test na obou koncích by minul)
  const d = S.sweptDist(250, 300, 350, 300, 300, 240, 300, 360);
  assert.ok(d < 5, `pohyblivá ${d}`);
  assert.ok(Math.min(Math.hypot(250 - 300, 300 - 240), Math.hypot(350 - 300, 300 - 360)) > 60, "bez pohybu by minula");
  assert.ok(S.sweptDist(100, 100, 150, 100, 400, 400, 400, 420) > 250);
  assert.ok(S.hitRadius("meloun", 40) > 40 * 1.15 + 6, "ovoce štědřejší než dřív (1,15 r + 6)");
  assert.equal(S.hitRadius("bomba", 40), 24);
  assert.ok(S.hitRadius("bomba", 40) < S.hitRadius("jablko", 40) * 0.5);
});
t("dohánění: zapíná se při odstupu 10 bodů, vypíná pod 5, nebliká při zpoždění 0,5 s", () => {
  assert.equal(S.boostNext(false, "cas", 20, 29), false); assert.equal(S.boostNext(false, "cas", 20, 30), true);
  assert.equal(S.boostNext(true, "cas", 20, 26), true); assert.equal(S.boostNext(true, "cas", 20, 24), false);
  assert.equal(S.boostNext(false, "zivoty", 90, 10, 2, 3), true); assert.equal(S.boostNext(true, "zivoty", 10, 90, 3, 3), false);
  // dva hráči, soupeř vidím o 0,5 s starý; počítá se, kolikrát se stav přepne
  for (const [rA, rB] of [[3, 1], [2.5, 2.5], [4, 3], [1, 4]]) {
    const A = t => Math.floor(rA * t + 2 * Math.sin(t * 3)), B = t => Math.floor(rB * t + 2 * Math.sin(t * 2.1 + 1));
    let on = false, flips = 0;
    for (let t = 0; t < 60; t += 0.1) { const n = S.boostNext(on, "cas", A(t), B(Math.max(0, t - 0.5))); if (n !== on) flips++; on = n; }
    assert.ok(flips <= 2, `přepnutí ${flips} (${rA}/${rB})`);
  }
  assert.equal(S.BOOST.mul, 2);
});
t("čepel podle výher v sérii", () => {
  assert.deepEqual([0, 1, 2, 3, 4, 9].map(S.bladeTier), [0, 1, 2, 3, 4, 4]);
  assert.equal(S.BLADES.length, 5);
});
console.log(n + "/" + n + " PASS");
