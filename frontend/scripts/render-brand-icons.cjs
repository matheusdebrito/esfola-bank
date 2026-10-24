const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 200, height: 200 }, deviceScaleFactor: 1 });
  for (const [filename, size] of [["favicon-corvo-180.png", 180], ["favicon-corvo-192.png", 192], ["favicon-corvo-32.png", 32]]) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(
      '<!doctype html><html><head><style>*{margin:0;padding:0}body{width:100vw;height:100vh;background:transparent}img{display:block;width:100%;height:100%}</style></head><body><img src="http://127.0.0.1:5173/favicon-corvo.svg"/></body></html>'
    );
    await page.locator("img").evaluate(img => img.decode());
    const png = await page.locator("img").screenshot({ type: "png", animations: "disabled" });
    const b64 = png.toString("base64");
    console.log("BRAND_PNG_BEGIN " + filename + " " + png.length);
    for(let i = 0; i < b64.length; i += 3000) console.log("BRAND_PNG_DATA " + b64.slice(i, i+3000));
    console.log("BRAND_PNG_END " + filename);
  }
  await browser.close();
})().catch(error => { console.error(error); process.exitCode = 1; });
