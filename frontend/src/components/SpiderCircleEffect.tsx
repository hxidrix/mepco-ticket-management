import { useEffect, useRef } from 'react';

type Particle = {
  x: number;
  y: number;
  radius: number;
  phase: number;
  drift: number;
  drawX: number;
  drawY: number;
  distance: number;
};

function seededRandom(seed: number) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function readAccentColor() {
  const fallback = { red: 249, green: 7, blue: 6 };
  const value = getComputedStyle(document.documentElement).getPropertyValue('--brand-red').trim();
  const hex = value.match(/^#([\da-f]{6})$/i)?.[1];
  if (hex !== undefined) {
    return {
      red: Number.parseInt(hex.slice(0, 2), 16),
      green: Number.parseInt(hex.slice(2, 4), 16),
      blue: Number.parseInt(hex.slice(4, 6), 16),
    };
  }
  const rgb = value.match(/[\d.]+/g)?.map(Number);
  return rgb !== undefined && rgb.length >= 3
    ? { red: rgb[0] ?? fallback.red, green: rgb[1] ?? fallback.green, blue: rgb[2] ?? fallback.blue }
    : fallback;
}

export function SpiderCircleEffect() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = canvas?.parentElement;
    if (canvas === null || canvas === undefined || host === null || host === undefined) return;
    const context = canvas.getContext('2d');
    if (context === null) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const smallDevice = window.matchMedia('(max-width: 700px)');
    let width = 0;
    let height = 0;
    let dpr = 1;
    let frame = 0;
    let visible = true;
    let particles: Particle[] = [];
    let pointerX = 0;
    let pointerY = 0;
    let pointerActive = false;
    let pointerIsTouch = false;
    let lastPointerTime = 0;
    let spiderX = 0;
    let spiderY = 0;
    let velocityX = 0;
    let velocityY = 0;
    let accent = readAccentColor();
    let darkTheme = document.documentElement.dataset.theme === 'dark';

    const rebuildParticles = () => {
      const random = seededRandom(Math.round(width * 31 + height * 17));
      const areaPerDot = smallDevice.matches ? 6_000 : 5_600;
      const minimum = smallDevice.matches ? 68 : 150;
      const maximum = smallDevice.matches ? 140 : 260;
      const count = Math.min(maximum, Math.max(minimum, Math.round((width * height) / areaPerDot)));
      particles = Array.from({ length: count }, () => ({
        x: random() * width,
        y: random() * height,
        radius: 0.65 + random() * 0.75,
        phase: random() * Math.PI * 2,
        drift: 0.7 + random() * 1.5,
        drawX: 0,
        drawY: 0,
        distance: Number.POSITIVE_INFINITY,
      }));
    };

    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      const nextWidth = Math.max(1, bounds.width);
      const nextHeight = Math.max(1, bounds.height);
      const firstLayout = width === 0 || height === 0;
      width = nextWidth;
      height = nextHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      rebuildParticles();
      if (firstLayout) {
        spiderX = width * 0.56;
        spiderY = Math.min(height * 0.36, 330);
      } else {
        spiderX = Math.min(spiderX, width);
        spiderY = Math.min(spiderY, height);
      }
    };

    const draw = (now: number) => {
      context.clearRect(0, 0, width, height);
      const elapsed = now / 1_000;
      const touchIsFresh = !pointerIsTouch || now - lastPointerTime < 2_800;
      const followPointer = pointerActive && touchIsFresh && !reducedMotion.matches;
      const targetX = followPointer
        ? pointerX
        : width * (0.5 + Math.sin(elapsed * 0.36) * 0.28 + Math.sin(elapsed * 0.13) * 0.06);
      const targetY = followPointer
        ? pointerY
        : height * (0.42 + Math.cos(elapsed * 0.31) * 0.2 + Math.sin(elapsed * 0.17) * 0.05);

      if (reducedMotion.matches) {
        spiderX = width * 0.56;
        spiderY = Math.min(height * 0.36, 330);
      } else {
        velocityX = (velocityX + (targetX - spiderX) * 0.021) * 0.8;
        velocityY = (velocityY + (targetY - spiderY) * 0.021) * 0.8;
        spiderX += velocityX;
        spiderY += velocityY;
      }

      const reactionDistance = smallDevice.matches ? 118 : Math.min(182, Math.max(148, width * 0.13));
      const maxConnections = 12;
      const dotChannels = darkTheme ? '231, 239, 247' : '95, 65, 65';

      for (const particle of particles) {
        particle.drawX = particle.x + Math.cos(elapsed * 0.3 * particle.drift + particle.phase) * particle.drift;
        particle.drawY = particle.y + Math.sin(elapsed * 0.27 * particle.drift + particle.phase) * particle.drift;
        particle.distance = Math.hypot(particle.drawX - spiderX, particle.drawY - spiderY);
      }

      const connected = particles
        .filter((particle) => particle.distance < reactionDistance)
        .sort((first, second) => first.distance - second.distance)
        .slice(0, maxConnections);

      context.lineCap = 'round';
      context.save();
      context.shadowColor = `rgba(${accent.red}, ${accent.green}, ${accent.blue}, 0.34)`;
      context.shadowBlur = 2.5;
      for (const particle of connected) {
        const proximity = 1 - particle.distance / reactionDistance;
        const opacity = 0.72 + proximity * 0.23;
        context.beginPath();
        context.moveTo(spiderX, spiderY);
        context.lineTo(particle.drawX, particle.drawY);
        context.lineWidth = 0.82 + proximity * 0.55;
        context.strokeStyle = `rgba(${accent.red}, ${accent.green}, ${accent.blue}, ${opacity})`;
        context.stroke();
      }
      context.restore();

      for (const particle of particles) {
        const proximity = Math.max(0, 1 - particle.distance / reactionDistance);
        const pulse = 0.5 + Math.sin(elapsed * 0.7 + particle.phase) * 0.5;
        const radius = particle.radius * (1 + proximity * 1.7);
        const opacity = 0.25 + pulse * 0.1 + proximity * 0.55;
        context.beginPath();
        context.arc(particle.drawX, particle.drawY, radius, 0, Math.PI * 2);
        context.fillStyle = proximity > 0.06
          ? `rgba(${accent.red}, ${accent.green}, ${accent.blue}, ${Math.min(0.94, opacity)})`
          : `rgba(${dotChannels}, ${opacity})`;
        context.fill();
      }

      for (const particle of connected) {
        const proximity = 1 - particle.distance / reactionDistance;
        const endpointRadius = (smallDevice.matches ? 1.9 : 2.25) + proximity * 0.85;
        context.save();
        context.beginPath();
        context.arc(particle.drawX, particle.drawY, endpointRadius, 0, Math.PI * 2);
        context.shadowColor = `rgba(${accent.red}, ${accent.green}, ${accent.blue}, 0.78)`;
        context.shadowBlur = 6;
        context.fillStyle = `rgba(${accent.red}, ${accent.green}, ${accent.blue}, 0.96)`;
        context.fill();
        context.restore();
      }

      const coreSize = smallDevice.matches ? 7 : 9;
      context.save();
      context.shadowColor = `rgba(${accent.red}, ${accent.green}, ${accent.blue}, 0.72)`;
      context.shadowBlur = 13;
      context.fillStyle = `rgb(${accent.red}, ${accent.green}, ${accent.blue})`;
      context.fillRect(spiderX - coreSize / 2, spiderY - coreSize / 2, coreSize, coreSize);
      context.restore();

      if (visible && !document.hidden && !reducedMotion.matches) frame = requestAnimationFrame(draw);
    };

    const render = () => {
      cancelAnimationFrame(frame);
      if (reducedMotion.matches) draw(performance.now());
      else if (visible && !document.hidden) frame = requestAnimationFrame(draw);
    };

    const onPointerMove = (event: PointerEvent) => {
      const bounds = canvas.getBoundingClientRect();
      const inside = event.clientX >= bounds.left
        && event.clientX <= bounds.right
        && event.clientY >= bounds.top
        && event.clientY <= bounds.bottom;
      pointerActive = inside;
      if (!inside) return;
      pointerX = event.clientX - bounds.left;
      pointerY = event.clientY - bounds.top;
      pointerIsTouch = event.pointerType === 'touch';
      lastPointerTime = performance.now();
    };
    const onPointerOut = (event: PointerEvent) => {
      if (event.relatedTarget === null) pointerActive = false;
    };
    const onVisibilityChange = () => {
      if (document.hidden) cancelAnimationFrame(frame);
      else render();
    };
    const onThemeChange = () => {
      accent = readAccentColor();
      darkTheme = document.documentElement.dataset.theme === 'dark';
      render();
    };
    const onDeviceChange = () => {
      resize();
      render();
    };
    const resizeObserver = new ResizeObserver(() => {
      resize();
      render();
    });
    const intersectionObserver = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? false;
      render();
    });
    const themeObserver = new MutationObserver(onThemeChange);

    resizeObserver.observe(host);
    intersectionObserver.observe(canvas);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerdown', onPointerMove, { passive: true });
    window.addEventListener('pointerout', onPointerOut, { passive: true });
    document.addEventListener('visibilitychange', onVisibilityChange);
    reducedMotion.addEventListener('change', render);
    smallDevice.addEventListener('change', onDeviceChange);
    resize();
    render();

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      themeObserver.disconnect();
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerdown', onPointerMove);
      window.removeEventListener('pointerout', onPointerOut);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      reducedMotion.removeEventListener('change', render);
      smallDevice.removeEventListener('change', onDeviceChange);
    };
  }, []);

  return <canvas ref={canvasRef} className="spider-circle-effect" aria-hidden="true" />;
}
