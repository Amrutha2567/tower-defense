import './style.css';

const TAU = Math.PI * 2;
const W = 1100, H = 680;
const PATH = [
  {x:-40,y:155},{x:150,y:155},{x:150,y:285},{x:330,y:285},{x:330,y:130},
  {x:535,y:130},{x:535,y:350},{x:760,y:350},{x:760,y:205},{x:960,y:205},{x:960,y:500},{x:1120,y:500}
];
const TOWER_DEFS = {
  cannon:{name:'Cannon',cost:90,color:'#f6a623',range:115,damage:42,rate:.72,projSpeed:460,splash:42,kind:'splash',desc:'Heavy splash damage'},
  frost:{name:'Frost',cost:120,color:'#6bdcff',range:105,damage:14,rate:.36,projSpeed:520,slow:.42,slowTime:1.7,kind:'slow',desc:'Slows enemies'},
  tesla:{name:'Tesla',cost:155,color:'#d99cff',range:150,damage:27,rate:.48,projSpeed:720,chain:3,kind:'chain',desc:'Chains lightning'}
};
const ENEMY_DEFS = {
  scout:{name:'Scout',hp:55,speed:100,reward:7,score:8,r:10,color:'#70e0a5'},
  brute:{name:'Brute',hp:260,speed:48,reward:18,score:24,r:15,color:'#ff9c62'},
  runner:{name:'Runner',hp:95,speed:150,reward:11,score:14,r:9,color:'#ffe06b'},
  tank:{name:'Tank',hp:850,speed:30,reward:35,score:60,r:20,color:'#ff6d8b'}
};

const app = document.querySelector('#app');
app.innerHTML = `
<div class="shell">
<header><div><div class="eyebrow">FORTRESS 50</div><h1>Last Bastion</h1><p>Build smart. Survive 50 waves.</p></div><div class="header-actions"><button id="pauseBtn">Ⅱ Pause</button><button id="restartBtn" class="ghost">↻ Restart</button></div></header>
<div class="stats"><div><span>WAVE</span><b id="wave">1 / 50</b></div><div><span>BASE</span><b id="hp">100</b></div><div><span>GOLD</span><b id="gold">350</b></div><div><span>SCORE</span><b id="score">0</b></div><div><span>ENEMIES</span><b id="enemyCount">0</b></div><div><span>FPS</span><b id="fps">60</b></div></div>
<main><section class="game-wrap"><canvas id="game" width="1100" height="680"></canvas><div id="toast" class="toast"></div><div id="overlay" class="overlay hidden"></div></section>
<aside><div class="panel"><h2>Arsenal</h2><div id="towerButtons"></div></div><div class="panel"><h2>Selected Tower</h2><div id="selected">Click a tower to inspect it.</div></div><div class="panel"><h2>Controls</h2><div class="controls"><span>1 2 3</span> Select tower<br><span>Esc</span> Cancel placement<br><span>Space</span> Pause<br><span>+ / −</span> Game speed</div><div class="speed"><button data-speed="0.5">0.5×</button><button data-speed="1">1×</button><button data-speed="1.5">1.5×</button><button data-speed="2">2×</button></div></div><div class="panel benchmark"><h2>Stress Lab</h2><p>Measure the engine with deterministic loads. Results feed <code>NUMBERS.md</code>.</p><div class="stress-row"><label>Enemies <input id="stressEnemies" type="number" value="5000" min="100" max="10000" step="100"></label><label>Towers <input id="stressTowers" type="number" value="100" min="10" max="200" step="10"></label><label>Projectiles <input id="stressProjectiles" type="number" value="1000" min="100" max="3000" step="100"></label></div><button id="stressBtn" class="full">Run 10s Stress Test</button><div id="stressResult">No benchmark yet.</div></div></aside></main>
<footer>Canvas 2D • object pools • spatial hash • fixed-step simulation • visibility culling</footer></div>`;

