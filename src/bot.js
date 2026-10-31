// Ovocný souboj – soupeř pro sólo režim „Zkusit sám“ (Kuchtík). Čistá logika bez DOM a bez sítě, takže jde testovat v Node.
// Bot hraje stejný rozpis kola jako hráč (Sim.roundSchedule): ke každému kusu si vybere okamžik, kdy po něm „švihne“, a podle své
// obratnosti ho trefí nebo mine. Strhne combo, nabíjí měřič, posílá naschvály (jeho výstup `ev` má stejný tvar jako dokument
// skutečného hráče) a naschvály od hráče na něj působí: šmouha zhorší míření, mráz chce dva řezy, bomba se mu občas stane osudnou.
// Obtížnost je záměrně lidská: míří na 50–68 % ovoce (podle semínka), ve třech životech dělá chyby tím častěji, čím je tempo rychlejší,
// a kdo vede, tomu se bot o chlup zlepší (a naopak), ať je souboj těsný a jde ho vyhrát i prohrát.
import * as Sim from "./sim.js";

export const BOT_NAME = "Kuchtík", BOT_DAT = "Kuchtíkovi";   // jméno a 3. pád („proti Kuchtíkovi“)
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const STROKE_GAP = 300, STROKE_END = 380, SEND_GAP = 2500;

