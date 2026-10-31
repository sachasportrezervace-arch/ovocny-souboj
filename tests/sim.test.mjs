// node tests/sim.test.mjs – deterministický rozpis, sabotáže, počítání kol a série
import assert from "node:assert/strict";
import * as S from "../src/sim.js";
let n = 0; const t = (name, fn) => { fn(); n++; console.log("ok", name); };
t("stejné semínko = stejný rozpis", () => assert.deepEqual(S.schedule(42), S.schedule(42)));
t("jiné semínko = jiný rozpis", () => assert.notDeepEqual(S.schedule(1), S.schedule(2)));
t("rozpis má rozumnou hustotu a karamboly", () => {
  for (const sd of [1, 7, 99, 12345]) {
    const s = S.schedule(sd);
    const f = s.filter(i => S.FRUITS.includes(i.kind)).length, b = s.filter(i => i.kind === "bomba").length, k = s.filter(i => i.kind === "karambola").length;
    assert.ok(f >= 60 && f <= 140, "ovoce " + f); assert.ok(b >= 3 && b <= 25, "bomby " + b); assert.equal(k, 4);
    assert.ok(s.every(i => i.t >= 0 && i.t < S.ROUND_MS - 1500));
    assert.ok(s.filter(i => i.t < 7000).every(i => i.kind !== "bomba"), "první sekundy bez bomb");
  }
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
t("nejlepší ze 3 a remízová kola", () => {
  let m = S.matchState({ 11: 30, 12: 20 }, { 11: 25, 12: 28 }, 1);
  assert.equal(m.over, false); assert.equal(m.nextK, 13);
  m = S.matchState({ 11: 30, 12: 20, 13: 40 }, { 11: 25, 12: 28, 13: 39 }, 1);
  assert.equal(m.over, true); assert.equal(m.winner, "x"); assert.equal(m.nextK, 21);
  m = S.matchState({ 11: 10, 12: 10 }, { 11: 9, 12: 11 }, 1); assert.equal(m.nextK, 13);
  m = S.matchState({ 11: 5, 12: 5, 13: 5 }, { 11: 5, 12: 6, 13: 7 }, 1); assert.equal(m.winner, "o"); assert.equal(m.rounds.length, 3);
  m = S.matchState({ 11: 1 }, {}, 1); assert.equal(m.rounds.length, 0); assert.equal(m.nextK, 11);
});
t("série přes odvety", () => {
  const hx = { 11: 9, 12: 9, 21: 1, 22: 1 }, ho = { 11: 1, 12: 1, 21: 9, 22: 9, 23: 9 };
  assert.deepEqual(S.series(hx, ho), [1, 1]);
});
console.log(n + "/7 PASS");
