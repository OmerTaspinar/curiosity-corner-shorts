// Curiosity Corner — 3D motion-graphics kit (three.js).
// Everything is a pure function of time t so any frame can be rendered independently.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export { THREE };
export const W = 1080, H = 1920, FPS = 30;

// ---------- palette ----------
export const PAL = {
  bgTop: new THREE.Color('#1b1145'), bgBot: new THREE.Color('#05040f'), glow: new THREE.Color('#ff5a7a'),
  organA: new THREE.Color('#f2334f'), organB: new THREE.Color('#ff8a4c'), rim: new THREE.Color('#62f0ff'),
  accent: '#ffd84d', accentC: new THREE.Color('#ffd84d'), cyan: new THREE.Color('#62f0ff'), white: new THREE.Color('#ffffff'),
};

// ---------- math helpers ----------
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const remap = (x, a, b) => clamp((x - a) / (b - a));
export const ease = {
  outCubic: t => 1 - Math.pow(1 - clamp(t), 3),
  inOutCubic: t => (t = clamp(t), t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outBack: (t, s = 1.7) => (t = clamp(t) - 1, 1 + (s + 1) * t * t * t + s * t * t),
  outExpo: t => (t = clamp(t), t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  inOutSine: t => -(Math.cos(Math.PI * clamp(t)) - 1) / 2,
};
// damped spring 0 -> 1 (overshoots), k = stiffness
export const spring = (t, k = 14, damp = 0.32) => t <= 0 ? 0 : 1 - Math.exp(-damp * k * t) * Math.cos(k * t);
export function rng(seed = 1) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

// ---------- GLSL noise (Ashima simplex 3D) ----------
export const NOISE = /* glsl */`
vec3 mod289(vec3 x){return x-floor(x*(1./289.))*289.;}vec4 mod289(vec4 x){return x-floor(x*(1./289.))*289.;}
vec4 permute(vec4 x){return mod289(((x*34.)+1.)*x);}vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-.85373472095314*r;}
float snoise(vec3 v){const vec2 C=vec2(1./6.,1./3.);const vec4 D=vec4(0.,.5,1.,2.);
vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.-g;
vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;
i=mod289(i);vec4 p=permute(permute(permute(i.z+vec4(0.,i1.z,i2.z,1.))+i.y+vec4(0.,i1.y,i2.y,1.))+i.x+vec4(0.,i1.x,i2.x,1.));
float n_=.142857142857;vec3 ns=n_*D.wyz-D.xzx;vec4 j=p-49.*floor(p*ns.z*ns.z);vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.*x_);
vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.-abs(x)-abs(y);vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);
vec4 s0=floor(b0)*2.+1.;vec4 s1=floor(b1)*2.+1.;vec4 sh=-step(h,vec4(0.));vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.);m=m*m;
return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));}
`;

// ---------- stage: renderer, 3D scene, overlay (text) scene, post FX ----------
export function createStage(canvasParent = document.body) {
  const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true, alpha: false });
  renderer.setPixelRatio(1); renderer.setSize(W, H);
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.95;
  canvasParent.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, W / H, 0.1, 200);
  camera.position.set(0, 0, 11);
  scene.add(camera);

  // background: gradient + warm radial glow, attached to camera so it always fills the frame
  const bgMat = new THREE.ShaderMaterial({
    depthWrite: false, depthTest: false,
    uniforms: { uTop: { value: PAL.bgTop }, uBot: { value: PAL.bgBot }, uGlow: { value: PAL.glow.clone() },
      uGlowPos: { value: new THREE.Vector2(0.5, 0.55) }, uGlowAmt: { value: 0.35 }, uTime: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.999,1.); }`,
    fragmentShader: NOISE + `varying vec2 vUv; uniform vec3 uTop,uBot,uGlow; uniform vec2 uGlowPos; uniform float uGlowAmt,uTime;
      void main(){ vec3 c=mix(uBot,uTop,smoothstep(0.,1.,vUv.y));
        vec2 d=(vUv-uGlowPos)*vec2(1.,1.777); float g=exp(-dot(d,d)*3.5);
        float n=snoise(vec3(vUv*2.2,uTime*.05))*.5+.5;
        c+=uGlow*g*uGlowAmt*(0.75+0.5*n);
        c+=vec3(.25,.35,1.)*.05*smoothstep(.0,1.,n*(1.-vUv.y));
        gl_FragColor=vec4(c,1.); }`,
  });
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), bgMat);
  bg.frustumCulled = false; bg.renderOrder = -1000; scene.add(bg);

  // floating bokeh dust
  const dust = makeDust(260);
  scene.add(dust);

  // lights for standard materials (custom shaders light themselves)
  const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(3, 4, 5); scene.add(key);
  scene.add(new THREE.AmbientLight(0x6a5acd, 0.6));
  const rimL = new THREE.DirectionalLight(0x62f0ff, 2.0); rimL.position.set(-4, 2, -4); scene.add(rimL);

  // overlay scene in pixel units (origin = center, +y up)
  const overlay = new THREE.Scene();
  const ocam = new THREE.OrthographicCamera(-W / 2, W / 2, H / 2, -H / 2, -1000, 1000);

  const composer = new EffectComposer(renderer);
  composer.setPixelRatio(1); composer.setSize(W, H);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(W / 2, H / 2), 0.42, 0.45, 0.82);
  composer.addPass(bloom);
  const ov = new RenderPass(overlay, ocam); ov.clear = false; ov.clearDepth = true;
  composer.addPass(ov);
  const fx = new ShaderPass(FinalShader);
  composer.addPass(fx);
  composer.addPass(new OutputPass());

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;
  const _pv = new THREE.Vector3();
  const stage = {
    renderer, scene, camera, overlay, ocam, composer, bloom, fx, bg, bgMat, dust,
    // world position -> overlay pixel coords (origin centre, +y up)
    project(v) { camera.updateMatrixWorld(); _pv.copy(v).project(camera); return { x: _pv.x * W / 2, y: _pv.y * H / 2, behind: _pv.z > 1 }; },
    setTheme(name) { const t = THEMES[name] || THEMES.default; bgMat.uniforms.uTop.value.copy(t.top); bgMat.uniforms.uBot.value.copy(t.bot);
      bgMat.uniforms.uGlow.value.copy(t.glow); dust.material.uniforms.uOpacity.value = t.dust ?? 1; },
    shake: 0, // camera shake amount set by scenes per frame
    render(t) {
      bgMat.uniforms.uTime.value = t;
      dust.material.uniforms.uTime.value = t;
      fx.uniforms.uTime.value = t;
      if (stage.shake > 0) {
        const s = stage.shake;
        camera.position.x += (Math.sin(t * 61.3) + Math.sin(t * 37.1)) * 0.02 * s;
        camera.position.y += (Math.sin(t * 53.7) + Math.cos(t * 41.9)) * 0.02 * s;
      }
      composer.render();
    },
  };
  return stage;
}

export const THEMES = {
  default: { top: new THREE.Color('#1b1145'), bot: new THREE.Color('#05040f'), glow: new THREE.Color('#ff5a7a') },
  space:   { top: new THREE.Color('#050818'), bot: new THREE.Color('#010104'), glow: new THREE.Color('#1c2f7a'), dust: 1.2 },
  sky:     { top: new THREE.Color('#0d2a6b'), bot: new THREE.Color('#05081c'), glow: new THREE.Color('#4fb3ff') },
  ocean:   { top: new THREE.Color('#06354a'), bot: new THREE.Color('#020a12'), glow: new THREE.Color('#2fd6c8') },
  fire:    { top: new THREE.Color('#3a0d12'), bot: new THREE.Color('#0a0305'), glow: new THREE.Color('#ff7a2a') },
  steel:   { top: new THREE.Color('#1a2433'), bot: new THREE.Color('#05070b'), glow: new THREE.Color('#7fb4ff') },
  ice:     { top: new THREE.Color('#0f3350'), bot: new THREE.Color('#030a14'), glow: new THREE.Color('#9fe8ff') },
  storm:   { top: new THREE.Color('#1a1638'), bot: new THREE.Color('#04030a'), glow: new THREE.Color('#9b8cff') },
  city:    { top: new THREE.Color('#2a1a3d'), bot: new THREE.Color('#07050d'), glow: new THREE.Color('#ffb347') },
};

// final pass: transition zoom-blur + chromatic aberration + flash, vignette, grain
export const FinalShader = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uTrans: { value: 0 }, uFlash: { value: 0 }, uAberr: { value: 0.0015 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime,uTrans,uFlash,uAberr; varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
    void main(){
      vec2 c=vec2(.5); vec2 d=vUv-c; float ab=uAberr+uTrans*.02;
      vec3 col=vec3(0.);
      if(uTrans>0.002){ float tot=0.;
        for(int i=0;i<10;i++){ float k=float(i)/9.; float s=1.-uTrans*.18*k; float w=1.-k*.5;
          vec2 uv=c+d*s;
          col.r+=texture2D(tDiffuse,c+(uv-c)*(1.+ab)).r*w; col.g+=texture2D(tDiffuse,uv).g*w; col.b+=texture2D(tDiffuse,c+(uv-c)*(1.-ab)).b*w; tot+=w; }
        col/=tot;
      } else {
        col=vec3(texture2D(tDiffuse,c+d*(1.+ab)).r, texture2D(tDiffuse,vUv).g, texture2D(tDiffuse,c+d*(1.-ab)).b);
      }
      col+=uFlash;
      float v=smoothstep(1.05,.35,length(d*vec2(1.,.75))); col*=mix(.55,1.,v);
      col+=(hash(vUv*vec2(1080.,1920.)+fract(uTime*7.))-.5)*.03;
      gl_FragColor=vec4(col,1.);
    }`,
};

