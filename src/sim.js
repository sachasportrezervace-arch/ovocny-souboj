// Ovocný souboj – čistá herní logika bez DOM a three.js (testuje se v Node: node tests/sim.test.mjs).
// Oba hráči dostanou ze stejného semínka stejný rozpis ovoce; sabotáže do něj přidávají až za běhu.

export const ROUND_MS = 120000;   // výchozí délka jediného kola
export const ROUND_OPTIONS = [60000, 120000];
export const G = 17;          // gravitace v logických jednotkách (půlka výšky obrazovky = 10); vyšší než 15 = svižnější let
export const Y0 = -12;        // ovoce startuje pod spodním okrajem
export const FRUITS = ["meloun", "pomeranc", "svestka", "citron", "jablko", "kiwi"];
export const KIND_NAMES = {
  meloun: "meloun", pomeranc: "pomeranč", svestka: "švestka", citron: "citron", jablko: "jablko",
  kiwi: "kiwi", karambola: "karambola", bomba: "bomba",
};
export const POINTS = { fruit: 1, karambola: 3, frozen: 2, bomba: -10, precise: 2, zlate: 5, finale: 2 };
export const CHARGE_MAX = 18;   // měřič naschválu: řez +1, přesný řez +3, karambola +5; plný pošle soupeři naschvál
export const CHARGE = { cut: 1, precise: 3, karambola: 5, zlate: 3, obri: 2 };
export const FIRE_ORDER = ["smouha", "mraz", "bomba"];
export const PRECISE_R = 0.25;   // přesný řez: tah projde ve vnitřní čtvrtině poloměru ovoce (počítá se na obrazovce v main.js)
export const SAB_TYPES = ["bomba", "smouha", "mraz"];   // naschvály bez textů: signalizuje je jen ikona u soupeřova skóre a pulz měřiče

