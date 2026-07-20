import { useEffect } from 'react';

import './BorderGlow.css';

const glowTargetSelector = [
  '.auth-card',
  '.workspace-sidebar',
  '.status-panel',
  '.panel',
  '.overview-grid > article',
  '.button',
  '.auth-submit',
  '.auth-tabs button',
  '.master-tabs button',
  '.pagination button',
  '.row-actions button',
  '.back-link',
  '.ticket-attachment-form button',
  '.attachment-list button',
  '.admin-data-panel .panel__heading button',
  '.workspace-signout',
  '.workspace-signout-confirmation__actions button',
  '.workspace-menu',
].join(',');

function decorateTarget(element: HTMLElement): void {
  if (element.dataset.borderGlow === 'true') return;

  element.dataset.borderGlow = 'true';
  element.classList.add('border-glow-target');

  const reduceMotion = typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reduceMotion) {
    element.classList.add('border-glow-animated');
    const finishIntro = (event: AnimationEvent) => {
      if (event.target !== element || event.animationName !== 'border-glow-sweep') return;
      element.classList.remove('border-glow-animated');
      element.removeEventListener('animationend', finishIntro);
    };
    element.addEventListener('animationend', finishIntro);
  }
}

function decorateTree(root: ParentNode): void {
  if (root instanceof HTMLElement && root.matches(glowTargetSelector)) {
    decorateTarget(root);
  }

  root.querySelectorAll<HTMLElement>(glowTargetSelector).forEach(decorateTarget);
}

function updateGlowPosition(element: HTMLElement, clientX: number, clientY: number): void {
  const rect = element.getBoundingClientRect();
  const centerX = rect.width / 2;
  const centerY = rect.height / 2;
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  const deltaX = x - centerX;
  const deltaY = y - centerY;
  const scaleX = deltaX === 0 ? Number.POSITIVE_INFINITY : centerX / Math.abs(deltaX);
  const scaleY = deltaY === 0 ? Number.POSITIVE_INFINITY : centerY / Math.abs(deltaY);
  const proximity = Math.min(Math.max(1 / Math.min(scaleX, scaleY), 0), 1);
  let angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI) + 90;
  if (angle < 0) angle += 360;

  element.style.setProperty('--edge-proximity', `${(proximity * 100).toFixed(3)}`);
  element.style.setProperty('--cursor-angle', `${angle.toFixed(3)}deg`);
}

export function BorderGlowSystem() {
  useEffect(() => {
    decorateTree(document.body);

    const observer = new MutationObserver((records) => {
      records.forEach((record) => {
        record.addedNodes.forEach((node) => {
          if (node instanceof HTMLElement) decorateTree(node);
        });
      });
    });

    const handlePointerMove = (event: PointerEvent) => {
      const origin = event.target;
      if (!(origin instanceof Element)) return;
      const target = origin.closest<HTMLElement>(glowTargetSelector);
      if (target !== null) updateGlowPosition(target, event.clientX, event.clientY);
    };

    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener('pointermove', handlePointerMove, { passive: true });

    return () => {
      observer.disconnect();
      document.removeEventListener('pointermove', handlePointerMove);
      document.querySelectorAll<HTMLElement>('[data-border-glow="true"]').forEach((element) => {
        element.querySelector(':scope > [data-border-glow-edge="true"]')?.remove();
        element.classList.remove('border-glow-target', 'border-glow-animated');
        delete element.dataset.borderGlow;
        element.style.removeProperty('--edge-proximity');
        element.style.removeProperty('--cursor-angle');
      });
    };
  }, []);

  return null;
}
