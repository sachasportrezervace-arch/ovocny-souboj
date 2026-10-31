// Ovocný souboj – 3D vrstva (three.js r170, vendor/three.module.min.js). Low-poly ovoce s toon stínováním,
// rozpůlení na dvě poloviny s vnitřkem, kapky šťávy v jednom Points (1 draw call), led a bomby.
import * as THREE from "three";

const HALF_H = 10;                       // půlka výšky hrací plochy v jednotkách světa
const FOV = 35;
const C = hex => new THREE.Color(hex);

// barvy slupek, dužiny a šťávy podle druhu
const LOOK = {
  meloun: { skin: ["#2F7D3A", "#1D5428"], flesh: "#E8414B", juice: "#F0505A", scale: [1.32, 1.06, 1.06], r: 1.18 },
  pomeranc: { skin: ["#FF9419", "#F07E0C"], flesh: "#FFAE3B", juice: "#FFA02B", scale: [1, 1, 1], r: 0.98, leaf: true },
  svestka: { skin: ["#3E2E7A", "#5B44A8"], flesh: "#F2B13C", juice: "#9B5BD4", scale: [0.86, 1, 0.86], r: 0.84, stem: true },
  citron: { skin: ["#F7D531", "#E9C21A"], flesh: "#FBEB8A", juice: "#FFE45C", scale: [1.26, 0.9, 0.9], r: 0.92 },
  jablko: { skin: ["#D9262E", "#F05A3A"], flesh: "#F7EDC7", juice: "#FFF1B8", scale: [1, 0.93, 1], r: 0.96, stem: true, leaf: true },
  kiwi: { skin: ["#A67B45", "#7C5630"], flesh: "#8FC63F", juice: "#A6D654", scale: [1.12, 0.88, 0.88], r: 0.9 },
  karambola: { skin: ["#FFC81F", "#F2B705"], flesh: "#FFE47A", juice: "#FFD84A", scale: [1, 1, 1], r: 1.05 },
  zlate: { skin: ["#FFD23F", "#E59E0C"], flesh: "#FFE9A0", juice: "#FFD84A", scale: [1, 0.94, 1], r: 1.0, stem: true, leaf: true },   // zlaté jablko (modifikátor a finále)
};

