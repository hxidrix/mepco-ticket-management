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
          <Link className="public-portal__sign-in" to="/login?mode=staff">
            Staff sign in
          </Link>
          <ThemeToggle compact />
        </div>
      </header>
      <section className="public-portal__hero">
        <div className="public-portal__intro">
          <p className="auth-hero__eyebrow">MEPCO Integrated Help Desk</p>
          <h1>Report. Track.<br />Resolve.</h1>
          <p>Submit a complaint or securely check its progress.</p>
        </div>
        <div className="public-portal__actions">
          <GlassSurface className="public-action-card" borderRadius={24}>
            <div className="public-action-card__topline">
              <span>New complaint</span>
            </div>
            <div className="public-action-card__body">
              <div>
                <h2>Submit Complaint</h2>
                <p>Consumers verify their billing connection. Employees verify their MEPCO identity.</p>
              </div>
              <div className="public-action-card__buttons">
                <Link className="button button--primary public-action-card__button" to="/complaints/verify">Consumer complaint</Link>
                <Link className="button public-action-card__button" to="/employee/complaints/verify">Employee complaint</Link>
              </div>
            </div>
          </GlassSurface>
          <GlassSurface className="public-action-card" borderRadius={24}>
            <div className="public-action-card__topline">
              <span>Existing complaint</span>
            </div>
            <div className="public-action-card__body">
              <div>
                <h2>Track Complaint</h2>
                <p>Use your tracking number, Reference Number, and Consumer ID to view the latest status.</p>
              </div>
              <Link className="button public-action-card__button" to="/complaints/track">
                Track complaint
              </Link>
            </div>
          </GlassSurface>
        </div>
      </section>
    </main>
  );
}
