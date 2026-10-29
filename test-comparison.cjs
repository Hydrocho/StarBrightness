const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const nodes={},saved=new Map();
function node(id){return nodes[id]??=( {innerHTML:'',textContent:'',value:'',events:{},dataset:{},classList:{toggle(){}},addEventListener(name,fn){this.events[name]=fn;},querySelectorAll(){return [];},querySelector(selector){return node(selector);},setAttribute(){},setPointerCapture(){},scrollIntoView(){},focus(){},showModal(){this.open=true;},close(){this.open=false;}} );}
let day='2026-10-29T12:00:00';
const context={window:{},document:{getElementById:node},localStorage:{getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,v)},Date:class extends Date{constructor(){super(day);}},Math};
vm.createContext(context);
vm.runInContext(fs.readFileSync('physics.js','utf8'),context);
vm.runInContext(fs.readFileSync('comparison.js','utf8'),context);
const model=context.window.StarComparisonModel,api=context.window.StarComparison;
let brighter=model.starAppearance(-5);
for(let M=-4.9;M<=5;M+=.1){
  const dimmer=model.starAppearance(M);
  assert.ok(dimmer.opacity<brighter.opacity&&dimmer.glow<brighter.glow&&dimmer.core<brighter.core);
  assert.ok(dimmer.opacity>0&&dimmer.opacity<=1);
  brighter=dimmer;
}
console.log('PASS: absolute magnitude controls strictly decreasing core brightness and halo intensity.');
for(let sample=0;sample<250;sample++){
  const stars=model.generate();
  for(const distance of [null,3,10,30,'random']){
    const data=stars.map(s=>({...s,d:distance==='random'?3+Math.random()*27:distance??s.d})),boxes=model.labelLayout(data);
    for(const s of data){const p=model.starPosition(s);assert.ok(Math.abs(Math.hypot(p.x-60,p.y-170)-s.d*22)<1e-8,'map radius represents true distance');}
    for(let i=0;i<boxes.length;i++){
      const a=boxes[i];assert.ok(Number.isFinite(a.x)&&Number.isFinite(a.y));assert.ok(a.x>=0);assert.ok(a.x+a.w<=800&&a.y>=0&&a.y+a.h<=340);
      assert.equal(a.starY,170,'all stars share the same straight line');
      for(const star of data){const p=model.starPosition(star);assert.ok(a.x+a.w<=p.x-22||p.x+22<=a.x||a.y+a.h<=p.y-22||p.y+22<=a.y,'cards avoid stars and names');}
    }
  }
}
console.log('PASS: 1250 straight-line layouts, true radial distance, right-side labels, no card/star overlap and 340px map bounds.');
for(const star of model.generate()){
  assert.ok(Math.abs(star.azimuth)<=32*Math.PI/180);
  const direction=model.direction(star);
  assert.ok(Math.abs(Math.hypot(direction.x,direction.y,direction.z)-1)<1e-10);
  for(const angle of [0,.7,2.4]){
    const v=model.project(direction,angle);
    assert.ok(Math.abs(Math.hypot(v.x,v.y,v.z)-1)<1e-10,'rotation preserves physical distance');
    if(v.x*v.x+v.y*v.y>=.025){
      assert.ok(Math.abs(model.dragDistance(10,v.x*22*5,-v.y*22*5,v)-15)<1e-9);
      assert.ok(Math.abs(model.dragDistance(10,-v.x*22*5,v.y*22*5,v)-5)<1e-9);
      assert.equal(model.dragDistance(10,v.x*800,-v.y*800,v),30);
    }
  }
}
assert.equal(model.dragDistance(10,100,100,{x:0,y:0,z:1}),10);
assert.ok(Number.isFinite(model.project(model.direction({id:'A'})).x),'legacy records have a default direction');
console.log('PASS: planar directions, distance-preserving rotation, radial drag in/out, bounds, pole safety and legacy records.');
for(let i=0;i<3000;i++){
  const stars=model.generate(),key=model.solutions(stars);
  assert.equal(key.groups[0].length,1);assert.equal(key.groups[1].length,2);assert.equal(key.groups[2].length,2);
  assert.equal(new Set(key.delta).size,5);
  for(const s of stars){assert.ok(s.d>=3&&s.d<=30);assert.ok(Math.abs(context.window.StarPhysics.magnitude(s.d,s.M)-s.m)<1e-8);}
  const perfect={delta:key.delta.map(String),groups:key.groups,order:key.order};
  assert.equal(model.grade(stars,perfect).score,1000);
  assert.equal(model.grade(stars,{...perfect,delta:['','','','','']}).correct,8);
  assert.equal(model.grade(stars,{...perfect,order:[...key.order].reverse()}).correct,12);
}
const tied=[{id:'A',m:0,M:0},{id:'B',m:0,M:-1},{id:'C',m:2,M:-1},{id:'D',m:1,M:2},{id:'E',m:3,M:5}];
const key=model.solutions(tied);
assert.equal(key.groups[5].join(''),'AB');assert.equal(key.groups[6].join(''),'BC');
assert.equal(model.grade(tied,{delta:key.delta.map(String),groups:key.groups.map((g,i)=>i===5?['A']:g),order:key.order}).correct,12);
console.log('PASS: 3000 random five-star sets; physical consistency; full/partial scoring; tied brightness; signed decimal answers.');
const panel=node('comparisonPanel');
function click(dataset={},id=''){panel.events.click({target:{closest(){return {dataset,id,setAttribute(){}};}}});}
function input(i,value){panel.events.input({target:{id:'',dataset:{delta:String(i)},value}});}
api.open();assert.ok(panel.innerHTML.includes('compareDistance'));assert.ok(!panel.innerHTML.includes('compareExam'));
assert.ok(panel.innerHTML.includes('지구에서 10 pc'));assert.ok(!panel.innerHTML.includes('구를 돌려 보기'));assert.equal((panel.innerHTML.match(/data-grade=/g)||[]).length,0);assert.equal((node('.compare-circle-art').innerHTML.match(/data-grade=/g)||[]).length,0);
click({},'compareTen');assert.ok(node('compareDistanceLabel').textContent.includes('10.00 pc'));
assert.ok(node('compareValues').textContent.includes('10 pc 위치 · m = M'));
click({pick:'B'});assert.ok(node('compareDistanceLabel').textContent.includes('선택한 별 B'));
assert.equal((node('.compare-circle-art').innerHTML.match(/data-grade=/g)||[]).length,1);
assert.ok(node('.compare-circle-art').innerHTML.includes('data-grade="B"'));
click({star:'C'});assert.ok(node('.compare-circle-art').innerHTML.includes('data-grade="C"'));
assert.ok(!node('.compare-circle-art').innerHTML.includes('data-grade="B"'));
assert.ok(panel.innerHTML.includes('compare-workbench'));assert.ok(panel.innerHTML.includes('data-pick="E"'));
assert.ok(node('.compare-circle-art').innerHTML.includes('겉보기'));assert.ok(node('.compare-circle-art').innerHTML.includes('절대등급 M')); 
panel.events.input({target:{id:'compareDistance',dataset:{},value:'30'}});assert.ok(node('compareDistanceLabel').textContent.includes('30.00 pc'));
assert.equal((node('.compare-circle-art').innerHTML.match(/data-grade=/g)||[]).length,1);
assert.ok(node('compareValues').textContent.includes('10 pc보다 멂'));
click({mode:'exam'});assert.ok(panel.innerHTML.includes('compareExam'));assert.ok(!panel.innerHTML.includes('compare-scene'));
node('compareExam').onsubmit({preventDefault(){}});assert.ok(node('compareValidation').textContent.includes('별 5개'));
for(let i=0;i<5;i++)input(i,'0');
for(let i=0;i<7;i++)click({group:String(i),id:'A'});
for(const id of ['A','B','C','D','E'])click({order:id});
click({remove:'2'});click({order:'C'});
node('compareExam').onsubmit({preventDefault(){}});
assert.ok(panel.innerHTML.includes('시험 제출 완료'));
assert.equal(JSON.parse(saved.get('starlight.comparisonRecords.v1')).length,1);
api.renderRecords();assert.ok(node('comparisonTopFive').innerHTML.includes('결과 보기'));
node('comparisonTopFive').onclick({target:{closest(){return {dataset:{record:'0'}};}}});
assert.ok(node('comparisonRecordDialog').open);assert.ok(node('comparisonRecordContent').innerHTML.includes('정답'));
assert.ok(node('comparisonRecordContent').innerHTML.includes('data-inspect="true"'));
assert.ok(!node('comparisonRecordContent').innerHTML.includes('data-grade='));
const storedStars=JSON.parse(saved.get('starlight.comparisonRecords.v1'))[0].stars;
const resultScene={dataset:{stars:JSON.stringify(storedStars)},querySelector(){return node('recordArtwork');},querySelectorAll(){return [];}};
const resultStar={dataset:{star:'D'},closest(){return resultScene;}};
node('comparisonRecordContent').events.click({target:{closest(){return resultStar;}}});
assert.equal((node('recordArtwork').innerHTML.match(/data-grade=/g)||[]).length,1);
assert.ok(node('recordArtwork').innerHTML.includes('data-grade="D"'));
node('comparisonRecordClose').onclick();assert.ok(!node('comparisonRecordDialog').open);
// A second load reads persisted records without a prior exam in this page.
vm.runInContext(fs.readFileSync('comparison.js','utf8'),context);context.window.StarComparison.renderRecords();
assert.ok(node('comparisonTopFive').innerHTML.includes('결과 보기'));
day='2026-10-30T12:00:00';context.window.StarComparison.renderRecords();assert.ok(node('comparisonTopFive').innerHTML.includes('아직 기록'));
context.localStorage={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}};
vm.runInContext(fs.readFileSync('comparison.js','utf8'),context);context.window.StarComparison.open();click({mode:'exam'});
for(let i=0;i<5;i++)input(i,'0');for(let i=0;i<7;i++)click({group:String(i),id:'A'});for(const id of ['A','B','C','D','E'])click({order:id});
node('compareExam').onsubmit({preventDefault(){}});context.window.StarComparison.renderRecords();
assert.ok(node('comparisonTopFive').innerHTML.includes('결과 보기'));assert.ok(node('comparisonStorageNote').textContent.includes('현재 페이지'));
console.log('PASS: practice distance changes; exam answer entry and incomplete submission; order removal; saved result reopening; reload; day rollover; blocked-storage fallback.');
