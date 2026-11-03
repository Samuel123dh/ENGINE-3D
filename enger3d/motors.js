// ============================================================
// ENGINE 3D — motors.js
// Criação procedural dos motores em Three.js + controles
// ============================================================

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createAnimator } from './animations.js';

const registry = new Map(); // id -> { scene, camera, renderer, controls, animator, tick }

/* ============================================================
   MATERIAIS PADRÃO (metálicos / realistas)
   ============================================================ */
function makeMaterials() {
  return {
    block: new THREE.MeshStandardMaterial({ color: 0x2a2e34, metalness: 0.85, roughness: 0.45 }),
    head: new THREE.MeshStandardMaterial({ color: 0x3a3f47, metalness: 0.9, roughness: 0.35 }),
    piston: new THREE.MeshStandardMaterial({ color: 0xb8bcc2, metalness: 0.95, roughness: 0.22 }),
    rod: new THREE.MeshStandardMaterial({ color: 0x8a8f96, metalness: 0.9, roughness: 0.3 }),
    crank: new THREE.MeshStandardMaterial({ color: 0x4c5158, metalness: 0.95, roughness: 0.28 }),
    valve: new THREE.MeshStandardMaterial({ color: 0xdfe3e8, metalness: 1.0, roughness: 0.15 }),
    rotor: new THREE.MeshStandardMaterial({ color: 0xcbcfd4, metalness: 0.95, roughness: 0.2 }),
    accent: new THREE.MeshStandardMaterial({ color: 0xff4b1f, emissive: 0x551000, metalness: 0.7, roughness: 0.4 }),
    injector: new THREE.MeshStandardMaterial({ color: 0xff8a3d, emissive: 0x3a1400, metalness: 0.8, roughness: 0.35 }),
    glass: new THREE.MeshPhysicalMaterial({
      color: 0x88aaff, transparent: true, opacity: 0.12, roughness: 0.05, metalness: 0,
      transmission: 0.9, thickness: 0.5,
    }),
  };
}

/* ============================================================
   HELPERS GEOMÉTRICOS
   ============================================================ */
function makeCylinderBlock({ count, spacing, radius, height, offsetX = 0, offsetZ = 0, rotationY = 0, materials }) {
  // Retorna um grupo com bloco + cilindros perfurados (visual externo)
  const group = new THREE.Group();
  group.rotation.y = rotationY;

  const totalW = spacing * (count - 1) + radius * 2.4;
  const blockGeo = new THREE.BoxGeometry(totalW, height * 1.15, radius * 2.8);
  const block = new THREE.Mesh(blockGeo, materials.block);
  block.position.set(offsetX, 0, offsetZ);
  block.castShadow = true; block.receiveShadow = true;
  group.add(block);

  // Cabeçote
  const headGeo = new THREE.BoxGeometry(totalW, height * 0.35, radius * 2.9);
  const head = new THREE.Mesh(headGeo, materials.head);
  head.position.set(offsetX, height * 0.75, offsetZ);
  head.castShadow = true; head.receiveShadow = true;
  group.add(head);

  return group;
}

function makePistonAssembly({ x, z, radius, strokeLength, materials }) {
  // Retorna { piston, rod, pinY } — peças separadas para animação
  const pistonGeo = new THREE.CylinderGeometry(radius * 0.92, radius * 0.92, radius * 0.9, 24);
  const piston = new THREE.Mesh(pistonGeo, materials.piston);
  piston.castShadow = true;

  const rodGeo = new THREE.BoxGeometry(radius * 0.35, strokeLength * 0.85, radius * 0.35);
  rodGeo.translate(0, -strokeLength * 0.42, 0); // pivô no topo
  const rod = new THREE.Mesh(rodGeo, materials.rod);
  rod.castShadow = true;

  const pinGeo = new THREE.CylinderGeometry(radius * 0.18, radius * 0.18, radius * 2.0, 12);
  pinGeo.rotateZ(Math.PI / 2);
  const pin = new THREE.Mesh(pinGeo, materials.rod);

  piston.position.set(x, 0, z);
  rod.position.set(x, 0, z);

  return { piston, rod, pin, baseX: x, baseZ: z, radius, strokeLength };
}

