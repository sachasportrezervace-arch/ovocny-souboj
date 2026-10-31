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
export const POINTS = { fruit: 1, karambola: 3, frozen: 2, bomba: -10, precise: 2 };
export const CHARGE_MAX = 18;   // měřič naschválu: řez +1, přesný řez +3, karambola +5; plný pošle soupeři naschvál
export const CHARGE = { cut: 1, precise: 3, karambola: 5 };
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
  return out;
}

// poloha položky v čase dt (s) od vyhození: x zlomkem půlky šířky, y v logických jednotkách
export function vy0(apex) { return Math.sqrt(2 * G * (apex - Y0)); }
export function posAt(it, dt) {
  return { x: it.u + it.vu * dt, y: Y0 + vy0(it.apex) * dt - 0.5 * G * dt * dt };
}
export const flightTime = it => (vy0(it.apex) + Math.sqrt(vy0(it.apex) ** 2 + 2 * G * 2)) / G; // do y = Y0 - 2

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
