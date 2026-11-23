// Reusable 3D props + materials for episodes.
import { THREE, PAL, NOISE, clamp, lerp, rng } from '/engine/kit.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
export { RoundedBoxGeometry };
export const V = (x, y, z = 0) => new THREE.Vector3(x, y, z);
export const C = c => new THREE.Color(c);

export const std = (color, rough = 0.45, metal = 0, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...o });
export const glowMat = (color, k = 1.6, o = {}) => new THREE.MeshBasicMaterial({ color: C(color).multiplyScalar(k), toneMapped: false, transparent: true, ...o });
export const lineMat = (color, k = 1.6) => glowMat(color, k, { blending: THREE.AdditiveBlending, depthWrite: false });

// glassy / x-ray look: fresnel rim + faint body. additive for light-like things.
export function fresnelMat({ color = '#9fe8ff', body = 0.08, rim = 1.2, power = 2.5, additive = false, opacity = 1, side = THREE.FrontSide } = {}) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    uniforms: { uC: { value: C(color) }, uBody: { value: body }, uRim: { value: rim }, uPow: { value: power }, uOp: { value: opacity } },
    vertexShader: `varying vec3 vN; varying vec3 vP; void main(){ vec4 wp=modelMatrix*vec4(position,1.); vP=wp.xyz; vN=normalize(mat3(modelMatrix)*normal); gl_Position=projectionMatrix*viewMatrix*wp; }`,
    fragmentShader: `uniform vec3 uC; uniform float uBody,uRim,uPow,uOp; varying vec3 vN; varying vec3 vP;
      void main(){ vec3 V=normalize(cameraPosition-vP); vec3 N=normalize(vN); if(!gl_FrontFacing) N=-N; float fr=pow(1.-abs(dot(N,V)),uPow);
        vec3 H=normalize(normalize(vec3(.4,.8,.6))+V); float sp=pow(max(dot(N,H),0.),90.);
        gl_FragColor=vec4(uC*(uBody+fr*uRim)+vec3(sp*1.2), (uBody+fr*.9+sp)*uOp); }`,
  });
}