/* ============================================================
   CONSTRUTORES DE MOTOR
   ============================================================ */

// ---------- EM LINHA (L3, L4, L6) ----------
function buildInlineEngine({ count, materials }) {
  const root = new THREE.Group();
  const radius = 0.45;
  const stroke = 1.1;
  const spacing = 1.15;
  const crankY = -stroke * 0.6;

  // Bloco
  const block = makeCylinderBlock({
    count, spacing, radius, height: stroke * 1.6, materials,
  });
  root.add(block);

  // Virabrequim
  const crankGeo = new THREE.CylinderGeometry(0.22, 0.22, spacing * (count - 1) + 1.6, 20);
  crankGeo.rotateZ(Math.PI / 2);
  const crank = new THREE.Mesh(crankGeo, materials.crank);
  crank.position.y = crankY;
  crank.castShadow = true;
  root.add(crank);

  // Contrapesos / munhões
  for (let i = 0; i < count; i++) {
    const w = new THREE.Mesh(
      new THREE.CylinderGeometry(0.34, 0.34, 0.18, 20).rotateZ(Math.PI / 2),
      materials.crank
    );
    w.position.set((i - (count - 1) / 2) * spacing, crankY, 0);
    root.add(w);
  }

  // Pistões + bielas
  const pistons = [];
  for (let i = 0; i < count; i++) {
    const x = (i - (count - 1) / 2) * spacing;
    const p = makePistonAssembly({ x, z: 0, radius, strokeLength: stroke, materials });
    p.piston.position.y = crankY + stroke * 0.5;
    p.rod.position.set(x, crankY + stroke * 0.5, 0);
    p.phase = (i % 2) * Math.PI; // defasagem 180°
    root.add(p.piston, p.rod, p.pin);
    pistons.push(p);
  }

  // Cabeçote + válvulas visuais
  const valves = [];
  for (let i = 0; i < count; i++) {
    const x = (i - (count - 1) / 2) * spacing;
    for (const side of [-1, 1]) {
      const vGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.5, 10);
      const v = new THREE.Mesh(vGeo, materials.valve);
      v.position.set(x + side * 0.12, stroke * 1.2, 0);
      v.castShadow = true;
      v.userData.side = side;
      v.userData.phase = (i * Math.PI) + (side === 1 ? Math.PI : 0);
      root.add(v);
      valves.push(v);
    }
  }

  return {
    root,
    parts: { pistons, valves, crank, crankY, stroke },
    type: 'inline',
  };
}

