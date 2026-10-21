/* Pure calculations; d is in parsecs. */
window.StarPhysics = Object.freeze({
  randomMagnitude(exclude) {
    const excluded=Number.isFinite(exclude)?Math.round(exclude*10)+50:-1;
    let index=Math.floor(Math.random()*(excluded>=0 && excluded<=100?100:101));
    if(excluded>=0 && excluded<=100 && index>=excluded)index++;
    return (index-50)/10;
  },
  magnitudeMission() {
    // Fixed labeled 20pc tick: a clear reference, independent of target direction.
    const startDistance=20,offset=5*Math.log10(startDistance/10);
    const farther=Math.random()<.5,candidates=[];
    for(let i=-50;i<=50;i++){
      const startMagnitude=i/10,M=startMagnitude-offset;
      if(M < -5 || M > 5)continue;
      for(let j=-50;j<=50;j++){
        const target=j/10,delta=target-startMagnitude;
        if(Math.abs(delta)<.5-1e-9 || (delta>0)!==farther)continue;
        const goal=startDistance*Math.pow(10,delta/5);
        if(goal>=6 && goal<=29)candidates.push({target,M,startMagnitude,startDistance});
      }
    }
    return candidates[Math.floor(Math.random()*candidates.length)];
  },
  flux(d, M = 0) { return Math.pow(10, -0.4 * M) * Math.pow(10 / d, 2); },
  magnitude(d, M = 0) { return M + 5 * Math.log10(d / 10); },
  equalBrightnessDistance(d, fromM, toM) { return d * Math.pow(10, (fromM - toM) / 5); },
  score(targetMagnitude, actualMagnitude) { return Math.round(1000 * Math.exp(-2 * Math.abs(targetMagnitude - actualMagnitude))); },
  rank(score) { return score >= 950 ? 'A+' : score >= 900 ? 'A' : score >= 800 ? 'B+' : score >= 650 ? 'B' : score >= 500 ? 'C' : 'D'; },
  error(a, b) { return Math.abs(Math.log(a / b)); },
  clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
});