// Módy (docs/mody.md): na čas (vyšší skóre), závod do cíle (kdo dřív), tři životy (kdo vydrží déle).
// Rozhodují vlastní hodiny kola každého hráče (f = ms od startu), ne pořadí zápisů na server, takže zpoždění ~0,5 s nevadí.
export const MODES = ["cas", "zavod", "zivoty"];
export const TARGET = 50;          // závod: cíl v bodech
export const RACE_MS = 90000;      // závod: strop, když cíl nikdo nedá (pak vyšší skóre)
export const LIVES = 3;            // tři životy: propadlé ovoce nebo seknutá bomba bere život
export const LIFE_MS = 120000;     // tři životy: strop, kdo vydrží celý, má výdrž = strop
export const modeOf = md => MODES.includes(md) ? md : "cas";
export const lengthFor = (md, rl) => md === "zavod" ? RACE_MS : md === "zivoty" ? LIFE_MS : (rl || ROUND_MS);
// vítěz jednoho kola: x, o = skóre, fx, fo = čas cíle / smrti (undefined = nedal cíl / přežil)
export function winnerOf(md, x, o, fx, fo) {
  if (md === "zavod" && (fx != null || fo != null)) {
    if (fo == null) return "x";
    if (fx == null) return "o";
    if (fx !== fo) return fx < fo ? "x" : "o";
  }
  if (md === "zivoty") {
    const a = fx == null ? Infinity : fx, b = fo == null ? Infinity : fo;
    if (a !== b) return a > b ? "x" : "o";
  }
  return x > o ? "x" : o > x ? "o" : null;
}

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Jedna položka: t (ms od startu kola), kind, u (-1…1 = vodorovná poloha zlomkem půlky šířky),
// vu (vodorovná rychlost ve stejných jednotkách za s), apex (výška vrcholu, -10…10), spin (osa a rychlost)
// Tempo (změřeno `node tests/tempo.mjs`): náběh od ~1 kusu/s do ~2,4 kusu/s, na konci vrchol; bomby jako koření
// (~10 % kusů, prvních 6,5 s žádné); občas „opona“ 4–6 kusů v řadě, kterou jde vzít jedním tahem na combo.
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export const rate = p => 0.9 + 1.0 * p + 1.3 * smooth(0.55, 1, p);   // kusů za sekundu v podílu kola p
export function schedule(seed, roundMs = ROUND_MS) {
  const r = rng(seed);
  const out = [];
  const pick = arr => arr[Math.floor(r() * arr.length)];
  const item = (t, kind, o = {}) => {
    const u = o.u !== undefined ? o.u : (r() * 2 - 1) * 0.78;
    const vu = o.vu !== undefined ? o.vu : (-u * 0.55 + (r() - 0.5) * 0.35);
    const apex = o.apex !== undefined ? o.apex : 2.2 + r() * 4.8;
    const ax = [r() - 0.5, r() - 0.5, r() - 0.5];
    const n = Math.hypot(...ax) || 1;
    out.push({ id: out.length, t: Math.round(t), kind, u, vu, apex, spin: [ax[0] / n, ax[1] / n, ax[2] / n, 1.5 + r() * 3] });
  };
  // karamboly (posílají bombu navíc) jsou rozložené rovnoměrně, cca po 12 s, aby měl každý stejnou šanci
  // první karambola je zaručeně brzy (4–6 s), aby oba hned poslali a dostali první naschvál; zbylé se rozloží do 20–90 % kola
  const stars = [Math.round(4000 + r() * 1800)], nStars = Math.max(1, Math.round(roundMs / 12000));
  for (let i = 0; i < nStars - 1; i++) stars.push(Math.round(roundMs * (0.2 + 0.7 * (i + 0.5 + (r() - 0.5) * 0.3) / (nStars - 1))));
  let t = 900;
  const end = roundMs - 2600;
  while (t < end) {
    const p = t / roundMs;
    const roll = r();
    // velikost vlny: zpočátku jednotlivé kusy a dvojice, později trojice a „opony“ 4–6
    const pBurst = p < 0.18 ? 0 : 0.05 + 0.07 * p, pSingle = 0.58 - 0.32 * p, pPair = 0.28;
    const size = roll < pBurst ? 4 + Math.floor(r() * 3) : roll < pBurst + pSingle ? 1 : roll < pBurst + pSingle + pPair ? 2 : 3;
    const burst = size >= 4, stagger = !burst && r() < 0.45;
    const bombP = t < 6500 ? 0 : 0.068 + 0.088 * p;
    // nejvýš jedna bomba ve vlně; v oponě nikdy na kraji, ať se dá obejít tahem
    const bombAt = r() < Math.min(0.9, bombP * size * 0.85) ? (burst ? 1 + Math.floor(r() * (size - 2)) : Math.floor(r() * size)) : -1;
    if (burst) {
      // řada s mírným obloukem: stejný čas vrcholu, rozestup ~0,26, aby se vešla do jednoho tahu
      const dir = r() < 0.5 ? 1 : -1, du = 0.2 + r() * 0.08, u0 = -dir * du * (size - 1) / 2 + (r() - 0.5) * 0.2;
      const base = 3 + r() * 2.6, bow = (r() - 0.5) * 0.7;
      for (let i = 0; i < size; i++) {
        const u = u0 + dir * du * i, k = i - (size - 1) / 2;
        item(t + i * 75, i === bombAt ? "bomba" : pick(FRUITS), { u, vu: -u * 0.2, apex: base + bow * k + 0.3 * (r() - 0.5) });
      }
    } else {
      for (let i = 0; i < size; i++) item(t + (stagger ? i * 190 : i * 25), i === bombAt ? "bomba" : pick(FRUITS));
    }
    t += (size / rate(p)) * (0.8 + r() * 0.4) * 1000 + (stagger ? size * 60 : 0) + (burst ? 250 : 0);
  }
  for (const st of stars) item(st, "karambola");
  out.sort((a, b) => a.t - b.t || a.id - b.id);
  out.forEach((o, i) => o.id = i);
  return clearBombs(out, roundMs);   // bomba nikdy schovaná za ovocem ani těsně vedle něj
}

// poloha položky v čase dt (s) od vyhození: x zlomkem půlky šířky, y v logických jednotkách
// gm = násobek gravitace kusu (1 = běžná; měsíční kolo a první vlna finále létají pomaleji)
export function vy0(apex, gm = 1) { return Math.sqrt(2 * G * gm * (apex - Y0)); }
export function posAt(it, dt) {
  const gm = it.gm || 1;
  return { x: it.u + it.vu * dt, y: Y0 + vy0(it.apex, gm) * dt - 0.5 * G * gm * dt * dt };
}
export const flightTime = it => { const g = G * (it.gm || 1), v = vy0(it.apex, it.gm || 1); return (v + Math.sqrt(v * v + 2 * g * 2)) / g; }; // do y = Y0 - 2