function toonRamp() {
  const t = new THREE.DataTexture(new Uint8Array([96, 175, 255]), 3, 1, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
}

// sloučí několik (neindexovaných) geometrií s barvami vrcholů do jedné, aby celé ovoce bylo 1 draw call
function merge(parts) {
  let n = 0;
  parts.forEach(g => n += g.attributes.position.count);
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), nor = new Float32Array(n * 3);
  let o = 0;
  for (const g of parts) {
    pos.set(g.attributes.position.array, o * 3);
    col.set(g.attributes.color.array, o * 3);
    nor.set(g.attributes.normal.array, o * 3);        // hladké normály koule: toon rampa dá čisté 3 pruhy stínu, ne fasety
    o += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  out.setAttribute("color", new THREE.BufferAttribute(col, 3));
  out.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  out.computeBoundingSphere();
  return out;
}
// obarví vrcholy podle funkce pozice -> barva (barvy se mezi vrcholy prolnou, hrany skvrn nejsou zubaté)
function paint(geo, fn) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const p = g.attributes.position, col = new Float32Array(p.count * 3), c = new THREE.Color(), v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.set(p.getX(i), p.getY(i), p.getZ(i));
    c.copy(fn(v, i));
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return g;
}
const jitter = (hex, i, amt = 0.05) => {
  const c = C(hex), h = Math.sin(i * 12.9898) * 43758.5453;
  return c.offsetHSL(0, 0, ((h - Math.floor(h)) - 0.5) * amt * 0.2);   // jen náznak, aby plocha nebyla mrtvě jednobarevná
};
function skinFn(kind) {
  const L = LOOK[kind];
  if (kind === "meloun") return (v, i) => {
    const a = Math.atan2(v.z, v.y) / (Math.PI * 2) + 0.5;
    return jitter(Math.floor(a * 12) % 2 ? L.skin[0] : L.skin[1], i, 0.04);
  };
  if (kind === "svestka") return (v, i) => jitter(v.y > 0.55 ? "#6F5BB8" : L.skin[0], i, 0.05);
  if (kind === "jablko") return (v, i) => jitter(v.x + v.z * 0.3 > 0.35 ? "#F2A23A" : L.skin[0], i, 0.06);
  if (kind === "kiwi") return (v, i) => jitter(Math.sin(v.x * 11) * Math.sin(v.y * 13 + 1) * Math.sin(v.z * 12) > 0.35 || v.y + v.x * 0.25 < -0.5 ? L.skin[1] : L.skin[0], i, 0.07);   // chloupky jako tmavé skvrny
  return (v, i) => jitter(v.y + v.x * 0.25 < -0.5 ? L.skin[1] : L.skin[0], i, 0.07);   // tmavší spodek: plochý „stín“ jako tvar
}
function extras(kind) {
  const L = LOOK[kind], out = [];
  if (L.stem) {
    const s = new THREE.CylinderGeometry(0.05, 0.08, 0.38, 5).translate(0, 1.08, 0);
    out.push(paint(s, () => C("#5E3A20")));
  }
  if (L.leaf) {
    const l = new THREE.OctahedronGeometry(0.3, 0).scale(1.1, 0.12, 0.5).rotateZ(-0.5).translate(0.3, 1.02, 0);
    out.push(paint(l, (v, i) => jitter("#4E9B3A", i, 0.12)));
  }
  return out;
}
function starShape(rOut, rIn) {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? rIn : rOut;
    i ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  return s;
}