// procedural planets: type 'earth' | 'gas' | 'moon' | 'mars'
export function planet({ r = 1, type = 'earth', colA = '#d9b38c', colB = '#a8763e', seed = 1, seg = 96 } = {}) {
  const m = new THREE.ShaderMaterial({
    uniforms: { uL: { value: V(1, 0.6, 0.8).normalize() }, uA: { value: C(colA) }, uB: { value: C(colB) }, uT: { value: 0 }, uSeed: { value: seed },
      uType: { value: { earth: 0, gas: 1, moon: 2, mars: 3 }[type] }, uMark: { value: 0 } },
    vertexShader: `varying vec3 vN; varying vec3 vO; varying vec3 vP; void main(){ vO=position; vec4 wp=modelMatrix*vec4(position,1.); vP=wp.xyz; vN=normalize(mat3(modelMatrix)*normal); gl_Position=projectionMatrix*viewMatrix*wp; }`,
    fragmentShader: NOISE + `uniform vec3 uL,uA,uB; uniform float uT,uSeed,uType,uMark; varying vec3 vN; varying vec3 vO; varying vec3 vP;
      float fbm(vec3 p){ float a=.5,s=0.; for(int i=0;i<5;i++){ s+=a*snoise(p); p*=2.03; a*=.5; } return s; }
      void main(){ vec3 n=normalize(vO); vec3 col;
        if(uType<.5){ float h=fbm(n*1.6+uSeed); vec3 ocean=mix(vec3(.02,.12,.35),vec3(.05,.3,.6),smoothstep(-.4,.1,h));
          vec3 land=mix(vec3(.15,.42,.15),vec3(.55,.45,.25),smoothstep(.1,.5,h)); land=mix(land,vec3(.95),smoothstep(.75,.9,abs(n.y)));
          col=mix(ocean,land,smoothstep(.05,.09,h)); float cl=smoothstep(.15,.6,fbm(n*2.5+vec3(uT*.02,0.,0.)+9.)); col=mix(col,vec3(1.),cl*.75); }
        else if(uType<1.5){ float b=n.y*7.+fbm(n*vec3(2.,6.,2.)+uSeed)*1.1; col=mix(uA,uB,.5+.5*sin(b*3.)); col*=.85+.3*fbm(n*8.); }
        else { float h=fbm(n*3.+uSeed); col=mix(uA,uB,.5+.5*h); float cr=smoothstep(.55,.6,snoise(n*7.+uSeed)); col*=1.-cr*.35;
          col=mix(col,vec3(1.,.85,.3),uMark*smoothstep(.93,.97,dot(n,vec3(0.,0.,1.)))); }
        vec3 N=normalize(vN); float d=max(dot(N,uL),0.); float wrap=smoothstep(-.15,.6,dot(N,uL));
        vec3 V=normalize(cameraPosition-vP); float fr=pow(1.-max(dot(N,V),0.),3.);
        vec3 c=col*(.04+1.1*wrap); if(uType<.5) c+=vec3(.3,.6,1.)*fr*.6*wrap;
        gl_FragColor=vec4(c,1.); }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, seg, seg / 2), m); return mesh;
}
export function atmosphere(r, color = '#5fb6ff', k = 1.4) {
  return new THREE.Mesh(new THREE.SphereGeometry(r, 64, 32), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.BackSide, blending: THREE.AdditiveBlending,
    uniforms: { uC: { value: C(color) }, uK: { value: k } },
    vertexShader: `varying vec3 vN; varying vec3 vP; void main(){ vec4 wp=modelMatrix*vec4(position,1.); vP=wp.xyz; vN=normalize(mat3(modelMatrix)*normal); gl_Position=projectionMatrix*viewMatrix*wp; }`,
    fragmentShader: `uniform vec3 uC; uniform float uK; varying vec3 vN; varying vec3 vP; void main(){ vec3 V=normalize(cameraPosition-vP); float f=pow(clamp(1.-abs(dot(normalize(vN),V)),0.,1.),1.0); float a=pow(f,3.)*uK; gl_FragColor=vec4(uC*a,a); }` }));
}
export function ringDisk(rIn, rOut, colA = '#e8d3a8', colB = '#8a7454') {
  const g = new THREE.RingGeometry(rIn, rOut, 160, 4);
  return new THREE.Mesh(g, new THREE.ShaderMaterial({ transparent: true, side: THREE.DoubleSide, depthWrite: false,
    uniforms: { uA: { value: C(colA) }, uB: { value: C(colB) }, uIn: { value: rIn }, uOut: { value: rOut } },
    vertexShader: `varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `uniform vec3 uA,uB; uniform float uIn,uOut; varying vec3 vP; float h(float x){ return fract(sin(x*127.1)*43758.5); }
      void main(){ float r=(length(vP.xy)-uIn)/(uOut-uIn); float b=sin(r*90.)*.5+.5; float gap=smoothstep(.55,.57,r)*(1.-smoothstep(.6,.62,r));
        float a=(.45+.45*b)*(1.-gap)*smoothstep(0.,.05,r)*smoothstep(1.,.9,r); gl_FragColor=vec4(mix(uB,uA,b)*1.1,a*.9); }` }));
}
export function stars(n = 900, R = 60) {
  const r = rng(3), p = new Float32Array(n * 3), s = new Float32Array(n);
  for (let i = 0; i < n; i++) { const v = V(r() - .5, r() - .5, r() - .5).normalize().multiplyScalar(R * (0.7 + r() * 0.3)); p.set([v.x, v.y, v.z], i * 3); s[i] = r(); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('aS', new THREE.BufferAttribute(s, 1));
  const pts = new THREE.Points(g, new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uT: { value: 0 } },
    vertexShader: `attribute float aS; uniform float uT; varying float vA; void main(){ vec4 mv=modelViewMatrix*vec4(position,1.); gl_Position=projectionMatrix*mv; gl_PointSize=1.5+aS*3.; vA=.4+.6*(.5+.5*sin(uT*2.+aS*50.)); }`,
    fragmentShader: `varying float vA; void main(){ float d=length(gl_PointCoord-.5); gl_FragColor=vec4(vec3(.85,.9,1.)*smoothstep(.5,0.,d)*vA,1.); }` }));
  pts.frustumCulled = false; return pts;
}