function makeDust(n) {
  const r = rng(7), pos = new Float32Array(n * 3), seed = new Float32Array(n);
  for (let i = 0; i < n; i++) { pos[i * 3] = (r() - .5) * 16; pos[i * 3 + 1] = (r() - .5) * 26; pos[i * 3 + 2] = -6 - r() * 14 + (r() < .15 ? 12 : 0); seed[i] = r(); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uOpacity: { value: 1 } },
    vertexShader: `attribute float aSeed; uniform float uTime; varying float vA;
      void main(){ vec3 p=position; p.y+=mod(uTime*(.15+aSeed*.25)+aSeed*30.,26.)-13.-p.y*0.; p.y=mod(position.y+uTime*(.12+aSeed*.2)+13.,26.)-13.;
        p.x+=sin(uTime*.3+aSeed*20.)*.3; vec4 mv=modelViewMatrix*vec4(p,1.); gl_Position=projectionMatrix*mv;
        float near=smoothstep(-3.,4.,p.z); gl_PointSize=(6.+aSeed*16.+near*60.)*(10./-mv.z); vA=(.25+.5*aSeed)*(1.-near*.6)*(0.6+0.4*sin(uTime*1.5+aSeed*40.)); }`,
    fragmentShader: `varying float vA; uniform float uOpacity; void main(){ float d=length(gl_PointCoord-.5); float a=smoothstep(.5,.0,d);
      gl_FragColor=vec4(vec3(1.,.75,.85)*a*vA*uOpacity*.6,1.); }`,
  });
  const p = new THREE.Points(g, m); p.frustumCulled = false; return p;
}

