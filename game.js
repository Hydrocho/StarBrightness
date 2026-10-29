(() => {
  'use strict';
  const $=id=>document.getElementById(id),P=StarPhysics,R=StarRenderer;
  const s={distance:18,target:10,targetM:0,currentM:-1,mode:'ready',round:0,score:0,remaining:30,duration:30,hold:0,paused:false,last:0,toastUntil:0,dirty:true,intro:0,lastBeat:null,results:[],scoreReveal:null,lightPhase:0,sceneDirty:false,variant:'photo',moved:false,startDistance:18,startMagnitude:0,flash:0,hasMoved:false,cueTime:0};
  const space=$('spaceCanvas');let drag=null;
  function toast(message){$('toast').textContent=message;$('toast').classList.add('visible');s.toastUntil=performance.now()+1800;}
  function canMove(){return !s.paused && (s.mode==='ready'||s.mode==='play'&&s.intro<=0);}
  function atOrigin(){return Math.abs(s.distance-s.startDistance)<1e-7;}
  function distance(d){
    const previous=s.distance,next=P.clamp(d,5,30);
    if(Math.abs(next-previous)>1e-9)s.hasMoved=true;
    if(s.mode==='play' && s.variant==='magnitude' && Math.abs(next-previous)>1e-9){
      const crossed=s.moved && Math.abs(previous-s.startDistance)>1e-7 && (previous-s.startDistance)*(next-s.startDistance)<=0;
      s.moved=true;
      if(crossed)s.flash=.4;
    }
    s.distance=next;s.dirty=true;
    space.setAttribute('aria-valuenow',s.distance.toFixed(2));space.setAttribute('aria-valuetext',s.distance.toFixed(2)+' 파섹');
  }
  function resetStartPosition(){
    drag=null;
    distance(s.variant==='magnitude'?20:18);
    s.hasMoved=false;s.moved=false;s.flash=0;s.cueTime=0;
  }
  function renderScene(){if(s.variant==='comparison')return;R.scene(space,s.distance,s.currentM,s.lightPhase,{active:s.mode==='play',showDragHint:s.mode==='play'&&!s.hasMoved,cueTime:s.cueTime,reduceMotion:!!(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches),hideMagnitude:s.variant==='magnitude',origin:s.variant==='magnitude'&&(atOrigin()||s.flash>0)?s.startDistance:null});}
  const briefingMemory={};
  function todayKey(){
    const d=new Date();
    return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  }
  const recordsKey='starlight.dailyRecords.v1';
  let recordsMemory=null,recordsStorageFailed=false;
  let pendingRecords=[];
  function readRecords(){
    const date=todayKey();
    let data=recordsMemory;
    pendingRecords=pendingRecords.filter(record=>record.date===date);
    try{
      const raw=window.localStorage.getItem(recordsKey);
      data=raw?JSON.parse(raw):null;
      recordsMemory=data;
      recordsStorageFailed=pendingRecords.length>0;
    }catch{recordsStorageFailed=true;}
    const clean={date,photo:[],magnitude:[]};
    for(const mode of ['photo','magnitude']){
      // Migrate the former single best score into a one-entry leaderboard.
      const stored=data&&data.date===date?data[mode]:[];
      const scores=Array.isArray(stored)?stored:[stored];
      clean[mode]=scores.filter(n=>Number.isInteger(n)&&n>=0&&n<=1000)
        .concat(pendingRecords.filter(record=>record.mode===mode).map(record=>record.score))
        .sort((a,b)=>b-a).slice(0,5);
    }
    return clean;
  }
  function saveDailyRecord(points){
    if(!Number.isInteger(points)||points<0||points>1000)return;
    pendingRecords.push({date:todayKey(),mode:s.variant,score:points});
    const data=readRecords();
    try{
      window.localStorage.setItem(recordsKey,JSON.stringify(data));
      recordsMemory=data;pendingRecords=[];recordsStorageFailed=false;
    }catch{recordsStorageFailed=true;}
  }
  function displayRecords(){
    try{window.StarComparison?.renderRecords();}
    catch{
      $('comparisonTopFive').innerHTML='<li class="record-empty">퀴즈 기록을 불러오지 못했습니다.</li>';
    }
    const data=readRecords();$('recordsDate').textContent=data.date+' · 오늘 완료한 도전';
    for(const mode of ['photo','magnitude']){
      const scores=data[mode];
      $(mode+'TopFive').innerHTML=scores.length?scores.map((score,i)=>'<li><span class="record-place">'+(i+1)+'</span><strong>'+score.toLocaleString('ko-KR')+'<small>점</small></strong><b>'+P.rank(score)+'</b></li>').join(''):'<li class="record-empty">아직 기록이 없어요</li>';
    }
    $('recordsNote').textContent=recordsStorageFailed?'저장소 접근에 문제가 있어 일부 기록은 현재 페이지에서만 유지됩니다. 페이지를 닫으면 저장되지 않은 기록이 사라질 수 있습니다.':'사진·등급 맞추기는 매 관측이 끝날 때 해당 점수를 바로 저장합니다. 사진·등급: 오늘의 상위 5개 / 거리 퀴즈: 오늘의 최근 5개 · 1,000점 만점 · 같은 점수도 별도 기록';
  }
  function skipBriefing(){
    const key='starlight.briefing.'+s.variant;
    try{return (window.localStorage.getItem(key)||briefingMemory[key])===todayKey();}
    catch{return briefingMemory[key]===todayKey();}
  }
  function saveBriefingPreference(){
    const key='starlight.briefing.'+s.variant,value=$('briefSkipToday').checked?todayKey():'';
    briefingMemory[key]=value;
    try{if(value)window.localStorage.setItem(key,value);else window.localStorage.removeItem(key);}catch{}
  }
  function openBrief(){
    if(s.mode==='ready')resetStartPosition();
    if(skipBriefing()){play();return;}
    $('briefSkipToday').checked=false;
    if(s.mode==='play')setPaused(true);
    const numeric=s.variant==='magnitude';
    $('briefTitle').textContent=numeric?'등급 숫자로 별빛을 찾아라':'서로 다른 별, 같은 별빛을 만들어라';
    $('briefLead').textContent=numeric?'목표 등급과 출발 등급을 비교하고, 더 가까이 갈지 더 멀리 갈지 생각해 보세요. 숫자가 작을수록 밝습니다.':'실제 밝기가 다른 별도 지구에서는 같은 밝기로 보일 수 있을까요? 사진을 비교하며 직접 확인하세요.';
    $('briefSteps').innerHTML=numeric?'<li>목표와 출발 등급을 확인하세요. 아직 시간은 흐르지 않습니다.</li><li>처음 움직이면 현재 등급이 ?로 바뀌고 30초가 시작됩니다.</li><li>출발 위치를 다시 지나가면 출발 등급이 0.4초간 표시됩니다. 그 자리에 멈추면 계속 볼 수 있습니다.</li><li>준비되면 별 이동 완료를 누르세요.</li>':'<li>목표 사진의 빛무리와 광선을 살펴보세요.</li><li>별 B를 움직여 목표 사진과 같은 밝기로 맞추세요.</li><li>별 이동 완료를 누르거나 30초가 지나면 결과를 확인합니다.</li>';
    $('briefNote').textContent='총 5회 · 1,000점 기준 · 속도 보너스 없이 정확도로 평가합니다.';
    $('briefDialog').showModal();
  }
  function restartEffect(element, name) {
    element.classList.remove(name);
    void element.offsetWidth;
    element.classList.add(name);
  }
  function selectTarget(){
    s.hasMoved=false;s.cueTime=0;
    if(s.variant==='magnitude'){
      const mission=P.magnitudeMission();s.currentM=mission.M;s.targetM=mission.target;s.target=10;
      s.distance=mission.startDistance;s.startDistance=s.distance;s.startMagnitude=mission.startMagnitude;s.moved=false;s.flash=0;
      space.setAttribute('aria-valuenow',s.distance.toFixed(2));space.setAttribute('aria-valuetext',s.distance.toFixed(2)+' 파섹');
    }else{
    // Choose a reachable solution first, then derive the fixed target star distance.
    s.currentM=P.randomMagnitude();
    s.targetM=P.randomMagnitude(s.currentM);
    const candidates=[];
    for(let d=6;d<=29;d+=.5){
      const e=P.error(P.flux(d,s.currentM),P.flux(s.distance,s.currentM));
      if(e>.28 && (s.round>=4 || Math.abs(d-s.distance)<15))candidates.push(d);
    }
    const solution=candidates[Math.floor(Math.random()*candidates.length)] || 10;
    s.target=P.equalBrightnessDistance(solution,s.currentM,s.targetM);
    }
    s.duration=30;s.remaining=s.duration;s.hold=0;s.dirty=true;s.intro=.65;s.lastBeat=null;
    $('arrivalLabel').textContent='NEW TARGET / '+String(s.round+1).padStart(2,'0');
    restartEffect($('targetPhoto'),'arriving');
  }
  function setPaused(value){s.paused=value;s.hold=0;$('pause').textContent=value?'계속하기':'일시정지';document.body.classList.toggle('paused',value);s.dirty=true;}
  function ready(){s.mode='ready';s.intro=0;s.lastBeat=null;$('targetPhoto').classList.remove('arriving');s.target=10;s.targetM=0;s.currentM=-1;s.score=0;s.hold=0;s.flash=0;s.moved=false;if(s.variant==='magnitude'){selectTarget();s.intro=0;}setPaused(false);$('pause').hidden=true;$('play').textContent='도전 시작 ↗';s.dirty=true;}
  function play(){R.newStarfield();resetStartPosition();s.mode='play';s.round=0;s.score=0;s.results=[];setPaused(false);selectTarget();$('pause').hidden=false;$('play').textContent='다시 시작 ↻';}
  function stat(label,value){return '<div><span>'+label+'</span><strong>'+value+'</strong></div>';}
  function revealScore(score){
    $('resultPoints').textContent='0';$('resultRank').textContent=P.rank(score);
    $('resultBadge').dataset.rank=P.rank(score);
    s.scoreReveal={score,start:performance.now()};
    restartEffect($('resultHero'),'score-reveal');
  }
  function advance(){
    if(s.mode!=='play')return;
    const targetApparent=P.magnitude(s.target,s.targetM),actualApparent=P.magnitude(s.distance,s.currentM);
    const points=P.score(targetApparent,actualApparent);
    s.results.push({targetApparent,actualApparent,points});
    s.score=Math.max(...s.results.map(r=>r.points));
    saveDailyRecord(points);
    s.mode='review';s.hold=0;drag=null;$('pause').hidden=true;s.dirty=true;
    $('feedbackEyebrow').textContent='OBSERVATION '+s.results.length+' / 5';
    $('feedbackTitle').textContent=points>=950?'놀라운 관측 감각!':points>=800?'목표에 가까워졌어요!':'다음 별빛에 다시 도전!';
    $('feedbackLead').textContent='겉보기 등급이 가까울수록 높은 점수!';
    $('feedbackStats').innerHTML=stat('목표 겉보기 등급',targetApparent.toFixed(2))+stat('내가 맞춘 겉보기 등급',actualApparent.toFixed(2));
    $('feedbackExplanation').textContent=s.variant==='magnitude'?(points>=950?'잘 맞췄어요! 밝을수록 등급 숫자는 작아집니다.':actualApparent>targetApparent?'조금 더 가까이! 밝아지면 등급 숫자는 작아져요.':'조금 더 멀리! 어두워지면 등급 숫자는 커져요.'):'등급 차이 '+Math.abs(targetApparent-actualApparent).toFixed(2)+' · 완전히 같으면 1,000점';
    $('feedbackTable').innerHTML='';$('feedbackNext').textContent=s.results.length===5?'최종 결과 보기':'다음 관측 시작';
    draw();$('feedbackDialog').showModal();revealScore(points);
  }
  function summary(){
    s.mode='done';s.dirty=true;
    $('feedbackEyebrow').textContent='EXPEDITION COMPLETE';$('feedbackTitle').textContent='이번 탐사 최고 기록';
    $('feedbackLead').textContent='5회 관측 중 최고 점수입니다. 각 관측 점수는 오늘의 기록에 따로 저장되었습니다.';
    $('feedbackStats').innerHTML='';
    $('feedbackExplanation').textContent=s.variant==='magnitude'?'가까우면 밝아지고 등급 숫자는 작아져요. 멀어지면 어두워지고 숫자는 커져요.':'실제 밝기가 다른 별도 거리가 다르면 같은 밝기로 보일 수 있어요.';
    $('feedbackTable').innerHTML='';$('feedbackNext').textContent='다시 도전하기';revealScore(s.score);
  }
  function draw(){
    if(s.variant==='comparison'){s.dirty=false;return;}
    space.setAttribute('aria-disabled',String(!canMove()));
    space.style.cursor=canMove()?'ew-resize':'default';
    const reviewing=s.mode==='review';
    document.body.classList.toggle('feedback-review',reviewing);
    $('numberTarget').hidden=s.variant!=='magnitude'&&!reviewing;
    $('targetCanvas').hidden=s.variant==='magnitude';
    const flux=P.flux(s.distance,s.currentM),target=P.flux(s.target,s.targetM);
    if(s.variant==='photo')R.photo($('targetCanvas'),target);R.photo($('currentCanvas'),flux);renderScene();
    $('currentApparentValue').textContent=P.magnitude(s.distance,s.currentM).toFixed(2);
    $('currentAbsoluteValue').textContent=s.currentM.toFixed(1);
    $('targetTag').textContent='목표 별 A · 고정';$('targetHint').textContent='목표 등급은 관측 종료 후 공개합니다';
    $('currentHint').textContent=s.mode==='ready'?'자유롭게 움직여 보세요 · 도전 시작 시 출발 위치로 이동합니다':'빛무리와 광선을 보고 목표 사진과 비교하세요';
    const active=s.mode==='play', entering=active && s.intro>0, waiting=active&&s.variant==='magnitude'&&!s.moved; 
    $('submitObservation').hidden=!active;
    $('submitObservation').disabled=!active || entering || s.paused || waiting;
    const urgent=active && !entering && s.remaining<=3;
    $('gameClock').classList.toggle('urgent',urgent);
    $('gameClock').classList.toggle('clock-idle',!active);
    $('roundLabel').textContent=s.paused?'일시정지':entering?'새 목표 발견':active?'남은 시간':s.mode==='done'?'탐사 완료':s.mode==='review'?'결과 확인':'도전 준비';
    $('timeValue').textContent=s.mode==='ready'?'—':s.mode==='done'?'✓':s.remaining.toFixed(1);
    $('clockArc').style.strokeDashoffset=active?String(100*(1-s.remaining/s.duration)):'0';
    $('clockCaption').textContent=s.paused?'PAUSED':entering?'READY':urgent?'서두르세요!':active?'SECONDS LEFT':'도전 시작을 눌러주세요';
    $('clockRound').textContent=active?String(s.round+1).padStart(2,'0')+' / 5':s.mode==='done'?'COMPLETE':'READY';
    const beat=urgent?Math.ceil(s.remaining):null;
    if(beat!==s.lastBeat){s.lastBeat=beat;if(beat!==null)restartEffect($('timeValue'),'clock-beat');}
    if(s.variant==='magnitude'){
      const revealed=s.mode==='review'||s.mode==='done';
      const showOrigin=!revealed && (atOrigin()||s.flash>0);
      const value=revealed||s.mode==='ready'?P.magnitude(s.distance,s.currentM).toFixed(2):showOrigin?s.startMagnitude.toFixed(1):'?';
      $('currentApparentValue').textContent=value;
      $('currentGradeLabel').textContent=showOrigin?'출발 등급 m':'겉보기 등급 m';
      $('targetMagnitude').textContent=s.targetM.toFixed(1);$('targetTag').textContent='숫자 목표';
      $('targetHint').textContent='출발 밝기를 기억하며 거리를 조절하세요';
      $('currentHint').textContent=s.mode==='ready'?'자유롭게 움직여 보세요 · 도전 시작 시 출발 위치로 이동합니다':showOrigin?'출발 위치의 기준 밝기입니다':revealed?'최종 겉보기 등급 공개':'현재 등급은 ? · 출발 위치를 지나면 기준 등급 공개';
      if(waiting&&!s.paused){$('roundLabel').textContent='출발 준비';$('clockCaption').textContent='첫 이동부터 시작';}
    }else {$('currentGradeLabel').textContent='겉보기 등급 m';}
    if(reviewing){
      $('targetMagnitude').textContent=P.magnitude(s.target,s.targetM).toFixed(2);
      $('targetTag').textContent='목표값 공개';$('targetHint').textContent='이 밝기를 목표로 했어요';
      $('currentGradeLabel').textContent='내가 맞춘 등급 m';
      $('currentHint').textContent='마지막으로 놓은 위치의 밝기입니다';
      $('currentApparentValue').textContent=P.magnitude(s.distance,s.currentM).toFixed(2);

    }
    s.dirty=false;
  }
  space.addEventListener('pointerdown',e=>{if(!canMove())return;const rect=space.getBoundingClientRect(),g=R.geometry(rect.width,rect.height),x=e.clientX-rect.left,y=e.clientY-rect.top;
    if(Math.abs(x-(g.ox+s.distance*g.unit))>60 || Math.abs(y-g.y)>65)return;
    drag={id:e.pointerId,start:e.clientX,d:s.distance,unit:g.unit};space.setPointerCapture(e.pointerId);space.focus();});
  space.addEventListener('pointermove',e=>{if(drag && canMove())distance(drag.d+(e.clientX-drag.start)/drag.unit);});
  function endDrag(){drag=null;}space.addEventListener('pointerup',endDrag);space.addEventListener('pointercancel',endDrag);space.addEventListener('lostpointercapture',endDrag);
  space.addEventListener('keydown',e=>{if(!canMove())return;if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();if(e.key==='Home')distance(5);else if(e.key==='End')distance(30);else distance(s.distance+(e.key==='ArrowLeft'?-1:1)*(e.shiftKey?.5:.05));}});
  $('submitObservation').onclick=()=>{if(s.mode==='play' && !s.paused && s.intro<=0 && (s.variant==='photo'||s.moved))advance();};
  function switchMode(variant){
    s.variant=variant;drag=null;
    document.body.classList.toggle('comparison-mode',variant==='comparison');
    $('comparisonPanel').hidden=variant!=='comparison';
    $('play').hidden=variant==='comparison';
    $('comparisonMode').classList.toggle('selected',variant==='comparison');
    $('comparisonMode').setAttribute('aria-pressed',String(variant==='comparison'));
    if(variant==='comparison')window.StarComparison?.open();document.body.classList.toggle('magnitude-mode',variant==='magnitude');
    $('photoMode').classList.toggle('selected',variant==='photo');$('magnitudeMode').classList.toggle('selected',variant==='magnitude');
    $('photoMode').setAttribute('aria-pressed',String(variant==='photo'));$('magnitudeMode').setAttribute('aria-pressed',String(variant==='magnitude'));
    $('numberTarget').hidden=variant!=='magnitude';$('targetCanvas').hidden=variant==='magnitude';
    $('targetTitle').textContent=variant==='magnitude'?'목표 등급':'목표 사진';
    ready();
  }
  $('comparisonMode').onclick=()=>switchMode('comparison');
  $('photoMode').onclick=()=>switchMode('photo');$('magnitudeMode').onclick=()=>switchMode('magnitude');
  $('play').onclick=openBrief;
  $('briefSkipToday').onchange=saveBriefingPreference;
  $('briefStart').onclick=()=>{$('briefDialog').close();play();};
  $('briefCancel').onclick=()=>{$('briefDialog').close();ready();};
  $('feedbackNext').onclick=()=>{
    if(s.mode==='done'){$('feedbackDialog').close();openBrief();}
    else if(s.results.length===5)summary();
    else{$('feedbackDialog').close();s.round++;s.mode='play';setPaused(false);selectTarget();$('pause').hidden=false;}
  };
  $('feedbackDialog').addEventListener('cancel',e=>e.preventDefault());
  $('todayRecords').onclick=()=>{if(s.mode==='play')setPaused(true);displayRecords();$('recordsDialog').showModal();};
  $('recordsClose').onclick=()=>$('recordsDialog').close();
  $('pause').onclick=()=>setPaused(!s.paused);
  document.addEventListener('visibilitychange',()=>{if(document.hidden && s.mode==='play')setPaused(true);});
  new ResizeObserver(()=>{s.dirty=true;}).observe(document.querySelector('.app'));
  window.addEventListener('resize',()=>s.dirty=true);
  function tick(now){const dt=s.last?Math.min((now-s.last)/1000,.1):0;s.last=now;
    if(s.mode==='play'&&!s.paused && s.intro>0){s.intro=Math.max(0,s.intro-dt);s.dirty=true;}
    else if(s.mode==='play'&&!s.paused && (s.variant==='photo'||s.moved)){s.remaining=Math.max(0,s.remaining-dt);if(s.remaining<=0)advance();s.dirty=true;}
    if(!s.paused && !document.hidden && (s.mode==='ready'||s.mode==='play')){
      const reduced=window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if(!reduced){s.lightPhase=(s.lightPhase+dt/3)%1;s.sceneDirty=true;}
    }
    if(s.mode==='play'&&!s.paused&&!s.hasMoved){
      const reduced=window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      s.cueTime=reduced?0:s.cueTime+dt;s.sceneDirty=true;
    }
    if(s.flash>0&&!s.paused){s.flash=Math.max(0,s.flash-dt);s.dirty=true;}
    if(s.scoreReveal){
      const reduced=window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const t=reduced?1:Math.min(1,Math.max(0,(now-s.scoreReveal.start)/850));
      $('resultPoints').textContent=Math.round(s.scoreReveal.score*(1-Math.pow(1-t,3))).toLocaleString('ko-KR');
      if(t===1)s.scoreReveal=null;
    }
    if($('recordsDialog').open && $('recordsDate').textContent.slice(0,10)!==todayKey())displayRecords();
    if(s.toastUntil && now>s.toastUntil){$('toast').classList.remove('visible');s.toastUntil=0;}if(s.dirty)draw();else if(s.sceneDirty)renderScene();s.sceneDirty=false;requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();
