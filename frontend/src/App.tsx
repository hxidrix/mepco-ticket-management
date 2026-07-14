import { motion, useReducedMotion } from 'framer-motion';
import { BrowserRouter, Route, Routes } from 'react-router-dom';

import { BrandLogo } from './components/BrandLogo';
import { StatusPanel } from './components/StatusPanel';

const capabilities = [
  'Consumer services',
  'Employee support',
  'Traceable resolution',
] as const;

function FoundationPage() {
  const reduceMotion = useReducedMotion();
  const enter = reduceMotion ? {} : { opacity: 1, y: 0, filter: 'blur(0px)' };

  return (
    <main className="foundation-page">
      <div className="foundation-page__grid" aria-hidden="true" />
      <div className="foundation-page__glow" aria-hidden="true" />

      <nav className="foundation-nav" aria-label="Primary navigation">
        <BrandLogo compact />
        <span className="foundation-nav__milestone">Milestone 01 · Foundation</span>
      </nav>

      <div className="foundation-layout">
        <motion.section
          className="foundation-hero"
          initial={reduceMotion ? false : { opacity: 0, y: 18, filter: 'blur(8px)' }}
          animate={enter}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        >
          <p className="foundation-hero__eyebrow">
            <span /> One platform. Two service domains.
          </p>
          <h1>
            Report. Track.
            <span> Resolve.</span>
          </h1>
          <p className="foundation-hero__lede">
            One secure help desk for MEPCO consumers and employees, built around accountability,
            clear ownership, and complete ticket history.
          </p>

          <div className="foundation-hero__capabilities" aria-label="Platform capabilities">
            {capabilities.map((capability, index) => (
              <motion.div
                key={capability}
                initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                animate={reduceMotion ? {} : { opacity: 1, y: 0 }}
                transition={{ delay: 0.22 + index * 0.08, duration: 0.35 }}
              >
                <span>{String(index + 1).padStart(2, '0')}</span>
                {capability}
              </motion.div>
            ))}
          </div>
        </motion.section>

        <motion.aside
          className="foundation-card"
          initial={reduceMotion ? false : { opacity: 0, x: 20 }}
          animate={reduceMotion ? {} : { opacity: 1, x: 0 }}
          transition={{ delay: 0.12, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="foundation-card__topline">
            <span>Platform readiness</span>
            <span className="foundation-card__secure">Secure local setup</span>
          </div>
          <StatusPanel />
          <div className="foundation-card__architecture">
            <p>Connected foundation</p>
            <div>
              <span>React + Vite</span>
              <i aria-hidden="true" />
              <span>Express API</span>
              <i aria-hidden="true" />
              <span>MySQL</span>
            </div>
          </div>
          <p className="foundation-card__note">
            Authentication, role-specific workspaces, and ticket workflows will be added as verified
            vertical slices.
          </p>
        </motion.aside>
      </div>

      <footer className="foundation-footer">
        <span>MEPCO Information Technology Directorate</span>
        <span>Built for local Docker and XAMPP workflows</span>
      </footer>
    </main>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="*" element={<FoundationPage />} />
      </Routes>
    </BrowserRouter>
  );
}