// ---------- EM V (V6, V8, V10, V12) ----------
function buildVEngine({ totalCylinders, angleDeg, materials }) {
  const root = new THREE.Group();
  const perBank = totalCylinders / 2;
  const radius = 0.42;
  const stroke = 1.0;
  const spacing = 1.1;
  const crankY = -stroke * 0.6;
  const halfAngle = THREE.MathUtils.degToRad(angleDeg / 2);

  // Virabrequim único
  const crankGeo = new THREE.CylinderGeometry(0.22, 0.22, spacing * (perBank - 1) + 2.0, 20);
  crankGeo.rotateZ(Math.PI / 2);
  const crank = new THREE.Mesh(crankGeo, materials.crank);
  crank.position.y = crankY;
  crank.castShadow = true;
  root.add(crank);

  const pistons = [];
  const valves = [];

  for (const side of [-1, 1]) {
    // Bancada rotacionada em ±halfAngle em torno do eixo X (virabrequim)
    const bank = new THREE.Group();
    bank.rotation.x = side * halfAngle;
    root.add(bank);

    // Bloco da bancada
    const block = makeCylinderBlock({
      count: perBank, spacing, radius, height: stroke * 1.6, materials,
    });
    // desloca a bancada para cima no eixo local Y
    block.position.y = stroke * 0.6;
    bank.add(block);

    for (let i = 0; i < perBank; i++) {
      const x = (i - (perBank - 1) / 2) * spacing;
      const p = makePistonAssembly({ x, z: 0, radius, strokeLength: stroke, materials });
      p.piston.position.y = crankY + stroke * 0.5;
      p.rod.position.set(x, crankY + stroke * 0.5, 0);
      p.piston.rotation.x = 0; // a rotação vem do banco
      p.rod.rotation.x = 0;
      // ajusta para o frame local da bancada
      p.piston.position.y -= crankY * Math.cos(halfAngle);
      p.rod.position.y -= crankY * Math.cos(halfAngle);
      // Note: para manter simplicidade, a animação trabalhará em Y local
      p.bankSide = side;
      p.phase = (i * Math.PI) + (side === 1 ? Math.PI : 0);
      bank.add(p.piston, p.rod, p.pin);
      pistons.push(p);

      // válvulas
      for (const vs of [-1, 1]) {
        const vGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.45, 10);
        const v = new THREE.Mesh(vGeo, materials.valve);
        v.position.set(x + vs * 0.1, stroke * 1.8, 0);
        v.castShadow = true;
        v.userData.phase = (i * Math.PI) + (vs === 1 ? Math.PI : 0);
        bank.add(v);
        valves.push(v);
      }
    }
  }

  return {
    root,
    parts: { pistons, valves, crank, crankY, stroke },
    type: 'v',
    meta: { angleDeg, perBank },
  };
}

// ---------- BOXER ----------
function buildBoxerEngine({ pairs, materials }) {
  const root = new THREE.Group();
  const radius = 0.42;
  const stroke = 1.0;
  const spacing = 1.15;
  const crankY = 0;

  // Virabrequim central
  const crankGeo = new THREE.CylinderGeometry(0.22, 0.22, spacing * (pairs - 1) + 2.0, 20);
  crankGeo.rotateZ(Math.PI / 2);
  const crank = new THREE.Mesh(crankGeo, materials.crank);
  crank.position.y = crankY;
  crank.castShadow = true;
  root.add(crank);

  const pistons = [];
  const valves = [];

  for (let i = 0; i < pairs; i++) {
    const x = (i - (pairs - 1) / 2) * spacing;
    for (const side of [-1, 1]) {
      // Bancada horizontal: pistão se move em Z
      const bank = new THREE.Group();
      bank.rotation.z = 0; // horizontal
      root.add(bank);

      // Bloco lateral
      const blockGeo = new THREE.BoxGeometry(0.9, radius * 2.2, 1.6);
      const block = new THREE.Mesh(blockGeo, materials.block);
      block.position.set(x, 0, side * (stroke * 0.6 + radius));
      block.castShadow = true; block.receiveShadow = true;
      root.add(block);

      const pistonGeo = new THREE.CylinderGeometry(radius * 0.9, radius * 0.9, radius * 0.9, 20);
      pistonGeo.rotateX(Math.PI / 2);
      const piston = new THREE.Mesh(pistonGeo, materials.piston);
      piston.position.set(x, 0, side * stroke * 0.55);
      piston.castShadow = true;
      root.add(piston);

      const rodGeo = new THREE.BoxGeometry(radius * 0.35, radius * 0.35, stroke * 0.85);
      rodGeo.translate(0, 0, stroke * 0.42);
      const rod = new THREE.Mesh(rodGeo, materials.rod);
      rod.position.set(x, 0, 0);
      rod.castShadow = true;
      root.add(rod);

      pistons.push({ piston, rod, baseX: x, side, phase: (i % 2) * Math.PI });

      for (const vs of [-1, 1]) {
        const vGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.4, 10);
        vGeo.rotateX(Math.PI / 2);
        const v = new THREE.Mesh(vGeo, materials.valve);
        v.position.set(x + vs * 0.15, 0, side * (stroke * 1.35));
        v.castShadow = true;
        v.userData.side = side;
        v.userData.phase = (i * Math.PI) + (vs === 1 ? Math.PI : 0);
        root.add(v);
        valves.push(v);
      }
    }
  }

  return {
    root,
    parts: { pistons, valves, crank, crankY, stroke },
    type: 'boxer',
  };
}

