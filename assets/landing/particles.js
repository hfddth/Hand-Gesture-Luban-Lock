(() => {
  const canvas = document.querySelector('.ambient');
  if (!canvas) return;
  const context = canvas.getContext('2d');
  if (!context) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  let width=0,height=0,particles=[],raf=0,previous=0;
  const random=(a,b)=>a+Math.random()*(b-a);
  const sprite=document.createElement('canvas');sprite.width=sprite.height=32;
  const paint=sprite.getContext('2d'),glow=paint.createRadialGradient(16,16,0,16,16,16);
  glow.addColorStop(0,'rgba(255,236,174,1)');glow.addColorStop(.25,'rgba(255,185,68,.6)');glow.addColorStop(1,'rgba(255,166,50,0)');
  paint.fillStyle=glow;paint.fillRect(0,0,32,32);
  function resize(){
    const rect=canvas.getBoundingClientRect(),nextWidth=Math.round(rect.width),nextHeight=Math.round(rect.height);
    if(nextWidth===width&&nextHeight===height)return;
    width=nextWidth;height=nextHeight;
    canvas.width=Math.max(1,width);canvas.height=Math.max(1,height);
    particles=Array.from({length:width<600?25:48},()=>({x:random(0,width),y:random(0,height),r:random(.55,2),vx:random(-5,9),vy:random(-21,-7),phase:random(0,Math.PI*2),speed:random(.5,1.5)}));
    draw(0,0);
  }
  function draw(time,dt){
    context.clearRect(0,0,width,height);
    for(const p of particles){
      p.x+=p.vx*dt;p.y+=p.vy*dt;
      if(p.y < -10){p.y=height+10;p.x=random(0,width)}
      if(p.x>width+10)p.x=-10;if(p.x < -10)p.x=width+10;
      context.globalAlpha=.18+(Math.sin(time*.0007*p.speed+p.phase)+1)*.26;
      const radius=p.r*5;
      context.drawImage(sprite,p.x-radius,p.y-radius,radius*2,radius*2);
      context.fillStyle='#ffecbe';context.fillRect(p.x,p.y,p.r,p.r);
    }
    context.globalAlpha=1;
  }
  function frame(time){raf=0;if(document.hidden||reduce.matches||canvas.hidden)return;if(!previous||time-previous>=1000/30-.5){draw(time,previous?Math.min((time-previous)/1000,.08):0);previous=time;}raf=requestAnimationFrame(frame)}
  function sync(){cancelAnimationFrame(raf);raf=0;previous=0;if(!document.hidden&&!reduce.matches&&!canvas.hidden)raf=requestAnimationFrame(frame);else draw(0,0)}
  new ResizeObserver(resize).observe(canvas);new MutationObserver(sync).observe(canvas,{attributes:true,attributeFilter:['hidden']});addEventListener('resize',resize,{passive:true});document.addEventListener('visibilitychange',sync);addEventListener('pageshow',sync);addEventListener('pagehide',()=>{cancelAnimationFrame(raf);raf=0;});reduce.addEventListener('change',sync);resize();sync();
})();
