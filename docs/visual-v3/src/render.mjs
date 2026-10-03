import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire('/node-tools/node_modules/');
const { chromium } = require('playwright');
export async function render(svgPath, outPath, w, h, scale = 1) {
  const svg = fs.readFileSync(svgPath, 'utf8');
  const html = `<!doctype html><html><body style="margin:0;background:#E5DCCB">${svg}</body></html>`;
  const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined });
  const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: scale });
  await p.setContent(html);
  await p.waitForTimeout(400);
  await p.screenshot({ path: outPath, type: outPath.endsWith('.png') ? 'png' : 'jpeg', quality: 90 });
  await b.close();
}