const canvas = document.querySelector('#game'), ctx = canvas.getContext('2d', {alpha:false});
const waveEl=document.querySelector('#wave'), hpEl=document.querySelector('#hp'), goldEl=document.querySelector('#gold'), scoreEl=document.querySelector('#score'), enemyCountEl=document.querySelector('#enemyCount'), fpsEl=document.querySelector('#fps');
const overlay=document.querySelector('#overlay'), toast=document.querySelector('#toast'), selectedEl=document.querySelector('#selected');
const towerButtons=document.querySelector('#towerButtons');

const state={gold:350,hp:100,score:0,wave:1,running:true,paused:false,speed:1,selectedType:null,selectedTower:null,placement:null,waveActive:false,waveSpawned:0,waveTotal:0,waveTimer:1.5,between:0,gameOver:false,victory:false,stress:false};
const towers=[], enemies=[], projectiles=[];
const pools={enemy:[],projectile:[]};
const spatial=new Map();
let last=performance.now(), accumulator=0, fpsFrames=0, fpsTime=0, fps=60, stressTimer=0, stressStartFrames=0;
const FIXED=1/60;

function mkTowerButtons(){
  for(const [id,d] of Object.entries(TOWER_DEFS)){
    const b=document.createElement('button'); b.className='tower-card'; b.innerHTML=`<div class="tower-icon" style="--c:${d.color}">${id==='cannon'?'✦':id==='frost'?'❄':'ϟ'}</div><div><b>${d.name}</b><small>${d.desc}</small></div><strong>$${d.cost}</strong>`;
    b.onclick=()=>{state.selectedType=id;state.selectedTower=null;updateSelected();toastMsg(`Place ${d.name}: click a build pad`)}; towerButtons.appendChild(b);
  }
}
mkTowerButtons();

function dist(a,b){const dx=a.x-b.x,dy=a.y-b.y;return Math.hypot(dx,dy)}
function pathPos(t){let rem=t; for(let i=0;i<PATH.length-1;i++){const a=PATH[i],b=PATH[i+1],len=dist(a,b);if(rem<=len){const q=rem/len;return {x:a.x+(b.x-a.x)*q,y:a.y+(b.y-a.y)*q};}rem-=len;}return PATH[PATH.length-1];}
const PATH_LEN=PATH.slice(1).reduce((s,p,i)=>s+dist(PATH[i],p),0);
function enemyMaxHp(type){return ENEMY_DEFS[type].hp*(1+state.wave*.075)}
function spawnEnemy(type){let e=pools.enemy.pop();if(!e)e={};const d=ENEMY_DEFS[type];e.type=type;e.hp=enemyMaxHp(type);e.maxHp=e.hp;e.progress=0;e.slow=0;e.dead=false;e.x=PATH[0].x;e.y=PATH[0].y;e.r=d.r;e.speed=d.speed*(1+Math.min(.5,state.wave*.006));e.reward=d.reward;e.score=d.score;e.id=Math.random();enemies.push(e);}
function spawnWave(){state.waveActive=true;state.waveSpawned=0;state.waveTotal=Math.floor(10+state.wave*2.5+Math.pow(state.wave,1.28));state.waveTimer=0;toastMsg(`Wave ${state.wave} incoming — ${state.waveTotal} enemies`);}
function pickEnemyType(i){if(state.wave<4)return 'scout';const r=Math.random();if(state.wave<10)return r<.18?'runner':'scout';if(state.wave<20)return r<.15?'brute':r<.32?'runner':'scout';return r<.12?'tank':r<.28?'brute':r<.5?'runner':'scout';}
function towerCost(t){return Math.floor(t.baseCost*Math.pow(1.65,t.level-1))}
function upgradeCost(t){return Math.floor(t.baseCost*(.72)*Math.pow(1.65,t.level-1))}
function placeTower(x,y,type){const d=TOWER_DEFS[type];if(state.gold<d.cost)return toastMsg('Not enough gold');if(towers.some(t=>dist(t,{x,y})<48))return toastMsg('Too close to another tower');if(y<45||y>635)return toastMsg('Invalid build location');const t={x,y,type,level:1,baseCost:d.cost,range:d.range,damage:d.damage,rate:d.rate,cool:0,totalKills:0};towers.push(t);state.gold-=d.cost;state.selectedTower=t;state.selectedType=null;updateSelected();}
function sellTower(t){state.gold+=Math.floor(t.baseCost*(.55+.1*(t.level-1)));const i=towers.indexOf(t);if(i>=0)towers.splice(i,1);state.selectedTower=null;updateSelected();}
function upgradeTower(t){const c=upgradeCost(t);if(state.gold<c)return toastMsg('Not enough gold');if(t.level>=5)return toastMsg('Max level');state.gold-=c;t.level++;t.range*=1.09;t.damage*=1.27;t.rate*=.94;updateSelected();toastMsg('Tower upgraded');}
function updateSelected(){if(!state.selectedTower){selectedEl.innerHTML=state.selectedType?`<b>Placement mode</b><p>${TOWER_DEFS[state.selectedType].desc}. Click the map to build.</p>`:'Click a tower to inspect it.';return}const t=state.selectedTower,d=TOWER_DEFS[t.type];selectedEl.innerHTML=`<div class="sel-title"><b>${d.name} Lv.${t.level}</b><span>${t.totalKills} kills</span></div><p>Damage ${Math.round(t.damage)} • Range ${Math.round(t.range)} • Fire ${t.rate.toFixed(2)}s</p><div class="sel-actions"><button id="up">Upgrade $${upgradeCost(t)}</button><button id="sell" class="ghost">Sell $${Math.floor(t.baseCost*(.55+.1*(t.level-1)))}</button></div>`;document.querySelector('#up').onclick=()=>upgradeTower(t);document.querySelector('#sell').onclick=()=>sellTower(t);}
function toastMsg(s){toast.textContent=s;toast.classList.add('show');clearTimeout(toast._t);toast._t=setTimeout(()=>toast.classList.remove('show'),1800)}

