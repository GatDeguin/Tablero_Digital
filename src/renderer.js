/** VELORA: dependency-free WebGL mesh renderer. All artwork and geometry generated locally. */
class CockpitRenderer {
  constructor(canvas, fallback, speedHost, compassHost) {
    this.canvas=canvas;this.fallback=fallback;this.hosts=[speedHost,compassHost];this.value=0;this.target=0;this.heading=0;this.headingTarget=0;this.unit='kmh';this.theme='carbon';this.quality='auto';this.reduced=false;this.last=0;this.pending=0;this.bounds=[];this.onFault=()=>{};this.speedKnown=false;this.headingKnown=false;this.light=[0,0];this.locked=false;this.frames=0;this.frameMs=0;
    try{this.gl=canvas.getContext('webgl',{alpha:true,antialias:true,premultipliedAlpha:false,powerPreference:'low-power'});if(!this.gl)throw Error('WebGL no disponible');this.initGL();}catch(e){this.failed=true;this.error=e.message;}
    canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();this.failed=true;this.onFault('WebGL interrumpido; modo 2D activo.');this.invalidate();});
    canvas.addEventListener('webglcontextrestored',()=>{try{this.initGL();this.failed=false;this.invalidate();}catch{this.failed=true;}});
    this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(canvas.parentElement);this.hosts.forEach(h=>this.resizeObserver.observe(h));
    this.onPointer=e=>{if(this.locked||this.reduced||e.pointerType!=='mouse')return;const b=this.canvas.parentElement.getBoundingClientRect();this.light=[(e.clientX-b.left)/b.width-.5,(e.clientY-b.top)/b.height-.5];this.invalidate();};
    this.onLeave=()=>this.lightHome();this.canvas.parentElement.addEventListener('pointermove',this.onPointer,{passive:true});this.canvas.parentElement.addEventListener('pointerleave',this.onLeave);
    this.makeFaces();this.resize();
  }
  lightHome(){this.light=[0,0];this.invalidate();}
  compile(type,src){const g=this.gl,s=g.createShader(type);g.shaderSource(s,src);g.compileShader(s);if(!g.getShaderParameter(s,g.COMPILE_STATUS))throw Error(g.getShaderInfoLog(s));return s;}
  initGL(){const g=this.gl;
    const vs=`attribute vec3 aPosition;attribute vec3 aNormal;attribute vec2 aUV;uniform mat4 uMatrix;uniform mat4 uModel;varying vec3 vNormal;varying vec2 vUV;varying vec3 vPosition;void main(){vec4 p=uModel*vec4(aPosition,1.);vPosition=p.xyz;vNormal=mat3(uModel)*aNormal;vUV=aUV;gl_Position=uMatrix*p;}`;
    // Analytic GGX-style direct lighting + procedural studio reflection, not ray tracing/HDRI.
    const fs=`precision mediump float;
    varying vec3 vNormal;varying vec2 vUV;varying vec3 vPosition;
    uniform vec3 uColor;uniform float uMetal,uRough,uMode,uAlpha;uniform vec2 uLight;uniform sampler2D uTexture;
    vec3 mapped(vec3 c){c=c/(c+vec3(1.));return pow(max(c,vec3(0.)),vec3(1./2.2));}
    void main(){
      vec3 n=normalize(vNormal),v=normalize(vec3(.04,.15,2.)),l=normalize(vec3(-.55+uLight.x*.35,.9-uLight.y*.25,1.3));
      vec3 h=normalize(v+l),base=pow(uColor,vec3(2.2));
      float nv=max(dot(n,v),.01),nl=max(dot(n,l),.0),nh=max(dot(n,h),.0),vh=max(dot(v,h),.0);
      float r=max(uRough,.12),a=r*r,a2=a*a,d=nh*nh*(a2-1.)+1.;
      float D=a2/max(3.14159*d*d,.001),k=(r+1.)*(r+1.)/8.;
      float G=nv/(nv*(1.-k)+k)*nl/max(nl*(1.-k)+k,.001);
      vec3 F0=mix(vec3(.04),base,uMetal),F=F0+(1.-F0)*pow(1.-vh,5.);
      vec3 spec=D*G*F/max(4.*nv*nl,.01);
      vec3 refl=reflect(-v,n);float strip=pow(max(dot(refl,normalize(vec3(-.6+uLight.x*.3,.8,1.))),0.),20.);
      float strip2=pow(max(dot(refl,normalize(vec3(.85,-.3,1.))),0.),36.);
      float fres=pow(1.-nv,4.);
      vec3 c=base*.24+(base*(1.-uMetal)/3.14159+spec)*nl*2.8;
      c+=uMetal*(vec3(.52,.65,.72)*strip*.85+vec3(.42,.51,.62)*strip2*.4+base*.3+vec3(.10)*fres);
      float alpha=uAlpha;
      if(uMode>.5&&uMode<1.5){gl_FragColor=vec4(texture2D(uTexture,vUV).rgb,1.);return;}
      if(uMode>1.5){c=vec3(.6,.78,.88);alpha=(strip*.10+strip2*.05+fres*.15)*uAlpha;}
      gl_FragColor=vec4(mapped(c),alpha);
    }`;
    this.program=g.createProgram();const sv=this.compile(g.VERTEX_SHADER,vs),sf=this.compile(g.FRAGMENT_SHADER,fs);g.attachShader(this.program,sv);g.attachShader(this.program,sf);g.linkProgram(this.program);g.deleteShader(sv);g.deleteShader(sf);if(!g.getProgramParameter(this.program,g.LINK_STATUS))throw Error(g.getProgramInfoLog(this.program)||'No se pudo enlazar WebGL');
    this.loc={};for(const n of ['aPosition','aNormal','aUV'])this.loc[n]=g.getAttribLocation(this.program,n);for(const n of ['uMatrix','uModel','uColor','uMetal','uRough','uMode','uAlpha','uTexture','uLight'])this.loc[n]=g.getUniformLocation(this.program,n);
    this.meshes={outer:this.upload(this.torus(.975,.048,128,16)),rim:this.upload(this.torus(.907,.025,128,12)),inner:this.upload(this.torus(.875,.006,128,8)),face:this.upload(this.disc(.873,96)),hub:this.upload(this.disc(.083,48)),hubRing:this.upload(this.torus(.085,.013,48,12)),needle:this.upload(this.prism([[-.14,-.024],[.79,-.008],[.84,0],[.79,.008],[-.14,.024]],.017)),north:this.upload(this.prism([[0,.59],[-.085,0],[.085,0]],.015)),south:this.upload(this.prism([[0,-.5],[-.065,0],[.065,0]],.015))};
    this.textures=[];g.enable(g.DEPTH_TEST);g.enable(g.BLEND);g.blendFunc(g.SRC_ALPHA,g.ONE_MINUS_SRC_ALPHA);g.clearColor(0,0,0,0);if(this.faces)this.updateTextures();
  }
  upload(a){const g=this.gl,b=g.createBuffer();g.bindBuffer(g.ARRAY_BUFFER,b);g.bufferData(g.ARRAY_BUFFER,new Float32Array(a),g.STATIC_DRAW);return {b,count:a.length/8};}
  torus(R,r,N,M){let a=[];const vert=(i,j)=>{let u=i/N*Math.PI*2,v=j/M*Math.PI*2,cu=Math.cos(u),su=Math.sin(u),cv=Math.cos(v),sv=Math.sin(v);return [(R+r*cv)*cu,(R+r*cv)*su,r*sv,cv*cu,cv*su,sv,i/N,j/M];};for(let i=0;i<N;i++)for(let j=0;j<M;j++)for(const [ii,jj] of [[i,j],[i+1,j],[i,j+1],[i,j+1],[i+1,j],[i+1,j+1]])a.push(...vert(ii,jj));return a;}
  disc(r,n){let a=[];for(let i=0;i<n;i++){const u=i/n*Math.PI*2,v=(i+1)/n*Math.PI*2;for(const p of [[0,0],[r*Math.cos(u),r*Math.sin(u)],[r*Math.cos(v),r*Math.sin(v)]])a.push(p[0],p[1],0,0,0,1,p[0]/(2*r)+.5,.5-p[1]/(2*r));}return a;}
  prism(poly,h){let a=[];for(let i=1;i<poly.length-1;i++)for(const p of [poly[0],poly[i],poly[i+1]])a.push(p[0],p[1],h,0,0,1,0,0);for(let i=0;i<poly.length;i++){const p=poly[i],q=poly[(i+1)%poly.length],dx=q[0]-p[0],dy=q[1]-p[1],len=Math.hypot(dx,dy);for(const [x,y,z]of [[p[0],p[1],0],[q[0],q[1],0],[p[0],p[1],h],[p[0],p[1],h],[q[0],q[1],0],[q[0],q[1],h]])a.push(x,y,z,dy/len,-dx/len,0,0,0);}return a;}
  makeFaces(){this.faces=[this.face(false),this.face(true)];if(this.gl&&!this.failed)this.updateTextures();this.invalidate();}
  face(compass){const c=document.createElement('canvas');c.width=c.height=1024;const x=c.getContext('2d'),C=512,R=510;
    const grad=x.createRadialGradient(C,420,0,C,C,R);grad.addColorStop(0,this.theme==='day'?'#28333a':'#182027');grad.addColorStop(.67,'#10161a');grad.addColorStop(1,'#05080b');x.fillStyle=grad;x.fillRect(0,0,1024,1024);
    x.strokeStyle='rgba(255,255,255,.026)';x.lineWidth=1;for(let r=12;r<510;r+=7){x.beginPath();x.arc(C,C,r,0,Math.PI*2);x.stroke();}
    if(!compass){
      const max=this.unit==='mph'?140:220;const steps=max/2;
      for(let i=0;i<=steps;i++){const val=i*2,t=(225-270*val/max)*Math.PI/180,major=val%20===0,mid=val%10===0,ro=R*.94,ri=R*(major?.84:mid?.88:.913);x.strokeStyle=val>=max*.81?'#dd7565':major?'#e2e9e6':'#73818a';x.lineWidth=major?4:mid?2.5:1.5;x.beginPath();x.moveTo(C+Math.cos(t)*ri,C-Math.sin(t)*ri);x.lineTo(C+Math.cos(t)*ro,C-Math.sin(t)*ro);x.stroke();if(major){x.fillStyle='#dce4e5';x.font='400 49px Arial';x.textAlign='center';x.textBaseline='middle';x.fillText(String(val),C+Math.cos(t)*R*.724,C-Math.sin(t)*R*.724);}}
      x.strokeStyle='#28363d';x.lineWidth=3;x.beginPath();x.arc(C,C,R*.62,-Math.PI*1.25,Math.PI*.25);x.stroke();
      x.fillStyle=this.theme==='amber'?'#deb17c':'#cbd5d8';x.font='600 18px Arial';x.textAlign='center';x.fillText('V E L O R A',C,365);x.fillStyle='#7f929b';x.font='15px Arial';x.fillText('G R O U N D   S P E E D',C,397);
    }else{
      for(let i=0;i<72;i++){const t=i*5*Math.PI/180,major=i%6===0,ri=R*(major?.81:.875),ro=R*.92;x.strokeStyle=major?'#aebfc5':'#485a63';x.lineWidth=major?3:1.5;x.beginPath();x.moveTo(C+Math.sin(t)*ri,C-Math.cos(t)*ri);x.lineTo(C+Math.sin(t)*ro,C-Math.cos(t)*ro);x.stroke();}
      x.textAlign='center';x.textBaseline='middle';['N','E','S','O'].forEach((v,i)=>{const t=i*Math.PI/2;x.fillStyle=i===0?'#f1846e':'#b3c5cb';x.font='400 53px Arial';x.fillText(v,C+Math.sin(t)*R*.70,C-Math.cos(t)*R*.70);});
      x.strokeStyle='#24343e';x.lineWidth=1.5;for(const r of [.30,.47,.61]){x.beginPath();x.arc(C,C,R*r,0,Math.PI*2);x.stroke();}
      x.beginPath();x.moveTo(C,R*.4);x.lineTo(C,1024-R*.4);x.moveTo(R*.4,C);x.lineTo(1024-R*.4,C);x.stroke();
    }
    return c;
  }
  updateTextures(){const g=this.gl;this.textures.forEach(t=>g.deleteTexture(t));this.textures=this.faces.map(c=>{const t=g.createTexture();g.bindTexture(g.TEXTURE_2D,t);g.texImage2D(g.TEXTURE_2D,0,g.RGBA,g.RGBA,g.UNSIGNED_BYTE,c);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MIN_FILTER,g.LINEAR);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MAG_FILTER,g.LINEAR);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_S,g.CLAMP_TO_EDGE);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_T,g.CLAMP_TO_EDGE);return t;});}
  resize(){const b=this.canvas.parentElement.getBoundingClientRect();this.w=b.width;this.h=b.height;if(!this.w||!this.h)return;const dpr=Math.min(window.devicePixelRatio||1,this.quality==='eco'?1:this.quality==='high'?2:1.5);for(const c of [this.canvas,this.fallback]){c.width=Math.round(this.w*dpr);c.height=Math.round(this.h*dpr);c.style.width=this.w+'px';c.style.height=this.h+'px';}this.bounds=this.hosts.map(el=>{const r=el.getBoundingClientRect();return {x:r.left-b.left+r.width/2,y:r.top-b.top+r.height/2,r:Math.min(r.width,r.height)/2,visible:r.width>0&&r.height>0};});this.invalidate();}
  configure({theme,unit,quality,reduced}){const change=theme!==this.theme||unit!==this.unit;this.theme=theme;this.unit=unit;this.quality=quality;this.reduced=reduced;if(change)this.makeFaces();this.resize();}
  set(speed,heading){this.speedKnown=typeof speed==='number'&&Number.isFinite(speed);this.headingKnown=typeof heading==='number'&&Number.isFinite(heading);this.target=Math.max(0,Math.min(this.unit==='mph'?140:220,(speed??0)*(this.unit==='mph'?.621371:1)));if(this.headingKnown)this.headingTarget=heading;if(this.reduced){this.value=this.target;this.heading=this.headingTarget;}this.invalidate();}
  invalidate(){if(!this.pending&&!document.hidden)this.pending=requestAnimationFrame(t=>this.frame(t));}
  frame(t){const started=performance.now();this.frames++;this.pending=0;if(document.hidden)return;const dt=Math.min(.08,(t-(this.last||t-16))/1000);this.last=t;const k=this.reduced?1:1-Math.exp(-dt/.12);this.value+=(this.target-this.value)*k;const dh=((this.headingTarget-this.heading+540)%360)-180;this.heading+=dh*k;const flat=this.failed||this.quality==='flat';this.canvas.hidden=flat;this.fallback.hidden=!flat;
    if(flat)this.drawFlat();else this.drawGL();this.frameMs=performance.now()-started;
    if(Math.abs(this.value-this.target)>.025||Math.abs(dh)>.08)this.invalidate();
  }
  model(x,y,r,z,angle=0){const c=Math.cos(angle)*r,s=Math.sin(angle)*r;return new Float32Array([c,s,0,0,-s,c,0,0,0,0,r,0,x-this.w/2,this.h/2-y,z,1]);}
  draw(mesh,b,z,color,metal=.6,rough=.25,angle=0,mode=0,texture=0,alpha=1){const g=this.gl,L=this.loc;g.bindBuffer(g.ARRAY_BUFFER,mesh.b);for(const [name,n,offset]of [['aPosition',3,0],['aNormal',3,12],['aUV',2,24]]){g.enableVertexAttribArray(L[name]);g.vertexAttribPointer(L[name],n,g.FLOAT,false,32,offset);}g.uniformMatrix4fv(L.uModel,false,this.model(b.x,b.y,b.r,z,angle));g.uniform3fv(L.uColor,color);g.uniform1f(L.uMetal,metal);g.uniform1f(L.uRough,rough);g.uniform1f(L.uMode,mode);g.uniform1f(L.uAlpha,alpha);if(mode===1){g.bindTexture(g.TEXTURE_2D,this.textures[texture]);g.uniform1i(L.uTexture,0);}g.drawArrays(g.TRIANGLES,0,mesh.count);}
  drawGL(){const g=this.gl;if(!g||g.isContextLost())return;g.viewport(0,0,this.canvas.width,this.canvas.height);g.clear(g.COLOR_BUFFER_BIT|g.DEPTH_BUFFER_BIT);g.useProgram(this.program);g.uniform2fv(this.loc.uLight,this.light);g.uniformMatrix4fv(this.loc.uMatrix,false,new Float32Array([2/this.w,0,0,0,0,2/this.h,0,0,0,0,-.002,0,0,0,0,1]));const m=this.meshes;
    this.bounds.forEach((b,i)=>{if(!b.visible)return;this.draw(m.outer,b,0,[.19,.215,.235],.95,.24);this.draw(m.rim,b,7,[.40,.46,.48],.97,.18);this.draw(m.face,b,4,[1,1,1],0,1,0,1,i);this.draw(m.inner,b,9,[.28,.34,.36],.8,.2);
      if(i===0&&this.speedKnown){const max=this.unit==='mph'?140:220,a=(225-270*this.value/max)*Math.PI/180;this.draw(m.needle,b,14,[.86,.24,.16],.25,.25,a);}else if(i===1&&this.headingKnown){const a=-this.heading*Math.PI/180;this.draw(m.north,b,14,[.86,.31,.23],.4,.3,a);this.draw(m.south,b,14,[.50,.63,.65],.7,.22,a);}
      this.draw(m.hubRing,b,19,[.39,.46,.49],.95,.15);this.draw(m.hub,b,21,[.06,.08,.10],.55,.38);
      g.depthMask(false);this.draw(m.face,b,26,[1,1,1],.3,.05,0,2,0,.5);g.depthMask(true);
    });
  }
  drawFlat(){
    const c=this.fallback,x=c.getContext('2d'),scale=c.width/this.w;
    x.setTransform(scale,0,0,scale,0,0);x.clearRect(0,0,this.w,this.h);
    this.bounds.forEach((b,i)=>{
      if(!b.visible)return;x.save();x.translate(b.x,b.y);const r=b.r;
      const disc=(radius,paint)=>{x.fillStyle=paint;x.beginPath();x.arc(0,0,radius,0,Math.PI*2);x.fill();};
      // Layered chamfers, contact shadow and glass are a Canvas fallback, not 3D geometry.
      x.shadowColor='#000b';x.shadowBlur=r*.07;x.shadowOffsetY=r*.035;disc(r,'#060b10');x.shadowBlur=0;x.shadowOffsetY=0;
      let metal=x.createLinearGradient(-r,-r,r,r);metal.addColorStop(0,'#becacc');metal.addColorStop(.12,'#6c7c86');metal.addColorStop(.27,'#1d2b34');metal.addColorStop(.58,'#3b4b54');metal.addColorStop(.84,'#79888b');metal.addColorStop(1,'#26343c');disc(r*.995,metal);
      let rim=x.createLinearGradient(r,-r,-r,r);rim.addColorStop(0,'#17242c');rim.addColorStop(.22,'#43525c');rim.addColorStop(.7,'#101b23');rim.addColorStop(1,'#a1b0b3');disc(r*.964,rim);
      x.lineWidth=1;x.strokeStyle='#d3e8eb3b';x.beginPath();x.arc(0,0,r*.982,0,Math.PI*2);x.stroke();
      disc(r*.907,'#050a0f');x.save();x.beginPath();x.arc(0,0,r*.88,0,Math.PI*2);x.clip();x.drawImage(this.faces[i],-r*.88,-r*.88,r*1.76,r*1.76);x.restore();
      x.lineWidth=1.3;x.strokeStyle='#637b824f';x.beginPath();x.arc(0,0,r*.895,0,Math.PI*2);x.stroke();
      if((i===0&&this.speedKnown)||(i===1&&this.headingKnown)){
        x.save();x.rotate(i===0?-(225-270*this.value/(this.unit==='mph'?140:220))*Math.PI/180:this.heading*Math.PI/180-Math.PI/2);
        x.shadowColor='#000';x.shadowBlur=4;x.shadowOffsetY=3;
        const needle=x.createLinearGradient(0,-r*.024,0,r*.024);needle.addColorStop(0,'#ffa083');needle.addColorStop(.45,'#e47356');needle.addColorStop(1,'#943c31');x.fillStyle=needle;
        x.beginPath();x.moveTo(-r*.13,-r*.023);x.lineTo(r*.74,-r*.006);x.lineTo(r*.79,0);x.lineTo(r*.74,r*.006);x.lineTo(-r*.13,r*.023);x.closePath();x.fill();x.restore();
      }
      let hub=x.createLinearGradient(-r*.08,-r*.08,r*.08,r*.08);hub.addColorStop(0,'#c4d4d3');hub.addColorStop(.45,'#71868b');hub.addColorStop(1,'#25353d');disc(r*.085,hub);disc(r*.063,'#19272f');
      x.save();x.beginPath();x.arc(0,0,r*.884,0,Math.PI*2);x.clip();const glass=x.createLinearGradient(-r+r*this.light[0]*.15,-r,r*.55,r);glass.addColorStop(0,'#c3e2ea10');glass.addColorStop(.4,'#c3e2ea03');glass.addColorStop(.42,'#00000000');glass.addColorStop(.85,'#00000000');glass.addColorStop(1,'#c3e2ea07');x.fillStyle=glass;x.fillRect(-r,-r,r*2,r*2);x.restore();x.restore();
    });
  }
  destroy(){this.canvas.parentElement.removeEventListener('pointermove',this.onPointer);this.canvas.parentElement.removeEventListener('pointerleave',this.onLeave);cancelAnimationFrame(this.pending);this.resizeObserver.disconnect();if(this.gl){for(const m of Object.values(this.meshes||{}))this.gl.deleteBuffer(m.b);this.textures?.forEach(t=>this.gl.deleteTexture(t));this.gl.deleteProgram(this.program);}}
}
