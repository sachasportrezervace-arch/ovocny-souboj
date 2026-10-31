// Ovocný souboj – čistá herní logika bez DOM a three.js (testuje se v Node: node tests/sim.test.mjs).
// Oba hráči dostanou ze stejného semínka stejný rozpis ovoce; sabotáže do něj přidávají až za běhu.

export const ROUND_MS = 120000;   // výchozí délka jediného kola
export const ROUND_OPTIONS = [60000, 120000];
export const G = 15;          // gravitace v logických jednotkách (půlka výšky obrazovky = 10)
export const Y0 = -12;        // ovoce startuje pod spodním okrajem
export const FRUITS = ["meloun", "pomeranc", "svestka", "citron", "jablko", "kiwi"];
export const KIND_NAMES = {
  meloun: "meloun", pomeranc: "pomeranč", svestka: "švestka", citron: "citron", jablko: "jablko",
  kiwi: "kiwi", karambola: "karambola", bomba: "bomba",
};
export const POINTS = { fruit: 1, karambola: 3, frozen: 2, bomba: -10 };
export const SAB = {
  bomba: { send: "ti podstrčil(a) bombu", label: "bomba navíc" },
  smouha: { send: "ti cákl(a) šťávu do očí", label: "šmouha" },
  mraz: { send: "ti zmrazil(a) dva kusy", label: "mražené ovoce" },
};

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
export function schedule(seed, roundMs = ROUND_MS) {
  const r = rng(seed);
  const out = [];
  const pick = arr => arr[Math.floor(r() * arr.length)];
  const item = (t, kind) => {
    const u = (r() * 2 - 1) * 0.78;
    const vu = (-u * 0.55 + (r() - 0.5) * 0.35);
    const apex = 2 + r() * 6;
    const ax = [r() - 0.5, r() - 0.5, r() - 0.5];
    const n = Math.hypot(...ax) || 1;
    out.push({ id: out.length, t: Math.round(t), kind, u, vu, apex, spin: [ax[0] / n, ax[1] / n, ax[2] / n, 1.5 + r() * 3] });
  };
  // karamboly (posílají bombu navíc) jsou rozložené rovnoměrně, cca po 12 s, aby měl každý stejnou šanci
  const stars = [], nStars = Math.max(1, Math.round(roundMs / 12000));
  for (let i = 0; i < nStars; i++) stars.push(Math.round(roundMs * (0.1 + 0.8 * (i + 0.5 + (r() - 0.5) * 0.3) / nStars)));
  let t = 900;
  const end = roundMs - 2600;
  while (t < end) {
    const p = t / roundMs;
    const roll = r();
    const size = p < 0.15 ? (roll < 0.6 ? 1 : 2) : p < 0.5 ? 1 + Math.floor(roll * 3) : 1 + Math.floor(roll * 4);
    const stagger = r() < 0.45;
    let bombs = 0;
    for (let i = 0; i < size; i++) {
      const bombP = t < 7000 ? 0 : 0.07 + 0.13 * p;   // prvních 7 s bez bomb, pak roste s podílem času
      const kind = bombs === 0 && size > 1 && r() < bombP * 2.2 ? "bomba" : (size === 1 && r() < bombP ? "bomba" : pick(FRUITS));
      if (kind === "bomba") bombs++;
      item(t + (stagger ? i * 190 : i * 25), kind);
    }
    t += 1300 - 560 * p + r() * 380 + (stagger ? size * 120 : 0);
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

// stav souboje m z historií skóre obou hráčů ({klíč: skóre}): jedno kolo, vyšší skóre vyhrává, stejné = remíza
export function matchState(hx, ho, m) {
  const k = key(m, 1), rounds = [];
  const over = k in (hx || {}) && k in (ho || {});
  let winner = null;
  if (over) {
    const x = hx[k], o = ho[k];
    winner = x > o ? "x" : o > x ? "o" : null;
    rounds.push({ r: 1, k, x, o, w: winner });
  }
  return { rounds, wx: winner === "x" ? 1 : 0, wo: winner === "o" ? 1 : 0, over, winner, nextK: over ? key(m + 1, 1) : k };
}

export function series(hx, ho) {
  const ms = new Set(Object.keys(hx || {}).map(k => mOf(+k)));
  let x = 0, o = 0;
  for (const m of ms) {
    const s = matchState(hx, ho, m);
    if (s.over && s.winner === "x") x++;
    if (s.over && s.winner === "o") o++;
  }
  return [x, o];
}
