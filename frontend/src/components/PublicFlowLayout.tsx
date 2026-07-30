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
  className?: string;
}

export function PublicFlowLayout({
  eyebrow,
  title,
  description,
  children,
  wide = false,
  className = '',
}: PublicFlowLayoutProps) {
  const pageClassName = [
    'public-flow-page',
    wide ? 'public-flow-page--wide' : '',
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
        <section className="public-flow-intro">
          <p className="auth-hero__eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p>{description}</p>
          <div className="public-flow-intro__assurance">
            <span>Secure verification</span>
            <span>No consumer account required</span>
          </div>
        </section>
        <GlassSurface className="public-flow-card" borderRadius={24}>
          {children}
        </GlassSurface>
      </div>
    </main>
  );
}
