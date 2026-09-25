/* Synthetic UI contract cases, intercepted in the browser only. */
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless:true, ...(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH}: {}) });
const row=(role,e='obs',sessionId=null)=>({personId:`fixture-${role}`,name:`Fixture ${role}`,role,e,sessionId});
const cases=[
 {name:'old export',credits:undefined,count:0},
 {name:'empty',credits:[],count:0},
 {name:'producer only',credits:[row('producer')],count:1},
 {name:'engineer only',credits:[row('engineer')],count:1},
 {name:'both',credits:[row('producer'),row('engineer')],count:2},
 {name:'repeated sessions and inferred',credits:[row('producer','obs','session-a'),row('producer','inf','session-b')],count:1,inf:true,scope:true},
 {name:'uncertain',credits:[row('engineer','unk')],count:1,unk:true},
];
try {
 const page=await browser.newPage();
 const base=process.env.BASE_URL || 'http://localhost:5173/';
 await page.goto(base,{waitUntil:'domcontentloaded'});
 const {id,detail}=await page.evaluate(async()=>{
  const albums=await(await fetch('/data/albums.json')).json();
  const details=await(await fetch('/data/details.json')).json();
  return {id:albums[0].id,detail:details[albums[0].id]};
 });
 let current;
 await page.route('**/data/details.json',r=>{
  const d={...detail};delete d.productionCredits;
  if(current.credits!==undefined)d.productionCredits=current.credits;
  return r.fulfill({contentType:'application/json',body:JSON.stringify({[id]:d})});
 });
 for(const c of cases){
  current=c;await page.reload({waitUntil:'domcontentloaded'});await page.locator('.card').first().waitFor();
  await page.evaluate(id=>window.__nav.openAlbum(id),id);
  await page.getByRole('button',{name:'Full album personnel'}).click();
  const list=page.getByRole('list',{name:'Production credits'});
  assert.equal(await list.locator('li').count(),c.count,c.name);
  if(c.inf)assert.equal(await list.locator('.ep-badge.inf').count(),1);
  if(c.unk)assert.equal(await list.locator('.ep-badge.unk').count(),1);
  if(c.scope)assert.ok((await list.innerText()).includes('session credit'));
  if(!c.count)assert.equal(await list.count(),0);
 }
 console.log(JSON.stringify({syntheticBrowserCases:cases.map(c=>c.name),passed:cases.length}));
} finally{await browser.close()}