// ---------- organic tube geometry (per-vertex aU = 0..1 along length) ----------
export function tubeGeometry(curve, radiusFn, tubular = 400, radial = 48) {
  const frames = curve.computeFrenetFrames(tubular, false);
  const pos = [], nor = [], us = [], vs = [], idx = [];
  for (let i = 0; i <= tubular; i++) {
    const u = i / tubular, P = curve.getPointAt(u), N = frames.normals[i], B = frames.binormals[i];
    const r = radiusFn(u);
    for (let j = 0; j <= radial; j++) {
      const v = j / radial * Math.PI * 2, s = Math.sin(v), c = -Math.cos(v);
      const nx = c * N.x + s * B.x, ny = c * N.y + s * B.y, nz = c * N.z + s * B.z;
      pos.push(P.x + r * nx, P.y + r * ny, P.z + r * nz); nor.push(nx, ny, nz); us.push(u); vs.push(j / radial);
    }
  }
  for (let i = 0; i < tubular; i++) for (let j = 0; j < radial; j++) {
    const a = (radial + 1) * i + j, b = (radial + 1) * (i + 1) + j;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setIndex(idx);
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('aU', new THREE.Float32BufferAttribute(us, 1));
  g.setAttribute('aV', new THREE.Float32BufferAttribute(vs, 1));
  return g;
}
// rounded end caps so tubes do not look hollow
export function capSphere(curve, u, r, mat) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 16), mat); m.position.copy(curve.getPointAt(u)); return m;
}

