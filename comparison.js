(() => {
  'use strict';
  const P=window.StarPhysics, ids=['A','B','C','D','E'];
  const labels=['10 pc에 있는 별','10 pc보다 먼 별','10 pc보다 가까운 별','지구에서 가장 가까운 별','지구에서 가장 먼 별','지구에서 가장 밝게 보이는 별','실제로 가장 밝은 별'];
  const round=n=>Math.round(n*10)/10;
  function generate(){
    // Exact one-decimal clues, with distinct distances on both sides of 10 pc.
    const deltas=[0,-(3+Math.floor(Math.random()*7))/10,-(11+Math.floor(Math.random()*8))/10,(3+Math.floor(Math.random()*7))/10,(11+Math.floor(Math.random()*12))/10];
    for(let i=4;i>0;i--){const j=Math.floor(Math.random()*(i+1));[deltas[i],deltas[j]]=[deltas[j],deltas[i]];}
    return ids.map((id,i)=>{const M=P.randomMagnitude();return {id,M,m:round(M+deltas[i]),d:10*10**(deltas[i]/5),azimuth:0};});
  }
  function solutions(stars){
    const delta=stars.map(s=>round(s.m-s.M));
    const choose=fn=>stars.filter(fn).map(s=>s.id);
    const low=key=>choose(s=>s[key]===Math.min(...stars.map(t=>t[key])));
    return {delta,groups:[choose(s=>Math.abs(s.m-s.M)<1e-8),choose(s=>s.m>s.M),choose(s=>s.m<s.M),choose(s=>round(s.m-s.M)===Math.min(...delta)),choose(s=>round(s.m-s.M)===Math.max(...delta)),low('m'),low('M')],order:[...stars].sort((a,b)=>(a.m-a.M)-(b.m-b.M)).map(s=>s.id)};
  }
  function grade(stars,answers){
    const key=solutions(stars),same=(a,b)=>a.length===b.length&&[...a].sort().join('')===[...b].sort().join('');
    const checks=[...key.delta.map((n,i)=>String(answers.delta[i]).trim()!==''&&Math.abs(Number(answers.delta[i])-n)<1e-7),...key.groups.map((g,i)=>same(g,answers.groups[i])),key.order.join('')===answers.order.join('')];
    const correct=checks.filter(Boolean).length;
    return {key,checks,correct,score:Math.round(correct/13*1000)};
  }
  function direction(){return {x:1,y:0,z:0};}
  function project(v,angle=0){return {x:v.x*Math.cos(angle)-v.y*Math.sin(angle),y:v.x*Math.sin(angle)+v.y*Math.cos(angle),z:0};}
  function dragDistance(start,dx,dy,v){const norm=v.x*v.x+v.y*v.y;return norm<.025?start:P.clamp(start+(dx*v.x-dy*v.y)/(22*norm),3,30);}
  window.StarComparisonModel={generate,solutions,grade,direction,project,dragDistance,starPosition,labelLayout,starAppearance,nameOffsets};
  let dragStart=null,detailSelected=null;
  const $=id=>document.getElementById(id),panel=$('comparisonPanel');
  let stars=generate(),mode='practice',selected='A',answers,report=null,dragId=null;
  let memory=[],storageFailed=false,examStartedAt=null;
  const storageKey='starlight.comparisonRecords.v1';
  function dateKey(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
  const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function completionTime(record){
    const timestamp=Date.parse(record.endedAt);
    if(Number.isFinite(timestamp))return timestamp;
    // Older records have only a localized completion time, without seconds.
    const match=String(record.time||'').match(/^(오전|오후)?\s*(\d{1,2}):(\d{2})/);
    if(!match)return 0;
    let hour=Number(match[2]);
    if(match[1])hour=hour%12+(match[1]==='오후'?12:0);
    return Date.parse(record.date+'T'+String(hour).padStart(2,'0')+':'+match[3]+':00')||0;
  }
  function timeLabel(value){
    const timestamp=Date.parse(value);
    return Number.isFinite(timestamp)?new Date(timestamp).toLocaleString('ko-KR',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}):'기록 없음';
  }
  function recordTimes(record){return '<div class="quiz-record-times"><span>시작 '+esc(timeLabel(record.startedAt))+'</span><span>종료 '+esc(record.endedAt?timeLabel(record.endedAt):record.time||'기록 없음')+'</span></div>';}
  function read(){
    if(!storageFailed)try{const raw=localStorage.getItem(storageKey);if(raw)memory=JSON.parse(raw);}catch{storageFailed=true;}
    if(!Array.isArray(memory))memory=[];
    return memory.filter(r=>r&&typeof r==='object'&&r.date===dateKey()&&Number.isInteger(r.score)&&r.score>=0&&r.score<=1000&&Array.isArray(r.stars)&&r.stars.length===5&&r.answers&&Array.isArray(r.answers.delta)&&r.answers.delta.length===5&&Array.isArray(r.answers.groups)&&r.answers.groups.length===7&&r.answers.groups.every(Array.isArray)&&Array.isArray(r.answers.order)&&r.stars.every(s=>s&&typeof s==='object'&&ids.includes(s.id)&&Number.isFinite(s.m)&&Number.isFinite(s.M))).sort((a,b)=>completionTime(b)-completionTime(a)).slice(0,5);
  }
  function save(){
    const entry={date:dateKey(),startedAt:examStartedAt,endedAt:new Date().toISOString(),stars:JSON.parse(JSON.stringify(stars)),answers:JSON.parse(JSON.stringify(answers)),score:report.score};
    memory=[entry,...read()].sort((a,b)=>completionTime(b)-completionTime(a)).slice(0,5);
    try{localStorage.setItem(storageKey,JSON.stringify(memory));storageFailed=false;}catch{storageFailed=true;}
  }
  function reset(nextMode){mode=nextMode;examStartedAt=mode==='exam'?new Date().toISOString():null;stars=generate();selected='A';detailSelected=null;report=null;answers={delta:Array(5).fill(''),groups:labels.map(()=>[]),order:[]};render();}
  function table(data){return '<div class="compare-table-wrap"><table class="compare-table"><caption>별 A~E의 겉보기등급과 절대등급</caption><thead><tr><th scope="col">별</th>'+data.map(s=>'<th scope="col">'+esc(s.id)+'</th>').join('')+'</tr></thead><tbody>'+[['겉보기등급 m','m'],['절대등급 M','M']].map(([title,key])=>'<tr><th scope="row">'+title+'</th>'+data.map(s=>'<td>'+s[key].toFixed(1)+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';}
  function starPosition(star){const v=direction(star);return {x:60+v.x*star.d*22,y:170-v.y*star.d*22};}
  function labelLayout(data){
    // Only one card is visible at a time; reserve the space above the distance line.
    return data.map(star=>{const p=starPosition(star);return {x:Math.min(p.x+30,630),y:92,w:154,h:48,id:star.id,starX:p.x,starY:p.y};});
  }
  function nameOffsets(data){
    const lanes=[],offsets={};
    for(const star of [...data].sort((a,b)=>a.d-b.d)){
      const x=starPosition(star).x;
      let lane=lanes.findIndex(last=>x-last>=52);
      if(lane<0)lane=lanes.length;
      lanes[lane]=x;offsets[star.id]=lane*19;
    }
    return offsets;
  }
  function circleArtwork(data,interactive,detailId=null){
    
    const cards=labelLayout(data).filter(box=>box.id===detailId).map(box=>{const star=data.find(s=>s.id===box.id);return '<g class="circle-grade-card" data-grade="'+star.id+'"><path d="M'+(box.starX+14)+','+box.starY+'L'+box.x+','+(box.y+24)+'" class="circle-grade-link"/><rect x="'+box.x+'" y="'+box.y+'" width="154" height="48" rx="7"/><text x="'+(box.x+10)+'" y="'+(box.y+19)+'" class="circle-apparent">별 '+star.id+' · 겉보기 m '+star.m.toFixed(1)+'</text><text x="'+(box.x+10)+'" y="'+(box.y+38)+'" class="circle-absolute">절대등급 M '+star.M.toFixed(1)+'</text></g>';}).join('');
    const ticks=[0,5,10,15,20,25,30].map(d=>{const x=60+d*22;return '<line x1="'+x+'" y1="164" x2="'+x+'" y2="180" class="distance-tick"/><text x="'+x+'" y="306" text-anchor="middle" class="'+(d===10?'distance-ten-label':'circle-caption')+'">'+d+' pc</text>';}).join('');
    return '<svg viewBox="0 0 800 340" role="img" aria-label="지구에서 오른쪽으로 갈수록 먼 일직선 거리 지도"><rect x="60" y="154" width="220" height="32" fill="#75e4e00b"/><line x1="60" y1="170" x2="732" y2="170" class="distance-axis"/><path d="M724 165l8 5-8 5" class="distance-axis"/><line x1="280" y1="72" x2="280" y2="270" class="distance-ten"/>'+ticks+
      '<circle cx="60" cy="170" r="11" fill="#163a64" stroke="#97e6ff" stroke-width="2"/><path d="M53 164l8 1 3 5-7 6-5-5" fill="#83cbb0"/><text x="60" y="197" text-anchor="middle" class="circle-earth-label">지구</text><text x="60" y="38" class="circle-caption">가까움 ← 지구에서의 거리 → 멂</text>'+cards+'</svg>';
  }

  function starAppearance(M){
    const rootFlux=Math.sqrt(P.flux(10,M)),level=rootFlux/(1+rootFlux);
    return {opacity:.18+.82*level,glow:8+32*level,core:18+16*level};
  }
  function inspectScene(button){
    const scene=button.closest('.circle-scene'),data=JSON.parse(scene.dataset.stars);
    scene.querySelector('.compare-circle-art').innerHTML=circleArtwork(data,false,button.dataset.star);
    scene.querySelectorAll('[data-star]').forEach(b=>{b.classList.toggle('selected',b===button);b.setAttribute('aria-pressed',String(b===button));});
  }
  function scene(data,interactive){const offsets=nameOffsets(data);return '<div class="compare-scene circle-scene" data-stars="'+esc(JSON.stringify(data))+'"><div class="circle-banner"><strong>10 pc</strong><span>지구에서 10 pc · m = M</span></div><div class="circle-scroll"><div class="compare-circle"><div class="compare-circle-art">'+circleArtwork(data,interactive)+'</div>'+data.map(s=>{const p=starPosition(s),light=starAppearance(s.M);return '<button type="button" class="compare-star '+(selected===s.id?'selected':'')+'" data-star="'+s.id+'" aria-label="별 '+s.id+', 거리 '+s.d.toFixed(2)+' pc, 겉보기등급 '+s.m.toFixed(1)+', 절대등급 '+s.M.toFixed(1)+'" aria-pressed="'+(selected===s.id)+'" style="--name-offset:'+offsets[s.id]+'px;--star-opacity:'+light.opacity+';--star-glow:'+light.glow+'px;--star-core:'+light.core+'px;left:'+p.x/8+'%;top:'+p.y/3.4+'%" '+(!interactive?'data-inspect="true"':'')+'><i class="star-light" aria-hidden="true">✦</i><span>'+s.id+'</span></button>';}).join('')+'</div></div><p class="circle-legend">별을 누르면 등급을 표시합니다. 같은 거리는 같은 위치에 놓입니다. 겹친 별은 왼쪽 A~E 버튼으로 선택하세요.</p></div>';}
  function resultHTML(data,a){
    const r=grade(data,a),answerText=x=>x.length?x.join(', '):'선택 없음';
    return '<div class="compare-result"><strong>'+r.score.toLocaleString('ko-KR')+'점 · '+r.correct+'/13 정답 · '+P.rank(r.score)+'</strong><p>각 문항 동일 배점 · 선택 문제는 해당하는 별을 모두 골라야 정답입니다.</p></div>'+table(data)+'<ol class="compare-review">'+r.key.delta.map((n,i)=>'<li class="'+(r.checks[i]?'correct':'incorrect')+'">'+(r.checks[i]?'✓':'✕')+' 별 '+ids[i]+'의 m − M: 내 답 '+esc(a.delta[i]||'미응답')+' / 정답 <b>'+n.toFixed(1)+'</b></li>').join('')+r.key.groups.map((g,i)=>'<li class="'+(r.checks[5+i]?'correct':'incorrect')+'">'+(r.checks[5+i]?'✓':'✕')+' '+labels[i]+': 내 답 '+esc(answerText(a.groups[i]))+' / 정답 <b>'+answerText(g)+'</b></li>').join('')+'<li class="'+(r.checks[12]?'correct':'incorrect')+'">'+(r.checks[12]?'✓':'✕')+' 가까운 순서: 내 답 '+esc(a.order.join(' → ')||'미응답')+' / 정답 <b>'+r.key.order.join(' → ')+'</b></li></ol><p class="compare-explanation">m − M = 5 log₁₀(d / 10). 차이가 0이면 10 pc, 양수이면 더 멀고 음수이면 더 가깝습니다. 차이가 작을수록 가깝고, m이 작을수록 밝게 보이며 M이 작을수록 실제로 밝습니다.</p>'+scene(data.map(s=>({...s,d:10*10**((s.m-s.M)/5)})),false)+'<p>'+data.map(s=>'별 '+s.id+': '+(10*10**((s.m-s.M)/5)).toFixed(2)+' pc').join(' · ')+'</p>';
  }
  function render(){
    panel.innerHTML='<div class="compare-heading"><div><span class="eyebrow">FIVE STAR LAB</span><h2>별의 거리 퀴즈</h2></div><div class="compare-actions"><button data-mode="practice" aria-pressed="'+(mode==='practice')+'" class="'+(mode==='practice'?'selected':'')+'">연습 모드</button><button data-mode="exam" aria-pressed="'+(mode==='exam')+'" class="'+(mode==='exam'?'selected':'')+'">시험 모드</button><button id="compareNew">새 랜덤 별 5개</button></div></div><p class="compare-muted">'+(mode==='practice'?'별을 선택하고 지구 쪽 또는 바깥쪽으로 드래그하거나 거리 슬라이더를 움직여 보세요. 절대등급은 유지되고 겉보기등급이 바뀝니다.':'제한 시간 없이 13문항을 풀어 보세요. 제출하면 채점 결과와 실제 거리를 공개합니다. 새 문제나 연습 모드로 전환하면 작성 중인 답은 초기화됩니다.')+'</p>';
    if(mode==='practice'){
      panel.innerHTML+='<div class="compare-workbench"><div id="compareTable">'+table(stars)+'</div><div id="compareScene">'+scene(stars,true)+'</div><div class="compare-controls"><div class="compare-pick">'+ids.map(id=>'<button type="button" data-pick="'+id+'" aria-pressed="'+(id===selected)+'">별 '+id+'</button>').join('')+' </div><label for="compareDistance" id="compareDistanceLabel"></label><input id="compareDistance" type="range" min="3" max="30" step="0.01"><button id="compareTen">10 pc에 놓기</button><output id="compareValues" aria-live="polite"></output></div></div><p class="compare-explanation">10 pc에서는 겉보기등급과 절대등급이 같습니다. 가까워질수록 겉보기등급 숫자가 작아져 더 밝게 보입니다. 모든 별은 같은 거리선 위에서 움직이며 오른쪽에 있을수록 지구에서 멉니다. 각 별 오른쪽에서 두 등급을 함께 비교하세요. 별에 초점을 두고 방향키로도 거리를 조절할 수 있습니다.</p>';
      updatePractice();
    }else if(report){
      panel.innerHTML+='<div role="status">시험 제출 완료 · 오늘의 기록에 저장했습니다.'+(storageFailed?' 저장소를 사용할 수 없어 현재 페이지에서만 유지됩니다.':'')+'</div>'+resultHTML(stars,answers);
    }else{
      panel.innerHTML+=table(stars)+'<form id="compareExam"><fieldset><legend>① 별 A~E의 (겉보기등급 − 절대등급)을 구하세요.</legend><div class="compare-inputs">'+ids.map((id,i)=>'<label>별 '+id+' <input type="number" step="0.1" required data-delta="'+i+'" aria-label="별 '+id+'의 등급 차이"><button type="button" data-sign="'+i+'" aria-label="별 '+id+' 답의 부호 바꾸기">±</button></label>').join('')+'</div></fieldset><fieldset><legend>② 해당하는 별을 모두 고르세요.</legend>'+labels.map((label,i)=>'<div class="compare-question"><span>'+label+'</span><div role="group" aria-label="'+label+'">'+ids.map(id=>'<button type="button" data-group="'+i+'" data-id="'+id+'" aria-pressed="false">'+id+'</button>').join('')+'</div></div>').join('')+'</fieldset><fieldset><legend>③ 지구에서 가까운 별부터 순서대로 누르세요.</legend><p>아래 순서 칸을 누르면 해당 별이 지워집니다.</p><div class="compare-order-options">'+ids.map(id=>'<button type="button" data-order="'+id+'">별 '+id+'</button>').join('')+'</div><div id="compareOrder" class="compare-order"></div><button type="button" id="compareClear">다시 고르기</button></fieldset><p id="compareValidation" role="status"></p><button type="submit" class="primary">시험 제출 · 결과 확인</button><p class="compare-muted">13문항을 모두 제출하면 오늘의 기록에 저장됩니다. 제출 전에는 정답이 공개되지 않습니다.</p></form>';
      updateOrder();
      $('compareExam').onsubmit=e=>{e.preventDefault();if(answers.groups.some(g=>!g.length)||answers.order.length!==5){$('compareValidation').textContent='②의 모든 조건에서 별을 선택하고, ③의 순서에 별 5개를 모두 넣어 주세요.';return;}if(report)return;report=grade(stars,answers);save();render();panel.scrollIntoView({behavior:'auto',block:'start'});};
    }
  }
  function updatePractice(){
    const s=stars.find(s=>s.id===selected);
    $('compareTable').innerHTML=table(stars);
    panel.querySelectorAll('[data-pick]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.pick===selected)));
    panel.querySelectorAll('[data-star]').forEach(b=>{const star=stars.find(s=>s.id===b.dataset.star);const pos=starPosition(star);b.style.setProperty('--name-offset',nameOffsets(stars)[star.id]+'px');b.style.left=pos.x/8+'%';b.style.top=pos.y/3.4+'%';b.style.zIndex=star.id===selected?'4':'3';b.classList.toggle('on-ten',Math.abs(star.d-10)<.005);b.classList.toggle('selected',star.id===selected);b.setAttribute('aria-pressed',String(star.id===selected));b.setAttribute('aria-label','별 '+star.id+', 거리 '+star.d.toFixed(2)+' pc, 겉보기등급 '+star.m.toFixed(1)+', 절대등급 '+star.M.toFixed(1));});
    $('compareScene').querySelector('.compare-circle-art').innerHTML=circleArtwork(stars,true,detailSelected);
    $('compareDistanceLabel').textContent='선택한 별 '+s.id+' · 거리 '+s.d.toFixed(2)+' pc';$('compareDistance').value=s.d;
    $('compareValues').textContent='겉보기등급 m '+s.m.toFixed(1)+' · 절대등급 M '+s.M.toFixed(1)+' · 차이 '+(s.m-s.M).toFixed(1)+' · '+(Math.abs(s.d-10)<.005?'10 pc 위치 · m = M':s.d<10?'10 pc보다 가까움 · m < M':'10 pc보다 멂 · m > M');
  }
  function move(d){const s=stars.find(s=>s.id===selected);s.d=P.clamp(d,3,30);s.m=P.magnitude(s.d,s.M);updatePractice();}
  function updateOrder(){
    $('compareOrder').innerHTML='<span>가까움</span>'+ids.map((_,i)=>'<button type="button" data-remove="'+i+'" aria-label="'+(answers.order[i]?'별 '+answers.order[i]+' 지우기':(i+1)+'번째 빈칸')+'">'+(answers.order[i]||i+1)+'</button>').join('<span aria-hidden="true">→</span>')+'<span>멂</span>';
    panel.querySelectorAll('[data-order]').forEach(b=>b.disabled=answers.order.includes(b.dataset.order));
  }
  panel.addEventListener('input',e=>{if(e.target.id==='compareDistance')move(Number(e.target.value));if(e.target.dataset.delta!==undefined)answers.delta[Number(e.target.dataset.delta)]=e.target.value;});
  panel.addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b)return;
    if(b.dataset.inspect){inspectScene(b);}
    else if(b.dataset.mode){if(mode!==b.dataset.mode)reset(b.dataset.mode);}
    else if(b.id==='compareNew')reset(mode);
    else if((b.dataset.star||b.dataset.pick)&&mode==='practice'){selected=b.dataset.star||b.dataset.pick;detailSelected=selected;updatePractice();}
    else if(b.id==='compareTen')move(10);
    else if(b.dataset.sign!==undefined){const i=Number(b.dataset.sign),input=panel.querySelector('[data-delta="'+i+'"]');if(input.value!==''){answers.delta[i]=String(-Number(input.value));input.value=answers.delta[i];}input.focus();}
    else if(b.dataset.group!==undefined){const group=answers.groups[Number(b.dataset.group)],id=b.dataset.id,index=group.indexOf(id);if(index<0)group.push(id);else group.splice(index,1);b.setAttribute('aria-pressed',String(index<0));}
    else if(b.dataset.order){answers.order.push(b.dataset.order);updateOrder();}
    else if(b.dataset.remove!==undefined){answers.order.splice(Number(b.dataset.remove),1);updateOrder();}
    else if(b.id==='compareClear'){answers.order=[];updateOrder();}
  });
  panel.addEventListener('pointerdown',e=>{const b=e.target.closest('[data-star]');if(!b||mode!=='practice')return;selected=b.dataset.star;detailSelected=selected;dragId=e.pointerId;const star=stars.find(s=>s.id===selected),rect=panel.querySelector('.compare-circle').getBoundingClientRect();dragStart={x:e.clientX,y:e.clientY,d:star.d,v:direction(star),scale:800/rect.width};panel.setPointerCapture(e.pointerId);b.focus();updatePractice();});
  panel.addEventListener('pointermove',e=>{if(dragId!==e.pointerId||mode!=='practice'||!dragStart)return;move(dragDistance(dragStart.d,(e.clientX-dragStart.x)*dragStart.scale,(e.clientY-dragStart.y)*dragStart.scale,dragStart.v));});
  for(const event of ['pointerup','pointercancel','lostpointercapture'])panel.addEventListener(event,()=>{dragId=null;dragStart=null;});
  panel.addEventListener('keydown',e=>{const b=e.target.closest('[data-star]');if(!b||mode!=='practice'||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();selected=b.dataset.star;detailSelected=selected;const star=stars.find(s=>s.id===selected);move(star.d+(['ArrowRight','ArrowUp'].includes(e.key)?1:-1)*(e.shiftKey?1:.1));});
  function renderRecords(){
    const records=read(),list=$('comparisonTopFive');
    list.innerHTML=records.length?records.map((r,i)=>'<li><span class="record-place">'+(i+1)+'</span><strong>'+r.score.toLocaleString('ko-KR')+'<small>점</small></strong>'+recordTimes(r)+'<button type="button" data-record="'+i+'">결과 보기</button></li>').join(''):'<li class="record-empty">아직 기록이 없어요</li>';
    $('comparisonStorageNote').textContent=storageFailed?'현재 페이지에서만 기록을 유지합니다.':'13문항 · 1,000점 만점 · 오늘의 최근 5개 시험 · 최신순';
    list.onclick=e=>{const b=e.target.closest('[data-record]');if(!b)return;const r=records[Number(b.dataset.record)];$('comparisonRecordContent').innerHTML=recordTimes(r)+resultHTML(r.stars,r.answers);$('comparisonRecordDialog').showModal();};
  }
  $('comparisonRecordContent').addEventListener('click',e=>{const b=e.target.closest('[data-inspect]');if(b)inspectScene(b);});
  $('comparisonRecordClose').onclick=()=>$('comparisonRecordDialog').close();
  window.StarComparison={open(){if(!answers)reset('practice');},renderRecords};
})();