// combo 3 = šmouha, 4+ = mražené ovoce; karambola = bomba navíc
export function sabotageFor(comboCount, kind) {
  if (kind === "karambola") return "bomba";
  if (comboCount >= 4) return "mraz";
  if (comboCount === 3) return "smouha";
  return null;
}
export const comboBonus = n => n >= 3 ? n : 0;

// klíč kola: zápas * 10 + kolo (11 = 1. zápas 1. kolo)
export const key = (m, r) => m * 10 + r;
export const mOf = k => Math.floor(k / 10);
export const rOf = k => k % 10;

// stav souboje m z historií skóre obou hráčů ({klíč: skóre}): jedno kolo, vítěz podle módu, stejné = remíza
// ex = { mh: {klíč: mód}, fx, fo: {klíč: ms cíle/smrti} }; bez ex (staré souboje) = na čas
export function matchState(hx, ho, m, ex = {}) {
  const k = key(m, 1), rounds = [];
  const over = k in (hx || {}) && k in (ho || {});
  const md = modeOf((ex.mh || {})[k]);
  let winner = null;
  if (over) {
    const x = hx[k], o = ho[k], fx = (ex.fx || {})[k], fo = (ex.fo || {})[k];
    winner = winnerOf(md, x, o, fx, fo);
    rounds.push({ r: 1, k, x, o, fx, fo, w: winner });
  }
  return { rounds, md, wx: winner === "x" ? 1 : 0, wo: winner === "o" ? 1 : 0, over, winner, nextK: over ? key(m + 1, 1) : k };
}

export function series(hx, ho, ex) {
  const ms = new Set(Object.keys(hx || {}).map(k => mOf(+k)));
  let x = 0, o = 0;
  for (const m of ms) {
    const s = matchState(hx, ho, m, ex);
    if (s.over && s.winner === "x") x++;
    if (s.over && s.winner === "o") o++;
  }
  return [x, o];
}

