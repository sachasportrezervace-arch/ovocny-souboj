// node tests/float.cjs [URL]  – plovoucí texty u řezu se nesmí překrývat (karambola: „+5 / bomba letí k soupeři“ a „Přesně! +2“ na jednom místě)
const path = require("path");
const PW = process.env.PW || path.join(process.env.APPDATA || "", "npm/node_modules/playwright");
const { chromium, webkit, devices } = require(PW);
const BASE = (process.argv[2] || "http://127.0.0.1:8803/").replace(/\/?$/, "/");
let pass = 0, fail = 0;
const check = (n, ok, x = "") => { ok ? pass++ : fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${n}${x ? "  (" + x + ")" : ""}`); };
(async () => {
  for (const [name, type, ctx] of [["desktop 1440×900", chromium, { viewport: { width: 1440, height: 900 } }], ["iPhone 13", webkit, devices["iPhone 13"]]]) {
    const b = await type.launch(); const p = await (await b.newContext(ctx)).newPage();
    await p.goto(BASE); await p.waitForFunction(() => window.__ovs && __ovs.float, null, { timeout: 15000 }); await p.waitForTimeout(800);
    await p.evaluate(() => { document.getElementById("bannerTxt").textContent = "Radka posílá bombu navíc"; document.getElementById("banner").classList.add("on"); });
    await p.waitForTimeout(600);
    const r = await p.evaluate(() => {
      const bn = document.getElementById("banner").getBoundingClientRect();
      const w = innerWidth, h = innerHeight, x = w / 2, y = h * 0.55;
      const bx = (bn.left + bn.right) / 2, by = (bn.top + bn.bottom) / 2;
      __ovs.float(bx, by + 6, "Náboj plný!<small>šmouha letí k soupeři</small>", "precise");   // přímo na oznámení naschvalu
      __ovs.float(x, y, "+5<small>bomba letí k soupeři</small>");
      __ovs.float(x, y - 34, "Přesně!<small>+2</small>", "precise");
      __ovs.float(x, y - 40, "Combo 4! +3<small>šmouha letí k soupeři</small>");
      __ovs.float(w - 4, 20, "Přesně!<small>+2</small>", "precise");   // u okraje a pod cedulkami
      const boxes = [...document.querySelectorAll("#floats .float")].map(e => { const a = e.offsetLeft, c = e.offsetTop, ew = e.offsetWidth, eh = e.offsetHeight; return { l: a - ew / 2, t: c - eh / 2, r: a + ew / 2, b: c + eh / 2 }; });
      let overlap = 0;
      for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) { const A = boxes[i], B = boxes[j]; if (A.l < B.r && B.l < A.r && A.t < B.b && B.t < A.b) overlap++; }
      const hitsBanner = boxes.slice(0, 1).some(A => A.l < bn.right && bn.left < A.r && A.t < bn.bottom && bn.top < A.b);
      return { boxes: JSON.stringify(boxes.map(q=>[q.l,q.t,q.r,q.b].map(Math.round))), n: boxes.length, overlap, hitsBanner, inside: boxes.every(q => q.l >= 0 && q.r <= w), minTop: Math.min(...boxes.map(q => q.t)) };
    });
    check(`${name}: 5 plovoucích textů, žádný se nepřekrývá`, r.n === 5 && r.overlap === 0, `překryvů ${r.overlap}` + (r.overlap ? " " + r.boxes : ""));
    check(`${name}: text nezakrývá oznámení naschvalu`, !r.hitsBanner);
    check(`${name}: texty uvnitř obrazovky`, r.inside);
    await b.close();
  }
  console.log(`\n${pass}/${pass + fail} PASS`); process.exit(fail ? 1 : 0);
})();