// ---------- EM W (bancadas em V duplo) ----------
function buildWEngine({ materials }) {
  // Representação simplificada mas estruturalmente correta:
  // 4 bancadas em V duplo (dois V sobrepostos compartilhando virabrequim)
  const root = new THREE.Group();
  const radius = 0.34;
  const stroke = 0.8;
  const spacing = 0.95;
  const perBank = 3; // 12 cilindros totais (4 bancadas x 3)
  const halfAngle = THREE.MathUtils.degToRad(15); // 30° entre pares

  // Virabrequim
  const crankGeo = new THREE.CylinderGeometry(0.18, 0.18, spacing * (perBank - 1) + 1.6, 18);
  crankGeo.rotateZ(Math.PI / 2);
  const crank = new THREE.Mesh(crankGeo, materials.crank);
  crank.castShadow = true;
  root.add(crank);

  const pistons = [];
  const valves = [];

  const bankConfigs = [
    { tilt: -halfAngle, offsetY: 0.6 },
    { tilt:  halfAngle, offsetY: 0.6 },
    { tilt: -halfAngle * 2.6, offsetY: -0.4 },
    { tilt:  halfAngle * 2.6, offsetY: -0.4 },
  ];

  for (const cfg of bankConfigs) {
    const bank = new THREE.Group();
    bank.rotation.x = cfg.tilt;
    bank.position.y = cfg.offsetY;
    root.add(bank);

    const block = makeCylinderBlock({
      count: perBank, spacing, radius, height: stroke * 1.4, materials,
    });
    block.position.y = stroke * 0.4;
    bank.add(block);

    for (let i = 0; i < perBank; i++) {
      const x = (i - (perBank - 1) / 2) * spacing;
      const p = makePistonAssembly({ x, z: 0, radius, strokeLength: stroke, materials });
      p.phase = (i * Math.PI) + (cfg.tilt < 0 ? 0 : Math.PI);
      bank.add(p.piston, p.rod, p.pin);
      pistons.push(p);

      for (const vs of [-1, 1]) {
        const v = new THREE.Mesh(
          new THREE.CylinderGeometry(0.05, 0.05, 0.4, 10),
          materials.valve
        );
        v.position.set(x + vs * 0.1, stroke * 1.5, 0);
        v.userData.phase = (i * Math.PI) + (vs === 1 ? Math.PI : 0);
        bank.add(v);
        valves.push(v);
      }
    }
  }

  return {
    root,
    parts: { pistons, valves, crank, crankY: 0, stroke },
    type: 'w',
  };
}