// ---------- kolize a spawn: bomba nikdy schovaná za ovocem ani těsně vedle něj ----------
// Poloměry kusů ve světových jednotkách (z LOOK ve scene.js: r × největší měřítko), obří meloun navíc krát `big`.
export const RADIUS = { meloun: 1.56, pomeranc: 0.98, svestka: 0.84, citron: 1.16, jablko: 0.96, kiwi: 1.0, zlate: 1.0, karambola: 1.05, bomba: 0.95 };
export const radiusOf = it => (RADIUS[it.kind] || 1) * (it.big || 1);
// nejužší očekávaný displej (iPhone na výšku ~4,6): půlka šířky hrací plochy ve světových jednotkách; na širších je rozestup jen větší
export const NARROW_HALF_W = 4.2;
// nejmenší vzdálenost středů dvou kusů, dokud jsou oba na ploše (y > -9,5), při nejužším displeji
export function minGap(a, b, fh = NARROW_HALF_W) {
  const t0 = Math.max(a.t, b.t), t1 = Math.min(a.t + flightTime(a) * 1000, b.t + flightTime(b) * 1000);
  let m = Infinity;
  for (let t = t0; t < t1; t += 40) {
    const pa = posAt(a, (t - a.t) / 1000), pb = posAt(b, (t - b.t) / 1000);
    if (pa.y < -9.5 || pb.y < -9.5) continue;
    m = Math.min(m, Math.hypot((pa.x - pb.x) * fh, pa.y - pb.y));
  }
  return m;
}
// poměr rozestupu k součtu poloměrů: 1 = kusy se při nejužším displeji sotva dotknou, 0,6 = střed bomby leží mimo ovoce
export const CLEAR = 0.6;
export const gapRatio = (a, b, fh) => minGap(a, b, fh) / (radiusOf(a) + radiusOf(b));
const movable = o => FRUITS.includes(o.kind) && !o.hp && !o.fin;
// Bomba, která by se letem sešla s jiným kusem blíž než CLEAR, se nejdřív posune v čase (po 110 ms, nejvýš o 1,5 s), pak i do jiné dráhy;
// když se nedá vyhnout, uvolní jí místo sousední běžné ovoce (vypadne z rozpisu); kdyby překážela bomba, karambola nebo zlatý kus, z rozpisu vypadne.
// Deterministické (žádná náhoda), takže oba hráči mají stejný rozpis.
function clearBombs(list, ms, endBy = Infinity) {
  const lim = ms - 1500;
  const drop = new Set();
  for (const b of list) {
    if (b.kind !== "bomba" || b.from || drop.has(b)) continue;
    const t0 = b.t, others = list.filter(o => o !== b && !drop.has(o) && Math.abs(o.t - t0) < 7000);
    let best = null;
    outer: for (const du of [0, 0.22, -0.22, 0.44, -0.44]) for (let k = 0; k <= 14; k++) {
      const t = t0 + k * 110;
      if (t > Math.max(lim, t0) || (k && t + flightTime(b) * 1000 > endBy)) break;   // ve finále bomba nedoletí za jeho začátek
      const c = { ...b, t, u: Math.max(-0.85, Math.min(0.85, b.u + du)) };
      const bad = others.filter(o => gapRatio(c, o) < CLEAR);
      if (bad.length > 2 || bad.some(o => !movable(o))) continue;   // nejvýš dvě ovoce uvolní místo, jinak se bomba radši promění v ovoce
      const score = bad.length * 10 + k * 0.1 + Math.abs(du);
      if (!best || score < best.score) best = { score, t: c.t, u: c.u, bad };
      if (!bad.length) break outer;
    }
    if (!best) { drop.add(b); continue; }   // bez uvolnění místa bomba z rozpisu vypadne (nová kusy kolem ostatních nevznikají)
    b.t = best.t; b.u = best.u;
    for (const o of best.bad) drop.add(o);
  }
  return renumber(list.filter(o => !drop.has(o)));
}
// nahodilá bomba z naschválu (hraje se lokálně): z několika zkusmých drah vybere tu, která je nejdál od ostatních kusů
export function sabotageBomb(sched, t, rand = Math.random) {
  let best = null;
  const near = sched.filter(o => Math.abs(o.t - t) < 4500);
  for (let i = 0; i < 10; i++) {
    const u = (rand() * 2 - 1) * 0.6, it = { t, kind: "bomba", u, vu: -u * 0.4, apex: 3 + rand() * 4 };
    const g = near.reduce((m, o) => Math.min(m, gapRatio(it, o)), Infinity);
    if (!best || g > best.g) best = { it, g };
    if (g >= CLEAR) break;
  }
  return best.it;
}
// pohyblivá koule vs. úsečka čepele: čepel jde z A do B, střed kusu z P0 do P1 za stejný čas; vrací nejmenší vzdálenost středu od čepele.
// Tak se rychlý švih nebo ovoce uletělé mezi snímky nepřeskočí.
export function sweptDist(ax, ay, bx, by, p0x, p0y, p1x, p1y) {
  const wx = ax - p0x, wy = ay - p0y, vx = (bx - ax) - (p1x - p0x), vy = (by - ay) - (p1y - p0y), vv = vx * vx + vy * vy;
  const s = vv < 1e-9 ? 0 : Math.max(0, Math.min(1, -(wx * vx + wy * vy) / vv));
  return Math.hypot(wx + s * vx, wy + s * vy);
}
// zásahová zóna: ovoce o něco štědřejší než jeho velikost, bomba jen 60 % poloměru (švih mířený na sousední ovoce ji netrefí)
export const FRUIT_HIT = { k: 1.28, pad: 9 };
export const BOMB_HIT = 0.6;
export const hitRadius = (kind, rPx) => kind === "bomba" ? rPx * BOMB_HIT : rPx * FRUIT_HIT.k + FRUIT_HIT.pad;

