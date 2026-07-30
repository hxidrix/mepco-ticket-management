import { useEffect } from 'react';

import './BorderGlow.css';

const glowTargetSelector = [
  '.auth-card',
  '.workspace-sidebar',
  '.status-panel',
  '.panel',
  '.overview-grid > article',
  '.public-action-card',
  '.public-flow-card',
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

function easeOutCubic(value: number): number {
  return 1 - Math.pow(1 - value, 3);
}

function easeInCubic(value: number): number {
  return value * value * value;
}

interface AnimateOptions {
  start?: number;
  end?: number;
  duration?: number;
  delay?: number;
  ease?: (value: number) => number;
  onUpdate: (value: number) => void;
  onEnd?: () => void;
}

function animateValue({
  start = 0,
  end = 100,
  duration = 1000,
  delay = 0,
  ease = easeOutCubic,
  onUpdate,
  onEnd,
}: AnimateOptions): () => void {
  const startTime = performance.now() + delay;
  let frameId: number | undefined;
  let cancelled = false;

  const tick = () => {
    if (cancelled) return;
    const elapsed = performance.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);
    onUpdate(start + (end - start) * ease(progress));
    if (progress < 1) frameId = requestAnimationFrame(tick);
    else onEnd?.();
  };

  const timeoutId = window.setTimeout(() => {
    frameId = requestAnimationFrame(tick);
  }, delay);

  return () => {
    cancelled = true;
    window.clearTimeout(timeoutId);
    if (frameId !== undefined) cancelAnimationFrame(frameId);
  };
}

function startSweep(element: HTMLElement, onEnd: () => void): () => void {
  const angleStart = 110;
  const angleEnd = 465;
  const cancellations: Array<() => void> = [];

  element.classList.add('sweep-active');
  element.style.setProperty('--cursor-angle', `${angleStart}deg`);

  cancellations.push(animateValue({
    duration: 500,
    onUpdate: value => element.style.setProperty('--edge-proximity', `${value}`),
  }));
  cancellations.push(animateValue({
    ease: easeInCubic,
    duration: 1500,
    end: 50,
    onUpdate: value => {
      element.style.setProperty('--cursor-angle', `${(angleEnd - angleStart) * (value / 100) + angleStart}deg`);
    },
  }));
  cancellations.push(animateValue({
    ease: easeOutCubic,
    delay: 1500,
    duration: 2250,
    start: 50,
    end: 100,
    onUpdate: value => {
      element.style.setProperty('--cursor-angle', `${(angleEnd - angleStart) * (value / 100) + angleStart}deg`);
    },
  }));
  cancellations.push(animateValue({
    ease: easeInCubic,
    delay: 2500,
    duration: 1500,
    start: 100,
    end: 0,
    onUpdate: value => element.style.setProperty('--edge-proximity', `${value}`),
    onEnd: () => {
      element.classList.remove('sweep-active');
      onEnd();
    },
  }));

  return () => {
    cancellations.forEach(cancel => cancel());
    element.classList.remove('sweep-active');
  };
}

function decorateTarget(element: HTMLElement, sweeps: Map<HTMLElement, () => void>): void {
  if (element.dataset.borderGlow === 'true') return;

  element.dataset.borderGlow = 'true';
  element.classList.add('border-glow-target');

  const edgeLight = document.createElement('span');
  edgeLight.className = 'edge-light';
  edgeLight.dataset.borderGlowEdge = 'true';
  edgeLight.setAttribute('aria-hidden', 'true');
  element.prepend(edgeLight);

  const reduceMotion = typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reduceMotion) {
    const cancelSweep = startSweep(element, () => sweeps.delete(element));
    sweeps.set(element, cancelSweep);
  }
}

function decorateTree(root: ParentNode, sweeps: Map<HTMLElement, () => void>): void {
  if (root instanceof HTMLElement && root.matches(glowTargetSelector)) {
    decorateTarget(root, sweeps);
  }

  root.querySelectorAll<HTMLElement>(glowTargetSelector).forEach(element => decorateTarget(element, sweeps));
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
    const sweeps = new Map<HTMLElement, () => void>();
    decorateTree(document.body, sweeps);

    const observer = new MutationObserver((records) => {
      records.forEach((record) => {
        record.addedNodes.forEach((node) => {
          if (node instanceof HTMLElement) decorateTree(node, sweeps);
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
      sweeps.forEach(cancelSweep => cancelSweep());
      sweeps.clear();
      document.querySelectorAll<HTMLElement>('[data-border-glow="true"]').forEach((element) => {
        element.querySelector(':scope > [data-border-glow-edge="true"]')?.remove();
        element.classList.remove('border-glow-target', 'sweep-active');
        delete element.dataset.borderGlow;
        element.style.removeProperty('--edge-proximity');
        element.style.removeProperty('--cursor-angle');
      });
    };
  }, []);

  return null;
}
