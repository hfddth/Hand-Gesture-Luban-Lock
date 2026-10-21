(()=>{
const viewport=document.getElementById('levelWindow'),grid=document.getElementById('levelGrid'),next=document.getElementById('scrollNext');if(!viewport||!grid||!next)return;
const prev=document.createElement('button');prev.id='scrollPrev';
for(const [button,dir,label]of [[prev,'prev','查看上一张关卡'],[next,'next','查看下一张关卡']]){
button.type='button';button.className='level-arrow '+dir;button.setAttribute('aria-label',label);button.setAttribute('aria-controls','levelWindow');button.title=label;
button.innerHTML=`<svg viewBox="0 0 64 64" aria-hidden="true"><defs><radialGradient id="arrow-bg-${dir}" cx="35%" cy="25%" r="80%"><stop stop-color="#77552d"/><stop offset=".5" stop-color="#382c1b"/><stop offset="1" stop-color="#171d14"/></radialGradient><linearGradient id="arrow-rim-${dir}" x2=".4" y2="1"><stop stop-color="#fff0bf"/><stop offset=".35" stop-color="#e5b95f"/><stop offset=".7" stop-color="#9a6a30"/><stop offset="1" stop-color="#f3cd84"/></linearGradient></defs><circle cx="32" cy="32" r="29" fill="url(#arrow-bg-${dir})" stroke="url(#arrow-rim-${dir})" stroke-width="2.3"/><circle cx="32" cy="32" r="25" fill="none" stroke="#d0a259" stroke-width=".65" opacity=".7"/><path d="M27 20 39 32 27 44" fill="none" stroke="#ffe9ae" stroke-width="3.8" stroke-linejoin="round" stroke-linecap="round" ${dir==='prev'?'transform="translate(64 0) scale(-1 1)"':''}/><path d="m32 0 3 3-3 3-3-3Zm0 58 3 3-3 3-3-3Z" fill="#e9bd73"/></svg>`;
document.body.append(button);
button.onclick=()=>{const card=grid.firstElementChild,step=(card?.offsetWidth||430)+(parseFloat(getComputedStyle(grid).columnGap)||24),max=Math.max(0,viewport.scrollWidth-viewport.clientWidth);viewport.scrollTo({left:Math.max(0,Math.min(max,viewport.scrollLeft+(dir==='prev'?-step:step))),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});};
}
function update(){const max=Math.max(0,viewport.scrollWidth-viewport.clientWidth);prev.disabled=viewport.scrollLeft<=2;next.disabled=viewport.scrollLeft>=max-2;}
viewport.addEventListener('scroll',update,{passive:true});addEventListener('resize',update);new MutationObserver(()=>requestAnimationFrame(update)).observe(grid,{childList:true});update();
})();