// ---------- organic material: wrap lighting, fresnel rim, rugae texture, travelling peristalsis wave ----------
export function organMaterial(o = {}) {
  return new THREE.ShaderMaterial({
    transparent: true, side: o.side ?? THREE.FrontSide, depthWrite: o.depthWrite ?? true,
    uniforms: {
      uTime: { value: 0 }, uColA: { value: (o.colA || PAL.organA).clone() }, uColB: { value: (o.colB || PAL.organB).clone() },
      uRim: { value: (o.rim || PAL.rim).clone() }, uRimAmt: { value: (o.rimAmt ?? 1.2) * 0.55 }, uOpacity: { value: o.opacity ?? 1 },
      uWavePos: { value: -1 }, uWaveAmp: { value: 0 }, uWaveW: { value: o.waveW ?? 0.04 }, uPulse: { value: 0 },
      uNoise: { value: o.noise ?? 0.035 }, uGlow: { value: 0 }, uWaveGlow: { value: o.waveGlow ?? 1.0 }, uXray: { value: o.xray ?? 0 },
    },
    vertexShader: NOISE + /* glsl */`
      attribute float aU; attribute float aV;
      uniform float uTime,uWavePos,uWaveAmp,uWaveW,uPulse,uNoise;
      varying vec3 vN; varying vec3 vP; varying vec3 vObj; varying float vU; varying float vWave;
      void main(){
        float x=(aU-uWavePos)/uWaveW;
        float squeeze=-exp(-x*x);                 // contraction ring
        float bulge=.55*exp(-pow((aU-uWavePos-uWaveW*1.8)/(uWaveW*1.4),2.)); // contents pushed ahead
        float w=uWaveAmp*(squeeze+bulge);
        float n=snoise(position*1.6+vec3(0.,uTime*.35,0.))*uNoise;
        vec3 p=position+normal*(n+uPulse*.07+w*0.35);
        vWave=exp(-x*x)*uWaveAmp; vU=aU; vObj=position;
        vec4 wp=modelMatrix*vec4(p,1.); vP=wp.xyz; vN=normalize(mat3(modelMatrix)*normal);
        gl_Position=projectionMatrix*viewMatrix*wp;
      }`,
    fragmentShader: NOISE + /* glsl */`
      uniform vec3 uColA,uColB,uRim; uniform float uRimAmt,uOpacity,uTime,uGlow,uWaveGlow,uXray;
      varying vec3 vN; varying vec3 vP; varying vec3 vObj; varying float vU; varying float vWave;
      void main(){
        vec3 N=normalize(vN); if(!gl_FrontFacing) N=-N;
        vec3 V=normalize(cameraPosition-vP);
        vec3 L=normalize(vec3(.5,.8,.6));
        float rug=snoise(vObj*vec3(2.,9.,2.))*.5+.5;        // stretched folds (rugae)
        float fine=snoise(vObj*18.)*.5+.5;
        vec3 base=mix(uColA,uColB,clamp(vU*1.2+rug*.25-.1,0.,1.));
        base*=.82+.25*rug+.08*fine;
        float wrap=clamp((dot(N,L)+.45)/1.45,0.,1.);
        vec3 sss=vec3(1.,.25,.2)*pow(1.-abs(dot(N,V)),2.)*.35;
        vec3 H=normalize(L+V); float spec=pow(max(dot(N,H),0.),70.)*.7;
        float fr=pow(1.-max(dot(N,V),0.),3.5);
        float occ=.55+.45*smoothstep(-.2,.8,dot(N,vec3(0.,1.,.3)));
        vec3 col=base*(.1+1.05*wrap)*occ+sss+spec+uRim*fr*uRimAmt;
        col+=vec3(1.,.85,.5)*vWave*uWaveGlow*.9;            // glowing contraction ring
        col+=base*uGlow;
        float a=uOpacity*mix(1.,.08+fr*.85,uXray);
        gl_FragColor=vec4(col,a);
      }`,
  });
}

