import mepcoLogoUrl from '../assets/mepco-brand-logo.png';

interface BrandLogoProps {
  compact?: boolean;
}

export function BrandLogo({ compact = false }: BrandLogoProps) {
  return (
    <div className={compact ? 'brand-lockup brand-lockup--compact' : 'brand-lockup'}>
      <div className="brand-lockup__plate">
        <img src={mepcoLogoUrl} alt="MEPCO" className="brand-lockup__image" />
      </div>
      <div className="brand-lockup__copy">
        <strong>MEPCO</strong>
        {!compact && <span>Integrated Help Desk</span>}
      </div>
    </div>
  );
}
