// node tests/look.cjs [URL] – snímky obrazovek (setup, výzva) na mobilu a desktopu + chyby konzole
const path = require("path");
const PW = process.env.PW || path.join(process.env.APPDATA || "", "npm/node_modules/playwright");
const { chromium, devices } = require(PW);
const URL = process.argv[2] || "http://127.0.0.1:8797/";
const SH = path.join(__dirname, "shots");
(async () => {
  const b = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  for (const [name, ctx] of [["mobil", devices["Pixel 7"]], ["desktop", { viewport: { width: 1280, height: 800 } }]]) {
    const p = await (await b.newContext(ctx)).newPage();
    const errs = []; p.on("pageerror", e => errs.push(e.message)); p.on("console", m => m.type() === "error" && errs.push(m.text()));
    await p.goto(URL); await p.waitForTimeout(2500);
    await p.screenshot({ path: path.join(SH, `setup-${name}.png`) });
    console.log(name, "errors:", errs.join(" | ") || "none", "drawCalls", await p.evaluate(() => window.__ovs && __ovs.drawCalls()));
  }
  await b.close();
})();
