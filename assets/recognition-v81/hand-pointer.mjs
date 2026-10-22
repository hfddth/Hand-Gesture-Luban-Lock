const atlas=new URL('../gesture-gloves/cartoon-glove-gestures.png',import.meta.url).href;
const crops={point:'40 130 455 450',grabbed:'610 140 380 450',rotate:'1650 140 500 450'};
// White glove poses share the existing game artwork and a golden selection halo.
export function createHandPointer(id='handPointer'){
 const element=document.getElementById(id)||document.createElement('span');element.id=id;element.setAttribute('aria-hidden','true');document.documentElement.append(element);
 Object.assign(element.style,{position:'fixed',zIndex:'10000',width:'56px',height:'56px',borderRadius:'0',border:'0',background:'none',boxShadow:'none',transform:'translate(-50%,-50%)',pointerEvents:'none',margin:'0',padding:'0',inset:'auto',maxWidth:'none',opacity:'1',overflow:'visible'});
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('width','100%');svg.setAttribute('height','100%');svg.style.display='block';
 const artwork=document.createElementNS(svg.namespaceURI,'image');artwork.setAttribute('href',atlas);artwork.setAttribute('width','2172');artwork.setAttribute('height','724');svg.append(artwork);
 const contact=document.createElementNS(svg.namespaceURI,'svg');contact.setAttribute('viewBox','0 0 64 64');contact.setAttribute('aria-hidden','true');Object.assign(contact.style,{position:'absolute',inset:'0',width:'100%',height:'100%',overflow:'visible'});contact.innerHTML='<g stroke="#b47726" stroke-width="1.4" fill="#ffe49a" stroke-linejoin="round"><path d="M48 12 Q55 4 58 8 Q59 12 49 15Z"/><path d="M50 20 Q63 17 62 23 Q60 27 50 23Z"/><path d="M49 28 Q59 30 56 34 Q52 36 47 29Z"/></g>';
 const badge=document.createElement('span');badge.textContent='已抓取';badge.dataset.grabBadge='true';Object.assign(badge.style,{position:'absolute',left:'50%',top:'100%',transform:'translateX(-50%)',whiteSpace:'nowrap',fontFamily:'KaiTi,STKaiti,serif',lineHeight:'1.3',color:'#ffe8b0',background:'#211b12ed',border:'1px solid #d7a657',borderRadius:'4px',padding:'2px 6px',boxShadow:'0 0 8px #ffc85b55',letterSpacing:'1px'});
 element.replaceChildren(svg,contact,badge);
 function hide(){element.hidden=true;element.style.display='none';element.dataset.state='hidden';}
 function update(pointer,held=false,visible=true,rotating=false){
  if(!visible||!pointer||!Number.isFinite(pointer.x)||!Number.isFinite(pointer.y)){hide();return;}
  const state=rotating?'rotate':held?'grabbed':'point',scale=Math.max(.5,Math.min(1,innerWidth/1672,innerHeight/941)),size=(held?64:56)*Math.max(.5,Math.min(1,innerWidth/1672,innerHeight/941));element.hidden=false;element.style.display='block';element.style.width=element.style.height=size+'px';element.style.left=pointer.x*innerWidth+'px';element.style.top=pointer.y*innerHeight+'px';element.dataset.state=state;svg.setAttribute('viewBox',crops[state]);contact.style.display=badge.style.display=state==='grabbed'?'block':'none';badge.style.fontSize=14*scale+'px';element.style.filter=held?'drop-shadow(0 0 3px #ffdf8c) drop-shadow(0 0 9px #ffbc4bbf)':'drop-shadow(0 2px 2px #0009) drop-shadow(0 0 4px #ffdc8073)';
 }
 addEventListener('blur',hide);addEventListener('pagehide',hide);hide();return {element,update,hide};
}

