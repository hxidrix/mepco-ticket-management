import type { CSSProperties, ReactNode } from 'react';

interface GlassSurfaceProps {
  children: ReactNode;
  className?: string;
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
}

export function GlassSurface({
  children,
  className = '',
  width = '100%',
  height = 'auto',
  borderRadius = 24,
}: GlassSurfaceProps) {
  const style = {
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height,
    borderRadius: `${borderRadius}px`,
  } as CSSProperties;

  return (
    <div className={`glass-surface glass-surface--clear${className ? ` ${className}` : ''}`} style={style}>
      <div className="glass-surface__content">{children}</div>
    </div>
  );
}
