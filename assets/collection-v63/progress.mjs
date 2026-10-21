const REPORT_KEY='sunju-collection-reports-v1';
export function readJSON(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}}
export function reports(){const value=readJSON(REPORT_KEY,{});return value&&typeof value==='object'&&!Array.isArray(value)?value:{};}
export function recordCompletion(mode,id,details={}){
  if(!['burr','repair','shadow'].includes(mode)||typeof id!=='string')return;
  const all=reports(),key=mode+':'+id,previous=all[key];
  const entry={completedAt:new Date().toISOString(),...details};
  all[key]={...entry,firstCompletedAt:previous?.firstCompletedAt||entry.completedAt};
  try{localStorage.setItem(REPORT_KEY,JSON.stringify(all));dispatchEvent(new Event('sunju-progress'));}catch{}
}
export function isComplete(mode,id,index){
  const key=mode==='repair'?'sunju-repair-campaign-v2':mode==='shadow'?'sunju-shadow-complete-v1':'sunju-burr-complete-v1';
  const saved=readJSON(key,[]),report=reports()[mode+':'+id];return (Array.isArray(saved)&&saved.includes(mode==='repair'?index:id))||!!(report&&Number.isFinite(Date.parse(report.completedAt)));
}

