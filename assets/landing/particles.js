(() => {
  const canvas = document.querySelector('.ambient');
  const context = canvas.getContext('2d');
  if (!context) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  let width=0,height=0,particles=[],raf=0,previous=0;
  const random=(a,b)=>a+Math.random()*(b-a);
  function resize(){
    const rect=canvas.getBoundingClientRect(); width=rect.width;height=rect.height;
    const dpr=Math.min(devicePixelRatio||1,2);
    canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
    context.setTransform(dpr,0,0,dpr,0,0);
    particles=Array.from({length:width<600?30:65},()=>({x:random(0,width),y:random(0,height),r:random(.55,2),vx:random(-5,9),vy:random(-21,-7),phase:random(0,Math.PI*2),speed:random(.5,1.5)}));
    if(reduce.matches) draw(0,0);
  }
  function draw(time,dt){
    context.clearRect(0,0,width,height);
    for(const p of particles){
      p.x+=p.vx*dt;p.y+=p.vy*dt;
      if(p.y < -10){p.y=height+10;p.x=random(0,width)}
      if(p.x>width+10)p.x=-10;if(p.x < -10)p.x=width+10;
      const alpha=.18+(Math.sin(time*.0007*p.speed+p.phase)+1)*.26;
      const glow=context.createRadialGradient(p.x,p.y,0,p.x,p.y,p.r*5);
      glow.addColorStop(0,`rgba(255,236,174,${alpha})`);glow.addColorStop(.25,`rgba(255,185,68,${alpha*.6})`);glow.addColorStop(1,'rgba(255,166,50,0)');
      context.fillStyle=glow;context.beginPath();context.arc(p.x,p.y,p.r*5,0,Math.PI*2);context.fill();
      context.fillStyle=`rgba(255,236,190,${alpha})`;context.fillRect(p.x,p.y,p.r,p.r);
    }
  }
  function frame(time){draw(time,previous?Math.min((time-previous)/1000,.04):0);previous=time;raf=requestAnimationFrame(frame)}
  function sync(){cancelAnimationFrame(raf);previous=0;if(!document.hidden&&!reduce.matches)raf=requestAnimationFrame(frame);else draw(0,0)}
  new ResizeObserver(resize).observe(canvas);document.addEventListener('visibilitychange',sync);reduce.addEventListener('change',sync);resize();sync();
})();

