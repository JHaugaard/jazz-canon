/* Run against an already-running dev server. Playwright may be installed
   outside this repo: PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs.
   Optional INCOMING_EXPORT_DIR previews the data owner's real next export
   using browser request interception only, never modifying site data. */
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const output = process.env.EVIDENCE_DIR;
if (output) mkdirSync(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
});
try {
  const page = await browser.newPage({ viewport: { width: 1512, height: 900 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  if (process.env.INCOMING_EXPORT_DIR) {
    for (const file of ['albums', 'details', 'graph', 'places', 'people-activity']) {
      await page.route(`**/data/${file}.json`, route => route.fulfill({
        contentType: 'application/json',
        body: readFileSync(join(process.env.INCOMING_EXPORT_DIR, `${file}.json`)),
      }));
    }
  }
  await page.goto(process.env.BASE_URL || 'http://localhost:5173/', {waitUntil:'domcontentloaded'});
  await page.locator('.card').first().waitFor();
  const data = await page.evaluate(async () => ({
    albums: await (await fetch('/data/albums.json')).json(),
    details: await (await fetch('/data/details.json')).json(),
  }));
  assert.equal(await page.locator('.card').count(), data.albums.length);
  assert.equal(await page.locator('.band').count(), 7);
  const centered = await page.evaluate(() => {
    const scroller = document.querySelector('.scroller').getBoundingClientRect();
    const year = [...document.querySelectorAll('.tick')].find(e => e.textContent.trim() === '1965').getBoundingClientRect();
    return Math.abs(year.x + year.width / 2 - scroller.x - scroller.width / 2) < 2;
  });
  assert.ok(centered, '1965 must be centered at initial layout');
  const centerYear = () => page.evaluate(() => {
    const box = document.querySelector('.scroller').getBoundingClientRect();
    const x = box.x + box.width / 2;
    return [...document.querySelectorAll('.tick')].find(e => {
      const r = e.getBoundingClientRect(); return r.left <= x && r.right > x;
    })?.textContent.trim();
  });
  await page.locator('.scroller').evaluate(e => e.scrollLeft += 500);
  const pannedYear = await centerYear();
  await page.setViewportSize({width:1512,height:600});
  await page.waitForFunction(() => document.querySelector('.scroller').clientHeight < 600);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  assert.equal(await centerYear(), pannedYear, 'height resize must preserve the semantic year anchor');
  await page.setViewportSize({width:1512,height:900});
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.locator('.scroller').evaluate(e => e.scrollLeft = 0);
  for (const [width, height] of [[1512, 900], [1024, 768], [390, 844], [1512,600]]) {
    await page.setViewportSize({ width, height });
    await page.waitForFunction(w => document.querySelector('.scroller').clientWidth === w, width);
    assert.equal(await page.locator('.scroller').evaluate(e => e.scrollLeft), 0, 'resize must preserve pan');
    await page.evaluate(() => document.fonts.ready);
    const collisions = await page.evaluate(() => {
      const labels = [...document.querySelectorAll('.band-chip')];
      const meta = [...document.querySelectorAll('.card .meta')];
      const intersects = (a,b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
      return labels.flatMap(label => meta.filter(m => intersects(label.getBoundingClientRect(),m.getBoundingClientRect()))
        .map(m => `${label.textContent}: ${m.textContent}`));
    });
    assert.deepEqual(collisions,[], 'era labels must not obscure album metadata');
    if (output) await page.screenshot({ path: join(output, `timeline-${width}.png`) });
  }
  await page.setViewportSize({ width: 1512, height: 900 });
  const credited = Object.entries(data.details).find(([, d]) => d.productionCredits?.length);
  if (credited) {
    await page.evaluate(id => window.__nav.openAlbum(id), credited[0]);
    await page.getByRole('button', { name: 'Full album personnel' }).click();
    const list = page.getByRole('list', { name: 'Production credits' });
    await list.waitFor();
    for (const credit of credited[1].productionCredits) assert.ok((await list.innerText()).includes(credit.name));
    await list.scrollIntoViewIfNeeded();
    if (output) await page.screenshot({ path: join(output, 'credits.png') });
  }
  const uncredited = Object.entries(data.details).find(([, d]) => !d.productionCredits?.length);
  if (uncredited) {
    await page.evaluate(id => window.__nav.openAlbum(id), uncredited[0]);
    await page.getByRole('button', { name: 'Full album personnel' }).click();
    assert.equal(await page.getByRole('list', { name: 'Production credits' }).count(), 0);
  }
  await page.getByRole('button', { name: 'About', exact: true }).click();
  await page.getByText('from bebop through fusion.', { exact: false }).waitFor();
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ albums: data.albums.length, centered, resizePreserved: true,
    creditedAlbum: credited?.[0] ?? null, uncreditedAlbum: uncredited?.[0] ?? null, errors }));
} finally {
  await browser.close();
}
