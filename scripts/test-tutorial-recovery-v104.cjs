const fs=require('fs'),http=require('http'),path=require('path'),assert=require('assert/strict');
const {chromium}=require('C:/Users/admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=process.cwd(),types={'.html':'text/html','.mjs':'text/javascript','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.json':'application/json','.woff2':'font/woff2'};
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://local').pathname));if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}fs.readFile(file,(e,d)=>{if(e){res.writeHead(404).end();return;}res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(d);});});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader','--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});try{
 const context=await browser.newContext({viewport:{width:1672,height:941},permissions:['camera']});
 await context.addInitScript(()=>{globalThis.Hands=class{setOptions(){}onResults(fn){globalThis.feedHand=fn;}async initialize(){}async send(){}async close(){}};});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+server.address().port+'/tutorial.html?test=1&v=104');await page.locator('body[data-ready=true]').waitFor({timeout:60000});
 await page.locator('#cameraButton').click();await page.locator('#cameraButton').filter({hasText:'摄像头已开启'}).waitFor();
 const {makeHand}=await import('./recognition-synthetic-v33.mjs');await page.evaluate(frame=>feedHand(frame),{multiHandLandmarks:[makeHand('OPEN_PALM',{aspect:4/3,scale:.4})]});
 assert.equal(await page.locator('.camera-card.camera-live').count(),1);
 await page.evaluate(()=>{const stream=document.getElementById('video').srcObject;globalThis.lastStream=stream;stream.getVideoTracks()[0].dispatchEvent(new Event('ended'));});
 await page.locator('#cameraButton').filter({hasText:'重新开启摄像头'}).waitFor();
 assert.equal(await page.locator('.camera-card.camera-live').count(),0);
 assert(await page.evaluate(()=>lastStream.getTracks().every(t=>t.readyState==='ended')));
 await page.locator('#chapterTwo').click();const canvas=page.locator('#scene canvas'),box=await canvas.boundingBox(),before=Number(await page.locator('#rotationProgress').getAttribute('data-degrees'));
 await page.mouse.move(box.x+box.width*.55,box.y+box.height*.55);await page.mouse.down();await page.mouse.move(box.x+box.width*.7,box.y+box.height*.58,{steps:12});await page.mouse.up();await page.waitForTimeout(250);
 const after=Number(await page.locator('#rotationProgress').getAttribute('data-degrees'));assert(after>before+1,'mouse must work after active-hand camera disconnect');
 assert.deepEqual(errors,[]);console.log(JSON.stringify({activeHandDisconnect:true,tracksStopped:true,liveClassCleared:true,mouseRotationRecovered:true,degrees:after-before,errors}));
}finally{await browser.close();server.close();}})().catch(e=>{console.error(e);server.close();process.exitCode=1});

