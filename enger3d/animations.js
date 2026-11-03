// ============================================================
// ENGINE 3D — animations.js
// Animação mecânica dos componentes internos
// ============================================================

import * as THREE from 'three';

export function createAnimator(built) {
  const { type, parts } = built;
  const RPM = 1.2; // voltas por segundo

  function animateReciprocating(t) {
    const angle = t * Math.PI * 2 * RPM;
    if (parts.crank) parts.crank.rotation.x = angle;

    (parts.pistons || []).forEach((p) => {
      const phase = p.phase || 0;
      const localAngle = angle + phase;

      if (type === 'boxer') {
        const z = Math.cos(localAngle) * parts.stroke * 0.55;
        p.piston.position.z = z * p.side;
        p.rod.position.z = z * 0.5 * p.side;
        p.rod.rotation.x = Math.sin(localAngle) * 0.5;
      } else {
        const y = (parts.crankY || 0) + Math.cos(localAngle) * parts.stroke * 0.5;
        p.piston.position.y = y;
        p.rod.position.y = y - parts.stroke * 0.15;
        p.rod.rotation.x = Math.sin(localAngle) * 0.35;
      }
    });

    (parts.valves || []).forEach((v) => {
      const phase = v.userData.phase || 0;
      const lift = Math.max(0, Math.sin(angle + phase)) * 0.12;
      if (type === 'boxer') {
        const side = v.userData.side || 1;
        v.position.z = side * (parts.stroke * 1.35 - lift);
      } else {
        const base = parts.stroke * 1.2;
        v.position.y = base + lift;
      }
    });
  }

  function animateRotary(t) {
    const angle = t * Math.PI * 2 * RPM * 1.5;
    if (parts.shaft) parts.shaft.rotation.z = angle;

    const eccX = Math.cos(angle) * 0.35;
    const eccY = Math.sin(angle) * 0.35;

    if (parts.rotor) {
      parts.rotor.position.x = eccX;
      parts.rotor.position.y = eccY;
      parts.rotor.rotation.z = -angle * 0.5;
    }

    (parts.seals || []).forEach((s) => {
      const a = s.userData.angle + angle;
      s.position.x = Math.cos(a) * 0.95 + eccX;
      s.position.y = Math.sin(a) * 0.95 + eccY;
    });
  }

  return {
    update(time) {
      if (type === 'rotary') animateRotary(time);
      else animateReciprocating(time);
    },
  };
}
