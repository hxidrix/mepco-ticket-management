import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';

type Channel = 'R' | 'G' | 'B';

interface GlassSurfaceProps {
  children: ReactNode;
  className?: string;
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
  borderWidth?: number;
  brightness?: number;
  opacity?: number;
  blur?: number;
  displace?: number;
  backgroundOpacity?: number;
  saturation?: number;
  distortionScale?: number;
  redOffset?: number;
  greenOffset?: number;
  blueOffset?: number;
  xChannel?: Channel;
  yChannel?: Channel;
}

export function GlassSurface({
  children,
  className = '',
  width = '100%',
  height = 'auto',
  borderRadius = 24,
  borderWidth = 0.07,
  brightness = 58,
  opacity = 0.9,
  blur = 12,
  displace = 0.5,
  backgroundOpacity = 0.08,
  saturation = 1.75,
  distortionScale = -110,
  redOffset = 0,
  greenOffset = 8,
  blueOffset = 16,
  xChannel = 'R',
  yChannel = 'G',
}: GlassSurfaceProps) {
  const instanceId = useId().replaceAll(':', '');
  const filterId = `glass-filter-${instanceId}`;
  const redGradientId = `red-gradient-${instanceId}`;
  const blueGradientId = `blue-gradient-${instanceId}`;
  const [svgSupported, setSvgSupported] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<SVGFEImageElement>(null);
  const redRef = useRef<SVGFEDisplacementMapElement>(null);
  const greenRef = useRef<SVGFEDisplacementMapElement>(null);
  const blueRef = useRef<SVGFEDisplacementMapElement>(null);
  const blurRef = useRef<SVGFEGaussianBlurElement>(null);

  const updateDisplacementMap = useCallback(() => {
    const bounds = containerRef.current?.getBoundingClientRect();
    const actualWidth = Math.max(bounds?.width ?? 400, 1);
    const actualHeight = Math.max(bounds?.height ?? 200, 1);
    const edgeSize = Math.min(actualWidth, actualHeight) * borderWidth * 0.5;
    const innerWidth = Math.max(actualWidth - edgeSize * 2, 1);
    const innerHeight = Math.max(actualHeight - edgeSize * 2, 1);
    const svg = `<svg viewBox="0 0 ${actualWidth} ${actualHeight}" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="${redGradientId}" x1="100%" y1="0%" x2="0%" y2="0%"><stop offset="0%" stop-color="#0000"/><stop offset="100%" stop-color="red"/></linearGradient><linearGradient id="${blueGradientId}" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#0000"/><stop offset="100%" stop-color="blue"/></linearGradient></defs><rect width="${actualWidth}" height="${actualHeight}" fill="black"/><rect width="${actualWidth}" height="${actualHeight}" rx="${borderRadius}" fill="url(#${redGradientId})"/><rect width="${actualWidth}" height="${actualHeight}" rx="${borderRadius}" fill="url(#${blueGradientId})" style="mix-blend-mode:difference"/><rect x="${edgeSize}" y="${edgeSize}" width="${innerWidth}" height="${innerHeight}" rx="${borderRadius}" fill="hsl(0 0% ${brightness}% / ${opacity})" style="filter:blur(${blur}px)"/></svg>`;

    imageRef.current?.setAttribute('href', `data:image/svg+xml,${encodeURIComponent(svg)}`);
  }, [blueGradientId, borderRadius, borderWidth, brightness, blur, opacity, redGradientId]);

  useEffect(() => {
    const channels = [
      { ref: redRef, offset: redOffset },
      { ref: greenRef, offset: greenOffset },
      { ref: blueRef, offset: blueOffset },
    ];
    channels.forEach(({ ref, offset }) => {
      ref.current?.setAttribute('scale', String(distortionScale + offset));
      ref.current?.setAttribute('xChannelSelector', xChannel);
      ref.current?.setAttribute('yChannelSelector', yChannel);
    });
    blurRef.current?.setAttribute('stdDeviation', String(displace));
    updateDisplacementMap();
  }, [blueOffset, displace, distortionScale, greenOffset, redOffset, updateDisplacementMap, xChannel, yChannel]);

  useEffect(() => {
    const container = containerRef.current;
    if (container === null || typeof ResizeObserver === 'undefined') return undefined;

    const observer = new ResizeObserver(updateDisplacementMap);
    observer.observe(container);
    return () => observer.disconnect();
  }, [updateDisplacementMap]);

  useEffect(() => {
    const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
    const isFirefox = /Firefox/.test(navigator.userAgent);
    const probe = document.createElement('div');
    probe.style.backdropFilter = `url(#${filterId})`;
    setSvgSupported(!isSafari && !isFirefox && probe.style.backdropFilter !== '');
  }, [filterId]);

  const style = {
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height,
    borderRadius: `${borderRadius}px`,
    '--glass-frost': backgroundOpacity,
    '--glass-saturation': saturation,
    '--filter-id': `url(#${filterId})`,
  } as CSSProperties;

  return (
    <div
      ref={containerRef}
      className={`glass-surface ${svgSupported ? 'glass-surface--svg' : 'glass-surface--fallback'}${className ? ` ${className}` : ''}`}
      style={style}
    >
      <svg className="glass-surface__filter" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <defs>
          <filter id={filterId} colorInterpolationFilters="sRGB" x="0%" y="0%" width="100%" height="100%">
            <feImage ref={imageRef} width="100%" height="100%" preserveAspectRatio="none" result="map" />
            <feDisplacementMap ref={redRef} in="SourceGraphic" in2="map" result="displaced-red" />
            <feColorMatrix in="displaced-red" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="red" />
            <feDisplacementMap ref={greenRef} in="SourceGraphic" in2="map" result="displaced-green" />
            <feColorMatrix in="displaced-green" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="green" />
            <feDisplacementMap ref={blueRef} in="SourceGraphic" in2="map" result="displaced-blue" />
            <feColorMatrix in="displaced-blue" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="blue" />
            <feBlend in="red" in2="green" mode="screen" result="red-green" />
            <feBlend in="red-green" in2="blue" mode="screen" result="output" />
            <feGaussianBlur ref={blurRef} in="output" stdDeviation="0.5" />
          </filter>
        </defs>
      </svg>
      <div className="glass-surface__content">{children}</div>
    </div>
  );
}