// ---------- rozmanitost (docs/mody.md): modifikátor kola, deska, finále, dohánění a čepel ----------
// Všechno náhodné se bere ze semínka kola `g.sd`, takže oba hráči dostanou totéž; místní věci (dohánění, čepel) rozpis nemění.
export const MODS = ["zlate", "rady", "obri", "mesic"];
export const THEMES = ["orech", "bridlice", "ubrus", "dlazdice", "podzim"];
const hash = (seed, salt) => { let h = Math.imul((seed >>> 0) ^ salt, 2654435761) >>> 0; h ^= h >>> 15; h = Math.imul(h, 2246822519) >>> 0; h ^= h >>> 13; return h >>> 0; };
export const modOf = seed => MODS[hash(seed, 0x51ED270B) % MODS.length];
export const themeOf = seed => THEMES[hash(seed, 0x2C1B3C6D) % THEMES.length];
// semínko dalšího kola: modifikátor i deska jiné než v kole předchozím (prev = předchozí semínko, 0 = první kolo)
export function pickSeed(prev, rand = Math.random) {
  let sd = 1;
  for (let i = 0; i < 80; i++) {
    sd = ((rand() * 4294967296) >>> 0) || 1;
    if (!prev || (modOf(sd) !== modOf(prev) && themeOf(sd) !== themeOf(prev))) return sd;
  }
  return sd;
}

// Finále: posledních ~8,6 s kola na čas je „fontána“: vlna po vlně ovoce za 2 body bez bomb. Závod nemá pevný konec a ve třech životech
// kolo končí smrtí, ne časem, takže finále mají jen kola na čas (a ne zkrácená testovací, < 45 s).
export const FINALE_MS = 8600;
export const hasFinale = (md, ms) => md === "cas" && ms >= 45000;
export const finaleStart = ms => ms - FINALE_MS;
// kam až modifikátor sahá: u kola na čas po začátek finále, u závodu a tří životů do typické délky kola
export const spanFor = (md, ms) => hasFinale(md, ms) ? finaleStart(ms) - 500 : Math.min(ms, md === "zavod" ? 45000 : md === "zivoty" ? 75000 : ms);

