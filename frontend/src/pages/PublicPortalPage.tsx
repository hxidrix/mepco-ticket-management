import { Link } from 'react-router-dom';

import { BrandLogo } from '../components/BrandLogo';
import { GlassSurface } from '../components/GlassSurface';
import { SilkBackground } from '../components/SilkBackground';
import { ThemeToggle } from '../components/ThemeToggle';

export function PublicPortalPage() {
  return (
    <main className="public-portal">
      <SilkBackground className="silk-background--auth" />
      <header className="public-portal__header">
        <BrandLogo />
        <div className="public-portal__header-actions">
          <Link className="public-portal__sign-in" to="/login">
            Employee / staff sign in
            <span aria-hidden="true">↗</span>
          </Link>
          <ThemeToggle compact />
        </div>
      </header>
      <section className="public-portal__hero">
        <div className="public-portal__intro">
          <p className="auth-hero__eyebrow">MEPCO Integrated Help Desk</p>
          <h1>Report. Track.<br />Resolve.</h1>
          <p>Submit an complaint or securely check its progress.</p>
        </div>
        <div className="public-portal__actions">
          <GlassSurface className="public-action-card" borderRadius={24}>
            <div className="public-action-card__topline">
              <span>01</span>
              <span>New complaint</span>
            </div>
            <div className="public-action-card__body">
              <div>
                <h2>Submit Complaint</h2>
                <p>Verify your billing details, describe the problem, and attach supporting evidence.</p>
              </div>
              <Link className="button button--primary public-action-card__button" to="/complaints/verify">
                Start complaint
                <span aria-hidden="true">→</span>
              </Link>
            </div>
          </GlassSurface>
          <GlassSurface className="public-action-card" borderRadius={24}>
            <div className="public-action-card__topline">
              <span>02</span>
              <span>Existing complaint</span>
            </div>
            <div className="public-action-card__body">
              <div>
                <h2>Track Complaint</h2>
                <p>Use your tracking number, Reference Number, and Consumer ID to view the latest status.</p>
              </div>
              <Link className="button public-action-card__button" to="/complaints/track">
                Track complaint
                <span aria-hidden="true">→</span>
              </Link>
            </div>
          </GlassSurface>
        </div>
      </section>
    </main>
  );
}
