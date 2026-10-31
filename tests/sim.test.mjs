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
    const share = b / s.length; assert.ok(share >= 0.05 && share <= 0.15, `podíl bomb ${(share * 100).toFixed(1)} % (${ms})`);
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
console.log(n + "/" + n + " PASS");
