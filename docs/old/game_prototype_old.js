(() => {
  "use strict";

  const W=1280,H=720,PLAY_H=620;
  const RAW="https://raw.githubusercontent.com/Alix1211/ARPG/main/";
  const $=id=>document.getElementById(id);
  const canvas=$("gameCanvas"),ctx=canvas.getContext("2d");
  const ui={
    lives:$("lives"), wave:$("waveLabel"), waveFill:$("waveFill"), early:$("earlyBtn"),
    dp:$("dpValue"), gold:$("goldValue"), unitBar:$("unitBar"), unitPanel:$("unitPanel"),
    unitName:$("unitName"), unitStats:$("unitStats"), spFill:$("spFill"), skill:$("skillBtn"),
    upgrade:$("upgradeBtn"), retreat:$("retreatBtn"), dir:$("directionPad"), hint:$("hint"),
    start:$("startOverlay"), startBtn:$("startBtn"), result:$("resultOverlay"),
    resultTitle:$("resultTitle"), resultStats:$("resultStats"), retry:$("retryBtn"),
    speed:$("speedBtn"), pause:$("pauseBtn"), toast:$("toast")
  };

  const IMG={};
  function loadImage(key,url){const im=new Image();im.crossOrigin="anonymous";im.src=url;IMG[key]=im;return im;}
  const charBase={
    vanguard:"assets/characters/elf/",
    knight:"assets/characters/knight/",
    archer:"assets/characters/elf/",
    mage:"assets/characters/hero/"
  };
  for(const [k,path] of Object.entries(charBase)){
    loadImage(k+"_front",RAW+path+"front_0.png");
    loadImage(k+"_back",RAW+path+"back_0.png");
    loadImage(k+"_side",RAW+path+"side_0.png");
  }
  for(let i=1;i<=7;i++) loadImage("atlas"+i,RAW+`source_sheets/monster_v2/monster_v2_${i}.png`);
  loadImage("tree",RAW+"assets/field_props/spring/01_tree_big.png");
  loadImage("bush",RAW+"assets/field_props/spring/05_bush.png");
  loadImage("rock",RAW+"assets/field_props/spring/07_rock_big.png");
  loadImage("flowers",RAW+"assets/field_props/spring/11_flowers.png");

  const audio={
    bow:new Audio(RAW+"assets/sfx/bow.mp3"),
    slash:new Audio(RAW+"assets/sfx/slash.ogg"),
    staff:new Audio(RAW+"assets/sfx/staff.ogg"),
    thrust:new Audio(RAW+"assets/sfx/thrust.ogg"),
    hit:new Audio(RAW+"assets/sfx/hit.ogg")
  };
  Object.values(audio).forEach(a=>{a.volume=.18;a.preload="auto"});
  let lastSfx=0;
  function sfx(name){
    const now=performance.now(); if(now-lastSfx<80)return; lastSfx=now;
    const a=audio[name]; if(!a)return; try{a.currentTime=0;a.play().catch(()=>{});}catch(_){}
  }

  const pathN=[[0,35],[12,35],[22,28],[35,28],[45,40],[54,52],[66,52],[76,44],[88,44],[100,62]];
  const path=pathN.map(([x,y])=>({x:x/100*W,y:y/100*PLAY_H}));

  const slots=[
    {id:"M1",x:21,y:40,type:"melee"},{id:"R1",x:18,y:20,type:"ranged"},{id:"R2",x:34,y:18,type:"ranged"},
    {id:"M2",x:47,y:47,type:"melee"},{id:"R3",x:47,y:27,type:"ranged"},{id:"R4",x:60,y:66,type:"ranged"},
    {id:"M3",x:71,y:49,type:"melee"},{id:"R5",x:78,y:28,type:"ranged"},{id:"R6",x:88,y:58,type:"ranged"}
  ].map(s=>({...s,x:s.x/100*W,y:s.y/100*PLAY_H}));

  const UNIT_TYPES={
    vanguard:{name:"창병",cost:8,slot:"melee",hp:330,atk:38,def:10,res:.05,range:92,period:.72,block:2,damage:"physical",spMode:"auto",spMax:14,skill:"DP +6",sfx:"thrust"},
    knight:{name:"기사",cost:14,slot:"melee",hp:720,atk:32,def:24,res:.08,range:70,period:.95,block:3,damage:"physical",spMode:"defense",spMax:16,skill:"수호/회복",sfx:"slash"},
    archer:{name:"궁수",cost:12,slot:"ranged",hp:240,atk:34,def:4,res:.05,range:205,period:.50,block:0,damage:"physical",spMode:"attack",spMax:18,skill:"화살비",sfx:"bow"},
    mage:{name:"마법사",cost:18,slot:"ranged",hp:220,atk:82,def:3,res:.15,range:188,period:1.35,block:0,damage:"magic",spMode:"auto",spMax:24,skill:"마력 폭발",sfx:"staff"}
  };

  const cards=[
    {id:"vanguard",type:"vanguard",cool:0,deploys:0},
    {id:"knight",type:"knight",cool:0,deploys:0},
    {id:"archer",type:"archer",cool:0,deploys:0},
    {id:"mage",type:"mage",cool:0,deploys:0}
  ];

  const ENEMIES={
    slime:{name:"슬라임",part:1,row:1,hp:90,speed:35,reward:3,def:0,res:0,atk:10,period:1.25,life:1},
    goblin:{name:"고블린",part:1,row:4,hp:135,speed:43,reward:4,def:4,res:.05,atk:14,period:1.1,life:1},
    orc:{name:"오크",part:6,row:0,hp:360,speed:27,reward:9,def:24,res:.05,atk:24,period:1.15,life:2},
    ogre:{name:"오우거",part:4,row:1,hp:1250,speed:18,reward:28,def:10,res:.08,atk:42,period:1.25,life:3}
  };

  const WAVES=[
    [{enemy:"slime",count:10,interval:.52,delay:0}],
    [{enemy:"goblin",count:12,interval:.44,delay:0}],
    [{enemy:"slime",count:8,interval:.38,delay:0},{enemy:"goblin",count:8,interval:.52,delay:1.4}],
    [{enemy:"orc",count:6,interval:.9,delay:0},{enemy:"goblin",count:10,interval:.38,delay:1.2}],
    [{enemy:"ogre",count:1,interval:1,delay:0},{enemy:"orc",count:8,interval:.78,delay:1.5}]
  ];

  const props=[
    ["tree",1020,110,130,130],["tree",1120,360,115,115],["bush",80,120,95,75],["bush",560,95,80,62],
    ["rock",900,500,95,70],["rock",330,500,75,55],["flowers",710,125,70,50],["flowers",160,455,70,50]
  ];

  let state={};
  let anim=0,last=0,toastTimer=0;

  function reset(){
    state={
      running:false,paused:false,speed:1,lives:20,dp:12,gold:150,wave:-1,nextWave:2,
      enemies:[],units:[],spawns:[],projectiles:[],texts:[],selectedType:null,selectedUnit:null,
      pendingSlot:null,time:0,finished:false,earlyCalls:0,goldSpent:0,leaks:0,kills:0
    };
    cards.forEach(c=>{c.cool=0;c.deploys=0;});
    ui.start.style.display="grid";ui.result.style.display="none";ui.unitPanel.classList.remove("show");
    ui.dir.classList.remove("show"); renderCards();syncUI();
  }

  function toast(msg){
    ui.toast.textContent=msg;ui.toast.classList.add("on");clearTimeout(toastTimer);
    toastTimer=setTimeout(()=>ui.toast.classList.remove("on"),1250);
  }

  function makeUnit(type,slot,dir){
    const t=UNIT_TYPES[type], card=cards.find(c=>c.type===type);
    const cost=currentDeployCost(card);
    if(state.dp<cost){toast("DP가 부족합니다");return null;}
    state.dp-=cost;card.deploys++;
    const u={id:crypto.randomUUID?crypto.randomUUID():Math.random().toString(36),type,slot,dir,level:1,
      x:slot.x,y:slot.y,hp:t.hp,maxHp:t.hp,atk:t.atk,def:t.def,res:t.res,range:t.range,period:t.period,block:t.block,
      damage:t.damage,sp:0,spMax:t.spMax,spMode:t.spMode,attackCd:0,blocked:[],dead:false,guard:0};
    state.units.push(u);return u;
  }

  function currentDeployCost(card){
    const m=card.deploys===0?1:card.deploys===1?1.5:2;
    return Math.ceil(UNIT_TYPES[card.type].cost*m);
  }

  function spawnEnemy(type){
    const t=ENEMIES[type];
    state.enemies.push({id:Math.random().toString(36).slice(2),type,x:path[0].x-24,y:path[0].y,hp:t.hp,maxHp:t.hp,
      seg:0,progress:0,attackCd:0,blockedBy:null,dead:false,hit:0});
  }

  function scheduleWave(index,early=false){
    if(index<0||index>=WAVES.length||index<=state.wave)return;
    state.wave=index;
    let totalDelay=0;
    for(const g of WAVES[index]){
      for(let i=0;i<g.count;i++) state.spawns.push({t:(g.delay||0)+i*g.interval,type:g.enemy,wave:index});
      totalDelay=Math.max(totalDelay,(g.delay||0)+(g.count-1)*g.interval);
    }
    state.nextWave=index<WAVES.length-1?Math.max(8,totalDelay+5):null;
    if(early){
      const bonus=Math.min(60,Math.max(8,Math.ceil((state.nextWave||0)*4)));
      state.gold+=bonus;state.earlyCalls++;
      for(const u of state.units) if(u.sp<u.spMax && !u.dead) u.sp=Math.min(u.spMax,u.sp+5);
      toast(`조기 호출! +${bonus}G · SP +5`);
    } else toast(`WAVE ${index+1}`);
    syncUI();
  }

  function earlyCall(){
    if(!state.running||state.finished||state.wave>=WAVES.length-1||state.nextWave==null)return;
    scheduleWave(state.wave+1,true);
  }

  function damageEnemy(e,amount,type){
    const t=ENEMIES[e.type];let dmg=0;
    if(type==="magic") dmg=Math.max(1,Math.floor(amount*(1-t.res)));
    else if(type==="true") dmg=amount;
    else dmg=Math.max(Math.ceil(amount*.05),Math.floor(amount-t.def));
    e.hp-=dmg;e.hit=.11;
    state.texts.push({x:e.x,y:e.y-34,text:String(dmg),life:.55,color:type==="magic"?"#8bd9ff":"#ffe7a4"});
    if(e.hp<=0) killEnemy(e);
  }

  function killEnemy(e){
    if(e.dead)return;e.dead=true;
    const t=ENEMIES[e.type];state.gold+=t.reward;state.kills++;
    if(e.blockedBy) e.blockedBy.blocked=e.blockedBy.blocked.filter(x=>x!==e);
  }

  function damageUnit(u,amount){
    let dmg=Math.max(1,Math.floor(amount-u.def*(u.guard>0?.65:.35)));
    u.hp-=dmg;
    if(u.spMode==="defense")u.sp=Math.min(u.spMax,u.sp+1);
    if(u.hp<=0) removeUnit(u,true);
  }

  function removeUnit(u,death=false){
    if(u.dead)return;u.dead=true;
    for(const e of u.blocked)e.blockedBy=null;
    u.blocked=[];
    state.units=state.units.filter(x=>x!==u);
    const card=cards.find(c=>c.type===u.type);card.cool=death?10:12;
    if(!death)state.dp=Math.min(99,state.dp+Math.floor(UNIT_TYPES[u.type].cost*.5));
    if(state.selectedUnit===u){state.selectedUnit=null;ui.unitPanel.classList.remove("show");}
    renderCards();
    if(death)toast(`${UNIT_TYPES[u.type].name} 전투불능`);
  }

  function enemyProgress(e){
    if(e.seg>=path.length-1)return path.length;
    const a=path[e.seg],b=path[e.seg+1],len=Math.hypot(b.x-a.x,b.y-a.y)||1;
    return e.seg+Math.hypot(e.x-a.x,e.y-a.y)/len;
  }

  function canFace(u,e){
    if(UNIT_TYPES[u.type].slot==="melee")return true;
    const dx=e.x-u.x,dy=e.y-u.y,d=Math.hypot(dx,dy)||1;
    const v={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]}[u.dir]||[1,0];
    return (dx/d*v[0]+dy/d*v[1])>.05;
  }

  function findTarget(u){
    const cand=state.enemies.filter(e=>!e.dead&&Math.hypot(e.x-u.x,e.y-u.y)<=u.range&&canFace(u,e));
    if(!cand.length)return null;
    cand.sort((a,b)=>enemyProgress(b)-enemyProgress(a));
    return cand[0];
  }

  function attackUnit(u){
    const t=UNIT_TYPES[u.type],e=findTarget(u);if(!e)return;
    u.attackCd=u.period;
    damageEnemy(e,u.atk,u.damage);
    if(u.spMode==="attack")u.sp=Math.min(u.spMax,u.sp+1);
    state.projectiles.push({x:u.x,y:u.y-16,tx:e.x,ty:e.y,life:.14,max:.14,color:u.damage==="magic"?"#78c8ff":"#ffe49a"});
    sfx(t.sfx);
  }

  function useSkill(){
    const u=state.selectedUnit;if(!u||u.sp<u.spMax)return;
    const t=UNIT_TYPES[u.type];u.sp=0;
    if(u.type==="vanguard"){state.dp=Math.min(99,state.dp+6);toast("전술 보급 +6 DP");}
    else if(u.type==="knight"){u.guard=6;u.hp=Math.min(u.maxHp,u.hp+Math.floor(u.maxHp*.32));toast("수호 태세!");}
    else if(u.type==="archer"){
      const targets=state.enemies.filter(e=>!e.dead&&Math.hypot(e.x-u.x,e.y-u.y)<=u.range*1.05).slice(0,8);
      targets.forEach(e=>damageEnemy(e,u.atk*2.2,"physical"));toast("화살비!");
    }else if(u.type==="mage"){
      const target=findTarget(u);
      if(target){for(const e of state.enemies)if(!e.dead&&Math.hypot(e.x-target.x,e.y-target.y)<95)damageEnemy(e,u.atk*2.1,"magic");toast("마력 폭발!");}
    }
    syncUnitPanel();
  }

  function upgradeUnit(){
    const u=state.selectedUnit;if(!u||u.level>=3)return;
    const cost=u.level===1?70:115;if(state.gold<cost){toast("Gold가 부족합니다");return;}
    state.gold-=cost;state.goldSpent+=cost;u.level++;
    u.atk=Math.round(u.atk*1.28);u.maxHp=Math.round(u.maxHp*1.22);u.hp=Math.min(u.maxHp,Math.round(u.hp*1.22));
    u.range=Math.round(u.range*1.06);u.def+=3;
    toast(`Lv${u.level} 업그레이드`);syncUI();syncUnitPanel();
  }

  function retreatUnit(){const u=state.selectedUnit;if(u)removeUnit(u,false);}

  function update(dt){
    if(!state.running||state.paused||state.finished)return;
    dt*=state.speed;state.time+=dt;state.dp=Math.min(99,state.dp+dt);
    cards.forEach(c=>{if(c.cool>0)c.cool=Math.max(0,c.cool-dt);});

    if(state.wave<0){state.nextWave-=dt;if(state.nextWave<=0)scheduleWave(0,false);}
    else if(state.nextWave!=null&&state.wave<WAVES.length-1){
      state.nextWave-=dt;if(state.nextWave<=0)scheduleWave(state.wave+1,false);
    }

    for(const s of state.spawns)s.t-=dt;
    const due=state.spawns.filter(s=>s.t<=0);state.spawns=state.spawns.filter(s=>s.t>0);due.forEach(s=>spawnEnemy(s.type));

    for(const u of state.units){
      u.attackCd-=dt;if(u.guard>0)u.guard-=dt;
      if(u.spMode==="auto"&&u.sp<u.spMax)u.sp=Math.min(u.spMax,u.sp+dt);
      if(u.attackCd<=0)attackUnit(u);
    }

    for(const e of state.enemies){
      if(e.dead)continue;e.hit=Math.max(0,e.hit-dt);
      const et=ENEMIES[e.type];
      if(e.blockedBy){
        const u=e.blockedBy;
        if(u.dead){e.blockedBy=null;continue;}
        e.attackCd-=dt;if(e.attackCd<=0){e.attackCd=et.period;damageUnit(u,et.atk);}
        continue;
      }
      let blocker=null,best=999;
      for(const u of state.units){
        if(u.dead||u.block<=u.blocked.length)continue;
        if(UNIT_TYPES[u.type].slot!=="melee")continue;
        const d=Math.hypot(e.x-u.x,e.y-u.y);
        if(d<64&&d<best){best=d;blocker=u;}
      }
      if(blocker){e.blockedBy=blocker;blocker.blocked.push(e);continue;}

      if(e.seg>=path.length-1){leak(e);continue;}
      const target=path[e.seg+1],dx=target.x-e.x,dy=target.y-e.y,d=Math.hypot(dx,dy)||1;
      const step=et.speed*dt;
      if(step>=d){e.x=target.x;e.y=target.y;e.seg++;if(e.seg>=path.length-1)leak(e);}
      else{e.x+=dx/d*step;e.y+=dy/d*step;}
    }

    state.enemies=state.enemies.filter(e=>!e.dead);
    state.projectiles.forEach(p=>p.life-=dt);state.projectiles=state.projectiles.filter(p=>p.life>0);
    state.texts.forEach(t=>{t.life-=dt;t.y-=18*dt});state.texts=state.texts.filter(t=>t.life>0);

    if(state.lives<=0)finish(false);
    else if(state.wave===WAVES.length-1 && state.spawns.length===0 && state.enemies.length===0)finish(true);

    renderCards();syncUI();syncUnitPanel();
  }

  function leak(e){
    if(e.dead)return;e.dead=true;state.lives-=ENEMIES[e.type].life;state.leaks++;
    if(e.blockedBy)e.blockedBy.blocked=e.blockedBy.blocked.filter(x=>x!==e);
    toast(`기지 피해 -${ENEMIES[e.type].life}`);
  }

  function finish(win){
    if(state.finished)return;state.finished=true;state.running=false;
    const stars=state.lives>=18?3:state.lives>=10?2:1;
    ui.resultTitle.textContent=win?`승리! ${"★".repeat(stars)}`:"방어 실패";
    ui.resultStats.textContent=
      `남은 라이프: ${state.lives}/20\n클리어 시간: ${Math.floor(state.time/60)}:${String(Math.floor(state.time%60)).padStart(2,"0")}\n처치: ${state.kills} · 누출: ${state.leaks}\n조기 호출: ${state.earlyCalls}회 · 사용 Gold: ${state.goldSpent}`;
    ui.result.style.display="grid";
  }

  function renderCards(){
    ui.unitBar.innerHTML="";
    for(const c of cards){
      const t=UNIT_TYPES[c.type],b=document.createElement("button");b.className="unitCard"+(state.selectedType===c.type?" selected":"")+(c.cool>0?" cooldown":"");
      const img=document.createElement("img");img.src=RAW+charBase[c.type]+"front_0.png";
      const n=document.createElement("span");n.className="name";n.textContent=t.name;
      const cost=document.createElement("span");cost.className="cost";cost.textContent=currentDeployCost(c)+" DP";
      b.append(img,n,cost);
      if(c.cool>0){const cd=document.createElement("span");cd.className="cd";cd.textContent=Math.ceil(c.cool);b.append(cd);}
      b.onclick=()=>selectCard(c.type);ui.unitBar.append(b);
    }
  }

  function selectCard(type){
    const c=cards.find(x=>x.type===type);
    if(c.cool>0){toast("재배치 대기 중");return;}
    if(state.dp<currentDeployCost(c)){toast("DP가 부족합니다");return;}
    state.selectedType=state.selectedType===type?null:type;state.selectedUnit=null;ui.unitPanel.classList.remove("show");
    ui.hint.textContent=state.selectedType?"점선 배치 슬롯을 선택하세요":"유닛 카드를 선택하세요";
    renderCards();
  }

  function slotAllowed(type,slot){
    if(state.units.some(u=>u.slot.id===slot.id))return false;
    const need=UNIT_TYPES[type].slot;
    return need===slot.type || slot.type==="hybrid";
  }

  function pointerPos(ev){
    const r=canvas.getBoundingClientRect();return{x:(ev.clientX-r.left)/r.width*W,y:(ev.clientY-r.top)/r.height*H};
  }

  canvas.addEventListener("pointerdown",ev=>{
    if(!state.running||state.finished)return;
    const p=pointerPos(ev);
    if(state.selectedType){
      const slot=slots.find(s=>slotAllowed(state.selectedType,s)&&Math.hypot(p.x-s.x,(p.y-s.y)*1.4)<54);
      if(slot){state.pendingSlot=slot;showDirection(slot);return;}
    }
    let closest=null,d=999;
    for(const u of state.units){const dd=Math.hypot(p.x-u.x,p.y-u.y);if(dd<52&&dd<d){d=dd;closest=u;}}
    if(closest){state.selectedUnit=closest;state.selectedType=null;renderCards();syncUnitPanel();ui.unitPanel.classList.add("show");}
    else{state.selectedUnit=null;ui.unitPanel.classList.remove("show");}
  });

  function showDirection(slot){
    const rect=canvas.getBoundingClientRect();
    const left=slot.x/W*rect.width+rect.left,top=slot.y/H*rect.height+rect.top;
    ui.dir.style.left=left+"px";ui.dir.style.top=top+"px";ui.dir.classList.add("show");
  }

  document.querySelectorAll(".dir").forEach(b=>b.onclick=()=>{
    if(!state.pendingSlot||!state.selectedType)return;
    const u=makeUnit(state.selectedType,state.pendingSlot,b.dataset.dir);
    ui.dir.classList.remove("show");state.pendingSlot=null;state.selectedType=null;renderCards();
    if(u){state.selectedUnit=u;ui.unitPanel.classList.add("show");syncUnitPanel();}
  });
  $("dirCancel").onclick=()=>{state.pendingSlot=null;ui.dir.classList.remove("show");};

  function syncUnitPanel(){
    const u=state.selectedUnit;if(!u||u.dead){ui.unitPanel.classList.remove("show");return;}
    const t=UNIT_TYPES[u.type];
    ui.unitName.textContent=`${t.name} · Lv${u.level}`;
    ui.unitStats.textContent=`HP ${Math.ceil(u.hp)}/${u.maxHp} · ATK ${u.atk} · DEF ${u.def} · 저지 ${u.block} · 사거리 ${u.range}`;
    ui.spFill.style.width=Math.min(100,u.sp/u.spMax*100)+"%";
    ui.skill.textContent=`${t.skill} (${Math.floor(u.sp)}/${u.spMax})`;
    ui.skill.disabled=u.sp<u.spMax;ui.skill.classList.toggle("ready",u.sp>=u.spMax);
    const cost=u.level===1?70:115;ui.upgrade.textContent=u.level>=3?"MAX":`강화 ${cost}G`;ui.upgrade.disabled=u.level>=3;
  }

  function syncUI(){
    ui.lives.textContent=Math.max(0,state.lives);
    ui.dp.textContent=Math.floor(state.dp);ui.gold.textContent=Math.floor(state.gold);
    ui.wave.textContent=state.wave<0?"준비":`WAVE ${state.wave+1} / ${WAVES.length}`;
    ui.waveFill.style.width=(Math.max(0,state.wave+1)/WAVES.length*100)+"%";
    const can=state.running&&!state.finished&&state.wave>=0&&state.wave<WAVES.length-1&&state.nextWave!=null;
    ui.early.disabled=!can;
    ui.early.textContent=can?`조기 +${Math.min(60,Math.max(8,Math.ceil(state.nextWave*4)))}G`:"조기 호출";
    ui.speed.textContent=state.speed===1?"1×":"2×";ui.pause.textContent=state.paused?"▶":"Ⅱ";
  }

  function draw(){
    ctx.clearRect(0,0,W,H);
    drawMap();
    drawPath();
    if(state.selectedType)drawSlots();
    drawRangePreview();
    drawUnits();
    drawEnemies();
    drawProjectiles();
    drawTexts();
  }

  function drawMap(){
    ctx.save();ctx.globalAlpha=.95;
    for(const [key,x,y,w,h] of props){const im=IMG[key];if(im&&im.complete)ctx.drawImage(im,x,y,w,h);}
    ctx.restore();
  }

  function drawPath(){
    ctx.save();ctx.lineCap="round";ctx.lineJoin="round";
    ctx.strokeStyle="#6f4d31";ctx.lineWidth=88;ctx.beginPath();ctx.moveTo(path[0].x,path[0].y);
    path.slice(1).forEach(p=>ctx.lineTo(p.x,p.y));ctx.stroke();
    ctx.strokeStyle="#a47b4e";ctx.lineWidth=70;ctx.stroke();
    ctx.strokeStyle="#c69b62";ctx.globalAlpha=.24;ctx.lineWidth=4;ctx.setLineDash([16,18]);ctx.stroke();ctx.restore();
  }

  function drawSlots(){
    for(const s of slots){
      const ok=slotAllowed(state.selectedType,s);ctx.save();ctx.translate(s.x,s.y);ctx.scale(1,.55);
      ctx.beginPath();ctx.arc(0,0,42,0,Math.PI*2);ctx.setLineDash([9,7]);ctx.lineWidth=4;
      ctx.strokeStyle=ok?"#ffe28a":"#695e58";ctx.fillStyle=ok?"#ffd65b28":"#2228";
      ctx.fill();ctx.stroke();ctx.restore();
    }
  }

  function drawRangePreview(){
    if(state.pendingSlot&&state.selectedType){
      const t=UNIT_TYPES[state.selectedType];ctx.save();ctx.globalAlpha=.17;ctx.fillStyle="#fff09a";
      ctx.beginPath();ctx.arc(state.pendingSlot.x,state.pendingSlot.y,t.range,0,Math.PI*2);ctx.fill();ctx.restore();
    }
    if(state.selectedUnit){
      const u=state.selectedUnit;ctx.save();ctx.globalAlpha=.13;ctx.fillStyle="#8fdcff";
      ctx.beginPath();ctx.arc(u.x,u.y,u.range,0,Math.PI*2);ctx.fill();ctx.restore();
    }
  }

  function allyImage(u){
    if(u.dir==="up")return IMG[u.type+"_back"];
    if(u.dir==="down")return IMG[u.type+"_front"];
    return IMG[u.type+"_side"];
  }

  function drawUnits(){
    for(const u of state.units){
      const im=allyImage(u),size=u.type==="knight"?82:74;ctx.save();
      if(u.dir==="right"){ctx.translate(u.x,u.y);ctx.scale(-1,1);ctx.translate(-u.x,-u.y);}
      if(u.guard>0){ctx.beginPath();ctx.arc(u.x,u.y-10,43,0,Math.PI*2);ctx.strokeStyle="#8ad7ff";ctx.lineWidth=4;ctx.globalAlpha=.65;ctx.stroke();ctx.globalAlpha=1;}
      if(im&&im.complete)ctx.drawImage(im,u.x-size/2,u.y-size*.82,size,size);
      else{ctx.fillStyle="#fff";ctx.beginPath();ctx.arc(u.x,u.y-20,26,0,Math.PI*2);ctx.fill();}
      ctx.restore();
      bar(u.x-32,u.y+9,64,6,u.hp/u.maxHp,"#61cf67");
      if(u.sp>=u.spMax){ctx.fillStyle="#b66bff";ctx.beginPath();ctx.arc(u.x+29,u.y-56,7,0,Math.PI*2);ctx.fill();}
    }
  }

  function enemyColumn(e){
    if(e.blockedBy)return 0;
    const b=path[Math.min(e.seg+1,path.length-1)],dx=b.x-e.x,dy=b.y-e.y;
    if(Math.abs(dx)>Math.abs(dy))return dx>=0?3:2;
    return dy>=0?0:1;
  }

  function drawEnemies(){
    for(const e of state.enemies){
      const t=ENEMIES[e.type],im=IMG["atlas"+t.part],col=enemyColumn(e),sz=e.type==="ogre"?78:e.type==="orc"?66:58;
      ctx.save();if(e.hit>0){ctx.shadowColor="#fff";ctx.shadowBlur=16;}
      if(im&&im.complete&&im.naturalWidth){
        ctx.drawImage(im,col*256,t.row*256,256,256,e.x-sz/2,e.y-sz*.76,sz,sz);
      }else{ctx.fillStyle="#d65a4a";ctx.beginPath();ctx.arc(e.x,e.y-18,24,0,Math.PI*2);ctx.fill();}
      ctx.restore();
      bar(e.x-27,e.y+5,54,5,e.hp/e.maxHp,"#e34e48");
      if(e.blockedBy){ctx.fillStyle="#ffd25a";ctx.font="bold 12px sans-serif";ctx.textAlign="center";ctx.fillText("BLOCK",e.x,e.y-50);}
    }
  }

  function bar(x,y,w,h,p,color){
    ctx.fillStyle="#140d0dcc";ctx.fillRect(x,y,w,h);ctx.fillStyle=color;ctx.fillRect(x,y,w*Math.max(0,Math.min(1,p)),h);
  }

  function drawProjectiles(){
    for(const p of state.projectiles){
      const q=1-p.life/p.max;const x=p.x+(p.tx-p.x)*q,y=p.y+(p.ty-p.y)*q;
      ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(x,y,4,0,Math.PI*2);ctx.fill();
    }
  }

  function drawTexts(){
    ctx.textAlign="center";ctx.font="bold 16px sans-serif";
    for(const t of state.texts){ctx.globalAlpha=Math.max(0,t.life/.55);ctx.fillStyle=t.color;ctx.fillText(t.text,t.x,t.y);}
    ctx.globalAlpha=1;
  }

  function frame(ts){
    const dt=Math.min(.033,(ts-last)/1000||0);last=ts;update(dt);draw();anim=requestAnimationFrame(frame);
  }

  ui.startBtn.onclick=()=>{
    ui.start.style.display="none";state.running=true;state.nextWave=2;toast("유닛을 배치하세요");syncUI();
  };
  ui.retry.onclick=()=>{reset();};
  ui.early.onclick=earlyCall;
  ui.skill.onclick=useSkill;ui.upgrade.onclick=upgradeUnit;ui.retreat.onclick=retreatUnit;
  ui.speed.onclick=()=>{state.speed=state.speed===1?2:1;syncUI();};
  ui.pause.onclick=()=>{state.paused=!state.paused;syncUI();};

  reset();cancelAnimationFrame(anim);anim=requestAnimationFrame(frame);
})();