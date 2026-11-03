// ============================================================
// ENGINE 3D — main.js
// Inicialização do site, navegação, scroll suave, reveal on scroll
// ============================================================

import { initAllMotors } from './motors.js';

document.addEventListener('DOMContentLoaded', () => {
  setupSmoothScroll();
  setupMobileNav();
  setupRevealOnScroll();
  setupHeaderShrink();
  initAllMotors();
});

/* ---------- Scroll suave para âncoras ---------- */
function setupSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', (e) => {
      const id = link.getAttribute('href');
      if (id === '#' || id.length < 2) return;
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      const headerH = document.querySelector('.site-header')?.offsetHeight || 0;
      const top = target.getBoundingClientRect().top + window.scrollY - headerH - 12;
      window.scrollTo({ top, behavior: 'smooth' });

      // fecha menu mobile se estiver aberto
      document.querySelector('.nav-list')?.classList.remove('open');
    });
  });
}

/* ---------- Menu mobile ---------- */
function setupMobileNav() {
  const toggle = document.querySelector('.nav-toggle');
  const list = document.querySelector('.nav-list');
  if (!toggle || !list) return;
  toggle.addEventListener('click', () => {
    const open = list.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(open));
  });
}

/* ---------- Reveal on scroll ---------- */
function setupRevealOnScroll() {
  const targets = document.querySelectorAll(
    '.section-head, .info-card, .engine-block'
  );
  targets.forEach((el) => el.classList.add('reveal'));

  const obs = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          obs.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12 }
  );
  targets.forEach((el) => obs.observe(el));
}

/* ---------- Header shrink ---------- */
function setupHeaderShrink() {
  const header = document.querySelector('.site-header');
  if (!header) return;
  window.addEventListener('scroll', () => {
    header.style.boxShadow = window.scrollY > 40
      ? '0 6px 24px -12px rgba(0,0,0,0.8)'
      : 'none';
  }, { passive: true });
}
