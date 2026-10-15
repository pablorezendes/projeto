import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

/** Finished-product presentation only. No manufacturing or assembly data.
 * createProduct(THREE, { anisotropy, assetBase }) returns a group, two door
 * pivots, chair and personAnchor; setDoors takes radians (0 to 77 degrees).
 * personAnchor shares the chair frame: local +Z points toward the feet.
 * Reference pose: hip [0,.59,.05], shoulders [0,1.11,-.62], head [0,1.35,-.88],
 * knees [0,.51,.63], ankles [0,.36,1.04]. setScene accepts a CSS light color.
 * ready resolves once the two raster decoration masks have loaded.
 */
export function createProduct(THREE, options = {}) {
  const group = new THREE.Group();
  group.name = 'AURION — apresentação do produto';
  const anisotropy = options.anisotropy || 4;
  const assetBase = options.assetBase || './';
  const v = (x,y,z) => new THREE.Vector3(x,y,z);
  const materials = [];
  const track = m => (materials.push(m), m);
  const standard = (color,roughness=.5,metalness=0) => track(new THREE.MeshStandardMaterial({color,roughness,metalness}));
  const physical = parameters => track(new THREE.MeshPhysicalMaterial(parameters));
  const add = (geometry, material, parent=group, shadow=true) => {
    const m = new THREE.Mesh(geometry, material);
    m.castShadow = shadow; m.receiveShadow = true; parent.add(m); return m;
  };
  const rounded = (size,position,material,radius=.03,parent=group) => {
    const m = add(new RoundedBoxGeometry(...size,5,radius),material,parent);
    m.position.set(...position); return m;
  };
  const rod = (a,b,r,material,parent=group) => {
    const dir = b.clone().sub(a);
    const m = add(new THREE.CylinderGeometry(r,r,dir.length(),12),material,parent);
    m.position.copy(a).add(b).multiplyScalar(.5);
    m.quaternion.setFromUnitVectors(v(0,1,0),dir.normalize()); return m;
  };
  const tube = (points,r,material,parent=group) => add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),Math.max(24,points.length*4),r,6,false),material,parent);
  const texture = (canvas,srgb=true,repeat=1) => {
    const t = new THREE.CanvasTexture(canvas);
    if(srgb)t.colorSpace=THREE.SRGBColorSpace;
    t.anisotropy=anisotropy;
    if(repeat!==1) {t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(repeat,repeat);}
    return t;
  };
  const canvas = n => {const c=document.createElement('canvas');c.width=c.height=n;return c;};
  const rng = seed => () => ((seed=(seed*1664525+1013904223)>>>0)/4294967296);
  // Fine finish variation reads as lacquer, leather and fabric under studio light.
  const noise = (seed,base,contrast,repeat=1) => {
    const c=canvas(256),ctx=c.getContext('2d'),data=ctx.createImageData(256,256),r=rng(seed);
    for(let i=0;i<data.data.length;i+=4){const n=base+(r()-.5)*contrast;data.data[i]=data.data[i+1]=data.data[i+2]=n;data.data[i+3]=255;}
    ctx.putImageData(data,0,0);return texture(c,false,repeat);
  };
  const finishBump = noise(241,130,22,5);
  const leatherBump = noise(739,130,105,3);
  const leatherRoughness = noise(214,155,40,3);
  const shell = physical({color:'#e8e0cd',roughness:.42,metalness:.07,clearcoat:.32,clearcoatRoughness:.3,bumpMap:finishBump,bumpScale:.00065,envMapIntensity:1.0});
  const edge = physical({color:'#ded4bf',roughness:.32,metalness:.42,clearcoat:.4,envMapIntensity:1.0});
  const gasket = standard('#373b3a',.8,.05);
  const darkBase = physical({color:'#1b2326',roughness:.34,metalness:.45,clearcoat:.3});
  const bronze = physical({color:'#8e6340',roughness:.32,metalness:.8,clearcoat:.25});
  const leather = physical({color:'#9b5935',roughness:.56,metalness:0,clearcoat:.15,clearcoatRoughness:.65,bumpMap:leatherBump,bumpScale:.0009,roughnessMap:leatherRoughness,envMapIntensity:.65});
  const leatherSides = physical({color:'#714229',roughness:.59,bumpMap:leatherBump,bumpScale:.0009,clearcoat:.15});
  const thread = standard('#bc8964',.82);
  const pipe = physical({color:'#5c3522',roughness:.65,bumpMap:leatherBump,bumpScale:.0005});
  const lightM = track(new THREE.MeshStandardMaterial({color:'#b7fcff',emissive:'#00c8ed',emissiveIntensity:3.0,roughness:.28,metalness:.08,toneMapped:false}));
  const floorM = physical({color:'#666b69',roughness:.48,metalness:.13,bumpMap:noise(874,128,12,7),bumpScale:.001,clearcoat:.25});
  const starsCanvas=canvas(1024),starCtx=starsCanvas.getContext('2d');
  starCtx.fillStyle='#000';starCtx.fillRect(0,0,1024,1024);
  const starRandom=rng(314);
  for(let i=0;i<200;i++){
    const x=starRandom()*1024,y=starRandom()*1024,r=.45+starRandom()*.8;
    starCtx.fillStyle=`rgba(255,255,255,${.3+starRandom()*.65})`;
    starCtx.beginPath();starCtx.arc(x,y,r,0,Math.PI*2);starCtx.fill();
  }
  const fabricCanvas=canvas(256),fabricCtx=fabricCanvas.getContext('2d');
  fabricCtx.fillStyle='#d5d6cf';fabricCtx.fillRect(0,0,256,256);
  fabricCtx.fillStyle='#8b938b';
  for(let y=2;y<256;y+=8)for(let x=2;x<256;x+=8){fabricCtx.beginPath();fabricCtx.arc(x,y,.6,0,Math.PI*2);fabricCtx.fill();}
  const fabricTex=texture(fabricCanvas,true,4);
  const linerD=standard('#e3e2d8',.84);
  linerD.map=fabricTex;linerD.bumpMap=noise(216,125,22,5);linerD.bumpScale=.00065;
  const linerF=linerD.clone();materials.push(linerF);
  linerF.emissive=new THREE.Color('#d7f1ed');linerF.emissiveMap=texture(starsCanvas,false);linerF.emissiveIntensity=.7;
  const glass=physical({color:'#b2c8c4',roughness:.08,metalness:.03,transmission:.68,thickness:.012,ior:1.46,transparent:true,opacity:.62,depthWrite:false,side:THREE.DoubleSide,envMapIntensity:1.2});

  // Broad installed envelope and visible surface finish; internal structure omitted.
  const A=1.7, bottom=.105, top=2.23, shoulder=1.66;
  const C=A*(top-shoulder)/(top-bottom), height=top-bottom;
  rounded([3.47,.09,3.47],[0,.055,0],edge,.022);
  rounded([3.38,.035,3.38],[0,.108,0],floorM,.012);
  rounded([3.30,.035,3.30],[0,.012,0],darkBase,.012);
  for(let i=0;i<4;i++){
    const ring=new THREE.Group();ring.rotation.y=i*Math.PI/2;group.add(ring);
    rod(v(-1.69,.061,1.736),v(1.69,.061,1.736),.006,lightM,ring);
    rod(v(-1.71,.119,1.71),v(1.71,.119,1.71),.013,edge,ring);
  }
  const doors=[],symbolMaterials=[];
  const faceMaterials={};
  const loader=new THREE.TextureLoader();
  const ready=Promise.all(['door','fixed'].map(kind=>new Promise((resolve,reject)=>{
    const t=loader.load(`${assetBase}decor-${kind}.png`,loaded=>{
      const mask=document.createElement('canvas');mask.width=loaded.image.width;mask.height=loaded.image.height;
      const context=mask.getContext('2d');context.fillStyle='#000';context.fillRect(0,0,mask.width,mask.height);
      context.globalCompositeOperation='lighten';
      for(let offset=-3;offset<=3;offset++){
        context.drawImage(loaded.image,offset,0);
        context.drawImage(loaded.image,0,offset);
      }
      for(const x of [-2,2])for(const y of [-2,2])context.drawImage(loaded.image,x,y);
      loaded.image=mask;loaded.needsUpdate=true;
      resolve(loaded);
    },undefined,reject);
    t.anisotropy=anisotropy;
    const m=track(new THREE.MeshBasicMaterial({color:'#00bfff',alphaMap:t,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1,toneMapped:false}));
    symbolMaterials.push(m);faceMaterials[kind]=m;
  })));

  function slab(points,normal,thickness){
    const inner=points.map(p=>p.clone().addScaledVector(normal,-thickness));
    const pos=[],uv=[],indices=[];
    const append=(p,t)=>{pos.push(p.x,p.y,p.z);uv.push(...t);return pos.length/3-1;};
    const pointUV=p=>[(p.x+A)/(2*A),(p.y+shoulder-bottom)/height];
    for(const p of points)append(p,pointUV(p));
    indices.push(0,1,2,0,2,3);
    for(const p of inner)append(p,pointUV(p));
    indices.push(4,6,5,4,7,6);
    for(let i=0;i<4;i++){
      const j=(i+1)%4,b=pos.length/3;
      append(points[i],[0,0]);append(inner[i],[0,1]);append(inner[j],[1,1]);append(points[j],[1,0]);
      indices.push(b,b+1,b+2,b,b+2,b+3);
    }
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);
    g.addGroup(0,6,0);g.addGroup(6,6,1);g.addGroup(12,24,2);g.computeVertexNormals();return g;
  }
  const faceNormal=v(0,A,height).normalize();
  function createFace(rotation,movable){
    const orientation=new THREE.Group();orientation.rotation.y=rotation;group.add(orientation);
    const pivot=new THREE.Group();pivot.position.set(0,shoulder,C);orientation.add(pivot);
    const p=[v(-A,bottom-shoulder,A-C),v(A,bottom-shoulder,A-C),v(C,0,0),v(-C,0,0)];
    const geom=slab(p,faceNormal,.048);
    const panel=add(geom,[shell,movable?linerD:linerF,edge],pivot);panel.name=movable?'Porta — acabamento externo':'Face — acabamento externo';
    const surface=geom.clone();surface.clearGroups();surface.setDrawRange(0,6);
    const glyphs=add(surface,faceMaterials[movable?'door':'fixed'],pivot,false);glyphs.receiveShadow=false;glyphs.position.copy(faceNormal).multiplyScalar(.0007);glyphs.renderOrder=3;glyphs.name='Símbolos originais — textura raster';
    // A fine rounded perimeter makes the thickness read at grazing angles.
    for(let i=0;i<4;i++)rod(p[i],p[(i+1)%4],.0105,edge,pivot);
    if(movable){
      doors.push(pivot);
      const position=v(0,bottom-shoulder+height*.208,A-C-A*.208).addScaledVector(faceNormal,.025);
      const handle=rounded([.36,.025,.026],position.toArray(),bronze,.008,pivot);
      handle.rotation.x=-Math.atan2(A,height);
      for(const x of [-.15,.15]){
        const h=position.clone();h.x=x;
        rod(h.clone().addScaledVector(faceNormal,-.015),h.clone().addScaledVector(faceNormal,.008),.009,bronze,pivot);
      }
    }
    return pivot;
  }
  createFace(0,true);createFace(Math.PI/2,true);createFace(Math.PI,false);createFace(-Math.PI/2,false);
  const crown=[v(-C,shoulder,C),v(C,shoulder,C),v(C,shoulder,-C),v(-C,shoulder,-C)];
  const apex=v(0,top,0);
  for(let i=0;i<4;i++){
    const a=crown[i],b=crown[(i+1)%4];
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([...a.toArray(),...b.toArray(),...apex.toArray()],3));g.computeVertexNormals();
    add(g,glass,group,false);
    rod(a,b,.010,edge);rod(a,apex,.010,edge);
  }
  const cap=add(new THREE.ConeGeometry(.046,.067,4),edge);cap.position.y=top+.02;cap.rotation.y=Math.PI/4;
  const crystal=add(new THREE.OctahedronGeometry(.055,0),physical({color:'#defff9',roughness:.02,transmission:.85,thickness:.04,ior:1.5,transparent:true,opacity:.7}),group,false);
  crystal.scale.y=1.5;crystal.position.y=2.00;
  rod(v(0,2.08,0),v(0,top-.01,0),.0025,bronze);

  // A continuous upholstered chaise, with the underside and pedestal grounded.
  const chair=new THREE.Group();chair.rotation.y=Math.PI/4;group.add(chair);
  chair.name='Poltrona em couro cognac';
  const personAnchor=new THREE.Group();personAnchor.rotation.y=chair.rotation.y;group.add(personAnchor);
  personAnchor.name='Pessoa — repouso';
  const seatOffset=v(0,0,.16).applyAxisAngle(v(0,1,0),chair.rotation.y);
  chair.position.copy(seatOffset);personAnchor.position.copy(seatOffset);
  const profile=new THREE.CatmullRomCurve3([v(0,1.285,-.84),v(0,1.19,-.76),v(0,.95,-.47),v(0,.66,-.13),v(0,.56,.17),v(0,.54,.43),v(0,.43,.79),v(0,.34,1.07)],false,'centripetal');
  const widths=[[0,.24],[.13,.325],[.4,.35],[.59,.35],[.83,.32],[1,.28]];
  const width=u=>{for(let i=1;i<widths.length;i++){if(u<=widths[i][0]){const [a,wa]=widths[i-1],[b,wb]=widths[i];return THREE.MathUtils.lerp(wa,wb,(u-a)/(b-a));}}return widths.at(-1)[1];};
  function chaiseSurface(offset,thick,extraWidth,mat){
    const pos=[],uv=[],idx=[],U=92,V=40;
    for(let i=0;i<=U;i++){
      const u=i/U,p=profile.getPointAt(u),t=profile.getTangentAt(u),normal=v(0,t.z,-t.y).normalize();
      for(let j=0;j<=V;j++){
        const theta=j/V*Math.PI*2,cs=Math.cos(theta),ss=Math.sin(theta);
        const x=(width(u)+extraWidth)*Math.sign(ss)*Math.pow(Math.abs(ss),.6);
        const d=thick*Math.sign(cs)*Math.pow(Math.abs(cs),.52);
        const q=p.clone().addScaledVector(normal,d+offset);q.x=x;
        pos.push(q.x,q.y,q.z);uv.push(j/V*2,u*4);
      }
    }
    for(let i=0;i<U;i++)for(let j=0;j<V;j++){const a=i*(V+1)+j,b=a+V+1;idx.push(a,b,a+1,b,b+1,a+1);}
    for(const end of [0,1]){
      const p=profile.getPointAt(end),t=profile.getTangentAt(end),n=v(0,t.z,-t.y).normalize();p.addScaledVector(n,offset);
      const center=pos.length/3;pos.push(p.x,p.y,p.z);uv.push(.5,end*4);
      const base=end?U*(V+1):0;
      for(let j=0;j<V;j++){
        if(end)idx.push(center,base+j+1,base+j);else idx.push(center,base+j,base+j+1);
      }
    }
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();
    return add(g,mat,chair);
  }
  chaiseSurface(-.075,.035,.018,leatherSides);
  chaiseSurface(0,.075,0,leather);
  const seatBase=rounded([.64,.13,.82],[0,.207,-.01],darkBase,.05,chair);
  rounded([.56,.014,.70],[0,.132,-.01],gasket,.025,chair);
  const support=add(new THREE.CylinderGeometry(.14,.19,.28,36),bronze,chair);support.position.set(0,.408,.03);support.rotation.x=-.1;
  rounded([.5,.12,.43],[0,.52,.03],leatherSides,.04,chair);
  for(const side of [-1,1]){
    const rail=rounded([.105,.14,.59],[side*.407,.77,.065],leather,.045,chair);rail.rotation.x=.06;
    rounded([.055,.19,.39],[side*.393,.62,.02],leatherSides,.018,chair);
    const seamPoints=[];
    for(let i=0;i<=55;i++){
      const u=.025+i/55*.95,p=profile.getPointAt(u),t=profile.getTangentAt(u),n=v(0,t.z,-t.y).normalize();
      p.addScaledVector(n,.069);p.x=side*(width(u)-.016);seamPoints.push(p);
    }
    tube(seamPoints,.0015,pipe,chair);
    const threadPts=seamPoints.map(p=>p.clone().add(v(-side*.008,.0015,0)));
    tube(threadPts,.0007,thread,chair);
    const armSeam=[];
    for(let i=0;i<20;i++)armSeam.push(v(side*.443,.829-i*.0004,-.182+i*.026));
    tube(armSeam,.00075,thread,chair);
  }
  for(const u of [.19,.47,.68,.88]){
    const p=profile.getPointAt(u),t=profile.getTangentAt(u),n=v(0,t.z,-t.y).normalize(),points=[];
    for(let i=0;i<=24;i++){
      const x=(i/24*2-1)*(width(u)-.02),q=p.clone().addScaledVector(n,.076-.008*(x/width(u))**2);q.x=x;points.push(q);
    }
    tube(points,.0009,thread,chair);
  }
  const head=rounded([.49,.13,.24],[0,1.265,-.775],leather,.055,chair);head.rotation.x=-.85;
  for(const side of [-1,1]){
    const pillow=rounded([.11,.15,.20],[side*.279,1.265,-.77],leatherSides,.045,chair);pillow.rotation.x=-.85;
  }

  const glowLights=[];
  for(const [x,z] of [[-.7,-.7],[.7,.7]]){
    const l=new THREE.PointLight('#7bd5dd',.32,3,2);l.position.set(x,.33,z);group.add(l);glowLights.push(l);
  }
  const crownLight=new THREE.PointLight('#ffddaf',.32,3.1,2);crownLight.position.set(0,1.87,0);group.add(crownLight);
  const finishColors={marfim:{shell:'#e8e0cd',edge:'#ded4bf',metal:.07,rough:.42},preto:{shell:'#15191b',edge:'#303537',metal:.44,rough:.31}};
  let currentFinish='marfim';
  const setFinish=name=>{
    currentFinish=name==='preto'?'preto':'marfim';const p=finishColors[currentFinish];
    shell.color.set(p.shell);shell.metalness=p.metal;shell.roughness=p.rough;edge.color.set(p.edge);
    for(const m of symbolMaterials)m.color.set(currentFinish==='marfim'?'#00bfff':'#38accc');
  };
  const setDoors=angle=>{
    const a=THREE.MathUtils.clamp(Number(angle)||0,0,THREE.MathUtils.degToRad(77));
    doors.forEach(d=>{d.rotation.x=-a;});
  };
  const setScene=color=>{
    for(const l of glowLights)l.color.set(color||'#7bd5dd');
    lightM.emissive.set(color||'#00c8ed');
  };
  setFinish(options.finish||'marfim');
  return {group,doors,chair,personAnchor,materials,symbolMaterials,ready,setFinish,setDoors,setScene,update(){},get finish(){return currentFinish;}};
}