// animated sine ribbon (sound / light waves). set uniforms each frame: uAmp, uK, uPhase, uOp
export function waveRibbon({ len = 6, width = 0.06, seg = 400, color = '#62f0ff', amp = 0.5, k = 6, glow = 1.8 } = {}) {
  const g = new THREE.PlaneGeometry(len, width, seg, 1);
  const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide,
    uniforms: { uAmp: { value: amp }, uK: { value: k }, uPhase: { value: 0 }, uC: { value: C(color).multiplyScalar(glow) }, uOp: { value: 1 }, uLen: { value: len }, uReveal: { value: 1 }, uEnvW: { value: 0 } },
    vertexShader: `uniform float uAmp,uK,uPhase,uLen,uEnvW; varying float vX; void main(){ vec3 p=position; vX=(p.x/uLen)+.5;
      float env=mix(1.,sin(3.14159*vX),uEnvW); p.y+=sin(p.x*uK+uPhase)*uAmp*env; gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.); }`,
    fragmentShader: `uniform vec3 uC; uniform float uOp,uReveal; varying float vX; void main(){ if(vX>uReveal) discard; float edge=smoothstep(0.,.03,vX)*smoothstep(1.,.97,vX); gl_FragColor=vec4(uC*uOp*edge,1.); }` });
  return new THREE.Mesh(g, m);
}

export function arrow(color = '#ffd84d', len = 1.5, r = 0.06) {
  const g = new THREE.Group(), mat = glowMat(color, 1.5);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, 16), mat); const head = new THREE.Mesh(new THREE.ConeGeometry(r * 2.6, r * 6, 20), mat);
  g.add(shaft, head); g.setLength = L => { shaft.scale.y = Math.max(0.001, L - r * 6); shaft.position.y = (L - r * 6) / 2; head.position.y = L - r * 3; };
  g.setLength(len); g.userData.mat = mat; return g;
}

// tube along a curve that can be revealed progressively (uP 0..1)
export function pathTube(curve, r = 0.03, color = '#ffd84d', k = 2) {
  const m = new THREE.ShaderMaterial({ transparent: true, toneMapped: false, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uP: { value: 1 }, uC: { value: C(color).multiplyScalar(k) }, uOp: { value: 1 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `uniform float uP,uOp; uniform vec3 uC; varying vec2 vUv; void main(){ if(vUv.x>uP) discard; float head=smoothstep(uP-.06,uP,vUv.x); gl_FragColor=vec4(uC*(.7+head*1.5)*uOp,1.); }` });
  return new THREE.Mesh(new THREE.TubeGeometry(curve, 200, r, 8, false), m);
}

// branching lightning; .reveal(p) 0..1, .mat
export function lightning(start, end, seed = 2, color = '#cfd8ff') {
  const r = rng(seed), g = new THREE.Group(), mat = glowMat(color, 3, { blending: THREE.AdditiveBlending, depthWrite: false });
  const segs = [];
  function bolt(a, b, depth, w, t0) {
    const pts = [a.clone()], n = 14;
    for (let i = 1; i < n; i++) { const p = a.clone().lerp(b, i / n); const d = a.distanceTo(b); p.x += (r() - .5) * d * 0.18; p.z += (r() - .5) * d * 0.1; pts.push(p); }
    pts.push(b.clone());
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i], p1 = pts[i + 1], len = p0.distanceTo(p1);
      const m = new THREE.Mesh(new THREE.CylinderGeometry(w, w, len, 6), mat); m.position.copy(p0).lerp(p1, .5); m.quaternion.setFromUnitVectors(V(0, 1, 0), p1.clone().sub(p0).normalize());
      m.userData.t = t0 + (i / (pts.length - 1)) * (1 - t0) * (depth ? 0.6 : 1); g.add(m); segs.push(m);
      if (depth < 2 && r() < 0.22) { const dir = p1.clone().sub(p0).normalize(); const e = p1.clone().add(V(dir.x + (r() - .5) * 2, dir.y * 0.8 - 0.2, (r() - .5)).multiplyScalar(a.distanceTo(b) * (0.18 - depth * 0.05)));
        bolt(p1, e, depth + 1, w * 0.5, m.userData.t); }
    }
  }
  bolt(start, end, 0, 0.045, 0);
  g.reveal = p => segs.forEach(s => s.visible = s.userData.t <= p);
  g.userData.mat = mat; return g;
}