// ---------- ROTATIVO (Wankel) ----------
function buildRotaryEngine({ materials }) {
  const root = new THREE.Group();

  // Carcaça interna (housing epitrocoidal aproximado — forma ovalada)
  const housingGeo = new THREE.CylinderGeometry(1.55, 1.55, 0.85, 6);
  const housing = new THREE.Mesh(housingGeo, materials.block);
  housing.rotation.x = Math.PI / 2;
  housing.castShadow = true; housing.receiveShadow = true;
  root.add(housing);

  // Câmara interna escavada (visual)
  const chamberGeo = new THREE.CylinderGeometry(1.25, 1.25, 0.86, 6);
  const chamber = new THREE.Mesh(chamberGeo, materials.glass);
  chamber.rotation.x = Math.PI / 2;
  root.add(chamber);

  // Eixo excêntrico
  const shaftGeo = new THREE.CylinderGeometry(0.14, 0.14, 2.4, 16);
  shaftGeo.rotateX(Math.PI / 2);
  const shaft = new THREE.Mesh(shaftGeo, materials.crank);
  shaft.castShadow = true;
  root.add(shaft);

  // Excêntrico
  const eccGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.4, 20);
  eccGeo.rotateX(Math.PI / 2);
  const ecc = new THREE.Mesh(eccGeo, materials.crank);
  ecc.position.set(0.35, 0, 0);
  shaft.add(ecc);

  // Rotor triangular (Reuleaux simplificado)
  const rotorShape = new THREE.Shape();
  const R = 0.95;
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2;
    const x = Math.cos(a) * R;
    const y = Math.sin(a) * R;
    if (k === 0) rotorShape.moveTo(x, y);
    else rotorShape.lineTo(x, y);
  }
  rotorShape.closePath();

  const rotorGeo = new THREE.ExtrudeGeometry(rotorShape, {
    depth: 0.5, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 2,
  });
  rotorGeo.translate(0, 0, -0.25);
  const rotor = new THREE.Mesh(rotorGeo, materials.rotor);
  rotor.castShadow = true;
  rotor.position.set(0.35, 0, 0);
  root.add(rotor);

  // Vedações do rotor (ápices)
  const seals = [];
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2;
    const seal = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.1, 0.55),
      materials.valve
    );
    seal.position.set(0.35 + Math.cos(a) * R, 0, Math.sin(a) * R);
    seal.userData.angle = a;
    root.add(seal);
    seals.push(seal);
  }

  // Vela / injetor (representação)
  const plug = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.08, 0.4, 10),
    materials.injector
  );
  plug.position.set(0, 1.1, 0);
  root.add(plug);

  return {
    root,
    parts: { rotor, shaft, ecc, seals, plug },
    type: 'rotary',
  };
}

// ---------- DIESEL (L4 com injetores destacados) ----------
function buildDieselEngine({ materials }) {
  const base = buildInlineEngine({ count: 4, materials });
  // Adiciona injetores no topo de cada cilindro
  const injectors = [];
  const count = 4, spacing = 1.15;
  for (let i = 0; i < count; i++) {
    const x = (i - (count - 1) / 2) * spacing;
    const inj = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.11, 0.6, 12),
      materials.injector
    );
    inj.position.set(x, base.parts.stroke * 1.55, 0);
    base.root.add(inj);
    injectors.push(inj);
  }
  base.parts.injectors = injectors;
  base.type = 'diesel';
  return base;
}

// ---------- FLEX (L4 com destaque no sistema de alimentação) ----------
function buildFlexEngine({ materials }) {
  const base = buildInlineEngine({ count: 4, materials });
  // Flauta de injeção (fuel rail) visível
  const railGeo = new THREE.BoxGeometry(4.2, 0.18, 0.3);
  const rail = new THREE.Mesh(railGeo, materials.accent);
  rail.position.set(0, base.parts.stroke * 1.35, 0);
  base.root.add(rail);

  const injectors = [];
  const count = 4, spacing = 1.15;
  for (let i = 0; i < count; i++) {
    const x = (i - (count - 1) / 2) * spacing;
    const inj = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.09, 0.45, 10),
      materials.injector
    );
    inj.position.set(x, base.parts.stroke * 1.05, 0);
    base.root.add(inj);
    injectors.push(inj);
  }
  base.parts.injectors = injectors;
  base.parts.rail = rail;
  base.type = 'flex';
  return base;
}

/* ============================================================
   MAPA DE CONSTRUTORES
   ============================================================ */
const BUILDERS = {
  L3:     (m) => buildInlineEngine({ count: 3, materials: m }),
  L4:     (m) => buildInlineEngine({ count: 4, materials: m }),
  L6:     (m) => buildInlineEngine({ count: 6, materials: m }),
  V6:     (m) => buildVEngine({ totalCylinders: 6,  angleDeg: 60, materials: m }),
  V8:     (m) => buildVEngine({ totalCylinders: 8,  angleDeg: 90, materials: m }),
  V10:    (m) => buildVEngine({ totalCylinders: 10, angleDeg: 90, materials: m }),
  V12:    (m) => buildVEngine({ totalCylinders: 12, angleDeg: 60, materials: m }),
  BOXER:  (m) => buildBoxerEngine({ pairs: 2, materials: m }),
  W:      (m) => buildWEngine({ materials: m }),
  ROTARY
