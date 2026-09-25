import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
try {
 const page=await browser.newPage({viewport:{width:1000,height:700},hasTouch:true});
 await page.goto(`${process.env.BASE_URL||'http://localhost:5173/'}#/where`,{waitUntil:'domcontentloaded'});
 await page.locator('[data-follow-mark]').first().waitFor({state:'attached'});
 const box=page.locator('.lanes-scroll');
 // Simulate the native pointercancel transition while horizontal movement is
 // occurring. This event-level regression is separate from physical-device QA.
 await box.dispatchEvent('pointerdown',{pointerType:'touch',clientX:500,clientY:300,pointerId:1});
 await box.dispatchEvent('pointercancel',{pointerType:'touch',pointerId:1});
 await box.evaluate(e=>e.scrollLeft+=250);
 await page.getByRole('button',{name:'Resume',exact:true}).waitFor();
 assert.ok(await page.getByRole('checkbox',{name:'Follow dates'}).isChecked());
 // Focus an actual event whose center is under the name column, even though
 // the browser already considers the button geometrically inside its scroller.
 await page.getByRole('checkbox',{name:'Follow dates'}).uncheck();
 await box.evaluate(el=>{
   const mark=el.querySelector('[data-follow-mark]');
   const b=el.getBoundingClientRect(), r=mark.getBoundingClientRect();
   el.scrollLeft+=r.x+r.width/2-b.left-60;
   mark.focus({preventScroll:true});
 });
 const revealed=await box.evaluate(el=>{
   const m=document.activeElement.getBoundingClientRect(),b=el.getBoundingClientRect();
   const n=el.querySelector('.axis-name').getBoundingClientRect();
   return m.left>=b.left+n.width && m.right<=b.right;
 });
 assert.ok(revealed,'focused dot revealed beside sticky names, even with following off');
 await page.getByRole('checkbox',{name:'Follow dates'}).check();
 // Input while a smooth follow is starting must override it immediately.
 await page.evaluate(()=>document.activeElement.blur());
 await box.evaluate(el=>el.scrollTop=el.scrollHeight);
 await box.hover({position:{x:600,y:100}});
 await page.mouse.wheel(-100,0);
 await page.getByRole('button',{name:'Resume',exact:true}).waitFor();
 // Keyboard horizontal control remains available without preventing defaults.
 await page.getByRole('button',{name:'Resume',exact:true}).click();
 await box.locator('[data-follow-control]').first().focus();
 await page.keyboard.press('ArrowRight');
 await page.getByRole('button',{name:'Resume',exact:true}).waitFor();
 console.log(JSON.stringify({pointercancelOverride:true,stickyFocusReveal:true,smoothWheelOverride:true,keyboardOverride:true,physicalTouchDevice:false}));
}finally{await browser.close()}