function rebuildSpatial(){spatial.clear();const cell=80;for(const e of enemies){if(e.dead)continue;const cx=Math.floor(e.x/cell),cy=Math.floor(e.y/cell),k=cx+','+cy;let a=spatial.get(k);if(!a)spatial.set(k,a=[]);a.push(e)}}
function nearby(x,y,r){const cell=80,out=[];const x0=Math.floor((x-r)/cell),x1=Math.floor((x+r)/cell),y0=Math.floor((y-r)/cell),y1=Math.floor((y+r)/cell);for(let cy=y0;cy<=y1;cy++)for(let cx=x0;cx<=x1;cx++){const a=spatial.get(cx+','+cy);if(a)for(const e of a){const dx=e.x-x,dy=e.y-y;if(dx*dx+dy*dy<=r*r&&!e.dead)out.push(e)}}return out}
function acquireTarget(t){const candidates=nearby(t.x,t.y,t.range);let best=null,bestP=-1;for(const e of candidates)if(e.progress>bestP){best=e;bestP=e.progress}return best}
function fire(t,target){const d=TOWER_DEFS[t.type];let p=pools.projectile.pop();if(!p)p={};p.x=t.x;p.y=t.y;p.tx=target.x;p.ty=target.y;p.target=target;p.speed=d.projSpeed;p.damage=t.damage;p.type=t.type;p.life=2;p.dead=false;p.tower=t;projectiles.push(p)}
function hitProjectile(p){const t=p.tower,d=TOWER_DEFS[p.type],target=p.target;if(!target||target.dead){p.dead=true;return}target.hp-=p.damage;if(p.type==='cannon'){for(const e of nearby(target.x,target.y,d.splash))if(e!==target)e.hp-=p.damage*.45}if(p.type==='frost')target.slow=Math.max(target.slow,d.slowTime);if(p.type==='tesla'){for(const e of nearby(target.x,target.y,75)){if(e!==target){e.hp-=p.damage*.42;e.slow=.25}}}p.dead=true}
function killEnemy(e){if(e.dead)return;e.dead=true;state.gold+=e.reward;state.score+=e.score;if(state.selectedTower)state.selectedTower.totalKills++;}
function updateSimulation(dt){
  if(state.gameOver||state.victory)return;
  state.waveTimer-=dt;
  if(!state.waveActive&&state.waveTimer<=0)spawnWave();
  if(state.waveActive){const interval=Math.max(.045,.24-state.wave*.0022);while(state.waveSpawned<state.waveTotal&&state.waveTimer<=0){spawnEnemy(pickEnemyType(state.waveSpawned));state.waveSpawned++;state.waveTimer+=interval}if(state.waveSpawned>=state.waveTotal&&enemies.length===0){state.waveActive=false;if(state.wave>=50){state.victory=true;showEnd(true)}else{state.wave++;state.waveTimer=3;state.gold+=45+state.wave*2;toastMsg(`Wave cleared! +${45+state.wave*2} gold`)}}}
  for(const e of enemies){if(e.dead)continue;e.slow=Math.max(0,e.slow-dt);const speed=e.speed*(e.slow>0?.48:1);e.progress+=speed*dt;const p=pathPos(e.progress);e.x=p.x;e.y=p.y;if(e.progress>=PATH_LEN){e.dead=true;state.hp-=e.type==='tank'?12:e.type==='brute'?5:2;if(state.hp<=0){state.hp=0;state.gameOver=true;showEnd(false)}}}
  rebuildSpatial();
  for(const t of towers){t.cool-=dt;if(t.cool<=0){const target=acquireTarget(t);if(target){fire(t,target);t.cool=t.rate}}}
  for(const p of projectiles){if(p.dead)continue;p.life-=dt;if(p.life<=0){p.dead=true;continue}const target=p.target;if(!target||target.dead){p.dead=true;continue}p.tx=target.x;p.ty=target.y;const dx=target.x-p.x,dy=target.y-p.y,d=Math.hypot(dx,dy),step=p.speed*dt;if(d<=step){p.x=target.x;p.y=target.y;hitProjectile(p)}else{p.x+=dx/d*step;p.y+=dy/d*step}};
  compact(enemies,pools.enemy);compact(projectiles,pools.projectile);
}
function compact(arr,pool){let w=0;for(let r=0;r<arr.length;r++){const o=arr[r];if(o.dead)pool.push(o);else arr[w++]=o}arr.length=w}