// glassy bubble material (instanced)
export function bubbleMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uOpacity: { value: 1 } },
    vertexShader: `varying vec3 vN; varying vec3 vP; void main(){ vec4 wp=modelMatrix*instanceMatrix*vec4(position,1.); vP=wp.xyz;
      vN=normalize(mat3(modelMatrix)*mat3(instanceMatrix)*normal); gl_Position=projectionMatrix*viewMatrix*wp; }`,
    fragmentShader: `uniform float uOpacity; varying vec3 vN; varying vec3 vP; void main(){ vec3 V=normalize(cameraPosition-vP);
      float fr=pow(1.-abs(dot(normalize(vN),V)),2.2); vec3 H=normalize(normalize(vec3(.4,.8,.6))+V);
      float sp=pow(max(dot(normalize(vN),H),0.),80.);
      vec3 c=vec3(.55,.95,1.)*fr*1.1+vec3(1.)*sp*1.5+vec3(.1,.2,.3)*.15; gl_FragColor=vec4(c*uOpacity,1.); }`,
  });
}

// ---------- text as textures ----------
const FONT = '"Montserrat"';
export async function loadFonts() {
  const f = new FontFace('Montserrat', 'url(/engine/fonts/Montserrat.ttf)', { weight: '100 900' });
  await f.load(); document.fonts.add(f);
  await document.fonts.load(`900 100px ${FONT}`); await document.fonts.load(`800 100px ${FONT}`);
}
// returns {tex, w, h} for a word drawn with stroke + soft shadow
export function wordTexture(text, { size = 120, weight = 900, fill = '#ffffff', stroke = '#000000', strokeW = 0, shadow = 0.5, glow = null, italic = false, track = 0 } = {}) {
  const c = document.createElement('canvas'), x = c.getContext('2d');
  const font = `${italic ? 'italic ' : ''}${weight} ${size}px ${FONT}`;
  x.font = font; x.letterSpacing = `${track}px`;
  const m = x.measureText(text), pad = Math.ceil(size * 0.35 + strokeW);
  c.width = Math.ceil(m.width + pad * 2); c.height = Math.ceil(size * 1.25 + pad * 2);
  x.font = font; x.letterSpacing = `${track}px`; x.textBaseline = 'middle'; x.textAlign = 'center'; x.lineJoin = 'round';
  const cx = c.width / 2, cy = c.height / 2 + size * 0.04;
  if (glow) { x.shadowColor = glow; x.shadowBlur = size * 0.35; x.fillStyle = glow; x.fillText(text, cx, cy); x.shadowBlur = 0; }
  if (shadow) { x.shadowColor = `rgba(0,0,0,${shadow})`; x.shadowBlur = size * 0.18; x.shadowOffsetY = size * 0.06; }
  if (strokeW) { x.strokeStyle = stroke; x.lineWidth = strokeW * 2; x.strokeText(text, cx, cy); }
  x.shadowColor = 'transparent'; x.fillStyle = fill; x.fillText(text, cx, cy);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  return { tex, w: c.width, h: c.height, textW: m.width };
}
export function textMesh(text, opts) {
  const t = wordTexture(text, opts);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(t.w, t.h), new THREE.MeshBasicMaterial({ map: t.tex, transparent: true, depthTest: false, depthWrite: false, toneMapped: false }));
  m.userData.textW = t.textW; return m;
}

