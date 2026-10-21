window.StarRenderer = (() => {
  let backgroundStars=[];
  function newStarfield(){
    const colors=['190,215,255','230,240,255','255,224,186','177,202,255'];
    backgroundStars=[];
    for(let i=0;i<130;i++){
      let x,y;
      do{x=.025+Math.random()*.95;y=.08+Math.random()*.84;}
      while(Math.hypot((x-.5)/.19,(y-.51)/.27)<1);
      const prominent=Math.random()<.12;
      backgroundStars.push({x,y,radius:prominent?1.1+Math.random()*.8:.35+Math.random()*.65,
        alpha:prominent?.55+Math.random()*.3:.16+Math.random()*.38,
        color:colors[Math.floor(Math.random()*colors.length)],prominent});
    }
  }
  newStarfield();
  function setup(canvas) {
    const r = canvas.getBoundingClientRect(), scale = Math.min(devicePixelRatio || 1, 2);
    const w = Math.round(r.width * scale), h = Math.round(r.height * scale);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    const c = canvas.getContext('2d'); c.setTransform(scale, 0, 0, scale, 0, 0);
    c.clearRect(0, 0, r.width, r.height); return { c, w: r.width, h: r.height };
  }
  function glow(c, x, y, radius, strength, color = '173,215,255') {
    const g = c.createRadialGradient(x,y,0,x,y,radius);
    g.addColorStop(0, `rgba(${color},${strength})`); g.addColorStop(.12, `rgba(${color},${strength*.55})`);
    g.addColorStop(.4, `rgba(${color},${strength*.13})`); g.addColorStop(1, `rgba(${color},0)`);
    c.fillStyle=g; c.fillRect(x-radius,y-radius,radius*2,radius*2);
  }
  function photo(canvas, flux) {
    const {c,w,h}=setup(canvas); c.fillStyle='#050a14';c.fillRect(0,0,w,h);
    // Shared, persistent sky: only a new expedition regenerates it, never flux or time.
    for(const star of backgroundStars){
      const x=star.x*w,y=star.y*h;
      if(star.prominent)glow(c,x,y,star.radius*5,star.alpha*.2,star.color);
      c.beginPath();c.arc(x,y,star.radius,0,Math.PI*2);
      c.fillStyle=`rgba(${star.color},${star.alpha})`;c.fill();
    }
    // One fixed, monotonic tone curve for both photos across M=-5..+5.
    // It compresses the display range, without changing physical flux or scoring.
    const tone=Math.pow(flux,.38);
    const x=w/2,y=h*.51,b=.25+1.5*tone/(1+tone),radius=Math.min(w,h)*.27*b;
    glow(c,x,y,radius,.55*Math.min(b,1.5));
    c.save();c.globalCompositeOperation='screen';
    for(let axis=0;axis<2;axis++){c.save();c.translate(x,y);c.rotate(axis*Math.PI/2);
      const length=radius*.85,g=c.createLinearGradient(-length,0,length,0);
      g.addColorStop(0,'#bedaff00');g.addColorStop(.45,`rgba(190,220,255,${Math.min(.65,b*.32)})`);g.addColorStop(.5,'#eff9ff');g.addColorStop(.55,`rgba(190,220,255,${Math.min(.65,b*.32)})`);g.addColorStop(1,'#bedaff00');
      c.fillStyle=g;c.fillRect(-length,-.65,length*2,1.3);c.restore();}
    glow(c,x,y,10*b,Math.min(.95,.6*b),'230,243,255');c.restore();
    c.beginPath();c.arc(x,y,1.9,0,Math.PI*2);c.fillStyle=`rgba(245,250,255,${Math.min(1,.45+b*.4)})`;c.fill();
  }
  // Unit ray from (separation,0,0), intersecting a true sphere at the origin.
  function rayHit(separation,radius,dx,dy,dz=0){
    const projection=-separation*dx;
    const discriminant=radius*radius-separation*separation*(dy*dy+dz*dz);
    if(discriminant<0 || projection<=0)return null;
    return projection-Math.sqrt(discriminant);
  }
  function geometry(w,h) {return {ox:Math.max(60,w*.08),end:w-65,y:h*.54,unit:(w-65-Math.max(60,w*.08))/32};}
  function scene(canvas,d,absoluteMagnitude=0,phase=0,options={}) {
    const {c,w,h}=setup(canvas),g=geometry(w,h),{ox,end,y,unit}=g,sx=ox+d*unit;
    // Side view encodes intrinsic luminosity, not received flux at Earth.
    // Compress the visual range while preserving brighter = smaller M.
    const luminosity=StarPhysics.flux(10,absoluteMagnitude);
    const intrinsicTone=Math.pow(luminosity,.35);
    const brilliance=.2+1.8*intrinsicTone/(1+intrinsicTone);
    c.strokeStyle='#1b2b41';c.lineWidth=1;
    const floor=y+36;
    for(let i=-5;i<16;i++){c.beginPath();c.moveTo(w*.52+i*29,floor-24);c.lineTo(w*.52+i*135,h);c.stroke();}
    for(let i=0;i<5;i++){const yy=floor+i*i*5;c.beginPath();c.moveTo(10,yy);c.lineTo(w-10,yy);c.stroke();}
    // Orthographic 3D camera rotated around Y. World-space spheres stay spherical.
    const yaw=.46,co=Math.cos(yaw),si=Math.sin(yaw),earthRadius=16;
    const separation=(sx-ox)/co,step=10*unit/co;
    const angle=Math.atan(Math.min(58,h*.26)/(30*unit/co));
    const queue=[],labels=[];
    const project=p=>[ox+p[0]*co+p[2]*si,y+p[1],-p[0]*si+p[2]*co];
    const direction=(u,v)=>[-Math.cos(u)*Math.cos(v),Math.sin(v),Math.sin(u)*Math.cos(v)];
    const point=(radius,u,v)=>{const q=direction(u,v);return [separation+q[0]*radius,q[1]*radius,q[2]*radius];};
    const blocked=(radius,u,v)=>{const q=direction(u,v),hit=rayHit(separation,earthRadius,...q);return hit!==null && hit<=radius;};
    function polygon(points,color,stroke=null){
      const p=points.map(project);
      queue.push({depth:p.reduce((n,q)=>n+q[2],0)/p.length,draw(){
        c.beginPath();p.forEach((q,i)=>i?c.lineTo(q[0],q[1]):c.moveTo(q[0],q[1]));c.closePath();
        c.fillStyle=color;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=.5;c.stroke();}
      }});
    }
    function segment(p1,p2,color,width=1){
      const a=project(p1),b=project(p2);queue.push({depth:(a[2]+b[2])/2,draw(){c.beginPath();c.moveTo(a[0],a[1]);c.lineTo(b[0],b[1]);c.strokeStyle=color;c.lineWidth=width;c.stroke();}});
    }
    function shell(radius,divisions,alpha,intersectionOnly=false){
      // Reference surfaces are cut only where their points lie inside Earth.
      // Traveling light still retains the downstream shadow of absorbed rays.
      const hidden=(radius,u,v)=>{
        if(!intersectionOnly)return blocked(radius,u,v);
        const p=point(radius,u,v);
        return p[0]*p[0]+p[1]*p[1]+p[2]*p[2]<earthRadius*earthRadius;
      };
      if(radius<1 || alpha<.001)return;
      // Angular mesh is clipped against the ray/sphere intersection boundary.
      // Subdivision at that boundary keeps the hole curved, rather than a 2D wedge.
      function cell(u0,v0,u1,v1,depth){
        const uv=[[u0,v0],[u1,v0],[u1,v1],[u0,v1]],flags=uv.map(q=>hidden(radius,...q));
        const um=(u0+u1)/2,vm=(v0+v1)/2,mid=hidden(radius,um,vm);
        if(flags.every(Boolean)&&mid)return;
        if(depth<3 && (flags.some(Boolean)||mid)){
          cell(u0,v0,um,vm,depth+1);cell(um,v0,u1,vm,depth+1);cell(um,vm,u1,v1,depth+1);cell(u0,vm,um,v1,depth+1);return;
        }
        if(mid)return;
        const points=uv.map(q=>point(radius,...q));
        polygon([points[0],points[1],points[2]],'rgba(255,201,88,'+alpha+')');
        polygon([points[0],points[2],points[3]],'rgba(255,201,88,'+alpha+')');
      }
      const n=12;
      for(let i=0;i<n;i++)for(let j=0;j<n;j++)cell(-angle+2*angle*i/n,-angle+2*angle*j/n,-angle+2*angle*(i+1)/n,-angle+2*angle*(j+1)/n,0);
      for(let k=0;k<=divisions;k++){
        const fixed=-angle+2*angle*k/divisions;
        for(let axis=0;axis<2;axis++)for(let j=0;j<60;j++){
          const from=-angle+2*angle*j/60,to=-angle+2*angle*(j+1)/60;
          const uv1=axis?[fixed,from]:[from,fixed],uv2=axis?[fixed,to]:[to,fixed];
          if(!hidden(radius,...uv1)&&!hidden(radius,...uv2))segment(point(radius,...uv1),point(radius,...uv2),'rgba(255,234,181,'+Math.min(.65,alpha*2.4)+')');
        }
      }
    }
    // Four straight construction rays pass through corresponding shell corners.
    // Short collinear segments participate in the same depth sorting as the meshes.
    for(const u of [-angle,angle])for(const v of [-angle,angle]){
      for(let j=0;j<120;j++){
        const from=3*step*j/120,to=3*step*(j+1)/120;
        const mid=point((from+to)/2,u,v);
        if(Math.hypot(...mid)<earthRadius)continue;
        segment(point(from,u,v),point(to,u,v),
          u>0?'rgba(156,206,250,.48)':'rgba(156,206,250,.28)',1);
      }
    }
    for(let n=1;n<=3;n++){
      shell(step*n,n,.34/Math.pow(n,1.1),true);
      labels.push({p:project(point(step*n,0,-angle)),text:['','빛 1','빛 1/4','빛 1/9'][n]});
    }
    for(let front=0;front<3;front++){
      const progress=(phase+front/3)%1;
      shell(40*unit/co*progress,1,.14*Math.sin(Math.PI*progress));
    }
    // Earth is an opaque sphere mesh, shaded by the same point light as the shells.
    const received=StarPhysics.flux(d,absoluteMagnitude),light=1-Math.exp(-.85*Math.pow(received,.65));
    glow(c,ox,y,earthRadius*2.7,.1+.48*light,'110,192,255');
    const sphere=(lon,lat)=>[earthRadius*Math.cos(lat)*Math.cos(lon),earthRadius*Math.sin(lat),earthRadius*Math.cos(lat)*Math.sin(lon)];
    for(let j=0;j<24;j++)for(let i=0;i<48;i++){
      const lon=i*Math.PI*2/48,lat=-Math.PI/2+j*Math.PI/24;
      const lon2=lon+Math.PI*2/48,lat2=lat+Math.PI/24;
      const center=sphere((lon+lon2)/2,(lat+lat2)/2);
      // Front-facing hemisphere only. Camera depth is an orthonormal dot product.
      if(-center[0]*si+center[2]*co<=0)continue;
      const toLight=[separation-center[0],-center[1],-center[2]],length=Math.hypot(...toLight);
      const lambert=Math.max(0,(center[0]*toLight[0]+center[1]*toLight[1]+center[2]*toLight[2])/(earthRadius*length));
      const intensity=.065+.935*light*lambert;
      const land=Math.sin(lon*3+Math.sin(lat*4))+.55*Math.cos(lon*7-lat*5)>.45;
      const base=land?[93,175,123]:[42,131,194];
      const color='rgb('+base.map(v=>Math.round(v*intensity)).join(',')+')';
      polygon([sphere(lon,lat),sphere(lon2,lat),sphere(lon2,lat2),sphere(lon,lat2)],color,color);
    }
    queue.sort((a,b)=>a.depth-b.depth);for(const item of queue)item.draw();
    c.lineWidth=1;c.font='10px "Malgun Gothic",sans-serif';c.textAlign='center';
    if(w>700)for(const label of labels){c.fillStyle='#ddca9d';c.fillText(label.text,label.p[0],label.p[1]-12);}
    c.font='11px "Malgun Gothic",sans-serif';c.textAlign='center';c.fillStyle='#a0b1c9';c.fillText('지구 · 관측자',ox,y+35);
    const railY=h-30;c.strokeStyle='#42536a';c.beginPath();c.moveTo(ox,railY);c.lineTo(end,railY);c.stroke();
    for(let v=5;v<=30;v+=5){let x=ox+v*unit;c.strokeStyle=v===10?'#75e4e0':'#42536a';c.beginPath();c.moveTo(x,railY-5);c.lineTo(x,railY+5);c.stroke();c.fillStyle=v===10?'#75e4e0':'#7a8ca6';c.fillText(v+'pc',x,railY+20);}
    const x10=ox+10*unit;c.setLineDash([4,5]);c.strokeStyle='#75e4e04d';c.beginPath();c.moveTo(x10,10);c.lineTo(x10,railY);c.stroke();c.setLineDash([]);
    c.textAlign='left';c.fillStyle='#75e4e0';c.fillText('10pc 표준 거리',x10+7,18);
    c.strokeStyle='#ffcf8860';c.beginPath();c.moveTo(sx,y+18);c.lineTo(sx,railY);c.stroke();
    glow(c,sx,y,36*brilliance,Math.min(.95,.6*brilliance),'255,209,150');
    c.save();c.translate(sx,y);
    for(let axis=0;axis<2;axis++){
      c.save();c.rotate(axis*Math.PI/2);
      const length=24*brilliance,ray=c.createLinearGradient(-length,0,length,0);
      ray.addColorStop(0,'rgba(255,226,180,0)');
      ray.addColorStop(.5,`rgba(255,239,210,${Math.min(.95,.55*brilliance)})`);
      ray.addColorStop(1,'rgba(255,226,180,0)');
      c.fillStyle=ray;c.fillRect(-length,-.8,length*2,1.6);c.restore();
    }
    c.restore();
    c.beginPath();c.arc(sx,y,7,0,Math.PI*2);c.fillStyle=`rgba(255,241,214,${Math.min(1,.65*brilliance)})`;c.fill();
    const hint=options.showDragHint;

    c.save();
    c.beginPath();c.arc(sx,y,22,0,Math.PI*2);
    c.strokeStyle=options.active?'#92ffe4':'#ffd29a80';c.lineWidth=hint?2.5:1;
    if(hint){c.shadowColor='#75e4e0';c.shadowBlur=10;}
    c.stroke();c.restore();
    c.textAlign='center';c.fillStyle='#ffd29a';if(!hint)c.fillText('←  별 이동  →',sx,y-45);if(!options.hideMagnitude&&!hint)c.fillText('M = '+absoluteMagnitude.toFixed(1),sx,y-30);c.fillText(d.toFixed(1)+' pc',sx,y+43);
    c.beginPath();c.arc(sx,railY,4,0,Math.PI*2);c.fillStyle='#ffd29a';c.fill();
    if(w>700){c.textAlign='right';c.fillStyle='#667f9b';c.fillText('별 자체의 밝기 표현 · M이 작을수록 밝음',w-20,18);}
    if(options.origin!==null && options.origin!==undefined){
      const originX=ox+options.origin*unit;
      c.beginPath();c.arc(originX,y,25,0,Math.PI*2);c.strokeStyle='#8fffe6';c.lineWidth=2;c.stroke();
      c.fillStyle='#9fffe8';c.textAlign='center';if(!hint)c.fillText('출발 기준',originX,y-62);
    }
    if(hint){
      const bounce=options.reduceMotion?0:12*Math.pow(Math.sin(Math.PI*(options.cueTime||0)/.85),2);
      const tipY=y-32-bounce;
      c.save();c.fillStyle='#fff';c.strokeStyle='#06101e';c.lineWidth=4;
      c.lineJoin='round';c.shadowColor='#000b';c.shadowBlur=8;c.shadowOffsetY=2;
      // Solid arrow remains legible against the glowing shell and bright stars.
      c.beginPath();c.moveTo(sx-5,tipY-34);c.lineTo(sx+5,tipY-34);
      c.lineTo(sx+5,tipY-15);c.lineTo(sx+15,tipY-15);
      c.lineTo(sx,tipY);c.lineTo(sx-15,tipY-15);c.lineTo(sx-5,tipY-15);c.closePath();
      c.stroke();c.fill();
      c.font='bold 19px "Segoe UI",sans-serif';c.textAlign='center';
      c.strokeText('Drag me!',sx,tipY-46);c.fillText('Drag me!',sx,tipY-46);
      c.restore();
    }
    return g;
  }
  return {photo,scene,geometry,rayHit,newStarfield};
})();
