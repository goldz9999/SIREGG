import { useEffect } from 'react';

const EASE = 'cubic-bezier(.2,.8,.2,1)';
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Entrance motion for anything newly added under `main` and for popovers:
 * staggered fade-up for headings, rows and panels ([data-a]), bars that grow
 * ([data-grow="x"|"y"]), charts that wipe in ([data-reveal]), popovers that
 * drop in ([data-pop]) and toasts that rise ([data-toast]). Each element
 * animates once, the first time it appears in the DOM.
 */
export function useMotion() {
  useEffect(() => {
    const seen = new WeakSet<Element>();
    let raf = 0;
    let detailShown = false;

    const run = () => {
      raf = 0;
      if (reduced()) return;
      let i = 0;
      let g = 0;
      const detail = document.querySelector('[data-detail]');
      if (detail && !seen.has(detail) && detailShown) {
        // Moving between expenses in the review tray slides the detail in sideways.
        seen.add(detail);
        detail.animate([{ opacity: 0, transform: 'translateX(18px)' }, { opacity: 1, transform: 'none' }], { duration: 380, easing: EASE });
      }
      detailShown = !!detail;
      document.querySelectorAll('main h1, main h2, main h3, main tbody tr, main .card, main [data-a], [data-detail]').forEach((el) => {
        if (seen.has(el)) return;
        seen.add(el);
        el.animate([{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], { duration: 480, delay: Math.min(i++, 14) * 40, easing: EASE, fill: 'backwards' });
      });
      document.querySelectorAll<HTMLElement>('[data-grow]').forEach((el) => {
        if (seen.has(el)) return;
        seen.add(el);
        const y = el.dataset.grow === 'y';
        el.animate([{ transform: y ? 'scaleY(0)' : 'scaleX(0)' }, { transform: 'none' }], { duration: 760, delay: 120 + Math.min(g++, 20) * 35, easing: EASE, fill: 'backwards' });
      });
      document.querySelectorAll('[data-reveal]').forEach((el) => {
        if (seen.has(el)) return;
        seen.add(el);
        el.animate([{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0 0 0)' }], { duration: 1100, delay: 150, easing: EASE, fill: 'backwards' });
      });
      document.querySelectorAll('[data-pop]').forEach((el) => {
        if (seen.has(el)) return;
        seen.add(el);
        el.animate([{ opacity: 0, transform: 'translateY(-6px) scale(.97)' }, { opacity: 1, transform: 'none' }], { duration: 220, easing: EASE });
      });
      document.querySelectorAll('[data-toast]').forEach((el) => {
        if (seen.has(el)) return;
        seen.add(el);
        el.animate([{ opacity: 0, transform: 'translateY(18px)' }, { opacity: 1, transform: 'none' }], { duration: 340, easing: EASE });
      });
    };

    const schedule = () => { if (!raf) raf = requestAnimationFrame(run); };
    const mo = new MutationObserver(schedule);
    mo.observe(document.body, { childList: true, subtree: true });
    schedule();
    return () => { mo.disconnect(); cancelAnimationFrame(raf); };
  }, []);
}
