import {SHADOW_LEVELS} from '../shadow-v58/levels.mjs?v=59';
import {REPAIR_LEVELS} from '../repair/campaign-levels.mjs?v=53';
import {isComplete,reports} from './progress.mjs';
const $=id=>document.getElementById(id),titles={burr:'榫卯解谜',repair:'机关修复',shadow:'榫影成画'};
const catalog={
 burr:['三通初合','六木相制','十字连环','九木巧结','玲珑藏机','匠心初试'].map((name,index)=>({id:'burr-'+index,index,name,image:index===0?'assets/burr-v62/santong-preview.webp':'assets/mode-art-v21/burr-art.svg'})),
 repair:REPAIR_LEVELS.map(l=>({...l,image:`assets/repair/previews-v41/level-${l.index+1}.webp`})),
 shadow:SHADOW_LEVELS.map(l=>({...l,image:l.artwork}))
};
let mode='burr',selected=null;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function fit(){document.documentElement.style.setProperty('--fit',Math.min(innerWidth/1692,innerHeight/930));$('landscapePrompt').hidden=!(innerWidth<innerHeight&&innerWidth<900&&matchMedia('(pointer:coarse)').matches);}addEventListener('resize',fit);fit();
function savedPicture(l){const value=reports()[mode+':'+l.id]?.picture;return typeof value==='string'&&/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(value)?value:l.image;}
function unlocked(l,m=mode){return isComplete(m,l.id,l.index);}
function render(){
 const levels=catalog[mode],done=levels.filter(l=>unlocked(l)).length,total=Object.entries(catalog).reduce((n,[m,items])=>n+items.filter(l=>unlocked(l,m)).length,0);
 $('totalProgress').textContent=`已收录 ${total} / ${Object.values(catalog).flat().length} 份匠心印记`;
 $('categoryTitle').textContent=titles[mode];$('categoryProgress').textContent=`已完成 ${done} / ${levels.length}`;
 document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===mode)));
 if(!levels.some(l=>l.id===selected))selected=(levels.find(l=>unlocked(l))||levels[0]).id;
 $('collectionGrid').innerHTML=levels.map(l=>{const done=unlocked(l);return `<button class="entry-card ${done?'':'locked'}" data-id="${esc(l.id)}" aria-pressed="${l.id===selected}" aria-label="第${l.index+1}关，${done?esc(l.name):'待完成'}">${done?`<img src="${esc(savedPicture(l))}" alt="${esc(l.name)}" loading="lazy">`:'<span class="locked-picture" aria-hidden="true">◇</span>'}<strong>${done?esc(l.name):'待完成'}</strong><small>第 ${l.index+1} 关 · ${done?'已收录':'尚未解锁'}</small></button>`;}).join('');
 showReport();
}
function showReport(){
 const l=catalog[mode].find(l=>l.id===selected),panel=$('report');
 if(!unlocked(l)){panel.innerHTML='<div class="empty-report"><div class="seal">待完成</div><h2>静候你的匠心</h2><p>完成这一关后，<br>名字、图片与通关报告将自动收录。</p></div>';return;}
 const r=reports()[mode+':'+l.id],rows=[['通关结果','已完成']];
 if(r?.completedAt&&Number.isFinite(Date.parse(r.completedAt)))rows.push(['最近完成',new Date(r.completedAt).toLocaleString('zh-CN',{hour12:false})]);
 if(Number.isFinite(r?.score))rows.push(['匹配度',Math.floor(r.score)+'%']);
 if(Number.isFinite(r?.holdMs))rows.push(['稳定保持',(r.holdMs/1000).toFixed(1)+' 秒']);
 if(Number.isInteger(r?.installedCount))rows.push(['安装构件',r.installedCount+' 件']);
 if(Number.isInteger(r?.attempts))rows.push(['启动次数',r.attempts+' 次']);
 if(Number.isInteger(r?.hints))rows.push(['线索使用',r.hints+' 次']);
 const picture=savedPicture(l);
 panel.innerHTML=`<p class="eyebrow">${esc(titles[mode])} · 第 ${l.index+1} 关</p><h2>${esc(l.name)}</h2><img class="report-picture" src="${esc(picture)}" alt="${esc(l.name)}的完成图片"><h3>通关报告</h3><dl>${rows.map(([k,v])=>`<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>${l.goal?`<p>${esc(l.goal)}</p>`:''}${l.lesson?`<p class="report-caption">机关心得 · ${esc(l.lesson)}</p>`:''}<p class="report-caption">${r?'完成关卡时自动记录；图片与报告已收录。':'来自已有通关记录；历史详细数据未记录。'}</p>`;
}
document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{mode=b.dataset.mode;selected=null;render();$('collectionGrid').scrollTop=0;});
 $('collectionGrid').onclick=e=>{const b=e.target.closest('[data-id]');if(b){selected=b.dataset.id;document.querySelectorAll('[data-id]').forEach(c=>c.setAttribute('aria-pressed',String(c===b)));showReport();}};
addEventListener('storage',render);addEventListener('sunju-progress',render);addEventListener('pageshow',render);render();