function draw(){ctx.fillStyle='#08111d';ctx.fillRect(0,0,W,H);drawGrid();drawPath();drawBase();for(const t of towers)drawTower(t);for(const e of enemies){if(e.x<-30||e.x>W+30||e.y<-30||e.y>H+30)continue;drawEnemy(e)}for(const p of projectiles){if(p.x<-20||p.x>W+20||p.y<-20||p.y>H+20)continue;drawProjectile(p)}if(state.placement)drawPlacement();if(state.selectedTower){ctx.strokeStyle='rgba(140,220,255,.25)';ctx.lineWidth=2;ctx.beginPath();ctx.arc(state.selectedTower.x,state.selectedTower.y,state.selectedTower.range,0,TAU);ctx.stroke()}}
function drawGrid(){ctx.strokeStyle='rgba(255,255,255,.035)';ctx.lineWidth=1;for(let x=0;x<W;x+=40){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke()}for(let y=0;y<H;y+=40){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke()}}
function drawPath(){ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle='#17283a';ctx.lineWidth=62;ctx.beginPath();ctx.moveTo(PATH[0].x,PATH[0].y);for(let i=1;i<PATH.length;i++)ctx.lineTo(PATH[i].x,PATH[i].y);ctx.stroke();ctx.strokeStyle='#284158';ctx.lineWidth=54;ctx.stroke();ctx.setLineDash([9,14]);ctx.strokeStyle='#38566d';ctx.lineWidth=2;ctx.stroke();ctx.setLineDash([])}
function drawBase(){ctx.save();ctx.translate(1045,500);ctx.fillStyle='#0f2435';ctx.beginPath();ctx.arc(0,0,40,0,TAU);ctx.fill();ctx.strokeStyle='#55e5ff';ctx.lineWidth=3;ctx.stroke();ctx.fillStyle='#55e5ff';ctx.fillRect(-10,-17,20,34);ctx.restore()}
function drawTower(t){const d=TOWER_DEFS[t.type];ctx.save();ctx.translate(t.x,t.y);ctx.fillStyle='rgba(0,0,0,.3)';ctx.beginPath();ctx.ellipse(0,14,24,9,0,0,TAU);ctx.fill();ctx.fillStyle='#14283a';ctx.beginPath();ctx.arc(0,0,23,0,TAU);ctx.fill();ctx.strokeStyle=d.color;ctx.lineWidth=3;ctx.stroke();ctx.rotate(t.cool>0?0:Math.PI/8);ctx.fillStyle=d.color;ctx.fillRect(-5,-19,10,28);ctx.restore();ctx.fillStyle='#d7f3ff';ctx.font='bold 11px Inter, sans-serif';ctx.textAlign='center';ctx.fillText(t.level,t.x,t.y+4)}
function drawEnemy(e){const d=ENEMY_DEFS[e.type];ctx.fillStyle='rgba(0,0,0,.25)';ctx.beginPath();ctx.ellipse(e.x,e.y+e.r*.75,e.r,4,0,0,TAU);ctx.fill();ctx.fillStyle=d.color;ctx.beginPath();ctx.arc(e.x,e.y,e.r,0,TAU);ctx.fill();if(e.type==='tank'){ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.stroke()}const bw=e.r*2.5;ctx.fillStyle='#101b27';ctx.fillRect(e.x-bw/2,e.y-e.r-8,bw,4);ctx.fillStyle='#63e6a7';ctx.fillRect(e.x-bw/2,e.y-e.r-8,bw*Math.max(0,e.hp/e.maxHp),4);if(e.slow>0){ctx.strokeStyle='#6bdcff';ctx.lineWidth=2;ctx.beginPath();ctx.arc(e.x,e.y,e.r+3,0,TAU);ctx.stroke()}}
function drawProjectile(p){ctx.fillStyle=TOWER_DEFS[p.type].color;ctx.beginPath();ctx.arc(p.x,p.y,p.type==='cannon'?5:3,0,TAU);ctx.fill()}
function drawPlacement(){const m=state.placement;ctx.globalAlpha=.65;ctx.strokeStyle=m.valid?'#63e6a7':'#ff6d8b';ctx.lineWidth=2;ctx.beginPath();ctx.arc(m.x,m.y,TOWER_DEFS[m.type].range,0,TAU);ctx.stroke();ctx.fillStyle=m.valid?'rgba(99,230,167,.13)':'rgba(255,109,139,.13)';ctx.fill();ctx.globalAlpha=1}