// Kinetic headline: lines of words, *word* = accent colour. Words spring in with stagger.
export class Kicker {
  constructor(overlay, text, { y = 560, size = 150, gap = 0.07, lineH = 1.02, accent = PAL.accent, sub = null, subSize = 62, slam = false } = {}) {
    this.slam = slam; if (slam) gap = 0.13;
    this.group = new THREE.Group(); this.group.position.y = y; overlay.add(this.group); this.words = [];
    const lines = text.split('\n'); let k = 0;
    lines.forEach((ln, li) => {
      const ws = ln.split(' ').filter(Boolean);
      const meshes = ws.map(w => { const acc = w.startsWith('*'); const clean = w.replace(/\*/g, '');
        return textMesh(clean, { size, fill: acc ? accent : '#ffffff', strokeW: size * 0.07, stroke: '#140a2a', shadow: .7, glow: acc ? 'rgba(255,190,40,.55)' : null }); });
      const space = size * 0.34, total = meshes.reduce((s, m) => s + m.userData.textW, 0) + space * (meshes.length - 1);
      let x = -total / 2;
      meshes.forEach(m => { m.position.set(x + m.userData.textW / 2, -li * size * lineH, 0); x += m.userData.textW + space;
        m.userData.delay = k++ * gap; m.userData.base = m.position.clone(); this.group.add(m); this.words.push(m); });
    });
    if (sub) { const s = textMesh(sub, { size: subSize, weight: 800, fill: '#d8f6ff', strokeW: subSize * 0.1, stroke: '#140a2a', shadow: .8, track: 6 });
      s.position.set(0, -lines.length * size * lineH + size * 0.25, 0); s.userData.delay = k * gap + 0.15; s.userData.base = s.position.clone();
      this.group.add(s); this.words.push(s); }
    // shrink to fit the frame width
    let maxW = 0; this.group.children.forEach(m => { maxW = Math.max(maxW, Math.abs(m.position.x) * 2 + m.userData.textW); });
    this.fit = Math.min(1, 940 / maxW); this.group.scale.setScalar(this.fit);
    this.group.visible = false;
  }
  // lt: local time since kicker start; out: seconds until it must be gone (fade in last 0.25s)
  update(lt, out = 99) {
    this.group.visible = lt > 0 && out > 0;
    const fadeOut = clamp(out / 0.25);
    if (this.slam) {
      for (const m of this.words) {
        const t = lt - m.userData.delay, k = ease.outExpo(t / 0.17);
        const bounce = t > 0.17 ? 1 + 0.06 * Math.exp(-(t - 0.17) * 14) * Math.cos((t - 0.17) * 40) : 1;
        m.scale.setScalar(t <= 0 ? 0.0001 : (1 + 2.4 * (1 - k)) * bounce * (1 + 0.04 * (1 - fadeOut)));
        m.position.y = m.userData.base.y + (1 - fadeOut) * 30;
        m.material.opacity = clamp(t / 0.05) * fadeOut; m.rotation.z = (1 - k) * -0.08;
      }
      return;
    }
    for (const m of this.words) {
      const t = lt - m.userData.delay, s = spring(t, 15, 0.55);
      m.scale.setScalar(Math.max(0.0001, s) * (1 + 0.04 * (1 - fadeOut)));
      m.position.y = m.userData.base.y - (1 - ease.outCubic(t / 0.35)) * 60 + (1 - fadeOut) * 30;
      m.material.opacity = clamp(t / 0.12) * fadeOut;
      m.rotation.z = (1 - ease.outCubic(t / 0.4)) * 0.12;
    }
  }
}

