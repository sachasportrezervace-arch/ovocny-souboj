// Výkon jednoho kola s emulací mobilu: Chromium, Pixel 7, CPU zpomalené 4× (CDP), bot seká jako v duel.cjs.
// Soupeř je druhá stránka ve stejném prohlížeči, aby kolo běželo naostro včetně sítě.
// node tests/perf.cjs [URL] [cpuRate=4] [gpu=1]
const path = require("path");
const PW = process.env.PW || path.join(process.env.APPDATA || "", "npm/node_modules/playwright");
const { chromium, devices } = require(PW);
const BASE = (process.argv[2] || "http://127.0.0.1:8803/").replace(/\/?$/, "/");
const RATE = +(process.argv[3] || 4), GPU = (process.argv[4] || "1") === "1";
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const b = await chromium.launch({ args: GPU ? ["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=d3d11"] : [] });
  const A = await (await b.newContext({ ...devices["Pixel 7"] })).newPage();
  const B = await (await b.newContext({ ...devices["Pixel 7"] })).newPage();
  const gpu = await A.evaluate(() => { const g = document.createElement("canvas").getContext("webgl"); const e = g && g.getExtension("WEBGL_debug_renderer_info"); return e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : "?"; });
  await A.goto(BASE + "?kolo=30");
  await A.fill("#fMe", "Mark"); await A.fill("#fOpp", "Radka"); await A.click("#bCreate");
  await A.waitForSelector("#msg");
  const link = (await A.inputValue("#msg")).match(/https?:\/\/\S+#r\.[0-9a-z]+/)[0];
  await B.goto(link); await B.click("#bAccept"); await B.waitForSelector("#bReady");
  await A.click("#bLobby"); await A.waitForSelector("#bReady:not([disabled])");
  const cdp = await A.context().newCDPSession(A);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: RATE });
  await Promise.all([A.click("#bReady"), B.click("#bReady")]);
  await A.waitForFunction(() => __ovs.state().phase === "play", null, { timeout: 30000 });
  let maxLive = 0, maxCalls = 0;
  while ((await A.evaluate(() => __ovs.state().phase)) === "play") {
    const t = (await A.evaluate(() => __ovs.targets())).filter(o => o.kind !== "bomba" && o.y > 120 && o.y < 780);
    maxLive = Math.max(maxLive, (await A.evaluate(() => __ovs.state().live)));
    maxCalls = Math.max(maxCalls, await A.evaluate(() => __ovs.drawCalls()));
    if (t.length) {
      t.sort((a, c) => a.x - c.x);
      await A.mouse.move(t[0].x - 40, t[0].y); await A.mouse.down();
      for (const f of t) await A.mouse.move(f.x + 40, f.y, { steps: 3 });
      await A.mouse.up();
    }
    await sleep(150);
  }
  const end = await A.evaluate(() => __ovs.log.filter(e => e.ev === "end").pop());
  console.log(JSON.stringify({ gpu, cpuThrottle: RATE, ...end.stats, maxLiveObjects: maxLive, maxDrawCalls: maxCalls, score: end.score }));
  await b.close();
})().catch(e => { console.error(e); process.exit(2); });