function updateHUD(){waveEl.textContent=`${Math.min(state.wave,50)} / 50`;hpEl.textContent=state.hp;goldEl.textContent=state.gold;scoreEl.textContent=state.score;enemyCountEl.textContent=enemies.length;fpsEl.textContent=Math.round(fps)}
function showEnd(win){overlay.classList.remove('hidden');overlay.innerHTML=`<div class="end"><div class="end-kicker">${win?'VICTORY':'FORTRESS FALLEN'}</div><h2>${win?'50 waves conquered.':'The base has been breached.'}</h2><p>Score <b>${state.score.toLocaleString()}</b> • Gold <b>${state.gold.toLocaleString()}</b></p><button id="endRestart">Play Again</button></div>`;document.querySelector('#endRestart').onclick=restart}
function restart(){for(const e of enemies)pools.enemy.push(e);for(const p of projectiles)pools.projectile.push(p);enemies.length=0;projectiles.length=0;towers.length=0;Object.assign(state,{gold:350,hp:100,score:0,wave:1,running:true,paused:false,speed:1,selectedType:null,selectedTower:null,placement:null,waveActive:false,waveSpawned:0,waveTotal:0,waveTimer:1.5,gameOver:false,victory:false,stress:false});overlay.classList.add('hidden');document.querySelector('#pauseBtn').textContent='Ⅱ Pause';updateSelected();toastMsg('New run started')}
function togglePause(){state.paused=!state.paused;document.querySelector('#pauseBtn').textContent=state.paused?'▶ Resume':'Ⅱ Pause'}