// Captions: chunks of up to 3 words (break on punctuation); active word turns accent + pops.
export class Captions {
  constructor(overlay, words, { y = -330, size = 76, maxWords = 3 } = {}) {
    this.group = new THREE.Group(); this.group.position.y = y; overlay.add(this.group);
    this.chunks = []; let cur = [];
    const flush = () => { if (cur.length) this.chunks.push(cur); cur = []; };
    words.forEach(w => { cur.push(w); if (cur.length >= maxWords || /[,.;:!?…]$/.test(w.w)) flush(); }); flush();
    for (const ch of this.chunks) {
      const g = new THREE.Group(); g.visible = false; this.group.add(g);
      const meshes = ch.map(w => textMesh(w.w.replace(/\.\.\.$/, '…').toUpperCase(), { size, weight: 900, fill: '#ffffff', strokeW: size * 0.11, stroke: '#0a0614', shadow: .8 }));
      const space = size * 0.55, total = meshes.reduce((s, m) => s + m.userData.textW, 0) + space * (meshes.length - 1);
      let x = -total / 2; const maxW = 900, sc = total > maxW ? maxW / total : 1;
      meshes.forEach((m, i) => { m.position.x = (x + m.userData.textW / 2) * sc; x += m.userData.textW + space; m.userData.w = ch[i]; m.userData.sc = sc; g.add(m); });
      g.userData = { s: ch[0].s, e: ch[ch.length - 1].e, meshes };
    }
  }
  update(t) {
    this.chunks.forEach((ch, i) => {
      const g = this.group.children[i], d = g.userData;
      const next = this.group.children[i + 1]?.userData.s ?? d.e + 0.6;
      const end = Math.min(next - 0.05, d.e + 0.6);
      g.visible = t >= d.s - 0.05 && t < end;
      if (!g.visible) return;
      const lt = t - (d.s - 0.05), p = spring(lt, 18, 0.35);
      g.scale.setScalar(0.85 + 0.15 * p); g.position.y = (1 - ease.outCubic(lt / 0.2)) * -25;
      for (const m of d.meshes) {
        const w = m.userData.w, active = t >= w.s && t < w.e;
        const pop = active ? 1 + 0.07 * Math.exp(-(t - w.s) * 12) + 0.02 : 1;
        m.scale.setScalar(pop * m.userData.sc);
        m.material.color.set(active ? PAL.accent : '#ffffff');
        m.material.opacity = clamp(lt / 0.08);
      }
    });
  }
}

