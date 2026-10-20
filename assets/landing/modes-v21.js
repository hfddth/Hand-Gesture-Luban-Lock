const descriptions={
burr:{title:"榫卯解谜",copy:"观察榫木之间的咬合，寻找活榫，按正确顺序解开木中巧局。",steps:["转动视角，观察接缝与结构。","选中构件，沿合适的方向抽取。","逐一解除约束，完成拆解。"]},
repair:{title:"机关修复",copy:"从停转的机关中寻找故障，把缺失的构件放回合适位置，让传动重新运转。",steps:["观察故障，找到缺失或错位的构件。","抓取大构件，靠近安装点后归位。","启动机关，观察修复后的联动。"]},
shadow:{title:"榫影成画",copy:"在灯下比出影形，让手影与画中轮廓相合，唤醒屏风中的丹青故事。",steps:["观察屏风上的目标影形。","调整双手姿态，组成相应的手影。","影形相合，点亮画卷中的景物。"]}
};
const cards=[...document.querySelectorAll(".mode-card")],dialog=document.getElementById("modeDialog");
const landscapePrompt=document.createElement('div');landscapePrompt.className='landscape-prompt';landscapePrompt.innerHTML='请横屏体验<span>旋转手机，进入与电脑相同的完整界面</span>';document.documentElement.append(landscapePrompt);
function fitStage(){const w=innerWidth,h=innerHeight;const fit=true;document.documentElement.classList.toggle('fit-stage',fit);document.documentElement.style.setProperty('--stage-scale',Math.min(w/1692,h/930));landscapePrompt.hidden=!(w<h&&w<900&&matchMedia('(pointer:coarse)').matches);}
addEventListener('resize',fitStage);fitStage();
let selected="burr";try{const saved=localStorage.getItem("sunju-selected-mode");if(descriptions[saved])selected=saved;}catch{}
function choose(mode){selected=mode;cards.forEach(card=>{const active=card.dataset.mode===mode;card.classList.toggle("selected",active);card.setAttribute("aria-pressed",String(active));});document.getElementById("selectedDescription").textContent="当前选择："+descriptions[mode].title;try{localStorage.setItem("sunju-selected-mode",mode);}catch{}}
cards.forEach(card=>card.addEventListener("click",()=>choose(card.dataset.mode)));choose(selected);
document.getElementById("modeDetails").addEventListener("click",()=>{const info=descriptions[selected];document.getElementById("modeDialogTitle").textContent=info.title;document.getElementById("modeDialogCopy").textContent=info.copy;document.getElementById("modeDialogSteps").replaceChildren(...info.steps.map(text=>{const li=document.createElement("li");li.textContent=text;return li;}));dialog.showModal();});
document.querySelectorAll("#closeDetails,.dialog-close").forEach(button=>button.addEventListener("click",()=>dialog.close()));
Promise.all([...document.querySelectorAll(".mode-art")].map(img=>img.decode().catch(()=>{img.closest(".mode-scene").classList.add("image-error");}))).then(()=>{document.body.dataset.ready="true";});

