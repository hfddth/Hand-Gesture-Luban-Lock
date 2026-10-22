export const BURR_CHAPTERS=['初识榫卯','巧构进阶','匠心试炼'];
export const BURR_GROUPS=[[1,2,7,8],[3,4,5],[0,6]];
export const BURR_ORDER=BURR_GROUPS.flat();
const introCounts={1:3,2:4,7:5,8:6};
export const BURR_LEVELS=['三通旋解','三木初合','四木寻序','三通二','六根锁','九根锁','梅花锁','五木递解','六木巧拆'].map((name,id)=>({
 id,index:id,key:'burr-'+id,name,chapter:BURR_GROUPS.findIndex(g=>g.includes(id)),
 preview:[3,4,5].includes(id)?`assets/burr-v70/${['three','six','nine'][id-3]}-preview.webp`:id===6?'assets/burr-v68/meihua-preview.webp':id===0?'assets/burr-v62/santong-preview.webp':`assets/level-art-v35/burr-${(id-1)%3}.png`,
 solutionFile:id===0?'../burr-v67/santong-solution-v74.json':[4,5].includes(id)?`../burr-v70/${['three','six','nine'][id-3]}-solution.json`:null,
 modelFile:[3,4,5].includes(id)?`../burr-v70/${['three','six','nine'][id-3]}-model.json`:id===6?'../burr-v68/meihua-model.json':id===0?'../burr-v67/santong-turn-model.json':null,
 sourceModel:[3,4,5].includes(id)?'user-'+['three','six','nine'][id-3]:id===6?'user-meihua':id===0?'video-santong-turn':'obj-burr'
})).map(l=>introCounts[l.id]?{...l,intro:true,pieceCount:introCounts[l.id],preview:`assets/burr-intro-v75/intro-${introCounts[l.id]}-preview.webp`,modelFile:`../burr-intro-v75/intro-${introCounts[l.id]}-model.json`,solutionFile:`../burr-intro-v75/intro-${introCounts[l.id]}-solution.json`,introTitle:({1:'直接抽榫',2:'横销解锁',7:'滑块让位',8:'双挡联动'})[l.id],introCopy:({1:'先抽中央锁芯，再沿长边抽出两根榫木。',2:'先取止动销，再把长榫从两侧榫眼中抽出。',7:'取销后升起挡榫让位，抽出长榫，最后拆开榫架。',8:'先取定位销，再联动两根挡榫，让出长榫的通道。'})[l.id],sourceModel:'intro-'+introCounts[l.id]}:l).map(l=>l.id===3?{...l,modelFile:'../burr-v76/three-model.json',solutionFile:'../burr-v76/three-solution.json',preview:'assets/burr-v76/three-preview.webp',sourceModel:'video-three-v76',translationOnly:true}:l);
