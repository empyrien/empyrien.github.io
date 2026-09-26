/* ============================================================
   Empyrien — shared behaviour. No dependencies, no build step.
   Everything here is an enhancement: every page reads and works
   with scripting off.
   ============================================================ */
(() => {
  'use strict';

  const root = document.documentElement;
  // the inline script in <head> hides reveal-on-scroll content only
  // until this flag appears; if this file never runs, it un-hides it
  window.__empyrien = true;
  root.classList.add('js');

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const touch = matchMedia('(hover: none)').matches;

  /* ---------------------------------------------- reveal on scroll */

  const reveal = (els, cls, opts) => {
    if (!els.length) return;
    if (!('IntersectionObserver' in window)) { els.forEach((el) => el.classList.add(cls)); return; }
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) { e.target.classList.add(cls); io.unobserve(e.target); }
      }
    }, opts);
    els.forEach((el) => io.observe(el));
  };

  reveal(document.querySelectorAll('[data-reveal]'), 'is-in', { rootMargin: '0px 0px -6% 0px', threshold: 0.08 });
  reveal(document.querySelectorAll('.conv'), 'is-in', { threshold: 0.45 });

  /* ---------------------------------------------- top bar over the hero */

  const bar = document.querySelector('.topbar--overlay');
  if (bar) {
    const hero = document.querySelector('.hero');
    const update = () => {
      const limit = hero ? hero.offsetHeight - bar.offsetHeight * 1.5 : 40;
      bar.classList.toggle('is-solid', window.scrollY > limit);
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update, { passive: true });
  }

  /* ---------------------------------------------- reading progress */

  const progress = document.querySelector('.progress');
  if (progress) {
    let queued = false;
    const paint = () => {
      queued = false;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      progress.style.transform = `scaleX(${max > 0 ? Math.min(1, window.scrollY / max) : 0})`;
    };
    const queue = () => { if (!queued) { queued = true; requestAnimationFrame(paint); } };
    paint();
    window.addEventListener('scroll', queue, { passive: true });
    window.addEventListener('resize', queue, { passive: true });
  }

  /* ---------------------------------------------- mobile menu */

  document.querySelectorAll('details.menu').forEach((menu) => {
    menu.addEventListener('click', (e) => { if (e.target.closest('a')) menu.open = false; });
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    document.querySelectorAll('details.menu[open]').forEach((menu) => {
      menu.open = false;
      menu.querySelector('summary').focus();
    });
  });

  /* ---------------------------------------------- doors light up in view (touch) */

  if (touch && 'IntersectionObserver' in window) {
    const doors = document.querySelectorAll('.doorway');
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) e.target.classList.toggle('is-lit', e.intersectionRatio > 0.6);
    }, { threshold: [0, 0.6, 1] });
    doors.forEach((d) => io.observe(d));
  }

  /* ---------------------------------------------- motes of light */

  const canvas = document.querySelector('canvas.motes');
  if (canvas && !reduceMotion) motes(canvas);

  function motes(canvas) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let w = 0, h = 0, horizon = 0, list = [], raf = 0, visible = true;

    const spawn = (anywhere) => {
      const life = 700 + Math.random() * 1100;
      return {
        x: Math.random() * w,
        // most rise from the band around the horizon
        y: anywhere ? Math.random() * h : horizon + (Math.random() - 0.3) * h * 0.35,
        r: Math.random() * 1.05 + 0.25,
        vx: (Math.random() - 0.5) * 0.06,
        vy: -(Math.random() * 0.13 + 0.035),
        phase: Math.random() * Math.PI * 2,
        age: anywhere ? Math.random() * life : 0,
        life,
      };
    };

    const size = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      horizon = h * 0.55;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.round(Math.min(110, Math.max(36, (w * h) / 12000)));
      list = Array.from({ length: count }, () => spawn(true));
    };

    const frame = () => {
      ctx.clearRect(0, 0, w, h);
      for (const m of list) {
        m.x += m.vx;
        m.y += m.vy;
        m.age += 1;
        m.phase += 0.018;
        const fade = Math.min(1, m.age / 140, (m.life - m.age) / 140);
        // brighter near the horizon, dimmer as they climb into the dark
        const lift = 1 - Math.min(1, Math.abs(m.y - horizon) / (h * 0.6));
        const a = Math.max(0, fade) * (0.25 + 0.3 * Math.sin(m.phase) + 0.35 * lift);
        if (a > 0.01) {
          ctx.fillStyle = `rgba(244, 218, 172, ${a.toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
          ctx.fill();
        }
        if (m.age >= m.life || m.y < -8) Object.assign(m, spawn(false));
      }
      raf = requestAnimationFrame(frame);
    };

    const start = () => { if (!raf && visible && !document.hidden) raf = requestAnimationFrame(frame); };
    const stop = () => { cancelAnimationFrame(raf); raf = 0; };

    size();
    start();
    window.addEventListener('resize', () => { size(); }, { passive: true });
    document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([e]) => {
        visible = e.isIntersecting;
        visible ? start() : stop();
      }).observe(canvas);
    }
  }
})();