// expanding sound ring (thin torus), call update with age in seconds
export function soundRing(color = PAL.cyan) {
  const m = new THREE.Mesh(new THREE.TorusGeometry(1, 0.025, 8, 128),
    new THREE.MeshBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  m.visible = false;
  m.update = (age, life = 1.2, r0 = 1, r1 = 3.2) => {
    const k = age / life; m.visible = k > 0 && k < 1; if (!m.visible) return;
    const r = lerp(r0, r1, ease.outCubic(k)); m.scale.set(r, r, r); m.material.opacity = (1 - k) * (1 - k) * 1.6;
    m.material.color.copy(color).multiplyScalar(2.2);
  };
  return m;
}

// low-poly food crumbs, instanced
export function crumbs(n, seed = 3) {
  const r = rng(seed);
  const geo = new THREE.IcosahedronGeometry(1, 0);
  const mat = new THREE.MeshStandardMaterial({ roughness: .55, metalness: 0, flatShading: true, vertexColors: false });
  const mesh = new THREE.InstancedMesh(geo, mat, n);
  const cols = ['#ffcf5a', '#9be15d', '#ff9f43', '#f8f3e6', '#c56cf0'].map(c => new THREE.Color(c));
  mesh.userData.items = [...Array(n)].map((_, i) => {
    mesh.setColorAt(i, cols[i % cols.length]);
    return { u: r(), off: [r() - .5, r() - .5, r() - .5], s: 0.05 + r() * 0.06, rot: [r() * 6, r() * 6, r() * 6], spin: r() * 2 + .5, seed: r() };
  });
  mesh.instanceColor.needsUpdate = true;
  return mesh;
}
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3();
export function setInstance(mesh, i, pos, scale, rotArr) {
  _e.set(rotArr[0], rotArr[1], rotArr[2]); _q.setFromEuler(_e);
  if (typeof scale === 'number') _s.setScalar(scale); else _s.copy(scale);
  _m.compose(_v.copy(pos), _q, _s); mesh.setMatrixAt(i, _m);
}

// text whose content changes over time (counters). Canvas redrawn only when the string changes.
export class DynText {
  constructor(parent, { size = 200, weight = 900, fill = '#ffffff', strokeW = 0, stroke = '#120a26', glow = null, maxChars = 14 } = {}) {
    this.o = { size, weight, fill, strokeW, stroke, glow };
    this.c = document.createElement('canvas'); this.c.width = Math.ceil(size * 0.75 * maxChars + size); this.c.height = Math.ceil(size * 1.7);
    this.tex = new THREE.CanvasTexture(this.c); this.tex.colorSpace = THREE.SRGBColorSpace;
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(this.c.width, this.c.height), new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, depthTest: false, depthWrite: false, toneMapped: false }));
    parent.add(this.mesh); this.str = null;
  }
  set(str) {
    if (str === this.str) return; this.str = str; const x = this.c.getContext('2d'), o = this.o;
    x.clearRect(0, 0, this.c.width, this.c.height); x.font = `${o.weight} ${o.size}px "Montserrat"`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineJoin = 'round';
    const cx = this.c.width / 2, cy = this.c.height / 2 + o.size * 0.04;
    if (o.glow) { x.shadowColor = o.glow; x.shadowBlur = o.size * 0.3; x.fillStyle = o.glow; x.fillText(str, cx, cy); x.shadowBlur = 0; }
    x.shadowColor = 'rgba(0,0,0,.7)'; x.shadowBlur = o.size * 0.15; x.shadowOffsetY = o.size * 0.05;
    if (o.strokeW) { x.strokeStyle = o.stroke; x.lineWidth = o.strokeW * 2; x.strokeText(str, cx, cy); }
    x.shadowColor = 'transparent'; x.fillStyle = o.fill; x.fillText(str, cx, cy); this.textW = x.measureText(str).width; this.tex.needsUpdate = true;
  }
}
// small annotation pinned to a 3D point (drawn crisp in the overlay)
export class Label {
  constructor(overlay, text, { size = 46, fill = '#ffffff', accent = false, line = true } = {}) {
    this.g = new THREE.Group(); overlay.add(this.g);
    this.t = textMesh(text, { size, weight: 800, fill: accent ? PAL.accent : fill, strokeW: size * 0.12, stroke: '#0b0618', shadow: .8 }); this.g.add(this.t);
    this.g.visible = false;
  }
  // pos: world Vector3; dy: pixel offset above the point; a: opacity 0..1
  update(stage, pos, a = 1, dx = 0, dy = 60) {
    const p = stage.project(pos); this.g.visible = a > 0.01 && !p.behind; if (!this.g.visible) return;
    this.g.position.set(p.x + dx, p.y + dy, 0); this.t.material.opacity = a; this.g.scale.setScalar(0.85 + 0.15 * ease.outBack(a));
  }
}
