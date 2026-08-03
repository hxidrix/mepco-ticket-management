import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { BrandLogo } from './BrandLogo';
import { GlassSurface } from './GlassSurface';
import { SilkBackground } from './SilkBackground';
import { ThemeToggle } from './ThemeToggle';

interface PublicFlowLayoutProps {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  wide?: boolean;
  hideIntro?: boolean;
  className?: string;
}

export function PublicFlowLayout({
  eyebrow,
  title,
  description,
  children,
  wide = false,
  hideIntro = false,
  className = '',
}: PublicFlowLayoutProps) {
  const pageClassName = [
    'public-flow-page',
    wide ? 'public-flow-page--wide' : '',
    hideIntro ? 'public-flow-page--without-intro' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <main className={pageClassName}>
      <SilkBackground className="silk-background--auth" />
      <header className="public-flow-header">
        <Link className="public-flow-header__brand" to="/" aria-label="MEPCO public portal">
          <BrandLogo />
        </Link>
        <div className="public-flow-header__actions">
          <Link to="/">Public portal</Link>
          <ThemeToggle compact />
        </div>
      </header>
      <div className="public-flow-layout">
        {!hideIntro && (
          <section className="public-flow-intro">
            <p className="auth-hero__eyebrow">{eyebrow}</p>
            <h1>{title}</h1>
            <p>{description}</p>
          </section>
        )}
        <GlassSurface className="public-flow-card" borderRadius={24}>
          {children}
        </GlassSurface>
      </div>
    </main>
  );
}
