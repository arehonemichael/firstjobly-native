/* Optional browser checks: install Playwright without saving it, start Expo web,
 * then run node scripts/verify-ui.cjs. Supabase is isolated with test fixtures.
 * No real account is used and no production data is written. */
const { Buffer } = require('node:buffer');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = process.env.APP_URL || 'http://localhost:8081';
const screenshotDir = process.env.SCREENSHOT_DIR || 'work/ui-checks';
fs.mkdirSync(screenshotDir, { recursive: true });
const uid = '00000000-0000-4000-8000-000000000001';
const user = { id: uid, aud: 'authenticated', role: 'authenticated', email: 'fixture@example.test', user_metadata: { full_name: 'Test Candidate', avatar_url: 'https://fixture.invalid/photo.png' }, app_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
const jwt = `${Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')}.${Buffer.from(JSON.stringify({sub:uid,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')}.fixture`;
const session = { access_token: jwt, refresh_token: 'fixture-refresh', expires_at: Math.floor(Date.now()/1000)+3600, expires_in:3600, token_type:'bearer', user };
const job = { id:'fixture-job',slug:'fixture-job',title:'Fixture opportunity', company_name:'Fixture company', company_logo_url:'https://fixture.invalid/company.png', company_id:null,city:'Pretoria',province:'Gauteng',category:'internship',job_type:'full_time',experience_level:null,education_level:null,salary_min:null,salary_max:null,salary_period:null,closing_date:null,posted_at:'2026-11-10T10:00:00Z',apply_type:'easy_apply',external_url:null,is_urgent:false,is_featured:false,is_active:true,description:'Isolated browser test content.',requirements:[],responsibilities:[],required_documents:[] };
const complete = {first_name:'Test',last_name:'Candidate',email:user.email,phone:'0123456789',province:'Gauteng',city:'Pretoria',date_of_birth:'2000-01-01',address:'Fixture address',about:'Fixture summary',highest_qualification:'Degree',institution:'Fixture institution',field_of_study:'Computing',year_completed:'2024',skills:['A','B','C'],languages:['English'],preferred_job_types:['permanent'],preferred_province:'Gauteng',preferred_city:'Pretoria',available_immediately:false,willing_to_relocate:false};
let checks = 0;
function check(value, label) { assert.ok(value,label); console.log(`PASS ${label}`); checks++; }
(async () => {
 const browser = await chromium.launch({ executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless:true, args:['--no-sandbox'] });
 async function setup({signedIn=false,profile=complete,applications=[],failure=false,empty=false,width=390,height=844}={}) {
  const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'});
  if(signedIn) await context.addInitScript(s=>localStorage.setItem('sb-ehwqqjqtevppsnmxximg-auth-token',JSON.stringify(s)),session);
  await context.route('https://fixture.invalid/**',route=>route.abort());
  await context.route('**/ehwqqjqtevppsnmxximg.supabase.co/**',async route=>{
   const url=new URL(route.request().url());const table=url.pathname.split('/').pop();
   if(url.pathname.includes('/auth/v1/token')) return route.fulfill({json:session});
   if(url.pathname.includes('/auth/v1/user')) return route.fulfill({json:user});
   if(failure && table==='profiles') return route.fulfill({status:403,json:{message:'Fixture failure'}});
   let data = table==='profiles' ? profile : table==='jobs' ? (empty ? [] : [job]) : table==='work_experience' ? [{user_id:uid}] : table==='user_documents' ? [{kind:'cv'},{kind:'id'},{kind:'certificate'}] : table==='applications' ? applications : [];
   await route.fulfill({json:data,headers:{'access-control-allow-origin':'*','access-control-expose-headers':'content-range',...(table==='saved_jobs'?{'content-range':'*/2'}:{})}});
  });
  const page=await context.newPage(); page.setDefaultTimeout(30000);page.setDefaultNavigationTimeout(120000); const errors=[];page.on('pageerror',e=>errors.push(e.message));
  return {context,page,errors};
 }
 for(const [width,height] of [[320,568],[390,844],[430,932],[768,1024]]) {
  const {context,page,errors}=await setup({width,height});
  await page.goto(base); await page.getByText('Fixture opportunity',{exact:true}).waitFor();
  const launcher=page.getByRole('button',{name:'Open navigation menu',exact:true});
  check(await launcher.isVisible(),`launcher visible at ${width}px`);
  check(await launcher.getAttribute('aria-expanded')==='false',`collapsed launcher state at ${width}px`);
  await launcher.click();
  const sheet=page.locator('#circular-navigation');await sheet.waitFor();
  check(await page.getByRole('button',{name:'Open navigation menu',exact:true,includeHidden:true}).getAttribute('aria-expanded')==='true',`expanded launcher state at ${width}px`);
  check(await sheet.getByRole('button').count()===8,`all seven destinations and close control at ${width}px`);
  check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`no horizontal overflow at ${width}px`);
  for(const control of await sheet.getByRole('button').all()) {
   const box=await control.boundingBox();check(box.width>=44 && box.height>=44 && box.x>=0 && box.x+box.width<=width && box.y>=0 && box.y+box.height<=height,`comfortable navigation target at ${width}px`);
  }
  const boxes=await sheet.getByRole('button').evaluateAll(nodes=>nodes.map(el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom};}));
  for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++) {const a=boxes[i],b=boxes[j];check(a.right<=b.x || b.right<=a.x || a.bottom<=b.y || b.bottom<=a.y,`navigation controls do not overlap at ${width}px`);}
  // Focus loop, Escape, and focus restoration work without gestures.
  await sheet.getByRole('button',{name:'Find jobs',exact:true}).focus();
  await page.keyboard.press('Shift+Tab');
  check(await sheet.getByRole('button',{name:'Close navigation menu'}).evaluate(el=>el===document.activeElement),`backward focus loop at ${width}px`);
  await page.keyboard.press('Tab');
  check(await sheet.getByRole('button',{name:'Find jobs',exact:true}).evaluate(el=>el===document.activeElement),`forward focus loop at ${width}px`);
  await page.keyboard.press('Escape');await sheet.waitFor({state:'hidden'});
  await page.waitForTimeout(80);
  check(await launcher.evaluate(el=>el===document.activeElement),`focus restored at ${width}px`);
  await launcher.click();
  await sheet.getByRole('button',{name:'Saved jobs',exact:true}).click();
  await page.waitForURL('**/saved');
  check(await page.getByRole('button',{name:'Open navigation menu, current page: Saved jobs'}).isVisible(),`active destination at ${width}px`);
  await page.getByRole('button',{name:'Home',exact:true}).click();await page.waitForURL(base+'/');await page.getByText('Latest opportunities',{exact:true}).waitFor();
  check(errors.length===0,`no runtime exceptions at ${width}px`);
  if(width===390) {
   await page.screenshot({path:`${screenshotDir}/home-mobile-fixture.png`});
   await launcher.click();await page.locator('#circular-navigation').waitFor({state:'visible'});await page.waitForTimeout(180);await page.screenshot({path:`${screenshotDir}/navigation-mobile.png`});
  }
  await context.close();
 }
 // Every destination is still reachable, with browser history retained.
 {
  const {context,page}=await setup();await page.goto(base);await page.getByText('Fixture opportunity',{exact:true}).waitFor();
  for(const [label,path] of [['Find jobs','jobs'],['Saved jobs','saved'],['Applications','applications'],['Career tools','tools'],['Graduate Room','graduateroom'],['Profile','profile']]) {
   await page.getByRole('button',{name:/^Open navigation menu/}).click();await page.locator('#circular-navigation').getByRole('button',{name:label,exact:true}).click();await page.waitForURL(`${base}/${path}`);
   check(new URL(page.url()).pathname===`/${path}`,`${label} destination preserved`);
   await page.goBack();await page.waitForURL(base+'/');
  }
  await context.close();
 }
 for(const variant of ['complete','incomplete','draft','failure','empty']) {
  const options={signedIn:true,profile:variant==='incomplete'?{first_name:'Test'}:complete,applications:variant==='draft'?[{id:'fixture-application',is_draft:true,status:'draft',jobs:{id:job.id,title:job.title,company_name:job.company_name}}]:[],failure:variant==='failure',empty:variant==='empty'};
  const {context,page,errors}=await setup(options);await page.goto(base);await page.getByText('Latest opportunities',{exact:true}).waitFor();await page.getByText(/Good (morning|afternoon|evening),\s*Test/).waitFor();
  if(variant==='complete') {
   await page.getByText('2 saved jobs',{exact:true}).waitFor();check(await page.getByText('A fresh look at opportunities in Gauteng.',{exact:true}).isVisible(),'real profile location');
   await page.getByRole('button',{name:'Save Fixture opportunity',exact:true}).click();
   const saved=page.getByRole('button',{name:'Unsave Fixture opportunity',exact:true});await saved.waitFor();check(await saved.getAttribute('aria-pressed')==='true','save action reflects confirmed response');
   await saved.click();const unsaved=page.getByRole('button',{name:'Save Fixture opportunity',exact:true});await unsaved.waitFor();check(await unsaved.getAttribute('aria-pressed')==='false','unsave action reflects confirmed response');
  }
  if(variant==='incomplete') { await page.getByRole('progressbar').waitFor();const value=Number(await page.getByRole('progressbar',{name:'Profile completion'}).getAttribute('aria-valuenow'));check(value>0 && value<100,'incomplete profile progress'); }
  if(variant==='draft') { await page.getByText('Continue application',{exact:true}).click();await page.waitForURL('**/jobs/fixture-job');check(true,'draft resumes correct job'); }
  if(variant==='failure') { await page.getByText('Some of your overview couldn’t load.',{exact:true}).waitFor();check(await page.getByRole('progressbar').count()===0,'failed profile has no fabricated completion'); }
  if(variant==='empty') { await page.getByText('No opportunities yet',{exact:true}).waitFor();check(true,'empty jobs state'); }
  if(variant!=='draft') await page.screenshot({path:`${screenshotDir}/home-${variant}-fixture.png`});
  check(errors.length===0,`${variant} profile has no runtime exceptions`);await context.close();
 }
 // Authenticate against isolated responses: default Home and explicit returns.
 for(const returnTo of ['', '/jobs/fixture-job', '/cv-maker', '//example.com']) {
  const {context,page}=await setup();await page.goto(`${base}/auth${returnTo?'?returnTo='+encodeURIComponent(returnTo):''}`);
  await page.getByPlaceholder('you@example.com').fill(user.email);
  await page.getByPlaceholder('Your password').fill('fixture-password');
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  const expected=returnTo && !returnTo.startsWith('//')?returnTo:'/';await page.waitForURL(base+expected);
  check(new URL(page.url()).pathname===expected,`sign-in destination ${returnTo || 'Home'}`);await context.close();
 }
 {
  const {context,page}=await setup({signedIn:true,width:1440,height:1000});await page.goto(base);await page.getByText('Fixture opportunity',{exact:true}).waitFor();
  check(await page.getByRole('tab').count()===7,'desktop shows all seven destinations');
  await page.getByRole('tab',{name:'Home',exact:true}).focus();
  await page.keyboard.press('ArrowRight');
  check(await page.getByRole('tab',{name:'Find jobs',exact:true}).evaluate(el=>el===document.activeElement),'desktop arrow-key focus');
  await page.keyboard.press('Home');
  check(await page.getByRole('tab',{name:'Home',exact:true}).evaluate(el=>el===document.activeElement),'desktop Home-key focus');
  check(await page.getByRole('button',{name:/^Open navigation menu/}).count()===0,'desktop uses full navigation');
  await page.screenshot({path:`${screenshotDir}/home-desktop-fixture.png`});
  await page.goto(base+'/jobs/fixture-job');await page.getByText('Fixture opportunity',{exact:true}).waitFor();
  check(new URL(page.url()).pathname==='/jobs/fixture-job','explicit launch deep link preserved');await context.close();
 }
 await browser.close();console.log(`${checks} browser checks passed. All account and job data were isolated fixtures.`);
})().catch(e=>{console.error(e);process.exit(1)});
