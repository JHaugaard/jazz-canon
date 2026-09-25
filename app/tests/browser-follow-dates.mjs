import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true,
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
const results = [];
try {
  for (const route of ['working', 'where']) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    if (process.env.INCOMING_EXPORT_DIR) {
      for (const file of ['albums','details','places','people-activity']) {
        await page.route(`**/data/${file}.json`, r => r.fulfill({contentType:'application/json',
          body:readFileSync(join(process.env.INCOMING_EXPORT_DIR,`${file}.json`))}));
      }
    }
    await page.goto(`${process.env.BASE_URL || 'http://localhost:5173/'}#/${route}`, {waitUntil:'domcontentloaded'});
    await page.locator('[data-follow-mark]').first().waitFor({ state: 'attached' });
    const box = page.locator('.lanes-scroll');
    await page.getByRole('checkbox', { name: 'Follow dates' }).waitFor();
    assert.equal(await page.getByRole('checkbox', { name: 'Follow dates' }).isChecked(), true);
    const ticks = await page.locator('.axis .tick-label').allTextContents();
    assert.ok(ticks.some(t => t.trim() === '1945'));
    assert.ok(ticks.some(t => t.trim() === '1985'));
    // A scroll event flush plus two frames allows the assisted target to run.
    const settle = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await settle();
    const start = await box.evaluate(e => ({ x:e.scrollLeft,y:e.scrollTop }));
    for (const fraction of [0.25, 0.5, 0.75, 1, 0.5, 0]) {
      await box.evaluate((e, f) => e.scrollTop = (e.scrollHeight - e.clientHeight) * f, fraction);
      await settle(); await settle();
      const visible = await box.evaluate(el => {
        const box = el.getBoundingClientRect();
        const top = el.querySelector('.axis').getBoundingClientRect().bottom;
        const line = top + (box.bottom - top) / 3;
        const rows = [...el.querySelectorAll('[data-follow-row]')].filter(r => {
          const b = r.getBoundingClientRect();
          return b.bottom > top && b.top < box.bottom && r.querySelector('[data-follow-mark]');
        });
        rows.sort((a,b) => {
          const distance = r => { const q=r.getBoundingClientRect(); return Math.max(q.top-line,line-q.bottom,0); };
          return distance(a)-distance(b);
        });
        if (!rows.length) return true;
        const left = box.left + el.querySelector('.axis-name').getBoundingClientRect().width + 12;
        const right = box.right - 12;
        return [...rows[0].querySelectorAll('[data-follow-mark]')].some(m => {
          const r=m.getBoundingClientRect(), x=r.x+r.width/2;
          return x>=left && x<=right;
        });
      });
      assert.ok(visible, `${route}: anchor mark visible at vertical fraction ${fraction}; state=${JSON.stringify(await box.evaluate(el=>({left:el.scrollLeft,top:el.scrollTop,focus:document.activeElement?.outerHTML.slice(0,100),controls:document.querySelector('.follow-controls')?.textContent})))}`);
    }
    await box.evaluate(e => e.scrollTop = e.scrollHeight);
    await settle(); await settle();
    const end = await box.evaluate(e => ({ x:e.scrollLeft,y:e.scrollTop,max:e.scrollWidth-e.clientWidth }));
    assert.ok(end.y > start.y);
    assert.ok(end.x > start.x, `${route}: later rows should lead right: ${JSON.stringify({start,end})}`);
    assert.equal(await page.getByRole('button', { name:'Resume', exact:true }).count(),0,'own movement cannot pause');
    // Real two-axis wheel explicitly wins over follow mode.
    await box.hover({ position:{x:500,y:180} });
    await page.mouse.wheel(-100,0);
    await page.getByRole('button', { name:'Resume', exact:true }).waitFor();
    const manualX = await box.evaluate(e=>e.scrollLeft);
    await box.evaluate(e=>e.scrollTop=0); await settle(); await settle();
    assert.ok(Math.abs(await box.evaluate(e=>e.scrollLeft)-manualX)<2,'paused mode must not drag the reader back');
    await page.getByRole('button',{name:'Resume',exact:true}).click(); await settle(); await settle();
    assert.equal(await page.getByRole('button',{name:'Resume',exact:true}).count(),0);
    const resumed = await box.evaluate(e=>e.scrollLeft);
    assert.ok(resumed < end.x,'upward/resume should reveal earlier rows');
    // Keyboard focus on data must not be stolen by following.
    await page.locator('[data-follow-control]').first().focus(); await settle();
    const focusedX = await box.evaluate(e=>e.scrollLeft);
    await box.evaluate(e=>e.scrollTop=e.scrollHeight); await settle(); await settle();
    assert.ok(Math.abs(await box.evaluate(e=>e.scrollLeft)-focusedX)<2,'focused mark/row wins');
    await page.getByRole('checkbox',{name:'Follow dates'}).uncheck();
    assert.equal(await page.getByRole('checkbox',{name:'Follow dates'}).isChecked(),false);
    const offX = await box.evaluate(e=>e.scrollLeft);
    await box.evaluate(e=>e.scrollTop=0); await settle(); await settle();
    assert.ok(Math.abs(await box.evaluate(e=>e.scrollLeft)-offX)<2);
    // Narrow viewport has functional explicit controls and retains real marks.
    await page.setViewportSize({width:390,height:844}); await settle();
    assert.ok(await page.getByRole('checkbox',{name:'Follow dates'}).isVisible());
    assert.ok(await page.locator('[data-follow-mark]').count());
    assert.deepEqual(errors,[]);
    results.push({route,start,end,resumed,nativeHorizontalPause:true,focusPriority:true,off:true,narrow:true,errors});
    await page.close();
  }
  console.log(JSON.stringify(results));
} finally { await browser.close(); }
