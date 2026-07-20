import { useId } from 'react';
import { NavLink, useLocation } from 'react-router-dom';

interface SidebarNavItem {
  label: string;
  to: string;
}

interface SidebarNavGroupProps {
  items: SidebarNavItem[];
  label: string;
  onNavigate: () => void;
}

export function SidebarNavGroup({ items, label, onNavigate }: SidebarNavGroupProps) {
  const headingId = useId();
  const { pathname } = useLocation();

  return (
    <section className="workspace-nav-group" aria-labelledby={headingId}>
      <span id={headingId} className="workspace-nav-group__label">{label}</span>
      <ul className="workspace-nav-list">
        {items.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.to === '/app' || items.some((candidate) => (
                candidate.to.startsWith(`${item.to}/`)
                && (pathname === candidate.to || pathname.startsWith(`${candidate.to}/`))
              ))}
              onClick={onNavigate}
              className={({ isActive }) => isActive ? 'is-active' : undefined}
            >
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </section>
  );
}