// stylised water surface
export function waterPlane(size = 30, color = '#0b4f6c', seg = 160) {
  const m = new THREE.ShaderMaterial({ transparent: true, uniforms: { uT: { value: 0 }, uC: { value: C(color) }, uAmp: { value: 0.08 }, uOp: { value: 0.92 } },
    vertexShader: NOISE + `uniform float uT,uAmp; varying vec3 vP; varying float vH; void main(){ vec3 p=position; float h=snoise(vec3(p.xy*.35,uT*.35))*uAmp+sin(p.x*1.3+uT*1.5)*uAmp*.4; p.z+=h; vH=h;
      vec4 wp=modelMatrix*vec4(p,1.); vP=wp.xyz; gl_Position=projectionMatrix*viewMatrix*wp; }`,
    fragmentShader: `uniform vec3 uC; uniform float uOp; varying vec3 vP; varying float vH; void main(){ vec3 N=normalize(cross(dFdx(vP),dFdy(vP))); vec3 V=normalize(cameraPosition-vP);
      float fr=pow(1.-abs(dot(N,V)),3.); vec3 H=normalize(normalize(vec3(.3,1.,.4))+V); float sp=pow(max(dot(N,H),0.),120.);
      vec3 c=uC*(.6+vH*3.)+vec3(.5,.8,1.)*fr*.5+vec3(1.)*sp*1.2; gl_FragColor=vec4(c,uOp); }` });
  const w = new THREE.Mesh(new THREE.PlaneGeometry(size, size, seg, seg), m); w.rotation.x = -Math.PI / 2; return w;
}

// 3D progress ring (shader-revealed arc)
export function progressRing(R = 2, tube = 0.08, colA = '#62f0ff', colB = '#ffd84d') {
  const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, toneMapped: false, uniforms: { uP: { value: 0 }, uA: { value: C(colA) }, uB: { value: C(colB) } },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `uniform float uP; uniform vec3 uA,uB; varying vec2 vUv; void main(){ if(vUv.x>uP) discard; vec3 c=mix(uA,uB,vUv.x); gl_FragColor=vec4(c*(1.6+smoothstep(uP-.04,uP,vUv.x)*2.5),1.); }` });
  const m = new THREE.Mesh(new THREE.TorusGeometry(R, tube, 16, 256), mat); m.rotation.z = Math.PI / 2; m.scale.x = -1; m.userData.mat = mat; return m;
}

export const lathe = (pts, mat, seg = 64) => new THREE.Mesh(new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg), mat);

// water molecule (O red, 2 H white), oriented so +x is the "positive" side
export function h2o(scale = 1) {
  const g = new THREE.Group(); const O = new THREE.Mesh(new THREE.SphereGeometry(0.32 * scale, 32, 16), std('#ff4d5e', 0.3, 0.05, { emissive: '#3a0010' }));
  const hm = std('#f4f7ff', 0.3, 0.05, { emissive: '#202838' });
  [-1, 1].forEach(s => { const H = new THREE.Mesh(new THREE.SphereGeometry(0.2 * scale, 24, 12), hm); const a = (104.5 / 2) * Math.PI / 180; H.position.set(Math.cos(a) * 0.38 * scale, s * Math.sin(a) * 0.38 * scale, 0); g.add(H); });
  g.add(O); return g;
}

// soft radial floor that fades into the background (grounds objects without a hard horizon)
export function floor(color = '#2a1b2e', R = 9, glossy = 0.5) {
  const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uC: { value: C(color) }, uG: { value: glossy } },
    vertexShader: `varying vec2 vUv; varying vec3 vP; void main(){ vUv=uv; vec4 wp=modelMatrix*vec4(position,1.); vP=wp.xyz; gl_Position=projectionMatrix*viewMatrix*wp; }`,
    fragmentShader: `uniform vec3 uC; uniform float uG; varying vec2 vUv; varying vec3 vP; void main(){ float r=length(vUv-.5)*2.; float a=smoothstep(1.,.15,r);
      vec3 V=normalize(cameraPosition-vP); float fr=pow(1.-abs(V.y),4.)*uG; vec3 c=uC*(1.-r*.5)+vec3(.9,.8,1.)*fr*.25; gl_FragColor=vec4(c,a); }` });
  const f = new THREE.Mesh(new THREE.CircleGeometry(R, 96), m); f.rotation.x = -Math.PI / 2; f.renderOrder = -10; return f;
}
