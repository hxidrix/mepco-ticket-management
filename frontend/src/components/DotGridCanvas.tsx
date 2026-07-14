import { useEffect, useRef } from 'react';

export function DotGridCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return;
    const context = canvas.getContext('2d');
    if (context === null) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const smallDevice = window.matchMedia('(max-width: 700px)');
    let width = 0;
    let height = 0;
    let dpr = 1;
    let frame = 0;
    let visible = true;
    let pointerX = -10_000;
    let pointerY = -10_000;
    let easedX = pointerX;
    let easedY = pointerY;
    let startTime = performance.now();

    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      width = bounds.width;
      height = bounds.height;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = (now: number) => {
      context.clearRect(0, 0, width, height);
      easedX += (pointerX - easedX) * 0.085;
      easedY += (pointerY - easedY) * 0.085;
      const spacing = smallDevice.matches ? 38 : 29;
      const radius = smallDevice.matches ? 1 : 1.05;
      const influence = smallDevice.matches || reducedMotion.matches ? 0 : 132;
      const elapsed = (now - startTime) / 1_000;

      for (let y = spacing / 2; y < height; y += spacing) {
        for (let x = spacing / 2; x < width; x += spacing) {
          const dx = x - easedX;
          const dy = y - easedY;
          const distance = Math.hypot(dx, dy);
          const proximity = influence === 0 ? 0 : Math.max(0, 1 - distance / influence);
          const angle = Math.atan2(dy, dx) + elapsed * 0.7;
          const orbit = proximity * 4.5;
          const drawX = x + Math.cos(angle) * orbit;
          const drawY = y + Math.sin(angle) * orbit;
          const dotRadius = radius * (1 + proximity * 1.55);
          context.beginPath();
          context.arc(drawX, drawY, dotRadius, 0, Math.PI * 2);
          context.fillStyle = `rgba(${Math.round(58 + proximity * 28)}, ${Math.round(
            155 + proximity * 59,
          )}, 255, ${0.15 + proximity * 0.58})`;
          context.fill();
        }
      }

      if (visible && !document.hidden && !reducedMotion.matches) {
        frame = requestAnimationFrame(draw);
      }
    };

    const render = () => {
      cancelAnimationFrame(frame);
      startTime = performance.now();
      if (reducedMotion.matches) draw(startTime);
      else frame = requestAnimationFrame(draw);
    };

    const onPointerMove = (event: PointerEvent) => {
      const bounds = canvas.getBoundingClientRect();
      pointerX = event.clientX - bounds.left;
      pointerY = event.clientY - bounds.top;
    };
    const onPointerLeave = () => {
      pointerX = -10_000;
      pointerY = -10_000;
    };
    const onVisibilityChange = () => {
      if (document.hidden) cancelAnimationFrame(frame);
      else render();
    };
    const resizeObserver = new ResizeObserver(() => {
      resize();
      render();
    });
    const intersectionObserver = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? false;
      if (visible) render();
      else cancelAnimationFrame(frame);
    });

    resizeObserver.observe(canvas);
    intersectionObserver.observe(canvas);
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerout', onPointerLeave, { passive: true });
    document.addEventListener('visibilitychange', onVisibilityChange);
    reducedMotion.addEventListener('change', render);
    smallDevice.addEventListener('change', render);
    resize();
    render();

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerout', onPointerLeave);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      reducedMotion.removeEventListener('change', render);
      smallDevice.removeEventListener('change', render);
    };
  }, []);

  return <canvas ref={canvasRef} className="dot-grid-canvas" aria-hidden="true" />;
}
