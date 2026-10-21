import {recordCompletion} from '../collection-v63/progress.mjs';
import {SHADOW_LEVELS} from './levels.mjs?v=59';
import {ShadowSession,overlapScore,normalizeMask,contourLoops,simplifyLoop} from './matching.mjs';
const $=id=>document.getElementById(id),params=new URLSearchParams(location.search),requested=Number(params.get('level')??0);
const level=SHADOW_LEVELS[Number.isInteger(requested)&&requested>=0&&requested<SHADOW_LEVELS.length?requested:0];
function fit(){document.documentElement.style.setProperty('--fit',Math.min(innerWidth/1672,innerHeight/941));$('landscapePrompt').hidden=!(innerWidth<innerHeight&&innerWidth<900&&matchMedia('(pointer:coarse)').matches);}
addEventListener('resize',fit);fit();
$('levelTitle').textContent=`第 ${level.index+1} 关 · ${level.name}`;$('animalTitle').textContent=level.animal+' · 目标影形';$('thresholdValue').textContent=level.threshold;
document.title=level.name+'｜榫影成画';$('referenceImage').src=level.reference;$('hintCopy').textContent=level.hint;
const canvas=$('shadowCanvas'),ctx=canvas.getContext('2d'),maskCanvas=document.createElement('canvas');maskCanvas.width=maskCanvas.height=128;const maskCtx=maskCanvas.getContext('2d');
let target,targetPaths=[];
try{const response=await fetch(level.mask);if(!response.ok)throw Error('Target missing');const data=await response.json();target=normalizeMask(data.mask,data.width,data.height);targetPaths=(data.paths||[]).map(path=>new Path2D(path));}catch(e){$('liveNote').textContent='目标影形加载失败，请刷新重试';throw e;}
const loops=contourLoops(target).map(loop=>simplifyLoop(loop)),state=new ShadowSession(level);let actual=null,stream=null,demo=false,demoElapsed=0,lastTick=performance.now(),shown=false,artwork=level.artwork;
function note(text){$('liveNote').textContent=text;}
function updateHUD(){const s=state.snapshot();$('matchScore').innerHTML=Math.floor(s.score)+'<small>%</small>';$('matchFill').style.width=s.score+'%';$('holdFill').style.width=s.heldMs/level.holdMs*100+'%';$('holdText').textContent=(s.score>=level.threshold?'保持稳定':'等待影形')+' · '+(s.heldMs/1000).toFixed(1)+' / 2 秒';document.body.dataset.score=String(Math.floor(s.score));document.body.dataset.status=s.complete?'complete':s.paused?'paused':'matching';}
function draw(){
 ctx.clearRect(0,0,canvas.width,canvas.height);ctx.save();const scale=3.65;ctx.translate((canvas.width-128*scale)/2,(canvas.height-128*scale)/2);ctx.scale(scale,scale);
 if(actual){const image=maskCtx.createImageData(128,128);for(let i=0;i<actual.length;i++)if(actual[i]){image.data[i*4]=62;image.data[i*4+1]=35;image.data[i*4+2]=18;image.data[i*4+3]=190;}maskCtx.putImageData(image,0,0);ctx.imageSmoothingEnabled=true;ctx.shadowColor='#52311955';ctx.shadowBlur=1.6;ctx.drawImage(maskCanvas,0,0);ctx.shadowBlur=0;}
 ctx.strokeStyle='#fff9e8';ctx.lineWidth=.72;ctx.lineCap='round';ctx.lineJoin='round';ctx.setLineDash([2.1,1.3]);ctx.shadowColor='#fff8d9';ctx.shadowBlur=1.1;
 if(targetPaths.length){for(const path of targetPaths)ctx.stroke(path);}else for(const loop of loops){ctx.beginPath();for(let i=0;i<loop.length;i++){const [x,y]=loop[i];i?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.closePath();ctx.stroke();}
 ctx.restore();
}
function paintArtwork(){const image=$('rewardImage'),pending=$('artworkPending');image.hidden=!artwork;$('rewardView').hidden=!artwork;pending.hidden=!!artwork;$('artworkHeading').textContent=artwork?'原画已解锁':'画卷留白';if(artwork){image.src=artwork;$('rewardAmbience').style.backgroundImage='url('+JSON.stringify(artwork)+')';}}
function finish(){if(shown)return;shown=true;draw();$('matchImage').src=canvas.toDataURL('image/png');$('resultScore').textContent=Math.floor(state.score)+'%';$('resultFill').style.width=state.score+'%';$('successSubtitle').textContent=level.name+' · '+(demo?'演示完成':'匹配成功');$('resultNotice').textContent=demo?'演示预览，不计入正式通关。':'影形已匹配，'+level.animal+'画卷已解锁。';
 if(!demo){recordCompletion('shadow',level.id,{score:state.score,holdMs:level.holdMs});try{const key='sunju-shadow-complete-v1',old=JSON.parse(localStorage.getItem(key)||'[]');localStorage.setItem(key,JSON.stringify([...new Set([...(Array.isArray(old)?old:[]),level.id])]));}catch{}}
 paintArtwork();$('successDialog').showModal();note(demo?'演示完成 · 可重新对影':'影形相合，画卷已解锁');}
function submitScore(score,mask){if(state.paused||state.complete)return state.snapshot();if(demo){stopDemo();state.reset();}actual=mask||null;state.update(score,performance.now());updateHUD();draw();if(state.complete)finish();else note(score>=level.threshold?'轮廓已贴合，保持手势稳定':'继续调整，让影子贴近白色虚线');return state.snapshot();}
function submitMask({mask,width=128,height=128,levelId=level.id}={}){if(levelId!==level.id)return {ignored:true,reason:'different-level'};const normalized=normalizeMask(mask,width,height);return submitScore(overlapScore(target,normalized),normalized);}
function submitResult({score,mask=null,width=128,height=128,levelId=level.id}={}){if(levelId!==level.id)return {ignored:true,reason:'different-level'};if(!Number.isFinite(score)||score<0||score>100)throw Error('score must be between 0 and 100');return submitScore(score,mask?normalizeMask(mask,width,height):null);}
function stopDemo(){demo=false;demoElapsed=0;$('demoBadge').hidden=true;$('demoButton').textContent='▷ 预览演示';document.body.dataset.demo='false';}
function reset(){stopDemo();state.reset();actual=null;shown=false;for(const id of ['successDialog','pauseDialog','hintDialog'])if($(id).open)$(id).close();updateHUD();draw();note('观察目标轮廓，准备你的手影');$('projectionStatus').textContent='静候影来 · 对准轮廓，唤醒画卷';}
function showDialog(id){if(state.complete)return;state.pause(true);updateHUD();$(id).showModal();}
$('hintButton').onclick=()=>showDialog('hintDialog');$('pauseButton').onclick=()=>showDialog('pauseDialog');
for(const id of ['hintDialog','pauseDialog'])$(id).addEventListener('close',()=>{state.pause(false);updateHUD();});
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>$(b.dataset.close).close());
$('resetButton').onclick=reset;$('retryButton').onclick=reset;
$('nextButton').textContent=level.index<SHADOW_LEVELS.length-1?'下一关 →':'返回关卡';$('nextButton').onclick=()=>location.href=level.index<SHADOW_LEVELS.length-1?'shadow-level.html?level='+(level.index+1)+'&v=58':'levels.html?mode=shadow&v=58';
$('demoButton').onclick=()=>{if(demo){reset();return;}reset();demo=true;document.body.dataset.demo='true';$('demoBadge').hidden=false;$('demoButton').textContent='■ 停止演示';$('projectionStatus').textContent='演示预览 · 观察影子如何贴合轮廓';note('正在演示影形比对；演示不计入通关');};
function disconnect(){if(stream)for(const track of stream.getTracks())track.stop();stream=null;$('cameraVideo').srcObject=null;$('cameraVideo').hidden=true;$('cameraEmpty').hidden=false;$('cameraDot').classList.remove('connected');$('cameraState').textContent='摄像头未连接';$('cameraButton').textContent='连接摄像头';if(!state.complete){state.reset();actual=null;updateHUD();draw();}}
async function attachStream(mediaStream){if(!mediaStream||typeof mediaStream.getTracks!=='function')throw Error('A MediaStream is required');if(stream&&stream!==mediaStream)for(const t of stream.getTracks())t.stop();stream=mediaStream;$('cameraVideo').srcObject=mediaStream;$('cameraVideo').hidden=false;$('cameraEmpty').hidden=true;$('cameraDot').classList.add('connected');$('cameraState').textContent='手势投影 · 已连接';$('cameraButton').textContent='断开摄像头';$('cameraNote').textContent='调整双手，观察屏风中的影形';await $('cameraVideo').play().catch(()=>{});}
$('cameraButton').onclick=()=>{if(stream){disconnect();return;}$('cameraNote').textContent='摄像头暂未连接，可先预览对影效果';window.dispatchEvent(new CustomEvent('sunju:shadow-camera-request',{detail:{levelId:level.id,adapter:window.sunjuShadow}}));};
function setArtwork(url){if(typeof url!=='string'||!url.trim())throw Error('Artwork URL required');artwork=url;paintArtwork();}
window.sunjuShadow={version:1,level:{id:level.id,index:level.index,threshold:level.threshold,holdMs:level.holdMs,maskSize:128},submitMask,submitResult,attachStream,disconnect,reset,setArtwork,snapshot:()=>({...state.snapshot(),demo,levelId:level.id})};
window.dispatchEvent(new CustomEvent('sunju:shadow-ready',{detail:window.sunjuShadow}));
let alive=true;function tick(now){if(!alive)return;const dt=Math.min(now-lastTick,100);lastTick=now;if(!document.hidden&&!state.paused&&!state.complete){if(demo){demoElapsed+=dt;const dx=Math.round(Math.max(0,1-demoElapsed/4000)*20),dy=Math.round(Math.max(0,1-demoElapsed/4000)*-10),mask=new Uint8Array(128*128);for(let y=0;y<128;y++)for(let x=0;x<128;x++){const a=x-dx,b=y-dy;if(a>=0&&a<128&&b>=0&&b<128)mask[y*128+x]=target[b*128+a];}actual=mask;state.update(overlapScore(target,mask),now);if(state.complete)finish();}else{state.stale(now);if(state.lastFrame===null)actual=null;}updateHUD();draw();}requestAnimationFrame(tick);}
document.addEventListener('visibilitychange',()=>{if(document.hidden&&!state.complete){state.pause(true);updateHUD();}else if(!$('hintDialog').open&&!$('pauseDialog').open){state.pause(false);updateHUD();}});
addEventListener('pagehide',()=>{alive=false;disconnect();});updateHUD();draw();paintArtwork();document.body.dataset.ready='true';document.body.dataset.level=level.id;document.body.dataset.recognition='adapter-only';requestAnimationFrame(tick);