canvas.addEventListener('mousemove',e=>{const r=canvas.getBoundingClientRect();const x=(e.clientX-r.left)*W/r.width,y=(e.clientY-r.top)*H/r.height;if(state.selectedType){const valid=!towers.some(t=>dist(t,{x,y})<48)&&x>0&&x<W&&y>45&&y<635;state.placement={x,y,type:state.selectedType,valid}}});
canvas.addEventListener('mouseleave',()=>{state.placement=null});
canvas.addEventListener('click',e=>{const r=canvas.getBoundingClientRect();const x=(e.clientX-r.left)*W/r.width,y=(e.clientY-r.top)*H/r.height;if(state.selectedType){const valid=!towers.some(t=>dist(t,{x,y})<48)&&x>0&&x<W&&y>45&&y<635;if(valid)placeTower(x,y,state.selectedType);return}let hit=null;for(const t of towers)if(dist(t,{x,y})<25){hit=t;break}state.selectedTower=hit;updateSelected()});
document.querySelector('#pauseBtn').onclick=togglePause;document.querySelector('#restartBtn').onclick=restart;document.querySelectorAll('[data-speed]').forEach(b=>b.onclick=()=>{state.speed=+b.dataset.speed;toastMsg(`Game speed ${state.speed}×`)});
window.addEventListener('keydown',e=>{if(e.code==='Space'){e.preventDefault();togglePause()}if(e.key==='Escape'){state.selectedType=null;state.placement=null;updateSelected()}if(e.key==='1')state.selectedType='cannon';if(e.key==='2')state.selectedType='frost';if(e.key==='3')state.selectedType='tesla';if(e.key==='+'||e.key==='=')state.speed=Math.min(2,state.speed+.5);if(e.key==='-')state.speed=Math.max(.5,state.speed-.5);});

function makeStress(){state.stress=true;state.paused=false;state.gameOver=false;state.victory=false;state.waveActive=true;for(const e of enemies)pools.enemy.push(e);for(const p of projectiles)pools.projectile.push(p);enemies.length=0;projectiles.length=0;towers.length=0;const n=+document.querySelector('#stressEnemies').value,nt=+document.querySelector('#stressTowers').value,np=+document.querySelector('#stressProjectiles').value;for(let i=0;i<n;i++){const type=i%20===0?'tank':i%5===0?'brute':i%3===0?'runner':'scout';spawnEnemy(type);const e=enemies[enemies.length-1];e.progress=(i/n)*PATH_LEN;e.x=pathPos(e.progress).x;e.y=pathPos(e.progress).y}for(let i=0;i<nt;i++){const a=(i/nt)*TAU*4;const x=80+((i*97)%940),y=55+((i*53)%570);towers.push({x,y,type:['cannon','frost','tesla'][i%3],level:3,baseCost:100,range:110,damage:35,rate:.4,cool:Math.random()*.4,totalKills:0})}for(let i=0;i<np;i++){let p=pools.projectile.pop()||{};p.x=(i*31)%W;p.y=(i*47)%H;p.target=enemies[i%n];p.speed=500;p.damage=3;p.type=['cannon','frost','tesla'][i%3];p.life=1.2;p.dead=false;p.tower=towers[i%nt];projectiles.push(p)}stressTimer=10;stressStartFrames=0;document.querySelector('#stressResult').textContent='Running…';toastMsg(`Stress test: ${n.toLocaleString()} enemies / ${nt} towers / ${np.toLocaleString()} projectiles`)}
document.querySelector('#stressBtn').onclick=makeStress;

function loop(now){const raw=Math.min(.1,(now-last)/1000);last=now;fpsFrames++;fpsTime+=raw;if(fpsTime>=.5){fps=fpsFrames/fpsTime;fpsFrames=0;fpsTime=0}if(!state.paused&&!state.gameOver&&!state.victory){accumulator+=raw*state.speed;let steps=0;while(accumulator>=FIXED&&steps<8){updateSimulation(FIXED);accumulator-=FIXED;steps++}}draw();updateHUD();if(state.stress){stressTimer-=raw;stressStartFrames++;if(stressTimer<=0){state.stress=false;const result=document.querySelector('#stressResult');result.innerHTML=`<b>${Math.round(fps)} FPS</b> final sample • ${enemies.length.toLocaleString()} enemies • ${towers.length} towers • ${projectiles.length.toLocaleString()} projectiles`;toastMsg('Stress test complete');state.paused=true}}requestAnimationFrame(loop)}

updateSelected();requestAnimationFrame(loop);