const SMALL = ["pomeranc", "svestka", "citron", "jablko", "kiwi"];
const renumber = out => { out.sort((a, b) => a.t - b.t || a.id - b.id); out.forEach((o, i) => o.id = i); return out; };
export function roundSchedule(seed, ms = ROUND_MS, md = "cas") {
  const out = applyMod(schedule(seed, ms), modOf(seed), seed, spanFor(md, ms));
  return hasFinale(md, ms) ? clearBombs(addFinale(out, seed, ms), ms, finaleStart(ms)) : clearBombs(out, ms);
}
const spinOf = r => { const a = [r() - 0.5, r() - 0.5, r() - 0.5], n = Math.hypot(...a) || 1; return [a[0] / n, a[1] / n, a[2] / n, 1.5 + r() * 3]; };
export function applyMod(base, mod, seed, span) {
  const r = rng((seed >>> 0) ^ 0x7F4A7C15);
  let out = base.map(o => ({ ...o }));
  const isFruit = i => FRUITS.includes(i.kind);
  const add = (t, kind, o = {}) => out.push({ id: 0, t: Math.round(t), kind, u: 0, vu: 0, apex: 4, spin: spinOf(r), ...o });
  // n cílových časů rovnoměrně přes okno [a, b] podílu rozpětí, s drobným chvěním
  const targets = (n, a, b) => Array.from({ length: n }, (_, i) => span * (a + (b - a) * (i + 0.5 + (r() - 0.5) * 0.4) / n));
  if (mod === "zlate") {
    // vzácné zlaté ovoce (5 bodů): několik běžných kusů se promění ve zlaté, vždy s dostatečně vysokým obloukem
    for (const tt of targets(Math.max(3, Math.round(span / 15000)), 0.1, 0.92)) {
      const c = out.filter(i => isFruit(i) && Math.abs(i.t - tt) < 2500).sort((a, b) => Math.abs(a.t - tt) - Math.abs(b.t - tt))[0];
      if (c) { c.kind = "zlate"; c.apex = Math.max(c.apex, 4.6); }
    }
  } else if (mod === "obri") {
    // obří meloun na 4 řezy, uprostřed plochy, pomalý a vysoký
    for (const tt of targets(Math.max(2, Math.round(span / 26000)), 0.14, 0.9)) {
      const u = (r() * 2 - 1) * 0.35;
      add(tt, "meloun", { u, vu: -u * 0.15, apex: 6.4 + r() * 0.8, big: 1.75, hp: 4 });
    }
  } else if (mod === "rady") {
    // „opony“: každých ~9 s řada 5–6 kusů za sebou, jde vzít jedním tahem na combo; v okolí se vyřadí stejný počet běžných kusů
    for (const tt of targets(Math.max(2, Math.round(span / 9000)), 0.06, 0.94)) {
      const size = 5 + Math.floor(r() * 2), dir = r() < 0.5 ? 1 : -1, du = 0.2 + r() * 0.06, u0 = -dir * du * (size - 1) / 2 + (r() - 0.5) * 0.2, base = 3.2 + r() * 2.4;
      let drop = size;
      for (const i of out.filter(isFruit).sort((a, b) => Math.abs(a.t - tt) - Math.abs(b.t - tt))) { if (!drop) break; if (Math.abs(i.t - tt) < 1600) { i.kind = "_x"; drop--; } }
      for (let k = 0; k < size; k++) { const u = u0 + dir * du * k; add(tt + k * 75, SMALL[Math.floor(r() * SMALL.length)], { u, vu: -u * 0.2, apex: base + 0.3 * (r() - 0.5) }); }
    }
    out = out.filter(i => i.kind !== "_x");
  } else if (mod === "mesic") {
    // měsíční tíže: vše letí pomaleji a výš, každý třetí běžný kus se vynechá, ať není na ploše víc kusů než jindy
    let n = 0;
    for (const i of out) i.gm = 0.62;
    out = out.filter(i => !isFruit(i) || n++ % 3 !== 2);
  }
  return renumber(out);
}
// finále: vlny po ~0,95 s, první 4 a další 5 kusů (vějíř nebo řada na combo), první vlna plave pomalu (gm 0,65) jako „nádech“, v poslední vlně zlaté kusy
export function addFinale(list, seed, ms) {
  const r = rng((seed >>> 0) ^ 0x1B873593), F0 = finaleStart(ms);
  // pryč běžné kusy po začátku finále a bomby, které by do finále doletěly
  const out = list.filter(i => i.kind === "karambola" || (i.t < F0 && (i.kind !== "bomba" || i.t + flightTime(i) * 1000 <= F0)));
  const add = (t, kind, o) => out.push({ id: 0, t: Math.round(t), kind, vu: 0, spin: spinOf(r), fin: true, ...o });
  const waves = 8, step = (FINALE_MS - 2000) / (waves - 1);
  for (let w = 0; w < waves; w++) {
    const t = F0 + w * step, slow = w === 0 ? 0.65 : 1, line = w % 2 === 1, size = w === 0 ? 4 : 5, dir = r() < 0.5 ? 1 : -1;
    for (let k = 0; k < size; k++) {
      const gold = w === waves - 1 && k % 2 === 0;   // 3 zlaté v poslední vlně
      let u, apex;
      if (line) { const du = 0.24; u = -dir * du * (size - 1) / 2 + dir * du * k; apex = 4 + 0.12 * (k - 2) * dir + 0.2 * r(); }
      else { u = -0.8 + 1.6 * (k + 0.5) / size + (r() - 0.5) * 0.12; apex = 3 + r() * 2.5; }
      add(t + k * (line ? 70 : 45), gold ? "zlate" : SMALL[Math.floor(r() * SMALL.length)], { u, vu: -u * 0.15, apex: Math.max(apex, gold ? 4.8 : 0), gm: slow });
    }
  }
  return renumber(out);
}

// dohánění: kdo je výrazně pozadu, nabíjí měřič naschválu rychleji (jen u mě, rozpis se nemění). Hystereze 10 / 5 bodů je větší než to,
// co se za zpoždění ~0,5 s stihne nasbírat, takže stav nebliká. Ve třech životech rozhoduje počet životů.
export const BOOST = { on: 10, off: 5, mul: 2 };
export function boostNext(on, md, me, opp, myLives, oppLives) {
  if (md === "zivoty") return myLives < oppLives;
  const gap = (opp || 0) - (me || 0);
  return on ? gap >= BOOST.off : gap >= BOOST.on;
}

// čepel podle výher v sérii: 0 klasická, 1 jiskry, 2 dvojitá, 3 zlatá, 4+ duha
export const BLADES = ["klasik", "jiskra", "dvojita", "zlata", "duha"];
export const bladeTier = wins => Math.max(0, Math.min(BLADES.length - 1, wins | 0));
