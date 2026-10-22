export const BURR_CHAPTERS=['初识榫卯','巧构进阶','匠心试炼'];
export const BURR_GROUPS=[[1,2,7,8],[3,4,5],[0,6]];
export const BURR_ORDER=BURR_GROUPS.flat();
const introCounts={1:3,2:4,7:5,8:6};
export const BURR_LEVELS=['三通旋解','三木初合','四木寻序','三通二','六根锁','九根锁','梅花锁','五木递解','六木巧拆'].map((name,id)=>({
 id,index:id,key:'burr-'+id,name,chapter:BURR_GROUPS.findIndex(g=>g.includes(id)),
 preview:[3,4,5].includes(id)?`assets/burr-v70/${['three','six','nine'][id-3]}-preview.webp`:id===6?'assets/burr-v68/meihua-preview.webp':id===0?'assets/burr-v62/santong-preview.webp':`assets/level-art-v35/burr-${(id-1)%3}.png`,
 solutionFile:[4,5].includes(id)?`../burr-v70/${['three','six','nine'][id-3]}-solution.json`:null,
 modelFile:[3,4,5].includes(id)?`../burr-v70/${['three','six','nine'][id-3]}-model.json`:id===6?'../burr-v68/meihua-model.json':id===0?'../burr-v67/santong-turn-model.json':null,
 sourceModel:[3,4,5].includes(id)?'user-'+['three','six','nine'][id-3]:id===6?'user-meihua':id===0?'video-santong-turn':'obj-burr'
})).map(l=>introCounts[l.id]?{...l,intro:true,pieceCount:introCounts[l.id],preview:`assets/burr-intro-v72/intro-${introCounts[l.id]}-preview.webp`,modelFile:`../burr-intro-v72/intro-${introCounts[l.id]}-model.json`,solutionFile:`../burr-intro-v72/intro-${introCounts[l.id]}-solution.json`,sourceModel:'intro-'+introCounts[l.id]}:l);
