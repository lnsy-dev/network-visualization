import http from 'http';
import { readFile } from 'fs/promises';
import path from 'path';
import { chromium } from '@playwright/test';

const server = http.createServer(async (req, res) => {
  let p = req.url.split('?')[0];
  if (p === '/') p = '/index.html';
  if (p === '/network-visualization.min.js') p = '/dist/network-visualization.min.js';
  try {
    const data = await readFile(path.join(path.dirname(new URL(import.meta.url).pathname), '..', '..', p));
    if (p.endsWith('.js')) res.setHeader('Content-Type', 'text/javascript');
    if (p.endsWith('.html')) res.setHeader('Content-Type', 'text/html');
    res.end(data);
  }
  catch { res.statusCode = 404; res.end(); }
});
await new Promise((r) => server.listen(8899, r));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
page.on('console', (m) => { if (m.text().includes('[FIT]') || m.type() === 'error') console.log('CONSOLE:', m.type(), m.text().slice(0, 150)); });
page.on('requestfailed', (r) => console.log('REQFAIL:', r.url().slice(-50), r.failure()?.errorText));
const resp = await page.goto('http://localhost:8899/');
console.log('STATUS:', resp.status());
await page.waitForTimeout(1000);
console.log('BODY SNIPPET:', (await page.content()).slice(0, 200));
await page.waitForSelector('network-visualization', { timeout: 15000, state: 'attached' }).catch((e) => console.log('SELECTOR WAIT FAILED'));
await page.waitForTimeout(3000);
const s = await page.evaluate(() => {
  const v = document.querySelector('network-visualization');
  const sm = v.sceneManager;
  if (!v || !v.nodes) return { nodes: 'undefined', hasSceneManager: !!(v && v.sceneManager) };
  const o = v.nodes.find(n => n.id === 'obsidian-md') || v.nodes[v.nodes.length - 1];
  const defined = customElements.get('network-visualization');
    const box = sm.computeGraphBoundingBox();
    const size = { x: box.max.x - box.min.x, z: box.max.z - box.min.z, y: box.max.y - box.min.y };
    const xs = v.nodes.map(n => n.x), zs = v.nodes.map(n => n.z);
      let minPair = Infinity;
    for (let i = 0; i < v.nodes.length; i++) {
      for (let j = i + 1; j < v.nodes.length; j++) {
        const d = Math.hypot(v.nodes[i].x - v.nodes[j].x, v.nodes[i].z - v.nodes[j].z);
        if (d < minPair) minPair = d;
      }
    }
    return {
    minPair: Math.round(minPair),
    defined: Boolean(defined),
    bbox: [Math.round(size.x), Math.round(size.z)],
    nodeSpan: [Math.round(Math.max(...xs) - Math.min(...xs)), Math.round(Math.max(...zs) - Math.min(...zs))],
    cam: sm.camera.position.toArray().map(x => Math.round(x)),
    target: sm.controls.target.toArray().map(x => Math.round(x)),
    far: Math.round(sm.camera.far),
    host: [v.clientWidth, v.clientHeight],
    obs: [Math.round(o.x), Math.round(o.z)],
  };
});
const canvas = await page.locator('network-visualization canvas').boundingBox();
const worst = await page.evaluate(() => {
  let maxOver = 0, count = 0;
  const viz = document.querySelector('network-visualization');
  const c = viz.querySelector('.network-canvas canvas').getBoundingClientRect();
  for (const l of document.querySelectorAll('.node-label')) {
    const r = l.getBoundingClientRect();
    count++;
    maxOver = Math.max(maxOver, c.left - r.left, r.right - c.right, c.top - r.top, r.bottom - c.bottom);
  }
  return { labels: count, maxOverflowPx: Math.round(maxOver) };
});
console.log('STATE:', JSON.stringify(s));
console.log(JSON.stringify({ canvas, ...worst }));
await page.screenshot({ path: 'probe-shot.png' });
await browser.close();
server.close();
process.exit(0);
