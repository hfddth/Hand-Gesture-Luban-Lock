const records=[
 ['goose','大雁','雁过长空','舒展两翼，观察身体与翅尖的方向。'],
 ['rabbit','兔子','月下玉兔','留意双耳之间的距离与兔子的侧脸。'],
 ['butterfly','蝴蝶','蝶舞花间','让两侧翅膀展开，保持轮廓平衡。'],
 ['snail','蜗牛','蜗行听雨','观察圆拱的背部与前方两根触角。'],
 ['owl','猫头鹰','林间守夜','观察头部两侧的尖角与对称的边缘。'],
 ['dog','狗','灵犬望月','观察鼻尖、耳朵和下颌的方向。'],
 ['fox','狐狸','狐影寻踪','注意尖耳、长嘴与轮廓的转折。'],
 ['crab','螃蟹','蟹行碧波','展开两侧足部，注意中间钳子的形状。'],
 ['deer','鹿','鹿鸣幽谷','舒展鹿角，让枝杈层次清晰。'],
 ['pegasus','飞马','天马逐光','观察马头、翅膀与身形的组合。']
];
export const SHADOW_LEVELS=records.map(([id,animal,name,hint],index)=>({id,animal,name,hint,index,chapter:index<4?'灯下初影':index<7?'影随心生':'万象入画',threshold:70,holdMs:1000,target:`assets/shadow-v58/targets-v59/${id}.svg`,mask:`assets/shadow-v58/targets-v59/${id}.json`,reference:`assets/shadow-v58/references/${id}.webp`,artwork:`assets/shadow-v58/artwork-v59/${id}.webp`}));
Object.assign(SHADOW_LEVELS[0],{animal:'鸽子',name:'鸽影展翅',target:'assets/shadow-v92/bird.svg',mask:'assets/shadow-v92/bird.json',preview:'assets/shadow-v92/bird-preview.svg'});
export const SHADOW_CHAPTERS=['灯下初影','影随心生','万象入画'];
