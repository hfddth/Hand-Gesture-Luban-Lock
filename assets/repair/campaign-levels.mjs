import {EXTRA_LEVELS,evaluateExtra} from './extra-levels.mjs';
const part=(id,label,kind,spec={})=>({id,label,kind,...spec});
const slot=(id,label,kind,solution,requires=[])=>({id,label,kind,solution,requires});
const bearing=()=>part('bearing','玉石轴承','bearing');
const gear=(id,n)=>part(id,`${n} 齿木轮`,'gear',{teeth:n,module:.065});
const support=()=>slot('support','轴承座','bearing','bearing');
const gearSlot=(id,solution,requires=['support'])=>slot(id,'传动轴 '+id.toUpperCase(),'gear',solution,requires);
const levels=[
{name:'水车复苏',family:'water',difficulty:1,goal:'修好支撑与传动，让水车恢复运转。',lesson:'先支撑，再传动',parts:[bearing(),gear('g16',16),part('handle','木制摇柄','crank')],slots:[support(),gearSlot('a','g16'),slot('out','输出轴','crank','handle',['a'])],fixed:24,ratio:-1.5},
{name:'双轮换向',family:'pair',difficulty:2,goal:'让右侧输出反向转动，速度为输入的 1/2。',lesson:'外啮合反向 · 大轮减速',parts:[bearing(),gear('g32',32),gear('g16',16),part('handle','输出摇柄','crank')],slots:[support(),gearSlot('a','g32'),slot('out','输出轴','crank','handle',['a'])],fixed:16,ratio:-.5},
{name:'惰轮回正',family:'idler',difficulty:2,goal:'接入中间轮，让输入与输出同向、同速。',lesson:'两次外啮合恢复同向',parts:[bearing(),gear('g12',12),gear('g24',24),part('handle','输出摇柄','crank')],slots:[support(),gearSlot('a','g12'),slot('out','末端输出','crank','handle',['a'])],fixed:24,last:24,ratio:1},
{name:'减速提水',family:'lift',difficulty:3,goal:'选择合适的大轮，让卷筒以输入的 1/3 转速提起水斗。',lesson:'齿数比决定输出速度',parts:[bearing(),gear('g36',36),gear('g24',24),gear('g12',12),part('drum','提水卷筒','drum')],slots:[support(),gearSlot('a','g36'),slot('out','卷筒轴','drum','drum',['a'])],fixed:12,ratio:-1/3},
{name:'疾风鼓扇',family:'fan',difficulty:3,goal:'让扇轮反向转动，转速达到输入的 3 倍。',lesson:'小轮增速',parts:[bearing(),gear('g12',12),gear('g24',24),gear('g36',36),part('fan','四叶木扇','fan')],slots:[support(),gearSlot('a','g12'),slot('out','扇轮轴','fan','fan',['a'])],fixed:36,ratio:-3},
{name:'复轮增力',family:'compound',difficulty:4,goal:'补全两级减速，使末端同向、转速降至 1/4。',lesson:'复合轮系 · 传动比相乘',parts:[bearing(),gear('g24',24),gear('g12',12),gear('g24b',24),gear('g18',18),part('drum','提升卷筒','drum')],slots:[support(),gearSlot('a','g24'),gearSlot('b','g24b',['a']),slot('out','末端卷筒','drum','drum',['b'])],fixed:12,compound:12,ratio:.25},
{name:'平带送粮',family:'belt',difficulty:3,goal:'等径带轮之间选择正确皮带，让两轮同向送粮。',lesson:'开口带同向 · 交叉带反向',parts:[bearing(),part('open','开口皮带','belt',{crossed:false}),part('cross','交叉皮带','belt',{crossed:true}),part('drum','送料卷筒','drum')],slots:[support(),slot('belt','双轮带槽','belt','open',['support']),slot('out','送料轴','drum','drum',['belt'])],ratio:1},
{name:'交带逆转',family:'belt-cross',difficulty:4,goal:'不增加齿轮，让右侧卷筒与输入反向转动。',lesson:'通过交叉带改变方向',parts:[bearing(),part('open','开口皮带','belt',{crossed:false}),part('cross','交叉皮带','belt',{crossed:true}),part('drum','输出卷筒','drum')],slots:[support(),slot('belt','双轮带槽','belt','cross',['support']),slot('out','输出轴','drum','drum',['belt'])],ratio:-1},
{name:'曲柄水舂',family:'slider',difficulty:4,goal:'装好滑块和足够长的连杆，让水舂连续往复、不发生卡死。',lesson:'曲柄滑块 · 连杆长度须大于偏心距',parts:[bearing(),part('slider','木制滑块','slider'),part('rod18','长连杆 1.8','rod',{length:1.8}),part('rod04','短连杆 0.4','rod',{length:.4}),part('pin','铜销','pin')],slots:[support(),slot('slide','水平导轨','slider','slider',['support']),slot('rod','连杆铰点','rod','rod18',['slide']),slot('out','固定铜销','pin','pin',['rod'])],eccentric:.55,ratio:1},
{name:'齿条升降',family:'rack',difficulty:4,goal:'选出齿距一致的齿条，让小台沿导轨平稳往返。',lesson:'齿轮与齿条模数一致',parts:[bearing(),part('rack065','标准齿条 m0.065','rack',{module:.065}),part('rack10','粗齿条 m0.10','rack',{module:.1}),part('guide','导向滑座','guide'),part('platform','升降小台','platform')],slots:[support(),slot('guide','导向座','guide','guide',['support']),slot('rack','齿条啮合位','rack','rack065',['guide']),slot('out','升降台','platform','platform',['rack'])],fixed:24,ratio:1},
{name:'偏心抬槌',family:'cam',difficulty:5,goal:'装入偏心凸轮与滚子，让木槌产生周期性的抬升。',lesson:'偏心圆把转动变为升降',parts:[bearing(),part('eccentric','偏心凸轮','cam',{eccentric:.4}),part('circle','同心圆盘','cam',{eccentric:0}),part('follower','滚子从动杆','follower'),part('hammer','木槌','hammer')],slots:[support(),slot('cam','凸轮轴','cam','eccentric',['support']),slot('follow','竖直导轨','follower','follower',['cam']),slot('out','槌头','hammer','hammer',['follow'])],ratio:1},
{name:'天工合鸣',family:'finale',difficulty:5,goal:'同时选对皮带与两级齿轮，让提升卷筒反向并以 1/4 速度工作。',lesson:'交叉带换向 × 两级减速',parts:[bearing(),part('open','开口皮带','belt',{crossed:false}),part('cross','交叉皮带','belt',{crossed:true}),gear('g24',24),gear('g24b',24),gear('g18',18),part('drum','最终提升卷筒','drum')],slots:[support(),slot('belt','动力皮带','belt','cross',['support']),gearSlot('a','g24',['belt']),gearSlot('b','g24b',['a']),slot('out','提升轴','drum','drum',['b'])],fixed:12,compound:12,ratio:-.25}
];
export const REPAIR_LEVELS=[...levels,...EXTRA_LEVELS].map((l,i)=>({...l,index:i,id:'repair-'+String(i+1).padStart(2,'0'),chapter:[0,1,2,6,12].includes(i)?'初识机关':[3,4,7,9,13].includes(i)?'巧修联动':'天工复鸣'}));
export function evaluateMechanism(level,installed){
  const get=id=>level.parts.find(p=>p.id===installed[id]),required=level.slots.find(s=>!get(s.id));if(required)return {ok:false,reason:'还有未安装的接口：'+required.label};
  for(const s of level.slots){const p=get(s.id);if(p.kind!==s.kind)return {ok:false,reason:'接口类型不匹配'};if(s.requires.some(id=>!get(id)))return {ok:false,reason:'支撑关系不完整'};}
  const extra=evaluateExtra(level,get);if(extra)return extra;
  let ratio=1;
  if(level.fixed){const a=get('a');if(a){const expected=level.parts.find(p=>p.id===level.slots.find(s=>s.id==='a').solution);if(a.teeth!==expected.teeth||a.module!==expected.module)return {ok:false,reason:'传动轮的分度圆与固定轴距不匹配，换一个齿数。'};ratio=-level.fixed/a.teeth;if(level.last)ratio*=-a.teeth/level.last;if(level.compound){const b=get('b'),target=level.parts.find(p=>p.id===level.slots.find(s=>s.id==='b').solution);if(b.teeth!==target.teeth)return {ok:false,reason:'第二级轮径与轴距不符，请重新选轮。'};ratio*=-level.compound/b.teeth;}}}
  if(get('belt'))ratio*=get('belt').crossed?-1:1;
  if(level.family==='slider'&&get('rod').length<=level.eccentric)return {ok:false,reason:'连杆短于曲柄偏心距，整圈运行会卡死；换长连杆。'};
  if(level.family==='rack'&&get('rack').module!==.065)return {ok:false,reason:'齿条与小齿轮模数不一致，无法连续啮合。'};
  if(level.family==='cam'&&get('cam').eccentric<.25)return {ok:false,reason:'同心圆盘没有足够升程，木槌无法抬起。'};
  if(Math.abs(ratio-level.ratio)>1e-8)return {ok:false,reason:`输出方向或速度不符：当前 ${ratio.toFixed(2)} 倍，目标 ${level.ratio.toFixed(2)} 倍。`};
  return {ok:true,ratio};
}
export class CampaignSession{
  constructor(level){this.level=level;this.reset();}
  reset(){this.installed={};this.history=[];this.held=null;this.status='assembly';}
  begin(id){if(this.status!=='assembly'||this.held||!this.level.parts.some(p=>p.id===id))return false;const slotId=Object.keys(this.installed).find(slot=>this.installed[slot]===id);if(slotId)this.remove(slotId);this.held=id;return true;}
  cancel(){this.held=null;}
  release(slotId){const id=this.held;this.held=null;const s=this.level.slots.find(s=>s.id===slotId),p=this.level.parts.find(p=>p.id===id);if(!s||!p)return {ok:false,reason:'未放入接口，构件已回位'};if(this.installed[slotId])return {ok:false,reason:'接口已被占用'};this.installed[s.id]=id;this.history.push(s.id);return {ok:true,id,slot:s.id};}
  remove(slotId){if(this.status!=='assembly'||!this.installed[slotId])return [];const id=this.installed[slotId];delete this.installed[slotId];this.history=this.history.filter(s=>s!==slotId);return [id];}
  verify(){const result=evaluateMechanism(this.level,this.installed);if(result.ok)this.status='running';return result;}
}
