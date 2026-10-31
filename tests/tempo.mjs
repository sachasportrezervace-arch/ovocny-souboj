// node tests/tempo.mjs [délka_s=120] – tempo rozpisu přímo ze Sim.schedule (bez prohlížeče): ovoce/s po čtvrtinách,
// podíl bomb, vlny 4+ kusů, kolik kusů je naráz vidět (průměr a maximum), přes několik semínek.
import * as S from "../src/sim.js";
const ms = (+process.argv[2] || 120) * 1000, seeds = [1, 7, 42, 99, 777, 12345, 31337, 4242];
const q = [0, 0, 0, 0], q2 = [0, 0, 0, 0];
let items = 0, bombs = 0, stars = 0, waves = 0, visSum = 0, visN = 0, visMax = 0;
const visP = [[], [], [], []];
for (const sd of seeds) {
  const s = S.schedule(sd, ms);
  for (const it of s) {
    items++; if (it.kind === "bomba") bombs++; if (it.kind === "karambola") stars++;
    const k = Math.min(3, Math.floor(it.t / ms * 4)); q[k]++; if (S.FRUITS.includes(it.kind)) q2[k]++;
  }
  // vlna = 4+ kusů během 450 ms
  for (let i = 0; i < s.length; i++) { let j = i; while (j + 1 < s.length && s[j + 1].t - s[i].t < 450) j++; if (j - i >= 3) { waves++; i = j; } }
  // viditelné kusy: y > -10 (spodní okraj plochy), vzorkováno po 100 ms
  const fl = it => S.flightTime(it) * 1000;
  for (let t = 0; t < ms; t += 100) {
    let n = 0;
    for (const it of s) if (it.t <= t && t < it.t + fl(it)) { const p = S.posAt(it, (t - it.t) / 1000); if (p.y > -10 && Math.abs(p.x) < 1.2) n++; }
    visSum += n; visN++; visMax = Math.max(visMax, n); visP[Math.min(3, Math.floor(t / ms * 4))].push(n);
  }
}
const qs = ms / 4000, N = seeds.length;
const avg = a => a.reduce((x, y) => x + y, 0) / a.length;
console.log(`délka ${ms / 1000} s, ${N} semínek`);
console.log("kusů/s po čtvrtinách (vše):   " + q.map(v => (v / N / qs).toFixed(2)).join("  "));
console.log("ovoce/s po čtvrtinách:        " + q2.map(v => (v / N / qs).toFixed(2)).join("  "));
console.log(`bomby: ${(bombs / items * 100).toFixed(1)} % kusů, karamboly ${(stars / N).toFixed(1)}/kolo, vlny 4+ ${(waves / N).toFixed(1)}/kolo`);
console.log(`kusů naráz vidět: průměr ${(visSum / visN).toFixed(2)}, max ${visMax}; po čtvrtinách průměr ` + visP.map(a => avg(a).toFixed(1)).join("  "));
