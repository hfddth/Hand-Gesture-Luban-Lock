const fs=require('fs'),http=require('http'),path=require('path'),assert=require('assert/strict');
const {chromium}=require('C:/Users/admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=process.cwd();
const server=http.createServer((req,res)=>{
 const pathname=decodeURIComponent(new URL(req.url,'http://local').pathname);
 if(pathname==='/fixture.html'){res.setHeader('Content-Type','text/html');res.end('<html><body></body></html>');return;}
 const file=path.resolve(root,'.'+pathname);
 if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 fs.readFile(file,(e,data)=>{if(e){res.writeHead(404).end();return;}res.setHeader('Content-Type',file.endsWith('.mjs')?'text/javascript':'application/octet-stream');res.end(data);});
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage();await page.goto('http://127.0.0.1:'+server.address().port+'/fixture.html');
  const cases=await page.evaluate(async()=>{
   const {createShadowSegmenter}=await import('./assets/shadow-v86/segmentation.mjs?v=104');
   const originalNow=performance.now.bind(performance);let now=100;performance.now=()=>now;
   const W=640,H=480,c=document.createElement('canvas');c.width=W;c.height=H;const ctx=c.getContext('2d');
   const template=[[70,300],[44,278],[25,250],[14,228],[0,211],[50,225],[43,187],[40,160],[39,140],[70,220],[70,178],[69,149],[69,125],[90,225],[96,190],[100,166],[102,147],[110,240],[123,214],[132,197],[139,182]];
   function pose(x,y,angle){const a=angle*Math.PI/180;return template.map(([px,py])=>({x:x+(px-70)*Math.cos(a)-(py-300)*Math.sin(a),y:y+(px-70)*Math.sin(a)+(py-300)*Math.cos(a)}));}
   function draw(hands){ctx.fillStyle='#888';ctx.fillRect(0,0,W,H);ctx.fillStyle=ctx.strokeStyle='rgb(210,160,120)';ctx.lineCap=ctx.lineJoin='round';for(const hand of hands){ctx.beginPath();ctx.moveTo(hand[0].x,hand[0].y);for(const i of [1,2,5,9,13,17])ctx.lineTo(hand[i].x,hand[i].y);ctx.closePath();ctx.fill();for(const ids of [[1,2,3,4],[5,6,7,8],[9,10,11,12],[13,14,15,16],[17,18,19,20]]){ctx.lineWidth=ids[0]===1?16:13;ctx.beginPath();ctx.moveTo(hand[ids[0]].x,hand[ids[0]].y);for(const i of ids.slice(1))ctx.lineTo(hand[i].x,hand[i].y);ctx.stroke();}}return ctx.getImageData(0,0,W,H).data;}
   const results=[];
   try{
    for(const config of [{name:'right-angle-wrist-cross',angle:90,x:225,y:310},{name:'left-angle-wrist-cross',angle:-90,x:415,y:310},{name:'diagonal-wrist-cross',angle:55,x:245,y:295},{name:'opposing-palm',angle:180,x:320,y:210}]){
     const a=pose(320,340,0),b=pose(config.x,config.y,config.angle),pixels=draw([a,b]);
     const s=createShadowSegmenter();s.setRoi({x:0,y:0,w:640,h:480});s.options.stability=0;
     function tick(landmarks){now+=100;s.setPixels(pixels);s.updateHandGuide(landmarks,pixels);return new Uint8Array(s.process(pixels).mask);}
     const all=tick([a,b]);
     const present=(mask,p)=>{const x=Math.round(p.x),y=Math.round(p.y);for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)if(mask[(y+dy)*W+x+dx])return true;return false;};
     // Every actual detected hand must keep its visible fingertip even when the
     // other hand's wrist cut crosses that finger's path.
     const detectedTips=[a,b].map(h=>[4,8,12,16,20].filter(i=>!present(all,h[i])));
     let missingA,missingB;
     for(let n=0;n<25;n++)missingB=tick([a]);
     const afterMissingB=[4,8,12,16,20].filter(i=>present(all,b[i])&&!present(missingB,b[i]));
     tick([a,b]);
     for(let n=0;n<25;n++)missingA=tick([b]);
     const afterMissingA=[4,8,12,16,20].filter(i=>present(all,a[i])&&!present(missingA,a[i]));
     results.push({name:config.name,detectedTipsMissing:detectedTips,missingHandBTipsLost:afterMissingB,missingHandATipsLost:afterMissingA});
    }
   }finally{performance.now=originalNow;}
   return results;
  });
  console.log(JSON.stringify(cases,null,2));
  for(const c of cases){assert(c.detectedTipsMissing.every(a=>a.length===0),c.name+' cuts a currently detected hand');assert.equal(c.missingHandBTipsLost.length,0,c.name+' loses missing hand B fingertips');assert.equal(c.missingHandATipsLost.length,0,c.name+' loses missing hand A fingertips');}
  fs.mkdirSync('outputs/vision-v104',{recursive:true});fs.writeFileSync('outputs/vision-v104/crossed.json',JSON.stringify(cases,null,2));
  console.log('PASS: detected and persistently missed crossed/rotated fingertips retained');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