// dužina jako malá textura na řezu
function fleshTexture(kind) {
  const L = LOOK[kind], cv = document.createElement("canvas");
  cv.width = cv.height = 128;
  const g = cv.getContext("2d"), m = 64;
  const disc = (r, c) => { g.fillStyle = c; g.beginPath(); g.arc(m, m, r, 0, Math.PI * 2); g.fill(); };
  disc(64, L.skin[0]);
  if (kind === "meloun") {
    disc(60, "#E9F2C9"); disc(54, L.flesh); disc(30, "#F2626A");
    g.fillStyle = "#1B1A17";
    for (let i = 0; i < 9; i++) {
      const a = i / 9 * Math.PI * 2;
      g.save(); g.translate(m + Math.cos(a) * 36, m + Math.sin(a) * 36); g.rotate(a);
      g.beginPath(); g.ellipse(0, 0, 5, 3, 0, 0, Math.PI * 2); g.fill(); g.restore();
    }
  } else if (kind === "pomeranc" || kind === "citron") {
    disc(59, "#FFF6DD"); disc(55, L.flesh);
    g.strokeStyle = "#FFF6DD"; g.lineWidth = 3;
    for (let i = 0; i < 10; i++) {
      const a = i / 10 * Math.PI * 2;
      g.beginPath(); g.moveTo(m, m); g.lineTo(m + Math.cos(a) * 55, m + Math.sin(a) * 55); g.stroke();
    }
    disc(6, "#FFF6DD");
  } else if (kind === "svestka") {
    disc(58, L.flesh);
    g.fillStyle = "#8A5A2B"; g.beginPath(); g.ellipse(m, m, 15, 24, 0, 0, Math.PI * 2); g.fill();
  } else if (kind === "jablko") {
    disc(59, L.flesh);
    g.strokeStyle = "#E3D59F"; g.lineWidth = 2; g.beginPath(); g.arc(m, m, 26, 0, Math.PI * 2); g.stroke();
    g.fillStyle = "#4A2E16";
    for (let i = 0; i < 5; i++) {
      const a = i / 5 * Math.PI * 2;
      g.beginPath(); g.ellipse(m + Math.cos(a) * 14, m + Math.sin(a) * 14, 3, 6, a, 0, Math.PI * 2); g.fill();
    }
  } else if (kind === "kiwi") {
    disc(60, L.flesh); disc(22, "#F1F4D8");
    g.fillStyle = "#1B1A17";
    for (let i = 0; i < 22; i++) {
      const a = i / 22 * Math.PI * 2;
      g.beginPath(); g.ellipse(m + Math.cos(a) * 28, m + Math.sin(a) * 28, 3.4, 1.8, a, 0, Math.PI * 2); g.fill();
    }
  } else {
    disc(60, L.flesh);
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createScene(canvas, opts = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: (window.devicePixelRatio || 1) < 2, powerPreference: "high-performance" });
  renderer.setClearColor(0x000000, 0);
  let pxRatio = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(pxRatio);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 1, 100);
  camera.position.set(0, 0, HALF_H / Math.tan(THREE.MathUtils.degToRad(FOV / 2)));
  scene.add(new THREE.HemisphereLight(0xCFE3FF, 0x5E3A20, 1.1));
  const sun = new THREE.DirectionalLight(0xFFE2B8, 2.2);
  sun.position.set(-0.6, 1, 0.9);
  scene.add(sun);

  const ramp = toonRamp();
  const skinMat = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: ramp });
  // světlý obrys: na tmavé desce drží siluetu švestky, kiwi, melounu i bomby (bomba má vlastní, teplejší)
  const outlineMat = new THREE.MeshBasicMaterial({ color: 0xF6EBD3, side: THREE.BackSide });
  const bombOutlineMat = new THREE.MeshBasicMaterial({ color: 0xFF7A4D, side: THREE.BackSide });
  const iceMat = new THREE.MeshToonMaterial({ color: 0xC4ECFF, gradientMap: ramp, transparent: true, opacity: 0.62, emissive: 0x2C6A8F, emissiveIntensity: 0.35 });
  const iceGeo = new THREE.IcosahedronGeometry(1.42, 0);

  // geometrie a materiály po druzích, sdílené všemi kusy
  const kit = {};
  for (const kind of Object.keys(LOOK)) {
    const L = LOOK[kind];
    if (kind === "karambola") {
      const ex = d => new THREE.ExtrudeGeometry(starShape(1.05, 0.55), { depth: d, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.08, bevelSegments: 1 }).translate(0, 0, -d / 2);
      const whole = paint(ex(0.7), (v, i) => jitter(L.skin[0], i, 0.06));
      const half = ex(0.3);
      kit[kind] = {
        whole, wholeMat: skinMat,
        half: paint(half, (v, i) => jitter(L.skin[0], i, 0.05)),
        capGeo: new THREE.ShapeGeometry(starShape(0.98, 0.5)).translate(0, 0, 0.29),
        capMat: new THREE.MeshToonMaterial({ color: C(L.flesh), gradientMap: ramp, emissive: 0x5A4000, emissiveIntensity: 0.4 }),
      };
      continue;
    }
    const whole = merge([paint(new THREE.SphereGeometry(1, 24, 16), skinFn(kind)), ...extras(kind)]);
    const half = paint(new THREE.SphereGeometry(1, 24, 8, 0, Math.PI * 2, 0, Math.PI / 2), skinFn(kind));
    const capGeo = new THREE.CircleGeometry(1, 16).rotateX(Math.PI / 2);
    kit[kind] = {
      whole, wholeMat: skinMat, half, capGeo,
      capMat: new THREE.MeshToonMaterial({ map: fleshTexture(kind), gradientMap: ramp, side: THREE.DoubleSide }),
    };
  }
  const bombKit = {};
  function bombGeo(band) {
    if (bombKit[band]) return bombKit[band];
    const body = paint(new THREE.SphereGeometry(1, 24, 16), (v, i) => Math.abs(v.y) < 0.2 ? C(band) : jitter("#232B3D", i, 0.06));
    const cap = paint(new THREE.CylinderGeometry(0.32, 0.38, 0.28, 8).translate(0, 0.98, 0), () => C("#59616F"));
    const fuse = paint(new THREE.CylinderGeometry(0.06, 0.06, 0.5, 5).rotateZ(0.4).translate(0.12, 1.3, 0), () => C("#C8A26B"));
    return bombKit[band] = merge([body, cap, fuse]);
  }

  // ---------- kapky šťávy a jiskry: jeden Points, pevný pool ----------
  const PMAX = opts.reduced ? 160 : 320;
  const pPos = new Float32Array(PMAX * 3), pCol = new Float32Array(PMAX * 3), pSize = new Float32Array(PMAX);
  const pVel = new Float32Array(PMAX * 2), pLife = new Float32Array(PMAX), pGrav = new Float32Array(PMAX);
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3).setUsage(THREE.DynamicDrawUsage));
  pGeo.setAttribute("color", new THREE.BufferAttribute(pCol, 3).setUsage(THREE.DynamicDrawUsage));
  pGeo.setAttribute("size", new THREE.BufferAttribute(pSize, 1).setUsage(THREE.DynamicDrawUsage));
  const pMat = new THREE.ShaderMaterial({
    uniforms: { uScale: { value: 1 } },
    vertexShader: `uniform float uScale; attribute float size; varying vec3 vC;
      void main(){ vC = color; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = size * uScale / -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying vec3 vC;
      void main(){ vec2 d = gl_PointCoord - 0.5; float r = length(d); if (r > 0.5) discard;
        gl_FragColor = vec4(vC, smoothstep(0.5, 0.44, r));   // plochá kapka bez odlesku
        #include <colorspace_fragment>
      }`,
    vertexColors: true, transparent: true, depthWrite: false,
  });
  const points = new THREE.Points(pGeo, pMat);
  points.frustumCulled = false;
  scene.add(points);
  let pNext = 0;
  const tmpC = new THREE.Color();
  function emit(x, y, z, vx, vy, color, size, life, grav = 1) {
    const i = pNext; pNext = (pNext + 1) % PMAX;
    pPos[i * 3] = x; pPos[i * 3 + 1] = y; pPos[i * 3 + 2] = z;
    pVel[i * 2] = vx; pVel[i * 2 + 1] = vy;
    tmpC.set(color);
    pCol[i * 3] = tmpC.r; pCol[i * 3 + 1] = tmpC.g; pCol[i * 3 + 2] = tmpC.b;
    pSize[i] = size; pLife[i] = life; pGrav[i] = grav;
  }
  function burst(x, y, color, n, speed, size = 0.55, life = 0.9) {
    if (opts.reduced) n = Math.ceil(n / 2);
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2, s = speed * (0.35 + Math.random() * 0.75);
      emit(x, y, 1.5, Math.cos(a) * s, Math.sin(a) * s + speed * 0.25, color, size * (0.6 + Math.random() * 0.8), life * (0.7 + Math.random() * 0.5));
    }
  }
  // prstenec jisker pro přesný řez
  function ring(x, y, color, n = 20) {
    if (opts.reduced) n = 8;
    for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2; emit(x, y, 1.5, Math.cos(a) * 15, Math.sin(a) * 15, color, 0.4, 0.5, 0.1); }
  }
  function stepParticles(dt) {
    for (let i = 0; i < PMAX; i++) {
      if (pLife[i] <= 0) { pSize[i] = 0; continue; }
      pLife[i] -= dt;
      pVel[i * 2 + 1] -= 22 * pGrav[i] * dt;
      pPos[i * 3] += pVel[i * 2] * dt; pPos[i * 3 + 1] += pVel[i * 2 + 1] * dt;
      if (pLife[i] < 0.25) pSize[i] *= 0.9;
    }
    pGeo.attributes.position.needsUpdate = true;
    pGeo.attributes.color.needsUpdate = true;
    pGeo.attributes.size.needsUpdate = true;
  }

  // ---------- kusy ve hře ----------
  let halfW = HALF_H, fieldHalf = HALF_H;   // fieldHalf: vodorovný rozsah spawnu (na ultra-širokém displeji užší než obraz)
  const live = new Set(), halves = [];
  // z = hloubka kusu: sousední kusy mají různou, takže se překrývající ovoce nezasekne do sebe a bomba (z 1,5) leží vždy vpředu, nikdy za ovocem
  function spawn(kind, { frozen = false, band = "#E23B3B", big = 1, z = 0 } = {}) {
    const g = new THREE.Group();
    const L = LOOK[kind], r = kind === "bomba" ? 0.95 : L.r;
    const geo = kind === "bomba" ? bombGeo(band) : kit[kind].whole;
    const mesh = new THREE.Mesh(geo, skinMat);
    const sc = kind === "bomba" ? [1, 1, 1] : L.scale;
    mesh.scale.set(sc[0] * r * big, sc[1] * r * big, sc[2] * r * big);
    const line = new THREE.Mesh(geo, kind === "bomba" ? bombOutlineMat : outlineMat);
    line.scale.setScalar(kind === "karambola" ? 1.08 : 1.07);
    mesh.add(line);
    g.add(mesh);
    let ice = null;
    if (frozen) { ice = new THREE.Mesh(iceGeo, iceMat); ice.scale.setScalar(r * big); g.add(ice); }
    scene.add(g);
    const o = { kind, g, mesh, ice, z, big, r: r * Math.max(...sc) * big, spinAxis: new THREE.Vector3(0, 1, 0), spin: 2 };
    live.add(o);
    return o;
  }
  const q = new THREE.Quaternion();
  function place(o, xn, y, t) {
    o.g.position.set(xn * fieldHalf, y, o.z || 0);
    q.setFromAxisAngle(o.spinAxis, o.spin * t);
    o.mesh.quaternion.copy(q);
    if (o.ice) o.ice.quaternion.copy(q);
    if (o.kind === "zlate" && Math.random() < 0.5) emit(o.g.position.x + (Math.random() - 0.5) * o.r * 1.6, o.g.position.y + (Math.random() - 0.5) * o.r * 1.6, 2, 0, 1.5, Math.random() < 0.5 ? "#FFF3B0" : "#FFC93C", 0.3, 0.35, 0.1);   // třpyt zlatého ovoce
    if (o.kind === "bomba" && Math.random() < 0.6) {
      const tip = new THREE.Vector3(0.24, 1.55, 0).applyQuaternion(q).multiplyScalar(o.r).add(o.g.position);
      emit(tip.x, tip.y, 2, (Math.random() - 0.5) * 3, 2 + Math.random() * 2, Math.random() < 0.5 ? "#FFD27A" : "#FF7A2F", 0.32, 0.25, 0.3);
    }
  }
  function remove(o) { scene.remove(o.g); live.delete(o); }

  const Y = new THREE.Vector3(0, 1, 0);
  function slice(o, dx, dy) {
    remove(o);
    const L = LOOK[o.kind], k = kit[o.kind];
    const d = new THREE.Vector2(dx, dy).normalize();
    const n = new THREE.Vector3(-d.y, d.x, 0);
    if (n.lengthSq() < 0.5) n.set(1, 0, 0);
    const base = o.g.position.clone();
    for (const sgn of [1, -1]) {
      const g = new THREE.Group();
      const shell = new THREE.Mesh(k.half, skinMat);
      const cap = new THREE.Mesh(k.capGeo, k.capMat);
      const rim = new THREE.Mesh(k.half, outlineMat); rim.scale.setScalar(1.07);   // stejný světlý obrys jako u celého ovoce
      g.add(shell, cap, rim);
      const sc = o.mesh.scale;
      g.scale.copy(sc);
      const dir = n.clone().multiplyScalar(sgn);
      if (o.kind === "karambola") g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(dir.x * 0.6, dir.y * 0.6, 0.8).normalize());
      else g.quaternion.setFromUnitVectors(Y, dir);
      g.position.copy(base).addScaledVector(dir, 0.12);
      scene.add(g);
      halves.push({
        g, vx: dir.x * 3.2 + o.vx * 0.6, vy: dir.y * 3.2 + o.vy * 0.5 + 1.5,
        axis: new THREE.Vector3(d.x, d.y, 0.3).normalize(), w: (4 + Math.random() * 3) * sgn, life: 3,
      });
    }
    burst(base.x, base.y, L.juice, 12, 11, 0.34, 0.6);
  }
  // zásah obřího melounu, který ještě drží: zmenší se, vystříkne šťáva (hp řeší main.js)
  function hurt(o) {
    o.mesh.scale.multiplyScalar(0.93); o.r *= 0.93;
    burst(o.g.position.x, o.g.position.y, LOOK[o.kind].juice, 9, 10, 0.42, 0.5);
  }
  function crack(o) {
    if (!o.ice) return;
    o.g.remove(o.ice); o.ice = null;
    burst(o.g.position.x, o.g.position.y, "#DDF6FF", 10, 10, 0.3, 0.5);
  }
  function explode(o) {
    remove(o);
    const p = o.g.position;
    burst(p.x, p.y, "#FFD27A", 14, 16, 0.45, 0.5);
    burst(p.x, p.y, "#FF5A2F", 10, 12, 0.5, 0.45);
    burst(p.x, p.y, "#2A3142", 8, 9, 0.55, 0.6);
  }
  function stepHalves(dt) {
    for (let i = halves.length - 1; i >= 0; i--) {
      const h = halves[i];
      h.vy -= 22 * dt;
      h.g.position.x += h.vx * dt; h.g.position.y += h.vy * dt;
      h.g.rotateOnWorldAxis(h.axis, h.w * dt);
      h.life -= dt;
      if (h.life <= 0 || h.g.position.y < -HALF_H - 3) { scene.remove(h.g); halves.splice(i, 1); }
    }
  }

  function resize(w, h) {
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    halfW = HALF_H * camera.aspect;
    fieldHalf = halfW * Math.min(w, h * 1.8, 1900) / w;   // hrací pole nejvýš 1,8× výška a 1900 px
    pMat.uniforms.uScale.value = h * pxRatio / (2 * Math.tan(THREE.MathUtils.degToRad(FOV / 2)));
    api.w = w; api.h = h;
  }
  function setPixelRatio(p) {
    pxRatio = p; renderer.setPixelRatio(p);
    resize(api.w, api.h);
  }
  // obrazovkové souřadnice (CSS px) bodu ve světě
  // z je hloubka kusu: perspektiva ho o pár procent zvětší a odsune od středu, hit-test s tím počítá
  const CAM_Z = HALF_H / Math.tan(THREE.MathUtils.degToRad(FOV / 2));
  const persp = z => CAM_Z / (CAM_Z - (z || 0));
  const toScreen = (x, y, z = 0) => { const f = persp(z); return { x: (x * f / halfW + 1) / 2 * api.w, y: (1 - y * f / HALF_H) / 2 * api.h }; };

  const api = {
    w: 1, h: 1, HALF_H, get halfW() { return halfW; }, get fieldHalf() { return fieldHalf; }, get pixelRatio() { return pxRatio; },
    renderer, spawn, place, remove, slice, crack, hurt, explode, persp, burst, ring, resize, setPixelRatio, toScreen,
    live, halves,
    step(dt) { stepParticles(dt); stepHalves(dt); },
    render() { renderer.render(scene, camera); },
    clear() { for (const o of [...live]) remove(o); for (const h of halves) scene.remove(h.g); halves.length = 0; pLife.fill(0); },
  };
  return api;
}