// seed = semínko kola (jiné pro každé kolo), skill 0…1 (výchozí ze semínka)
export function createBot({ sched, md = "cas", rl = Sim.ROUND_MS, tg = Sim.TARGET, seed = 1, skill }) {
  const r = Sim.rng((seed >>> 0) ^ 0x6B07C0DE);
  const sk = skill == null ? r() : skill;
  const pBase = 0.50 + 0.18 * sk;                 // šance trefit kus v módech na body
  const missBase = 0.062 - 0.03 * sk;             // šance minout kus ve třech životech (roste s tempem)
  const finAt = Sim.hasFinale(md, rl) ? Sim.finaleStart(rl) : Infinity;
  const st = { score: 0, lives: Sim.LIVES, charge: 0, fireN: 0, ev: [], fin: null, sent: 0, got: 0, cuts: 0, bombs: 0, precise: 0, boost: false, sk };
  let lastSend = -1e9, smearUntil = 0, frozen = 0, stroke = null, qi = 0, me = { score: 0, lives: Sim.LIVES };
  const giants = new Map();

  // plán švihů: kusy vyhozené krátce po sobě se berou jedním tahem (společný okamžik), bomba se nemusí stihnout obejít
  const q = [];
  let grpT = -1e9, grpF = 0.7;
  for (const it of [...sched].sort((a, b) => a.t - b.t || a.id - b.id)) {
    if (it.t - grpT > 450) { grpT = it.t; grpF = 0.6 + 0.3 * r(); }
    const up = Sim.vy0(it.apex, it.gm || 1) / (Sim.G * (it.gm || 1)) * 1000;   // ms do vrcholu
    const at = it.t + up * grpF + r() * 60;
    if (it.hp) for (let j = 0; j < it.hp; j++) q.push({ at: at + j * 230, k: "try", it, giant: true });
    else q.push({ at, k: it.kind === "bomba" ? "bomb" : "try", it });
  }
  q.sort((a, b) => a.at - b.at);
  const put = e => { let i = q.length; while (i > qi && q[i - 1].at > e.at) i--; q.splice(i, 0, e); };

  const over = () => st.fin != null;
  function done(at) { if (st.fin == null) st.fin = Math.round(at); closeStroke(at); }
  function add(n, at) {
    st.score = Math.max(0, st.score + n);
    if (md === "zavod" && st.fin == null && st.score >= tg) done(at);
  }
  function lose(at) {
    if (md !== "zivoty" || over()) return;
    st.lives = Math.max(0, st.lives - 1);
    if (!st.lives) done(at);
  }
  function charge(n, at) {
    st.charge = Math.min(Sim.CHARGE_MAX, st.charge + n * (st.boost ? Sim.BOOST.mul : 1));
    fire(at);
  }
  function send(type, at, force) {
    if (at >= finAt || (!force && at - lastSend < SEND_GAP)) return false;
    lastSend = at; st.sent++; st.ev = [...st.ev, [st.ev.length, type, Math.round(at)]];
    return true;
  }
  function fire(at) {
    if (st.charge < Sim.CHARGE_MAX || at - lastSend < SEND_GAP) return;
    if (send(Sim.FIRE_ORDER[st.fireN % 3], at)) { st.fireN++; st.charge = 0; }
  }
  function closeStroke(at) {
    const s = stroke; stroke = null;
    if (!s) return;
    if (s.n >= 3) { add(Sim.comboBonus(s.n), at); const t = Sim.sabotageFor(s.n, null); if (t) send(t, at); }
  }
  function swing(at, counts) {
    if (!counts) return;
    if (stroke && at - stroke.last <= STROKE_GAP) { stroke.n++; stroke.last = at; }
    else { closeStroke(stroke ? stroke.last + STROKE_END : at); stroke = { n: 1, last: at }; }
  }
  // míra přesnosti v daný okamžik: šmouha ji sráží, vedoucí bot se o kousek zhorší, zaostávající zlepší
  function pHit(at) {
    const gap = clamp((me.score - st.score) / 25, -1, 1);
    let p = pBase + gap * 0.06;
    if (at < smearUntil) p *= 0.5;
    return clamp(p, 0.15, 0.93);
  }
  function pMiss(at) {
    const prog = clamp(at / 75000, 0, 1);                    // tempo ve třech životech pořád roste
    let m = missBase * (0.7 + 1.9 * prog);
    m *= 1 + 0.3 * clamp(st.lives - me.lives, -1, 1);
    if (at < smearUntil) m *= 2.2;
    return clamp(m, 0.01, 0.5);
  }

  function handle(e) {
    const at = e.at;
    if (e.k === "bomb") {
      if (r() < (at < smearUntil ? 0.14 : 0.05)) hitBomb(at);
    } else if (e.k === "hurt") {
      if (r() < (at < smearUntil ? 0.34 : 0.2)) hitBomb(at);   // naschvální bomba navíc
    } else if (e.k === "fall") {
      lose(at);
    } else if (e.k === "in") {
      st.got++;
      if (e.type === "smouha") smearUntil = at + 2800;
      else if (e.type === "mraz") frozen = 2;
      else put({ at: at + 700, k: "hurt" });
    } else {
      try_(e);
    }
  }
  function hitBomb(at) {
    st.bombs++; closeStroke(at);
    if (md === "zivoty") lose(at); else add(Sim.POINTS.bomba, at);
  }
  function try_(e) {
    const it = e.it, at = e.at, fruit = Sim.FRUITS.includes(it.kind) && !it.hp;
    let p = md === "zivoty" ? 1 - pMiss(at) : pHit(at);
    if (it.kind === "karambola") p *= 0.86;
    const ice = fruit && frozen > 0;
    if (ice) { frozen--; p *= 0.62; }
    const ok = r() < p;
    if (!ok) {
      if (fruit && md === "zivoty") put({ at: it.t + Sim.flightTime(it) * 1000, k: "fall" });
      return;
    }
    st.cuts++;
    if (e.giant) {                                   // obří meloun: každý řez bod, poslední +6
      const left = (giants.get(it.id) ?? it.hp) - 1; giants.set(it.id, left);
      add(left ? Sim.POINTS.fruit : Sim.POINTS.fruit + Sim.POINTS.zlate, at); charge(Sim.CHARGE.obri, at); swing(at, false);
      return;
    }
    const pts = it.kind === "karambola" ? Sim.POINTS.karambola : it.kind === "zlate" ? Sim.POINTS.zlate : ice ? Sim.POINTS.frozen : it.fin ? Sim.POINTS.finale : Sim.POINTS.fruit;
    add(pts, at);
    charge(it.kind === "karambola" ? Sim.CHARGE.karambola : it.kind === "zlate" ? Sim.CHARGE.zlate : Sim.CHARGE.cut, at);
    swing(at, !ice);
    if (it.kind === "karambola") send("bomba", at);
    if (r() < 0.2) {
      st.precise++;
      if (ice) send("mraz", at, true);                // přesně rozseknutý led se vrací jako mráz
      else { add(Sim.POINTS.precise, at); charge(Sim.CHARGE.precise - Sim.CHARGE.cut, at); }
    }
  }

  return {
    st,
    // zpracuje vše, co mělo do hodin kola `clock` (ms) nastat; me = skóre a životy hráče (jen pro dorovnání obtížnosti)
    tick(clock, mine) {
      if (mine) me = mine;
      st.boost = clock < finAt && Sim.boostNext(st.boost, md, st.score, me.score, st.lives, me.lives);
      while (qi < q.length && q[qi].at <= clock && !over()) handle(q[qi++]);
      if (!over() && stroke && clock - stroke.last > STROKE_END) closeStroke(stroke.last + STROKE_END);
      if (!over()) fire(clock);
      return st;
    },
    // naschvál od hráče dorazí s drobným zpožděním jako u skutečného soupeře
    recv(type, clock) { put({ at: clock + 450 + r() * 250, k: "in", type }); },
    // hráč skončil kolo v čase `clock`: dopočítá se, co bot do té doby stihl, a uzavře se rozjetý tah
    finish(clock) {
      this.tick(clock);
      if (!over()) closeStroke(clock);
      return st;
    },
  };
}
